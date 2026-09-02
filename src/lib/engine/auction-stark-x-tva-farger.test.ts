// FACIT-TEST för F6 (C5 + C14 i docs/budsystem-revision.md) — körordningens
// sista punkt.
//
// C5 — STARK 17+ ENFÄRG EFTER TVÅ BJUDNA FÄRGER (§7.3): när motståndarna bjudit
// två 1-lägesfärger (öppning + svar i ny färg, t.ex. 1♦–P–1♥) ska en 17+ hand
// med egen 5+ OBJUDEN färg upplysningsdubbla (X, rondkrav) och visa färgen på
// nästa varv — precis som över enbart öppningen (felrapport #23). Hålet
// (senare.md 2026-07-05): den generativa linjen i `buildAuction` modellerade
// aldrig den här ronden, så spelarens pass låg INBAKAT i linjen och decideCall
// följde det — live-detektorn `maybeTakeoutOfResponse` (som bara gjorde 4-4)
// nåddes aldrig on-book. Fixen: (1) linjen modellerar den starka dubblingen,
// (2) live-detektorn kan även den starka handen (för off-book-lägen).
// 4-4-dubblingen förblir MEDVETET live-only (regressionsvakten sist).
//
// C14 — LINJEN FÅR ALDRIG PASSA UT ETT OSTÖRT TVÅFÄRGSINKLIV (§7.2): lagat i
// roten redan 2026-07-04 (felrapport #14), men revisionstabellen stod kvar på
// 🔴 — testet här LÅSER själva linjebygget (inte bara decideCall som #14-testet).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { decideCall } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

// N öppnar 1♦ (kanoniskt), Öst passar, Syd svarar 1♥ — och VÄST sitter med
// 20 hp och 5-korts spader: för stark för ett inkliv som kan passas ut.
const STARK = dealOf('N', {
  N: 'S:972 H:K84 D:AQJ52 C:K6',    // 13 hp, 5 ruter → öppnar 1♦
  E: 'S:T65 H:T92 D:T4 C:97432',    // 0 hp → passar allt
  S: 'S:83 H:QJ765 D:963 C:A85',    // 7 hp, 5 hjärter → svarar 1♥
  W: 'S:AKQJ4 H:A3 D:K87 C:QJT',    // 20 hp, 5 spader → X (stark)
})

