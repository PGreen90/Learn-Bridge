-- Bot-deltagaren i dagliga tävlingen (ägarbeslut 2026-08-31).
--
-- KÖR HELA filen i Supabase → SQL Editor → "New query" → klistra in → "Run".
-- Idempotent (kan köras om utan att förstöra data).
--
-- Boten är ett VANLIGT konto (auth.users + profiles, skapas av nattjobbet via
-- admin-API:t första gången det kör) — då fungerar alla befintliga vägar
-- (daily_results-FK:n, topplistan, nattgranskningen) utan specialfall. Det enda
-- schemat behöver är en flagga så topplistan kan märka botens rad med 🤖 och
-- framtida statistik kan skilja människor från bottar.

alter table public.profiles
  add column if not exists is_bot boolean not null default false;

comment on column public.profiles.is_bot is
  'Bot-konto (t.ex. rebidz-bot i dagliga tävlingen). Sätts bara av nattjobbet via service-nyckeln.';
