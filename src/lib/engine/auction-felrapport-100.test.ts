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
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const RAPPORT: Deal = { id: 't', board: 7, dealer: 'S', vulnerability: 'all', hands: {
  N: parseHand('S:QJ72 H:QJT5 D:64 C:AJT'), E: parseHand('S:8543 H:32 D:J8532 C:93'),
  S: parseHand('S:A96 H:A76 D:K C:Q87654'), W: parseHand('S:KT H:K984 D:AQT97 C:K2') } } as Deal

// ÄGARBESLUT 2026-10-31 (uppföljning av felrapport #107): mot öppnarens MINIMUM-
// återbud ställs stoppfrågan/3NT på RENA hp — ozon 13+, zon 14+ — och 5m kräver
// 16+. Rapportens Nord (11 hp, alla i zon) frågar därför inte längre utan höjer
// enkelt till 3♣ (tävlande). Principen ur #100 — ALDRIG 3NT utan stopp i deras
// färg, fråga med cuen — låses nedan med en Nord på 14 hp (♠KQ72 ♥KJT5 ♦64 ♣AJT;
// Väst ♠JT ♥Q984 ♦AQT97 ♣K2 ger ♠K/♥K och får ♠J/♥Q). Hp räknade med kod.
const NORD14 = 'S:KQ72 H:KJT5 D:64 C:AJT'
const VAST12 = 'S:JT H:Q984 D:AQT97 C:K2'
const STARK: Deal = { ...RAPPORT, hands: { ...RAPPORT.hands, N: parseHand(NORD14), W: parseHand(VAST12) } } as Deal
const hpSumma = (d: Deal) => ORDER.reduce((a, s) => a + hcp(d.hands[s]), 0)

describe('felrapport #100 – 3NT kräver stopp i deras färg även med fit i partnerns lågfärg', () => {
  it('händerna summerar till 40 hp (rapporten och 14-hp-varianten)', () => {
    expect(hpSumma(RAPPORT)).toBe(40)
    expect(hpSumma(STARK)).toBe(40)
    expect(hcp(RAPPORT.hands.N)).toBe(11)
    expect(hcp(STARK.hands.N)).toBe(14)
  })
  it('Nord 14 hp (♦64, klöverfit) i zon → cue 2♦ (frågar efter stopp), aldrig 3NT', () => {
    const c = decideCall(STARK, H('S', '1C 1D X P 2C P'), 'N')
    expect(c.bid).toBe('2D')
    expect(c.explanation).toMatch(/stopp/)
  })
  it('samma Nord med ♦K4 i stället för ♦64 (ruter 6→K med Syd) → 3NT som förr', () => {
    const d = { ...STARK, hands: { ...STARK.hands, N: parseHand('S:KQ72 H:KJT5 D:K4 C:AJT'), S: parseHand('S:A96 H:A76 D:6 C:Q87654') } } as Deal
    expect(hpSumma(d)).toBe(40)
    expect(decideCall(d, H('S', '1C 1D X P 2C P'), 'N').bid).toBe('3NT')
  })
  it('rapportens Nord (11 hp, zon) frågar inte längre: enkel höjning 3♣ (ägarbeslut 2026-10-31)', () => {
    const c = decideCall(RAPPORT, H('S', '1C 1D X P 2C P'), 'N')
    expect(c.bid).toBe('3C')
    expect(c.explanation).toMatch(/enkel höjning/)
  })
  it('hela auktionen landar aldrig i 3NT av Nord — 14-hp-Nord: cuen ställs en gång, partnern nekar (3♣), pass', () => {
    const h: ResolvedCall[] = []
    let guard = 0
    while (!auctionComplete(h) && guard++ < 30) h.push(decideCall(STARK, h, seatToAct(STARK.dealer, h.length)))
    const k = contractFromCalls(h)!
    expect(h.map((c) => c.bid)).not.toContain('3NT')
    // Partnern nekar stopp (3♣) → pass på 3♣ (14 < 16: 5♣ utom räckhåll), ingen ny cue.
    expect(h.filter((c) => c.bid !== 'P').map((c) => c.bid)).toEqual(['1C', '1D', 'X', '2C', '2D', '3C'])
    expect(k.strain).toBe('clubs')
    expect(k.level).toBe(3)
  })
})
