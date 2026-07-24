// FACIT-TEST för ETAPP 5 (missad utgång) FIX 1, se docs/systemrevisorn.md:
// **svararens höjning av öppnarens ANDRA färg graderas inte.**
//
// I `fourthSuit` (responder-rebids.ts, §6.6) returnerade steg 1 alltid den
// BILLIGASTE höjningen så snart svararen hade 4+ kort i öppnarens andra färg —
// oavsett styrka. En 13–15-hand med fyrkortsstöd sa alltså 2♠ precis som en
// 6-hand, öppnaren passade på minimum och utgången försvann.
//
// Systemrevisorns frön (frö 20260721-serien, mätning #8):
//  - 20260748: `1♣–1♥–1♠–2♠` med 13 hp + 4 spaderstöd hos svararen (W) →
//    2♠ elva stick, tapp 460.
//  - 20261646: `1♦–1♥–1♠–2♠` med 15 hp + 4 spaderstöd (N) → 2♠ tio stick,
//    tapp 450 (utgång fanns).
//
// Facit: samma stege som alla andra höjningar i systemet, räknad på
// STÖDPOÄNG (`pointsWithFloor(..., 'support')`):
//   under 10 → billigaste höjning · 10–12 → hopphöjning (inbjudan) · 13+ → utgång.
// Gäller HÖGFÄRGS-fit i en icke-reverse-sekvens. Minorhöjningen är oförändrad
// (billigaste minorhöjning ligger redan på 3-läget) och efter en reverse
// (öppnaren 17+) är den billigaste höjningen redan krav → grada inte där.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'
import { decideCall } from './auction-live'
import { responderRebidColorAuction } from './responder-rebids'
import { openerRebidAfter1NTResponse, openerThirdBidAfterSemiForcing1NT } from './rebids'
import type { Major } from './responses'

function deal(
  id: string,
  dealer: Deal['dealer'],
  vulnerability: Deal['vulnerability'],
  hands: Record<'N' | 'E' | 'S' | 'W', string>,
): Deal {
  return {
    id,
    board: 1,
    dealer,
    vulnerability,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

/** Svararens andra bud i en färgauktion (samma hjälpare som responder-rebids.test.ts). */
const r12 = (notation: string, opened: Suit, responderSuit: Suit, rebidCall: string, rebidRule: string): string =>
  responderRebidColorAuction(parseHand(notation), opened, responderSuit, {
    call: rebidCall,
    rule: rebidRule,
    explanation: '',
  })?.call ?? 'null'

/** Öppnarens tredje bud efter semi-forcing 1NT (1M–1NT–<återbud>–<svararens bud>). */
const third = (notation: string, M: Major, rebidCall: string, secondCall: string): string =>
  openerThirdBidAfterSemiForcing1NT(
    parseHand(notation),
    M,
    { call: rebidCall, rule: '', explanation: '' },
    { call: secondCall, rule: 'inbjudan', explanation: '' },
  )?.call ?? 'null'

/** 1NT-öppnarens svar på den direkta 2NT-inbjudan. */
const nt = (notation: string): string =>
  openerRebidAfter1NTResponse(
    { call: '2NT', rule: '2NT inbjudan', explanation: '' },
    parseHand(notation),
  )?.call ?? 'null'

// ---- Frö 20260748: 1♣–1♥–1♠ och svararen har 13 hp + 4 spader ---------------

const HANDS_748 = {
  N: 'S:KJ6 H:Q84 D:T952 C:K86',
  E: 'S:AT52 H:9 D:84 C:AQJT73',
  S: 'S:Q7 H:T7532 D:KQ73 C:92',
  W: 'S:9843 H:AKJ6 D:AJ6 C:54',
}
const HISTORY_748: ResolvedCall[] = [
  call('E', '1C'), call('S', 'P'), call('W', '1H'), call('N', 'P'),
  call('E', '1S'), call('S', 'P'),
]

// ---- Frö 20261646: 1♦–1♥–1♠ och svararen har 15 hp + 4 spader ---------------

const HANDS_1646 = {
  N: 'S:A942 H:AKJT5 D:Q C:962',
  E: 'S:J73 H:986 D:854 C:AKQ8',
  S: 'S:QT85 H:Q D:AK9763 C:54',
  W: 'S:K6 H:7432 D:JT2 C:JT73',
}
const HISTORY_1646: ResolvedCall[] = [
  call('S', '1D'), call('W', 'P'), call('N', '1H'), call('E', 'P'),
  call('S', '1S'), call('W', 'P'),
]

describe('etapp 5 fix 1: höjningen av öppnarens andra färg graderas efter stödpoäng', () => {
  it('frö 20260748-läget: W (13 hp, 4 spaderstöd) bjuder utgång 4♠, inte 2♠', () => {
    const d = deal('utgang-20260748-pos', 'E', 'ew', HANDS_748)
    expect(decideCall(d, HISTORY_748, 'W').bid).toBe('4S')
  })

  it('frö 20260748 hela auktionen: utgång nås (4♠)', () => {
    const d = deal('utgang-20260748', 'E', 'ew', HANDS_748)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 4, strain: 'spades' })
  })

  it('frö 20261646-läget: N (15 hp, 4 spaderstöd) bjuder utgång 4♠, inte 2♠', () => {
    const d = deal('utgang-20261646-pos', 'S', 'ns', HANDS_1646)
    expect(decideCall(d, HISTORY_1646, 'N').bid).toBe('4S')
  })

  it('frö 20261646 hela auktionen: N/S når utgång', () => {
    const d = deal('utgang-20261646', 'S', 'ns', HANDS_1646)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)?.level).toBeGreaterThanOrEqual(4)
  })
})

