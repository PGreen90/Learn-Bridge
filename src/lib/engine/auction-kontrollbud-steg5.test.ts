// FACIT FÖRE FIX — kontrollbud före essfrågan, steg 5: de gamla 4m-inbjudningarnas
// accept rakt till 6m. Ägarbeslut 2026-10-07 (gäller ALLA sammanhang): att hoppa
// från 4 till 6 utan att fråga ess är förbjudet; båda partners visar sina
// kontroller före essfrågan. Steg 4 (6e8290a) byggde mönstret efter 1m–1M–3m:
// 4m = sätter trumfen (krav) → öppnaren visar sin billigaste kontroll → kaptenen
// kontrollbud/4NT/5m. Steg 5, budväg 1: samma mönster efter REVERSE (16+) och
// HOPPSKIFT (19+) när trumfen är en av öppnarens LÅGFÄRGER.
//
// Förr (skannat 300 000 frön 20276001–20576000 med botAuction, 2026-10-09):
// 302 auktioner med 4m-slaminbjudan, varav 233 efter reverse/hoppskift — alla
// med accept = hopp rakt till 6m ('slaminbjudan: accept'), ingen essfråga.
// Hp räknade med kod (hcp/parseHand), summa 40 per giv.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { botAuction } from './revisor'

const giv = (dealer: Seat, vul: Deal['vulnerability'], n: string, e: string, s: string, w: string): Deal => ({
  id: 'facit', board: 1, dealer, vulnerability: vul,
  hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) },
})
const bud = (d: Deal): string[] => botAuction(d)!.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
/** 4→6 utan essfråga är förbjudet: hamnar paret i slam måste 4NT ha ställts. */
const ingenSexUtanFraga = (d: Deal) => {
  const calls = botAuction(d)!
  const b = calls.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
  const slut = contractFromCalls(calls)
  const fragat = b.some((x) => x.endsWith(':4NT'))
  if (slut && slut.level >= 6) expect(fragat, `slam utan essfråga: ${b.join(' ')}`).toBe(true)
}

describe('steg 5, budväg 1: 4m efter reverse sätter trumfen — aldrig 6m utan essfråga', () => {
  // Frö 20281533 (giv N, ÖV i zon): Nord ♠2 ♥K542 ♦AK3 ♣KQJT6 (16 hp), Syd
  // ♠AK7543 ♥6 ♦942 ♣A74 (11 hp). Förr: 1♣–1♠–2♥–4♣–6♣ (DD 11 stick).
  const d33 = giv('N', 'ew', 'S:2 H:K542 D:AK3 C:KQJT6', 'S:QJ8 H:QT73 D:JT876 C:9', 'S:AK7543 H:6 D:942 C:A74', 'S:T96 H:AJ98 D:Q5 C:8532')
  it('reverse i högfärg, fit i öppnarens FÖRSTA lågfärg: 4♣ sätter trumfen, öppnaren visar ♦A (4♦)', () => {
    expect(bud(d33).slice(0, 5)).toEqual(['N:1C', 'S:1S', 'N:2H', 'S:4C', 'N:4D'])
    ingenSexUtanFraga(d33)
  })

  // Frö 20284937 (giv V, ÖV i zon): Nord ♠T ♥KQ97 ♦AKT42 ♣A63 (16 hp), Syd
  // ♠KQ96 ♥A ♦9765 ♣KQT5 (14 hp). Förr: 1♦–1♠–2♥–4♦–6♦ (DD 11 stick).
  const d37 = giv('W', 'ew', 'S:T H:KQ97 D:AKT42 C:A63', 'S:J752 H:T642 D:J83 C:J7', 'S:KQ96 H:A D:9765 C:KQT5', 'S:A843 H:J853 D:Q C:9842')
  it('reverse i högfärg, fit i ruter: 4♦ sätter trumfen, öppnaren visar ♥KQ (4♥)', () => {
    expect(bud(d37).slice(0, 5)).toEqual(['N:1D', 'S:1S', 'N:2H', 'S:4D', 'N:4H'])
    ingenSexUtanFraga(d37)
  })

  // Frö 20287068 (giv V, alla i zon): Väst ♠6 ♥Q72 ♦AQ76 ♣AQJT8 (15 hp), Öst
  // ♠AKJT9 ♥A64 ♦J9 ♣K95 (16 hp). Förr: 1♣–1♠–2♦–4♣–6♣ (DD 12 stick).
  const d68 = giv('W', 'all', 'S:Q7532 H:JT5 D:T53 C:74', 'S:AKJT9 H:A64 D:J9 C:K95', 'S:84 H:K983 D:K842 C:632', 'S:6 H:Q72 D:AQ76 C:AQJT8')
  it('reverse i lågfärg, fit i öppnarens första lågfärg: 4♣ sätter trumfen, öppnaren visar ♦A (4♦); slam bara efter 4NT', () => {
    expect(bud(d68).slice(0, 5)).toEqual(['W:1C', 'E:1S', 'W:2D', 'E:4C', 'W:4D'])
    ingenSexUtanFraga(d68)
  })
})

