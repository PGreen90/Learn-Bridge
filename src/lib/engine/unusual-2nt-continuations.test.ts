// OVANLIG 2NT — FORTSÄTTNINGEN, OSTÖRD (ägarbeslut 2026-09-21/22: "ta så mycket
// från Michaels som går att anpassa" + fyra besked om lågfärgsfiten).
//   • 2NT = de två LÄGSTA objudna: över 1♥/1♠ = ♣+♦ · över 1♦ = ♣+♥ · över 1♣ = ♦+♥.
//   • Advancern: preferens på lägsta nivå = avslut (kan ha 0; lika längd → den
//     billigare) · egen sexkortsfärg bara med högst ett kort i BÅDA · 3NT = 15+,
//     inget trekorts stöd, stopp · spärrhopp 4m = fyrkorts stöd under 8 hp.
//   • Hjärterfiten (över 1♣/1♦) går som Michaels-högfärgen: cue 8+ hp med 3+
//     hjärter; inklivaren 18+ → 4♥ efter den tvingade 3♥.
//   • Lågfärgsfiten — ägarens besked: inklivaren t.o.m. 16 pass · 17–19 inbjudan
//     4m · 20+ 5m; cuen över 1♥/1♠ (3♥/3♠, över preferensnivån) kräver 11+ hp;
//     direkt 5m = stöd och 12+ hp.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid } as ResolvedCall)
const TOM = 'S:- H:- D:- C:-'
/** Öst öppnar, Syd kliver in med 2NT, Nord är advancer. */
const giv = (S: string, N: string): Deal =>
  ({ id: 't', board: 1, dealer: 'E', vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(TOM), S: parseHand(S), W: parseHand(TOM) } } as Deal)

const LAG_13 = 'S:A2 H:4 D:AJ763 C:KJ932' // ♣+♦, 13 hp
const OVER_H = [call('E', '1H'), call('S', '2NT'), call('W', 'P')]
const OVER_D = [call('E', '1D'), call('S', '2NT'), call('W', 'P')]
const OVER_C = [call('E', '1C'), call('S', '2NT'), call('W', 'P')]

describe('advancern över 2NT mot deras högfärg (♣+♦)', () => {
  const adv = (N: string) => decideCall(giv(LAG_13, N), OVER_H, 'N')

  it('svag hand → preferens till den längre lågfärgen = avslut', () => {
    expect(adv('S:T82 H:J8762 D:Q53 C:94')).toMatchObject({ bid: '3D', rule: 'advance tvåfärg (preferens)' })
  })
  it('lika längd → den BILLIGARE (klöver)', () => {
    expect(adv('S:QT82 H:J872 D:943 C:Q53').bid).toBe('3C')
  })
  it('10 hp med stöd → fortfarande preferens (cuen kräver 11+)', () => {
    expect(adv('S:KT82 H:Q872 D:K43 C:Q5')).toMatchObject({ bid: '3D', rule: 'advance tvåfärg (preferens)' })
  })
  it('11+ hp och trekorts stöd → cue 3♥ (utgångsintresse, krav)', () => {
    expect(adv('S:AT82 H:Q872 D:K43 C:Q5')).toMatchObject({ bid: '3H', rule: 'advance ovanlig 2NT: cue (utgångsintresse)' })
  })
  it('under 8 hp med fyrkorts stöd → spärrhopp 4♦', () => {
    expect(adv('S:T82 H:J872 D:Q953 C:94')).toMatchObject({ bid: '4D', rule: 'advance ovanlig 2NT: spärrhöjning' })
  })
  it('12+ hp och fyrkorts stöd → 5♦ direkt', () => {
    expect(adv('S:A82 H:872 D:KQ53 C:K94')).toMatchObject({ bid: '5D', rule: 'advance ovanlig 2NT: utgång' })
  })
  it('15+ hp, inget trekorts stöd, stopp i deras färg → 3NT (avslut)', () => {
    expect(adv('S:AQJ32 H:KQT93 D:K8 C:4')).toMatchObject({ bid: '3NT', rule: 'advance ovanlig 2NT: 3NT' })
  })
  it('egen sexkortsfärg BARA med högst ett kort i båda lågfärgerna', () => {
    expect(adv('S:KQJ9832 H:A432 D:2 C:5')).toMatchObject({ bid: '3S', rule: 'advance ovanlig 2NT: egen färg' })
    expect(adv('S:KQJ9832 H:A43 D:2 C:T5').bid).toBe('3C') // två klöver → vanlig preferens
  })
  it('över 1♠ ligger cuen på 3♠', () => {
    const h = [call('E', '1S'), call('S', '2NT'), call('W', 'P')]
    expect(decideCall(giv(LAG_13, 'S:Q872 H:AT82 D:K43 C:Q5'), h, 'N').bid).toBe('3S')
  })
})

