import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { respondToMajorPassed, openerRebidAfterDrury } from './responses-drury'
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
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '2C', '2H'])
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
