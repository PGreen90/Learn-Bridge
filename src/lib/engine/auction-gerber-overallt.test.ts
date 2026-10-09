// FACIT FÖRE FIX — GERBER ÖVERALLT DÄR SANG ÄR ETABLERAD UTGÅNG (ägarbeslut
// 2026-10-09): "Gerber går alltid före kvant och hoppbud. Den minimala/svaga
// handen som väljer att sätta budet i 3NT har ingen aning om partnerns styrka och
// fördelning. Gerber skall vara fullt aktivt i alla budgivningar där NT är
// etablerat som utgång."
//
// Före: Gerber fanns bara som hopp direkt över 1NT/2NT-öppningen och över
// 1NT-återbudet. Över 2NT-återbudet (18–19) lästes 4♣ som Gerber men öppnaren
// svarade inte (pass utan regel) och svararen frågade aldrig (15 hp → "3NT till
// spel" trots 33 ihop). Över ett naturligt 3NT var 4♣ inte Gerber alls (läst
// som kontrollbud eller naturligt) och kaptenen hoppade rakt till 6NT (#42).
//
// Nu: 4♣ direkt över partnerns naturliga, icke-krävande sang (2NT-återbud, varje
// naturligt 3NT) utan satt trumf = Gerber. Kaptenen (vilken stol som helst)
// frågar med 33+ mot partnerns visade minimum; 31–32 inbjuder kvantitativt 4NT.
// 4♣ är naturligt bara när budgivaren själv redan bjudit klöver två gånger.
// Hp räknade med kod (hcp/parseHand) i testerna.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'
import { meaningOf } from './auction-meaning'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
/** N och S ges; Ö/V får resten av leken alternerande (svaga, passar). */
const giv = (dealer: Seat, n: string, s: string): Deal => {
  const N = parseHand(n), S = parseHand(s)
  const tagna = new Set([...N, ...S].map((c) => `${c.suit}${c.rank}`))
  const rest: Card[] = (['spades', 'hearts', 'diamonds', 'clubs'] as const).flatMap((suit) =>
    (['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const).map((rank) => ({ suit, rank })).filter((c) => !tagna.has(`${c.suit}${c.rank}`)))
  return { id: 'gerber', board: 1, dealer, vulnerability: 'none', hands: { N, S, E: rest.filter((_, i) => i % 2 === 0), W: rest.filter((_, i) => i % 2 === 1) } }
}
const hela = (d: Deal): string[] => {
  const h: ResolvedCall[] = []
  let guard = 0
  while (!auctionComplete(h) && guard++ < 30) h.push(decideCall(d, h, seatToAct(d.dealer, h.length)))
  return h.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
}
const läs = (dealer: Seat, s: string) => { const h = H(dealer, s); return meaningOf(h, h.length - 1) }

describe('Gerber över 2NT-återbudet (1♣–1♥–2NT, 18–19)', () => {
  // Syd ♠AQ8 ♥K4 ♦AQ9 ♣KJT43 (19 hp) öppnar 1♣ och återbjuder 2NT. Nord ♠K5 ♥AQ93
  // ♦KT74 ♣QJ2 (15 hp): 15 + 18 = 33 → Gerber. Tre ess ihop → 6NT.
  const d33 = giv('S', 'S:K5 H:AQ93 D:KT74 C:QJ2', 'S:AQ8 H:K4 D:AQ9 C:KJT43')
  it('hp räknade med kod', () => {
    expect(hcp(d33.hands.N)).toBe(15)
    expect(hcp(d33.hands.S)).toBe(19)
  })
  it('kaptenen med 33 mot visade 18 frågar 4♣ (Gerber), inte 3NT', () => {
    expect(decideCall(d33, H('S', '1C P 1H P 2NT P'), 'N')).toMatchObject({ bid: '4C', rule: 'Gerber' })
  })
  it('öppnaren svarar ess i steg (två ess → 4♠) och kaptenen placerar 6NT', () => {
    expect(decideCall(d33, H('S', '1C P 1H P 2NT P 4C P'), 'S')).toMatchObject({ bid: '4S', rule: 'Gerber' })
    expect(decideCall(d33, H('S', '1C P 1H P 2NT P 4C P 4S P'), 'N').bid).toBe('6NT')
    expect(hela(d33)).toEqual(['S:1C', 'N:1H', 'S:2NT', 'N:4C', 'S:4S', 'N:6NT'])
  })
  it('31–32 mot visade 18: kvantitativ 4NT — öppnaren accepterar med 19, passar med 18', () => {
    const d14 = giv('S', 'S:K5 H:AQ93 D:KT74 C:Q72', 'S:AQ8 H:K4 D:AQ9 C:KJT43')
    expect(hcp(d14.hands.N)).toBe(14)
    expect(decideCall(d14, H('S', '1C P 1H P 2NT P'), 'N')).toMatchObject({ bid: '4NT', rule: 'kvantitativ 4NT' })
    expect(decideCall(d14, H('S', '1C P 1H P 2NT P 4NT P'), 'S').bid).toBe('6NT')
    const d18 = giv('S', 'S:K5 H:AQ93 D:KT74 C:Q72', 'S:AQ8 H:K4 D:AQ9 C:KT943')
    expect(hcp(d18.hands.S)).toBe(18)
    expect(decideCall(d18, H('S', '1C P 1H P 2NT P 4NT P'), 'S').bid).toBe('P')
  })
  it('betydelsen: 4♣ över 2NT-återbudet är Gerber, svaret 4♠ = två ess', () => {
    expect(läs('S', '1C P 1H P 2NT P 4C').rule).toBe('Gerber')
    expect(läs('S', '1C P 1H P 2NT P 4C P 4S').text).toMatch(/2 ess/)
  })
})

describe('Gerbers kungfråga 5♣ efter ess-svaret (ägarens exempel 1m–1M–2NT–4♣–4♥–5♣)', () => {
  // Syd ♠KQJ ♥KQ4 ♦AJ9 ♣QJ54 (19 hp, ett ess, två kungar) öppnar 1♣ och återbjuder
  // 2NT. Nord ♠A32 ♥AJ54 ♦K76 ♣AK9 (19 hp, tre ess, två kungar): 19 + 18 = 37 →
  // Gerber 4♣, alla ess ihop och storslamszon → 5♣ kungfråga → 5♠ (2 kungar) → 7NT (2 + 2 ≥ 3).
  const d = giv('S', 'S:A32 H:AJ54 D:K76 C:AK9', 'S:KQJ H:KQ4 D:AJ9 C:QJ54')
  it('hp räknade med kod', () => {
    expect(hcp(d.hands.N)).toBe(19)
    expect(hcp(d.hands.S)).toBe(19)
  })
  it('hela dialogen: 4♣ – 4♥ – 5♣ (kungfråga) – 5♠ (två kungar) – 7NT', () => {
    expect(hela(d)).toEqual(['S:1C', 'N:1H', 'S:2NT', 'N:4C', 'S:4H', 'N:5C', 'S:5S', 'N:7NT'])
    expect(decideCall(d, H('S', '1C P 1H P 2NT P 4C P 4H P'), 'N')).toMatchObject({ bid: '5C', rule: 'Gerber kungfråga' })
    expect(decideCall(d, H('S', '1C P 1H P 2NT P 4C P 4H P 5C P'), 'S')).toMatchObject({ bid: '5S', rule: 'Gerber kungfråga' })
  })
  it('människan frågar 5♣ med bara 33 ihop: öppnaren svarar ändå kungar, kaptenen stannar i 6NT utan tillräckligt', () => {
    const d2 = giv('S', 'S:A32 H:AJ54 D:Q76 C:AQ9', 'S:KQJ H:KQ4 D:AJ9 C:KJ54')
    expect(hcp(d2.hands.N) + 18).toBeLessThan(37)
    expect(decideCall(d2, H('S', '1C P 1H P 2NT P 4C P 4H P 5C P'), 'S')).toMatchObject({ bid: '5NT', rule: 'Gerber kungfråga' })
    expect(decideCall(d2, H('S', '1C P 1H P 2NT P 4C P 4H P 5C P 5H P'), 'N').bid).toBe('6NT')
  })
  it('betydelsen: 5♣ läses som kungfråga, 5NT som tre kungar', () => {
    expect(läs('S', '1C P 1H P 2NT P 4C P 4H P 5C').rule).toBe('Gerber kungfråga')
    expect(läs('S', '1C P 1H P 2NT P 4C P 4H P 5C P 5NT').text).toMatch(/3 kungar/)
  })
})

describe('Gerber över partnerns naturliga 3NT', () => {
  // Felrapport #42-given: Nord ♠K ♥AQ93 ♦AKT74 ♣KQ7 (21 hp) mot Syd som öppnat
  // (visat 12). Förr hoppade Nord rakt till 6NT; nu frågar hon 4♣ först.
  const d42: Deal = { id: 'fr42', board: 7, dealer: 'S', vulnerability: 'all', hands: {
    N: parseHand('S:K H:AQ93 D:AKT74 C:KQ7'), E: parseHand('S:Q7643 H:754 D:J92 C:62'),
    S: parseHand('S:AJ98 H:KJT D:53 C:AT43'), W: parseHand('S:T52 H:862 D:Q86 C:J985') } }
  const FORE42 = '1C P 1H P 1S P 2D P 2H P 3D P 3NT P'
  it('#42: 21 mot visade 12 → 4♣ Gerber, Syd svarar 4♠ (två ess), Nord 6NT — aldrig hopp 3NT→6NT', () => {
    expect(hcp(d42.hands.N)).toBe(21)
    expect(decideCall(d42, H('S', FORE42), 'N')).toMatchObject({ bid: '4C', rule: 'Gerber' })
    expect(decideCall(d42, H('S', `${FORE42} 4C P`), 'S')).toMatchObject({ bid: '4S', rule: 'Gerber' })
    expect(decideCall(d42, H('S', `${FORE42} 4C P 4S P`), 'N').bid).toBe('6NT')
    const b = hela(d42)
    expect(b).toContain('N:4C')
    expect(contractFromCalls(H('S', `${FORE42} 4C P 4S P 6NT P P P`))).toMatchObject({ level: 6, strain: 'NT' })
    expect(b[b.length - 1]).toBe('N:6NT')
  })
  it('betydelsen: 4♣ direkt över 3NT är Gerber (inte kontrollbud i hjärter)', () => {
    expect(läs('S', `${FORE42} 4C`).rule).toBe('Gerber')
    expect(läs('S', `${FORE42} 4C P 4S`).text).toMatch(/2 ess/)
  })

  // Felrapport #103-strukturen: 2NT (krav, 18+) – 3NT (minimum) – 21+ frågar
  // Gerber i stället för att hoppa 6NT.
  it('#103: efter 2NT-kravet och öppnarens 3NT (minimum) frågar 21-handen 4♣ och placerar 6NT; 20 inbjuder 4NT', () => {
    // Rapportens auktion fram till öppnarens minimisvar (21-handen har ruterstopp
    // och skulle själv välja en annan väg — läget prövas därför ur historiken).
    const FORE103 = 'P 1C P 1H P 1S P 2D P 2H P 2NT P 3NT P'
    const d21 = giv('W', 'S:KJ85 H:K94 D:A84 C:J96', 'S:AQ4 H:AQ65 D:K2 C:AQ54')
    expect(hcp(d21.hands.N)).toBe(12)
    expect(hcp(d21.hands.S)).toBe(21)
    expect(decideCall(d21, H('W', FORE103), 'S')).toMatchObject({ bid: '4C', rule: 'Gerber' })
    expect(decideCall(d21, H('W', `${FORE103} 4C P`), 'N')).toMatchObject({ bid: '4H', rule: 'Gerber' })
    expect(decideCall(d21, H('W', `${FORE103} 4C P 4H P`), 'S').bid).toBe('6NT')
    const d20 = giv('W', 'S:KJ85 H:K94 D:A84 C:J96', 'S:AQ4 H:AQ65 D:Q2 C:AQ54')
    expect(hcp(d20.hands.S)).toBe(20)
    expect(hela(d20)).toEqual(['N:1C', 'S:1H', 'N:1S', 'S:2D', 'N:2H', 'S:2NT', 'N:3NT', 'S:4NT'])
  })

  // Öppnaren som kapten: Syd ♠AK ♥A5 ♦KQ3 ♣KJ9843 (20 hp) öppnar 1♣, Nord svarar
  // 3NT (13–15). 20 + 13 = 33 → öppnaren frågar 4♣.
  it('öppnaren frågar Gerber över svararens 3NT (20 mot visade 13)', () => {
    const d = giv('S', 'S:Q73 H:KJ4 D:AJ5 C:QT2', 'S:AK H:A5 D:KQ3 C:KJ9843')
    expect(hcp(d.hands.S)).toBe(20)
    expect(hcp(d.hands.N)).toBe(13)
    expect(decideCall(d, H('S', '1C P 3NT P'), 'S')).toMatchObject({ bid: '4C', rule: 'Gerber' })
    expect(decideCall(d, H('S', '1C P 3NT P 4C P'), 'N')).toMatchObject({ bid: '4H', rule: 'Gerber' })
    expect(decideCall(d, H('S', '1C P 3NT P 4C P 4H P'), 'S').bid).toBe('6NT')
  })
})

describe('när 4♣ INTE är Gerber', () => {
  it('egen klöver bjuden två gånger: 1♣–1♥–3♣–3NT–4♣ är naturligt', () => {
    expect(läs('S', '1C P 1H P 3C P 3NT P 4C').rule).not.toBe('Gerber')
  })
  it('inverterad minor: 1♣–2♣–3NT–4♣ är klöverhöjning (trumfen satt), inte Gerber', () => {
    expect(läs('S', '1C P 2C P 3NT P 4C').rule).not.toBe('Gerber')
  })
  it('NMF-sangförslaget med lågfärgsfit: 1♦–1♠–1NT–2♣–2♦–3♦–3NT–4♦ bekräftar trumfen', () => {
    expect(läs('S', '1D P 1S P 1NT P 2C P 2D P 3D P 3NT P 4D').rule).not.toBe('Gerber')
  })
})
