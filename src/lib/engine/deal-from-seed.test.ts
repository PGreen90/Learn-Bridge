// Facit för dealFromSeed (Beslut B etapp 2): serverns tävlingsgivar måste vara
// exakt reproducerbara ur sitt frö — annars kan servern aldrig spela om ett
// inskickat resultat och validera det. Här bevisas determinismen och att given
// är en giltig, komplett bridgegiv.

import { describe, test, expect } from 'vitest'
import type { Card, Seat } from '../../types/bridge'
import { dealFromSeed, boardInfo } from './deal'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const cardKey = (c: Card) => `${c.suit}-${c.rank}`

describe('dealFromSeed — deterministisk tävlingsgiv', () => {
  test('samma frö + bricka ⇒ exakt samma giv', () => {
    const a = dealFromSeed(123456, 1)
    const b = dealFromSeed(123456, 1)
    expect(a).toEqual(b)
  })

  test('olika frö ⇒ olika giv (samma bricka)', () => {
    const a = dealFromSeed(123456, 1)
    const b = dealFromSeed(123457, 1)
    expect(a.hands).not.toEqual(b.hands)
  })

  test('given är komplett och laglig: 13 kort per hand, 52 unika kort', () => {
    const deal = dealFromSeed(987654, 7)
    for (const s of SEATS) expect(deal.hands[s]).toHaveLength(13)
    const all = SEATS.flatMap((s) => deal.hands[s].map(cardKey))
    expect(new Set(all).size).toBe(52)
  })

  test('bricka styr givare + zon enligt duplikatschemat (inte slumpat)', () => {
    for (const board of [1, 5, 12, 13]) {
      const deal = dealFromSeed(42, board)
      expect(deal.board).toBe(board)
      expect({ dealer: deal.dealer, vulnerability: deal.vulnerability }).toEqual(boardInfo(board))
    }
  })
})
