// MOTORBYTET ETAPP 4 FAMILJ 2 — dubblingsfamiljen i beslutstabellen
// (docs/motorbyte-plan.md, 2026-09-08). Facit för det som är NYTT i familjen;
// det som flyttade oförändrat (svaret på X, dubblarens vakter, det starka
// X-flödet) har sina gamla facit-filer kvar (auction-upplysningsx-svar.test.ts,
// auction-stark-x-tva-farger.test.ts, auction-live.test.ts felrapport #23/#40,
// doubles.test.ts) och körs nu genom tabellen.
//
// Nytt i familjen:
//   · raden *dubbling*: även den vanliga 4-4-dubblingen efter två bjudna
//     färger (förr medvetet live-only) — passet lämnas åt det gamla lagret;
//   · raden *x-svar*: den responsiva dubblingen har samma företräde som i
//     manuset, och ett fritt läge utan bud är ett uttryckligt pass;
//   · raden *x-dubblaren*: 3NT över partnerns fria 2NT med 14+ (frö 20270004);
//   · raden *x-advancern*: svaret på dubblarens cue efter min responsiva X
//     (frö 20270461);
//   · familjegränserna: deras FÄRGöppning krävs (DONT-X över 1NT stannar i det
//     gamla lagret), vår egen öppning (negativ/stöd-X) är familj 3.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { CONTESTED_DETECTORS, FORCED_DETECTORS, decideCall, decideCallTraced } from './auction-live'
import { dealFromSeed } from './revisor'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>, vul: Deal['vulnerability'] = 'none'): Deal {
  return { id: 'f2', dealer, vulnerability: vul, board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}
const FYLL = { N: 'S:2345 H:234 D:234 C:234', E: 'S:2345 H:234 D:234 C:234', S: 'S:2345 H:234 D:234 C:234', W: 'S:2345 H:234 D:234 C:234' }
/** Giv där bara `seat`s hand spelar roll (de andra är godtyckliga — tabellen läser dem aldrig). */
function ensam(seat: Seat, hand: string, dealer: Seat = 'N'): Deal {
  const rest = ['S:AKQJ H:AKQ D:AKQ C:AKQ', 'S:T987 H:JT9 D:JT9 C:JT9', 'S:6543 H:876 D:876 C:876']
  const hands = { ...FYLL } as Record<Seat, string>
  let k = 0
  for (const s of ['N', 'E', 'S', 'W'] as Seat[]) hands[s] = s === seat ? hand : rest[k++]
  return dealOf(dealer, hands)
}

describe('raden *dubbling*: X efter två bjudna färger ur tabellen', () => {
  const hist = [call('N', '1D'), call('E', 'P'), call('S', '1H')]
  it('4-4 i de objudna från 10 hp → X (upplysning), källa tabell:dubbling', () => {
    const t = decideCallTraced(ensam('W', 'S:KJ65 H:2 D:QT85 C:AJ53'), hist, 'W') // 11 hp, ♠+♣ 4-4
    expect(t.källa).toBe('tabell:dubbling')
    expect(t.call).toMatchObject({ bid: 'X', rule: 'upplysningsdubbling' })
  })
  it('den starka 17+-enfärgshanden dubblar (X + egen färg nästa varv)', () => {
    const t = decideCallTraced(ensam('W', 'S:AKQJ4 H:A3 D:K87 C:QJT'), hist, 'W') // 20 hp
    expect(t.källa).toBe('tabell:dubbling')
    expect(t.call).toMatchObject({ bid: 'X', rule: 'upplysningsdubbling (stark)' })
  })
  it('passet lämnas åt det gamla lagret (samma stol äger inklivet över svaret — väntar på familj 4:s öppnarrader)', () => {
    const t = decideCallTraced(ensam('W', 'S:K7654 H:2 D:Q85 C:AJ53'), hist, 'W') // 5-korts spader → inte 4-4
    expect(t.källa).not.toBe('tabell:dubbling')
    expect(t.call.bid).toBe('P')
  })
  it('manuset lägger 4-4-dubblingen och lämnar auktionen öppen', () => {
    const d = dealOf('N', {
      N: 'S:972 H:K84 D:AQJ52 C:K6', // 13 hp → 1♦
      E: 'S:AJT6 H:T93 D:T4 C:9732', // passar
      S: 'S:83 H:QJ765 D:963 C:A85', // 7 hp → 1♥
      W: 'S:KQ54 H:A2 D:K87 C:QJT4', // 15 hp, 4-4 ♠/♣
    })
    const built = buildAuction(d)!
    expect(built.turns.map((t) => `${t.seat}:${t.call}`)).toEqual(['N:1D', 'S:1H', 'W:X'])
    expect(built.open).toBe(true)
  })
})

describe('raden *x-svar*: advancerns svar på partnerns upplysningsdubbling', () => {
  it('tvunget svar (RHO passade): 0 hp bjuder längsta objudna färg, källa tabell:x-svar', () => {
    const t = decideCallTraced(ensam('W', 'S:T9876 H:65 D:8743 C:32'), [call('N', '1H'), call('E', 'X'), call('S', 'P')], 'W')
    expect(t.källa).toBe('tabell:x-svar')
    expect(t.call).toMatchObject({ bid: '1S', rule: 'färgbud' })
  })
  it('de höjde över X:et: den responsiva dubblingen går först (7+ hp, stöd i de objudna)', () => {
    const t = decideCallTraced(ensam('W', 'S:K42 H:84 D:Q932 C:K982'), [call('N', '1H'), call('E', 'X'), call('S', '2H')], 'W') // 8 hp
    expect(t.källa).toBe('tabell:x-svar')
    expect(t.call).toMatchObject({ bid: 'X', rule: 'responsiv dubbling' })
  })
  it('de höjde över X:et: utan responsiv form talar det fria svaret (9–11 med stopp → 2NT)', () => {
    const t = decideCallTraced(ensam('W', 'S:K5 H:QT972 D:K9 C:QT86'), [call('N', '1H'), call('E', 'X'), call('S', '2H')], 'W') // 10 hp, 5 hjärter
    expect(t.källa).toBe('tabell:x-svar')
    expect(t.call).toMatchObject({ bid: '2NT', rule: 'fritt svar på upplysningsdubbling' })
  })
  it('de höjde över X:et: en tunn hand utan fritt bud passar UTTRYCKLIGT ur tabellen', () => {
    const t = decideCallTraced(ensam('W', 'S:K42 H:843 D:Q932 C:982'), [call('N', '1H'), call('E', 'X'), call('S', '2H')], 'W') // 5 hp
    expect(t.källa).toBe('tabell:x-svar')
    expect(t.call).toMatchObject({ bid: 'P', rule: 'pass' })
  })
  it('dubblaren svarar partnerns responsiva X på samma rad (12+ → cue)', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', '2H'), call('W', 'X'), call('N', 'P')]
    const t = decideCallTraced(ensam('E', 'S:KJ53 H:64 D:AQ72 C:K93'), hist, 'E') // 13 hp
    expect(t.källa).toBe('tabell:x-svar')
    expect(t.call).toMatchObject({ bid: '3H', rule: 'cue (krav)' })
  })
})

