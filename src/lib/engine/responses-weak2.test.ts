import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import {
  respondToWeakTwo,
  openerRebidAfterOgust,
  openerRebidAfterNewSuit,
  responderPlaceAfterOgust,
} from './responses-weak2'
import { buildAuction } from './auction'
import type { ResponseResult } from './responses'
import type { Deal, Suit } from '../../types/bridge'

const resp = (notation: string, opened: Suit) => respondToWeakTwo(parseHand(notation), opened).call
const r = (call: string, rule: string): ResponseResult => ({ call, rule, explanation: '' })

describe('respondToWeakTwo – svararens första svar', () => {
  it('pass med svag hand utan fit', () => {
    expect(resp('S:KQ52 H:7 D:K842 C:9863', 'hearts')).toBe('P') // 8 hp, 1 stöd
  })

  it('spärrhöjning (3♥) med stöd och svag hand', () => {
    expect(resp('S:74 H:K84 D:98532 C:986', 'hearts')).toBe('3H') // 3 hp, 3 stöd
  })

  it('2NT Ogust med fit och utgångsintresse (11+)', () => {
    expect(resp('S:AQ2 H:K84 D:KJ32 C:742', 'hearts')).toBe('2NT') // 13 hp, 3 stöd
  })

  it('ny färg (krav) med egen 5+ färg utan fit', () => {
    expect(resp('S:AKQ84 H:2 D:KJ32 C:742', 'hearts')).toBe('2S') // 13 hp, 5 spader
  })

  it('3NT till spel med balanserad 15+ utan fit', () => {
    expect(resp('S:AQ4 H:K2 D:KQ32 C:KQ32', 'hearts')).toBe('3NT') // 19 hp, 4-4-3-2
  })
})

describe('openerRebidAfterOgust – Ogust-svar i steg', () => {
  const og = (notation: string, opened: Suit) => openerRebidAfterOgust(parseHand(notation), opened).call

  it('3♣ = minimum, dålig färg', () => {
    expect(og('S:5 H:QJ9842 D:K72 C:863', 'hearts')).toBe('3C') // 6 hp, 1 topp (Q)
  })
  it('3♦ = minimum, bra färg', () => {
    expect(og('S:5 H:AQ9842 D:872 C:863', 'hearts')).toBe('3D') // 6 hp, 2 toppar (A,Q)
  })
  it('3♥ = maximum, dålig färg', () => {
    expect(og('S:K5 H:KJ9842 D:Q72 C:86', 'hearts')).toBe('3H') // 9 hp, 1 topp (K)
  })
  it('3♠ = maximum, bra färg', () => {
    expect(og('S:5 H:AK9842 D:Q72 C:863', 'hearts')).toBe('3S') // 9 hp, 2 toppar (A,K)
  })
  it('3NT = maximum, utmärkt färg', () => {
    expect(og('S:5 H:AKQ842 D:872 C:863', 'hearts')).toBe('3NT') // 9 hp, 3 toppar (A,K,Q)
  })
})

describe('openerRebidAfterNewSuit – svar på krav-ny-färg', () => {
  it('höjer svararens färg med stöd (min = ett steg)', () => {
    // 2♥ – 2♠ – 3♠ (stöd, minimum).
    expect(openerRebidAfterNewSuit(parseHand('S:K84 H:QJ9842 D:7 C:863'), 'hearts', 'spades').call).toBe('3S')
  })
  it('rebjuder egen färg utan stöd', () => {
    expect(openerRebidAfterNewSuit(parseHand('S:5 H:QJ9842 D:K72 C:863'), 'hearts', 'spades').call).toBe('3H')
  })
})

describe('responderPlaceAfterOgust – svararen placerar', () => {
  const hand = parseHand('S:AQ2 H:K84 D:KJ32 C:742') // 13 hp, 3 stöd
  it('utgång (4♥) mittemot maximum', () => {
    expect(responderPlaceAfterOgust(hand, 'hearts', r('3S', 'Ogust: max/bra'))?.call).toBe('4H')
  })
  it('signoff (3♥) mittemot minimum', () => {
    expect(responderPlaceAfterOgust(hand, 'hearts', r('3C', 'Ogust: min/dålig'))?.call).toBe('3H')
  })
})

describe('buildAuction – svag tvåa end-to-end (inkoppling)', () => {
  it('bygger 2♥ – 2NT – 3♠ – 4♥ (Ogust → max → utgång)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:5 H:AK9842 D:Q72 C:863'), // 9 hp, 6 hjärter → 2♥ (svag tvåa), Ogust-svar 3♠
        S: parseHand('S:AQ2 H:K84 D:KJ32 C:742'), // 13 hp, 3 stöd → 2NT Ogust, sen 4♥
        E: parseHand('S:J876 H:J5 D:865 C:J954'),
        W: parseHand('S:KT93 H:Q73 D:AT4 C:KQ2'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['2H', '2NT', '3S', '4H'])
  })
})
