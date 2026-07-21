// FACIT-TEST för fel färg-spåret FIX 3 (docs/systemrevisorn.md, buggfamilj 3):
// cue-höjning i minor → 5m fast 3NT var säkert.
//
// Systemrevisorns frön 20260805 och 20260769 (baslinjen, frö 20260721): efter
// partnerns cue-höjning av vår minoröppning svarade öppnaren ALLTID med
// minimiåtergång i färgen (3m), även med jämn hand OCH stopp i motståndarnas
// färg — och cue-bjudaren utan eget stopp blåste sedan 5m (en/två bet), fast
// 3NT från ÖPPNARENS sida var hemma (9 stick, 600). Fixen: öppnaren med jämn
// hand + stopp i deras färg föreslår 3NT direkt; minimiåtergången 3m betyder
// då ärligt "inget stopp/ojämn hand", så cue-bjudarens 5m blir ett informerat
// val. Högfärgsfit rörs inte (4M är rätt utgång där).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'
import { decideCall } from './auction-live'

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

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

// Frö 20260805: N öppnar 1♦, E kliver in 2♣, S cue-höjer 3♣ — N (öppnaren) svarar.
const HANDS_805 = {
  N: 'S:AK5 H:QT43 D:Q876 C:K2',
  E: 'S:Q4 H:A752 D:T C:AT8654',
  S: 'S:T8 H:KJ9 D:AJ542 C:J93',
  W: 'S:J97632 H:86 D:K93 C:Q7',
}
const HISTORY_805: ResolvedCall[] = [
  call('N', '1D'), call('E', '2C'), call('S', '3C'), call('W', 'P'),
]

// Frö 20260769: S öppnar 1♣, W kliver in 1♦, N cue-höjer 2♦ — S (öppnaren) svarar.
const HANDS_769 = {
  N: 'S:AQ4 H:A42 D:J864 C:Q95',
  E: 'S:J63 H:T8765 D:Q7 C:743',
  S: 'S:875 H:KQJ3 D:KT C:KT82',
  W: 'S:KT92 H:9 D:A9532 C:AJ6',
}
const HISTORY_769: ResolvedCall[] = [
  call('E', 'P'), call('S', '1C'), call('W', '1D'), call('N', '2D'), call('E', 'P'),
]

describe('öppnarens svar på cue-höjning i minor: 3NT med jämn hand + stopp i deras färg', () => {
  it('frö 20260805-läget: N (14 hp jämn, ♣K2 = stopp) svarar 3NT, inte 3♦', () => {
    const d = deal('felfarg-20260805-pos', 'N', 'all', HANDS_805)
    expect(decideCall(d, HISTORY_805, 'N').bid).toBe('3NT')
  })

  it('frö 20260769-läget: S (12 hp jämn, ♦KT = stopp) svarar 3NT, inte 3♣', () => {
    const d = deal('felfarg-20260769-pos', 'E', 'all', HANDS_769)
    expect(decideCall(d, HISTORY_769, 'S').bid).toBe('3NT')
  })

  it('utan stopp i deras färg → fortsatt minimiåtergång 3♦', () => {
    // Samma läge som 20260805 men ♣K flyttad till spader: ♣32 stoppar inget.
    const d = deal('cueraise-utan-stopp', 'N', 'all', {
      ...HANDS_805,
      N: 'S:AKQ H:QT43 D:Q876 C:32',
    })
    expect(decideCall(d, HISTORY_805, 'N').bid).toBe('3D')
  })

  it('även maximum (15+) med jämn hand + stopp väljer 3NT, inte 5♦', () => {
    const d = deal('cueraise-max-3nt', 'N', 'all', {
      ...HANDS_805,
      N: 'S:AKQ H:QT43 D:Q876 C:K2',
    })
    expect(decideCall(d, HISTORY_805, 'N').bid).toBe('3NT')
  })
})

describe('hela auktionen (Systemrevisorns frön, motorn bjuder alla fyra)', () => {
  it('frö 20260805: 1♦–(2♣)–3♣(cue) → 3NT står (600), inte 5♦ två bet', () => {
    const d = deal('felfarg-20260805', 'N', 'all', HANDS_805)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(history!.map((c) => c.bid)).not.toContain('5D')
    expect(contractFromCalls(history!)).toMatchObject({ level: 3, strain: 'NT', declarer: 'N' })
  })

  it('frö 20260769: 1♣–(1♦)–2♦(cue) → 3NT står (600), inte 5♣ en bet', () => {
    const d = deal('felfarg-20260769', 'E', 'all', HANDS_769)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(history!.map((c) => c.bid)).not.toContain('5C')
    expect(contractFromCalls(history!)).toMatchObject({ level: 3, strain: 'NT', declarer: 'S' })
  })
})