describe('raden *x-dubblaren*: dubblarens senare turer', () => {
  it('svaret på partnerns cue: billigaste 4-korts högfärg (dubblarens svar på cue)', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', 'P'), call('W', '2H'), call('N', 'P')]
    const t = decideCallTraced(ensam('E', 'S:KJ53 H:64 D:AQ72 C:K93'), hist, 'E')
    expect(t.källa).toBe('tabell:x-dubblaren')
    expect(t.call).toMatchObject({ bid: '2S', rule: 'dubblarens svar på cue' })
  })
  it('höjningen av svaret vägs mot vad svaret visade: minimum passar uttryckligt ("dubblaren nöjer sig")', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', 'P'), call('W', '1S'), call('N', 'P')]
    const t = decideCallTraced(ensam('E', 'S:K95 H:72 D:AJ82 C:KT96'), hist, 'E') // 11 hp
    expect(t.källa).toBe('tabell:x-dubblaren')
    expect(t.call).toMatchObject({ bid: 'P', rule: 'dubblaren nöjer sig' })
  })
  it('partnerns hopp (9–11) accepteras till utgång med 15+ stödpoäng', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', 'P'), call('W', '2S'), call('N', 'P')]
    const t = decideCallTraced(ensam('E', 'S:KQ95 H:7 D:AK82 C:KT96'), hist, 'E') // 15 hp + singel
    expect(t.källa).toBe('tabell:x-dubblaren')
    expect(t.call).toMatchObject({ bid: '4S', rule: 'dubblaren accepterar inbjudan' })
  })
  it('det starka återbudet (17+, egen färg billigast) kommer ur tabellen', () => {
    const hist = [call('N', 'P'), call('E', '1C'), call('S', 'X'), call('W', 'P'), call('N', '1H'), call('E', 'P')]
    const t = decideCallTraced(ensam('S', 'S:AKQ7653 H:Q4 D:Q54 C:A'), hist, 'S') // 17 hp
    expect(t.källa).toBe('tabell:x-dubblaren')
    expect(t.call).toMatchObject({ bid: '1S', rule: 'starkt återbud' })
  })
  it('frö 20270004: 3NT över partnerns fria 2NT med 14+ (facit-kön)', () => {
    const hist = [call('N', 'P'), call('E', '1S'), call('S', 'X'), call('W', '2S'), call('N', '2NT'), call('E', 'P')]
    const t = decideCallTraced(dealFromSeed(20270004), hist, 'S')
    expect(t.källa).toBe('tabell:x-dubblaren')
    expect(t.call).toMatchObject({ bid: '3NT', rule: 'dubblaren höjer till 3NT' })
    // … och med 13 hp nöjer sig dubblaren (uttryckligt pass).
    expect(decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:QJ98', 'N'), hist, 'S').call).toMatchObject({ bid: 'P', rule: 'dubblaren nöjer sig' })
  })
})

