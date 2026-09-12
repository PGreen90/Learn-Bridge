// Advancerns ANDRA bud efter partnerns 1NT-inkliv (systems on) — Smolen/garbage
// (live-prov 2026-09-12, bricka 3). Efter 1♦–1NT(inkliv)–P–2♣(Stayman)–P–2♦(ingen
// hf) ska advancern kunna visa högfärgerna: Smolen (GF 5-4 → hopp i kortare hf),
// garbage (svag 5-5 → 2-läget, bästa hf). Förr rekommenderade motorn PASS.
// FACIT FÖRE FIX. Speglar 1NT-öppningens `responderRebidIn1NTAuction`.

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const P = (seat: Seat) => call(seat, 'P')
const bud = (hand: string, hist: ResolvedCall[], seat: Seat) =>
  decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)

// 1♦(Väst) – 1NT(Nord, inkliv) – P – 2♣(Syd, Stayman) – P – 2♦(Nord, ingen hf) – P – Syd.
const h = [call('W', '1D'), call('N', '1NT'), P('E'), call('S', '2C'), P('W'), call('N', '2D'), P('E')]

describe('systems on efter 1NT-inkliv – advancerns rebud (Smolen/garbage)', () => {
  it('bricka 3: svag 5-5 (♠J8542 ♥J9754 ♦J82, 3 hp) → 2♥, inte PASS', () => {
    const r = bud('S:J8542 H:J9754 D:J82', h, 'S')
    expect(r).not.toBeNull()
    expect(r!.call.bid).toBe('2H')
  })

  it('GF 5-4 (5♠4♥, ♠KQ763 ♥AJ54 ♦K2 ♣82, 13 hp) → 3♥ Smolen (hopp i kortare hf)', () => {
    const r = bud('S:KQ763 H:AJ54 D:K2 C:82', h, 'S')
    expect(r!.call.bid).toBe('3H')
    expect(r!.call.rule).toBe('Smolen')
  })

  it('GF 5-4 (5♥4♠, ♠AJ54 ♥KQ763 ♦K2 ♣82, 13 hp) → 3♠ Smolen', () => {
    const r = bud('S:AJ54 H:KQ763 D:K2 C:82', h, 'S')
    expect(r!.call.bid).toBe('3S')
    expect(r!.call.rule).toBe('Smolen')
  })
})
