// Facit för travellern (tävlings-UI-polish steg 6).

import { describe, test, expect } from 'vitest'
import type { ResolvedCall } from '../bidding'
import { byggBrickresultat, type Brickrad } from './brickresultat'

/** En avslutad auktion "kontrakt + tre pass" (spelföraren nämner färgen först). */
function auktion(seat: 'N' | 'E' | 'S' | 'W', bid: string): ResolvedCall[] {
  const ordning: Array<'N' | 'E' | 'S' | 'W'> = ['S', 'W', 'N', 'E']
  const start = ordning.indexOf(seat)
  const roterad = [...ordning.slice(start), ...ordning.slice(0, start)]
  return [
    { seat, bid: bid as ResolvedCall['bid'] },
    { seat: roterad[1], bid: 'P' as ResolvedCall['bid'] },
    { seat: roterad[2], bid: 'P' as ResolvedCall['bid'] },
    { seat: roterad[3], bid: 'P' as ResolvedCall['bid'] },
  ]
}

describe('byggBrickresultat', () => {
  test('matchpoäng + kontrakt per spelare, sorterat bäst först', () => {
    const rader: Brickrad[] = [
      // A: 4♠ av Syd, 10 stick (jämnt) → NS +420.
      { spelare: 'A', nsScore: 420, declarerTricks: 10, passedOut: false, history: auktion('S', '4S') },
      // B: 3NT av Syd, 10 stick (+1) → NS +430.
      { spelare: 'B', nsScore: 430, declarerTricks: 10, passedOut: false, history: auktion('S', '3NT') },
    ]
    const res = byggBrickresultat(rader)
    // B bäst (430 > 420) → först, 100 %.
    expect(res[0].spelare).toBe('B')
    expect(res[0].procent).toBe(100)
    expect(res[0].kontrakt).toEqual({ level: 3, strain: 'NT', declarer: 'S', doubled: undefined, diff: 1 })
    expect(res[1].spelare).toBe('A')
    expect(res[1].procent).toBe(0)
    expect(res[1].kontrakt).toEqual({ level: 4, strain: 'spades', declarer: 'S', doubled: undefined, diff: 0 })
  })

  test('utpassad giv: kontrakt null, deltar i matchpoängen med 0', () => {
    const rader: Brickrad[] = [
      { spelare: 'A', nsScore: 100, declarerTricks: 5, passedOut: false, history: auktion('W', '2H') },
      { spelare: 'B', nsScore: 0, declarerTricks: 0, passedOut: true, history: [] },
    ]
    const res = byggBrickresultat(rader)
    const b = res.find((r) => r.spelare === 'B')!
    expect(b.kontrakt).toBeNull()
    // A (+100) slår B (0) → A 100 %, B 0 %.
    expect(res.find((r) => r.spelare === 'A')!.procent).toBe(100)
    expect(b.procent).toBe(0)
  })

  test('motståndarnas kontrakt (Ö/V spelförare) tolkas med rätt säte', () => {
    const rader: Brickrad[] = [
      { spelare: 'A', nsScore: -50, declarerTricks: 9, passedOut: false, history: auktion('W', '3D') },
      { spelare: 'B', nsScore: -100, declarerTricks: 10, passedOut: false, history: auktion('W', '3D') },
    ]
    const res = byggBrickresultat(rader)
    expect(res[0].spelare).toBe('A') // −50 bättre för N/S än −100
    expect(res[0].kontrakt?.declarer).toBe('W')
    expect(res[0].kontrakt?.strain).toBe('diamonds')
    expect(res[0].kontrakt?.diff).toBe(0) // 3♦ = 9 stick, jämnt
    expect(res.find((r) => r.spelare === 'B')!.kontrakt?.diff).toBe(1) // 10 stick = +1
  })
})
