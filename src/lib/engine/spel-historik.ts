// Resultathistoriken för frispelet (granskningsputsen 2026-08-03, fynd #4:
// "fritt spel sparar ingenting alls"). Varje färdigspelad fri giv bokförs med
// sitt frö — och eftersom fröet återskapar given exakt (Etapp B) blir varje
// rad i historiken spelbar igen via #/spela-kort?giv=frö.
//
// Ren logik utan I/O, som daily.ts: localStorage-nyckeln (`spel-historik` via
// lib/storage) läses/skrivs av UI:t.

import type { Seat } from '../../types/bridge'

/** En färdigspelad fri giv. Rubriken/poängen sparas som färdig text — det är
 *  ett historiskt kvitto, inte något som ska räknas om i efterhand. */
export interface SpelResultat {
  /** Slumpfröet som återskapar given (#/spela-kort?giv=frö). */
  seed: number
  /** När resultatet bokfördes (Date.now). */
  when: number
  /** Kontraktet som BidChip-kod: "4S", "3NT" … */
  bid: string
  /** Dubblat/redubblat — tom sträng när odubblat. */
  doubled: '' | 'X' | 'XX'
  declarer: Seat
  /** Stick till DIN sida (N/S), oavsett vem som var spelförare. */
  myTricks: number
  /** Vann din sida given? (resultHeadline ur ditt perspektiv, Etapp C.) */
  win: boolean
  /** Resultatrubriken, t.ex. "Hemgång! +1" eller "Ni satte kontraktet! 1 bet". */
  headline: string
  /** Poängraden ("NS +450" …) — null när ingen poäng fanns. */
  scoreLabel: string | null
}

/** Taket: historiken är de senaste givarna, inte ett evigt arkiv. */
export const HISTORIK_CAP = 50

/** Lägg ett nytt resultat FÖRST (nyast överst) och kapa vid taket. */
export function addResult(list: SpelResultat[], entry: SpelResultat): SpelResultat[] {
  return [entry, ...list].slice(0, HISTORIK_CAP)
}

/** Strukturkontroll av en inläst historik (samma tanke som validSavedGame:
 *  giltig JSON med fel form ska inte ge en kraschande sida). */
export function validHistorik(x: unknown): x is SpelResultat[] {
  if (!Array.isArray(x)) return false
  return x.every((e) => {
    if (typeof e !== 'object' || e === null) return false
    const r = e as Record<string, unknown>
    return (
      typeof r.seed === 'number' &&
      typeof r.when === 'number' &&
      typeof r.bid === 'string' &&
      typeof r.myTricks === 'number' &&
      typeof r.win === 'boolean' &&
      typeof r.headline === 'string'
    )
  })
}
