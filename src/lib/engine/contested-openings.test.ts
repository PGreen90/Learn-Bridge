import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { answerPreemptInterference } from './contested-openings'

// Fynd #2 delbit 4 (facit): svararens svar när motståndaren stör vår
// icke-1-färgs-öppning. Ägarbeslut 2026-07-04 (väg A): straff/värden-golv 8 hp
// mot DONT-störning av vårt 1NT; XX-golv 10 hp mot takeout av vår svaga tvåa.
// (OBS: tian skrivs 'T' i handtexterna – annars parsas t.ex. '10' som två kort.)

describe('answerPreemptInterference – störning av vår svaga tvåa / spärr', () => {
  it('takeout-X mot vår svaga tvåa, 10+ utan fit → XX (värden)', () => {
    const hand = parseHand('S:Q4 H:AJ73 D:KJ52 C:T84') // 11 hp, 2-korts stöd
    expect(answerPreemptInterference(hand, 'spades', 'X', 2)).toMatchObject({ call: 'XX', rule: 'redubbling (värden)' })
  })

  it('takeout-X, under XX-golvet (6 hp) men fit → spärrhöjning', () => {
    const hand = parseHand('S:Q84 H:J73 D:K952 C:T84') // 6 hp, 3-korts spaderstöd
    expect(answerPreemptInterference(hand, 'spades', 'X', 2)).toMatchObject({ call: '3S', rule: 'spärrhöjning' })
  })

  it('takeout-X, svag utan fit → pass', () => {
    const hand = parseHand('S:4 H:J8732 D:K952 C:T84') // 4 hp, singel spader
    expect(answerPreemptInterference(hand, 'spades', 'X', 2).call).toBe('P')
  })

  it('naturligt inkliv av dem, fit → fortsatt spärrhöjning', () => {
    const hand = parseHand('S:Q84 H:J73 D:K952 C:T84') // 3-korts stöd
    expect(answerPreemptInterference(hand, 'spades', '3H', 2)).toMatchObject({ call: '3S', rule: 'spärrhöjning' })
  })

  it('spärr (3-läget) kräver bara 2-korts fit för höjning', () => {
    const hand = parseHand('S:8642 H:J732 D:K9 C:T85') // 2-korts ruterstöd
    expect(answerPreemptInterference(hand, 'diamonds', 'X', 3)).toMatchObject({ call: '4D', rule: 'spärrhöjning' })
  })
})

// Felrapport #82 (2026-09-25): svararen med 3+ stöd och 13+ hp CUE:ar deras
// inklivsfärg (stark höjning, krav) i stället för den spärrande höjningen.
describe('answerPreemptInterference – cue = stark höjning (felrapport #82)', () => {
  it('2♦–(2♠) med 17 hp och 3-korts stöd → 3♠ (cue, krav)', () => {
    const hand = parseHand('S:- H:AQ95 D:KQ2 C:AQT743')
    expect(answerPreemptInterference(hand, 'diamonds', '2S', 2)).toMatchObject({ call: '3S', rule: 'cue (limithöjning+)' })
  })
  it('2♥–(3♣) med 14 hp och 3-korts stöd → 4♣ (cue över ett 3-lägesinkliv)', () => {
    const hand = parseHand('S:A43 H:K52 D:KQ42 C:J63')
    expect(answerPreemptInterference(hand, 'hearts', '3C', 2)).toMatchObject({ call: '4C', rule: 'cue (limithöjning+)' })
  })
  it('under 13 hp med stöd → spärrhöjningen står kvar', () => {
    const hand = parseHand('S:Q84 H:J73 D:K952 C:T84') // 6 hp
    expect(answerPreemptInterference(hand, 'spades', '3H', 2)).toMatchObject({ call: '3S', rule: 'spärrhöjning' })
  })
  it('13+ utan stöd över deras 3-lägesbud: med fyra i deras färg → X (straff, ägarens struktur); annars pass', () => {
    const hand = parseHand('S:4 H:AQ73 D:KJ52 C:KJ84') // 14 hp, singel i vår spader, fyra hjärter
    expect(answerPreemptInterference(hand, 'spades', '3H', 2).call).toBe('X')
    const utanStack = parseHand('S:4 H:A73 D:KJ52 C:KJ843') // 13 hp, tre hjärter, 5 klöver (3-läget: ingen ny färg)
    expect(answerPreemptInterference(utanStack, 'spades', '3H', 2).call).toBe('P')
  })
})

