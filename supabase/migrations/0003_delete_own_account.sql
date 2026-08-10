-- Beslut B etapp 1, steg 6: självbetjänad kontoradering ("radera allt").
--
-- En RPC som låter en INLOGGAD användare radera SITT EGET konto. Körs som
-- SECURITY DEFINER så den får ta bort raden i auth.users. Kaskaden i profiles
-- (on delete cascade, 0001) tar profilraden, och Supabases auth-schema städar
-- användarens sessioner/identiteter. Ingen serverfunktion eller service-nyckel
-- behövs — allt sker säkert i databasen, begränsat till den egna raden via
-- auth.uid().
--
-- Kör HELA filen i Supabase → SQL Editor → Run.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skydd: bara en inloggad användare får radera, och bara sig själv.
  if auth.uid() is null then
    raise exception 'Inte inloggad';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Bara inloggade får anropa den (aldrig anonyma).
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
