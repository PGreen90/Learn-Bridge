// FACIT FÖRE FIX — felrapporterna #125 och #126 (2026-11-13/15).
// Hp räknade med kod (hcp/parseHand), summa 40 och 13 kort per hand.
//
// #125 (Dagens MP% nr 104, giv 8, Väst giv, ingen i zon): "Nord svarar att han
//   har noll eller tre keycards, men han har ett. Trumfen är satt till ruter när
//   Nord visar kontrollbud i spader — budstödet rekommenderar 5♠ (återgå till
//   trumffärgen), men trumf är ruter."
//     Väst   Nord   Öst    Syd
//     pass   pass   pass   2♣
//     pass   2NT    pass   3♦
//     pass   4♠     pass   4NT        ← Syd (människan) frågar ess
//     pass   5♦ ??? pass   5♠ ???
//   Två hål: (1) slamraden kände bara KAPTENENS (svararens) 4NT — öppnarens 4NT
//   mitt i kontrollbudsronden lästes inte som essfråga och Nord "avslutade i
//   utgång" (5♦ råkade se ut som svaret 0/3). (2) frågarens trumf lästes som
//   sidans senaste FÄRGBUD rakt av (4♠, kontrollbudet) i stället för den senast
//   ÄKTA bjudna färgen (ruter, §6.1).
//   Rätt: Nord 5♣ (ett nyckelkort, 1430) · Syd 6♦ (fyra nyckelkort + trumfdam).
//
// #126 (Dagens MP% nr 106, giv 2, Öst giv, NS i zon): "Jag bjuder stöddubbling.
//   Partner får inte passa efter en stöddubbling."
//     Öst    Syd    Väst   Nord
//     pass   1♣     1♦     1♠
//     2♦     X      pass   pass ???
//   Hålet: stöddubblingens fönster krävde exakt tre kontraktsbud (1x–(P)–1M–
//   (inkliv)). Med inkliv FÖRE svaret och höjning efter (fyra kontraktsbud) fanns
//   varken dubblingen (Syd: "pass (ingen regel)") eller svaret (Nord likaså).
//   Rätt: samma struktur som §7.4 — Syd X (exakt tre spader), Nord svarar.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { interpretCall } from './auction-interpret'
import { decideCall } from './auction-live'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
type Zon = Deal['vulnerability']
const giv = (id: string, dealer: Seat, vulnerability: Zon, n: string, e: string, s: string, w: string): Deal =>
  ({ id, board: 1, dealer, vulnerability, hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) } })
const hpKoll = (d: Deal, facit: number[]) => {
  const hp = ORDER.map((s) => hcp(d.hands[s]))
  expect(hp).toEqual(facit)
  expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
  for (const s of ORDER) expect(d.hands[s]).toHaveLength(13)
}

describe('felrapport #125 – öppnarens 4NT efter partnerns kontrollbud är essfråga i den ÄKTA färgen', () => {
  const D = giv('fr125', 'W', 'none', 'S:A97 H:QT7 D:763 C:QT87', 'S:T863 H:A962 D:9 C:J532', 'S:K54 H:K4 D:AKQT8 C:AK6', 'S:QJ2 H:J853 D:J542 C:94')
  const FORE = 'P P P 2C P 2NT P 3D P 4S P'
  it('händerna räknade med kod: 8 · 5 · 22 · 5 = 40', () => hpKoll(D, [8, 5, 22, 5]))

  it('motorn bjuder som i rapporten fram till kontrollbudet 4♠', () => {
    expect(decideCall(D, H('W', 'P P P'), 'S').bid).toBe('2C')
    expect(decideCall(D, H('W', 'P P P 2C P'), 'N').bid).toBe('2NT')
    expect(decideCall(D, H('W', 'P P P 2C P 2NT P'), 'S').bid).toBe('3D')
    const cue = decideCall(D, H('W', 'P P P 2C P 2NT P 3D P'), 'N')
    expect(cue.bid).toBe('4S')
    expect(cue.rule).toBe('cue-bid')
  })

  it('Nord svarar på essfrågan: 5♣ = ett nyckelkort (♠A), ruter som trumf', () => {
    const c = decideCall(D, H('W', FORE + ' 4NT P'), 'N')
    expect(c.bid).toBe('5C')
    expect(c.rule).not.toBe('cue: avslut')
  })

  it('Syd efter 5♣ (1 eller 4): fyra nyckelkort + trumfdamen → 6♦', () => {
    const c = decideCall(D, H('W', FORE + ' 4NT P 5C P'), 'S')
    expect(c.bid).toBe('6D')
  })

  it('Syd efter ett 5♦-svar (0 eller 3 — bara 0 möjligt): två nyckelkort saknas → pass, ALDRIG 5♠', () => {
    const c = decideCall(D, H('W', FORE + ' 4NT P 5D P'), 'S')
    expect(c.bid).toBe('P')
    expect(c.explanation ?? '').not.toMatch(/♠/)
  })

  it('Nord passar lillslammen', () => {
    expect(decideCall(D, H('W', FORE + ' 4NT P 5C P 6D P'), 'N').bid).toBe('P')
  })

  it('förklaringarna ur auktionen: 4NT frågar med ruter som trumf, 5♣ är ett nyckelkortssvar', () => {
    const h = H('W', FORE + ' 4NT P 5C')
    expect(interpretCall(h, h.length - 3).text).toMatch(/ruter som trumf/)
    expect(interpretCall(h, h.length - 1).text).toMatch(/nyckelkort/i)
  })

  it('motvikt: Nord med två nyckelkort utan trumfdam svarar 5♥', () => {
    const tva = { ...D, hands: { ...D.hands, N: parseHand('S:A97 H:AT7 D:763 C:T987') } }
    expect(decideCall(tva, H('W', FORE + ' 4NT P'), 'N').bid).toBe('5H')
  })
})

