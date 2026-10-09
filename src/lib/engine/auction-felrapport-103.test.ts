// FACIT FÖRE FIX — felrapport #103 (2026-10-08, bricka 12): 4♥ PÅ EN 4-3-FIT
// EFTER FJÄRDE FÄRG. Väst giv, NS i zon:
//
//   Väst   Nord   Öst    Syd
//   pass   1♣     pass   1♥
//   pass   1♠     pass   2♦ (fjärde färg, krav)
//   pass   2♥     pass   ?
//
// Syd ♠Q74 ♥AQ65 ♦Q2 ♣AQ54 (16 hp). Öppnarens 2♥ = 3-korts stöd (§6.6 prioritet
// 1; med fyra hade hen höjt 1♥ direkt). Budhjälpen föreslog 4♥: raden "fjärde
// färg: utgång i fit" bjöd 4M så fort öppnaren stödde, utan att titta på egen
// längd. Ägaren: "Fyra hjärter är inte rätt bud här. Vi är inte säkra på att
// partner har 4 hjärter. Därför behöver vi bjuda sang, två sang, tre sang bör
// tolkas olika." Ägarbeslut 2026-10-09: (1) fyra kort mot tre → 3NT direkt med
// vanlig utgångshand, 4M bara med 5+ kort; (2) alternativ A: 3NT = till spel,
// 2NT = krav med slamintresse (18+) — öppnaren bjuder 3NT med minimum (12–14)
// och 4NT med maximum (15–17), svararen placerar 6NT på 33+; (3) 18+ → 2NT.
// Hp räknade med kod (hcp/parseHand): N 12 · E 10 · S 16 · W 2 = 40.

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
const RAPPORT: Deal = { id: 'fr103', board: 12, dealer: 'W', vulnerability: 'ns', hands: {
  N: parseHand('S:KJ85 H:K94 D:A84 C:J96'), E: parseHand('S:AT96 H:87 D:K963 C:K82'),
  S: parseHand('S:Q74 H:AQ65 D:Q2 C:AQ54'), W: parseHand('S:32 H:JT32 D:JT75 C:T73') } }
const medSyd = (s: string): Deal => ({ ...RAPPORT, hands: { ...RAPPORT.hands, S: parseHand(s) } })
/** Nord byts; Öst/Väst får resten av leken (5 hp ihop — de passar). */
const medNord = (d: Deal, n: string): Deal => {
  const N = parseHand(n)
  const tagna = new Set([...N, ...d.hands.S].map((c) => `${c.suit}${c.rank}`))
  const rest = (['spades', 'hearts', 'diamonds', 'clubs'] as const).flatMap((suit) =>
    (['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const).map((rank) => ({ suit, rank })).filter((c) => !tagna.has(`${c.suit}${c.rank}`)))
  return { ...d, hands: { ...d.hands, N, E: rest.filter((_, i) => i % 2 === 0), W: rest.filter((_, i) => i % 2 === 1) } }
}
// Nord maximum: ♠KJ85 ♥KJ4 ♦K ♣KJ963 (15 hp, 4-3-1-5 → 1♣, 1♠, 2♥ med tre hjärter).
const NORD_MAX = 'S:KJ85 H:KJ4 D:K C:KJ963'
const FORE = 'P 1C P 1H P 1S P 2D P 2H P'
const hela = (d: Deal): string[] => {
  const h: ResolvedCall[] = []
  let guard = 0
  while (!auctionComplete(h) && guard++ < 30) h.push(decideCall(d, h, seatToAct(d.dealer, h.length)))
  return h.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
}

describe('felrapport #103 – fjärde färg + öppnarens 3-korts stöd: fyra kort räcker inte för 4M', () => {
  it('rapportens Syd (♥AQ65, 16 hp) → 3NT, aldrig 4♥', () => {
    const c = decideCall(RAPPORT, H('W', FORE), 'S')
    expect(c.bid).toBe('3NT')
    expect(c.explanation).toMatch(/fyra kort/)
  })
  it('typhänder med fyra kort under 18: 3NT även utan ruterstopp', () => {
    expect(decideCall(medSyd('S:K4 H:AQ65 D:Q32 C:K954'), H('W', FORE), 'S').bid).toBe('3NT') // 14 hp
    expect(decideCall(medSyd('S:K4 H:AQ65 D:432 C:AK95'), H('W', FORE), 'S').bid).toBe('3NT') // 16 hp, inget ruterstopp
  })
  it('fem kort i högfärgen → 4♥ som förut', () => {
    expect(decideCall(medSyd('S:K4 H:AQ652 D:Q32 C:K95'), H('W', FORE), 'S')).toMatchObject({ bid: '4H', rule: 'fjärde färg: utgång i fit' })
  })
  it('18+ med fyra kort → 2NT (krav, slamintresse)', () => {
    const c = decideCall(medSyd('S:AQ4 H:AQ65 D:Q2 C:AQ54'), H('W', FORE), 'S') // 20 hp
    expect(c.bid).toBe('2NT')
    expect(c.explanation).toMatch(/slamintresse/)
  })
  it('öppnaren efter 2NT: minimum (rapportens Nord, 12 hp) → 3NT; maximum (15 hp) → 4NT', () => {
    const d20 = medSyd('S:AQ4 H:AQ65 D:Q2 C:AQ54')
    expect(decideCall(d20, H('W', `${FORE} 2NT P`), 'N').bid).toBe('3NT')
    const dMax = medNord(d20, NORD_MAX)
    expect(hcp(dMax.hands.N)).toBe(15)
    expect(decideCall(dMax, H('W', `${FORE} 2NT P`), 'N').bid).toBe('4NT')
  })
  // 2026-10-09 (Gerber överallt): 20 + visade 12 = 32 → kvantitativ 4NT över
  // minimisvaret (31–32); 33+ frågar Gerber 4♣ (auction-gerber-overallt.test.ts).
  it('svararen efter öppnarens svar: 4NT kvantitativt över 3NT (32), 6NT över 4NT', () => {
    const d20 = medSyd('S:AQ4 H:AQ65 D:Q2 C:AQ54')
    expect(decideCall(d20, H('W', `${FORE} 2NT P 3NT P`), 'S')).toMatchObject({ bid: '4NT', rule: 'kvantitativ 4NT' })
    expect(decideCall(d20, H('W', `${FORE} 2NT P 3NT P 4NT P`), 'N').bid).toBe('P')
    const dMax = medNord(d20, NORD_MAX)
    expect(decideCall(dMax, H('W', `${FORE} 2NT P 4NT P`), 'S').bid).toBe('6NT')
  })
  it('hela auktioner: rapporten slutar i 3NT av Syd; 20 mot 16 når 6NT', () => {
    expect(hela(RAPPORT)).toEqual(['N:1C', 'S:1H', 'N:1S', 'S:2D', 'N:2H', 'S:3NT'])
    expect(contractFromCalls(H('W', `${FORE} 3NT P P P`))).toMatchObject({ level: 3, strain: 'NT', declarer: 'S' })
    const dMax = medNord(medSyd('S:AQ4 H:AQ65 D:Q2 C:AQ54'), NORD_MAX)
    expect(hela(dMax)).toEqual(['N:1C', 'S:1H', 'N:1S', 'S:2D', 'N:2H', 'S:2NT', 'N:4NT', 'S:6NT'])
  })
})