// Ägarens struktur 2026-09-25 (bricka 3: ♠AKJ5 ♥A843 ♦JT ♣QJ8 = 16 hp passade
// 2♦–(2♥) och sedan deras 3♥): 2NT = Ogust systems on (krav), 3NT = 18+ med
// stopp, ny färg = 5+/12+ och förnekar 2-korts stöd, X på 3-läget = straff.
describe('answerPreemptInterference – utan fit efter deras inkliv (ägarens struktur 2026-09-25)', () => {
  const nord = parseHand('S:AKJ5 H:A843 D:JT C:QJ8') // 16 hp, två ruter
  it('16 hp utan fit över 2♦–(2♥) → 2NT Ogust (systems on)', () => {
    expect(answerPreemptInterference(nord, 'diamonds', '2H', 2)).toMatchObject({ call: '2NT', rule: 'Ogust' })
  })
  it('andra ronden över deras 3♥: fyra hjärter + 16 hp → X (straff)', () => {
    expect(answerPreemptInterference(nord, 'diamonds', '3H', 2)).toMatchObject({ call: 'X', rule: 'straffdubbling' })
  })
  it('18+ med stopp i deras färg → 3NT till spel', () => {
    expect(answerPreemptInterference(parseHand('S:AKJ5 H:AJ3 D:J2 C:AQJ8'), 'diamonds', '2H', 2)).toMatchObject({ call: '3NT', rule: '3NT till spel' })
  })
  it('ny färg: 5+ kort, 12+ hp och högst 1 kort i vår färg → 2♠ (krav 1 rond)', () => {
    expect(answerPreemptInterference(parseHand('S:AQJ97 H:652 D:8 C:KQ43'), 'diamonds', '2H', 2)).toMatchObject({ call: '2S', rule: 'ny färg (krav)' })
  })
  it('ny färg nekas med 2-korts stöd: 12–14 passar, 15+ frågar Ogust', () => {
    expect(answerPreemptInterference(parseHand('S:AQJ97 H:65 D:82 C:KQ43'), 'diamonds', '2H', 2).call).toBe('P')
    expect(answerPreemptInterference(parseHand('S:AQJ97 H:K5 D:82 C:KQ43'), 'diamonds', '2H', 2)).toMatchObject({ call: '2NT', rule: 'Ogust' })
  })
  it('fit 11–12 → Ogust (systems on), inte spärrhöjning', () => {
    expect(answerPreemptInterference(parseHand('S:A85 H:J6 D:K93 C:KJ983'), 'diamonds', '2H', 2)).toMatchObject({ call: '2NT', rule: 'Ogust' })
  })
  it('deras 3-lägesbud utan trumfstack och under 18 → pass', () => {
    expect(answerPreemptInterference(parseHand('S:KQJ5 H:43 D:J8 C:AQJ83'), 'diamonds', '3H', 2).call).toBe('P')
  })
})

// Ägarbeslut 2026-09-25: X av deras 2-lägesinkliv = upplysning (två objudna lika
// långa, minst 4-4, förnekar vår färg helt); exakt två kort i vår färg → 3x tävlande.
describe('answerPreemptInterference – upplysningsdubbling och tvåkortshöjning (2026-09-25)', () => {
  it('4-4 i de objudna, singel i vår färg, 10 hp → X (upplysning)', () => {
    expect(answerPreemptInterference(parseHand('S:KQ84 H:9532 D:7 C:AJ86'), 'diamonds', '2H', 2)).toMatchObject({ call: 'X', rule: 'negativ dubbling' })
  })
  it('5-5 lika långa → också X (inte ny färg)', () => {
    expect(answerPreemptInterference(parseHand('S:KQ843 H:9 D:7 C:AJ865'), 'diamonds', '2H', 2)).toMatchObject({ call: 'X', rule: 'negativ dubbling' })
  })
  it('5-4 ojämnt med 12+ → ny färg, inte X', () => {
    expect(answerPreemptInterference(parseHand('S:KQ843 H:95 D:7 C:AKJ6'), 'diamonds', '2H', 2)).toMatchObject({ call: '2S', rule: 'ny färg (krav)' })
  })
  it('exakt två kort i vår färg med värden → 3♦ tävlande (ej krav), inte X', () => {
    expect(answerPreemptInterference(parseHand('S:KQ84 H:953 D:72 C:AJ86'), 'diamonds', '2H', 2)).toMatchObject({ call: '3D', rule: 'konkurrenshöjning' })
  })
  it('4-4 men bara 8 hp → pass', () => {
    expect(answerPreemptInterference(parseHand('S:KQ84 H:9532 D:7 C:J986'), 'diamonds', '2H', 2).call).toBe('P')
  })
})
