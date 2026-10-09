// NEGATIV DUBBLING ENLIGT EXPERTERNA (ägarbeslut 2026-10-08: "vi kör helt enligt
// experterna"). Källor: Larry Cohen (larryco.com), Karen Walker (kwbridge.com),
// Richard Pavlicek (rpbridge.net lesson 5A), bridgebum, Wikipedia/BWS-enkäterna.
//
//   1. 1♣–(1♦)–X lovar BÅDA högfärgerna (minst 4-4). En ensam 4-korts högfärg
//      bjuds naturligt på 1-läget (fyra kort räcker där). 5-4: den femkorts.
//   2. Negativ dubbling över ett 2-lägesinkliv kräver 9+ hp (Cohen 9–10,
//      Pavlicek 9+); 1-läget 6+ som förut. Femkorts högfärg: bjud med 10+,
//      dubbla med 9, annars pass.
//   3. 1♦–(2♣)–X lovar MINST EN 4-korts högfärg (Walker, Pavlicek, bridgebum).
//      Öppnaren får inte hoppa i en högfärg dubblaren kanske saknar: 13–15 bjuder
//      sin högfärg utan hopp (billigast med båda), 16+ cue:ar deras färg och
//      dubblaren visar sin högfärg. Bjöd öppnaren fel högfärg ger dubblaren
//      preferens till öppningsfärgen = visar den andra högfärgen (Pavlicek), och
//      öppnaren bjuder den med fyra kort.
// Bakgrund: stödsvepets fynd frö 20265329 + mätning i 20 000 givar: 375 tvetydiga
// dubblingar, öppnaren svarade i fel högfärg 119 av 212 gånger.
import { describe, expect, it } from 'vitest'
import type { Card, Deal, Hand, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'
import { dealFromSeed, botAuction } from './revisor'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

function dealWith(seat: Seat, hand: string, dealer: Seat): Deal {
  const mine: Hand = parseHand(hand)
  expect(mine.length).toBe(13)
  const used = new Set(mine.map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  const others = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => s !== seat)
  const hands = { N: [] as Hand, E: [] as Hand, S: [] as Hand, W: [] as Hand }
  hands[seat] = mine
  others.forEach((s, i) => { hands[s] = rest.filter((_, k) => k % 3 === i) })
  return { id: 'facit', dealer, vulnerability: 'none', board: 1, hands }
}
function auktion(seed: number) {
  const hist = botAuction(dealFromSeed(seed))
  expect(hist).not.toBeNull()
  return hist!
}
const bids = (h: ResolvedCall[], upto: number) => h.slice(0, upto).map((c) => c.bid)

describe('1 – 1♣–(1♦): dubblingen lovar båda högfärgerna, en ensam 4-korts bjuds', () => {
  const h = [call('N', '1C'), call('E', '1D')]
  it('♠KJ84 ♥Q93 ♦65 ♣K752 (en 4-korts högfärg) → 1♠, inte X', () => {
    const r = decideCall(dealWith('S', 'S:KJ84 H:Q93 D:65 C:K752', 'N'), h, 'S')
    expect(r.bid).toBe('1S')
  })
  it('♠KJ84 ♥AQ93 ♦65 ♣752 (4-4) → X', () => {
    expect(decideCall(dealWith('S', 'S:KJ84 H:AQ93 D:65 C:752', 'N'), h, 'S').bid).toBe('X')
  })
  it('♠KJ842 ♥AQ93 ♦65 ♣72 (5-4) → 1♠ (den femkorts först)', () => {
    expect(decideCall(dealWith('S', 'S:KJ842 H:AQ93 D:65 C:72', 'N'), h, 'S').bid).toBe('1S')
  })
  it('♠KJ8 ♥Q93 ♦65 ♣K7542 (ingen 4-korts högfärg) → inte X', () => {
    expect(decideCall(dealWith('S', 'S:KJ8 H:Q93 D:65 C:K7542', 'N'), h, 'S').bid).not.toBe('X')
  })
  it('frö 20261184: 1♣–(1♦), Väst ♠K942 ♥A73 ♦T9 ♣KT53 (10 hp) → 1♠, inte X', () => {
    const a = auktion(20261184)
    expect(bids(a, 4)).toEqual(['P', 'P', '1C', '1D'])
    expect(a[4].seat).toBe('W')
    expect(a[4].bid).toBe('1S')
  })
})

describe('2 – negativ dubbling över 2-lägesinkliv: 7+ när svaret ryms på 2-läget, 9+ när det tvingas till 3-läget (Pavlicek)', () => {
  // Ägarbeslut 2026-10-09 efter DD-domen: Cohens 9 över alla 2-lägesinkliv kostade
  // 9 poäng/giv på 269 givar; Pavliceks 7/9 följer svarets nivå.
  const h = [call('N', '1D'), call('E', '2C')]
  it('♠KJ84 ♥Q93 ♦65 ♣J752 (7 hp) → X (öppnaren kan svara 2♥/2♠)', () => {
    expect(decideCall(dealWith('S', 'S:KJ84 H:Q93 D:65 C:J752', 'N'), h, 'S').bid).toBe('X')
  })
  it('♠KJ84 ♥Q93 ♦65 ♣8752 (6 hp) → pass, inte X', () => {
    expect(decideCall(dealWith('S', 'S:KJ84 H:Q93 D:65 C:8752', 'N'), h, 'S').bid).toBe('P')
  })
  it('♠Q93 ♥KJ842 ♦65 ♣J75 (7 hp, fem hjärter, för svag för 2♥) → X (dubbla, bjud färgen med 10+)', () => {
    expect(decideCall(dealWith('S', 'S:Q93 H:KJ842 D:65 C:J75', 'N'), h, 'S').bid).toBe('X')
  })
  it('♠Q93 ♥KJ842 ♦K5 ♣975 (9 hp, fem hjärter) → X (för svag för 2♥, dubbla)', () => {
    expect(decideCall(dealWith('S', 'S:Q93 H:KJ842 D:K5 C:975', 'N'), h, 'S').bid).toBe('X')
  })
  it('1♦–(2♠): svaret 3♥ tvingas till 3-läget → 6 hp passar, 9 hp dubblar', () => {
    const hs = [call('N', '1D'), call('E', '2S')]
    expect(decideCall(dealWith('S', 'S:93 H:KJ84 D:652 C:Q752', 'N'), hs, 'S').bid).not.toBe('X') // 6 hp
    expect(decideCall(dealWith('S', 'S:93 H:KJ84 D:K52 C:Q752', 'N'), hs, 'S').bid).toBe('X') // 9 hp
  })
  it('frö 20261320: 1♦–(2♣), Nord ♠852 ♥A8643 ♦T ♣K986 (7 hp) → X står (svaret ryms på 2-läget)', () => {
    const a = auktion(20261320)
    expect(bids(a, 2)).toEqual(['1D', '2C'])
    expect(a[2].seat).toBe('N')
    expect(a[2].bid).toBe('X')
  })
})

describe('3 – öppnarens svar på den tvetydiga dubblingen (1♦–(2♣)–X–P)', () => {
  const h = [call('N', '1D'), call('E', '2C'), call('S', 'X'), call('W', 'P')]
  it('♠AJ62 ♥K84 ♦AQ753 ♣4 (14 hp) → 2♠ utan hopp', () => {
    expect(decideCall(dealWith('N', 'S:AJ62 H:K84 D:AQ753 C:4', 'N'), h, 'N').bid).toBe('2S')
  })
  it('♠AJ62 ♥KQ84 ♦AQ75 ♣4 (16 hp, 4-4) → cue 3♣, inte hopp i en högfärg dubblaren kanske saknar', () => {
    const r = decideCall(dealWith('N', 'S:AJ62 H:KQ84 D:AQ75 C:4', 'N'), h, 'N')
    expect(r.bid).toBe('3C')
  })
  it('frö 20261029: 1♦–(2♣)–X, Nord ♠AK64 ♥KT ♦KQJT4 ♣K3 (17 hp) → cue 3♣ (förr 3♠), Syd ♠QJ3 ♥AQ862 visar 3♥', () => {
    const a = auktion(20261029)
    expect(bids(a, 5)).toEqual(['P', '1D', '2C', 'X', 'P'])
    expect(a[5].seat).toBe('N')
    expect(a[5].bid).toBe('3C')
    expect(a[6].bid).toBe('P')
    expect(a[7].seat).toBe('S')
    expect(a[7].bid).toBe('3H')
  })
  it('dubblaren svarar på cuet: ♠KJ84 ♥93 ♦Q65 ♣9752 → 3♠ (sin 4-korts högfärg)', () => {
    const hh = [...h, call('N', '3C'), call('E', 'P')]
    expect(decideCall(dealWith('S', 'S:KJ84 H:93 D:Q65 C:K752', 'N'), hh, 'S').bid).toBe('3S')
  })
})

describe('3b – fel högfärg: dubblarens preferens visar den andra, öppnaren bjuder den', () => {
  const h = [call('N', '1D'), call('E', '2C'), call('S', 'X'), call('W', 'P'), call('N', '2H'), call('E', 'P')]
  it('dubblaren ♠KJ84 ♥93 ♦Q65 ♣K752 efter öppnarens 2♥ → 3♦ (preferens = visar spader)', () => {
    const r = decideCall(dealWith('S', 'S:KJ84 H:93 D:Q65 C:K752', 'N'), h, 'S')
    expect(r.bid).toBe('3D')
  })
  it('öppnaren ♠AQ62 ♥KJ84 ♦AJ753 ♣– efter dubblarens 3♦-preferens → 3♠ (fyra spader)', () => {
    const hh = [...h, call('S', '3D'), call('W', 'P')]
    expect(decideCall(dealWith('N', 'S:AQ62 H:KJ84 D:AJ753 C:-', 'N'), hh, 'N').bid).toBe('3S')
  })
  it('dubblaren med tre hjärter (fit) ger ingen preferens: ♠KJ84 ♥Q93 ♦65 ♣K752 → inte 3♦', () => {
    expect(decideCall(dealWith('S', 'S:KJ84 H:Q93 D:65 C:K752', 'N'), h, 'S').bid).not.toBe('3D')
  })
})
