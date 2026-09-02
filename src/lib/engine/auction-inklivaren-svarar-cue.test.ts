// Pliktsvepet K1 (2026-09-02, docs/senare.md "Svep: partnerskapsplikter i
// konkurrens"): INKLIVAREN passade advancerns CUE-HÖJNING när motståndarna
// låg tysta — och given spelades i motståndarnas färg på 2-läget (12 av 1539
// störda auktioner i svepet, t.ex. frö 20260905: 1♦–(1♠)–P–(2♦*)–P–P–P → 2♦).
// `answerCueRaise` täckte bara ÖPPNAREN, `overcallerCompetesAfterCueRaise`
// bara läget där motståndarna bjudit VIDARE över cuet.
//
// Regeln (§7.1): advancerns cue = limithöjning eller bättre (11+ stödpoäng,
// 3+ stöd) och är krav. Inklivaren svarar: minimum (< 14 totalpoäng) →
// billigaste återgång i egen färg (ej krav); extra (14+) → utgång i högfärgen,
// i lågfärg 3NT med stopp i deras färg. Cue-bjudaren går sedan vidare med
// utgångsvärden (13+ stödpoäng) och passar återgången med ren limithöjning.
//
// Kör om svepet: $env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { dealFromSeed } from './revisor'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, vul: Deal['vulnerability'], hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: vul, board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('pliktsvep K1 – inklivaren svarar advancerns cue-höjning (ostört)', () => {
  it('frö 20260905: 1♦–(1♠)–P–(2♦*)–P: Syd (11 hp, ♠AT942) återgår 2♠ — passar aldrig cuet', () => {
    const deal = dealFromSeed(20260905)
    const hist = [call('E', '1D'), call('S', '1S'), call('W', 'P'), call('N', '2D'), call('E', 'P')]
    const c = decideCall(deal, hist, 'S')
    expect(c.bid).toBe('2S')
    expect(c.rule).toBe('inklivaren svarar cue-höjning (minimum)')
  })

  it('… och cue-bjudaren Nord (11 hp, ren limithöjning) passar återgången', () => {
    const deal = dealFromSeed(20260905)
    const hist = [call('E', '1D'), call('S', '1S'), call('W', 'P'), call('N', '2D'), call('E', 'P'), call('S', '2S'), call('W', 'P')]
    const c = decideCall(deal, hist, 'N')
    expect(c.bid).toBe('P')
    expect(c.rule).toBe('cue-höjningens fortsättning (limit stannar)')
  })

  it('frö 20260910: 1♣–(1♥)–P–(2♣*)–P: Nord (14 hp, ♥AK765) sätter utgång 4♥', () => {
    const deal = dealFromSeed(20260910)
    const hist = [call('W', '1C'), call('N', '1H'), call('E', 'P'), call('S', '2C'), call('W', 'P')]
    const c = decideCall(deal, hist, 'N')
    expect(c.bid).toBe('4H')
    expect(c.rule).toBe('inklivaren svarar cue-höjning (utgång)')
  })

  it('frö 20262462: 1♣–(1♦)–P–(2♣*)–P: Öst (8 hp, ♦JT984) återgår billigast 2♦ (inte 3♦)', () => {
    const deal = dealFromSeed(20262462)
    const hist = [call('N', '1C'), call('E', '1D'), call('S', 'P'), call('W', '2C'), call('N', 'P')]
    expect(decideCall(deal, hist, 'E').bid).toBe('2D')
  })

  it('lågfärgsinkliv med extra + stopp i deras färg → 3NT; cue-bjudaren med 13+ driver utgång efter en återgång', () => {
    // Väst öppnar 1♠, Nord kliver in 2♦ (15 hp, ♠KJ4 = stopp), Öst passar, Syd cue-bjuder 2♠.
    const deal = dealOf('W', 'none', {
      N: 'S:KJ4 H:A3 D:AQJ975 C:82',
      E: 'S:T95 H:9764 D:2 C:JT965',
      S: 'S:83 H:KQT8 D:KT64 C:A73',
      W: 'S:AQ762 H:J52 D:83 C:KQ4',
    })
    const hist = [call('W', '1S'), call('N', '2D'), call('E', 'P'), call('S', '2S'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('3NT')

    // Samma läge men Nord minimum utan stopp (♠74) → 3♦; Syd (13 stödpoäng) fortsätter till 3NT med stopp.
    const minDeal = dealOf('W', 'none', {
      N: 'S:74 H:A3 D:AQJ975 C:982',
      E: 'S:T95 H:9764 D:2 C:JT654',
      S: 'S:KJ3 H:KQT8 D:KT64 C:A7',
      W: 'S:AQ862 H:J52 D:83 C:KQ3',
    })
    expect(decideCall(minDeal, hist, 'N').bid).toBe('3D')
    const after = [...hist, call('N', '3D'), call('E', 'P')]
    const s = decideCall(minDeal, after, 'S')
    expect(s.bid).toBe('3NT')
    expect(s.rule).toBe('cue-höjningens fortsättning')
  })

  it('motståndarna bjuder ÖVER cuet → den befintliga tävlingsregeln (#47) gäller, inte den här', () => {
    const deal = dealFromSeed(20260905)
    const hist = [call('E', '1D'), call('S', '1S'), call('W', 'P'), call('N', '2D'), call('E', '3D')]
    const c = decideCall(deal, hist, 'S')
    expect(c.rule).toBe('överklivaren tävlar (cue-höjning)')
  })
})
