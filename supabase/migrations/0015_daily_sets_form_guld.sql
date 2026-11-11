-- 0015 — Veckans guld-tävling: tävlingsformen 'guld' (ägarbeslut 2026-11-11).
--
-- En tredje tävlingsform bredvid de dagliga 'mp' och 'imp': tolv UTVALDA svåra
-- givar, öppen måndag–söndag, räknad i MP%. Tävlingen ligger som ETT set i
-- daily_sets med comp_date = veckans MÅNDAG och form = 'guld'. Givarna kommer
-- inte ur det hemliga fröet — de väljs ut av ett jobb i GitHub Actions och
-- lagras i daily_deals precis som de dagliga givarna.
--
-- Inget annat i databasen behöver ändras: givar, inskick och kvoter hänger på
-- set_id. Den unika nyckeln (comp_date, form) från 0013 gör att guld-setet inte
-- krockar med måndagens dagliga tävlingar.
--
-- Körs för hand i Supabase SQL Editor. Kan köras flera gånger.

alter table public.daily_sets
  drop constraint if exists daily_sets_form_giltig;

alter table public.daily_sets
  add constraint daily_sets_form_giltig check (form in ('mp', 'imp', 'guld'));

comment on column public.daily_sets.form is
  'Tävlingsformen: mp/imp = de dagliga (comp_date = dagen). guld = Veckans guld-tävling (comp_date = veckans måndag, räknas i MP%).';
