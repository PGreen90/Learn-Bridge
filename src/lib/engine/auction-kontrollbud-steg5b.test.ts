// FACIT FÖRE FIX — kontrollbud före essfrågan, steg 5 budväg 2: 4m-inbjudans
// accept rakt till 6m efter MINOR SUIT STAYMAN (1NT–2♠–3m) och INVERTERAD MINOR
// (1m–2m–3NT/2NT/stopp-visning). Ägarbeslut 2026-10-07: "4→6 utan essfråga är
// förbjudet", kontrollbud före essfrågan i ALLA sammanhang. Samma mönster som
// steg 4 och 5a: svararens 4m = sätter trumfen (krav) med 31+ ihop mot partnerns
// visade minimum → öppnaren visar sin billigaste kontroll → kaptenen 4NT eller 5m.
//
// Skannern (slaminbjudan-4m.probe, STEG5=1, frön 20276001–20576000, 2026-10-09
// efter budväg 1): 62 kvarvarande 4m-inbjudningar — 40 stark 2♣ (gick redan via
// kontrollbud, rätt), 13 MSS, 9 inverterad minor. Alla accepter rakt till 6m.
// Hp räknade med kod (hcp/parseHand), summa 40 per giv (dealFromSeed).

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import { hcp } from './hand'

const bud = (d: Deal): string[] => botAuction(d)!.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
/** 4→6 utan essfråga är förbjudet: hamnar paret i slam måste 4NT ha ställts. */
const ingenSexUtanFraga = (d: Deal) => {
  const calls = botAuction(d)!
  const b = calls.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
  const slut = contractFromCalls(calls)
  if (slut && slut.level >= 6) expect(b.some((x) => x.endsWith(':4NT')), `slam utan essfråga: ${b.join(' ')}`).toBe(true)
}
const summa40 = (d: Deal) => expect((['N', 'E', 'S', 'W'] as const).reduce((a, s) => a + hcp(d.hands[s]), 0)).toBe(40)

describe('steg 5 budväg 2a: Minor Suit Stayman — 4m efter 3m sätter trumfen, aldrig 6m utan essfråga', () => {
  // Frö 20277260 (giv S, ingen i zon): Syd ♠KQT ♥KT6 ♦AT9 ♣A654 (16 hp) öppnar 1NT,
  // Nord ♠32 ♥A9 ♦KQJ2 ♣KT982 (13 hp) MSS 2♠, klöverfit. Förr: 1NT–2♠–3♣–4♣–6♣.
  it('frö 20277260: 4♣ sätter trumfen, öppnaren visar ♦A (4♦)', () => {
    const d = dealFromSeed(20277260)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['S:1NT', 'N:2S', 'S:3C', 'N:4C', 'S:4D'])
    ingenSexUtanFraga(d)
  })
  // Frö 20302614 (giv N, ingen i zon): Öst ♠65 ♥AQT3 ♦KQ53 ♣KQ5 (16 hp), Väst
  // ♠KT ♥J5 ♦A987 ♣AJT32 (13 hp). Förr: 1NT–2♠–3♦–4♦–6♦.
  it('frö 20302614: 4♦ sätter trumfen, öppnaren visar ♥A (4♥)', () => {
    const d = dealFromSeed(20302614)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['E:1NT', 'W:2S', 'E:3D', 'W:4D', 'E:4H'])
    ingenSexUtanFraga(d)
  })
  // Frö 20346457 (giv E, NS i zon): Syd ♠T76 ♥AQ5 ♦AQJ83 ♣KT (16 hp), Nord ♠AQ ♥63
  // ♦KT42 ♣A9654 (13 hp). Förr: 1NT–2♠–3♦–4♦–6♦ (DD 11 stick).
  it('frö 20346457: 4♦ sätter trumfen, öppnaren visar ♥A (4♥)', () => {
    const d = dealFromSeed(20346457)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['S:1NT', 'N:2S', 'S:3D', 'N:4D', 'S:4H'])
    ingenSexUtanFraga(d)
  })
  // Frö 20412556 (giv N, NS i zon): Öst ♠92 ♥AQ3 ♦K8542 ♣AQ9 (15 hp), Väst ♠AT ♥J5
  // ♦AJ976 ♣KJ83 (14 hp). Förr: 1NT–2♠–3♦–4♦–5♦ (öppnaren avböjde inbjudan).
  it('frö 20412556: 4♦ sätter trumfen även här — öppnaren visar ♥A, ingen "avböjd inbjudan"', () => {
    const d = dealFromSeed(20412556)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['E:1NT', 'W:2S', 'E:3D', 'W:4D', 'E:4H'])
    ingenSexUtanFraga(d)
  })
})

describe('steg 5 budväg 2b: inverterad minor — 4m efter öppnarens svar sätter trumfen, aldrig 6m utan essfråga', () => {
  // Frö 20289572 (giv V, ÖV i zon): Väst ♠AQJ ♥AQ7 ♦Q954 ♣A82 (19 hp) 1♦–3NT,
  // Öst ♠T3 ♥T5 ♦AK73 ♣QJ943 (10 hp). Förr: 1♦–2♦–3NT–4♦–6♦.
  it('frö 20289572: 4♦ över 3NT sätter trumfen, öppnaren visar ♥A (4♥)', () => {
    const d = dealFromSeed(20289572)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['W:1D', 'E:2D', 'W:3NT', 'E:4D', 'W:4H'])
    ingenSexUtanFraga(d)
  })
  // Frö 20332119 (giv N, NS i zon): Nord ♠K765 ♥AJ3 ♦AQ ♣KQ32 (19 hp), Syd ♠QJ ♥T8
  // ♦KT98 ♣AJ986 (11 hp). Förr: 1♣–2♣–3NT–4♣–6♣.
  it('frö 20332119: 4♣ över 3NT sätter trumfen, öppnaren visar ♦AQ (4♦)', () => {
    const d = dealFromSeed(20332119)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['N:1C', 'S:2C', 'N:3NT', 'S:4C', 'N:4D'])
    ingenSexUtanFraga(d)
  })
  // Frö 20386328 (giv S, NS i zon): Väst ♠AKT ♥8762 ♦A9 ♣T873 (11 hp) visar
  // ruterstopp 2♦, Öst ♠J52 ♥KT ♦QJT8 ♣AKQJ (17 hp). Förr: 1♣–2♣–2♦–4♣–6♣.
  it('frö 20386328: 4♣ över stopp-visningen sätter trumfen, öppnaren visar ♦A (4♦)', () => {
    const d = dealFromSeed(20386328)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['W:1C', 'E:2C', 'W:2D', 'E:4C', 'W:4D'])
    ingenSexUtanFraga(d)
  })
  // Frö 20566140 (giv Ö, alla i zon): Syd ♠KJ65 ♥AJ8 ♦KQ2 ♣A74 (18 hp), Nord ♠92
  // ♥K72 ♦83 ♣KQJT85 (9 hp). Förr: 1♣–2♣–3NT–4♣–5♣ (avböjd inbjudan, DD 11).
  it('frö 20566140: 4♣ sätter trumfen, öppnaren visar ♦KQ (4♦); utan slamzon stannar paret i 5♣', () => {
    const d = dealFromSeed(20566140)
    summa40(d)
    expect(bud(d).slice(0, 5)).toEqual(['S:1C', 'N:2C', 'S:3NT', 'N:4C', 'S:4D'])
    ingenSexUtanFraga(d)
  })
})
