// FACIT FÖRE FIX — felrapport #107 (2026-10-31, bricka 4): PARTNERNS CUE
// PASSADES NÄR MOTSTÅNDARNA DUBBLADE DET. Väst giv, alla i zon:
//
//   Väst   Nord   Öst    Syd
//   1♣     2♠     X      pass
//   3♣     pass   3♠     X        ← Syd (människan) straffdubblar cuet
//   pass ?                        ← motorn passade → 3♠X av Öst, −4
//
// Väst ♠876 ♥T86 ♦AT5 ♣AKQT (13 hp) · Öst ♠K ♥KQJ9 ♦K942 ♣8752 (12 hp, 15
// stödpoäng med klöverfiten). Östs 3♠ är stoppfrågan efter den negativa
// dubblingen (§7.4, felrapport #100: fit + utgångsvärden, inget stopp → cue,
// partnern bjuder 3NT med stopp, annars sin färg). Odubblat svarade Väst 4♣;
// Syds dubbling fick läsaren `partnerCueToAnswer` (kräver "bara pass sedan
// cuet") att tappa läget → "pass (ingen regel)". Ägaren: "Motståndet passar
// efter dubbling. I min färg. Helt fel." Ett cue är krav även när de dubblar
// det — samma hål fanns för dubblaren när öppnarens cue (§7.4, 16+) dubblas.
// Hp räknade med kod (hcp/parseHand): N 7 · E 12 · S 8 · W 13 = 40.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'
import { interpretLastCall } from './auction-interpret'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const RAPPORT: Deal = { id: 'fr107', board: 4, dealer: 'W', vulnerability: 'all', hands: {
  N: parseHand('S:AQJ542 H:7432 D:76 C:6'), E: parseHand('S:K H:KQJ9 D:K942 C:8752'),
  S: parseHand('S:T93 H:A5 D:QJ83 C:J943'), W: parseHand('S:876 H:T86 D:AT5 C:AKQT') } }
/** Spelar klart auktionen från ett givet läge med motorn i alla stolar. */
const speladKlart = (d: Deal, start: ResolvedCall[]): ResolvedCall[] => {
  const h = [...start]
  let guard = 0
  while (!auctionComplete(h) && guard++ < 30) h.push(decideCall(d, h, seatToAct(d.dealer, h.length)))
  return h
}

describe('felrapport #107 – partnerns cue är krav även när motståndarna dubblar det', () => {
  it('händerna summerar till 40 hp', () => {
    expect(ORDER.map((s) => hcp(RAPPORT.hands[s]))).toEqual([7, 12, 8, 13])
  })
  it('rapportens Väst efter 1♣–(2♠)–X–(P)–3♣–(P)–3♠–(X): 4♣ (inget stopp), aldrig pass', () => {
    const c = decideCall(RAPPORT, H('W', '1C 2S X P 3C P 3S X'), 'W')
    expect(c).toMatchObject({ bid: '4C', rule: 'svar på partnerns cue' })
    expect(c.explanation).toMatch(/inget stopp/)
  })
  it('odubblat: samma svar 4♣ (regressionsvakt)', () => {
    expect(decideCall(RAPPORT, H('W', '1C 2S X P 3C P 3S P'), 'W')).toMatchObject({ bid: '4C', rule: 'svar på partnerns cue' })
  })
  it('hela auktionen efter Syds dubbling slutar aldrig i 3♠ av Öst', () => {
    const h = speladKlart(RAPPORT, H('W', '1C 2S X P 3C P 3S X'))
    const k = contractFromCalls(h)
    expect(k && `${k.level}${k.strain} ${k.declarer}`).not.toBe('3S E')
    expect(h.map((c) => c.bid).join(' ')).toMatch(/^1C 2S X P 3C P 3S X 4C /)
  })
  it('budförklaringen läser Västs 4♣ efter dubblingen som svaret på stoppfrågan', () => {
    const t = interpretLastCall(H('W', '1C 2S X P 3C P 3S X 4C'))
    expect(t?.text).toMatch(/svar på partnerns stoppfråga/)
    expect(t?.text).toMatch(/inget stopp/)
    expect(t?.forcing).toBe('krav-1-rond')
  })
  // Systerhålet: öppnarens cue på den negativa dubblingen (§7.4 "visa din
  // högfärg") dubblas av motståndaren — dubblaren svarar ändå (4♥ som odubblat).
  it('öppnarens cue dubblat: dubblaren visar högfärgen ändå', () => {
    const syster: Deal = { ...RAPPORT, id: 'fr107-syster', hands: {
      N: parseHand('S:AQJ542 H:7432 D:76 C:6'), E: parseHand('S:K H:KJ92 D:J942 C:8752'),
      S: parseHand('S:T93 H:T86 D:AT85 C:T94'), W: parseHand('S:876 H:AQ5 D:KQ3 C:AKQJ3') } }
    expect(ORDER.reduce((a, s) => a + hcp(syster.hands[s]), 0)).toBe(40)
    expect(decideCall(syster, H('W', '1C 2S X P 3S P'), 'E')).toMatchObject({ bid: '4H', rule: 'svar på cue efter negativ dubbling' })
    expect(decideCall(syster, H('W', '1C 2S X P 3S X'), 'E')).toMatchObject({ bid: '4H', rule: 'svar på cue efter negativ dubbling' })
  })
})
