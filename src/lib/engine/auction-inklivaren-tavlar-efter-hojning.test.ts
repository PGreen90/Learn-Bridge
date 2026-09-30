// FACIT FÖRE FIX — felrapport #93 (2026-09-30, bricka 2): inklivaren PASSADE när
// öppnaren bjöd vidare efter partnerns höjning. Öst giv, NS i zon:
//
//   Öst    Syd    Väst   Nord
//   1♣     1♥     2♣     2♥
//   2♠     ?
//
// Syd ♠KT73 ♥KQ7632 ♦K6 ♣A (15 hp, sex hjärter). Regeln "inklivaren efter
// partnerns enkla höjning" (#85/#86) kräver att höjningen är sista budet; med
// öppnarens 2♠ emellan fanns ingen rad → pass. Ägaren: "det tydligaste är att
// Syd inte får passa … detta är ett 3♥-bud oavsett" (2026-09-30).
//
// Regeln: partnerns höjning lovar 3+ stöd → med sexkorts inklivsfärg (nio trumf
// ihop) tävlar inklivaren 3M (lagen om totala stick, ej krav); 18+ totalpoäng →
// 4M; femkorts under 18 → pass (åtta trumf räcker inte till 3-läget).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const TOM = 'S:- H:- D:- C:-'
const giv = (S: string): Deal =>
  ({ id: 't', board: 2, dealer: 'E', vulnerability: 'ns',
    hands: { N: parseHand(TOM), E: parseHand(TOM), S: parseHand(S), W: parseHand(TOM) } } as Deal)
const RULE = 'inklivaren tävlar till fiten (lagen om totala stick)'

describe('felrapport #93 – inklivaren när öppnaren bjuder vidare efter partnerns höjning', () => {
  const hist = H('E', '1C 1H 2C 2H 2S')
  it('rapportens Syd (15 hp, sex hjärter) → 3♥, inte pass', () => {
    expect(decideCall(giv('S:KT73 H:KQ7632 D:K6 C:A'), hist, 'S')).toMatchObject({ bid: '3H', rule: RULE })
  })
  it('sex hjärter med bara 6 hp → 3♥ ändå (nio trumf)', () => {
    expect(decideCall(giv('S:T73 H:KQ7632 D:96 C:J4'), hist, 'S')).toMatchObject({ bid: '3H', rule: RULE })
  })
  it('fem hjärter, 12 hp → pass (åtta trumf, under 18)', () => {
    expect(decideCall(giv('S:KT7 H:KQ763 D:K62 C:J4'), hist, 'S')).toMatchObject({ bid: 'P' })
  })
  it('18+ totalpoäng → 4♥', () => {
    expect(decideCall(giv('S:KT7 H:AKQ763 D:K6 C:A4'), hist, 'S')).toMatchObject({ bid: '4H', rule: 'inklivaren till utgång' })
  })
  it('öppnaren rebjuder 3♣ i stället: sex hjärter → 3♥', () => {
    expect(decideCall(giv('S:KT73 H:KQ7632 D:K6 C:A'), H('E', '1C 1H 2C 2H 3C'), 'S')).toMatchObject({ bid: '3H', rule: RULE })
  })
  it('deras bud ligger över 3♥ (3♠): sex hjärter utan utgångsvärden → pass', () => {
    expect(decideCall(giv('S:T73 H:KQ7632 D:96 C:J4'), H('E', '1C 1H 2C 2H 3S'), 'S')).toMatchObject({ bid: 'P' })
  })
})
