// FACIT FÖRE FIX — felrapport #88 (2026-09-28, bricka 7): öppnaren TEG när fjärde
// hand bjöd vidare över partnerns negativa dubbling. Syd giv, alla i zon:
//
//   Väst   Nord   Öst    Syd
//                        pass
//   1♦     2♣     X      3♣
//   pass   pass   3♦     pass  (pass pass)  → 3♦, fast 5♦ (och 4♥) står.
//
// Väst ♠T ♥AK96 ♦AT742 ♣953 (11 hp) passade 3♣ — inget läge i tabellen tog
// hand om "partnerns X är obesvarat men de bjöd emellan". Ägarens struktur:
// dubblingen ber om ett svar, och tiga kan bli dyrt ("nästan som att passa på en
// högfärgsfråga eller överföring"). I ordning: (1) objuden 4-korts högfärg →
// bjud den; (2) annars egen 5+ färg → rebjud den; (3) annars X — visa din hand.
// Bara på 3-läget eller lägre. Öst höjer sedan 3♥ till 4♥ (4-4 + renons).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const TOM = 'S:- H:- D:- C:-'
const giv = (hands: Partial<Record<Seat, string>>): Deal =>
  ({ id: 't', board: 7, dealer: 'S', vulnerability: 'all',
    hands: { N: parseHand(hands.N ?? TOM), E: parseHand(hands.E ?? TOM), S: parseHand(hands.S ?? TOM), W: parseHand(hands.W ?? TOM) } } as Deal)
const RAPPORT = { N: 'S:Q743 H:Q8 D:J3 C:AKQJ6', E: 'S:A865 H:T754 D:KQ985 C:-', S: 'S:KJ92 H:J32 D:6 C:T8742', W: 'S:T H:AK96 D:AT742 C:953' }

describe('felrapport #88 – öppnaren svarar på den negativa dubblingen trots deras höjning', () => {
  const hist = H('S', 'P 1D 2C X 3C')
  it('rapportens Väst (4-korts hjärter) → 3♥, inte pass', () => {
    expect(decideCall(giv(RAPPORT), hist, 'W')).toMatchObject({ bid: '3H', rule: 'svar på negativ dubbling' })
  })
  it('ingen fjärde högfärg men 5+ ruter → 3♦', () => {
    expect(decideCall(giv({ W: 'S:T3 H:AK9 D:AT742 C:953' }), hist, 'W')).toMatchObject({ bid: '3D', rule: 'svar på negativ dubbling' })
  })
  it('varken högfärg eller 5-korts öppningsfärg → X (visa din hand)', () => {
    expect(decideCall(giv({ W: 'S:KT3 H:AK9 D:AT74 C:953' }), hist, 'W')).toMatchObject({ bid: 'X', rule: 'öppnarens dubbling (visa din hand)' })
  })
  it('deras bud på 4-läget → ingen tvingad svarsplikt (raden avstår, de vanliga reglerna dömer)', () => {
    const r = decideCall(giv(RAPPORT), H('S', 'P 1D 2C X 4C'), 'W')
    expect(r.rule).not.toBe('svar på negativ dubbling')
  })
  it('Öst höjer Västs 3♥ till 4♥ (4-4-fit, renons i deras färg)', () => {
    expect(decideCall(giv(RAPPORT), H('S', 'P 1D 2C X 3C 3H P'), 'E').bid).toBe('4H')
  })
  it('läsaren: Västs 3♥ = svar på negativ dubbling (4+, kan vara minimum), X = visa din hand', () => {
    const h3 = H('S', 'P 1D 2C X 3C 3H')
    expect(meaningOf(h3, h3.length - 1).rule).toBe('svar på negativ dubbling')
    const hx = H('S', 'P 1D 2C X 3C X')
    expect(meaningOf(hx, hx.length - 1).rule).toBe('öppnarens dubbling (visa din hand)')
  })
})

describe('felrapport #88 – negativ-dubblaren visar sin hand på öppnarens X (aldrig utgångsblås)', () => {
  // Frö 20261090 (FIX 6 mönster 1): N 1♣, E 1♥, S X, W 1♠ — N svarar nu X i
  // stället för pass. S (♠Q986 ♥9 ♦AQ52 ♣QT62, 10 hp) höjer 2♣, blåser inte 5♣.
  const g = giv({ N: 'S:A54 H:K753 D:J83 C:A84', E: 'S:KJ H:AJT86 D:T76 C:J53', S: 'S:Q986 H:9 D:AQ52 C:QT62', W: 'S:T732 H:Q42 D:K94 C:K97' })
  const hist = H('N', '1C 1H X 1S X P')
  it('öppnaren utan högfärg/5-korts färg → X (visa din hand)', () => {
    expect(decideCall(g, H('N', '1C 1H X 1S'), 'N')).toMatchObject({ bid: 'X', rule: 'öppnarens dubbling (visa din hand)' })
  })
  it('4-korts stöd, 10 hp → billigaste höjning 2♣', () => {
    expect(decideCall(g, hist, 'S')).toMatchObject({ bid: '2C', rule: 'visar handen efter öppnarens dubbling' })
  })
  it('egen 5-korts objuden färg → 2♦', () => {
    expect(decideCall(giv({ S: 'S:Q986 H:9 D:AQ752 C:Q62' }), hist, 'S')).toMatchObject({ bid: '2D' })
  })
  it('stopp i båda deras färger, inget annat → 1NT', () => {
    expect(decideCall(giv({ S: 'S:KJ9 H:KJ9 D:Q752 C:J62' }), hist, 'S')).toMatchObject({ bid: '1NT' })
  })
  it('bricka 7: Öst (5-korts stöd, 9 hp) höjer 3♦ på Västs X — inte 5♦', () => {
    expect(decideCall(giv(RAPPORT), H('S', 'P 1D 2C X 3C X P'), 'E')).toMatchObject({ bid: '3D' })
  })
})