describe('advancern över 2NT mot deras lågfärg (hjärter + den andra lågfärgen)', () => {
  const advD = (N: string) => decideCall(giv(TOM, N), OVER_D, 'N')
  const advC = (N: string) => decideCall(giv(TOM, N), OVER_C, 'N')

  it('3+ hjärter, svag → 3♥ (preferens, avslut)', () => {
    expect(advD('S:T8432 H:J87 D:Q53 C:94')).toMatchObject({ bid: '3H', rule: 'advance tvåfärg (preferens)' })
  })
  it('8+ hp och 3+ hjärter → cue i deras färg (krav)', () => {
    expect(advD('S:AT82 H:Q87 D:8432 C:K5')).toMatchObject({ bid: '3D', rule: 'advance ovanlig 2NT: cue (utgångsintresse)' })
    expect(advC('S:AT82 H:Q87 D:K5 C:8432').bid).toBe('3C')
  })
  it('utan hjärterstöd, lika längd → den billigare färgen', () => {
    expect(advD('S:T8432 H:J8 D:Q532 C:94').bid).toBe('3C') // ♣ billigare än ♥
    expect(advC('S:T8432 H:J8 D:94 C:Q532').bid).toBe('3D') // ♦ billigare än ♥
  })
  it('utan hjärterstöd: 12+ hp och stöd i lågfärgen → 5m direkt', () => {
    expect(advD('S:AK82 H:J8 D:8432 C:KQ5')).toMatchObject({ bid: '5C', rule: 'advance ovanlig 2NT: utgång' })
  })
  it('utan hjärterstöd: under 8 hp med fyrkorts lågfärgsstöd → spärrhopp 4m', () => {
    expect(advD('S:T8432 H:J8 D:Q53 C:9432').bid).toBe('4C')
  })
})

describe('inklivaren efter den tvingade preferensen (kan vara 0 poäng)', () => {
  const ink = (S: string, h: ResolvedCall[], a: string) => decideCall(giv(S, TOM), [...h, call('N', a), call('E', 'P')], 'S')

  it('lågfärg: t.o.m. 16 hp → pass', () => {
    expect(ink(LAG_13, OVER_H, '3C')).toMatchObject({ bid: 'P', rule: 'efter ovanlig 2NT: passar avslutet' })
    expect(ink('S:A2 H:4 D:AQJ63 C:KQ932', OVER_H, '3C').bid).toBe('P') // 16
  })
  it('lågfärg: 17–19 hp → inbjudan 4m', () => {
    expect(ink('S:A2 H:4 D:AQJ63 C:KQJ32', OVER_H, '3C')).toMatchObject({ bid: '4C', rule: 'efter ovanlig 2NT: inbjudan' }) // 17
    expect(ink('S:A2 H:K D:AQJ63 C:KQ932', OVER_H, '3D').bid).toBe('4D') // 19
  })
  it('lågfärg: 20+ hp → 5m (planens 22 hp-hand passade förr)', () => {
    expect(ink('S:A2 H:A D:AQJ63 C:KQJ32', OVER_H, '3C')).toMatchObject({ bid: '5C', rule: 'efter ovanlig 2NT: utgång' }) // 21
  })
  it('hjärter: preferensen ligger redan på 3-läget → 18+ 4♥, annars pass', () => {
    expect(ink('S:A2 H:AQJ63 D:4 C:KQJ32', OVER_D, '3H').bid).toBe('P') // 17
    expect(ink('S:A2 H:AKJ63 D:4 C:KQJ32', OVER_D, '3H')).toMatchObject({ bid: '4H', rule: 'efter ovanlig 2NT: utgång' }) // 18
  })
  it('lågfärgspreferensen över deras lågfärg följer lågfärgstrappan', () => {
    expect(ink('S:A2 H:AQJ63 D:4 C:KQJ32', OVER_D, '3C').bid).toBe('4C') // 17
  })
  it('spärrhopp 4m: 16+ → 5m, annars pass · egen färg och 3NT → pass', () => {
    expect(ink('S:A2 H:4 D:AQJ63 C:KQ932', OVER_H, '4D').bid).toBe('5D') // 16
    expect(ink(LAG_13, OVER_H, '4D').bid).toBe('P')
    expect(ink('S:A2 H:A D:AQJ63 C:KQJ32', OVER_H, '3S').bid).toBe('P')
    expect(ink('S:A2 H:A D:AQJ63 C:KQJ32', OVER_H, '3NT').bid).toBe('P')
  })
})