describe('F6/C5: stark 17+ enfärg efter två bjudna färger — kanoniska linjen', () => {
  it('linjen modellerar Västs X efter 1♦–P–1♥ (rondkrav, linjen lämnas öppen)', () => {
    const built = buildAuction(STARK)
    expect(built).not.toBeNull()
    const w = built!.turns.find((t) => t.seat === 'W')
    expect(w?.call).toBe('X')
    expect(w?.rule).toBe('upplysningsdubbling (stark)')
    expect(built!.open).toBe(true)
  })

  it('on-book decideCall följer linjen: Väst dubblar (passet är inte längre inbakat)', () => {
    const w = decideCall(STARK, [call('N', '1D'), call('E', 'P'), call('S', '1H')], 'W')
    expect(w.bid).toBe('X')
    expect(w.rule).toBe('upplysningsdubbling (stark)')
  })

  it('tvångssvaret: Öst (0 hp) svarar i längsta OBJUDNA färg (2♣), aldrig pass', () => {
    const history = [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', 'X'), call('N', 'P')]
    const e = decideCall(STARK, history, 'E')
    expect(e.bid).toBe('2C')
  })

  it('det starka återbudet: Väst visar sedan sin spader billigast (2♠, rondkrav)', () => {
    const history = [
      call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', 'X'),
      call('N', 'P'), call('E', '2C'), call('S', 'P'),
    ]
    const w = decideCall(STARK, history, 'W')
    expect(w.bid).toBe('2S')
    expect(w.rule).toBe('starkt återbud')
  })
})

describe('F6/C5: den starka dubblingen fungerar även OFF-BOOK (live-detektorn)', () => {
  // Nords kanoniska öppning är 1NT (16 hp balanserad) — historiken 1♦–P–1♥ är
  // alltså off-book och svaret måste komma ur detektorkedjan, inte linjen.
  const OFFBOOK = dealOf('N', {
    N: 'S:K72 H:K84 D:AQJ5 C:K96',    // 16 hp balanserad → kanoniskt 1NT
    E: 'S:T953 H:J92 D:T432 C:74',    // 1 hp
    S: 'S:QJ86 H:QT765 D:96 C:83',    // svarar 1♥ i historiken
    W: 'S:A4 H:A3 D:K87 C:AQJT52',    // 18 hp, 6 klöver → X (stark)
  })

  it('1♦–P–1♥ off-book: Väst med 18 hp och 6-korts klöver dubblar', () => {
    const w = decideCall(OFFBOOK, [call('N', '1D'), call('E', 'P'), call('S', '1H')], 'W')
    expect(w.bid).toBe('X')
    expect(w.rule).toBe('upplysningsdubbling (stark)')
  })
})

describe('F6/C5 regressionsvakt: 4-4-dubblingen är MEDVETET fortsatt live-only', () => {
  // Samma läge (1♦–P–1♥ on-book) men Väst har "bara" ett vanligt 15 hp 4-4-X.
  // Linjen modellerar INTE den vanliga dubblingen (ett eget, större beslut —
  // den ändrar en stor andel ostörda linjer); den fyrar som förr bara live/off-book.
  const FYRAFYRA = dealOf('N', {
    N: 'S:972 H:K84 D:AQJ52 C:K6',    // 13 hp → 1♦
    E: 'S:AJT6 H:T93 D:T4 C:9732',    // 5 hp, ingen kvalitetsfärg → passar
    S: 'S:83 H:QJ765 D:963 C:A85',    // 7 hp → 1♥
    W: 'S:KQ54 H:A2 D:K87 C:QJT4',    // 15 hp, 4-4 spader/klöver — under 17
  })

  it('linjen har ingen Väst-tur och on-book-passet står kvar', () => {
    const built = buildAuction(FYRAFYRA)
    expect(built).not.toBeNull()
    expect(built!.turns.find((t) => t.seat === 'W')).toBeUndefined()
    const w = decideCall(FYRAFYRA, [call('N', '1D'), call('E', 'P'), call('S', '1H')], 'W')
    expect(w.bid).toBe('P')
  })
})

describe('F6/C14: linjen passar aldrig ut ett ostört tvåfärgsinkliv (låser #14-fixen)', () => {
  // Felrapport #14-given: V öppnar 1♠, Nord kliver in ovanlig 2NT (båda minor-
  // färgerna), Öst passar — Syd (8 hp, 6-korts ruter) MÅSTE ge preferens i
  // SJÄLVA LINJEBYGGET (buildAuction), inte bara i decideCall.
  // (Pliktsvepet K3, 2026-09-02: Öst hade ursprungligen ♠AJT2 + 11 hp och
  // passar inte längre 2NT — svararen höjer 4♠ med 4-korts stöd och 10+
  // stödpoäng. Öst har därför fått ♠JT + 7-korts hjärter så passet består och
  // preferensplikten prövas; det gamla läget låses separat nedan.)
  const TVAFARG = dealOf('W', {
    N: 'S:65 H:3 D:QJT97 C:A8643',
    E: 'S:JT H:KJ98752 D:A2 C:J9',
    S: 'S:3 H:AT6 D:K86543 C:QT2',
    W: 'S:AKQ98742 H:Q4 D:- C:K75',
  })

  it('linjen 1♠–2NT–P fortsätter med Syds preferens 3♦ och lämnas öppen', () => {
    const built = buildAuction(TVAFARG)
    expect(built).not.toBeNull()
    const e = built!.turns.find((t) => t.seat === 'E')
    expect(e?.call).toBe('P')
    const s = built!.turns.find((t) => t.seat === 'S')
    expect(s?.call).toBe('3D')
    expect(s?.rule).toBe('advance tvåfärg (preferens)')
    expect(built!.open).toBe(true)
  })

  it('K3: svararen med ♠AJT2 och 11 hp höjer 4♠ över 2NT i linjen — och linjen lämnas öppen', () => {
    const deal = dealOf('W', {
      N: 'S:65 H:3 D:QJT97 C:A8643',
      E: 'S:AJT2 H:KJ872 D:A2 C:J9',
      S: 'S:3 H:AT6 D:K86543 C:QT2',
      W: 'S:KQ9874 H:Q954 D:- C:K75',
    })
    const built = buildAuction(deal)
    expect(built).not.toBeNull()
    const e = built!.turns.find((t) => t.seat === 'E')
    expect(e?.call).toBe('4S')
    expect(e?.rule).toBe('höjning till utgång')
    expect(built!.open).toBe(true)
  })
})
