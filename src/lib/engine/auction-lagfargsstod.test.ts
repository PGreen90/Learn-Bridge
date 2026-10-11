// FACIT FÖRE FIX — STÖD I PARTNERNS LÅGFÄRG (ägarbeslut 2026-10-11).
//
// Ägarens regel: lovar partnerns bud 3+ (1♣/1♦-öppningen) ska stödet lova 4+;
// lovar budet 5+ (inkliv) räcker 3+. Stödsvepet (STOD=1, 20 000 givar) visade
// att regeln redan gäller i nästan alla lägen — avvikelserna låses här:
//   1. Cue i deras färg efter 1♣/1♦ = limithöjning+ med 4+ stöd, ELLER 12+ utan
//      naturligt bud (stöd lovas inte — "viktigare att förmedla poängen än
//      stödet"). Samma hand utan stopp med 10–11 → 1NT. Förr cue på 3-korts stöd.
//   2. Svaret på öppnarens stöddubbling stannar i högfärgen (4-3) om inte
//      lågfärgen är känd längre — vid 3-4 i båda är högfärgen bättre.
//   3. Höjning av partnerns PÅTVINGADE svar på min återöppningsdubbling kräver
//      4+ ("då det dubblas är det tydligt att öppnaren inte hade 5+").
//   4. Preferensen: efter 1♦–1♥–2♣ (öppnaren 5+/4+) går svararen tillbaka till
//      första färgen med två kort (står, ägarens ja). Efter 1♣–1♥–1♠ kan klövern
//      vara tre kort → svag hand med två klöver bjuder 1NT, inte 2♣.
// Hp i kommentarerna räknade med kod (hcp(parseHand)).
import { describe, expect, it } from 'vitest'
import type { Card, Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { dealFromSeed, botAuction } from './revisor'
import { decideCall } from './auction-live'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const

/** En giv där `seat` har `hand` och resten av leken delas ut till de andra (de syns aldrig för budaren). */
function givMed(seat: Seat, hand: string): Deal {
  const mine = parseHand(hand)
  const rest: Card[] = []
  for (const s of SUITS) for (const r of RANKS) if (!mine.some((c) => c.suit === s && c.rank === r)) rest.push({ suit: s, rank: r })
  const others = SEATS.filter((s) => s !== seat)
  const hands = { [seat]: mine } as Record<Seat, Card[]>
  others.forEach((s, i) => (hands[s] = rest.slice(i * 13, i * 13 + 13)))
  return { id: 'lagfargsstod', board: 1, dealer: 'N', vulnerability: 'none', hands }
}
const hist = (bids: string[], first: Seat = 'N'): ResolvedCall[] =>
  bids.map((bid, i) => ({ seat: SEATS[(SEATS.indexOf(first) + i) % 4], bid }) as ResolvedCall)

function auktion(seed: number) {
  const h = botAuction(dealFromSeed(seed))
  expect(h).not.toBeNull()
  return h!
}

describe('1. Cue efter 1♦–(1♠): 4+ stöd (limit+) eller 12+ utan naturligt bud; annars 1NT 10–11', () => {
  const svar = (hand: string) => decideCall(givMed('S', hand), hist(['1D', '1S']), 'S')

  it('♠862 ♥AK5 ♦KJ7 ♣Q943 (13 hp, 3 ruter, inget spaderstopp) → 2♠ cue — utan stödlöfte', () => {
    expect(hcp(parseHand('S:862 H:AK5 D:KJ7 C:Q943'))).toBe(13)
    const c = svar('S:862 H:AK5 D:KJ7 C:Q943')
    expect(c.bid).toBe('2S')
    expect(c.explanation).not.toMatch(/3\+ stöd/)
  })
  it('♠862 ♥AQ5 ♦KJ7 ♣J943 (11 hp, 3 ruter, inget stopp) → 1NT, inte cue', () => {
    expect(hcp(parseHand('S:862 H:AQ5 D:KJ7 C:J943'))).toBe(11)
    expect(svar('S:862 H:AQ5 D:KJ7 C:J943').bid).toBe('1NT')
  })
  it('♠862 ♥AK5 ♦Q72 ♣J943 (10 hp) → 1NT', () => {
    expect(hcp(parseHand('S:862 H:AK5 D:Q72 C:J943'))).toBe(10)
    expect(svar('S:862 H:AK5 D:Q72 C:J943').bid).toBe('1NT')
  })
  it('♠862 ♥K95 ♦KJ7 ♣Q943 (9 hp) → pass som förut (1NT utan stopp bara 10–11)', () => {
    expect(hcp(parseHand('S:862 H:K95 D:KJ7 C:Q943'))).toBe(9)
    expect(svar('S:862 H:K95 D:KJ7 C:Q943').bid).toBe('P')
  })
  it('♠862 ♥K95 ♦J72 ♣Q943 (6 hp, 3 ruter) → pass — ingen höjning på tre kort', () => {
    expect(hcp(parseHand('S:862 H:K95 D:J72 C:Q943'))).toBe(6)
    expect(svar('S:862 H:K95 D:J72 C:Q943').bid).toBe('P')
  })
  it('♠862 ♥A5 ♦KJ74 ♣Q943 (10 hp, 4 ruter) → 2♠ cue (limithöjning+ med 4+ stöd) som förut', () => {
    expect(hcp(parseHand('S:862 H:A5 D:KJ74 C:Q943'))).toBe(10)
    expect(svar('S:862 H:A5 D:KJ74 C:Q943').bid).toBe('2S')
  })
  it('♠JT ♥QJ9 ♦Q72 ♣AJ942 (11 hp, 3 ruter, 5 klöver) → 2♣ fritt bud, inte cue på tre ruter', () => {
    expect(hcp(parseHand('S:JT H:QJ9 D:Q72 C:AJ942'))).toBe(11)
    expect(svar('S:JT H:QJ9 D:Q72 C:AJ942').bid).toBe('2C')
  })
})

describe('2. Svaret på stöddubblingen stannar i högfärgen om inte lågfärgen är längre', () => {
  // 1♣–(P)–1♥–(1♠)–X (stöd = exakt 3♥)–(P)–?
  const svar = (hand: string) => decideCall(givMed('S', hand), hist(['1C', 'P', '1H', '1S', 'X', 'P']), 'S')

  it('frö 20275921: ♠6 ♥K642 ♦KJ963 ♣A74 (11 hp) → 3♥ (inbjudan på 4-3), inte 3♣ på tre klöver', () => {
    expect(hcp(parseHand('S:6 H:K642 D:KJ963 C:A74'))).toBe(11)
    expect(svar('S:6 H:K642 D:KJ963 C:A74').bid).toBe('3H')
  })
  it('♠6 ♥K642 ♦J9632 ♣Q74 (6 hp, minimum) → 2♥ på 4-3, inte preferens 2♣ på tre', () => {
    expect(hcp(parseHand('S:6 H:K642 D:J9632 C:Q74'))).toBe(6)
    expect(svar('S:6 H:K642 D:J9632 C:Q74').bid).toBe('2H')
  })
  it('♠96 ♥KQ642 ♦J96 ♣A7 (10 hp, FEM hjärter, ingen kortfärg) → 4♥ direkt, så 3♥ efter lågfärgsöppningen alltid är 4-3', () => {
    const hand = 'S:96 H:KQ642 D:J96 C:A7'
    expect(hcp(parseHand(hand))).toBe(10)
    expect(svar(hand).bid).toBe('4H')
  })
  it('♠6 ♥K642 ♦J96 ♣Q7432 (6 hp, FEM klöver) → 2♣ — lågfärgen är känd längre', () => {
    expect(hcp(parseHand('S:6 H:K642 D:J96 C:Q7432'))).toBe(6)
    expect(svar('S:6 H:K642 D:J96 C:Q7432').bid).toBe('2C')
  })
})

describe('3. Öppnaren höjer partnerns påtvingade svar på återöppningsdubblingen bara med 4+', () => {
  it('frö 20261000: 1♥–(2♦)–P–(P)–X–(P)–3♣–(P), Nord ♠KQ32 ♥AQJ86 ♦K ♣AQT → ingen klöverhöjning på tre', () => {
    const h = auktion(20261000)
    expect(h.slice(0, 9).map((c) => c.bid)).toEqual(['P', '1H', '2D', 'P', 'P', 'X', 'P', '3C', 'P'])
    expect(h[9].seat).toBe('N')
    expect(h[9].bid).not.toMatch(/C$/)
  })
  it('frö 20262481: 1♦–(1♠)–P–(P)–X–(P)–2♣–(P), Väst ♠632 ♥AK5 ♦AK92 ♣AT3 → ingen klöverhöjning på tre', () => {
    const h = auktion(20262481)
    expect(h.slice(0, 9).map((c) => c.bid)).toEqual(['P', '1D', '1S', 'P', 'P', 'X', 'P', '2C', 'P'])
    expect(h[9].seat).toBe('W')
    expect(h[9].bid).not.toMatch(/C$/)
  })
})

describe('4. Preferensen', () => {
  it('frö 20262311: 1♦–1♥–2♣, Syd ♠AJ4 ♥87543 ♦64 ♣J43 → 2♦ (öppnaren 5+/4+, ruter kan vara längre) — står', () => {
    const h = auktion(20262311)
    expect(h.slice(0, 6).map((c) => c.bid)).toEqual(['1D', 'P', '1H', 'P', '2C', 'P'])
    expect(h[6].seat).toBe('S')
    expect(h[6].bid).toBe('2D')
  })
  it('frö 20262013: 1♣–1♥–1♠, Nord ♠AJ7 ♥T7532 ♦T98 ♣J4 (6 hp) → 1NT, inte 2♣ på två klöver', () => {
    expect(hcp(parseHand('S:AJ7 H:T7532 D:T98 C:J4'))).toBe(6)
    const h = auktion(20262013)
    expect(h.slice(0, 6).map((c) => c.bid)).toEqual(['1C', 'P', '1H', 'P', '1S', 'P'])
    expect(h[6].seat).toBe('N')
    expect(h[6].bid).toBe('1NT')
  })
})
