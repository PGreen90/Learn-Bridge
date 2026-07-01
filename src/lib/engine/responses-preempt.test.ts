import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { respondToPreempt, openerRebidAfterPreemptNewSuit } from './responses-preempt'
import { buildAuction } from './auction'
import type { Deal, Suit } from '../../types/bridge'

const resp = (notation: string, opened: Suit, level: number) =>
  respondToPreempt(parseHand(notation), opened, level).call

describe('respondToPreempt – svararens svar på spärr', () => {
  it('pass på 4-läget (slamverktyg tas senare)', () => {
    expect(resp('S:AKQ2 H:AK3 D:A32 C:432', 'spades', 4)).toBe('P')
  })

  it('pass med svag hand på 3-läget', () => {
    expect(resp('S:K84 H:Q73 D:K842 C:J96', 'spades', 3)).toBe('P') // 9 hp
  })

  // FAS 7 (ägarbeslut 2026-07-01): svag hand med 4-korts stöd PRESSAR inte till
  // utgång – höjer bara med utgångsvärden. En svag stödhand passar (ej 4♥).
  it('svag hand (8 hp) med 4-korts stöd → pass (ingen presshöjning)', () => {
    expect(resp('S:K84 H:Q762 D:K84 C:962', 'hearts', 3)).toBe('P') // 8 hp, 4 hjärter
  })

  it('höjning till utgång med stark fit (16+)', () => {
    expect(resp('S:A4 H:AKQ2 D:KQ32 C:542', 'spades', 3)).toBe('4S') // 18 hp, 2 stöd
  })

  it('utgång ändå med lång fit och 13–15', () => {
    expect(resp('S:K842 H:KQJ D:KQ2 C:543', 'spades', 3)).toBe('4S') // 14 hp, 4 stöd
  })

  it('ny färg (krav) med egen stark 5+ färg utan fit', () => {
    expect(resp('S:2 H:AKQ84 D:KQ32 C:K43', 'spades', 3)).toBe('4H') // 17 hp, 5 hjärter
  })

  it('3NT till spel med stopp i sidofärgerna (minorspärr)', () => {
    expect(resp('S:AQ4 H:KQ3 D:KQ42 C:432', 'clubs', 3)).toBe('3NT') // 16 hp
  })
})

describe('openerRebidAfterPreemptNewSuit – öppnarens återbud', () => {
  it('passar när stöd och utgång redan nådd (3♠–4♥)', () => {
    expect(openerRebidAfterPreemptNewSuit(parseHand('S:KQJ9742 H:K84 D:5 C:32'), 'spades', 'hearts').call).toBe('P')
  })

  it('sätter utgång i svararens färg med stöd under utgång (3♣–3♥)', () => {
    expect(openerRebidAfterPreemptNewSuit(parseHand('S:4 H:K84 D:52 C:KQJ9764'), 'clubs', 'hearts').call).toBe('4H')
  })

  it('rebjuder egen färg utan stöd (3♠–4♥ → 4♠)', () => {
    expect(openerRebidAfterPreemptNewSuit(parseHand('S:KQJ9764 H:5 D:K32 C:42'), 'spades', 'hearts').call).toBe('4S')
  })

  // FAS 7 punkt 31: maximum spärr UTAN stöd visar en yttre A/K ("feature", §4.6).
  describe('feature-visning (maximum utan stöd)', () => {
    it('3♣–3♥ – max med spaderkung → 3♠ (feature upp-the-line)', () => {
      // 3♣ (7 klöver), svararen 3♥ krav. Öppnaren max (11 hp) med ♠K + ♦A → 3♠.
      expect(openerRebidAfterPreemptNewSuit(parseHand('S:K5 H:82 D:A2 C:KJ97642'), 'clubs', 'hearts').call).toBe('3S')
    })
    it('minimum (6 hp) med sidohonnör → rebjuder egen färg (feature kräver max)', () => {
      // 3♣–3♥, minimum (6 hp) trots ♠K → 4♣ (rebjuden färg, ryms under 5♣).
      expect(openerRebidAfterPreemptNewSuit(parseHand('S:K2 H:8 D:832 C:QJ97642'), 'clubs', 'hearts').call).toBe('4C')
    })
    it('max men bara låg-rankad sidohonnör (dyr feature) → rebjuder egen färg', () => {
      // 3♥–3♠, max med ♦K men ruter lägre rankad än spader (skulle kräva 4♦) → 4♥.
      expect(openerRebidAfterPreemptNewSuit(parseHand('S:52 H:KQJ9874 D:K3 C:52'), 'hearts', 'spades').call).toBe('4H')
    })
  })
})

describe('buildAuction – spärr end-to-end (inkoppling)', () => {
  it('bygger 3♠ – 4♠ – P (stark fit höjer till utgång)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:KQJ9764 H:5 D:543 C:42'), //  6 hp, 7 spader → 3♠
        S: parseHand('S:A8 H:AKQ2 D:KQ2 C:K432'), // 21 hp, 2 stöd → 4♠
        E: parseHand('S:T2 H:8743 D:876 C:765'),
        W: parseHand('S:53 H:JT96 D:AJT9 C:AQ8'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['3S', '4S', 'P'])
  })
})
