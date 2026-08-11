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
  /** Given är klar (spelad eller passad) → BOKFÖR resultatet + skicka in det.
   *  Anropas EN gång i samma stund given slutförs, oavsett vilken knapp spelaren
   *  sedan väljer — så framsteget aldrig tappas om man går till översikten i
   *  stället för "Nästa giv". `inskick` är råmaterialet servern validerar. */
  onResultat: (resultat: GivResultat, inskick: TavlingInskick) => void
  /** Gå vidare till nästa ospelade giv (eller översikten när serien är klar). */
  onNästa: () => void
  /** Lämna given utan att gå vidare → tillbaka till översikten. */
  onÖversikt: () => void
}
