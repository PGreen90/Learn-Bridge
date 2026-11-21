// Övningsomspelets fiktiva jämförelse (ägarönskemål 2026-11-21).
//
// En tävlingsgiv som spelas om i övningsläge räknas ALDRIG i tävlingen — men
// spelaren vill få en känsla för hur mycket bättre eller sämre omspelet var.
// Därför ställs övningsresultatet FIKTIVT mot fältets riktiga resultat på
// given, i tävlingsformens eget räknesätt (MP% · cross-IMP · stjärntävlingen
// = MP), och jämförs med spelarens riktiga tal.
//
// Ägarbeslut 2026-11-21:
//   · Övningen ERSÄTTER spelarens egen rad i fältet ("om du hade spelat så här
//     från början") — det gamla jaget är ingen motståndare.
//   · Det riktiga talet är SERVERNS tal på raden (samma siffra som står i
//     resultatlistan), aldrig en omräkning.
//   · Siffran är smickrande (man har sett alla händer) — det är avsett; den
//     märks "fiktivt" i gränssnittet.
//
// Ren aritmetik utan I/O; facit: ovningsjamforelse.test.ts.

import type { Seat, Vulnerability } from '../../types/bridge'
import type { Strain } from './play'
import { nsScore, strategiFor, type TavlingsForm } from './matchpoints'

/** En rad ur fältets resultat på given — det jämförelsen behöver. */
export interface FaltRad {
  /** Spelarens egen riktiga rad. */
  jag: boolean
  nsScore: number
  /** Radens tal i tävlingsformen (MP% / cross-IMP). Saknas = inte poängsatt. */
  tal?: number
}

export interface OvningsJamforelse {
  /** Övningsresultatets fiktiva tal mot fältet (MP% eller cross-IMP). */
  ovning: number
  /** Spelarens riktiga tal på given, eller null (spelade inte / inte poängsatt). */
  tavling: number | null
  /** ovning − tavling, eller null när det riktiga talet saknas. */
  diff: number | null
  /** Antal andra spelare övningen ställdes mot. */
  andra: number
}

/** Ställ övningens N/S-poäng mot fältet i formens räknesätt. `null` när ingen
 *  annan spelat given (inget att jämföra med). */
export function fiktivJamforelse(
  falt: FaltRad[],
  ovningNs: number,
  form: TavlingsForm | undefined,
): OvningsJamforelse | null {
  const andra = falt.filter((r) => !r.jag)
  if (andra.length === 0) return null
  const OVNING = 'övning'
  const utfall = strategiFor(form).perGiv([
    ...andra.map((r, i) => ({ spelare: `andra-${i}`, poäng: r.nsScore })),
    { spelare: OVNING, poäng: ovningNs },
  ])
  const ovning = utfall.find((u) => u.spelare === OVNING)!.tal
  const egen = falt.find((r) => r.jag)
  const tavling = egen?.tal ?? null
  return { ovning, tavling, diff: tavling === null ? null : ovning - tavling, andra: andra.length }
}

/** N/S-poängen ur ett kompakt kontrakt + resultat (GivKontrakt-formen: nivå,
 *  benämning, dubbling, spelförare, över-/understick). `null` = utpassad = 0. */
export function nsScoreUrKontrakt(
  k: { level: number; strain: Strain; doubled?: 'X' | 'XX'; declarer: Seat; diff: number } | null,
  vulnerability: Vulnerability,
): number {
  if (!k) return 0
  return nsScore(
    { level: k.level, strain: k.strain, doubled: k.doubled, declarer: k.declarer },
    k.level + 6 + k.diff,
    vulnerability,
  )
}
