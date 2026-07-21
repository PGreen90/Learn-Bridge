// FACIT-TEST för fel färg-spåret FIX 2 (docs/systemrevisorn.md, buggfamilj 2):
// 2♣-kravets minimi-steg väljer inte finaste färgen.
//
// Två delfel ur Systemrevisorns baslinje (frö 20260721):
//   (a) Frö 20260958: efter 2♣–2♦–3♣ bjöd svararen 3NT på 0–1 hp UTAN att visa
//       sina 4-korts högfärger → 3NT från FEL hand, 4 bet (−400), fast 4♥
//       (4-4-fiten) bara går en bet (−100). Svararen ska visa billigaste
//       4-korts högfärg under 3NT — då höjer öppnaren med fit, och utan fit
//       spelas sang från den STARKA handen.
//   (b) Frö 20260737: efter 2♣–2♦–3♣–3♠–4♣ höjde svararen till 5♣ på DUBBELTON
//       (öppnarens tvingade klöver-ombud lovar bara 5+) i stället för att
//       rebjuda sin egna 6-korts spader → 5♣ en bet, fast 4♠+1 = par (650).
//       Med egen visad 6-korts färg och bara dubbelton "fit" rebjuds färgen.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'
import { decideCall } from './auction-live'
import { responderSecondBidAfter2C } from './responses-2c'
import type { ResponseResult } from './responses'

function deal(
  id: string,
  dealer: Deal['dealer'],
  vulnerability: Deal['vulnerability'],
  hands: Record<'N' | 'E' | 'S' | 'W', string>,
): Deal {
  return {
    id,
    board: 1,
    dealer,
    vulnerability,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

const r = (call: string, rule: string): ResponseResult => ({ call, rule, explanation: '' })
const second = (notation: string, rebid: ResponseResult) =>
  responderSecondBidAfter2C(parseHand(notation), r('2D', '2♦ väntebud'), rebid)?.call
const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('svararens andra bud efter 2♣–2♦–3m: visa 4-korts högfärg före 3NT', () => {
  it('4-4 i högfärgerna → 3♥ (billigast, upp längs linjen), inte 3NT', () => {
    // Frö 20260958-svararen: 1 hp, ♠JT75 ♥8754 — båda högfärgerna 4-korts.
    expect(second('S:JT75 H:8754 D:T4 C:532', r('3C', 'rebid: krav-färg'))).toBe('3H')
  })

  it('bara 4-korts spader → 3♠, inte 3NT', () => {
    expect(second('S:JT75 H:854 D:T42 C:532', r('3C', 'rebid: krav-färg'))).toBe('3S')
  })

  it('4-korts högfärg visas även över 3♦-rebud', () => {
    expect(second('S:JT75 H:854 D:T42 C:532', r('3D', 'rebid: krav-färg'))).toBe('3S')
  })

  it('utan 4-korts högfärg → fortsatt 3NT', () => {
    expect(second('S:JT7 H:854 D:T842 C:532', r('3C', 'rebid: krav-färg'))).toBe('3NT')
  })
})

describe('höj inte partnerns tvingade ombud på dubbelton med egen visad 6-korts färg', () => {
  it('frö 20260737-läget: efter 2♣–2♦–3♣–3♠–4♣ rebjuder svararen 4♠, inte 5♣', () => {
    const d = deal('felfarg-20260737-pos', 'E', 'ew', {
      N: 'S:T873 H:JT84 D:Q4 C:632',
      E: 'S:A H:AQ95 D:A96 C:AKJT4',
      S: 'S:J6 H:K762 D:KJ82 C:Q97',
      W: 'S:KQ9542 H:3 D:T753 C:85',
    })
    const history: ResolvedCall[] = [
      call('E', '2C'), call('S', 'P'), call('W', '2D'), call('N', 'P'),
      call('E', '3C'), call('S', 'P'), call('W', '3S'), call('N', 'P'),
      call('E', '4C'), call('S', 'P'),
    ]
    expect(decideCall(d, history, 'W').bid).toBe('4S')
  })
})

describe('hela auktionen (Systemrevisorns frön, motorn bjuder alla fyra)', () => {
  it('frö 20260958: svararen visar hjärtern → 4♥ (en bet), inte 3NT från fel hand (fyra bet)', () => {
    const d = deal('felfarg-20260958', 'W', 'ew', {
      N: 'S:Q9842 H:A63 D:K862 C:Q',
      E: 'S:AK H:KQT2 D:Q C:AJT974',
      S: 'S:63 H:J9 D:AJ9753 C:K86',
      W: 'S:JT75 H:8754 D:T4 C:532',
    })
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const bids = history!.map((c) => c.bid)
    expect(bids).toContain('3H')
    expect(contractFromCalls(history!)).toMatchObject({ level: 4, strain: 'hearts' })
  })

  it('frö 20260737: svararen rebjuder spadern → 4♠ står (par 650), inte 5♣ bet', () => {
    const d = deal('felfarg-20260737', 'E', 'ew', {
      N: 'S:T873 H:JT84 D:Q4 C:632',
      E: 'S:A H:AQ95 D:A96 C:AKJT4',
      S: 'S:J6 H:K762 D:KJ82 C:Q97',
      W: 'S:KQ9542 H:3 D:T753 C:85',
    })
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const bids = history!.map((c) => c.bid)
    expect(bids).not.toContain('5C')
    expect(contractFromCalls(history!)).toMatchObject({ level: 4, strain: 'spades' })
  })
})
