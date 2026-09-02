// Pliktsvepet K3 (2026-09-02, docs/senare.md "Svep: partnerskapsplikter i
// konkurrens"): HÖJNING PÅ VISAD LÄNGD. Svepet fann 92 av 1539 störda auktioner
// där en bot passade en billig höjning trots känd fit:
//   (a) advancern med 3-korts stöd för partnerns 1-lägesinkliv (5+ lovat) —
//       `fitLengthNeeded` krävde 4, så 1♥–(1♠)–2♥–P blev regel (frö 20261314),
//   (b) svararen över ett 1NT-INKLIV hade inget svar alls (frö 20260732),
//   (c) svararen över OVANLIG 2NT / MICHAELS hade inget svar alls (frö 20262021,
//       20263327: ♠K9874 + 17 stödpoäng passade 2NT).
// Ägarbeslut 2026-09-02: (1) 3-korts stöd → enkel höjning från 6 hp, aldrig
// hopp; (2) över 1NT-inkliv: 2M med 3+ stöd (6–9), X = straff med 10+;
// (3) över tvåfärgsinkliv: 3M = TÄVLANDE höjning med svaga poäng (4+ stöd),
// 10+ stödpoäng → 4M direkt.
//
// Kör om svepet: $env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed } from './revisor'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('K3 (a) – advancern höjer partnerns 1-lägesinkliv på 3-korts stöd', () => {
  it('frö 20261314: 1♥–(1♠)–2♥: Väst (♠A75, 10 hp) höjer 2♠ — inte pass', () => {
    const deal = dealFromSeed(20261314)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '1H'), call('E', '1S'), call('S', '2H')]
    const c = decideCall(deal, hist, 'W')
    expect(c.bid).toBe('2S')
  })

  it('frö 20261952: 1♣–(1♥)–2♣: Syd (♥J75, 11 hp) höjer 2♥ — enkel höjning, aldrig hopp på 3-korts stöd', () => {
    const deal = dealFromSeed(20261952)
    const hist = [call('W', '1C'), call('N', '1H'), call('E', '2C')]
    expect(decideCall(deal, hist, 'S').bid).toBe('2H')
  })

  it('frö 20261703: 1♦–(1♥)–2♦: Öst (♥KJ8, 4 hp) är för svag → pass', () => {
    const deal = dealFromSeed(20261703)
    const hist = [call('E', 'P'), call('S', '1D'), call('W', '1H'), call('N', '2D')]
    expect(decideCall(deal, hist, 'E').bid).toBe('P')
  })

  it('frö 20261363: 1♥–(1♠)–2♥: Nord (♠T94, 8 hp) tävlar 2♠', () => {
    const deal = dealFromSeed(20261363)
    const hist = [call('N', 'P'), call('E', '1H'), call('S', '1S'), call('W', '2H')]
    expect(decideCall(deal, hist, 'N').bid).toBe('2S')
  })

  it('frö 20263212: (2♠)–P–P–3♦ balansinkliv, Nord har ♦AT954 (11 trumf, 9 hp) → höjer 4♦ (balanseringstaket får inte stoppa den enkla höjningen)', () => {
    const deal = dealFromSeed(20263212)
    const hist = [call('W', '2S'), call('N', 'P'), call('E', 'P'), call('S', '3D'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('4D')
  })

  it('pressad till 3-läget med bara 3-korts stöd (8 trumf) → pass (lagen om totala stick)', () => {
    // frö 20261314 men motståndarna hoppar till 3♥: Väst har 8 trumf, inte 9.
    const deal = dealFromSeed(20261314)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '1H'), call('E', '1S'), call('S', '3H')]
    expect(decideCall(deal, hist, 'W').bid).toBe('P')
  })
})

describe('K3 (b) – svararen över ett 1NT-inkliv', () => {
  it('frö 20260732: 1♥–(1NT): Nord (♥9752, 7 hp) höjer 2♥ (konkurrenshöjning)', () => {
    const deal = dealFromSeed(20260732)
    const c = decideCall(deal, [call('S', '1H'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('2H')
    expect(c.rule).toBe('konkurrenshöjning')
  })

  it('frö 20261612: 1♠–(1NT): Nord (♠J965, 8 hp) höjer 2♠', () => {
    const deal = dealFromSeed(20261612)
    const c = decideCall(deal, [call('N', 'P'), call('E', 'P'), call('S', '1S'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('2S')
  })

  it('frö 20260732 med 10+ hp hos svararen: X = straff', () => {
    // Syd öppnar 1♥, Väst 1NT; ge Nord en 11-poängare utan att röra övriga.
    const base = dealFromSeed(20260732)
    const deal = { ...base, hands: { ...base.hands } }
    // ♠AK5 ♥9752 ♦T85 ♣T53 → byt ♣T53 mot ♣KQ3 (klöverkorten tas från Östs hand är
    // ovidkommande för Nords beslut – decideCall läser bara Nords hand här).
    deal.hands.N = deal.hands.N.map((c) =>
      c.suit === 'clubs' && c.rank === '10' ? { suit: 'clubs', rank: 'K' } :
      c.suit === 'clubs' && c.rank === '5' ? { suit: 'clubs', rank: 'Q' } : c,
    )
    const c = decideCall(deal, [call('S', '1H'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('X')
    expect(c.rule).toBe('straffdubbling')
  })
})

describe('K3 (c) – svararen över ovanlig 2NT / Michaels', () => {
  it('frö 20262021: 1♠–(2NT): Nord (♠QJ76, 6 hp) tävlar 3♠', () => {
    const deal = dealFromSeed(20262021)
    const c = decideCall(deal, [call('S', '1S'), call('W', '2NT')], 'N')
    expect(c.bid).toBe('3S')
    expect(c.rule).toBe('konkurrenshöjning')
  })

  it('frö 20263327: 1♠–(2NT): Nord (♠K9874, 17 stödpoäng) bjuder 4♠ direkt', () => {
    const deal = dealFromSeed(20263327)
    const c = decideCall(deal, [call('S', '1S'), call('W', '2NT')], 'N')
    expect(c.bid).toBe('4S')
  })

  it('frö 20262025: 1♥–(2NT): Nord (♠7 ♥K753, 9 hp = 13 stödpoäng) bjuder 4♥', () => {
    const deal = dealFromSeed(20262025)
    const c = decideCall(deal, [call('N', 'P'), call('E', 'P'), call('S', '1H'), call('W', '2NT')], 'N')
    expect(c.bid).toBe('4H')
  })

  it('frö 20261162: 1♥–(2NT): Öst (♥8764, 14 stödpoäng) bjuder 4♥', () => {
    const deal = dealFromSeed(20261162)
    const c = decideCall(deal, [call('W', '1H'), call('N', '2NT')], 'E')
    expect(c.bid).toBe('4H')
  })
})
