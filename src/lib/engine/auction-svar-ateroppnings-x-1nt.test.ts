// FACIT FÖRE FIX — felrapport #92 (2026-09-29, bricka 10): svararen PASSADE
// 1NT-öppnarens återöppningsdubbling. Öst giv, alla i zon:
//
//   Öst    Syd    Väst   Nord
//   pass   1NT    2♦     pass
//   pass   X      pass   pass
//   pass                        → 2♦ X av Väst, hemma.
//
// Nord ♠84 ♥J95 ♦K5 ♣J98542 (5 hp, sex klöver, två ruter) satt kvar. Ägaren:
// "Efter min dubbling måste partner bjuda sin längsta färg. OM hen inte har en
// bra ruter och värden för straff."
//
// Två fel i ett:
//  (1) Vid bordet bär människans avvikande bud etiketten 'eget bud' — och
//      betydelselagret läste etiketten som en REGEL utan kravnivå i stället för
//      att härleda budets betydelse ur auktionen. Partnern såg därför inget
//      krav och passade. Gäller ALLA egna bud, inte bara det här läget.
//  (2) Svaret på 1NT-öppnarens återöppningsdubbling saknade egen regel (§7.5).

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
const giv = (N: string): Deal =>
  ({ id: 't', board: 10, dealer: 'E', vulnerability: 'all',
    hands: { N: parseHand(N), E: parseHand(TOM), S: parseHand(TOM), W: parseHand(TOM) } } as Deal)
const hist = H('E', 'P 1NT 2D P P X P')
// Som vid bordet: Syds X avviker från motorns pass → märks 'eget bud' (useGame.onBid).
const vidBordet = hist.map((c, i) => (i === 5 ? { ...c, rule: 'eget bud', explanation: 'Eget bud. Återöppningsdubbling.' } : c))
const RAPPORT = 'S:84 H:J95 D:K5 C:J98542'

describe('felrapport #92 – människans egna bud tolkas ur auktionen', () => {
  it("etiketten 'eget bud' härleds som ett omärkt bud (samma regel och kravnivå)", () => {
    const utan = meaningOf(hist, 5)
    const med = meaningOf(vidBordet, 5)
    expect(utan.forcing).toBe('krav-1-rond')
    expect(med.forcing).toBe(utan.forcing)
    expect(med.rule).toBe(utan.rule)
    expect(med.källa).toBe('härledd')
  })
})

describe('felrapport #92 – svaret på 1NT-öppnarens återöppningsdubbling', () => {
  it('rapportens Nord (sex klöver, K5 i ruter) → 3♣, inte pass — även med bordets etikett', () => {
    expect(decideCall(giv(RAPPORT), vidBordet, 'N')).toMatchObject({ bid: '3C', rule: 'svar på återöppningsdubbling' })
    expect(decideCall(giv(RAPPORT), hist, 'N')).toMatchObject({ bid: '3C', rule: 'svar på återöppningsdubbling' })
  })
  it('fyra ruter med KJ → straffpass', () => {
    expect(decideCall(giv('S:84 H:J95 D:KJ95 C:J985'), vidBordet, 'N')).toMatchObject({ bid: 'P', rule: 'straffpass (återöppningsdubbling)' })
  })
  it('fyra hackor i ruter är ingen straff → längsta färg', () => {
    expect(decideCall(giv('S:T64 H:94 D:6532 C:K954'), vidBordet, 'N')).toMatchObject({ bid: '3C', rule: 'svar på återöppningsdubbling' })
  })
  it('lika långa färger → högfärgen före lågfärgen', () => {
    expect(decideCall(giv('S:J842 H:95 D:K53 C:J985'), vidBordet, 'N')).toMatchObject({ bid: '2S', rule: 'svar på återöppningsdubbling' })
  })
})
