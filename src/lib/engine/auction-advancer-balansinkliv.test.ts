// FACIT (ägarrapport 2026-09-14, dagens tävling bricka 12): advancern efter
// partnerns BALANSINKLIV och inklivarens rättelse till egen färg.
//
// Giv 12: V P · N P · Ö 1♦ · S P · V P · N 1♥ (balansering) · Ö P · S ?
// Syd ♠KQ42 ♥QJ32 ♦J2 ♣653 (9 hp, 4-korts hjärterstöd). Motorn bjöd 1♠
// ("egen färg utan stöd" — fast stödet fanns) och Nord passade 1♠ med ♠53
// ♥AT965. Kontraktet blev 1♠ i en 4-2 i stället för 1♥ i 9-korts fiten.
//
// Ägarens facit: (1) Syd PASSAR 1♥ — fit + minimum mot en passad partner som
// redan lånat kungen i balanseringen; vi TÄVLAR sedan (2♥) OM motståndarna
// bjuder vidare. Ny färg med stöd för partnerns inkliv finns inte.
// (2) Kommer 1♠ ändå rättar Nord tillbaka till 2♥ med 5+ hjärter och högst
// två spader — advancerns nya färg är inget krav och 1♠ på 4-2 är fel kontrakt.
// FACIT FÖRE FIX.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>, vulnerability: Deal['vulnerability'] = 'none'): Deal {
  return {
    id: 'test', dealer, vulnerability, board: 12,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

/** Dagens tävling 2026-09-14, bricka 12 (giv V, zon NS). */
const GIV12 = dealOf('W', {
  N: 'S:53 H:AT965 D:853 C:QJT',
  E: 'S:AJ87 H:K D:AKQ97 C:A74',
  S: 'S:KQ42 H:QJ32 D:J2 C:653',
  W: 'S:T96 H:874 D:T64 C:K982',
}, 'ns')
const BAL = [call('W', 'P'), call('N', 'P'), call('E', '1D'), call('S', 'P'), call('W', 'P'), call('N', '1H'), call('E', 'P')]

describe('Advancern efter partnerns balansinkliv (bricka 12, 2026-09-14)', () => {
  it('giv 12: Syd PASSAR 1♥ med 4-korts stöd och minimum (ingen ny färg med fit)', () => {
    const d = decideCall(GIV12, BAL, 'S')
    expect(d.bid).toBe('P')
    expect(d.explanation).toMatch(/stöd|fit/i)
  })

  it('giv 12: bjuder öppnaren vidare (2♦) TÄVLAR Syd 2♥ (8+ trumf, lagen om totala stick)', () => {
    const HIST = [...BAL.slice(0, 6), call('E', '2D')]
    expect(decideCall(GIV12, HIST, 'S').bid).toBe('2H')
  })

  it('giv 12: balanserar Väst (2♦) efter vårt pass tävlar Syd 2♥', () => {
    const HIST = [...BAL, call('S', 'P'), call('W', '2D'), call('N', 'P')]
    expect(decideCall(GIV12, HIST, 'S').bid).toBe('2H')
  })

  it('utan stöd (dubbelton hjärter, 5 spader, 9 hp) bjuds den egna färgen 1♠ som förut', () => {
    const deal = dealOf('W', {
      N: 'S:53 H:AT965 D:853 C:QJT',
      E: 'S:AJ8 H:K7 D:AKQ97 C:A74',
      S: 'S:KQ742 H:Q3 D:J2 C:6532',
      W: 'S:T96 H:J842 D:T64 C:K98',
    }, 'ns')
    expect(decideCall(deal, BAL, 'S').bid).toBe('1S')
  })

  it('regressionsvakt F3: 11 stödpoäng höjer fortfarande 2♥ (rabatten orörd)', () => {
    const deal = dealOf('W', {
      N: 'S:53 H:AT965 D:853 C:QJT',
      E: 'S:AJ87 H:K D:AKQ97 C:A74',
      S: 'S:KQ42 H:QJ32 D:K2 C:Q53',
      W: 'S:T96 H:874 D:JT64 C:K98',
    }, 'ns')
    expect(decideCall(deal, BAL, 'S').bid).toBe('2H')
  })
})

describe('Inklivaren rättar till egen färg efter advancerns nya färg på 1-läget', () => {
  it('giv 12: kommer 1♠ ändå bjuder Nord 2♥ (5 hjärter, två spader)', () => {
    const HIST = [...BAL, call('S', '1S'), call('W', 'P')]
    expect(decideCall(GIV12, HIST, 'N').bid).toBe('2H')
  })

  it('med 3-korts stöd i advancerns färg passar inklivaren 1♠ (5-3 räcker)', () => {
    const deal = dealOf('W', {
      N: 'S:J53 H:AT965 D:85 C:QJT',
      E: 'S:A87 H:K D:AKQ97 C:A743',
      S: 'S:KQ642 H:Q3 D:J2 C:6532',
      W: 'S:T9 H:J8742 D:T643 C:K98',
    }, 'ns')
    const HIST = [...BAL, call('S', '1S'), call('W', 'P')]
    expect(decideCall(deal, HIST, 'N').bid).toBe('P')
  })

  it('direkt sits: 1♦–(1♥)–P–(1♠)–P → inklivaren med ♠2 rättar 2♥', () => {
    const deal = dealOf('E', {
      E: 'S:AJ8 H:K7 D:AKQ97 C:A74',
      S: 'S:53 H:AT965 D:853 C:QJT',
      W: 'S:T96 H:J842 D:T64 C:K98',
      N: 'S:KQ742 H:Q3 D:J2 C:6532',
    })
    const HIST = [call('E', '1D'), call('S', '1H'), call('W', 'P'), call('N', '1S'), call('E', 'P')]
    expect(decideCall(deal, HIST, 'S').bid).toBe('2H')
  })
})
