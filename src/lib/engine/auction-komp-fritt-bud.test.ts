// Konkurrens: öppnarens återbud efter partnerns fria bud + svararens fortsättning
// (live-prov 2026-09-12, bricka 15). Auktion 1♦–(2♣)–2♥–(P):
//   Öppnaren: 2♠ = 5-4 (5 öppnade + 4 spader), INGET stopp i deras ♣;
//             2NT = stopp i deras ♣.
//   Svararen efter 2♠: 3♥ = 6+ hjärter (längre än de 5 som visats);
//             3NT = klöverstopp + öppningsvärden (12+); 2NT = klöverstopp (10–11).
//   Fel 1: partnerns fria 2♥ ska tolkas som 5+ (inte 4+).
// FACIT FÖRE FIX.

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const P = (s: Seat) => call(s, 'P')
const bud = (hand: string, hist: ResolvedCall[], seat: Seat) =>
  decideFromTable(parseHand(hand), auctionFacts(hist, seat), seat === 'N' || seat === 'S')

const hSyd = [call('S', '1D'), call('W', '2C'), call('N', '2H'), P('E')]
const hNord = [...hSyd, call('S', '2S'), P('W')]

describe('konkurrens – öppnarens återbud efter fritt bud', () => {
  it('bricka 15: 5♦-4♠ utan klöverstopp (♠Q986 ♥KT ♦AK742 ♣T8) → 2♠', () => {
    expect(bud('S:Q986 H:KT D:AK742 C:T8', hSyd, 'S')!.call.bid).toBe('2S')
  })
  it('klöverstopp (♠K5 ♥KT ♦AK742 ♣QJ98) → 2NT', () => {
    expect(bud('S:K5 H:KT D:AK742 C:QJ98', hSyd, 'S')!.call.bid).toBe('2NT')
  })
})

describe('konkurrens – svararens fortsättning efter öppnarens 2♠', () => {
  it('6+ hjärter (♠A43 ♥AQ8753 ♦J ♣K62) → 3♥ (hittar 8-korts fiten)', () => {
    expect(bud('S:A43 H:AQ8753 D:J C:K62', hNord, 'N')!.call.bid).toBe('3H')
  })
  it('5 hjärter + klöverstopp + öppningsvärden (♠A3 ♥AQ875 ♦J92 ♣K62) → 3NT', () => {
    expect(bud('S:A3 H:AQ875 D:J92 C:K62', hNord, 'N')!.call.bid).toBe('3NT')
  })
  it('5 hjärter + klöverstopp, 10–11 (♠Q83 ♥AQ875 ♦942 ♣K6, 11 hp) → 2NT', () => {
    expect(bud('S:Q83 H:AQ875 D:942 C:K6', hNord, 'N')!.call.bid).toBe('2NT')
  })
})

describe('konkurrens – Fel 1: fria budets tolkning', () => {
  it('meaningOf partnerns 2♥ (fritt bud) säger 5+, inte 4+', () => {
    const m = meaningOf([call('S', '1D'), call('W', '2C'), call('N', '2H')], 2)
    expect(m.text).toContain('5+')
    expect(m.text).not.toContain('minst 4 kort')
  })
})
