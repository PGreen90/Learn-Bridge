-- Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md) — steg 1 av 2:
-- tävlingsformen som kolumn på tävlingsdagen.
--
-- KÖR HELA filen i Supabase → SQL Editor (döp queryn "0013"). Idempotent.
-- KÖRS FÖRE deploy A (etapp 0–3): den nya koden upsertar daily_sets på
-- (comp_date, form) och behöver den unika nyckeln nedan. Den GAMLA unika
-- nyckeln på comp_date står KVAR här med flit — koden som ligger live när
-- filen körs upsertar fortfarande på comp_date (cronen 01:05 svensk tid), och
-- utan nyckeln faller den. Den släpps i 0014, EFTER deploy A.
--
-- Bakgrund: schemat låste "en tävling per dag" (0004: comp_date unik). Nu ska
-- två tävlingar samma dag finnas — Dagens MP% (form 'mp') och Dagens IMP
-- (form 'imp', tolv egna givar). daily_deals, daily_results och
-- daily_standings hänger på set_id och behöver INGEN ändring: IMP-tävlingens
-- givar, inskick och frusna ställningar bor i samma tabeller under sitt eget
-- set. daily_standings.snitt rymmer IMP-summan (numeric(5,2), ±999,99) —
-- setets form säger vad talet betyder.

-- 1) Kolumnen. Befintliga rader blir 'mp' automatiskt (default) → historiken
--    är intakt utan datamigrering.
alter table public.daily_sets
  add column if not exists form text not null default 'mp';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_sets_form_giltig'
  ) then
    alter table public.daily_sets
      add constraint daily_sets_form_giltig check (form in ('mp', 'imp'));
  end if;
end $$;

-- 2) Den nya unika nyckeln: EN tävling per dag OCH form.
create unique index if not exists daily_sets_comp_date_form_key
  on public.daily_sets (comp_date, form);

-- 3) Kommentar så nästa läsare av daily_standings vet vad snitt betyder.
comment on column public.daily_standings.snitt is
  'Ställningens tal vid midnatt. MP-set: tillsvidare-snittet i procent (0–100). IMP-set: summan av cross-IMP. Formen står på daily_sets.form.';