describe('etapp 5 fix 1: hela stegen (1♣–1♥–1♠–?)', () => {
  it('minimum (7 hp, 4 stöd) → billigaste höjning 2♠', () => {
    expect(r12('S:K843 H:QJ76 D:952 C:74', 'clubs', 'hearts', '1S', 'ny färg (1-läget)')).toBe('2S')
  })

  it('inbjudan (11 hp, 4 stöd) → hopphöjning 3♠', () => {
    expect(r12('S:K843 H:AJ76 D:Q95 C:74', 'clubs', 'hearts', '1S', 'ny färg (1-läget)')).toBe('3S')
  })

  it('utgångsvärden (13 hp, 4 stöd) → 4♠', () => {
    expect(r12('S:K843 H:AQ76 D:KJ5 C:74', 'clubs', 'hearts', '1S', 'ny färg (1-läget)')).toBe('4S')
  })

  it('korthet lyfter (11 hp, 4 stöd, singel) → 4♠ på stödpoäng', () => {
    expect(r12('S:K843 H:AQ765 D:9 C:8742', 'clubs', 'hearts', '1S', 'ny färg (1-läget)')).toBe('4S')
  })
})

// ---- FIX 2: öppnaren svarar aldrig på svararens inbjudan efter semi-forcing 1NT

// Frö 20260843: `1♠–1NT–2♠–2NT` och öppnaren (N) har 14 hp med AQT863 i spader.
// Den kanoniska linjen slutade vid svararens 2NT → öppnarens svar föll till
// off-book-lagret som PASSADE. Facit: 2NT rättas alltid till högfärgen (6+ kort
// lovade av 2♠-återbudet), och med utgångsvärden går det hela vägen till 4♠
// (620 fanns). Samma stege besvarar 3M-limithöjningen.
const HANDS_843 = {
  N: 'S:AQT863 H:AK2 D:J4 C:98',
  E: 'S:92 H:Q965 D:QT C:Q6542',
  S: 'S:K4 H:J743 D:AK876 C:73',
  W: 'S:J75 H:T8 D:9532 C:AKJT',
}
const HISTORY_843: ResolvedCall[] = [
  call('N', '1S'), call('E', 'P'), call('S', '1NT'), call('W', 'P'),
  call('N', '2S'), call('E', 'P'), call('S', '2NT'), call('W', 'P'),
]

