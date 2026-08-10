// Appens "vem är inloggad"-minne (Beslut B etapp 1, steg 5a). En React-context
// som håller nuvarande session + profil och lyssnar på login/logout. Sidor och
// menyn frågar via useAuth() i stället för att prata med backend-lagret direkt.
//
// All faktisk kommunikation går via src/lib/backend/auth.ts — den här filen är
// bara React-limmet ovanpå.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  fetchProfile,
  getCurrentSession,
  onAuthChange,
  signOut as backendSignOut,
  type Profile,
} from '../lib/backend/auth'
import { hasSupabaseConfig } from '../lib/backend/supabase'

interface AuthValue {
  /** True medan den första sessionskontrollen pågår (undvik att blinka till
   *  "utloggad" innan vi vet). */
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  signedIn: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const loadProfile = useCallback(async (s: Session | null): Promise<void> => {
    if (!s) {
      setProfile(null)
      return
    }
    try {
      setProfile(await fetchProfile())
    } catch {
      // Nätfel/övergående: behåll appen igång, profilen fylls vid nästa försök.
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    // Utan konfiguration (ska inte hända i normalläge) — sluta ladda, förbli
    // utloggad, krascha inte appen.
    if (!hasSupabaseConfig()) {
      setLoading(false)
      return
    }

    let active = true

    getCurrentSession()
      .then(async (s) => {
        if (!active) return
        setSession(s)
        await loadProfile(s)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    const unsub = onAuthChange((s) => {
      if (!active) return
      setSession(s)
      // Deferra profil-hämtningen ETT varv: Supabase avråder från att anropa
      // andra supabase-funktioner direkt inuti auth-lyssnaren (kan låsa
      // klienten). setTimeout(0) släpper låset först.
      setTimeout(() => {
        if (active) void loadProfile(s)
      }, 0)
    })

    return () => {
      active = false
      unsub()
    }
  }, [loadProfile])

  const value: AuthValue = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    signedIn: session !== null,
    refreshProfile: () => loadProfile(session),
    // onAuthChange nollställer session/profil när utloggningen slår igenom.
    signOut: () => backendSignOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Tryggt utloggat standardvärde när ingen provider finns. I den riktiga appen
// ligger <AuthProvider> alltid runt allt (main.tsx); det enda fallet utan den är
// routing-tester som renderar <App/> direkt — där är "utloggad" precis rätt och
// ingenting ska kunna krascha.
const SIGNED_OUT: AuthValue = {
  loading: false,
  session: null,
  user: null,
  profile: null,
  signedIn: false,
  refreshProfile: async () => {},
  signOut: async () => {},
}

/** Läs inloggningsläget. Utanför <AuthProvider> ges ett utloggat standardvärde. */
export function useAuth(): AuthValue {
  return useContext(AuthContext) ?? SIGNED_OUT
}
