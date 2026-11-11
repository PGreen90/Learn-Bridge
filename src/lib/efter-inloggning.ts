// Tillbaka till rätt sida efter inloggning (nästa nivå etapp 2, 2026-11-11).
//
// Förr hamnade alla på /konto efter inloggning — även den som tryckt "Logga in"
// inne i Dagens tävling eller på en bordsinbjudan, och sedan fick leta sig
// tillbaka själv. Nu bär länken till inloggningen med sig målet (`?till=…`),
// och vid nyregistrering sparas målet i webbläsaren så det överlever turen via
// bekräftelsemejlet.

import { useLocation } from 'react-router-dom'

const NYCKEL = 'rebidz:efter-inloggning'
/** Ett sparat mål gäller ett dygn — sedan är det inte längre "det jag höll på med". */
const GILTIG_MS = 24 * 60 * 60 * 1000
/** Hit skickas ingen tillbaka: man skulle bara studsa runt i inloggningen. */
const INLOGGNINGSSIDOR = ['/logga-in', '/registrera', '/glomt-losenord', '/nytt-losenord', '/auth']

/**
 * Är värdet en säker väg INOM appen? Bara vägar som börjar med ETT snedstreck
 * godtas — aldrig en hel adress ("https://…", "//annan.sajt") — så länken inte
 * kan missbrukas för att skicka någon vidare till en främmande sida.
 */
export function sakerVag(v: string | null | undefined): string | null {
  if (!v || v.length > 200) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\') || v.includes('://')) return null
  if (INLOGGNINGSSIDOR.some((s) => v === s || v.startsWith(s + '/') || v.startsWith(s + '?'))) return null
  return v
}

/** Länken till inloggningen/registreringen som minns var man kom ifrån. */
export function inloggLank(sida: '/logga-in' | '/registrera', till: string | null): string {
  const mal = sakerVag(till)
  return mal ? `${sida}?till=${encodeURIComponent(mal)}` : sida
}

/** Spara målet över mejlbekräftelsen (nyregistrering). */
export function kommIhagMal(till: string | null, nu = Date.now()): void {
  const mal = sakerVag(till)
  try {
    if (mal) localStorage.setItem(NYCKEL, JSON.stringify({ mal, nar: nu }))
  } catch {
    // Blockerad lagring — då hamnar man på kontosidan som förr.
  }
}

/** Hämta (och glöm) det sparade målet, om det är färskt och säkert. */
export function hamtaMal(nu = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(NYCKEL)
    if (!raw) return null
    localStorage.removeItem(NYCKEL)
    const { mal, nar } = JSON.parse(raw) as { mal?: unknown; nar?: unknown }
    if (typeof mal !== 'string' || typeof nar !== 'number' || nu - nar > GILTIG_MS) return null
    return sakerVag(mal)
  } catch {
    return null
  }
}

/** Vart ska man efter lyckad inloggning? `?till=` först, sedan det sparade
 *  målet, annars kontosidan. */
export function malEfterInloggning(tillParam: string | null): string {
  return sakerVag(tillParam) ?? hamtaMal() ?? '/konto'
}

/** För sidor med "konto krävs"-grind: länkar som leder tillbaka HIT efteråt. */
export function useTillbakaHit(): { loggaIn: string; registrera: string } {
  const { pathname, search } = useLocation()
  const hit = pathname + search
  return { loggaIn: inloggLank('/logga-in', hit), registrera: inloggLank('/registrera', hit) }
}
