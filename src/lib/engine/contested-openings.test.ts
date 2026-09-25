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
  it('13+ utan stöd → pass som förr (cuet lovar fit)', () => {
    const hand = parseHand('S:4 H:AQ73 D:KJ52 C:KJ84') // 14 hp, singel i vår spader
    expect(answerPreemptInterference(hand, 'spades', '3H', 2).call).toBe('P')
  })
})
