// Facit för klientens tävlingshämtare (Beslut B etapp 2): den rena
// översättningen server-JSON → DagensTavling. Fetch-omslutningen testas inte
// här (nätverk) — översättningen är där felen kan gömma sig.

import { describe, test, expect } from 'vitest'
import type { Card, Suit, Rank } from '../../types/bridge'
import { tavlingFromResponse } from './tavling'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** 52 kort i ordning, delade i fyra 13-kortshänder — bara för att fylla formen
 *  (giltigheten som bridge-giv spelar ingen roll för översättningstestet). */
function fyraHänder(): Record<'N' | 'E' | 'S' | 'W', Card[]> {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return {
    N: deck.slice(0, 13),
    E: deck.slice(13, 26),
    S: deck.slice(26, 39),
    W: deck.slice(39, 52),
  }
}

function svar(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    nummer: 9,
    'tävlingsdag': '2026-08-11',
    storlek: 2,
    givar: [
      { board: 1, dealer: 'N', vulnerability: 'none', hands: fyraHänder(), playSeed: 111 },
      { board: 2, dealer: 'E', vulnerability: 'ns', hands: fyraHänder(), playSeed: 222 },
    ],
    ...overrides,
  }
}

describe('tavlingFromResponse — översätter serversvaret', () => {
  test('mappar nummer/dag/storlek och varje giv', () => {
    const t = tavlingFromResponse(svar())
    expect(t.nummer).toBe(9)
    expect(t.dag).toBe('2026-08-11')
    expect(t.storlek).toBe(2)
    expect(t.givar).toHaveLength(2)
  })

  test('varje giv får ett stabilt, unikt id (tavling-<nr>-<bricka>)', () => {
    const t = tavlingFromResponse(svar())
    expect(t.givar[0].deal.id).toBe('tavling-9-1')
    expect(t.givar[1].deal.id).toBe('tavling-9-2')
  })

  test('behåller dealer, zon, bricka, händer och play-frö', () => {
    const t = tavlingFromResponse(svar())
    const g = t.givar[1]
    expect(g.deal.dealer).toBe('E')
    expect(g.deal.vulnerability).toBe('ns')
    expect(g.deal.board).toBe(2)
    expect(g.playSeed).toBe(222)
    for (const s of ['N', 'E', 'S', 'W'] as const) expect(g.deal.hands[s]).toHaveLength(13)
  })

  test('kastar när ok saknas', () => {
    expect(() => tavlingFromResponse(svar({ ok: false }))).toThrow()
  })

  test('kastar vid ogiltig dealer', () => {
    expect(() =>
      tavlingFromResponse(svar({ givar: [{ board: 1, dealer: 'X', vulnerability: 'none', hands: fyraHänder(), playSeed: 1 }] })),
    ).toThrow()
  })

  test('kastar när en hand inte har 13 kort', () => {
    const trasig = fyraHänder()
    trasig.N = trasig.N.slice(0, 12)
    expect(() =>
      tavlingFromResponse(svar({ givar: [{ board: 1, dealer: 'N', vulnerability: 'none', hands: trasig, playSeed: 1 }] })),
    ).toThrow()
  })

  test('kastar när play-frö saknas', () => {
    expect(() =>
      tavlingFromResponse(svar({ givar: [{ board: 1, dealer: 'N', vulnerability: 'none', hands: fyraHänder() }] })),
    ).toThrow()
  })
})
