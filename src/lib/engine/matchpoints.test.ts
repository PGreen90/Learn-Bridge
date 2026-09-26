// Facit för matchpoängen (Beslut B etapp 2, Led 3).

import { describe, test, expect } from 'vitest'
import {
  aggregeraTopplista,
  matchpointsForBoard,
  nsScore,
  provisorisktSnitt,
  PROVISORISK_PROCENT,
  type GivPoäng,
  type Tävlingsrad,
} from './matchpoints'
import type { Contract } from './play'

describe('matchpointsForBoard', () => {
  test('rangordning: bäst N/S-poäng får toppen, sämst noll', () => {
    const entries: GivPoäng[] = [
      { spelare: 'a', poäng: 620 },
      { spelare: 'b', poäng: 170 },
      { spelare: 'c', poäng: -100 },
    ]
    const mp = matchpointsForBoard(entries)
    const byId = Object.fromEntries(mp.map((m) => [m.spelare, m]))
    expect(byId.a.mp).toBe(2) // slår b och c
    expect(byId.b.mp).toBe(1) // slår c
    expect(byId.c.mp).toBe(0) // slår ingen
    expect(byId.a.max).toBe(2)
    expect(byId.a.procent).toBe(100)
    expect(byId.c.procent).toBe(0)
  })

  test('lika poäng delar (halvpoäng åt båda)', () => {
    const mp = matchpointsForBoard([
      { spelare: 'a', poäng: 140 },
      { spelare: 'b', poäng: 140 },
      { spelare: 'c', poäng: -50 },
    ])
    const byId = Object.fromEntries(mp.map((m) => [m.spelare, m]))
    // a och b slår c (1) + delar med varandra (0,5) = 1,5; c får 0.
    expect(byId.a.mp).toBe(1.5)
    expect(byId.b.mp).toBe(1.5)
    expect(byId.c.mp).toBe(0)
    expect(byId.a.procent).toBe(75)
  })

  test('två spelare: vinnaren 100 %, förloraren 0 %', () => {
    const mp = matchpointsForBoard([
      { spelare: 'a', poäng: 400 },
      { spelare: 'b', poäng: 50 },
    ])
    expect(mp.find((m) => m.spelare === 'a')?.procent).toBe(100)
    expect(mp.find((m) => m.spelare === 'b')?.procent).toBe(0)
  })

  test('ensam spelare: max 0, ingen division med noll', () => {
    const mp = matchpointsForBoard([{ spelare: 'a', poäng: 620 }])
    expect(mp[0].max).toBe(0)
    expect(mp[0].procent).toBe(100)
  })
})

