// Beslut B etapp 2 (Led 3) — matchpoäng för dagliga tävlingen.
//
// Alla spelare spelar SAMMA 12 givar från N/S-stolarna (Syd är människan, Nord
// dess bot-partner). Tävlingsmåttet per giv är därför N/S-poängen: hur bra just
// den här spelaren gjorde given jämfört med alla andra som spelat den.
//
// Matchpoäng (klassisk parpoäng): för varje annan spelare på given ger en bättre
// N/S-poäng 1 poäng, lika 0,5. Toppen = (antal spelare − 1). Tävlingsresultatet
// är snittet i procent över de 12 givarna (docs/beslut-b-plan.md, 2b). Minst två
// spelare per giv krävs för poäng — det gränsvärdet vaktas av kallaren.
//
// Ren aritmetik utan I/O — servern räknar topplistan med den här funktionen, och
// facit testar den isolerat.

import type { Contract } from './play'
import type { Vulnerability } from '../../types/bridge'
import { duplicateScore, sideVulnerable } from './scoring'
import { side } from './play'

/** N/S-poängen för en spelad giv: `duplicateScore` är ur spelförarens perspektiv
 *  (positiv när spelföraren gick hem) → vänd tecknet när Ö/V var spelförare, så
 *  ett högre tal ALLTID är bättre för N/S-spelaren. En utpassad giv = 0. */
export function nsScore(
  contract: Contract,
  declarerTricks: number,
  vulnerability: Vulnerability,
): number {
  const vulnerable = sideVulnerable(contract.declarer, vulnerability)
  const declarerScore = duplicateScore(contract, declarerTricks, vulnerable)
  return side(contract.declarer) === 'NS' ? declarerScore : -declarerScore
}

/** En spelares N/S-poäng på en giv (identiteten är opak — vilket id som helst). */
export interface GivPoäng {
  spelare: string
  poäng: number
}

/** Matchpoängen för en spelare på en giv. */
export interface GivMatchpoäng {
  spelare: string
  /** Råa matchpoäng (0 … max, halvpoäng vid lika). */
  mp: number
  /** Toppen på given = antal spelare − 1. */
  max: number
  /** mp som andel av max (0–100). max = 0 (ensam spelare) ⇒ 100. */
  procent: number
}

/** Matchpoäng för alla spelare på EN giv. Jämför varje spelares N/S-poäng mot
 *  alla andras (index-baserat, så dubbletter av id inte stör). */
export function matchpointsForBoard(entries: GivPoäng[]): GivMatchpoäng[] {
  const max = Math.max(0, entries.length - 1)
  return entries.map((e, i) => {
    let mp = 0
    entries.forEach((o, j) => {
      if (i === j) return
      if (e.poäng > o.poäng) mp += 1
      else if (e.poäng === o.poäng) mp += 0.5
    })
    return { spelare: e.spelare, mp, max, procent: max === 0 ? 100 : (mp / max) * 100 }
  })
}
