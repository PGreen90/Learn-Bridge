import { describe, expect, it } from 'vitest'
import type { Major, ResponseResult } from './responses'
import { parseHand } from '../bidding'
import type { Suit } from '../../types/bridge'
import { responderRebidAfterSemiForcing1NT, responderRebidColorAuction, responderRebidIn1NTAuction } from './responder-rebids'

function r10(notation: string, M: Major, call: string, rule: string): string {
  const rebid: ResponseResult = { call, rule, explanation: '' }
  return responderRebidAfterSemiForcing1NT(parseHand(notation), M, rebid)?.call ?? 'null'
}

function r11(notation: string, respRule: string, respCall: string, rebidCall: string, rebidRule = ''): string {
  const response: ResponseResult = { call: respCall, rule: respRule, explanation: '' }
  const rebid: ResponseResult = { call: rebidCall, rule: rebidRule, explanation: '' }
  return responderRebidIn1NTAuction(response, rebid, parseHand(notation))?.call ?? 'null'
}

function r12(notation: string, opened: Suit, responderSuit: Suit, rebidCall: string, rebidRule: string): string {
  const rebid: ResponseResult = { call: rebidCall, rule: rebidRule, explanation: '' }
  return responderRebidColorAuction(parseHand(notation), opened, responderSuit, rebid)?.call ?? 'null'
}

describe('punkt 10 – svararens andra bud efter semi-forcing 1NT', () => {
  it('pass på öppnarens utgång', () => {
    expect(r10('S:KJ742 H:3 D:Q842 C:J52', 'hearts', '4H', 'rebid: utgång')).toBe('P')
  })

  it('öppnaren rebjuder 2♥, svag → pass (preferens)', () => {
    expect(r10('S:KJ742 H:3 D:Q842 C:J52', 'hearts', '2H', 'rebid: egen färg')).toBe('P') // 5 hp
  })

  it('öppnaren rebjuder 2♥, 3-korts limithöjning → 3♥', () => {
    expect(r10('S:KJ4 H:Q72 D:KQ52 C:J52', 'hearts', '2H', 'rebid: egen färg')).toBe('3H') // 12 hp, 3 stöd
  })

  it('öppnaren bjuder 2NT (18–19) → 3NT med värden', () => {
    expect(r10('S:KJ4 H:72 D:Q852 C:J852', 'hearts', '2NT', 'rebid: 2NT (18–19)')).toBe('3NT') // 7 hp
  })

  it('öppnaren bjuder ny minor 2♣ – stöd, svag → pass', () => {
    expect(r10('S:KJ4 H:7 D:Q852 C:J8642', 'hearts', '2C', 'rebid: ny färg')).toBe('P') // 5 hp, 5 klöver
  })

  it('öppnaren bjuder ny minor 2♦ – preferens till högfärgen', () => {
    expect(r10('S:Q842 H:K7 D:73 C:J8642', 'hearts', '2D', 'rebid: ny färg')).toBe('2H') // 6 hp, 2 hjärter
  })

  it('hoppskift (GF) utan fit → 3NT', () => {
    expect(r10('S:KJ4 H:7 D:Q852 C:J8642', 'hearts', '3C', 'rebid: hoppskift')).toBe('3NT')
  })
})

