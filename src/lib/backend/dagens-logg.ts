// Beslut B etapp 3 — klientsynk av Dagens giv-loggen mot kontot.
//
// Loggen (kalenderarkivet + 🔥-sviten) bor lokalt i `daily-log` precis som
// förr — servern är SPEGELN som gör den cross-device för inloggade. Reglerna:
//  · "Första resultatet står" gäller på båda sidor (servern skriver med
//    ignore-duplicates; vid krock visar klienten serverns rad — den var först
//    någonstans).
//  · Utloggade märker ingenting: allt är fire-and-forget och felöppet — en
//    misslyckad synk lämnar den lokala loggen orörd.

import type { DailyLog } from '../engine/daily'
import { loadDailyLog, saveDailyLog } from './index'
import { getCurrentSession } from './auth'

interface LoggRad {
  nummer: number
  myTricks: number
  late?: boolean
}

/** Ren sammanslagning: servern vinner vid krock (den raden var först
 *  någonstans); lokala rader som saknas på servern rapporteras för uppskick. */
export function slaIhopDagensLogg(
  lokal: DailyLog,
  server: LoggRad[],
): { sammanslagen: DailyLog; saknasPaServern: LoggRad[] } {
  const sammanslagen: DailyLog = { ...lokal }
  const paServern = new Set<number>()
  for (const rad of server) {
    paServern.add(rad.nummer)
    sammanslagen[rad.nummer] = rad.late ? { myTricks: rad.myTricks, late: true } : { myTricks: rad.myTricks }
  }
  const saknasPaServern: LoggRad[] = Object.entries(lokal)
    .filter(([nummer]) => !paServern.has(Number(nummer)))
    .map(([nummer, post]) => ({
      nummer: Number(nummer),
      myTricks: post.myTricks,
      ...(post.late ? { late: true } : {}),
    }))
  return { sammanslagen, saknasPaServern }
}

async function medToken(): Promise<string | null> {
  const session = await getCurrentSession()
  return session?.access_token ?? null
}

/** Bokför rader på kontot (fire-and-forget — felöppen). */
export async function bokforDagensLogg(rader: LoggRad[]): Promise<void> {
  if (!rader.length) return
  const token = await medToken()
  if (!token) return
  try {
    await fetch('/api/dagens-logg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rader }),
    })
  } catch {
    // Nästa synk tar det.
  }
}

/** Full synk: hämta kontots logg, slå ihop med den lokala, spara lokalt och
 *  skicka upp det som saknas på servern. Returnerar den sammanslagna loggen
 *  (eller den lokala om synken inte gick). */
export async function synkaDagensLogg(): Promise<DailyLog> {
  const lokal = loadDailyLog()
  const token = await medToken()
  if (!token) return lokal
  try {
    const r = await fetch('/api/dagens-logg', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return lokal
    const data = (await r.json()) as { ok?: boolean; logg?: LoggRad[] }
    if (data.ok !== true || !Array.isArray(data.logg)) return lokal
    const { sammanslagen, saknasPaServern } = slaIhopDagensLogg(lokal, data.logg)
    saveDailyLog(sammanslagen)
    void bokforDagensLogg(saknasPaServern)
    return sammanslagen
  } catch {
    return lokal
  }
}
