-- Beslut B etapp 3 — Dagens giv-loggen på kontot (arkiv + streak cross-device).
--
-- KÖR HELA filen i Supabase → SQL Editor (samma rutin som tidigare). Idempotent.
--
-- Bakgrund: kalenderarkivet och 🔥-sviten för DAGENS GIV bodde bara i
-- localStorage (`daily-log`) — byter man enhet är historiken borta. Nu
-- speglas loggen på kontot: klienten synkar vid arkivbesök/spel, servern är
-- samlingspunkten. "Första resultatet står" (samma regel som lokalt) — därför
-- skriver endpointen med ignore-duplicates, aldrig över.

create table if not exists public.daily_log (
  -- Kontot. Raderas kontot → raderas loggen (GDPR).
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Dagens giv-numret (#1 = premiären).
  giv_nummer int not null constraint daily_log_nummer_rimligt check (giv_nummer >= 1),
  my_tricks int not null constraint daily_log_stick_rimliga check (my_tricks between 0 and 13),
  -- Spelad i efterhand (kalenderarkivet) — räknas aldrig in i streaken.
  late boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, giv_nummer)
);

alter table public.daily_log enable row level security;

-- Var och en får LÄSA sin egen logg; skrivningen går via serverns endpoint
-- (service-nyckeln) som validerar raderna — ingen klient-INSERT-policy.
drop policy if exists "las egen dagslogg" on public.daily_log;
create policy "las egen dagslogg"
  on public.daily_log for select
  to authenticated
  using ( (select auth.uid()) = user_id );

grant select on public.daily_log to authenticated;
grant select, insert, update, delete on public.daily_log to service_role;
