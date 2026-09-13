-- Påbyggnad 3 (livskvalitetssvepet, ägarbeslut 2026-09-13) — den SLUTLIGA
-- ställningen per tävlingsdag: tävlingshistoriken och medaljtabellen.
--
-- KÖR HELA filen i Supabase → SQL Editor (döp queryn "0012"). Idempotent.
--
-- Bakgrund: dagens ställning räknas i farten ur daily_results (topplista.ts).
-- Historiken (gårdagar) och medaljtabellen (guld/silver/brons över alla dagar)
-- behöver en FRYST placering per dag och spelare — annars skulle varje anrop
-- återaggregera alla dagars resultat (obegränsad växt) och en efterhands-
-- ändring (granskningens statusflytt) kunde ändra en redan utdelad medalj.
-- Raderna skrivs idempotent av nattjobbet (tavling-granskning.yml, steget
-- "Avsluta gårdagens tävling") EFTER svensk midnatt och efter djupgranskningen.
-- Bottarna lagras också (de var med i ställningen); medaljtabellen utesluter
-- dem vid räkningen (profiles.is_bot), aldrig i API-svaret.

create table if not exists public.daily_standings (
  -- Tävlingsdagen. Raderas dagen → raderas ställningen.
  set_id uuid not null references public.daily_sets (id) on delete cascade,
  -- Kontot. Raderas kontot → raderas placeringarna (GDPR, "radera allt").
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Slutlig placering (delad rang: 1 + antalet med strikt högre snitt).
  placering int not null constraint daily_standings_placering_rimlig check (placering >= 1),
  -- Tillsvidare-snittet mot tävlingens storlek (0–100), som det såg ut vid midnatt.
  snitt numeric(5,2) not null,
  -- Antal poängsatta givar (≥ 2 spelare) resp. antal inskickade godkända givar.
  antal_givar int not null,
  spelade int not null,
  created_at timestamptz not null default now(),
  primary key (set_id, user_id)
);

create index if not exists daily_standings_user_idx on public.daily_standings (user_id);

alter table public.daily_standings enable row level security;

-- Var och en får LÄSA sina egna placeringar (dataexporten på Mitt konto);
-- allt annat — historiksidan, medaljtabellen — går via serverns endpoint
-- (service-nyckeln). Ingen klient-INSERT/UPDATE/DELETE-policy.
drop policy if exists "las egen stallning" on public.daily_standings;
create policy "las egen stallning"
  on public.daily_standings for select
  to authenticated
  using ( (select auth.uid()) = user_id );

grant select on public.daily_standings to authenticated;
grant select, insert, update, delete on public.daily_standings to service_role;
