// Kontohantering (Beslut B etapp 1, steg 6): radera konto + exportera data.
// GDPR: rätten att bli glömd + dataportabilitet, självbetjänat.
//
// Påbyggnad 3 (2026-09-13): "Spelade givar" på Mitt konto räknas här, ur de
// EGNA raderna (RLS-policyerna "läs egna resultat"/"läs egen dagslogg" släpper
// bara igenom user_id = auth.uid(); vi filtrerar ändå uttryckligen så frågan är
// ärlig). Tävlingsgivar = godkända + under granskning (avvisade är ingen giv);
// Dagens giv = kalenderloggen. Fritt spel mot datorn finns bara lokalt och
// räknas inte (ägarbeslut).

import { getSupabase } from './supabase'
import { fetchProfile } from './auth'

/** Radera det egna kontot och ALL data ("radera allt"-beslutet). Anropar RPC:n
 *  delete_own_account (0003) som tar bort auth.users-raden; kaskaden tar
 *  profilen, resultaten, dagsloggen och placeringarna. Efteråt är sessionen
 *  ogiltig — kallaren bör logga ut och navigera bort. Oåterkalleligt. */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_own_account')
  if (error) throw new Error(error.message)
}

/** Antal spelade givar per källa + totalen (Mitt konto). */
export interface SpeladeGivar {
  tavling: number
  dagensGiv: number
  totalt: number
}

/** Tävlingsstatusar som räknas som en spelad giv. */
const SPELAD_STATUS = ['godkand', 'granskning']

/** Räkna den inloggades spelade givar: tävlingsgivar + Dagens giv. Två
 *  count-frågor (head — inga rader hämtas) parallellt. Kastar vid fel. */
export async function fetchSpeladeGivar(): Promise<SpeladeGivar> {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const id = userData.user?.id
  if (!id) throw new Error('Inte inloggad.')
  const [tavling, logg] = await Promise.all([
    supabase
      .from('daily_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id)
      .in('status', SPELAD_STATUS),
    supabase.from('daily_log').select('*', { count: 'exact', head: true }).eq('user_id', id),
  ])
  if (tavling.error) throw new Error(tavling.error.message)
  if (logg.error) throw new Error(logg.error.message)
  const t = tavling.count ?? 0
  const d = logg.count ?? 0
  return { tavling: t, dagensGiv: d, totalt: t + d }
}

/** All data vi har om användaren, som ett JSON-vänligt objekt (dataportabilitet):
 *  kontot + profilen (etapp 1), tävlingsresultaten inkl. den sparade auktionen
 *  och korten (etapp 2), Dagens giv-loggen (etapp 3) och de slutliga
 *  tävlingsplaceringarna (Påbyggnad 3, `daily_standings` — null om tabellen
 *  inte finns än, så exporten aldrig faller på en okörd migration). */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const id = userData.user?.id ?? null
  const profile = await fetchProfile()

  const egna = async (tabell: string, kolumner: string, ordning: string): Promise<unknown[] | null> => {
    if (!id) return []
    const { data, error } = await supabase.from(tabell).select(kolumner).eq('user_id', id).order(ordning)
    if (error) return null
    return data ?? []
  }
  const tavlingsresultat = await egna(
    'daily_results',
    'set_id, board, status, ns_score, declarer_tricks, passed_out, reason, payload, created_at',
    'created_at',
  )
  const dagensGivLogg = await egna('daily_log', 'giv_nummer, my_tricks, late, created_at', 'giv_nummer')
  const tavlingsplaceringar = await egna(
    'daily_standings',
    'set_id, placering, snitt, antal_givar, spelade, created_at',
    'created_at',
  )

  return {
    exporterad: new Date().toISOString(),
    konto: {
      id,
      epost: userData.user?.email ?? null,
      skapad: userData.user?.created_at ?? null,
    },
    profil: profile,
    tavlingsresultat: tavlingsresultat ?? [],
    dagensGivLogg: dagensGivLogg ?? [],
    tavlingsplaceringar,
  }
}