describe('steg 5, budväg 1: 4m efter hoppskift sätter trumfen — aldrig 6m utan essfråga', () => {
  // Frö 20280103 (giv V, ingen i zon): Syd ♠A4 ♥Q7 ♦AKQ42 ♣AT94 (19 hp), Nord
  // ♠KQ86 ♥AT84 ♦6 ♣J872 (10 hp). Förr: 1♦–1♥–3♣–4♣–6♣ (DD 12 stick).
  const d03 = giv('W', 'none', 'S:KQ86 H:AT84 D:6 C:J872', 'S:JT932 H:J532 D:985 C:K', 'S:A4 H:Q7 D:AKQ42 C:AT94', 'S:75 H:K96 D:JT73 C:Q653')
  it('hoppskift i klöver, 4-korts stöd: 4♣ sätter trumfen, öppnaren visar ♦AKQ (4♦)', () => {
    expect(bud(d03).slice(0, 5)).toEqual(['S:1D', 'N:1H', 'S:3C', 'N:4C', 'S:4D'])
    ingenSexUtanFraga(d03)
  })

  // Frö 20282057 (giv S, ingen i zon): Syd ♠2 ♥93 ♦AKQJ92 ♣AQ97 (16 hp), Nord
  // ♠QT543 ♥KQ ♦T3 ♣KT82 (10 hp). Förr: 1♦–1♠–3♣–4♣–6♣ (DD 11 stick).
  const d57 = giv('S', 'none', 'S:QT543 H:KQ D:T3 C:KT82', 'S:A986 H:AJT76 D:87 C:J5', 'S:2 H:93 D:AKQJ92 C:AQ97', 'S:KJ7 H:8542 D:654 C:643')
  it('hoppskift i klöver efter 1♠-svar: 4♣ sätter trumfen, öppnaren visar ♦AKQJ (4♦)', () => {
    expect(bud(d57).slice(0, 5)).toEqual(['S:1D', 'N:1S', 'S:3C', 'N:4C', 'S:4D'])
    ingenSexUtanFraga(d57)
  })

  // Frö 20289414 (giv N, ingen i zon): Nord ♠A6 ♥86 ♦AJ832 ♣AKQT (18 hp), Syd
  // ♠852 ♥AK432 ♦KQ64 ♣3 (12 hp). Förr: 1♦–1♥–3♣–4♦–6♦ (DD 13 stick — storslam).
  const d14 = giv('N', 'none', 'S:A6 H:86 D:AJ832 C:AKQT', 'S:KT4 H:T97 D:97 C:98762', 'S:852 H:AK432 D:KQ64 C:3', 'S:QJ973 H:QJ5 D:T5 C:J54')
  it('hoppskift, fit i öppnarens FÖRSTA lågfärg: 4♦ sätter trumfen, öppnaren visar ♠A (4♠ — ingen hjärterkontroll)', () => {
    expect(bud(d14).slice(0, 5)).toEqual(['N:1D', 'S:1H', 'N:3C', 'S:4D', 'N:4S'])
    ingenSexUtanFraga(d14)
  })

  // Frö 20288825 (giv S, ingen i zon): Nord ♠A5 ♥AK942 ♦K9 ♣AJ53 (19 hp), Syd
  // ♠QJT4 ♥QT ♦Q5 ♣KT842 (10 hp). Förr: 1♥–1♠–3♣–4♣–6♣ (DD 12 stick).
  const d25 = giv('S', 'none', 'S:A5 H:AK942 D:K9 C:AJ53', 'S:K97 H:J86 D:T742 C:Q76', 'S:QJT4 H:QT D:Q5 C:KT842', 'S:8632 H:753 D:AJ863 C:9')
  it('hoppskift efter 1♥-öppning: 4♣ sätter trumfen, öppnaren visar ♥AK (4♥ — ♦K9 är ingen kontroll)', () => {
    expect(bud(d25).slice(0, 5)).toEqual(['N:1H', 'S:1S', 'N:3C', 'S:4C', 'N:4H'])
    ingenSexUtanFraga(d25)
  })

  // Frö 20327407 (giv N, NS i zon): Nord ♠T ♥AKT752 ♦A862 ♣A8 (15 hp), Syd
  // ♠K9754 ♥6 ♦KQT4 ♣742 (8 hp). Förr: 1♥–1♠–3♦–4♦–6♦ (DD 11 stick).
  const d07 = giv('N', 'ns', 'S:T H:AKT752 D:A862 C:A8', 'S:Q632 H:Q983 D:J75 C:KQ', 'S:K9754 H:6 D:KQT4 C:742', 'S:AJ8 H:J4 D:93 C:JT9653')
  it('hoppskift i ruter efter 1♥-öppning: 4♦ sätter trumfen, öppnaren visar ♥AK (4♥)', () => {
    expect(bud(d07).slice(0, 5)).toEqual(['N:1H', 'S:1S', 'N:3D', 'S:4D', 'N:4H'])
    ingenSexUtanFraga(d07)
  })

  // Sidofynd ur skanningen (frö 20569345, giv V, alla i zon): Öst ♠T65 ♥AKQ
  // ♦AT8 ♣K654 (16 hp) svarade 1NT på 1♦ (regel 'oklart') och hoppade sedan
  // 4♦–6♦ efter reversen 2♠. Svaret är hålet: 16 hp balanserad svarar inte 1NT.
  it.todo('frö 20569345: 16 hp balanserad mot 1♦ svarar inte 1NT (2♣ eller 2NT-stegen) — rätt svar = ägarfråga')
})
