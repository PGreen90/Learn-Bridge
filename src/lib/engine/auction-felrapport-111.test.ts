// FACIT FÖRE FIX — felrapport #111 (2026-11-09, bricka 10, Öst giv, alla i zon):
// "Partner får absolut inte passa och låta oss spela hjärter. Jag har visat 5-4
// i spader och hjärter, och partner har träff i spader."
//
//   Öst    Syd    Väst   Nord
//   pass   1♠     pass   1NT       ← Nord: "3-korts stöd med 10–11 → 1NT, höjer sedan till 2♠"
//   pass   2♥     pass   pass ???  ← …men passade 2♥ på singel hjärter (2♥ −2)
//
// Nord ♠A73 ♥5 ♦T53 ♣KQT432 (9 hp) · Syd ♠KJT94 ♥AJ72 ♦J2 ♣A7 (14 hp).
// Hålet: FÖRSTA svaret mäter handen i STÖDPOÄNG (9 hp + singel = 10–11 →
// semi-forcing 1NT med planen "höjer sedan till 2♠", §4.1), men svararens ANDRA
// bud mätte samma hand i rena hp (9 < 10) → "svag hand, öppnarens andra färg
// står" → pass. Två måttstockar för samma löfte. Regeln finns i boken (§4.1
// "Svararens andra bud efter 1M–1NT–2x": 2M = 10–11 med tre trumf): den som
// gick via 1NT med tre trumf HAR per konstruktion limithöjningen och fullföljer
// den — samma mått (stödpoäng) i båda ronderna. Rätt bud: 2♠.
// Hp räknade med kod (hcp/parseHand), summa 40.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const RAPPORT: Deal = { id: 'fr111', board: 10, dealer: 'E', vulnerability: 'all', hands: {
  N: parseHand('S:A73 H:5 D:T53 C:KQT432'), E: parseHand('S:62 H:KQ986 D:KQ97 C:J6'),
  S: parseHand('S:KJT94 H:AJ72 D:J2 C:A7'), W: parseHand('S:Q85 H:T43 D:A864 C:985') } }
const medNord = (n: string): Deal => ({ ...RAPPORT, hands: { ...RAPPORT.hands, N: parseHand(n) } })

describe('felrapport #111 – 1♠–1NT–2♥: tre trumf via 1NT fullföljer limithöjningen (2♠), passar aldrig 2♥', () => {
  it('händerna räknade med kod: 9 · 11 · 14 · 6 = 40 hp, 13 kort var', () => {
    const hp = ORDER.map((s) => hcp(RAPPORT.hands[s]))
    expect(hp).toEqual([9, 11, 14, 6])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(RAPPORT.hands[s]).toHaveLength(13)
  })

  it('motorn bjuder som i rapporten fram till felet: 1NT (semi-forcing, tre stöd 10–11) och 2♥', () => {
    const n = decideCall(RAPPORT, H('E', 'P 1S P'), 'N')
    expect(n.bid).toBe('1NT')
    expect(n.explanation).toMatch(/höjer sedan till 2♠/)
    expect(decideCall(RAPPORT, H('E', 'P 1S P 1NT P'), 'S').bid).toBe('2H')
  })

  it('Nord på 2♥: 2♠ (limithöjningen fullföljs), aldrig pass', () => {
    const c = decideCall(RAPPORT, H('E', 'P 1S P 1NT P 2H P'), 'N')
    expect(c.bid).toBe('2S')
    expect(c.rule).toBe('inbjudan (limithöjning)')
  })

  it('samma hand efter öppnarens 2♦: också 2♠; efter 2♣: dubbelanpassningen 4♣ (§4.1, ♣KQ-kontroll)', () => {
    // Budet ges som historik (läsningen är densamma oavsett öppnarens kort).
    expect(decideCall(RAPPORT, H('E', 'P 1S P 1NT P 2D P'), 'N').bid).toBe('2S')
    expect(decideCall(RAPPORT, H('E', 'P 1S P 1NT P 2C P'), 'N').bid).toBe('4C')
  })

  it('öppnaren rebjuder 2♠ (sex kort): tre stöd via 1NT → 3♠ (limithöjningen), samma mått', () => {
    expect(decideCall(RAPPORT, H('E', 'P 1S P 1NT P 2S P'), 'N').bid).toBe('3S')
  })

  it('motvikt: tre trumf med 9 stödpoäng går ALDRIG via 1NT — enkel höjning 2♠ direkt', () => {
    // ♠A73 ♥952 ♦T53 ♣KQT4: 9 hp, platt → 2♠ direkt (ingen 1NT-omväg).
    expect(decideCall(medNord('S:A73 H:952 D:T53 C:KQT4'), H('E', 'P 1S P'), 'N').bid).toBe('2S')
  })

  it('motvikt: svag hand utan stöd får fortfarande stanna i 2♥ (ingen preferens på dubbelton)', () => {
    // ♠73 ♥952 ♦KT53 ♣KQ42: 8 hp, två spader, tre hjärter.
    const d = medNord('S:73 H:952 D:KT53 C:KQ42')
    expect(decideCall(d, H('E', 'P 1S P'), 'N').bid).toBe('1NT')
    expect(decideCall(d, H('E', 'P 1S P 1NT P 2H P'), 'N').bid).toBe('P')
  })
})
