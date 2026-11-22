// Startsidans tävlingsstatus (UI/UX-punkt 2, 2026-11-12): vad pillret på ett
// tävlingskort ska säga. Räknas ur det som redan ligger sparat på ENHETEN —
// inget nätverksanrop, så startsidan blir inte långsammare. Följden: har man
// spelat på en annan enhet visar kortet standardtexten tills man öppnat
// tävlingen här (då hämtas ställningen från servern som vanligt).

import { dailyNumber, guldNummer, stockholmDateISO, veckansMandag } from './engine/daily'
import type { TavlingsForm } from './engine/matchpoints'

export type TavlingsLage = 'ny' | 'pagar' | 'klar'
export interface TavlingsStatus {
  text: string
  lage: TavlingsLage
  /** Antal spelade givar i den pågående tävlingen (0–12) — driver mätaren. */
  antal: number
}

const STORLEK = 12

/** Numret på tävlingen som pågår just nu: dagens (MP%/IMP) eller veckans (guld). */
function aktuelltNummer(form: TavlingsForm, nu: Date): number {
  return form === 'guld' ? guldNummer(veckansMandag(stockholmDateISO(nu))) : dailyNumber(nu)
}

/** Serverns besked om en pågående tävling: dess nummer och hur många givar
 *  kontot har skickat in — oavsett enhet (ägarbeslut 2026-11-22). */
export interface ServerLage {
  nummer: number
  antal: number
}

/** `framsteg` är råvärdet ur lagringen — kan vara null, gammalt eller trasigt.
 *  `server` är serverns besked om samma tävling, om det hunnit komma. Det HÖGSTA
 *  antalet gäller: enheten kan ligga före (ett inskick på väg) och servern kan
 *  ligga före (spelat på en annan enhet). Båda måste höra till den tävling som
 *  pågår nu — annars räknas de inte. */
export function tavlingsStatus(
  form: TavlingsForm,
  framsteg: unknown,
  nu: Date = new Date(),
  server?: unknown,
): TavlingsStatus {
  const aktuellt = aktuelltNummer(form, nu)
  let antal = 0
  if (typeof framsteg === 'object' && framsteg !== null) {
    const f = framsteg as { nummer?: unknown; klara?: unknown }
    if (f.nummer === aktuellt && Array.isArray(f.klara)) antal = f.klara.length
  }
  if (typeof server === 'object' && server !== null) {
    const s = server as { nummer?: unknown; antal?: unknown }
    if (s.nummer === aktuellt && typeof s.antal === 'number' && Number.isFinite(s.antal)) {
      antal = Math.max(antal, Math.floor(s.antal))
    }
  }
  if (antal <= 0) return { text: form === 'guld' ? 'Öppen till söndag' : `${STORLEK} givar`, lage: 'ny', antal: 0 }
  if (antal >= STORLEK) return { text: 'Klar ✓', lage: 'klar', antal: STORLEK }
  return { text: `${antal} av ${STORLEK} spelade`, lage: 'pagar', antal }
}
