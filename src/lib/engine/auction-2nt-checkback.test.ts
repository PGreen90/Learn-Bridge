import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { openerAnswer2NTCheckback, openerAnswer2NTMajorSeek } from './rebids'
import { responderRebidColorAuction } from './responder-rebids'
import { botAuction } from './revisor'

// =============================================================================
// CHECKBACK EFTER NATURLIGT 2NT-ÅTERBUD (1x–1y–2NT, öppnaren 18–19 bal).
// Facit FÖRE fix (systems-on-2nt-rebid-plan, ägaren godkänd 2026-08-18).
//
// Problemet: efter 1x–1♥–2NT bjöd svararen BLINT 3NT (responderRebidColorAuction
// case '2NT (18–19)' → return 3NT) och missade 5-3- och 4-4-högfärgsfitar.
//
// VERKLIGHETEN (verifierad mot motorn): efter ett 1♥-svar visar öppnaren en
// 4-korts spader BILLIGT med 1♠, så 2NT nekar BÅDA högfärgerna → ingen dold 4-4
// efter 1♥. Den enda dolda 4-korts högfärgen är HJÄRTER som öppnaren inte kunde
// visa efter ett 1♠-svar (2♥ vore reverse). Därför:
//   (a) öppnarens 3-stöd för svararens 5-korts högfärg (5-3)      → direkt 3♥/3♠.
//   (b) öppnarens dolda 4-korts hjärter efter 1♠-svar (4-4)       → 3♣ checkback.
// Ägarbeslut 2026-08-18: UNDVIK 4-3 (svararen lovar 5+ i sin färg → 5-3, ej 4-3).
// =============================================================================

const rebid2NT = { call: '2NT', rule: '2NT (18–19)', explanation: '' }

describe('svararens beslut efter 1x–1y–2NT', () => {
  it('1♠-svar med 5+ spader + 4 hjärter → 3♣ checkback (jagar dold hjärter)', () => {
    const r = responderRebidColorAuction(parseHand('S:KJT43 H:KJ96 D:85 C:83'), 'clubs', 'spades', rebid2NT)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('3C')
  })

  it('egen 5-korts hjärter → direkt 3♥ (söker 5-3)', () => {
    const r = responderRebidColorAuction(parseHand('S:74 H:KQT96 D:A83 C:J65'), 'clubs', 'hearts', rebid2NT)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('3H')
  })

  it('1♥-svar med 4-4 → 3NT (öppnaren hade bjudit 1♠ med 4 spader → ingen dold 4-4)', () => {
    const r = responderRebidColorAuction(parseHand('S:KJ54 H:AQ96 D:854 C:83'), 'clubs', 'hearts', rebid2NT)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('3NT')
  })

  it('bara 4-korts hjärter, ingen andra högfärg → placering 3NT (oförändrat)', () => {
    const r = responderRebidColorAuction(parseHand('S:J5 H:KJ32 D:A94 C:QT87'), 'clubs', 'hearts', rebid2NT)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('3NT')
  })

  it('1♠-svar med 6 spader utan 4 hjärter → direkt 3♠ (5-3), ej checkback', () => {
    const r = responderRebidColorAuction(parseHand('S:KJT943 H:K9 D:854 C:83'), 'clubs', 'spades', rebid2NT)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('3S')
  })
})

describe('öppnarens svar på 3♣ checkback (svararen 5+ spader + 4 hjärter)', () => {
  it('dold 4-korts hjärter → visar den (3♥, 4-4)', () => {
    const r = openerAnswer2NTCheckback(parseHand('S:Q5 H:AQT8 D:AJ6 C:KQT2'), 'spades')
    expect(r.call).toBe('3H')
  })

  it('ingen 4 hjärter men 3-stöd i spader → 3♠ (5-3)', () => {
    const r = openerAnswer2NTCheckback(parseHand('S:Q54 H:A5 D:AJ86 C:KQT2'), 'spades')
    expect(r.call).toBe('3S')
  })

  it('varken 4 hjärter eller 3-stöd i spader → 3NT', () => {
    const r = openerAnswer2NTCheckback(parseHand('S:Q5 H:A5 D:AJ863 C:KQT2'), 'spades')
    expect(r.call).toBe('3NT')
  })
})

describe('öppnarens svar på direkt 3♥ (5-3-jakt)', () => {
  it('3-korts stöd i svararens hjärter → 4♥', () => {
    const r = openerAnswer2NTMajorSeek(parseHand('S:KQ6 H:A85 D:KJ4 C:AQ92'), 'hearts')
    expect(r.call).toBe('4H')
  })

  it('bara 2-korts hjärter → 3NT (ingen 5-3)', () => {
    const r = openerAnswer2NTMajorSeek(parseHand('S:KQ6 H:A5 D:KJ84 C:AQ92'), 'hearts')
    expect(r.call).toBe('3NT')
  })
})

describe('kanoniska linjen: checkback hittar 4-4-hjärterfit', () => {
  // 1♣–1♠–2NT–3♣–3♥–4♥. Öppnaren 18 bal med dold 4-korts hjärter (kunde ej
  // visas billigt efter 1♠ = reverse), svararen 8 hp med 5♠+4♥. Motståndarna döda.
  const deal: Deal = {
    id: '2nt-checkback-44',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: {
      N: parseHand('S:Q5 H:AQT8 D:AJ6 C:KQT2'),
      E: parseHand('S:A862 H:75 D:K942 C:J76'),
      S: parseHand('S:KJT43 H:KJ96 D:85 C:83'),
      W: parseHand('S:97 H:432 D:QT73 C:A954'),
    },
  }

  it('svararen checkbackar 3♣, öppnaren visar 3♥, bordet landar i 4♥', () => {
    const calls = botAuction(deal)!
    const bids = calls.map((c) => c.bid)
    expect(bids).toContain('3C')
    expect(bids).toContain('3H')
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.strain).toBe('hearts')
    expect(contract!.level).toBe(4)
  })
})

describe('kanoniska linjen: direkt 3♥ hittar 5-3-hjärterfit', () => {
  // 1♣–1♥–2NT–3♥–4♥. Öppnaren 19 bal med dold 3-korts hjärter,
  // svararen 10 hp med 5-korts hjärter. Motståndarna döda.
  const deal: Deal = {
    id: '2nt-checkback-53',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: {
      N: parseHand('S:KQ6 H:A85 D:KJ4 C:AQ92'),
      E: parseHand('S:A853 H:J74 D:Q97 C:T83'),
      S: parseHand('S:74 H:KQT96 D:A83 C:J65'),
      W: parseHand('S:JT92 H:32 D:T652 C:K74'),
    },
  }

  it('svararen bjuder 3♥, öppnaren höjer 4♥ (5-3-fit)', () => {
    const calls = botAuction(deal)!
    const bids = calls.map((c) => c.bid)
    expect(bids).toContain('3H')
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.strain).toBe('hearts')
    expect(contract!.level).toBe(4)
  })
})
