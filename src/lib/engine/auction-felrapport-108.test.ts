// FACIT FÖRE FIX — felrapport #108 (2026-11-01, Dagens IMP bricka 1, Nord giv,
// ingen i zon): "TOTALKRASCH" I SLAMUTREDNINGEN EFTER 1♥–1NT–3♦.
//
//   Nord   Öst    Syd    Väst
//   1♥     pass   1NT    pass
//   3♦     pass   4♦     pass      ← Syd (människa): sätter trumfen, slamintresse
//   4♥     pass   4♠     pass      ← Nord cue:ade (av en slump), Syd cue:ade
//   pass ???                       ← Nord passade partnerns kontrollbud → 4♠!
//
// Nord ♠8 ♥AKQT5 ♦KT64 ♣AQ3 (18 hp) · Syd ♠K62 ♥73 ♦AJ9875 ♣98 (8 hp).
// Två hål, båda i LÄSNINGEN av auktionen (ärlig inferens — ingen hand kikas):
//  1. Slamgrenens läsare (`slamSituationSpecifik`, steg 5 2026-10-09) kände bara
//     hoppskiftet efter ett FÄRGSVAR ('hoppskift', 19+); efter 1M–1NT heter det
//     'rebid: hoppskift' (16+) i motorn → ingen slamgren → Nords 4♥ kom från
//     reservregeln "krav – rebjuder egen färg", och på 4♠ fanns ingen rad alls.
//  2. Kontrollbudsläsaren (`kontrollbudslage`) läste 4♥ som "utgång i vår
//     högfärg" fast bara Nord bjudit hjärter och trumfen redan var satt med 4♦ —
//     betydelselagret läste samma bud som kontrollbud (minorTrumpSetAt4).
// Regeln finns redan i boken (§6.9 steg 5): 4m efter hoppskiftet sätter trumfen
// (krav), öppnaren visar sin billigaste kontroll — även i egen visad färg —
// sedan essfråga eller 5m. Rätt bud av Nord på 4♠: 5♣ (klöverkontroll ♣A), aldrig
// pass. Hp räknade med kod (hcp/parseHand), summa 40.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'
import { meaningOf } from './auction-meaning'
import { hcp } from './hand'
import { kontrollbudslage } from './kontrollbud'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const RAPPORT: Deal = { id: 'fr108', board: 1, dealer: 'N', vulnerability: 'none', hands: {
  N: parseHand('S:8 H:AKQT5 D:KT64 C:AQ3'), E: parseHand('S:AJ974 H:94 D:Q32 C:T75'),
  S: parseHand('S:K62 H:73 D:AJ9875 C:98'), W: parseHand('S:QT53 H:J862 D:- C:KJ642') } }
const medNord = (n: string): Deal => ({ ...RAPPORT, hands: { ...RAPPORT.hands, N: parseHand(n) } })
const FORE = '1H P 1NT P 3D P 4D P'
/** Hela auktionen där Syds mänskliga bud ges i ordning; alla andra stolar bjuder med motorn. */
const helaMed = (d: Deal, sydsBud: string[]): ResolvedCall[] => {
  const h: ResolvedCall[] = []
  let guard = 0
  const syd = [...sydsBud]
  while (!auctionComplete(h) && guard++ < 30) {
    const seat = seatToAct(d.dealer, h.length)
    if (seat === 'S' && syd.length) h.push({ seat, bid: syd.shift()! } as ResolvedCall)
    else h.push(decideCall(d, h, seat))
  }
  return h
}

describe('felrapport #108 – 1♥–1NT–3♦–4♦: 4♦ sätter trumfen, öppnaren cue:ar och passar aldrig partnerns kontrollbud', () => {
  it('händerna räknade med kod: 18 · 7 · 8 · 7 = 40 hp, 13 kort var', () => {
    const hp = ORDER.map((s) => hcp(RAPPORT.hands[s]))
    expect(hp).toEqual([18, 7, 8, 7])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(RAPPORT.hands[s]).toHaveLength(13)
  })

  it('betydelsen av 4♦ efter hoppskiftet över 1NT: sätter trumfen (krav), inte "naturligt"', () => {
    const h = H('N', FORE)
    const m = meaningOf(h, 6)
    expect(m.rule).toBe('sätter trumfen (krav)')
    expect(m.text).toMatch(/billigaste kontroll/)
  })

  it('kontrollbudsläsaren: Nords 4♥ efter trumfsättande 4♦ är ett kontrollbud, inte utgång i egen högfärg', () => {
    const lage = kontrollbudslage(H('N', `${FORE} 4H P`), 'S')
    expect(lage?.trump).toBe('diamonds')
    expect(lage?.cueIndex).toBe(8)
  })

  it('Nord på 4♦: 4♥ som KONTROLLBUD (♥AKQ), inte reservregeln "rebjuder egen färg"', () => {
    const c = decideCall(RAPPORT, H('N', FORE), 'N')
    expect(c.bid).toBe('4H')
    expect(c.rule).toMatch(/cue|kontrollbud/i)
  })

  it('Nord utan hjärterkontroll (♥QJT98, 16 hp) visar i stället ♠A: 4♠', () => {
    const d = medNord('S:A8 H:QJT98 D:KQ64 C:A3')
    expect(hcp(d.hands.N)).toBe(16)
    expect(decideCall(d, H('N', FORE), 'N').bid).toBe('4S')
  })

  it('rapportens läge — Nord på partnerns 4♠-cue: 5♣ (klöverkontroll ♣A), ALDRIG pass', () => {
    const c = decideCall(RAPPORT, H('N', `${FORE} 4H P 4S P`), 'N')
    expect(c.bid).not.toBe('P')
    expect(c.bid).toBe('5C')
  })

  it('hela given med Syds 4♦ och 4♠: 5♣ – 5♦ (8 mot visade 16 → ingen slamzon), kontrakt 5♦', () => {
    const h = helaMed(RAPPORT, ['1NT', '4D', '4S'])
    expect(h.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)).toEqual(['N:1H', 'S:1NT', 'N:3D', 'S:4D', 'N:4H', 'S:4S', 'N:5C', 'S:5D'])
    expect(contractFromCalls(h)).toMatchObject({ level: 5, strain: 'diamonds', declarer: 'N' })
  })

  it('motorns egen Syd (8 hp, sex ruter): 5♦ direkt — 4♦ kräver 31+ ihop (bokens steg 5)', () => {
    expect(decideCall(RAPPORT, H('N', '1H P 1NT P 3D P'), 'S').bid).toBe('5D')
  })
})