describe('advancern på inbjudan 4m', () => {
  const h = [...OVER_H, call('N', '3C'), call('E', 'P'), call('S', '4C'), call('W', 'P')]
  it('8+ hp → 5♣ · under 8 → pass', () => {
    expect(decideCall(giv(TOM, 'S:KT82 H:Q872 D:43 C:K65'), h, 'N')).toMatchObject({ bid: '5C', rule: 'efter ovanlig 2NT: accepterar inbjudan' })
    expect(decideCall(giv(TOM, 'S:QT82 H:J872 D:943 C:Q53'), h, 'N').bid).toBe('P')
  })
})

describe('efter advancerns cue över deras högfärg (11+ hp)', () => {
  const CUE = [...OVER_H, call('N', '3H'), call('E', 'P')]
  const ink = (S: string) => decideCall(giv(S, TOM), CUE, 'S')

  it('inklivaren t.o.m. 10 hp → 4♣ (billigaste färgen)', () => {
    expect(ink('S:82 H:4 D:AJ763 C:KJ932')).toMatchObject({ bid: '4C', rule: 'efter ovanlig 2NT: svag efter cue' })
  })
  it('inklivaren 11+ → 4♦ (utgångskrav) · med sexkorts lågfärg → 5 i den', () => {
    expect(ink(LAG_13)).toMatchObject({ bid: '4D', rule: 'efter ovanlig 2NT: stark efter cue' })
    expect(ink('S:A2 H:- D:AJ763 C:KJ9432').bid).toBe('5C')
  })

  const efter = (N: string, svar: string) => decideCall(giv(TOM, N), [...CUE, call('S', svar), call('W', 'P')], 'N')
  it('mot SVAGT 4♣: stannar i sin fit · 15+ bjuder utgång', () => {
    expect(efter('S:AT82 H:Q872 D:K43 C:Q5', '4C').bid).toBe('4D') // fit i ruter, 11 hp
    expect(efter('S:AT82 H:Q872 D:Q5 C:K43', '4C').bid).toBe('P') // fit i klöver
    expect(efter('S:AK82 H:A872 D:K43 C:Q5', '4C').bid).toBe('5D') // 16 hp
  })
  it('mot STARKT 4♦: utgång i sin fit', () => {
    expect(efter('S:AT82 H:Q872 D:Q5 C:K43', '4D').bid).toBe('5C')
    expect(efter('S:AT82 H:Q872 D:K43 C:Q5', '4D').bid).toBe('5D')
  })
})

describe('efter advancerns cue över deras lågfärg (hjärterfit, 8+ hp)', () => {
  const HJ_10 = 'S:82 H:KJ763 D:4 C:KJ932' // ♣+♥, 9 hp
  const HJ_13 = 'S:A2 H:KJ763 D:4 C:KJ932'
  const ink = (S: string, h: ResolvedCall[], cue: string) => decideCall(giv(S, TOM), [...h, call('N', cue), call('E', 'P')], 'S')

  it('svag → billigaste färgen: 3♥ över 1♦ · 3♦ över 1♣', () => {
    expect(ink(HJ_10, OVER_D, '3D')).toMatchObject({ bid: '3H', rule: 'efter ovanlig 2NT: svag efter cue' })
    expect(ink('S:82 H:KJ763 D:KJ932 C:4', OVER_C, '3C').bid).toBe('3D')
  })
  it('11+ → 4♥', () => {
    expect(ink(HJ_13, OVER_D, '3D')).toMatchObject({ bid: '4H', rule: 'efter ovanlig 2NT: stark efter cue' })
  })
  it('advancern mot svagt svar: 12+ → 4♥, annars stopp i hjärter', () => {
    const efterD = (N: string) => decideCall(giv(TOM, N), [...OVER_D, call('N', '3D'), call('E', 'P'), call('S', '3H'), call('W', 'P')], 'N')
    const efterC = (N: string) => decideCall(giv(TOM, N), [...OVER_C, call('N', '3C'), call('E', 'P'), call('S', '3D'), call('W', 'P')], 'N')
    expect(efterD('S:AT82 H:Q87 D:8432 C:K5').bid).toBe('P')
    expect(efterD('S:AK82 H:Q87 D:8432 C:K5').bid).toBe('4H')
    expect(efterC('S:AT82 H:Q87 D:K5 C:8432').bid).toBe('3H')
  })
})