describe('aggregeraTopplista', () => {
  // Två spelare, två poängsatta givar:
  //   giv 1: a=620 slår b=170 → a 100 %, b 0 %
  //   giv 2: a=100, b=420    → a 0 %,   b 100 %
  // Snitt: båda 50 %, delad förstaplats.
  const rader: Tävlingsrad[] = [
    { board: 1, spelare: 'a', poäng: 620 },
    { board: 1, spelare: 'b', poäng: 170 },
    { board: 2, spelare: 'a', poäng: 100 },
    { board: 2, spelare: 'b', poäng: 420 },
  ]

  test('snitt per spelare + antal poängsatta givar', () => {
    const agg = aggregeraTopplista(rader, 2, null, 2)
    expect(agg.poängsattaGivar).toBe(2)
    const byId = Object.fromEntries(agg.topplista.map((p) => [p.spelare, p]))
    expect(byId.a.snitt).toBe(50)
    expect(byId.b.snitt).toBe(50)
    expect(byId.a.antalGivar).toBe(2)
    expect(byId.a.spelade).toBe(2)
  })

  test('utan kallare: du = null, dinaGivar tom', () => {
    const agg = aggregeraTopplista(rader, 2, null, 2)
    expect(agg.du).toBeNull()
    expect(agg.dinaGivar).toEqual([])
  })

  test('kallare får placering (delad vid lika snitt), snitt och MP per giv', () => {
    const agg = aggregeraTopplista(rader, 2, 'a', 2)
    expect(agg.du).toEqual({ placering: 1, snitt: 50, antalGivar: 2, spelade: 2 })
    // Per giv, i brickordning: giv 1 topp (100 %), giv 2 botten (0 %).
    expect(agg.dinaGivar).toEqual([
      { board: 1, form: 'mp', tal: 100, mp: 1, max: 1, procent: 100 },
      { board: 2, form: 'mp', tal: 0, mp: 0, max: 1, procent: 0 },
    ])
  })

  test('placering: den med högre snitt hamnar etta, den andre tvåa', () => {
    // Ge a övertaget på giv 2 också (a=500 > b=420) → a 100 % båda, b 0 % båda.
    const vassare: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 },
      { board: 1, spelare: 'b', poäng: 170 },
      { board: 2, spelare: 'a', poäng: 500 },
      { board: 2, spelare: 'b', poäng: 420 },
    ]
    expect(aggregeraTopplista(vassare, 2, 'a', 2).du?.placering).toBe(1)
    expect(aggregeraTopplista(vassare, 2, 'b', 2).du?.placering).toBe(2)
    expect(aggregeraTopplista(vassare, 2, 'a', 2).du?.snitt).toBe(100)
  })

  test('giv med för få spelare ger inga poäng — men räknas som spelad och som 40 % i snittet', () => {
    const glest: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 }, // ensam → ingen poäng
      { board: 2, spelare: 'a', poäng: 100 },
      { board: 2, spelare: 'b', poäng: 420 },
    ]
    const agg = aggregeraTopplista(glest, 2, 'a', 2)
    expect(agg.poängsattaGivar).toBe(1)
    // a har SPELAT två givar men bara giv 2 är poängsatt (0 %); giv 1 räknas som
    // 40 tills fler spelat den: (0 + 40) / 2 = 20. b: (100 + 40) / 2 = 70 → a tvåa.
    expect(agg.du).toEqual({ placering: 2, snitt: 20, antalGivar: 1, spelade: 2 })
    expect(agg.dinaGivar).toEqual([{ board: 2, form: 'mp', tal: 0, mp: 0, max: 1, procent: 0 }])
  })

  test('kallare utan någon poängsatt giv: står på listan med 40 % (tillsvidare)', () => {
    const glest: Tävlingsrad[] = [
      { board: 1, spelare: 'ensam', poäng: 620 }, // bara kallaren spelat giv 1
    ]
    const agg = aggregeraTopplista(glest, 2, 'ensam', 12)
    expect(agg.du).toEqual({ placering: 1, snitt: 40, antalGivar: 0, spelade: 1 })
    expect(agg.topplista).toEqual([{ spelare: 'ensam', snitt: 40, antalGivar: 0, spelade: 1 }])
    expect(agg.dinaGivar).toEqual([])
  })

  test('tillsvidare-procenten (ägarbeslut 2026-09-13): 7 av 12 spelade → ospelade räknas som 40', () => {
    // a vinner alla sju spelade givar mot b: a 100 % × 7, b 0 % × 7.
    const sju: Tävlingsrad[] = []
    for (let board = 1; board <= 7; board++) {
      sju.push({ board, spelare: 'a', poäng: 620 }, { board, spelare: 'b', poäng: 170 })
    }
    const agg = aggregeraTopplista(sju, 2, 'a', 12)
    // (700 + 40 × 5) / 12 = 75 för a; (0 + 200) / 12 ≈ 16,7 för b.
    expect(agg.du).toEqual({ placering: 1, snitt: 75, antalGivar: 7, spelade: 7 })
    const b = agg.topplista.find((p) => p.spelare === 'b')!
    expect(b.snitt).toBeCloseTo(200 / 12, 6)
    expect(b.spelade).toBe(7)
    // Listan är sorterad på tillsvidare-snittet.
    expect(agg.topplista.map((p) => p.spelare)).toEqual(['a', 'b'])
  })

  test('alla givar spelade → tillsvidare-snittet är exakt det gamla snittet', () => {
    // rader = 2 givar, storlek 2: (100 + 0) / 2 = 50 som förr.
    expect(aggregeraTopplista(rader, 2, 'a', 2).du?.snitt).toBe(50)
  })

  test('ordningen kan skifta av tillsvidare-regeln: färre spelade + höga % slår inte fler spelade', () => {
    // c spelade EN giv på 100 %, d spelade två på 60 % snitt (100 + 20).
    const rader2: Tävlingsrad[] = [
      { board: 1, spelare: 'c', poäng: 620 },
      { board: 1, spelare: 'd', poäng: 170 },
      { board: 1, spelare: 'e', poäng: 100 },
      { board: 2, spelare: 'd', poäng: 620 },
      { board: 2, spelare: 'e', poäng: 100 },
      { board: 3, spelare: 'd', poäng: 620 },
      { board: 3, spelare: 'e', poäng: 100 },
    ]
    const agg = aggregeraTopplista(rader2, 2, null, 3)
    const byId = Object.fromEntries(agg.topplista.map((p) => [p.spelare, p]))
    // c: (100 + 40 + 40) / 3 = 60. d: (50 + 100 + 100) / 3 ≈ 83,3.
    expect(byId.c.snitt).toBeCloseTo(60, 6)
    expect(byId.d.snitt).toBeCloseTo(250 / 3, 6)
    expect(agg.topplista[0].spelare).toBe('d')
  })
})

describe('provisorisktSnitt — tillsvidare-procenten', () => {
  test('40 % per ospelad giv, delat på tävlingens storlek', () => {
    expect(PROVISORISK_PROCENT).toBe(40)
    expect(provisorisktSnitt(700, 7, 12)).toBe(75)
    expect(provisorisktSnitt(0, 0, 12)).toBe(40)
    expect(provisorisktSnitt(1200, 12, 12)).toBe(100)
  })

  test('fler poängsatta än storleken (aldrig i praktiken) klämmer inte negativt; storlek 0 ger 0', () => {
    expect(provisorisktSnitt(1300, 13, 12)).toBeCloseTo(1300 / 12, 6)
    expect(provisorisktSnitt(100, 1, 0)).toBe(0)
  })
})

describe('nsScore — N/S-poängen ur ett kontrakt', () => {
  const utgångNS: Contract = { level: 4, strain: 'hearts', declarer: 'S', doubled: undefined }
  const utgångEW: Contract = { level: 4, strain: 'hearts', declarer: 'W', doubled: undefined }

  test('N/S spelförare, hemma ⇒ positivt för N/S', () => {
    // 4H av Syd, 10 stick, ozon: +420 för N/S.
    expect(nsScore(utgångNS, 10, 'none')).toBe(420)
  })

  test('Ö/V spelförare, hemma ⇒ negativt för N/S (deras poäng)', () => {
    // 4H av Väst hemma: Ö/V +420 ⇒ N/S −420.
    expect(nsScore(utgångEW, 10, 'none')).toBe(-420)
  })

  test('N/S spelförare, bet ⇒ negativt för N/S', () => {
    // 4H av Syd, 9 stick (1 bet), ozon: −50 för N/S.
    expect(nsScore(utgångNS, 9, 'none')).toBe(-50)
  })

  test('Ö/V spelförare, bet ⇒ positivt för N/S', () => {
    // 4H av Väst, 9 stick: Ö/V −50 ⇒ N/S +50.
    expect(nsScore(utgångEW, 9, 'none')).toBe(50)
  })
})
