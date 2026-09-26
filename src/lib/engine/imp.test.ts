// Facit för Dagens IMP (docs/imp-tavling-plan.md etapp 0): IMP-tabellen,
// cross-IMP per giv och IMP-formen i tävlingsaggregatet.

import { describe, test, expect } from 'vitest'
import { IMP_GRANSER, IMP_MAX, crossImpsForBoard, impFor } from './imp'
import {
  IMP_STRATEGI,
  MP_STRATEGI,
  PROVISORISK_IMP,
  aggregeraTopplista,
  provisoriskImpSumma,
  strategiFor,
  type Tävlingsrad,
} from './matchpoints'

describe('impFor — WBF:s IMP-tabell', () => {
  test('varje stegs undre och övre gräns (planens tabell)', () => {
    // [undre, övre, imp] rakt av planens tabell i docs/imp-tavling-plan.md.
    const tabell: Array<[number, number, number]> = [
      [0, 10, 0], [20, 40, 1], [50, 80, 2], [90, 120, 3], [130, 160, 4], [170, 210, 5],
      [220, 260, 6], [270, 310, 7], [320, 360, 8], [370, 420, 9], [430, 490, 10],
      [500, 590, 11], [600, 740, 12], [750, 890, 13], [900, 1090, 14], [1100, 1290, 15],
      [1300, 1490, 16], [1500, 1740, 17], [1750, 1990, 18], [2000, 2240, 19],
      [2250, 2490, 20], [2500, 2990, 21], [3000, 3490, 22], [3500, 3990, 23],
    ]
    for (const [undre, övre, imp] of tabell) {
      expect(impFor(undre), `${undre}`).toBe(imp)
      expect(impFor(övre), `${övre}`).toBe(imp)
    }
    expect(tabell.length).toBe(IMP_GRANSER.length)
  })

  test('4000 och uppåt = 24 (toppen)', () => {
    expect(IMP_MAX).toBe(24)
    expect(impFor(4000)).toBe(24)
    expect(impFor(7600)).toBe(24)
  })

  test('tecknet följer skillnaden; noll ger noll', () => {
    expect(impFor(0)).toBe(0)
    expect(impFor(450)).toBe(10)
    expect(impFor(-450)).toBe(-10)
    expect(impFor(-20)).toBe(-1)
  })
})

describe('crossImpsForBoard — cross-IMP på en giv', () => {
  test('planens exempel: +620 / +170 / −100 ger +11,0 / −1,5 / −9,5', () => {
    const res = crossImpsForBoard([
      { spelare: 'a', poäng: 620 },
      { spelare: 'b', poäng: 170 },
      { spelare: 'c', poäng: -100 },
    ])
    const byId = Object.fromEntries(res.map((r) => [r.spelare, r.imp]))
    // a: (+10 mot b, +12 mot c) / 2 · b: (−10, +7) / 2 · c: (−12, −7) / 2
    expect(byId.a).toBeCloseTo(11, 9)
    expect(byId.b).toBeCloseTo(-1.5, 9)
    expect(byId.c).toBeCloseTo(-9.5, 9)
  })

  test('summan över alla spelare på given är noll', () => {
    const res = crossImpsForBoard([
      { spelare: 'a', poäng: 1430 },
      { spelare: 'b', poäng: 680 },
      { spelare: 'c', poäng: -100 },
      { spelare: 'd', poäng: 650 },
      { spelare: 'e', poäng: -800 },
    ])
    expect(res.reduce((s, r) => s + r.imp, 0)).toBeCloseTo(0, 9)
  })

  test('två spelare: vinnaren +IMP enligt tabellen, förloraren spegelbilden', () => {
    const res = crossImpsForBoard([
      { spelare: 'a', poäng: 400 },
      { spelare: 'b', poäng: 50 },
    ])
    // Skillnad 350 → 8 IMP.
    expect(res.find((r) => r.spelare === 'a')?.imp).toBe(8)
    expect(res.find((r) => r.spelare === 'b')?.imp).toBe(-8)
  })

  test('lika poäng ger 0 mot varandra; ensam spelare får 0', () => {
    const lika = crossImpsForBoard([
      { spelare: 'a', poäng: 140 },
      { spelare: 'b', poäng: 140 },
    ])
    expect(lika.map((r) => r.imp)).toEqual([0, 0])
    expect(crossImpsForBoard([{ spelare: 'a', poäng: 620 }])).toEqual([{ spelare: 'a', imp: 0 }])
  })
})

