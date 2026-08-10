// Facit för Supabase-kopplingen (Beslut B etapp 1, steg 1). Bevisar att
// konfigurationen laddas ur .env och att klienten byggs korrekt — utan att göra
// några nätverksanrop (klienten skapas bara, inga auth-/db-anrop).

import { describe, it, expect } from 'vitest'
import { getSupabase, hasSupabaseConfig } from './supabase'

describe('Supabase-kopplingen', () => {
  it('läser konfigurationen ur miljövariablerna (.env)', () => {
    // .env i repot ger de publika värdena även i testkörningen (Vitest laddar
    // .env via Vite). Saknas de här är kopplingen felkonfigurerad.
    expect(hasSupabaseConfig()).toBe(true)
    expect(import.meta.env.VITE_SUPABASE_URL).toMatch(/^https:\/\/.+\.supabase\.co$/)
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeTruthy()
  })

  it('bygger en singleton-klient med auth-gränssnittet', () => {
    const a = getSupabase()
    const b = getSupabase()
    // Samma instans varje gång (singleton) och auth-delen finns att bygga vidare
    // på i steg 5 (inloggningen).
    expect(a).toBe(b)
    expect(a.auth).toBeDefined()
    expect(typeof a.auth.getSession).toBe('function')
  })
})
