-- Beslut B etapp 1, steg 2 (forts.): läsrätt till profiles för INLOGGADE.
--
-- Bakgrund: projektet skapades med "Automatically expose new tables" AVSTÄNGT
-- (medvetet, för säkerheten). Följden är att nya tabeller inte får några
-- privilegier alls automatiskt — även en inloggad klient nekas ("permission
-- denied for table profiles", kod 42501) innan radskyddet ens hinner gälla.
--
-- Vi öppnar därför en exakt, minimal glugg: SELECT för rollen `authenticated`.
-- Radskyddspolicyn "las egen profil" (0001) begränsar sedan den läsningen till
-- den egna raden. Rollen `anon` (utloggade) får MEDVETET ingenting — de ska
-- inte kunna läsa profiler. Ingen INSERT/UPDATE/DELETE ges till någon: profilen
-- skapas av triggern (SECURITY DEFINER) och namnet är låst.
--
-- Kör HELA filen i Supabase → SQL Editor → Run.

grant select on table public.profiles to authenticated;
