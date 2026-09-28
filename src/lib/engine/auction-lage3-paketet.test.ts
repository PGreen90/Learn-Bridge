// LÄGE 3-PAKETET (ägarens beslut 2026-09-27/28 ur omvärderingsfrågan;
// docs/handvardering.md principrutan, budsystem §4.1/§5.1/§5.2):
//
//  1. Jacoby 2NT = 12+ hp och 3+ trumf, "hela tiden" (responses.test.ts).
//  2. Efter 1♠–1NT–2♦: 2♠ = exakt 10–11 med tre spader ("avancera långsamt");
//     öppnaren passar med minimum, bjuder 4♠ med 15+ Bergenpoäng.
//  3. Den svaga handen "får stanna": ingen 2♠-preferens på dubbelton, pass på 2♦.
//  4. Dubbelanpassning: tre spader + 4+ ruter med ÄKTA kontroll (ess/singel/
//     renons/KQ) → 4♦, utgångskrav; öppnaren 4♠ (minimum / inget kontrollbud
//     under utgång) eller 4♥ (15+ med hjärterkontroll); svararen (10–11) 4♠.
//  5. 6-3-2-2 räknas som balanserad för 18–19-återbudet: 1♦–1♠ med ♠KJ ♥Q8
//     ♦AKJ764 ♣K103 → 2NT, inte 3♦ ("vi vill visa styrkan").

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const TOM = 'S:- H:- D:- C:-'
const giv = (hands: Partial<Record<Seat, string>>): Deal =>
  ({ id: 't', board: 1, dealer: 'N', vulnerability: 'none',
    hands: { N: parseHand(hands.N ?? TOM), E: parseHand(hands.E ?? TOM), S: parseHand(hands.S ?? TOM), W: parseHand(hands.W ?? TOM) } } as Deal)
const mening = (hist: string) => { const h = H('N', hist); return meaningOf(h, h.length - 1) }

describe('läge 3 – svararens andra bud efter 1♠–1NT–2♦', () => {
  const hist = H('N', '1S P 1NT P 2D P')
  const syd = (S: string) => decideCall(giv({ S }), hist, 'S')
  it('tre spader, 10–11 hp → 2♠ (exakt 10–11), inte 3♠', () => {
    expect(syd('S:QJ7 H:K853 D:64 C:A853')).toMatchObject({ bid: '2S', rule: 'inbjudan (limithöjning)' }) // 10 hp
    expect(syd('S:QJ7 H:K853 D:64 C:AJ53')).toMatchObject({ bid: '2S' }) // 11 hp
  })
  it('svag hand med två spader → pass (2♦ står), ingen preferens', () => {
    expect(syd('S:Q7 H:K852 D:964 C:J853')).toMatchObject({ bid: 'P' }) // 6 hp, tre ruter
    expect(syd('S:Q7 H:K853 D:96 C:J8532')).toMatchObject({ bid: 'P' }) // 6 hp, 2-2, klövern ryms inte på 2-läget
  })
  it('dubbelanpassning med äkta ruterkontroll → 4♦ (utgångskrav)', () => {
    expect(syd('S:QJ7 H:K85 D:A964 C:853')).toMatchObject({ bid: '4D', rule: 'dubbelanpassning' }) // ess
    expect(syd('S:QJ7 H:K8 D:A9642 C:853')).toMatchObject({ bid: '4D', rule: 'dubbelanpassning' }) // fem ruter
    expect(syd('S:QJ7 H:K85 D:KQ64 C:853')).toMatchObject({ bid: '4D', rule: 'dubbelanpassning' }) // KQ tillsammans
  })
  it('fyra ruter UTAN äkta kontroll (Qxxx, Kxxx) → 2♠', () => {
    expect(syd('S:QJ7 H:K85 D:Q964 C:A53')).toMatchObject({ bid: '2S' })
    expect(syd('S:QJ7 H:A85 D:K964 C:Q53')).toMatchObject({ bid: '2S' })
  })
  it('läsaren: 2♠ = 3 stöd 10–11, 4♦ = dubbelanpassning (utgångskrav)', () => {
    expect(mening('1S P 1NT P 2D P 2S').rule).toBe('inbjudan (limithöjning)')
    const m = mening('1S P 1NT P 2D P 4D')
    expect(m.rule).toBe('dubbelanpassning')
    expect(m.forcing).toBe('utgangskrav')
  })
})

describe('läge 3 – öppnarens fortsättning', () => {
  it('på 2♠ (3 stöd, 10–11): minimum passar, 15+ Bergenpoäng → 4♠', () => {
    const hist = H('N', '1S P 1NT P 2D P 2S P')
    expect(decideCall(giv({ N: 'S:AK853 H:Q32 D:K73 C:94' }), hist, 'N')).toMatchObject({ bid: 'P' }) // 12 hp, 5-3-3-2
    expect(decideCall(giv({ N: 'S:AK853 H:A2 D:KJ73 C:K4' }), hist, 'N')).toMatchObject({ bid: '4S' }) // 18 hp
  })
  it('på 4♦: minimum → 4♠; 15+ med hjärterkontroll → 4♥ (kontrollbud); 15+ utan → 4♠', () => {
    const hist = H('N', '1S P 1NT P 2D P 4D P')
    expect(decideCall(giv({ N: 'S:AK853 H:Q2 D:KJ73 C:94' }), hist, 'N')).toMatchObject({ bid: '4S', rule: 'utgång' })
    expect(decideCall(giv({ N: 'S:AK853 H:A2 D:KJ73 C:K4' }), hist, 'N')).toMatchObject({ bid: '4H', rule: 'kontrollbud' })
    expect(decideCall(giv({ N: 'S:AK853 H:Q2 D:KJ73 C:AK' }), hist, 'N')).toMatchObject({ bid: '4S' })
  })
  it('svararen (10–11) efter öppnarens 4♥-kontrollbud → 4♠', () => {
    const hist = H('N', '1S P 1NT P 2D P 4D P 4H P')
    expect(decideCall(giv({ S: 'S:QJ7 H:K85 D:A964 C:853' }), hist, 'S')).toMatchObject({ bid: '4S' })
  })
})

describe('läge 3 – 6-3-2-2 räknas som balanserad för 18–19-återbudet', () => {
  // OBS: exempelhanden i ägarsamtalet (♠KJ ♥Q8 ♦AKJ764 ♣K103) är 17 hp, inte 18
  // som jag skrev — den hoppar 3♦ (16–18). Regeln gäller ÄKTA 18–19.
  it('1♦–1♠ med ♠KJ ♥Q8 ♦AKJ764 ♣KQ3 (19 hp, 6-3-2-2) → 2NT, inte 3♦', () => {
    expect(decideCall(giv({ N: 'S:KJ H:Q8 D:AKJ764 C:KQ3' }), H('N', '1D P 1S P'), 'N')).toMatchObject({ bid: '2NT' })
  })
  it('17 hp med samma form (♠KJ ♥Q8 ♦AKJ764 ♣KT3) → 3♦ (16–18)', () => {
    expect(decideCall(giv({ N: 'S:KJ H:Q8 D:AKJ764 C:KT3' }), H('N', '1D P 1S P'), 'N')).toMatchObject({ bid: '3D' })
  })
  it('16 hp med samma form → 3♦ som förut', () => {
    expect(decideCall(giv({ N: 'S:KJ H:Q8 D:AK9764 C:KT3' }), H('N', '1D P 1S P'), 'N')).toMatchObject({ bid: '3D' })
  })
})
