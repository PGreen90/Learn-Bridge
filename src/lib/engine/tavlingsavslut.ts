// Tävlingsavslutet (Påbyggnad 3, ägarbeslut 2026-09-13): den SLUTLIGA
// ställningen för en tävlingsdag och medaljtabellen över alla dagar.
//
// Ställningen räknas med samma aggregat som den levande topplistan
// (aggregeraTopplista: matchpoäng per giv, tillsvidare-snitt mot storleken,
// delad rang) — så den siffra som frystes efter midnatt är exakt den man såg
// under dagen. Nattjobbet (tavlingsavslut.probe.test.ts) skriver raderna till
// `daily_standings`; historik-endpointen räknar medaljerna härifrån.
//
// Medaljer: placering 1/2/3 = guld/silver/brons. Delad rang kan ge två guld
// samma dag (avsett). Bottarna (profiles.is_bot) står kvar i dagens ställning
// men UTESLUTS ur medaljtabellen — deras placeringar räknas som de var, så en
// människa på andra plats bakom en bot får silver, inte guld.
//
// Ren aritmetik utan I/O — facit: tavlingsavslut.test.ts.

import { aggregeraTopplista, type Tävlingsrad } from './matchpoints'

/** Minst så många spelare på en giv för att den ska ge poäng (delas av den
 *  levande topplistan och slutställningen — EN sanning). */
export const MIN_PER_GIV = 2

/** En spelares slutliga rad för en dag (id opakt — servern översätter). */
export interface StällningsRad {
  spelare: string
  placering: number
  snitt: number
  antalGivar: number
  spelade: number
}

/** Slutställningen för EN dag ur dagens godkända rader: sorterad bäst först,
 *  placering = 1 + antalet med STRIKT högre snitt (delad rang). */
export function byggStallning(rader: Tävlingsrad[], minPerGiv: number, storlek: number): StällningsRad[] {
  const { topplista } = aggregeraTopplista(rader, minPerGiv, null, storlek)
  return topplista.map((p) => ({
    spelare: p.spelare,
    placering: 1 + topplista.filter((o) => o.snitt > p.snitt).length,
    snitt: p.snitt,
    antalGivar: p.antalGivar,
    spelade: p.spelade,
  }))
}

export interface Medaljrad {
  spelare: string
  guld: number
  silver: number
  brons: number
}

/** Minst så många spelare i en dags ställning för att dagen ska dela ut
 *  medaljer (ägarbeslut 2026-09-13): en ensam spelare vinner ingenting.
 *  Bottarna räknas som spelare här — de var med i ställningen. */
export const MIN_SPELARE_FOR_MEDALJ = 2

/** Medaljtabellen ur alla dagars placeringar (`set` = dagen): räkna 1/2/3 per
 *  spelare — bara för dagar med minst `minSpelare` i ställningen — uteslut
 *  `uteslut` (bottarna), sortera guld → silver → brons (fallande, sedan namn
 *  för stabil ordning) och skär till `topp`. Bara spelare med minst en medalj. */
export function raknaMedaljer(
  placeringar: Array<{ set: string; spelare: string; placering: number }>,
  uteslut: Set<string>,
  topp = 5,
  minSpelare = MIN_SPELARE_FOR_MEDALJ,
): Medaljrad[] {
  const perDag = new Map<string, number>()
  for (const { set } of placeringar) perDag.set(set, (perDag.get(set) ?? 0) + 1)
  const per = new Map<string, Medaljrad>()
  for (const { set, spelare, placering } of placeringar) {
    if ((perDag.get(set) ?? 0) < minSpelare) continue
    if (uteslut.has(spelare) || placering < 1 || placering > 3) continue
    const rad = per.get(spelare) ?? { spelare, guld: 0, silver: 0, brons: 0 }
    if (placering === 1) rad.guld++
    else if (placering === 2) rad.silver++
    else rad.brons++
    per.set(spelare, rad)
  }
  return [...per.values()]
    .sort(
      (a, b) =>
        b.guld - a.guld || b.silver - a.silver || b.brons - a.brons || a.spelare.localeCompare(b.spelare),
    )
    .slice(0, topp)
}