describe('punkt 11 – svararens andra bud i 1NT-auktioner', () => {
  it('Smolen: 5 spader + 4 hjärter, GF → 3♥', () => {
    expect(r11('S:KQ842 H:AJ85 D:3 C:Q42', 'Stayman', '2C', '2D')).toBe('3H') // 12 hp
  })

  it('Smolen: 5 hjärter + 4 spader, GF → 3♠', () => {
    expect(r11('S:AJ85 H:KQ842 D:3 C:Q42', 'Stayman', '2C', '2D')).toBe('3S') // 12 hp
  })

  it('Stayman, öppnaren förnekar högfärg, inbjudan → 2NT', () => {
    expect(r11('S:KQ85 H:972 D:K42 C:J52', 'Stayman', '2C', '2D')).toBe('2NT') // 9 hp
  })

  it('Stayman, fit i öppnarens hjärter, GF → 4♥', () => {
    expect(r11('S:K2 H:KQ85 D:A852 C:952', 'Stayman', '2C', '2H')).toBe('4H') // 12 hp, 4 stöd
  })

  it('Stayman, ingen fit (4 spader, öppnaren bjöd hjärter), GF → 3NT', () => {
    expect(r11('S:KQ85 H:72 D:KJ42 C:Q52', 'Stayman', '2C', '2H')).toBe('3NT') // 11 hp
  })

  it('Jacoby fullföljd, svag → pass', () => {
    expect(r11('S:73 H:KQ862 D:9742 C:52', 'Jacoby-transfer', '2D', '2H')).toBe('P') // 5 hp
  })

  it('Jacoby fullföljd, 6-korts inbjudan → 3♥', () => {
    expect(r11('S:7 H:KQ8642 D:K42 C:952', 'Jacoby-transfer', '2D', '2H')).toBe('3H') // 8 hp
  })

  it('Jacoby fullföljd, 6-korts utgång → 4♥', () => {
    expect(r11('S:7 H:KQ8642 D:KQ2 C:952', 'Jacoby-transfer', '2D', '2H')).toBe('4H') // 10 hp
  })

  it('Jacoby superaccept → 4♥', () => {
    expect(r11('S:73 H:KQ862 D:9742 C:52', 'Jacoby-transfer', '2D', '3H', 'superaccept')).toBe('4H')
  })

  it('Texas – öppnaren fullföljde → pass', () => {
    expect(r11('S:7 H:KQ8642 D:KQ2 C:952', 'Texas', '4D', '4H')).toBe('P')
  })
})

describe('punkt 12 – svararens andra bud i färgauktioner (fjärde färg krav)', () => {
  it('fjärde färg krav: 1♦–1♠–2♣, GF utan stopp i hjärter → 2♥', () => {
    expect(r12('S:AK85 H:432 D:Q52 C:K53', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('2H') // 13 hp
  })

  it('3NT i stället för fjärde färg när fjärde färgen är stoppad', () => {
    expect(r12('S:AK85 H:KJ2 D:Q52 C:K53', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('3NT') // stopp i hjärter
  })

  it('fit i öppnarens andra färg → höjning', () => {
    expect(r12('S:AK85 H:32 D:52 C:KQ842', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('3C') // 5 klöver
  })

  it('egen 6-korts färg → rebjuder den', () => {
    expect(r12('S:3 H:KQ8642 D:K52 C:Q42', 'diamonds', 'hearts', '1S', 'ny färg (1-läget)')).toBe('2H') // 6 hjärter
  })

  it('öppnaren höjde svararens högfärg (enkel) – utgångsstyrka → 4♥', () => {
    expect(r12('S:K3 H:KQ842 D:AQ2 C:952', 'clubs', 'hearts', '2H', 'enkel höjning')).toBe('4H') // 14 hp
  })

  it('öppnaren höjde svararens högfärg – inbjudningsstyrka → 3♥', () => {
    expect(r12('S:KJ3 H:KQ842 D:Q5 C:952', 'clubs', 'hearts', '2H', 'enkel höjning')).toBe('3H') // 11 hp
  })

  it('öppnaren rebjöd 1NT (12–14) – game → 3NT', () => {
    expect(r12('S:K3 H:AQ842 D:KJ2 C:Q52', 'clubs', 'hearts', '1NT', '1NT (12–14)')).toBe('3NT') // 15 hp
  })

  it('öppnaren rebjöd sin färg, svag preferens → pass', () => {
    expect(r12('S:KQ842 H:3 D:K72 C:9542', 'diamonds', 'spades', '2D', 'rebjuden färg')).toBe('P') // 8 hp, 3 ruter
  })
})
