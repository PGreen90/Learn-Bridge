// MONTE-CARLOS SNABBA LÖSARE (lösarbytet 2026-11-15). Laddar bridge-dds
// (Bo Haglunds lösare som WebAssembly — samma som budtänkandet och bordets
// claim redan använder) och registrerar den i röstningen (monte-carlo.ts):
// alla korts värde i ett anrop per utdelat läge, millisekunder i stället för
// sekunder vid 7–8 kort.
//
// VARJE körväg som väljer botkort i drift anropar `laddaSnabbLosare()` EN gång
// innan första kortvalet — telefonens bakgrundsräknare (mc-worker.ts), bordets
// server (api-src/bord.ts), datorspelarnas nattspel, nattgranskningen och dess
// omprov. Alla måste räkna med samma lösare: nattgranskningen jämför varje
// botkort mot motorns eget val.
//
// Egen fil (inte i monte-carlo.ts) så WASM-paketet bara hamnar i de buntar som
// faktiskt laddar lösaren — play-bot/monte-carlo importeras även av huvudtråden.

import { anvandSnabbLosare } from './monte-carlo'
import { getDds, solveAllCards } from './revisor-dds'

let laddning: Promise<boolean> | null = null

/** Ladda och registrera den snabba lösaren (engångskostnad, delas av alla
 *  anrop). false = lösaren gick inte att ladda; röstningen räknar då med
 *  TS-lösaren som förr — långsammare, men spelet står aldrig still. */
export function laddaSnabbLosare(): Promise<boolean> {
  laddning ??= getDds().then(
    (dds) => {
      anvandSnabbLosare((state) => solveAllCards(dds, state, true))
      return true
    },
    () => false,
  )
  return laddning
}
