-- Beslut B etapp 4 (4B) — reserverade botstolar.
--
-- KÖR HELA filen i Supabase → SQL Editor (samma rutin som 0007). Idempotent.
--
-- Ägarens krav (2026-08-17): på ett publikt bord ska ägaren kunna RESERVERA en
-- ledig stol som bot före start — annars kan vem som helst sätta sig på den.
-- En reserverad stol visas som "Bot" i lobbyn/väntrummet, kan inte tas av
-- människor (gå-med hoppar över den) och spelas av servern efter start.
-- Ägaren kan ångra (stolen blir "Ledig" igen). Utan reservation fylls lediga
-- stolar precis som förut med bottar först vid start.

alter table public.table_seats
  add column if not exists bot_reserverad boolean not null default false;
