// Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md) — IMP-tabellen
// och cross-IMP-räkningen för den andra dagliga tävlingen.
//
// IMP (International Match Points) översätter en POÄNGSKILLNAD mellan två
// resultat på samma giv till en planad skala (WBF:s tabell, samma som Svenska
// Bridgeförbundet). Cross-IMP (ägarbeslut 2026-09-26, framför Butler): varje
// spelares N/S-poäng jämförs med VARJE annan spelare på given, skillnaden
// översätts med tabellen (tecken efter vem som var bäst) och snittet av
// jämförelserna är spelarens IMP på given. Summan över alla spelare på en giv
// är därmed alltid noll — precis som i en lagmatch.
//
// Ren aritmetik utan I/O; facit: imp.test.ts. Aggregatet över en hel tävling
// (ställningen) bor i matchpoints.ts som en form-strategi.

import type { GivPoäng } from './matchpoints'

/** WBF:s IMP-tabell som ÖVRE gräns (inklusive) per IMP-steg: index = IMP.
 *  0–10 → 0, 20–40 → 1, 50–80 → 2 … 3500–3990 → 23, 4000+ → 24. Poängskillnader
 *  är alltid multiplar av 10, så "11–19" kan aldrig uppstå. */
export const IMP_GRANSER: readonly number[] = [
  10, 40, 80, 120, 160, 210, 260, 310, 360, 420, 490, 590, 740, 890, 1090, 1290, 1490, 1740, 1990,
  2240, 2490, 2990, 3490, 3990,
]

/** Högsta IMP-steget (allt över tabellens sista gräns). */
export const IMP_MAX = IMP_GRANSER.length

/** Poängskillnad → IMP med tecken: positiv skillnad ger plus-IMP, negativ ger
 *  minus-IMP, noll ger noll. */
export function impFor(diff: number): number {
  const abs = Math.abs(diff)
  const steg = IMP_GRANSER.findIndex((grans) => abs <= grans)
  const imp = steg === -1 ? IMP_MAX : steg
  return diff < 0 ? -imp : imp
}

/** En spelares cross-IMP på en giv. */
export interface GivCrossImp {
  spelare: string
  /** Snittet av IMP mot varje annan spelare på given (0 för en ensam spelare). */
  imp: number
}

/** Cross-IMP för alla spelare på EN giv. Jämför varje spelares N/S-poäng mot
 *  alla andras (index-baserat, så dubbletter av id inte stör). Summan över
 *  alla spelare är noll (upp till flyttalsbrus). */
export function crossImpsForBoard(entries: GivPoäng[]): GivCrossImp[] {
  const andra = entries.length - 1
  return entries.map((e, i) => {
    if (andra <= 0) return { spelare: e.spelare, imp: 0 }
    let summa = 0
    entries.forEach((o, j) => {
      if (i !== j) summa += impFor(e.poäng - o.poäng)
    })
    return { spelare: e.spelare, imp: summa / andra }
  })
}
