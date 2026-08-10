// Supabase-klienten — Beslut B etapp 1 (konton), steg 1 (rörmokeriet).
//
// DET HÄR är enda stället i appen som skapar kopplingen till Supabase. Backend-
// lagret (index.ts) och de kommande auth-funktionerna använder klienten härifrån
// — sidorna rör den aldrig direkt (samma princip som resten av backend-lagret:
// byt implementationen på ETT ställe).
//
// Klienten skapas LATT (lazy) och en enda gång (singleton): den byggs först när
// någon faktiskt behöver den, inte vid modulinladdning. Det gör att tester och
// sidor som aldrig loggar in slipper kräva konfiguration, och att en saknad
// miljövariabel ger ett tydligt fel PÅ ANVÄNDNINGSSTÄLLET i stället för en krasch
// vid import.
//
// Konfigurationen (URL + publishable/anon-nyckel) kommer från miljövariablerna i
// `.env` (se den filen). Bara publika värden — service_role-nyckeln finns aldrig
// i klienten.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

/** True om båda miljövariablerna finns — låt UI:t visa ett vänligt fel i stället
 *  för att krascha om konfigurationen skulle saknas i en miljö. */
export function hasSupabaseConfig(): boolean {
  return Boolean(url && anonKey)
}

/** Hämta den delade Supabase-klienten (skapas första gången den behövs). Kastar
 *  ett tydligt fel om konfigurationen saknas. */
export function getSupabase(): SupabaseClient {
  if (client) return client
  if (!url || !anonKey) {
    throw new Error(
      'Supabase saknar konfiguration: VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY ' +
        'måste vara satta (.env lokalt; miljövariabler i Vercel för produktion).',
    )
  }
  client = createClient(url, anonKey, {
    auth: {
      // PKCE = säkrare kodbaserat flöde (koden byts mot en session i vår egen
      // callback). detectSessionInUrl AV med flit: appen använder HashRouter
      // (#-adresser), och Supabases automatiska URL-tolkning krockar med det —
      // vi läser koden ur adressen och byter den till session själva
      // (auth-callback i steg 5b). Session sparas och förnyas automatiskt.
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return client
}
