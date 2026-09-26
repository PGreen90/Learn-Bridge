-- Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md) — steg 2 av 2:
-- släpp den gamla "en tävling per dag"-nyckeln.
--
-- KÖR HELA filen i Supabase → SQL Editor (döp queryn "0014"). Idempotent.
-- KÖRS EFTER deploy A (etapp 0–3) — se 0013 för varför ordningen är tvingande.
-- Efter den här filen skapar nästa cron (01:05 svensk tid) det första
-- IMP-setet; dessförinnan faller IMP-raden tyst på den här nyckeln medan
-- MP-setet skapas som förr (koden är byggd för det).

-- Nyckeln från 0004 heter daily_sets_comp_date_key (Postgres standardnamn för
-- "comp_date date not null unique"). Släpp den om den finns.
alter table public.daily_sets
  drop constraint if exists daily_sets_comp_date_key;

-- Sanity: den nya nyckeln (0013) måste finnas — annars vore tabellen öppen för
-- dubbletter. Stoppa hellre än att lämna hålet.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'daily_sets_comp_date_form_key'
  ) then
    raise exception 'Kör 0013 först: daily_sets_comp_date_form_key saknas';
  end if;
end $$;
