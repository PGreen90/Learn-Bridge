import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { openerRebidAfter1LevelResponse } from './rebids'
import { responderSecondBid } from './responder-rebids'
import { botAuction, dealFromSeed } from './revisor'

// =============================================================================
// OKLART-ÅTERBUDET EFTER 1minor–1högfärg (systemfel-kandidat #2, facit FÖRE
// fix). Översynen 2026-08-07 klassade de fem spanarfröna:
//   20261155 RÄTT (exakt par 3NT) · 20261492 RÄTT (systemriktigt pass,
//   DD-smicker) · 20261228 kosmetisk (1=4=5=3 kan inte visa hjärtern utan
//   reverse — medveten design, par bara 3♥ EW) — dokumenterade medvetet-OK.
// Ägarbeslut: laga de två äkta felen:
//
// 1) Frö 20261317 — svararen PASSADE öppnarens kravmärkta 3♣: dispatchern
//    (responderSecondBid) hanterade bara rule '1NT (12–14)', inte 1NT-reserv-
//    fallet 'oklart' → NMF-maskineriet nåddes aldrig, live-lagret improviserade
//    2♥ och den framtvingade 3♣:an passades. 8-korts hjärterfit (♥AT62+KJ47)
//    begravd i 3♣ med 27 hp (DD 6♥; ärligt mot visade intervall = 4♥).
// 2) Frö 20260878 — öppnaren rebjöd 1NT[oklart] med SINGEL i partnerns färg
//    (1=4=3=5 efter 1♣–1♠) fast 5-korts klöver fanns att rebjuda: 1NT ljuger
//    om formen. Nu: 5-korts egen färg + singel/renons i svararens färg →
//    rebjud färgen (2♣), inte 1NT.
// =============================================================================

describe('frö 20261317 – kravet passas inte, hjärterfiten hittas', () => {
  it('slutkontraktet är 4♥ (via NMF på oklart-1NT:an)', () => {
    const calls = botAuction(dealFromSeed(20261317))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBe(4)
    expect(contract!.strain).toBe('hearts')
  })

  it("unit: 'oklart'-1NT:an routas som 1NT-återbud → NMF 2♦", () => {
    const r = responderSecondBid(
      '1C',
      { call: '1S', rule: 'ny färg (1-läget)', explanation: '' },
      { call: '1NT', rule: 'oklart', explanation: '' },
      parseHand('S:AQ8652 H:AT62 D:KQ C:3'),
    )
    expect(r).not.toBeNull()
    expect(r!.call).toBe('2D')
    expect(r!.rule).toBe('New Minor Forcing')
  })
})

describe('frö 20260878 – öppnaren rebjuder färgen, inte en skev 1NT', () => {
  it('unit: 1=4=3=5 efter 1♣–1♠ → 2♣ (5-korts färg + singel i partnerns färg)', () => {
    const r = openerRebidAfter1LevelResponse(parseHand('S:5 H:AQ63 D:QJ8 C:QJT75'), 'clubs', 'spades')
    expect(r.call).toBe('2C')
  })

  it('unit: balanserad hand med dubbelton i partnerns färg rebjuder 1NT som förr', () => {
    const r = openerRebidAfter1LevelResponse(parseHand('S:53 H:AQ63 D:QJ8 C:QT75'), 'clubs', 'spades')
    expect(r.call).toBe('1NT')
  })
})
