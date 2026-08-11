-- Beslut B etapp 2, Led 2: inskickade tävlingsresultat.
--
-- KÖR HELA filen i Supabase → SQL Editor → "New query" → klistra in → "Run".
-- Idempotent (kan köras om utan att förstöra data).
--
-- Beslut som formar tabellen (docs/beslut-b-plan.md, databasskissen + Led 2):
--  • En rad per (tävlingsdag, bricka, spelare) — ett inskick per giv, det
--    första står (unik nyckel nedan; servern avvisar ominskick).
--  • Skrivs BARA av serverns inskicks-endpoint med service-nyckeln, EFTER
--    validering (api-src/skicka-in.ts → validera.ts). Ingen INSERT-policy för
--    vanliga klienter — de kan bara LÄSA sina egna rader (status + poäng).
--  • Topplistan räknas ut server-side (matchpoints.ts) och läses via en egen
--    endpoint — klienter läser aldrig andras rader direkt. Därför räcker
--    "läs egen"-policyn; ingen materialiserad daily_standings-vy behövs.
--  • "Snabb" validering nu (ägarbeslut 2026-08-11): status 'godkand' | 'avvisad'
--    | 'granskning'. Den djupa bot-kort-granskningen (→ 'granskning') byggs i
--    etapp 3; kolumnen finns redan så inget schema behöver ändras då.

-- 1) Tabellen ---------------------------------------------------------------
create table if not exists public.daily_results (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.daily_sets (id) on delete cascade,
  board int not null,
  -- Spelaren (inloggningskontot). Raderas kontot → raderas resultaten (GDPR).
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Valideringens utfall.
  status text not null
    constraint status_giltig check (status in ('godkand', 'avvisad', 'granskning')),
  -- N/S-poängen (serverns omräknade) — grunden för matchpoängen. null vid avvisad.
  ns_score int,
  declarer_tricks int,
  passed_out boolean not null default false,
  -- Skäl vid avvisad/granskning (för ägarens granskningslogg).
  reason text,
  -- Inskickets auktion + spelade kort, för efterhandsgranskning (Led 2 djup nivå).
  payload jsonb,

  created_at timestamptz not null default now(),

  -- Ett inskick per spelare och bricka. Ominskick avvisas av endpointen.
  unique (set_id, board, user_id)
);

-- Snabb uppslagning per tävlingsdag (topplistan) och per spelare.
create index if not exists daily_results_set_idx on public.daily_results (set_id);
create index if not exists daily_results_user_idx on public.daily_results (user_id);

-- 2) Radskydd (RLS) ---------------------------------------------------------
alter table public.daily_results enable row level security;

-- Var och en får LÄSA sina egna inskick (status + poäng i appen). Andras rader
-- når man aldrig direkt — topplistan aggregeras server-side med service-nyckeln.
drop policy if exists "las egna resultat" on public.daily_results;
create policy "las egna resultat"
  on public.daily_results for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- MEDVETET ingen INSERT/UPDATE/DELETE-policy för klienter: inskicket SKRIVS av
-- serverns endpoint med service-nyckeln (efter validering), aldrig direkt av
-- klienten. Utan matchande policy är det helt blockerat för vanliga klienter.

-- 3) Rättigheter ------------------------------------------------------------
-- Inloggade får läsa (begränsat av policyn ovan). service_role (endpointen)
-- kringgår RLS men behöver ändå tabell-grants (nyskapade SQL-tabeller får dem
-- inte automatiskt).
grant select on public.daily_results to authenticated;
grant select, insert, update, delete on public.daily_results to service_role;
