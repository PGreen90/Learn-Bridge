// RKC-svarets trumfdam ska visas via LÄNGD bara när paret BEVISLIGEN har 10+
// trumf (egen längd + partnerns visade längd), aldrig på ett antagande
// (live-prov 2026-09-12). Förr: 5+ egen trumf → visade damen även när partnern
// bara visat 3+ (känt 8, inte 10). FACIT FÖRE FIX.

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { auctionFacts } from './auction-facts'
import { answerRKC } from './slam-answer-continuations'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const P = (seat: Seat) => call(seat, 'P')
// Nord: 5 spader utan dam, 2 nyckelkort (♠K + ♥A) → 5♥/5♠-grenen.
const nord = 'S:KJT87 H:A932 D:Q4 C:32'

describe('RKC: trumfdam via längd kräver bevisad 10-korts fit', () => {
  it('partnern (frågaren) har bara visat 3+ (höjning) → 5♥ (ingen dam), inte 5♠', () => {
    // N 1♠ – P – S 4NT: Syd har inte visat spaderlängd → golv 3, känt 5+3 = 8.
    const h = [call('N', '1S'), P('E'), call('S', '4NT'), P('W')]
    expect(answerRKC(parseHand(nord), auctionFacts(h, 'N'))!.call).toBe('5H')
  })

  it('partnern ÖPPNADE trumffärgen (5+) → bevisad 10-fit → 5♠ (dam via längd)', () => {
    // S 1♠ (5+) – P – N 2♠ – P – S 4NT: känt 5+5 = 10 → damen räknas.
    const h = [call('S', '1S'), P('W'), call('N', '2S'), P('E'), call('S', '4NT'), P('W')]
    expect(answerRKC(parseHand(nord), auctionFacts(h, 'N'))!.call).toBe('5S')
  })

  it('svararen HÅLLER trumfdamen → 5♠ oavsett längd', () => {
    const h = [call('N', '1S'), P('E'), call('S', '4NT'), P('W')]
    expect(answerRKC(parseHand('S:KQT87 H:A932 D:Q4 C:32'), auctionFacts(h, 'N'))!.call).toBe('5S')
  })
})
