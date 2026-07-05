import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

// =============================================================================
// FACIT-GIVAR: "Störda krav — krav får aldrig passas I KONKURRENS"  (2026-07-05)
// -----------------------------------------------------------------------------
// Systerfilen foundation-forcing.test.ts (A–D) täckte bara OSTÖRDA krav.
// `auctionForce` spärrade AV på konkurrens med flit. Dessa tre givar blottar att
// krav fortfarande faller när motståndarna klivit in:
//
//   - Störd A: 1♦–(1♠)–2♣  → öppnaren PASSAR partnerns fria 2-över-1.
//   - Störd B: 1♣–1♥–(1♠)–2♦ → svararen PASSAR öppnarens reverse.
//   - Störd C: 1♣–(1♦)–1♠  → öppnaren PASSAR partnerns fria 1-lägesbud.
//
// ÄGARBESLUT (2026-07-05): ett fritt bud (ny färg) och en reverse i STÖRD
// budgivning är RONDKRAV — partnern får inte passa, MEN budgivningen får stanna
// UNDER utgång (ett inkliv "lånar" utrymme, så ett 2/1 lovar värden men ej
// garanterad utgång). Alltså: aldrig 'game' i konkurrens, bara 'round'.
//
// ✅ Facit före fix: alla tre ska vara RÖDA innan honorForce lär sig konkurrens.
//    Efter fixen är detta ett REGRESSIONSLÅS.
// =============================================================================

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('FACIT (regressionslås): störda krav — krav i konkurrens', () => {
  // A) Fritt 2-över-1. N öppnar 1♦, Ö kliver in 1♠, S bjuder fritt 2♣ (ny färg,
  //    rondkrav). Öppnaren MÅSTE rebjuda — får inte passa det fria kravbudet.
  it('A: öppnaren får aldrig passa partnerns fria 2-över-1 i konkurrens', () => {
    const deal = dealOf('N', {
      N: 'S:K5 H:A73 D:KQJ84 C:962',
      E: 'S:AQ764 H:K5 D:T3 C:AJ84',
      S: 'S:82 H:QJ96 D:A6 C:KQ753',
      W: 'S:JT93 H:T842 D:9752 C:T',
    })
    const history = [call('N', '1D'), call('E', '1S'), call('S', '2C'), call('W', 'P')]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).not.toBe('P') // rondkrav i konkurrens — pass förbjudet
  })

  // B) Reverse i konkurrens. N öppnar 1♣, S 1♥, V kliver in 1♠, N 2♦ (reverse,
  //    extra styrka, rondkrav). Svararen MÅSTE svara — får inte passa reversen.
  it('B: svararen får aldrig passa öppnarens reverse i konkurrens', () => {
    const deal = dealOf('N', {
      N: 'S:A5 H:K3 D:AQ84 C:AKJ92',
      S: 'S:K873 H:QJ642 D:5 C:Q83',
      W: 'S:QJT96 H:A5 D:K93 C:T54',
      E: 'S:42 H:T987 D:JT762 C:76',
    })
    const history = [call('N', '1C'), call('E', 'P'), call('S', '1H'), call('W', '1S'), call('N', '2D'), call('E', 'P')]
    const c = decideCall(deal, history, 'S')
    expect(c.bid).not.toBe('P') // rondkrav i konkurrens — pass förbjudet
  })

  // C) Fritt 1-lägesbud. N öppnar 1♣, Ö kliver in 1♦, S bjuder fritt 1♠ (ny färg,
  //    rondkrav). Öppnaren MÅSTE rebjuda — får inte passa det fria budet.
  it('C: öppnaren får aldrig passa partnerns fria 1-lägesbud i konkurrens', () => {
    const deal = dealOf('N', {
      N: 'S:K5 H:A73 D:972 C:KQJ84',
      E: 'S:Q4 H:K95 D:AQ863 C:T72',
      S: 'S:AJ976 H:QJ4 D:54 C:963',
      W: 'S:T832 H:T862 D:KJT C:A5',
    })
    const history = [call('N', '1C'), call('E', '1D'), call('S', '1S'), call('W', 'P')]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).not.toBe('P') // rondkrav i konkurrens — pass förbjudet
  })
})
