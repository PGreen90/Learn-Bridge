import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { respondToMajorPassed, openerRebidAfterDrury, responderAnswerDrury } from './responses-drury'
import type { ResponseResult } from './responses'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

const d = (notation: string, opened: 'hearts' | 'spades') =>
  respondToMajorPassed(parseHand(notation), opened)

describe('respondToMajorPassed – Drury (passad hand)', () => {
  it('2♣ med limithöjning och exakt 3 trumf', () => {
    expect(d('S:K43 H:Q84 D:KJ95 C:Q43', 'hearts').call).toBe('2C') // 11 hp, 3 hjärter
  })

  it('2♦ med limithöjning och 4+ trumf', () => {
    expect(d('S:K4 H:Q842 D:KJ95 C:Q43', 'hearts').call).toBe('2D') // 11 hp, 4 hjärter
  })

  it('för svag för Drury → vanligt svar (Bergen 3♣)', () => {
    expect(d('S:43 H:Q842 D:K975 C:K43', 'hearts').call).toBe('3C') // 8 hp, 4 stöd → Bergen konstruktiv
  })

  it('för stark hp men passad → fortfarande Drury i limitläget', () => {
    expect(d('S:AQ4 H:Q842 D:KJ5 C:432', 'hearts').call).toBe('2D') // 12 hp, 4 stöd
  })
})

describe('openerRebidAfterDrury – öppnarens återbud', () => {
  it('lätt öppning → 2♥ signoff', () => {
    expect(openerRebidAfterDrury(parseHand('S:K5 H:AK962 D:Q43 C:432'), 'hearts').call).toBe('2H') // 12 hp
  })

  it('måttlig öppning → 3♥ utgångsförsök', () => {
    expect(openerRebidAfterDrury(parseHand('S:K3 H:AKJ62 D:Q43 C:432'), 'hearts').call).toBe('3H') // 13 hp
  })

  it('riktig öppning → 4♥ utgång', () => {
    expect(openerRebidAfterDrury(parseHand('S:AQ H:AKJ62 D:KQ3 C:432'), 'hearts').call).toBe('4H') // 16 hp
  })
})

describe('responderAnswerDrury – svararens placering efter Drury-återbud (FAS 9)', () => {
  const invite: ResponseResult = { call: '3H', rule: 'Drury: utgångsförsök', explanation: '' }
  const signoff: ResponseResult = { call: '2H', rule: 'Drury: lätt öppning', explanation: '' }
  const game: ResponseResult = { call: '4H', rule: 'Drury: riktig öppning', explanation: '' }

  it('accepterar utgångsförsök (3♥ → 4♥) med stödpoäng ≥ 11', () => {
    // 11 hp, 4 trumf + dubbelton spader → stödpoäng lyfter över 11.
    expect(responderAnswerDrury(parseHand('S:K4 H:Q842 D:KJ95 C:Q43'), 'hearts', invite).call).toBe('4H')
  })

  it('avböjer utgångsförsök (3♥ → pass) med botten av intervallet', () => {
    // 10 hp, 4 trumf, platt 4-3-3-3 (ingen korthet) → stödpoäng 10 < 11 → pass.
    expect(responderAnswerDrury(parseHand('S:K43 H:Q842 D:K52 C:Q43'), 'hearts', invite).call).toBe('P')
  })

  it('passar öppnarens signoff (2♥)', () => {
    expect(responderAnswerDrury(parseHand('S:K43 H:Q842 D:K52 C:Q43'), 'hearts', signoff).call).toBe('P')
  })

  it('passar öppnarens utgång (4♥)', () => {
    expect(responderAnswerDrury(parseHand('S:K4 H:Q842 D:KJ95 C:Q43'), 'hearts', game).call).toBe('P')
  })
})

describe('buildAuction – Drury end-to-end (passad hand)', () => {
  it('bygger 1♥ – 2♣ – 2♥ (passad limithöjning mot lätt öppning)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K43 H:Q84 D:KJ95 C:Q43'), // 11 hp, passar som given, 3 hjärter
        E: parseHand('S:Q876 H:53 D:Q76 C:JT98'), // passar
        S: parseHand('S:K5 H:AK962 D:Q43 C:432'), // 12 hp, öppnar 1♥ i 3:e hand
        W: parseHand('S:QJ9 H:JT7 D:JT82 C:Q92'), // 7 hp, ingen 5-färg → passar (ostört)
      },
    }
    const a = buildAuction(deal)
    // Svararen passar signoffen → kontraktet 2♥ är fast (FAS 9).
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '2C', '2H', 'P'])
  })

  it('bygger 1♥ – 2♦ – 3♥ – 4♥ (måttlig öppning inbjuder, toppen accepterar)', () => {
    const deal: Deal = {
      id: 'test',
      board: 3,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K4 H:Q842 D:KJ95 C:Q43'), // 11 hp, 4 hjärter, dubbelton → topp av limithöjningen, passar som given
        E: parseHand('S:QJT98 H:975 D:87 C:AK2'), // 10 hp, ingen 5-korts högfärg att öppna → passar
        S: parseHand('S:A3 H:AKJT6 D:Q43 C:765'), // 14 hp, öppnar 1♥ i 3:e hand → utgångsförsök 3♥
        W: parseHand('S:7652 H:3 D:AT62 C:JT98'), // 5 hp → passar (ostört)
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '2D', '3H', '4H'])
  })

  it('i 1:a hand (ej passad) gäller vanligt svar, inte Drury', () => {
    const deal: Deal = {
      id: 'test',
      board: 2,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K5 H:AK962 D:Q43 C:432'), // öppnar 1♥ direkt (1:a hand)
        E: parseHand('S:Q876 H:53 D:Q76 C:JT98'),
        S: parseHand('S:K43 H:Q84 D:KJ95 C:Q43'), // 11 hp, 3 stöd – partner ej passad
        W: parseHand('S:AJT92 H:JT7 D:T82 C:K5'),
      },
    }
    const a = buildAuction(deal)
    // Ej Drury: 11 hp med 3 stöd → semi-forcing 1NT (vanligt schema)
    expect(a?.turns[1].call).toBe('1NT')
  })
})
