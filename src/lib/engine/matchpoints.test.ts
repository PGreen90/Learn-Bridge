// Facit för matchpoängen (Beslut B etapp 2, Led 3).

import { describe, test, expect } from 'vitest'
import { matchpointsForBoard, nsScore, type GivPoäng } from './matchpoints'
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