describe('felrapport #126 – stöddubblingen gäller även när båda motståndarna bjudit (inkliv + höjning)', () => {
  const D = giv('fr126', 'E', 'ns', 'S:AKQJ83 H:T6 D:9873 C:Q', 'S:T4 H:KJ82 D:QJ6 C:JT62', 'S:962 H:A953 D:5 C:AK543', 'S:75 H:Q74 D:AKT42 C:987')
  const FORE = 'P 1C 1D 1S 2D'
  it('händerna räknade med kod: 12 · 8 · 11 · 9 = 40', () => hpKoll(D, [12, 8, 11, 9]))

  it('motorn bjuder som i rapporten fram till höjningen 2♦', () => {
    expect(decideCall(D, H('E', 'P'), 'S').bid).toBe('1C')
    expect(decideCall(D, H('E', 'P 1C'), 'W').bid).toBe('1D')
    expect(decideCall(D, H('E', 'P 1C 1D'), 'N').bid).toBe('1S')
    expect(decideCall(D, H('E', 'P 1C 1D 1S'), 'E').bid).toBe('2D')
  })

  it('Syd (exakt tre spader) stöddubblar', () => {
    const c = decideCall(D, H('E', FORE), 'S')
    expect(c.bid).toBe('X')
    expect(c.rule).toMatch(/stöddubbling/i)
  })

  it('Nord passar ALDRIG stöddubblingen: 12 hp + sex spader → 4♠', () => {
    const c = decideCall(D, H('E', FORE + ' X P'), 'N')
    expect(c.bid).toBe('4S')
    expect(c.rule).toBe('svar på stöddubbling')
  })

  it('minimum svarar 2♠, inbjudan 3♠ (ägarens struktur: 2♠ / 3♠ / 4♠)', () => {
    const svag = { ...D, hands: { ...D.hands, N: parseHand('S:KJ832 H:T6 D:9873 C:Q2') } }
    expect(decideCall(svag, H('E', FORE + ' X P'), 'N').bid).toBe('2S')
    // Efter lågfärgsöppningen är 3M alltid FYRA kort (fem kort med inbjudan går 4M direkt, §7.4).
    const invit = { ...D, hands: { ...D.hands, N: parseHand('S:KQ83 H:K6 D:9873 C:Q32') } }
    expect(decideCall(invit, H('E', FORE + ' X P'), 'N').bid).toBe('3S')
  })

  it('Syd (minimum) passar utgången', () => {
    expect(decideCall(D, H('E', FORE + ' X P 4S P'), 'S').bid).toBe('P')
  })

  it('motvikt: fyra spader hos Syd → höjning, inte dubbling', () => {
    const fyra = { ...D, hands: { ...D.hands, S: parseHand('S:9762 H:A95 D:5 C:AK543') } }
    expect(decideCall(fyra, H('E', FORE), 'S').bid).not.toBe('X')
  })
})
