import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { openerThirdBidAfterOwnRaise, openerThirdBidAfterReverse } from './rebids'
import { botAuction, dealFromSeed } from './revisor'

// =============================================================================
// STARKA HÄNDER UNDERVÄRDERAS I ÅTERBUDEN (systemfel-kandidat #3, facit FÖRE
// fix). Spanar-agentens tre frön, tre delfixar — ägarbeslut 2026-08-07:
//
// 4a (frö 20261323): svararens 6-korts-rebud var OGRADERAT — 16 hp + 6 hjärter
//     rebjöd samma billiga 2♥ som en 6-poängare, öppnaren passade → 2♥ med
//     30 hp ihop. Nu: ≤10 billigast · 11–12 hoppinvit · 13+ → fjärde färg (GF)
//     så kravmaskineriet placerar utgången (här 3NT — Syd håller klövern AQ).
// 4b (frö 20260982): öppnaren höjde svararens 1♥ till 2♥ och PASSADE sedan
//     3♥-inviten med 15 hp + 4 trumf + singel ♠ (öppnarens tredje bud saknades
//     för färgauktioner). Nu: 14+ stödpoäng accepterar → 4♥ (26 hp, 9-korts fit).
// 4c (frö 20261111): öppnaren reversade (17+) och PASSADE partnerns 3♣-preferens
//     med 18 hp (28 ihop). Nu: reversens 17-minimum får passa preferensen, men
//     18+ driver — 3NT bara med håll i den objudna färgen och 2+ kort i
//     partnerns färg, annars utgång i fiten (här 5♣ — singel hjärter).
// =============================================================================

describe('4a – svararens graderade 6-korts-rebud (frö 20261323)', () => {
  it('16 hp + 6 hjärter dör inte i 2♥: fjärde färg → utgång (3NT)', () => {
    // N 1♦ (♠AKQ8 ♥6 ♦AJ843 ♣973), S ♠73 ♥AKT743 ♦KT7 ♣AQ (16 hp).
    // Förr: 1♦–1♥–1♠–2♥, pass. DD-par är 6NT men mot öppnarens visade minimum
    // är utgången det ärligt bjudbara (ärliga slamportar).
    const calls = botAuction(dealFromSeed(20261323))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.strain).toBe('NT')
    expect(contract!.level).toBeGreaterThanOrEqual(3)
  })
})

describe('4b – öppnarens svar på 3M-inviten efter egen enkel höjning', () => {
  it('frö 20260982: 15 hp + 4 trumf + singel accepterar → 4♥', () => {
    const calls = botAuction(dealFromSeed(20260982))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBe(4)
    expect(contract!.strain).toBe('hearts')
  })

  it('unit: 982-öppnaren (♠A ♥Q652 ♦AQT85 ♣K84) accepterar', () => {
    const r = openerThirdBidAfterOwnRaise(parseHand('S:A H:Q652 D:AQT85 C:K84'), 'hearts')
    expect(r.call).toBe('4H')
  })

  it('unit: platt minimum (13 stödpoäng) avböjer inviten', () => {
    const r = openerThirdBidAfterOwnRaise(parseHand('S:K93 H:Q652 D:AQ5 C:842'), 'hearts')
    expect(r.call).toBe('P')
  })
})

describe('4c – öppnarens fortsättning efter egen reverse + partnerns preferens', () => {
  it('frö 20261111: 18 hp driver till utgång i fiten → 5♣ (singel hjärter, inget NT)', () => {
    const calls = botAuction(dealFromSeed(20261111))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBe(5)
    expect(contract!.strain).toBe('clubs')
  })

  it('unit: 1111-öppnaren (♠K72 ♥6 ♦AKQ4 ♣AQ973) → 5♣', () => {
    const r = openerThirdBidAfterReverse(parseHand('S:K72 H:6 D:AKQ4 C:AQ973'), 'clubs', 'hearts', 'diamonds', '3C')
    expect(r.call).toBe('5C')
  })

  it('unit: med håll i objudna färgen + 2+ kort i partnerns färg väljs 3NT', () => {
    // Samma styrka men 2-2-4-5 med hjärterhåll-substans: ♠KQ ♥J6 ♦AKQ4 ♣AQ973.
    const r = openerThirdBidAfterReverse(parseHand('S:KQ H:J6 D:AKQ4 C:AQ973'), 'clubs', 'hearts', 'diamonds', '3C')
    expect(r.call).toBe('3NT')
  })

  it('unit: reversens 17-minimum respekterar preferensen: pass', () => {
    const r = openerThirdBidAfterReverse(parseHand('S:A72 H:6 D:AKQ4 C:KJ973'), 'clubs', 'hearts', 'diamonds', '3C')
    expect(r.call).toBe('P')
  })
})
