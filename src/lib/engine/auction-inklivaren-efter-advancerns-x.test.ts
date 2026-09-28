// FACIT FÖRE FIX — felrapport #90 (2026-09-28, bricka 8): inklivaren SATT KVAR
// på partnerns dubbling med renons i deras färg. Väst giv, ingen i zon:
//
//   Väst   Nord   Öst    Syd
//   2♦     2♥     3♦     X
//   pass   pass   pass         → 3♦ X av Väst.
//
// Nord ♠Q84 ♥KQJ8762 ♦— ♣Q97 (10 hp, sju hjärter, renons i ruter) passade Syds
// dubbling — raden inkliv2 kräver att vår sida inte dubblat, så ingen regel
// fanns och Nord föll till pass. Ägaren: "Nord får inte passa 3♦ X, med så lång
// hjärter och noll ruter måste han bjuda hjärter". Dubblingen är kooperativ
// (värden, partnern väljer): kort i deras färg eller 6+ egen färg → rebjud
// färgen, utgång med 7+ (eller 6+ och 11+ hp); med 2+ i deras färg och högst
// fem egna sitter inklivaren kvar (straff).

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
const giv = (N: string): Deal =>
  ({ id: 't', board: 8, dealer: 'W', vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(TOM), S: parseHand(TOM), W: parseHand(TOM) } } as Deal)
const hist = H('W', '2D 2H 3D X P')

describe('felrapport #90 – inklivaren efter partnerns dubbling av deras höjning', () => {
  it('rapportens Nord (sju hjärter, renons i ruter) → 4♥, inte pass', () => {
    expect(decideCall(giv('S:Q84 H:KQJ8762 D:- C:Q97'), hist, 'N')).toMatchObject({ bid: '4H', rule: 'inklivaren drar ur partnerns dubbling' })
  })
  it('sex hjärter och singel ruter, 8 hp → 3♥ (drar ur billigast)', () => {
    expect(decideCall(giv('S:Q84 H:KJ8762 D:5 C:Q97'), hist, 'N')).toMatchObject({ bid: '3H', rule: 'inklivaren drar ur partnerns dubbling' })
  })
  it('sex hjärter och 12 hp → 4♥', () => {
    expect(decideCall(giv('S:A84 H:KQJ876 D:5 C:Q97'), hist, 'N')).toMatchObject({ bid: '4H' })
  })
  it('fem hjärter och tre ruter → sitter kvar (straff)', () => {
    expect(decideCall(giv('S:Q84 H:KQJ87 D:T62 C:Q9'), hist, 'N')).toMatchObject({ bid: 'P', rule: 'inklivaren sitter kvar på partnerns dubbling' })
  })
})
