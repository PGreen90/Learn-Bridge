// Beslut B etapp 2 (klientfasen) — tävlingsläget som en liten delad typ.
//
// När spelskärmen (Play/BiddingPhase/PlayTable) körs som en tävlingsgiv bär den
// det HÄR objektet: given + play-fröet, var i serien man är, och två återanrop
// (en giv klar → gå vidare, eller lämna till översikten). Ligger i en egen
// modul så att både spelskärmen och "Dagens tävling"-sidan kan importera typen
// utan importcykel.

import { formTitel, type GivResultat, type TavlingInskick, type TavlingsForm, type TavlingsGiv } from '../../lib/backend/tavling'

export interface TavlingSpel {
  /** Given att spela + play-fröet (deterministiska bottar för valideringen). */
  giv: TavlingsGiv
  /** Tävlingens löpnummer (samma som daily_number på servern). */
  nummer: number
  /** Tävlingsformen (Dagens IMP, 2026-09-26): 'imp' = IMP-tävlingen. Saknas =
   *  MP. Styr etiketten i spelskärmen; inskicket får formen av kallaren. */
  form?: TavlingsForm
  /** Vilken giv i serien detta är (1..total). */
  board: number
  /** Antal givar i tävlingen (12 nu). */
  total: number
  /** Sista given i serien → "Se ställningen" i stället för "Nästa giv". */
  sista: boolean
  /** ÖVNINGSLÄGE (2026-08-12): given spelas om från giv-detaljvyn bara för att
   *  öva. KORREKTHETSKRAV: `onResultat` måste vara en no-op (inget skickas in,
   *  framsteget rörs inte) → din riktiga MP% står kvar överallt. Sätter också
   *  om resultatskärmen ("Spela igen"/"Tillbaka" i stället för "Nästa giv") och
   *  märkningen "Övning — räknas inte". Odefinierat/false = riktig tävlingsgiv. */
  övning?: boolean
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

/**
 * Spelas given UTAN hjälpmedel? Veckans guld-tävling (ägarbeslut 2026-11-11)
 * spelas som vid ett riktigt bord: inga budrekommendationer, inget reglage för
 * budstöd och ingen Facit-knapp. Det enda som finns kvar är vad buden BETYDER
 * när man trycker på dem — det vet man vid bordet också (systemet är känt).
 * Övningsomspel av en redan spelad giv har hjälpen kvar.
 */
export function utanHjalpmedel(tavling: TavlingSpel | undefined): boolean {
  return tavling?.form === 'guld' && !tavling.övning
}

/** Var i appen en rapport från spelskärmen skrevs — följer med i felrapporten
 *  så /felrapporter vet om given kom från fritt spel eller en tävling. */
export function rapportLage(tavling: TavlingSpel | undefined): string {
  if (!tavling) return 'Spela kort'
  const namn = formTitel(tavling.form)
  return `${namn} nr ${tavling.nummer}, giv ${tavling.board}${tavling.övning ? ' (övning)' : ''}`
}
