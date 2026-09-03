// Pliktsvepet K5 (2026-09-02, docs/senare.md "Svep: partnerskapsplikter i
// konkurrens"): ÖPPNARENS höjning av partnerns fria LÅGFÄRGSBUD på 2-läget.
// `openerRaisesFreeBid` täckte bara högfärgerna; ett fritt 2♣/2♦ föll till
// off-book-höjningen som blåste minorutgång på 13 hp + 4-korts stöd (frö
// 20261396: 1♥–(1♠)–2♣–P–5♣ med ♠63 ♥KQJ96 ♦A7 ♣JT98 — inga spaderstopp,
// 11 stick långt borta). Nu: 12–13 → 3m; 14+ → 3NT med stopp i deras färg,
// annars 4m (hopphöjning = inbjudan till 5m).
//
// Kör om svepet: $env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { dealFromSeed } from './revisor'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('pliktsvep K5 – öppnaren höjer ett fritt lågfärgsbud på 2-läget', () => {
  const HIST = [call('E', '1H'), call('S', '1S'), call('W', '2C'), call('N', 'P')]

  it('frö 20261396: 1♥–(1♠)–2♣–P: Öst (13 hp, ♣JT98) höjer 3♣ — inte 5♣', () => {
    const deal = dealFromSeed(20261396)
    const c = decideCall(deal, HIST, 'E')
    expect(c.bid).toBe('3C')
    expect(c.rule).toBe('höjning av fritt bud')
  })

  it('14+ med stopp i deras spader → 3NT', () => {
    const deal = dealOf('E', {
      E: 'S:K63 H:KQJ96 D:A7 C:JT9',
      S: 'S:AQT98 H:83 D:9542 C:63',
      W: 'S:75 H:A4 D:KJ8 C:AQ7542',
      N: 'S:J42 H:T752 D:QT63 C:K8',
    })
    const c = decideCall(deal, HIST, 'E')
    expect(c.bid).toBe('3NT')
  })

  it('14+ utan stopp i deras spader → 4♣ (hopphöjning, inbjudan till 5♣)', () => {
    const deal = dealOf('E', {
      E: 'S:63 H:KQJ96 D:AK7 C:JT9',
      S: 'S:AQT98 H:83 D:9542 C:63',
      W: 'S:K75 H:A4 D:J8 C:AQ7542',
      N: 'S:J42 H:T752 D:QT63 C:K8',
    })
    const c = decideCall(deal, HIST, 'E')
    expect(c.bid).toBe('4C')
  })
})
