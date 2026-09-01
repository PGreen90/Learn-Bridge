-- Bot-deltagaren, lagning efter första skarpa körningen (2026-09-01).
--
-- KÖRD i Supabase 2026-09-01 (ägarens query "0011"). Idempotent.
--
-- Nattjobbet (tavlingsbot.probe.test.ts) flaggar botens profil med
-- PATCH is_bot=true via service-nyckeln. service_role kringgår radskyddet men
-- behöver ändå tabell-grants — migration 0006 gav bara SELECT på profiles, så
-- första körningen föll med 403 "permission denied for table profiles".

grant update on public.profiles to service_role;
