// FACIT FÖRE FIX — felrapport #94 (2026-09-30, bricka 4): svararen HOPPADE TILL
// UTGÅNG i egen färg efter öppnarens hoppskift fast slammen låg på bordet.
// Väst giv, alla i zon:
//
//   Väst   Nord   Öst    Syd
//   1♦     pass   1♥     pass
//   3♣     pass   4♥     pass
//   pass   pass                → 4♥, 13 stick.
//
// Öst ♠K54 ♥AKQJT973 ♦Q ♣7 (15 hp, åtta hjärter). Hoppskiftet visar 19+ och
// utgångskrav; 15 + 19 = 34 = slamzon (kaptensregeln ≥33 driv), men svararens
// enda bud efter hoppskiftet var placeringar (4♥ = "6+ hjärter, till spel").
// Ägaren 2026-09-30: "4NT RKC direkt — det spelar ingen roll vilken färg vi
// frågar i med dessa poäng. När Öst vet att partnern har 19+ ska hen tänka
// 'kan vi spela 7NT, vad saknas?' Ställ essfrågan och hitta rätt slam."

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const TOM = 'S:- H:- D:- C:-'
const RAPPORT: Deal = { id: 't', board: 4, dealer: 'W', vulnerability: 'all',
  hands: { N: parseHand('S:Q83 H:4 D:T9763 C:QT84'), E: parseHand('S:K54 H:AKQJT973 D:Q C:7'), S: parseHand('S:J962 H:8652 D:82 C:KJ3'), W: parseHand('S:AT7 H:- D:AKJ54 C:A9652') } } as Deal
const ost = (E: string, bud = '1D P 1H P 3C P') =>
  decideCall({ id: 't', board: 4, dealer: 'W', vulnerability: 'all', hands: { N: parseHand(TOM), E: parseHand(E), S: parseHand(TOM), W: parseHand(TOM) } } as Deal, H('W', bud), 'E')

describe('felrapport #94 – svararen med lång egen färg efter öppnarens hoppskift', () => {
  it('rapportens Öst (15 hp, åtta hjärter) → 4NT RKC, inte 4♥', () => {
    expect(ost('S:K54 H:AKQJT973 D:Q C:7').bid).toBe('4NT')
  })
  // Ägarbeslut 2026-10-02: "4NT gäller alltid den senast ÄKTA bjudna färgen" —
  // här klöver (hoppskiftet), för frågaren OCH svararen. Öst räknar därför svaret
  // i klöver, som Väst gav det: 5♦ = 3 (uteslutningsmetoden) + eget hjärteress =
  // fyra av de fem nyckelkorten (♠A ♥A ♦A ♣A ♣K). Vilket som saknas — ett ess
  // eller klöverkungen — går inte att veta → lillslam i egen färg, inte storslam.
  // Förr räknade Öst i hjärter (eget ess + kung = 2, plus 3 = "alla fem") och
  // bjöd 7♥ på ett svar som aldrig lovat det (samma fel gav 7♠ med ♠KQ ute på
  // frö 20437408).
  it('hela auktionen landar i 6♥ — svaret räknas i klöver (senast äkta bjudna färg), kontraktet läggs i hjärter', () => {
    const h: ResolvedCall[] = []
    let guard = 0
    while (!auctionComplete(h) && guard++ < 40) h.push(decideCall(RAPPORT, h, seatToAct(RAPPORT.dealer, h.length)))
    expect(h.filter((c) => c.bid !== 'P').map((c) => c.bid)).toEqual(['1D', '1H', '3C', '4NT', '5D', '6H'])
    const k = contractFromCalls(h)!
    expect(k.strain).toBe('hearts')
    expect(k.level).toBe(6)
  })
  it('essfrågan säger själv vilken färg den räknas i (klöver) och var kontraktet läggs (hjärter)', () => {
    const c = ost('S:K54 H:AKQJT973 D:Q C:7')
    expect(c.explanation).toMatch(/♣ som trumf/)
    expect(c.explanation).toMatch(/placeras i ♥/)
  })
  it('sex hjärter men bara 9 hp (28 mot visade 19) → ingen essfråga, 4♥ som förr', () => {
    expect(ost('S:854 H:AQJT97 D:Q6 C:73').bid).toBe('4H')
  })
  it('16 hp med sex hjärter (35) → 4NT', () => {
    expect(ost('S:K54 H:AKJT97 D:Q6 C:K7').bid).toBe('4NT')
  })
})
