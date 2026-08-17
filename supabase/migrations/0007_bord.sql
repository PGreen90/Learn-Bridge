-- Beslut B etapp 4 (4A) — realtidsborden "Spela med vänner".
--
-- KÖR HELA filen i Supabase → SQL Editor → "New query" → klistra in → "Run".
-- Idempotent (kan köras om utan att förstöra data).
--
-- Beslut som formar schemat (ägarbeslut 2026-08-17, docs/bord-plan.md):
--  • Servern är domaren: allt skrivs av serverfunktionen med service-nyckeln.
--    Klienter har EN enda läspolicy — bordets deltagare får läsa bordets
--    händelser (krävs för Supabase Realtime Postgres Changes). Inget annat.
--  • table_events är append-only med sekvensnummer; primärnyckeln
--    (table_id, seq) är kapplöpningsvakten — två samtidiga skrivare kan aldrig
--    bokföra samma sekvensnummer, förloraren får konfliktfel och läser om.
--  • Händelsernas data-kolumn innehåller ALDRIG ospelade dolda händer
--    (Nivå 2-fusksäkerheten): egen hand hämtas per stol via endpointen,
--    träkarlen avslöjas som händelse först efter utspelet.
--  • Max ett aktivt bord per ägare + en aktiv stol per användare (unika
--    partial-index nedan). Globala taket (10 bord) vaktas i serverfunktionen.
--  • api_kvot + kvot_okning() = rate limit-mekaniken ("minimal härdning
--    inbakad", ägarbeslut 2026-08-17): fast fönster, atomisk upsert+increment.

-- 1) Borden ------------------------------------------------------------------
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  -- Inbjudningskoden (6 tecken, A-Z/2-9 utan förväxlingsbara) — även länken
  -- #/bord/KOD. Unik så en kod alltid pekar på exakt ett bord.
  kod text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby'
    constraint tables_status_giltig check (status in ('lobby', 'spelar', 'klar', 'avslutat')),
  spelform text not null
    constraint tables_spelform_giltig check (spelform in ('budgivning', 'spelforing', 'full')),
  givar int not null
    constraint tables_givar_rimliga check (givar between 1 and 24),
  tempo text not null default 'normal'
    constraint tables_tempo_giltigt check (tempo in ('lugn', 'normal', 'snabb')),
  privat boolean not null default false,
  -- Hemligt bordsfrö (hex) → givarna härleds med HMAC (api-src/_lib/seed.ts-
  -- mönstret). Når ALDRIG klienten — därför får klienter aldrig läsa tables.
  seed text not null,
  aktuell_giv int not null default 0,
  -- Läge "endast spelföring": round-robin-pekare för vems tur det är att
  -- spelföra (räknas över människostolarna i stolordning N,E,S,W).
  rotation_pekare int not null default 0,
  last_activity timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Ägarbeslut: max ETT aktivt bord per användare.
create unique index if not exists tables_ett_aktivt_per_agare
  on public.tables (owner_id) where status in ('lobby', 'spelar');

-- 2) Stolarna ----------------------------------------------------------------
create table if not exists public.table_seats (
  table_id uuid not null references public.tables (id) on delete cascade,
  seat text not null
    constraint table_seats_stol_giltig check (seat in ('N', 'E', 'S', 'W')),
  -- Kontot på stolen. Raderas kontot → stolen blir bot (set null), bordet
  -- lever vidare (GDPR: inga personuppgifter blir kvar).
  user_id uuid references auth.users (id) on delete set null,
  typ text not null default 'bot'
    constraint table_seats_typ_giltig check (typ in ('bot', 'manniska')),
  status text not null default 'aktiv'
    constraint table_seats_status_giltig check (status in ('aktiv', 'paus', 'borta')),
  -- false när stolen frigjorts (spelaren lämnade/bordet slutade) — då släpper
  -- "en stol per användare"-indexet sin rad.
  aktiv boolean not null default true,
  last_seen_at timestamptz,
  joined_at timestamptz,
  primary key (table_id, seat)
);

-- En användare kan bara sitta på EN aktiv stol totalt (över alla bord).
create unique index if not exists table_seats_en_stol_per_anvandare
  on public.table_seats (user_id) where user_id is not null and aktiv;

