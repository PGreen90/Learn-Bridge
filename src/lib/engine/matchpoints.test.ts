// Facit för matchpoängen (Beslut B etapp 2, Led 3).

import { describe, test, expect } from 'vitest'
import {
  aggregeraTopplista,
  matchpointsForBoard,
  nsScore,
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
    const agg = aggregeraTopplista(rader, 2)
    expect(agg.poängsattaGivar).toBe(2)
    const byId = Object.fromEntries(agg.topplista.map((p) => [p.spelare, p]))
    expect(byId.a.snitt).toBe(50)
    expect(byId.b.snitt).toBe(50)
    expect(byId.a.antalGivar).toBe(2)
  })

  test('utan kallare: du = null, dinaGivar tom', () => {
    const agg = aggregeraTopplista(rader, 2)
    expect(agg.du).toBeNull()
    expect(agg.dinaGivar).toEqual([])
  })

  test('kallare får placering (delad vid lika snitt), snitt och MP per giv', () => {
    const agg = aggregeraTopplista(rader, 2, 'a')
    expect(agg.du).toEqual({ placering: 1, snitt: 50, antalGivar: 2 })
    // Per giv, i brickordning: giv 1 topp (100 %), giv 2 botten (0 %).
    expect(agg.dinaGivar).toEqual([
      { board: 1, mp: 1, max: 1, procent: 100 },
      { board: 2, mp: 0, max: 1, procent: 0 },
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
    expect(aggregeraTopplista(vassare, 2, 'a').du?.placering).toBe(1)
    expect(aggregeraTopplista(vassare, 2, 'b').du?.placering).toBe(2)
    expect(aggregeraTopplista(vassare, 2, 'a').du?.snitt).toBe(100)
  })

  test('giv med för få spelare ger inga poäng (och räknas inte)', () => {
    const glest: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 }, // ensam → ingen poäng
      { board: 2, spelare: 'a', poäng: 100 },
      { board: 2, spelare: 'b', poäng: 420 },
    ]
    const agg = aggregeraTopplista(glest, 2, 'a')
    expect(agg.poängsattaGivar).toBe(1)
    // Bara giv 2 räknas för a: 0 %.
    expect(agg.du).toEqual({ placering: 2, snitt: 0, antalGivar: 1 })
    expect(agg.dinaGivar).toEqual([{ board: 2, mp: 0, max: 1, procent: 0 }])
  })

  test('kallare utan någon poängsatt giv: du = null', () => {
    const glest: Tävlingsrad[] = [
      { board: 1, spelare: 'ensam', poäng: 620 }, // bara kallaren spelat giv 1
    ]
    expect(aggregeraTopplista(glest, 2, 'ensam').du).toBeNull()
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
