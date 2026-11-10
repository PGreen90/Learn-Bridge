// FACIT FÖRE FIX — felrapport #110 (2026-11-09, bricka 2, Öst giv, NS i zon):
// "Partner får inte passa efter min 2 klöver. Jag visar båda högfärgerna, och
// partner har en massa spader."
//
//   Öst    Syd    Väst   Nord
//   1♣     pass   1NT    pass
//   pass   2♣     pass   pass ???   ← Nord passade utan regel (2♣ på 3-2)
//
// Nord ♠KQ964 ♥J65 ♦865 ♣J8 (7 hp) · Syd ♠AT73 ♥AK73 ♦A2 ♣T73 (15 hp).
// Hålet: betydelselagret läste 2♣ som Michaels, men beslutstabellen hade ingen
// rad för den SENA cuen efter deras 1NT-svar (Michaels-läget kräver att cuen är
// första budet efter öppningen) → pass utan regel.
//
// ÄGARENS STRUKTUR 2026-11-10 (fyra svar):
//  1. 2m här lovar BÅDA HÖGFÄRGERNA, minst 4-4, och 13+ hp.
//  2. Nord på rapportens hand: 2♠ (inget spärrhopp — partnern kan ha bara fyra).
//  3. Advancern får ALDRIG passa: preferens på 2-läget (lika längd → hjärter);
//     cue 3m med 8+ hp och 3+ stöd = utgångsintresse, krav.
//  4. Samma sak efter 1♦–P–1NT–P–P–2♦.
// Hp räknade med kod (hcp/parseHand), summa 40.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const RAPPORT: Deal = { id: 'fr110', board: 2, dealer: 'E', vulnerability: 'ns', hands: {
  N: parseHand('S:KQ964 H:J65 D:865 C:J8'), E: parseHand('S:8 H:T42 D:Q743 C:AKQ92'),
  S: parseHand('S:AT73 H:AK73 D:A2 C:T73'), W: parseHand('S:J52 H:Q98 D:KJT9 C:654') } }
const med = (seat: Seat, hand: string): Deal => ({ ...RAPPORT, hands: { ...RAPPORT.hands, [seat]: parseHand(hand) } })
const FORE = '1C P 1NT P P 2C P'
const nord = (hand: string, hist = FORE) => decideCall(med('N', hand), H('E', hist), 'N')

describe('felrapport #110 – sen cue efter deras 1NT-svar (1m–P–1NT–P–P–2m): båda högfärgerna, advancern passar aldrig', () => {
  it('händerna räknade med kod: 7 · 11 · 15 · 7 = 40 hp, 13 kort var', () => {
    const hp = ORDER.map((s) => hcp(RAPPORT.hands[s]))
    expect(hp).toEqual([7, 11, 15, 7])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(RAPPORT.hands[s]).toHaveLength(13)
  })

  it('betydelsen av 2♣: båda högfärgerna, minst 4-4, 13+ hp — krav', () => {
    const m = meaningOf(H('E', FORE), 5)
    expect(m.rule).toBe('sen cue (båda högfärgerna)')
    expect(m.text).toMatch(/4-4/)
    expect(m.text).toMatch(/13\+/)
  })

  it('Nord på rapportens hand: 2♠ (preferens till den längre högfärgen), aldrig pass, inget spärrhopp', () => {
    const c = decideCall(RAPPORT, H('E', FORE), 'N')
    expect(c.bid).toBe('2S')
    expect(c.rule).toBe('advance sen cue: preferens')
  })

  it('advancern passar aldrig: 0 hp och lika längd → 2♥ (den billigare)', () => {
    expect(nord('S:964 H:865 D:8653 C:J82').bid).toBe('2H')
    // Även utan stöd (2-2) tas cuen ut.
    expect(nord('S:96 H:86 D:98653 C:J842').bid).toBe('2H')
  })

  it('cue 3♣ med 8+ hp och 3+ stöd: utgångsintresse, krav', () => {
    const c = nord('S:KQ964 H:J65 D:K65 C:J8') // 10 hp
    expect(c.bid).toBe('3C')
    expect(c.rule).toBe('advance sen cue: cue (utgångsintresse)')
  })

  it('samma struktur efter 1♦–P–1NT–P–P–2♦: Nord 2♠', () => {
    const c = decideCall(RAPPORT, H('E', '1D P 1NT P P 2D P'), 'N')
    expect(c.bid).toBe('2S')
    expect(c.rule).toBe('advance sen cue: preferens')
  })

  it('Syd passar partnerns tvingade preferens (kan vara 0 poäng)', () => {
    const c = decideCall(RAPPORT, H('E', `${FORE} 2S P`), 'S')
    expect(c.bid).toBe('P')
    expect(c.rule).toBe('sen cue: passar avslutet')
  })

  it('efter cuen 3♣ svarar inklivaren alltid: 13–14 → 3♥ (minimum), 15+ → 3♠ (maximum)', () => {
    const h = H('E', `${FORE} 3C P`)
    expect(decideCall(RAPPORT, h, 'S').bid).toBe('3S') // 15 hp
    expect(decideCall(med('S', 'S:AT73 H:AK73 D:Q2 C:T73'), h, 'S').bid).toBe('3H') // 13 hp
  })

  it('advancern placerar efter svaret: mot maximum utgång i fiten, mot minimum stannar hon', () => {
    const tio = 'S:KQ964 H:J65 D:K65 C:J8' // 10 hp, spaderfit
    expect(nord(tio, `${FORE} 3C P 3S P`).bid).toBe('4S')
    expect(nord(tio, `${FORE} 3C P 3H P`).bid).toBe('3S')
  })

  it('förklaringarna följer med: preferensen och cuen', () => {
    expect(meaningOf(H('E', `${FORE} 2S`), 7).rule).toBe('advance sen cue: preferens')
    expect(meaningOf(H('E', `${FORE} 3C`), 7).rule).toBe('advance sen cue: cue (utgångsintresse)')
  })

  it('motvikt: den DIREKTA Michaels-cuen (1♣)–2♣ är orörd — spärrhoppet finns kvar där', () => {
    const c = decideCall(RAPPORT, H('E', '1C 2C P'), 'N')
    expect(c.bid).toBe('3S')
    expect(c.rule).toBe('advance Michaels: spärrhöjning')
  })
})
