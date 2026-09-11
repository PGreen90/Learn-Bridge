// MOTORBYTET ETAPP 4 FAMILJ 3 — när de stör vår öppning, i beslutstabellen
// (docs/motorbyte-plan.md, 2026-09-08). Facit för det som är NYTT i familjen;
// det som flyttade oförändrat (svaret på stöddubblingen, öppnarens svar på den
// negativa dubblingen, Jordan-fortsättningen, dubblarens preferens/invit) har
// sina gamla facit-filer kvar (auction-stoddubbling-svar.test.ts,
// negative-doubles.test.ts, auction-jordan-fortsattning.test.ts,
// auction-negx-preferens.test.ts, doubles.test.ts) och körs nu genom tabellen.
//
// Nytt i familjen:
//   · raden *svar-stört*: svararens konkurrensbeslut kommer ur tabellen även
//     när LHO:s inkliv inte var det manuset gissade (vid bordet föll svararen
//     förr till det gamla lagrets catch-all); tvåfärgsinklivet läses ur
//     auktionen; Jordan 2NT bara efter 1♥/1♠ (över 1m: XX med 10+);
//   · raden *stöd-x*: stöddubblingen bjuds på ett inkliv som faktiskt lagts —
//     manusets kik-rond (RHO:s inkliv bara när öppnaren hade tre stöd) är riven;
//   · raden *negativ-dubblaren*: höjningen med fit + 13+ utan fit → 3NT;
//   · familjegränsen: RHO:s inkliv över svaret bjuds inte i botauktionerna
//     förrän familj 4 (öppnarens konkurrensåterbud), det rivna är rivet.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideCallTraced } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>, vul: Deal['vulnerability'] = 'none'): Deal {
  return { id: 'f3', dealer, vulnerability: vul, board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
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

describe('raden *svar-stört*: svararens första bud när LHO stört partnerns öppning', () => {
  it('1♦–(1♠): 4+ hjärter och 6+ hp → X (negativ dubbling), källa tabell:svar-stört', () => {
    const t = decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:KJ98'), [call('N', '1D'), call('E', '1S')], 'S')
    expect(t.källa).toBe('tabell:svar-stört')
    expect(t.call).toMatchObject({ bid: 'X', rule: 'negativ dubbling' })
  })
  it('1♣–(1♥): 5-korts spader på 1-läget → 1♠ (fritt bud, rondkrav) före dubblingen', () => {
    const t = decideCallTraced(ensam('S', 'S:QT863 H:A8 D:T6 C:AQT8'), [call('N', '1C'), call('E', '1H')], 'S')
    expect(t.källa).toBe('tabell:svar-stört')
    expect(t.call).toMatchObject({ bid: '1S', rule: 'fritt bud' })
  })
  it('1♥–(2♦): 3+ stöd och 10+ → cue 3♦ (limithöjning+); 6–9 → 2♥ (konkurrenshöjning)', () => {
    expect(decideCallTraced(ensam('S', 'S:K4 H:Q87 D:963 C:AQT85'), [call('N', '1H'), call('E', '2D')], 'S').call).toMatchObject({ bid: '3D', rule: 'cue (limithöjning+)' })
    expect(decideCallTraced(ensam('S', 'S:K4 H:Q87 D:963 C:QT985'), [call('N', '1H'), call('E', '2D')], 'S').call).toMatchObject({ bid: '2H', rule: 'konkurrenshöjning' })
  })
  it('1♣–(1NT): 10+ → X (straff, vi har balansen); 3+ stöd 6–9 → 2♣; svagare → pass', () => {
    const hist = [call('N', '1C'), call('E', '1NT')]
    expect(decideCallTraced(ensam('S', 'S:QJ94 H:Q75 D:AK C:T543'), hist, 'S').call).toMatchObject({ bid: 'X', rule: 'straffdubbling' })
    expect(decideCallTraced(ensam('S', 'S:5 H:QT975 D:AQ7 C:T832'), hist, 'S').call).toMatchObject({ bid: '2C', rule: 'konkurrenshöjning' })
    expect(decideCallTraced(ensam('S', 'S:743 H:4 D:6432 C:QJ754'), hist, 'S').call).toMatchObject({ bid: 'P' })
  })
  it('tvåfärgsinklivet läses ur auktionen: 1♠–(2NT) och 1♠–(2♠) utan regeletikett → tävlande 3♠ / 4♠', () => {
    const hand = 'S:J8654 H:T D:AT876 C:42' // 4+ stöd, 5 hp = 11 med fördelning → 4♠ direkt (K3-tabellen)
    expect(decideCallTraced(ensam('S', hand), [call('N', '1S'), call('E', '2NT')], 'S').call).toMatchObject({ bid: '4S', rule: 'höjning till utgång' })
    expect(decideCallTraced(ensam('S', hand), [call('N', '1S'), call('E', '2S')], 'S').call).toMatchObject({ bid: '4S', rule: 'höjning till utgång' })
    expect(decideCallTraced(ensam('S', 'S:J865 H:T3 D:T876 C:942'), [call('N', '1S'), call('E', '2NT')], 'S').call).toMatchObject({ bid: '3S', rule: 'konkurrenshöjning' })
  })
  it('deras X: Jordan 2NT bara efter 1♥/1♠ — över 1♣ ger samma hand XX (10+)', () => {
    const hand = 'S:54 H:AJ54 D:AJ6 C:KJ98' // 14 hp, 4 klöver / 4 hjärter
    expect(decideCallTraced(ensam('S', hand), [call('N', '1H'), call('E', 'X')], 'S').call).toMatchObject({ bid: '2NT', rule: 'Jordan 2NT' })
    expect(decideCallTraced(ensam('S', hand), [call('N', '1C'), call('E', 'X')], 'S').call).toMatchObject({ bid: 'XX', rule: 'redubbling' })
  })
  it('läget: bara direkt efter LHO:s störning; ostört är raden *svar*; passad hand svarar likadant', () => {
    expect(decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:KJ98'), [call('N', '1D'), call('E', 'P')], 'S').källa).toBe('tabell:svar')
    const t = decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:KJ98', 'S'), [call('S', 'P'), call('W', 'P'), call('N', '1D'), call('E', '1S')], 'S')
    expect(t.källa).toBe('tabell:svar-stört')
    expect(t.call.bid).toBe('X')
  })
  it('manuset lägger svararens konkurrensbud ur tabellen (samma bud som förr)', () => {
    const d = dealOf('N', {
      N: 'S:K2 H:432 D:KQ543 C:A32', // 12 hp → 1♦
      E: 'S:AQ876 H:K5 D:32 C:K432', // 12 hp, 5 spader → 1♠
      S: 'S:32 H:KQ43 D:K32 C:5432', // 8 hp, 4 hjärter → X
      W: 'S:JT9 H:JT9 D:T9 C:QJ98',
    })
    const a = buildAuction(d)!
    expect(a.turns.slice(0, 3).map((t) => `${t.seat}:${t.call}`)).toEqual(['N:1D', 'E:1S', 'S:X'])
    expect(a.turns[2]).toMatchObject({ role: 'svarare', rule: 'negativ dubbling' })
    expect(decideCallTraced(d, [call('N', '1D'), call('E', '1S')], 'S').källa).toBe('tabell:svar-stört')
  })
})

describe('raderna *stöd-x* / *stöd-x-svar* / *stöd-x-öppnaren*', () => {
  const hist = [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', '1S')]
  it('exakt 3 stöd efter 1♦–(P)–1♥–(1♠) → X ur tabellen; 4 stöd eller 2 → inte raden (familj 4)', () => {
    const t = decideCallTraced(ensam('N', 'S:A32 H:K32 D:AKJ432 C:2'), hist, 'N')
    expect(t.källa).toBe('tabell:stöd-x')
    expect(t.call).toMatchObject({ bid: 'X', rule: 'stöddubbling' })
    expect(decideCallTraced(ensam('N', 'S:A3 H:K432 D:AKJ43 C:2'), hist, 'N').källa).not.toBe('tabell:stöd-x')
    expect(decideCallTraced(ensam('N', 'S:A32 H:K3 D:AKJ4322 C:2'), hist, 'N').källa).not.toBe('tabell:stöd-x')
  })
  it('läget kräver 1M-svar, deras FÄRGinkliv direkt efter svaret och 2M bjudbart: 1NT-inkliv, 3-lägesinkliv, deras X → inte raden', () => {
    const hand = 'S:A32 H:K32 D:AKJ432 C:2'
    expect(decideCallTraced(ensam('N', hand), [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', '1NT')], 'N').källa).not.toBe('tabell:stöd-x')
    expect(decideCallTraced(ensam('N', hand), [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', '3C')], 'N').källa).not.toBe('tabell:stöd-x')
    expect(decideCallTraced(ensam('N', hand), [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', 'X')], 'N').källa).toBe('tabell:återbud') // systems on (familj 2)
  })
  it('svararen svarar stöddubblingen ur tabellen och stöddubblaren väger svaret', () => {
    const h2 = [...hist, call('N', 'X'), call('E', 'P')]
    const svar = decideCallTraced(ensam('S', 'S:Q54 H:AJ754 D:65 C:T54'), h2, 'S') // 7 hp (+1 för dubbeltonen) med 5 hjärter → 2♥ (minimum)
    expect(svar.källa).toBe('tabell:stöd-x-svar')
    expect(svar.call).toMatchObject({ bid: '2H', rule: 'svar på stöddubbling' })
    const h3 = [...h2, call('S', '2H'), call('W', 'P')]
    const dom = decideCallTraced(ensam('N', 'S:A32 H:K32 D:AKJ432 C:2'), h3, 'N')
    expect(dom.källa).toBe('tabell:stöd-x-öppnaren')
    expect(dom.call.bid).toBe('P')
  })
})

describe('raderna *negativ-x-öppnaren* / *negativ-dubblaren*', () => {
  const hist = [call('N', '1D'), call('E', '1S'), call('S', 'X'), call('W', 'P')]
  it('öppnaren svarar den negativa dubblingen ur tabellen (4 hjärter → 2♥; jämn med stopp → 1NT)', () => {
    const a = decideCallTraced(ensam('N', 'S:K2 H:Q432 D:KQ543 C:A3'), hist, 'N')
    expect(a.källa).toBe('tabell:negativ-x-öppnaren')
    expect(a.call).toMatchObject({ bid: '2H', rule: 'svar på negativ dubbling' })
    expect(decideCallTraced(ensam('N', 'S:A73 H:Q3 D:QT543 C:KQ7'), hist, 'N').call.bid).toBe('1NT')
  })
  it('dubblaren: höjning med fit ur tabellen (2♥ → 3♥ med 4 stöd och 11 sp), preferens (K2), 13+ utan fit → 3NT', () => {
    const efter2H = [...hist, call('N', '2H'), call('E', 'P')]
    const raise = decideCallTraced(ensam('S', 'S:54 H:KJ54 D:Q76 C:KJ98'), efter2H, 'S') // 11 hp, 4 stöd
    expect(raise.källa).toBe('tabell:negativ-dubblaren')
    expect(raise.call.bid).toBe('3H')
    const efter2C = [...hist, call('N', '2C'), call('E', 'P')]
    const pref = decideCallTraced(ensam('S', 'S:54 H:AJ54 D:K752 C:73'), efter2C, 'S') // K2: ♦K752 ♣73 → 2♦
    expect(pref.källa).toBe('tabell:negativ-dubblaren')
    expect(pref.call).toMatchObject({ bid: '2D', rule: 'negativ-dubblarens preferens' })
    const efter1NT = [...hist, call('N', '1NT'), call('E', 'P')]
    const game = decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:KJ98'), efter1NT, 'S') // 14 hp → 3NT (förr 2♣ ur catch-all)
    expect(game.källa).toBe('tabell:negativ-dubblaren')
    expect(game.call).toMatchObject({ bid: '3NT', rule: 'negativ-dubblarens utgång' })
  })
  it('läget: partnerns hopp (16+) och partnerns utgångsbud lämnas åt det gamla lagret', () => {
    expect(decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:KJ98'), [...hist, call('N', '3H'), call('E', 'P')], 'S').källa).not.toBe('tabell:negativ-dubblaren')
    expect(decideCallTraced(ensam('S', 'S:54 H:AJ54 D:AJ6 C:KJ98'), [...hist, call('N', '4H'), call('E', 'P')], 'S').källa).not.toBe('tabell:negativ-dubblaren')
  })
})

describe('raderna *jordan-öppnaren* / *jordan-svararen*', () => {
  it('öppnaren svarar Jordan 2NT ur tabellen (minimum → 3♥, 15+ stödpoäng → 4♥); Jordan-bjudaren höjer 3♥ till 4♥ med 13+', () => {
    const hist = [call('N', '1H'), call('E', 'X'), call('S', '2NT'), call('W', 'P')]
    const min = decideCallTraced(ensam('N', 'S:A73 H:KQ542 D:J72 C:73'), hist, 'N')
    expect(min.källa).toBe('tabell:jordan-öppnaren')
    expect(min.call.bid).toBe('3H')
    expect(decideCallTraced(ensam('N', 'S:A73 H:KQ542 D:J72 C:A7'), hist, 'N').call.bid).toBe('4H')
    const efter3H = [...hist, call('N', '3H'), call('E', 'P')]
    const lyft = decideCallTraced(ensam('S', 'S:K4 H:AJ87 D:K963 C:Q54'), efter3H, 'S') // 13 hp
    expect(lyft.källa).toBe('tabell:jordan-svararen')
    expect(lyft.call.bid).toBe('4H')
    expect(decideCallTraced(ensam('S', 'S:94 H:AJ87 D:K963 C:Q54'), efter3H, 'S').call.bid).toBe('P')
  })
})

describe('det rivna och familjegränsen', () => {
  // (Frånvaro-assertionen på FORCED_/CONTESTED_DETECTORS togs bort i etapp 5
  // session B, 2026-09-11: detektorkedjan är riven, inga listor kvar att pröva.)
  it('manusets kik-rond är riven: RHO:s inkliv över svaret läggs ur RHO:s EGEN hand (familj 4), oavsett vad öppnaren håller', () => {
    const d = dealOf('N', {
      N: 'S:A32 H:K32 D:AKJ432 C:2', // 15 hp, EXAKT 3 hjärter
      E: 'S:76 H:JT98 D:T8 C:KJT98',
      S: 'S:Q54 H:AQ54 D:65 C:Q543', // 1♥
      W: 'S:KJT98 H:76 D:Q97 C:A76', // 10 hp, 5 spader — inkliv ur egen hand (raden *inkliv-över-svaret*)
    })
    const a = buildAuction(d)!
    expect(a.turns.slice(0, 3).map((t) => t.call)).toEqual(['1D', '1H', '1S'])
    // Samma inkliv när öppnaren har FYRA hjärter (förr lades det bara vid exakt tre — en kik).
    const d2 = dealOf('N', { N: 'S:A3 H:K432 D:AKJ432 C:2', E: 'S:76 H:JT98 D:T8 C:KJT98', S: 'S:Q54 H:AQ54 D:65 C:Q543', W: 'S:KJT98 H:76 D:Q97 C:A76' })
    expect(buildAuction(d2)!.turns.slice(0, 3).map((t) => t.call)).toEqual(['1D', '1H', '1S'])
    // Vid bordet: stöddubblar öppnaren ur tabellen.
    expect(decideCallTraced(d, [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', '1S')], 'N').källa).toBe('tabell:stöd-x')
    expect(decideCallTraced(d, [call('N', '1D'), call('E', 'P'), call('S', '1H')], 'W').källa).toBe('tabell:inkliv-över-svaret')
  })
})