describe('raden *x-advancern*: advancerns senare bud', () => {
  it('frö 20270461: svaret på dubblarens cue efter min responsiva X (facit-kön)', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', '2H'), call('W', 'X'), call('N', 'P'), call('E', '3H'), call('S', 'P')]
    const t = decideCallTraced(dealFromSeed(20270461), hist, 'W')
    expect(t.källa).toBe('tabell:x-advancern')
    expect(t.call).toMatchObject({ bid: '3S', rule: 'svar på dubblarens cue' })
  })
  it('stödstegen på det starka återbudet (tvång) kommer ur tabellen', () => {
    const d = dealOf('N', {
      N: 'S:972 H:K84 D:AQJ52 C:K6',
      E: 'S:T65 H:T92 D:T4 C:97432', // 0 hp, 3 spader → enkel höjning
      S: 'S:83 H:QJ765 D:963 C:A85',
      W: 'S:AKQJ4 H:A3 D:K87 C:QJT', // 20 hp → X, sedan 2♠
    })
    const hist = [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', 'X'), call('N', 'P'), call('E', '2C'), call('S', 'P'), call('W', '2S'), call('N', 'P')]
    const t = decideCallTraced(d, hist, 'E')
    expect(t.källa).toBe('tabell:x-advancern')
    expect(t.call).toMatchObject({ bid: '3S', rule: 'stödhöjning – enkel höjning (minimum)' })
  })
})