describe('slam = systems on: poängen bekräftade och vi är på 4-läget → 4NT (ägarbeslut 2026-09-21)', () => {
  const INK_17 = 'S:A2 H:4 D:AQJ63 C:KQJ32' // 17 hp → inbjöd 4♣
  const ADV_19 = 'S:KQ82 H:AK72 D:K3 C:A5' // 19 hp: 17 + 19 = 36
  const INBJUDAN = [...OVER_H, call('N', '3C'), call('E', 'P'), call('S', '4C'), call('W', 'P')]

  it('advancern mot 4♣-inbjudan (17+): 16+ hp → 4NT, även i lågfärg · 15 hp → bara 5♣', () => {
    expect(decideCall(giv(INK_17, ADV_19), INBJUDAN, 'N')).toMatchObject({ bid: '4NT', rule: 'konkurrens-slaminvit (RKC)' })
    expect(decideCall(giv(INK_17, 'S:KQ82 H:AJ72 D:K3 C:Q65'), INBJUDAN, 'N').bid).toBe('5C') // 15 hp
  })
  it('HELA växlingen: fråga → svar (klöver trumf) → placering', () => {
    const fraga = [...INBJUDAN, { ...call('N', '4NT'), rule: 'konkurrens-slaminvit (RKC)' } as ResolvedCall, call('E', 'P')]
    const svar = decideCall(giv(INK_17, ADV_19), fraga, 'S')
    expect(svar.bid).toBe('5D') // 1430: tre nyckelkort (♠A ♦A ♣K)
    const placering = decideCall(giv(INK_17, ADV_19), [...fraga, { ...call('S', '5D'), rule: svar.rule } as ResolvedCall, call('W', 'P')], 'N')
    expect(placering.bid).toBe('6C')
  })
  it('hjärterfit: starkt svar 4♥ (11+) och 22+ hp hos advancern → 4NT', () => {
    const h = [...OVER_D, call('N', '3D'), call('E', 'P'), call('S', '4H'), call('W', 'P')]
    expect(decideCall(giv(TOM, 'S:AKQ2 H:KQ7 D:A43 C:KJ5'), h, 'N').bid).toBe('4NT') // 22 hp
  })
})

describe('SVARAREN över deras ovanliga 2NT: självbärande högfärg + öppningsstyrka → 4M (ägarbeslut 2026-09-22, frö 20296021)', () => {
  const giv2 = (W: string): Deal =>
    ({ id: 't', board: 1, dealer: 'E', vulnerability: 'none',
      hands: { N: parseHand(TOM), E: parseHand(TOM), S: parseHand(TOM), W: parseHand(W) } } as Deal)
  const svar = (W: string, open = '1H') => decideCall(giv2(W), [call('E', open), call('S', '2NT')], 'W')

  it('FRÖET: ♠AKQJ865 ♥Q4 ♦3 ♣K82 (15 hp) över 1♥–(2NT) → 4♠, inte pass', () => {
    expect(svar('S:AKQJ865 H:Q4 D:3 C:K82')).toMatchObject({ bid: '4S', rule: 'utgång på självbärande färg' })
  })
  it('sexkortsfärg med AKQ räcker · sju kort med bara två topphonnörer räcker', () => {
    expect(svar('S:AKQ865 H:Q4 D:32 C:K82').bid).toBe('4S')
    expect(svar('S:AKJ9865 H:Q4 D:3 C:K82').bid).toBe('4S')
  })
  it('utan öppningsstyrka (10 hp) eller utan självbärande färg → som förr (pass)', () => {
    expect(svar('S:AKQ865 H:74 D:32 C:982').bid).toBe('P')
    expect(svar('S:AJT865 H:Q4 D:3 C:KQ82').bid).toBe('P')
  })
  it('över 1♠–(2NT): hjärterfärgen på samma sätt → 4♥', () => {
    expect(svar('S:Q4 H:AKQJ865 D:3 C:K82', '1S').bid).toBe('4H')
  })
})

describe('budförklaringarna', () => {
  it('2NT står som krav, och preferensen som tvingad', () => {
    expect(meaningOf([call('E', '1H'), call('S', '2NT')], 1).text).toMatch(/partnern får inte passa/i)
    const m = meaningOf([...OVER_H, call('N', '3C')], 3)
    expect(m.rule).toBe('advance tvåfärg (preferens)')
    expect(m.text).toMatch(/tvingat/)
    expect(m.text).toMatch(/0 poäng/)
  })
  it('inklivarens inbjudan och advancerns cue förklaras', () => {
    expect(meaningOf([...OVER_H, call('N', '3C'), call('E', 'P'), call('S', '4C')], 5).rule).toBe('efter ovanlig 2NT: inbjudan')
    expect(meaningOf([...OVER_H, call('N', '3H')], 3).text).toContain('11+ hp')
    expect(meaningOf([...OVER_D, call('N', '3D')], 3).text).toContain('8+ hp')
  })
})
