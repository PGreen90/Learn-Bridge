// Kontohantering (Beslut B etapp 1, steg 6): radera konto + exportera data.
// GDPR: rätten att bli glömd + dataportabilitet, självbetjänat.

import { getSupabase } from './supabase'
import { fetchProfile } from './auth'

/** Radera det egna kontot och ALL data ("radera allt"-beslutet). Anropar RPC:n
 *  delete_own_account (0003) som tar bort auth.users-raden; kaskaden tar
 *  profilen. Efteråt är sessionen ogiltig — kallaren bör logga ut och navigera
 *  bort. Oåterkalleligt. */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_own_account')
  if (error) throw new Error(error.message)
}

/** All data vi har om användaren, som ett JSON-vänligt objekt (dataportabilitet).
 *  I etapp 1: kontots e-post + profilen. Utökas när spelresultat flyttar till
 *  servern (etapp 2). */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const profile = await fetchProfile()
  return {
    exporterad: new Date().toISOString(),
    konto: {
      id: userData.user?.id ?? null,
      epost: userData.user?.email ?? null,
      skapad: userData.user?.created_at ?? null,
    },
    profil: profile,
  }
}
