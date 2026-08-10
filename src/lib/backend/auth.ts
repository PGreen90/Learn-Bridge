// Inloggningsfunktionerna (Beslut B etapp 1, steg 5a). ALLT som rör konton går
// genom det HÄR lagret — sidorna anropar aldrig supabase.auth direkt. Bygger på
// klienten i supabase.ts och namnregeln i display-name.ts.
//
// E-postbekräftelse är PÅ i Supabase, så en färsk registrering ger ingen session
// förrän användaren klickat länken i mejlet. Felmeddelanden översätts till enkel
// svenska (translateAuthError) så användaren aldrig möter Supabases engelska.

import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import { validateDisplayName } from './display-name'

/** En rad ur profiles-tabellen (0001_profiles.sql). Mejladressen finns INTE här
 *  — den bor i auth-kontot och visas aldrig för andra. */
export interface Profile {
  id: string
  display_name: string
  is_13_plus: boolean
  created_at: string
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  is13Plus: boolean
}

/** Adressen inloggningslänkar i mejl pekar tillbaka till. `flow` skiljer på
 *  registreringsbekräftelse och lösenordsåterställning så callbacken vet vad den
 *  ska göra. Landar på roten (`/`) med koden i frågesträngen — vår bootstrap
 *  fångar den innan HashRouter tar över (steg 5b). */
function authRedirectUrl(flow: 'signup' | 'reset'): string {
  return `${window.location.origin}/?flow=${flow}`
}

/** Registrera nytt konto. Returnerar om användaren måste bekräfta e-posten först
 *  (med bekräftelse på = alltid true tills länken klickats). */
export async function signUp(input: SignUpInput): Promise<{ needsEmailConfirm: boolean }> {
  const check = validateDisplayName(input.displayName)
  if (!check.ok) throw new Error(check.message)
  if (!input.is13Plus) throw new Error('Du måste bekräfta att du är minst 13 år.')

  const { data, error } = await getSupabase().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      // Läses av triggern handle_new_user (0001) som skapar profilraden.
      data: { display_name: input.displayName.trim(), is_13_plus: true },
      emailRedirectTo: authRedirectUrl('signup'),
    },
  })
  if (error) throw new Error(translateAuthError(error.message))
  return { needsEmailConfirm: data.session === null }
}

/** Logga in med e-post + lösenord. */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(translateAuthError(error.message))
}

/** Logga ut. */
export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw new Error(translateAuthError(error.message))
}

/** Skicka återställningsmejl ("glömt lösenord"). Länken landar i callbacken där
 *  användaren får sätta ett nytt lösenord. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authRedirectUrl('reset'),
  })
  if (error) throw new Error(translateAuthError(error.message))
}

/** Sätt ett nytt lösenord (efter återställningslänk, medan sessionen är aktiv). */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword })
  if (error) throw new Error(translateAuthError(error.message))
}

/** Byt en inloggningskod (från callback-adressen) mot en riktig session.
 *  OBS: PKCE-koden kräver att koden byts i SAMMA webbläsare som startade flödet
 *  (kod-verifieraren ligger lokalt). För länkar som kan öppnas på annan enhet
 *  används verifyEmailOtp i stället. */
export async function exchangeCodeForSession(code: string): Promise<void> {
  const { error } = await getSupabase().auth.exchangeCodeForSession(code)
  if (error) throw new Error(translateAuthError(error.message))
}

/** Verifiera en engångskod ur ett mejl (token_hash + typ). Fungerar ÖVER enheter
 *  (ingen lokal verifierare krävs) — den robusta vägen för bekräftelse- och
 *  återställningslänkar. */
export async function verifyEmailOtp(tokenHash: string, type: EmailOtpType): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) throw new Error(translateAuthError(error.message))
}

/** Nuvarande session (eller null om utloggad). */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession()
  return data.session
}

/** Prenumerera på inloggningsändringar (login/logout/token-förnyelse). Returnerar
 *  en avprenumereringsfunktion. */
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}

/** Hämta den inloggades egen profil (radskyddet ser till att det bara går att
 *  läsa sin egen rad). null om ingen profil finns än. */
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, is_13_plus, created_at')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Profile | null) ?? null
}

/** Översätt Supabases (engelska) auth-fel till enkel svenska. Okända fel går
 *  igenom oöversatta så inget döljs. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Fel e-post eller lösenord.'
  if (m.includes('email not confirmed')) return 'Bekräfta din e-post först — kolla mejlen (även skräpposten).'
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Det finns redan ett konto med den e-postadressen.'
  }
  if (m.includes('password should be at least')) return 'Lösenordet måste vara minst 8 tecken.'
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many')) {
    return 'För många försök — vänta en liten stund och prova igen.'
  }
  if (m.includes('database error saving new user')) {
    return 'Kunde inte skapa kontot — visningsnamnet kan vara upptaget. Prova ett annat namn.'
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Ogiltig e-postadress.'
  }
  return message
}
