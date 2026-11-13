-- 0016 — Givens berättelse (ägaridé 2026-11-13).
--
-- En giv i Veckans stjärntävling kan bära en kort text om hur den en gång
-- spelades ("EM 1974 — så gick det vid bordet"). Texten visas under fältets
-- resultat FÖRST när spelaren själv har spelat given: den lämnas bara ut av
-- /api/giv-resultat, bakom samma tjuvkiksgrind som travellern.
--
-- Kolumnen är valfri. Givar utan berättelse (alla dagliga, och stjärnveckor
-- som väljs ur slumpen) har null och visar ingen ruta.
--
-- Ingen ny rättighet behövs: daily_deals läses och skrivs bara av serverns
-- service-nyckel (0004), och RLS utan policy stänger ute alla andra.
--
-- Körs för hand i Supabase SQL Editor. Kan köras flera gånger.

alter table public.daily_deals
  add column if not exists berattelse text;

comment on column public.daily_deals.berattelse is
  'Valfri kort berättelse om given (t.ex. hur den spelades i ett mästerskap). Lämnas ut av giv-resultat först efter eget inskick.';