describe('deras X av vårt svar: systems on i den ostörda linjen', () => {
  // Revisorintervallets fynd (frö 20261592, 20260836, 20261707): utan detta föll
  // öppnarens återbud till det gamla lagrets catch-all (3NT på 14 hp, 2NT på 12,
  // hopp till 3♠ på 13). X:et tar ingen budyta — öppnaren bjuder som ostört.
  it('öppnarens återbud efter 1♣–P–1♥–X är det vanliga (1NT 12–14), källa tabell:återbud', () => {
    const hist = [call('S', '1C'), call('W', 'P'), call('N', '1H'), call('E', 'X')]
    const t = decideCallTraced(ensam('S', 'S:KJ4 H:T6 D:T95 C:AKQJT', 'S'), hist, 'S') // 14 hp balanserad
    expect(t.källa).toBe('tabell:återbud')
    expect(t.call).toMatchObject({ bid: '1NT', rule: '1NT (12–14)' })
    const raise = decideCallTraced(ensam('E', 'S:KT74 H:QJT D:Q63 C:A94', 'E'), [call('E', '1C'), call('S', 'P'), call('W', '1S'), call('N', 'X')], 'E') // 13 hp, 4 spader
    expect(raise.källa).toBe('tabell:återbud')
    expect(raise.call).toMatchObject({ bid: '2S', rule: 'enkel höjning' })
  })
  it('svararens andra bud efter det fortsätter ur raden svar2', () => {
    const hist = [call('S', '1C'), call('W', 'P'), call('N', '1H'), call('E', 'X'), call('S', '1NT'), call('W', 'P')]
    const t = decideCallTraced(ensam('N', 'S:Q7 H:KQ962 D:J432 C:65', 'S'), hist, 'N') // 8 hp, 5 hjärter
    expect(t.källa).toBe('tabell:svar2')
    expect(t.call.bid).toBe('P')
  })
  it('ett inkliv (kontraktsbud) från dem är inte samma sak — raden tiger', () => {
    const t = decideCallTraced(ensam('S', 'S:KJ4 H:T6 D:T95 C:AKQJT', 'S'), [call('S', '1C'), call('W', 'P'), call('N', '1H'), call('E', '1S')], 'S')
    expect(t.källa).not.toBe('tabell:återbud')
  })
})

describe('familjegränserna', () => {
  it('negativ dubbling på vår egen öppning är familj 3 — inte x-raderna', () => {
    const t = decideCallTraced(ensam('N', 'S:AQ752 H:K3 D:983 C:K62'), [call('N', '1S'), call('E', '2C'), call('S', 'X'), call('W', 'P')], 'N')
    expect(t.källa).not.toMatch(/^tabell:(x-|dubbling)/)
  })
  it('DONT-X över deras 1NT stannar i det gamla lagret (familj 6): reläet rättas, inte "starkt återbud"', () => {
    const hist = [call('N', '1NT'), call('E', 'X'), call('S', 'P'), call('W', '2C'), call('N', 'P')]
    const t = decideCallTraced(ensam('E', 'S:AKQ963 H:A3 D:K87 C:JT'), hist, 'E') // 17 hp, 6 spader
    expect(t.källa).not.toMatch(/^tabell:(x-|dubbling)/)
    expect(t.call.bid).toBe('2S')
  })
  it('utan X på vår sida tiger x-raderna (inklivsfamiljen äger läget)', () => {
    const t = decideCallTraced(ensam('W', 'S:K93 H:T72 D:K97 C:QT86'), [call('N', '1H'), call('E', '1S'), call('S', 'P')], 'W')
    expect(t.källa).toBe('tabell:advance')
  })
})

describe('det gamla lagret: familjens detektorer är rivna', () => {
  it('dubblingsdetektorerna finns inte längre i FORCED_/CONTESTED_DETECTORS', () => {
    const ids = new Set([...FORCED_DETECTORS, ...CONTESTED_DETECTORS].map((d) => d.id))
    for (const gone of ['takeoutDoubleToAnswer', 'takeoutDoubleOverbidToAnswer', 'advancerCueToAnswer', 'doublerRaisesAdvance', 'maybeTakeoutOfResponse', 'ownStrongDoubleRebid', 'advanceStrongDoubleRebid', 'strongDoublerSecondRebid', 'answerStrongDoubleGameForce', 'advancerCompetesToFit']) {
      expect(ids.has(gone), gone).toBe(false)
    }
  })
  it('decideCall och decideCallTraced ger samma bud (samma beslut, vägen synlig)', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', 'P')]
    const d = ensam('W', 'S:T9876 H:65 D:8743 C:32')
    expect(decideCall(d, hist, 'W')).toEqual(decideCallTraced(d, hist, 'W').call)
  })
})
