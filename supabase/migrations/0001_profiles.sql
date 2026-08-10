-- Beslut B etapp 1, steg 2: profiles-tabellen + radskydd (RLS) + auto-skapande
-- av profil vid registrering.
--
-- KÖR HELA filen i Supabase → SQL Editor → "New query" → klistra in → "Run".
-- Skriven för att kunna köras om (idempotent) utan att förstöra befintlig data.
--
-- Beslut som formar tabellen (2026-08-10, docs/beslut-b-plan.md):
--  • visningsnamn unikt, skiftlägesokänsligt ("Anna"="anna"), 4–10 tecken,
--    bokstäver (inkl. å ä ö) + siffror + _ och -.
--  • 13+-kryss krävs vid registrering.
--  • radera allt vid kontoradering (kaskad från inloggningskontot).
--  • namnet är LÅST för användaren — bara ägaröverstyrning (via serverns
--    service-nyckel, som kringgår RLS) kan ändra det i efterhand.
--  • mejladressen lagras ALDRIG här (den bor i auth.users) — den visas aldrig
--    för andra spelare.

-- 1) Tabellen ---------------------------------------------------------------
create table if not exists public.profiles (
  -- Samma id som inloggningskontot. Raderas kontot → raderas profilen.
  id uuid primary key references auth.users (id) on delete cascade,

  -- Visningsnamn: 4–10 tecken ur den tillåtna teckenmängden. Regexet vaktar
  -- BÅDE tecknen och längden. Skiftlägesokänslig unikhet: se indexet nedan.
  display_name text not null
    constraint display_name_format
    check (display_name ~ '^[A-Za-zÅÄÖåäö0-9_-]{4,10}$'),

  -- 13-årsgränsen: raden får bara finnas om kryssrutan bekräftats (= true).
  is_13_plus boolean not null
    constraint must_be_13_plus check (is_13_plus),

  created_at timestamptz not null default now()
);

-- Skiftlägesokänslig UNIK regel på visningsnamnet — databasen vägrar dubbletter
-- oavsett stora/små bokstäver.
create unique index if not exists profiles_display_name_unique
  on public.profiles (lower(display_name));

-- 2) Radskydd (RLS) ---------------------------------------------------------
alter table public.profiles enable row level security;

-- Var och en får LÄSA sin egen profil. (Andras visningsnamn öppnas först i
-- etapp 2, när topplistorna behöver dem — via en egen, avgränsad väg, inte
-- genom att lämna hela tabellen öppen.)
drop policy if exists "las egen profil" on public.profiles;
create policy "las egen profil"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

-- MEDVETET ingen INSERT/UPDATE/DELETE-policy för användare:
--   • profilen SKAPAS av triggern nedan (körs med förhöjd behörighet),
--   • visningsnamnet är låst (ändras bara via ägaröverstyrning/service-nyckel),
--   • radering sker genom att kontot raderas (kaskaden i tabellen ovan).
-- Utan matchande policy är dessa operationer helt blockerade för vanliga
-- inloggade klienter — precis meningen.

-- 3) Skapa profil automatiskt vid registrering ------------------------------
-- När ett nytt inloggningskonto skapas läses visningsnamn + 13+-kryss ur
-- registreringens metadata (skickas av appen vid signup) och en profilrad
-- skapas i samma transaktion. Går något fel (t.ex. namnet är taget) rullas
-- HELA registreringen tillbaka — inget halvskapat konto blir kvar.
--
-- SECURITY DEFINER = körs med funktionsägarens (förhöjda) behörighet så att
-- insert får ske trots RLS. Tom search_path är säkerhetspraxis (allt schema-
-- kvalificeras explicit).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, is_13_plus)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    coalesce((new.raw_user_meta_data ->> 'is_13_plus')::boolean, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
