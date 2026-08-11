// Beslut B etapp 2 (klientfasen) — tävlingsläget som en liten delad typ.
//
// När spelskärmen (Play/BiddingPhase/PlayTable) körs som en tävlingsgiv bär den
// det HÄR objektet: given + play-fröet, var i serien man är, och två återanrop
// (en giv klar → gå vidare, eller lämna till översikten). Ligger i en egen
// modul så att både spelskärmen och "Dagens tävling"-sidan kan importera typen
// utan importcykel.

import type { GivResultat, TavlingInskick, TavlingsGiv } from '../../lib/backend/tavling'

export interface TavlingSpel {
  /** Given att spela + play-fröet (deterministiska bottar för valideringen). */
  giv: TavlingsGiv
  /** Tävlingens löpnummer (samma som daily_number på servern). */
  nummer: number
  /** Vilken giv i serien detta är (1..total). */
  board: number
  /** Antal givar i tävlingen (12 nu). */
  total: number
  /** Sista given i serien → "Se ställningen" i stället för "Nästa giv". */
  sista: boolean
  /** Given är klar (spelad eller passad) → registrera resultatet, skicka in det
   *  (inskick) och gå vidare. `inskick` är råmaterialet servern validerar. */
  onKlar: (resultat: GivResultat, inskick: TavlingInskick) => void
  /** Lämna given utan att slutföra → tillbaka till översikten. */
  onÖversikt: () => void
}