describe('etapp 5 fix 2: öppnaren besvarar inbjudan efter semi-forcing 1NT', () => {
  it('frö 20260843-läget: N (14 hp, 6-korts spader) accepterar → 4♠, passar inte 2NT', () => {
    const d = deal('utgang-20260843-pos', 'N', 'ns', HANDS_843)
    expect(decideCall(d, HISTORY_843, 'N').bid).toBe('4S')
  })

  it('frö 20260843 hela auktionen: utgång 4♠ nås', () => {
    const d = deal('utgang-20260843', 'N', 'ns', HANDS_843)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 4, strain: 'spades' })
  })

  it('minimum (12 hp, 6-korts spader) rättar 2NT till 3♠ i stället för att passa', () => {
    expect(third('S:AQT863 H:K42 D:J4 C:98', 'spades', '2S', '2NT')).toBe('3S')
  })

  it('3-korts limithöjning (1♠–1NT–2♠–3♠): utgångsvärden → 4♠', () => {
    expect(third('S:AQT863 H:AK2 D:J4 C:98', 'spades', '2S', '3S')).toBe('4S')
  })

  it('3-korts limithöjning mot minimum → pass (delkontrakt)', () => {
    expect(third('S:QT8632 H:K42 D:J4 C:98', 'spades', '2S', '3S')).toBe('P')
  })

  it('inbjudan efter ny färg (1♠–1NT–2♦–2NT): maximum → 3NT', () => {
    expect(third('S:AQT86 H:K2 D:KQ74 C:98', 'spades', '2D', '2NT')).toBe('3NT')
  })

  it('inbjudan efter ny färg mot minimum → pass', () => {
    expect(third('S:AQT86 H:32 D:KQ74 C:98', 'spades', '2D', '2NT')).toBe('P')
  })
})

// ---- FIX 3 (ÄGARBESLUT 2026-07-24): 1NT-öppnarens "bra 15" ------------------

// Frö 20260744 (`1NT–2NT–P`): öppnaren N har ♠T72 ♥A83 ♦QT97 ♣AKQ = 15 hp och
// passade inbjudan (startpoängen drog ner den platta 4-3-3-3-formen). 3NT var
// hemma (600). Ägarens val: 15 accepteras BARA som kvalitets-15 — tät
// honnörsklump (AKQ) eller femkortsfärg — aldrig som generellt sänkt golv.
const HANDS_744 = {
  N: 'S:T72 H:A83 D:QT97 C:AKQ',
  E: 'S:64 H:KT94 D:AJ53 C:J54',
  S: 'S:A9 H:J65 D:K862 C:9873',
  W: 'S:KQJ853 H:Q72 D:4 C:T62',
}

describe('etapp 5 fix 3: 1NT-öppnarens accept av 2NT-inbjudan (ägarbeslut: kvalitets-15)', () => {
  it('frö 20260744 hela auktionen: 15 hp med AKQ accepterar → 3NT', () => {
    const d = deal('utgang-20260744', 'N', 'ns', HANDS_744)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 3, strain: 'NT' })
  })

  it('femkortsfärg lyfter också en 15:a → 3NT', () => {
    expect(nt('S:AQ743 H:K7 D:KJ5 C:Q92')).toBe('3NT')
  })

  it('platt quack-15 utan kvalitet passar fortfarande', () => {
    expect(nt('S:QJ4 H:KQ3 D:QJ85 C:A32')).toBe('P')
  })

  it('16 hp accepterar som förut', () => {
    expect(nt('S:KQ4 H:AQ3 D:QJ85 C:AJ2')).toBe('3NT')
  })
})

describe('etapp 5 fix 1: regressionsvakter (oförändrat utanför högfärgsstegen)', () => {
  it('minorfit höjs fortfarande billigast (1♦–1♠–2♣ med 5 klöver → 3♣)', () => {
    expect(r12('S:AK85 H:32 D:52 C:KQ842', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('3C')
  })

  it('efter en reverse (öppnaren 17+) höjs högfärgen billigast — krav, plats kvar för slam', () => {
    expect(r12('S:K842 H:KQ85 D:7 C:A963', 'diamonds', 'spades', '2H', 'reverse')).toBe('3H')
  })

  it('utan fit i andra färgen står fjärde färg krav kvar (13 hp)', () => {
    expect(r12('S:AK85 H:432 D:Q52 C:K53', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('2H')
  })
})
