import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { respondTo2C, openerRebidAfter2C, responderSecondBidAfter2C } from './responses-2c'
import { buildAuction } from './auction'
import type { ResponseResult } from './responses'
import type { Deal } from '../../types/bridge'

const resp = (notation: string) => respondTo2C(parseHand(notation)).call

/** Bygger ett minimalt svar/återbud för dispatch-grenarna. */
const r = (call: string, rule: string): ResponseResult => ({ call, rule, explanation: '' })

describe('respondTo2C – svararens första svar (2♦ väntebud)', () => {
  it('2♦ väntebud med svag hand (0–7)', () => {
    expect(resp('S:9532 H:K63 D:9742 C:Q3')).toBe('2D') // 5 hp
  })

  it('positivt 2♥ med 8+ och 5-korts hjärter', () => {
    expect(resp('S:K3 H:KQ764 D:842 C:953')).toBe('2H') // 8 hp
  })

  it('positivt 2♠ med 8+ och 5-korts spader', () => {
    expect(resp('S:KQ764 H:K3 D:842 C:953')).toBe('2S') // 8 hp
  })

  it('positivt 3♣ med 8+ och 5-korts klöver', () => {
    expect(resp('S:K3 H:842 D:953 C:KQ764')).toBe('3C') // 8 hp
  })

  it('positivt 3♦ med 8+ och 5-korts ruter', () => {
    expect(resp('S:K3 H:842 D:KQ764 C:953')).toBe('3D') // 8 hp
  })

  it('positivt 2NT med 8+ balanserad utan 5-korts färg', () => {
    expect(resp('S:KJ32 H:Q84 D:KJ3 C:842')).toBe('2NT') // 10 hp, 4-3-3-3
  })

  it('längsta färgen visas vid val (6-korts före 5-korts)', () => {
    expect(resp('S:842 H:KQ7642 D:A3 C:95')).toBe('2H') // 9 hp, 6 hjärter
  })
})

describe('openerRebidAfter2C – öppnarens återbud', () => {
  const open = (notation: string, response: ResponseResult) => openerRebidAfter2C(parseHand(notation), response).call

  it('2NT efter 2♦ med balanserad 22–24', () => {
    expect(open('S:AKQ4 H:AKQ D:AJ3 C:432', r('2D', '2♦ väntebud'))).toBe('2NT') // 23 hp, 4-3-3-3
  })

  it('3NT efter 2♦ med balanserad 28+', () => {
    expect(open('S:AKQ4 H:AKQ D:AK3 C:A32', r('2D', '2♦ väntebud'))).toBe('3NT') // 29 hp
  })

  it('krav-färg efter 2♦ med obalanserad jätte', () => {
    expect(open('S:AKQJ98 H:AKQ D:A2 C:43', r('2D', '2♦ väntebud'))).toBe('2S') // 23 hp, 6 spader
  })

  it('höjer svararens positiva färg med stöd (GF)', () => {
    expect(open('S:AK32 H:AK4 D:AKQ C:432', r('2H', '2♣-positivt'))).toBe('3H') // 23 hp, 3 stöd
  })
})

describe('responderSecondBidAfter2C – svararens andra bud', () => {
  const second = (notation: string, rebid: ResponseResult) =>
    responderSecondBidAfter2C(parseHand(notation), r('2D', '2♦ väntebud'), rebid)?.call

  it('andra negativa (3♣) med riktig bottenhand efter krav-högfärg', () => {
    // 2♣ – 2♦ – 2♠ (krav) – 3♣ (0–3, andra negativa). Bokens exempel.
    expect(second('S:Q73 H:9842 D:7532 C:64', r('2S', 'rebid: krav-färg'))).toBe('3C') // 2 hp
  })

  it('höjer öppnarens högfärg till utgång med stöd (ej bottenhand)', () => {
    expect(second('S:K84 H:9842 D:K532 C:64', r('2S', 'rebid: krav-färg'))).toBe('4S') // 6 hp, 3 stöd
  })

  it('returnerar null efter 2NT-återbud (NT-grenen tas senare)', () => {
    expect(second('S:Q73 H:9842 D:7532 C:64', r('2NT', 'rebid: 2NT (22–24)'))).toBeUndefined()
  })
})

describe('buildAuction – 2♣ end-to-end (inkoppling)', () => {
  it('bygger 2♣ – 2♦ – 2NT när öppnaren är balanserad jätte och svararen svag', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:AKQ4 H:AKQ D:AJ3 C:432'), // 23 hp balanserad → 2♣
        S: parseHand('S:9532 H:K63 D:9742 C:Q3'), //  5 hp → 2♦ väntebud
        E: parseHand('S:J876 H:J52 D:865 C:J98'),
        W: parseHand('S:T H:T9874 D:KQT C:T765'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['2C', '2D', '2NT'])
    expect(a?.openerSeat).toBe('N')
    expect(a?.responderSeat).toBe('S')
  })
})
