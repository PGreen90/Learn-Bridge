// Felrapport #55 (github.com/PGreen90/Learn-Bridge/issues/55), bricka 2:
// P – 1♦(S) – 1♥(W) – X(N) – P – 2♣ – P – P – P. Nord hade ♠KQ87432 ♥T6 ♦K ♣532
// (8 hp, 7-korts spader) och dubblade negativt i stället för att visa spadern —
// sedan passade Nord partnerns tvingade 2♣ och given dog i 2♣ (6 stick) fast
// spader var hemma. Ägaren: "Nord bör visa sin spader."
//
// Regeln (§7.4/§5.5): den negativa dubblingen visar EXAKT fyra kort i en objuden
// högfärg som kan bjudas på 1-läget; med 5+ bjuder svararen färgen — ett FRITT
// BUD (rondkrav, 6+ hp på 1-läget, 10+ på 2-läget).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, vul: Deal['vulnerability'], hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: vul, board: 2,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

const DEAL_55 = dealOf('E', 'ns', {
  N: 'S:KQ87432 H:T6 D:K C:532',
  E: 'S:T5 H:K953 D:JT95 C:974',
  S: 'S:AJ9 H:2 D:A8642 C:AQ86',
  W: 'S:6 H:AQJ874 D:Q73 C:KJT',
})

describe('felrapport #55 – svararen visar sin 5+ högfärg på 1-läget i stället för negativ X', () => {
  it('P – 1♦ – (1♥): Nord bjuder 1♠ (fritt bud, 5+ spader), inte X', () => {
    const c = decideCall(DEAL_55, [call('E', 'P'), call('S', '1D'), call('W', '1H')], 'N')
    expect(c.bid).toBe('1S')
    expect(c.rule).toBe('fritt bud')
  })

  it('… och med exakt 4 spader dubblar Nord negativt som förr', () => {
    const deal = dealOf('E', 'ns', {
      N: 'S:KQ87 H:T63 D:K2 C:5432',
      E: 'S:T5 H:K953 D:JT95 C:974',
      S: 'S:AJ9 H:2 D:A8642 C:AQ86',
      W: 'S:6 H:AQJ874 D:Q73 C:KJT',
    })
    const c = decideCall(deal, [call('E', 'P'), call('S', '1D'), call('W', '1H')], 'N')
    expect(c.bid).toBe('X')
  })

  it('1♦ – (1♠) med 5 hjärter och 11 hp: 2♥ (fritt bud på 2-läget, 10+)', () => {
    const deal = dealOf('S', 'none', {
      N: 'S:32 H:KQ876 D:K32 C:Q32',
      E: 'S:T5 H:J93 D:JT95 C:9754',
      S: 'S:AJ9 H:2 D:AQ864 C:AJ86',
      W: 'S:KQ8764 H:AT54 D:7 C:KT',
    })
    const c = decideCall(deal, [call('S', '1D'), call('W', '1S')], 'N')
    expect(c.bid).toBe('2H')
    expect(c.rule).toBe('fritt bud')
  })

  it('1♦ – (1♠) med 5 hjärter och 8 hp: X (för svagt för ett fritt bud på 2-läget)', () => {
    const deal = dealOf('S', 'none', {
      N: 'S:32 H:KQ876 D:J32 C:J32',
      E: 'S:T5 H:J93 D:KT95 C:9754',
      S: 'S:AJ9 H:2 D:AQ864 C:AQ86',
      W: 'S:KQ8764 H:AT54 D:7 C:KT',
    })
    const c = decideCall(deal, [call('S', '1D'), call('W', '1S')], 'N')
    expect(c.bid).toBe('X')
  })
})

// Fortsättningen efter det fria budet (samma giv): öppnaren höjer på 3-korts
// stöd (budet lovar 5+), svararen bjuder utgång med 7 trumf — 4♠ gick hem med
// 11 stick (DD) medan 2♣ gav 6.
describe('felrapport #55 – fortsättningen: höjning på 3-korts stöd → utgång', () => {
  const upToFree = [call('E', 'P'), call('S', '1D'), call('W', '1H'), call('N', '1S'), call('E', 'P')]

  it('öppnaren (♠AJ9, 14 hp) höjer det fria budet till 2♠ — inte 2♣', () => {
    const c = decideCall(DEAL_55, upToFree, 'S')
    expect(c.bid).toBe('2S')
    expect(c.rule).toBe('höjning av fritt bud')
  })

  it('svararen (7 trumf mot 3 visade, 8 hp = 14 Bergen) bjuder utgång 4♠ efter höjningen', () => {
    const c = decideCall(DEAL_55, [...upToFree, call('S', '2S'), call('W', 'P')], 'N')
    expect(c.bid).toBe('4S')
    expect(c.rule).toBe('utgång efter höjt fritt bud')
  })

  it('svararen med 12 hp och 5 spader inbjuder 3♠ — och öppnaren (14 hp + singel) antar → 4♠', () => {
    const deal = dealOf('E', 'ns', {
      N: 'S:KJ876 H:A6 D:KJ5 C:532', // 12 hp + 5-korts trumf = 12 Bergen → invit
      E: 'S:432 H:7543 D:T73 C:974',
      S: 'S:AT9 H:2 D:A8642 C:AQ86',
      W: 'S:Q5 H:KQJT98 D:Q9 C:KJT',
    })
    const afterRaise = [...upToFree, call('S', '2S'), call('W', 'P')]
    const n = decideCall(deal, afterRaise, 'N')
    expect(n.bid).toBe('3S')
    expect(n.rule).toBe('inbjudan efter höjt fritt bud')
    expect(decideCall(deal, [...afterRaise, call('N', '3S'), call('E', 'P')], 'S').bid).toBe('4S')
  })

  it('öppnaren med 16–18 hopphöjer (3♠) och svararen med 5 spader/8 hp passar en enkel höjning', () => {
    const deal = dealOf('E', 'ns', {
      N: 'S:K9876 H:T6 D:Q32 C:J32',
      E: 'S:T5 H:K943 D:T97 C:9754',
      S: 'S:AQ4 H:2 D:KJ654 C:AQ86', // 16 hp → hopphöjning
      W: 'S:J32 H:AQJ875 D:A8 C:KT',
    })
    expect(decideCall(deal, upToFree, 'S').bid).toBe('3S')
    const minDeal = dealOf('E', 'ns', {
      N: 'S:K9876 H:T6 D:Q32 C:J32',
      E: 'S:T5 H:K953 D:JT95 C:974',
      S: 'S:AJ4 H:2 D:A8764 C:AQ86',
      W: 'S:Q32 H:AQJ874 D:K C:KT5',
    })
    expect(decideCall(minDeal, [...upToFree, call('S', '2S'), call('W', 'P')], 'N').bid).toBe('P')
  })
})