-- 3) Händelseloggen ----------------------------------------------------------
create table if not exists public.table_events (
  table_id uuid not null references public.tables (id) on delete cascade,
  seq int not null,
  -- Vilken giv händelsen hör till (1..givar); 0 = bordshändelse (stolbyten,
  -- start, ägarbyte, slut).
  giv int not null default 0,
  -- Händelsetyperna (docs/bord-plan.md): 'bord-startat','giv-start','bud',
  -- 'kort','trakarl','facit','giv-klar','stol','paus-begaran','paus-svar',
  -- 'lamna-begaran','lamna-svar','agarbyte','bord-slut'. Ingen check-lista —
  -- servern är enda skrivaren och nya typer ska inte kräva migration.
  typ text not null,
  seat text
    constraint table_events_stol_giltig check (seat is null or seat in ('N', 'E', 'S', 'W')),
  -- Händelsedata. ALDRIG ospelade dolda händer (se filhuvudet).
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  -- Kapplöpningsvakten: sekvensnumret är unikt per bord.
  primary key (table_id, seq)
);

create index if not exists table_events_giv_idx on public.table_events (table_id, giv);

-- 4) Rate limit-kvoten -------------------------------------------------------
create table if not exists public.api_kvot (
  user_id uuid not null,
  endpoint text not null,
  -- Fönstrets starttid (fast fönster: now() avrundad nedåt till fönsterlängden).
  fonster timestamptz not null,
  antal int not null default 1,
  primary key (user_id, endpoint, fonster)
);

-- Atomisk räknare: öka anropsräknaren i det aktuella fönstret och svara om
-- anropet ryms under taket. Anropas av serverfunktionen (service-nyckeln) via
-- PostgREST RPC — en rundresa, säker mot samtidighet (upsert + increment).
create or replace function public.kvot_okning(
  p_user uuid,
  p_endpoint text,
  p_fonster_sek int,
  p_tak int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fonster timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_fonster_sek) * p_fonster_sek);
  v_antal int;
begin
  insert into public.api_kvot as k (user_id, endpoint, fonster, antal)
  values (p_user, p_endpoint, v_fonster, 1)
  on conflict (user_id, endpoint, fonster)
    do update set antal = k.antal + 1
  returning k.antal into v_antal;
  return v_antal <= p_tak;
end
$$;

-- Bara servern får köra kvotfunktionen (definer-funktioner får annars execute
-- till public automatiskt).
revoke execute on function public.kvot_okning(uuid, text, int, int) from public;
revoke execute on function public.kvot_okning(uuid, text, int, int) from anon;
revoke execute on function public.kvot_okning(uuid, text, int, int) from authenticated;
grant execute on function public.kvot_okning(uuid, text, int, int) to service_role;

-- 5) Radskydd (RLS) ----------------------------------------------------------
alter table public.tables enable row level security;
alter table public.table_seats enable row level security;
alter table public.table_events enable row level security;
alter table public.api_kvot enable row level security;

-- ENDA klientpolicyn: bordets deltagare får LÄSA bordets händelser — det är
-- vad Supabase Realtime (Postgres Changes) auktoriserar prenumerationen mot.
-- Händelserna är per design fria från dold information, så policyn läcker
-- inga kort ens i teorin.
drop policy if exists "las bordets handelser" on public.table_events;
create policy "las bordets handelser"
  on public.table_events for select
  to authenticated
  using (
    exists (
      select 1 from public.table_seats s
      where s.table_id = table_events.table_id
        and s.user_id = (select auth.uid())
        and s.aktiv
    )
  );

-- tables / table_seats / api_kvot: MEDVETET inga klientpolicys — bara serverns
-- service-nyckel (kringgår RLS) läser och skriver. Klienten får bordslistan,
-- stolarna och sin hand via serverfunktionens endpoints.

-- 6) Rättigheter -------------------------------------------------------------
grant select on public.table_events to authenticated;
grant select, insert, update, delete on public.tables to service_role;
grant select, insert, update, delete on public.table_seats to service_role;
grant select, insert, update, delete on public.table_events to service_role;
grant select, insert, update, delete on public.api_kvot to service_role;

-- 7) Realtime ----------------------------------------------------------------
-- Publicera händelseloggen till Realtime (Postgres Changes). Idempotent vakt:
-- lägg bara till om tabellen inte redan är med i publikationen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_events'
  ) then
    alter publication supabase_realtime add table public.table_events;
  end if;
end
$$;