describe('IMP-formen i aggregeraTopplista', () => {
  test('strategiFor: imp → IMP, allt annat → MP (bakåtkompatibelt)', () => {
    expect(strategiFor('imp')).toBe(IMP_STRATEGI)
    expect(strategiFor('mp')).toBe(MP_STRATEGI)
    expect(strategiFor(undefined)).toBe(MP_STRATEGI)
    expect(strategiFor(null)).toBe(MP_STRATEGI)
    expect(strategiFor('butler')).toBe(MP_STRATEGI)
  })

  test('ospelad giv räknas som 0 IMP (ägarbeslut 2026-09-26) och ställningen är SUMMAN', () => {
    expect(PROVISORISK_IMP).toBe(0)
    expect(provisoriskImpSumma(14.5, 7, 12)).toBe(14.5)
    expect(provisoriskImpSumma(-3, 12, 12)).toBe(-3)
    expect(provisoriskImpSumma(0, 0, 12)).toBe(0)
  })

  // Två spelare, två givar:
  //   giv 1: a=620, b=170 → skillnad 450 → a +10, b −10
  //   giv 2: a=100, b=420 → skillnad 320 → a −8, b +8
  // Summa: a +2, b −2 → a etta.
  const rader: Tävlingsrad[] = [
    { board: 1, spelare: 'a', poäng: 620 },
    { board: 1, spelare: 'b', poäng: 170 },
    { board: 2, spelare: 'a', poäng: 100 },
    { board: 2, spelare: 'b', poäng: 420 },
  ]

  test('summa per spelare, form i svaret, placering och IMP per giv', () => {
    const agg = aggregeraTopplista(rader, 2, 'a', 2, IMP_STRATEGI)
    expect(agg.form).toBe('imp')
    expect(agg.poängsattaGivar).toBe(2)
    const byId = Object.fromEntries(agg.topplista.map((p) => [p.spelare, p]))
    expect(byId.a.snitt).toBe(2)
    expect(byId.b.snitt).toBe(-2)
    expect(agg.topplista.map((p) => p.spelare)).toEqual(['a', 'b'])
    expect(agg.du).toEqual({ placering: 1, snitt: 2, antalGivar: 2, spelade: 2 })
    expect(agg.dinaGivar).toEqual([
      { board: 1, form: 'imp', tal: 10, imp: 10 },
      { board: 2, form: 'imp', tal: -8, imp: -8 },
    ])
  })

  test('halvspelad serie: bara de poängsatta givarna räknas, resten 0 — och giv med för få spelare ger inget', () => {
    const glest: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 }, // ensam → ingen poäng
      { board: 2, spelare: 'a', poäng: 100 },
      { board: 2, spelare: 'b', poäng: 420 },
    ]
    const agg = aggregeraTopplista(glest, 2, 'a', 12, IMP_STRATEGI)
    expect(agg.poängsattaGivar).toBe(1)
    expect(agg.du).toEqual({ placering: 2, snitt: -8, antalGivar: 1, spelade: 2 })
    expect(agg.dinaGivar).toEqual([{ board: 2, form: 'imp', tal: -8, imp: -8 }])
    // b står etta med +8 trots att a spelat fler givar.
    expect(agg.topplista[0]).toEqual({ spelare: 'b', snitt: 8, antalGivar: 1, spelade: 1 })
  })

  test('lika summa delar placeringen', () => {
    const lika: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 },
      { board: 1, spelare: 'b', poäng: 620 },
    ]
    expect(aggregeraTopplista(lika, 2, 'a', 1, IMP_STRATEGI).du?.placering).toBe(1)
    expect(aggregeraTopplista(lika, 2, 'b', 1, IMP_STRATEGI).du?.placering).toBe(1)
  })

  test('MP-formen är opåverkad: utan strategi = MP, samma tal som förr', () => {
    const mp = aggregeraTopplista(rader, 2, 'a', 2)
    expect(mp.form).toBe('mp')
    expect(mp.du?.snitt).toBe(50)
    expect(aggregeraTopplista(rader, 2, 'a', 2, MP_STRATEGI)).toEqual(mp)
  })
})
