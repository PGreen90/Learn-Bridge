// FACIT FÖRE FIX — felrapport #100 (2026-10-06, bricka 7): 3NT UTAN STOPP I
// DERAS FÄRG. Syd giv, alla i zon:
//
//   Syd    Väst   Nord   Öst
//   1♣     1♦     X      pass
//   2♣     pass   3NT ?
//
// Nord ♠QJ72 ♥QJT5 ♦64 ♣AJT (11 hp, 13 stödpoäng med klöverfiten). Ägaren:
// "Nord bjuder 3NT och lovar stopp i motståndarens färg. Det har hen inte.
// Otillåtet bud!" Fit-höjningens minorgren gav 3NT på "balanserad + utgångs-
// värden" utan att titta på deras färg. Nu: 3NT kräver stopp i varje färg de
// bjudit; utan stopp → cue i deras färg (partnern bjuder 3NT med stopp, annars
// färg — samma struktur som negativ-dubblarens cue), sist 5m.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const RAPPORT: Deal = { id: 't', board: 7, dealer: 'S', vulnerability: 'all', hands: {
  N: parseHand('S:QJ72 H:QJT5 D:64 C:AJT'), E: parseHand('S:8543 H:32 D:J8532 C:93'),
  S: parseHand('S:A96 H:A76 D:K C:Q87654'), W: parseHand('S:KT H:K984 D:AQT97 C:K2') } } as Deal

describe('felrapport #100 – 3NT kräver stopp i deras färg även med fit i partnerns lågfärg', () => {
  it('rapportens Nord (♦64, klöverfit, 13 stödpoäng) → cue 2♦ (frågar efter stopp), aldrig 3NT', () => {
    const c = decideCall(RAPPORT, H('S', '1C 1D X P 2C P'), 'N')
    expect(c.bid).toBe('2D')
    expect(c.explanation).toMatch(/stopp/)
  })
  it('samma Nord med ♦K4 i stället för ♦64 (♣AJT → ♣AJ6, ruter 6→K) → 3NT som förr', () => {
    const d = { ...RAPPORT, hands: { ...RAPPORT.hands, N: parseHand('S:QJ72 H:QJT5 D:K4 C:AJT'), S: parseHand('S:A96 H:A76 D:6 C:Q87654') } } as Deal
    expect(decideCall(d, H('S', '1C 1D X P 2C P'), 'N').bid).toBe('3NT')
  })
  it('hela auktionen landar aldrig i 3NT av Nord', () => {
    const h: ResolvedCall[] = []
    let guard = 0
    while (!auctionComplete(h) && guard++ < 30) h.push(decideCall(RAPPORT, h, seatToAct(RAPPORT.dealer, h.length)))
    const k = contractFromCalls(h)!
    expect(h.map((c) => c.bid)).not.toContain('3NT')
    // Cuen ställs en gång; partnern nekar stopp (3♣) → minorutgången, ingen ny cue.
    expect(h.filter((c) => c.bid !== 'P').map((c) => c.bid)).toEqual(['1C', '1D', 'X', '2C', '2D', '3C', '5C'])
    expect(k.strain).toBe('clubs')
    expect(k.level).toBe(5)
  })
})
