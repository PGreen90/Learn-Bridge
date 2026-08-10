-- Beslut B etapp 2, steg 2: tävlingsdagar + servergenererade givar.
--
-- KÖR HELA filen i Supabase → SQL Editor → "New query" → klistra in → "Run".
-- Idempotent (kan köras om utan att förstöra data).
--
-- Beslut som formar tabellerna (docs/beslut-b-plan.md, databasskissen):
--  • daily_sets  = en rad per tävlingsdag (datum + storlek, 12 nu).
--  • daily_deals = dagens givar; händerna lagras som jsonb.
--  • Skrivs BARA av serverns giv-generering med service-nyckeln (kringgår RLS).
--    HMAC-fröet gör givarna oförberäkneliga; servern kan spela om dem vid
--    valideringen eftersom samma frö ger exakt samma giv.

-- 1) Tävlingsdagen ----------------------------------------------------------
create table if not exists public.daily_sets (
  id uuid primary key default gen_random_uuid(),
  -- Tävlingsdagen i Europe/Stockholm ("ÅÅÅÅ-MM-DD"). Unik → en tävling per dag,
  -- och grunden för genereringens idempotens (upsert på comp_date).
  comp_date date not null unique,
  size int not null default 12,
  -- Löpnumret (Dagens giv-numreringen) — bekvämt för visning ("Tävling #N").
  daily_number int,
  created_at timestamptz not null default now()
);

-- 2) Dagens givar -----------------------------------------------------------
create table if not exists public.daily_deals (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.daily_sets (id) on delete cascade,
  board int not null,
  dealer text not null,
  vulnerability text not null,
  -- Alla fyra händerna som jsonb. Göms för klienter av radskyddet nedan tills
  -- etapp 2:s hämtningsväg byggs (given läsbar när dagen är inne; facit först
  -- efter eget inskick).
  hands jsonb not null,
  created_at timestamptz not null default now(),
  -- Idempotens: en bricka per tävlingsdag. Omkörning ignorerar dubbletter.
  unique (set_id, board)
);

-- 3) Radskydd (RLS) PÅ, MEDVETET inga policys ännu --------------------------
-- Utan matchande policy är tabellerna helt utestängda för anon/authenticated.
-- Bara serverns service-nyckel (giv-genereringen) kommer åt dem — den kringgår
-- RLS. Läspolicyerna (vem får se en giv, och när) läggs till när hämtnings-
-- vägen byggs i nästa delsteg.
alter table public.daily_sets enable row level security;
alter table public.daily_deals enable row level security;

-- 4) Rättigheter till service-nyckeln --------------------------------------
-- service_role kringgår RLS men behöver ändå TABELL-rättigheter (GRANT).
-- Nyskapade tabeller via SQL-editorn får dem inte automatiskt → ge dem
-- explicit. Bara service_role (serverns giv-generering) — anon/authenticated
-- lämnas utan både policy och grant, alltså helt utestängda.
grant select, insert, update, delete on public.daily_sets to service_role;
grant select, insert, update, delete on public.daily_deals to service_role;
