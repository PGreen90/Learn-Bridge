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
}

const STORLEK = 12

/** Numret på tävlingen som pågår just nu: dagens (MP%/IMP) eller veckans (guld). */
function aktuelltNummer(form: TavlingsForm, nu: Date): number {
  return form === 'guld' ? guldNummer(veckansMandag(stockholmDateISO(nu))) : dailyNumber(nu)
}

/** `framsteg` är råvärdet ur lagringen — kan vara null, gammalt eller trasigt. */
export function tavlingsStatus(form: TavlingsForm, framsteg: unknown, nu: Date = new Date()): TavlingsStatus {
  const ny: TavlingsStatus = { text: form === 'guld' ? 'Öppen till söndag' : `${STORLEK} givar`, lage: 'ny' }
  if (typeof framsteg !== 'object' || framsteg === null) return ny
  const f = framsteg as { nummer?: unknown; klara?: unknown }
  if (f.nummer !== aktuelltNummer(form, nu) || !Array.isArray(f.klara)) return ny
  const antal = f.klara.length
  if (antal === 0) return ny
  if (antal >= STORLEK) return { text: 'Klar ✓', lage: 'klar' }
  return { text: `${antal} av ${STORLEK} spelade`, lage: 'pagar' }
}
