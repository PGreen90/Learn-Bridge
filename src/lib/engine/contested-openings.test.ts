import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { answerNTInterference, answerPreemptInterference } from './contested-openings'

// Fynd #2 delbit 4 (facit): svararens svar när motståndaren stör vår
// icke-1-färgs-öppning. Ägarbeslut 2026-07-04 (väg A): straff/värden-golv 8 hp
// mot DONT-störning av vårt 1NT; XX-golv 10 hp mot takeout av vår svaga tvåa.
// (OBS: tian skrivs 'T' i handtexterna – annars parsas t.ex. '10' som två kort.)

describe('answerNTInterference – störning (DONT) av vårt 1NT', () => {
  it('8+ utan egen färg → X (straff/värden) över deras 2-lägesbud', () => {
    // 13 hp, jämn, ingen 5-färg → dubbla dem (vi äger handen mitt emot 15–17).
    const hand = parseHand('S:AJ96 H:K5 D:QT42 C:K73')
    expect(answerNTInterference(hand, '2H')).toMatchObject({ call: 'X', rule: 'straff/värden' })
  })

  it('8+ utan egen färg → XX (straff/värden) över deras X-relä', () => {
    const hand = parseHand('S:AJ96 H:K5 D:QT42 C:K73')
    expect(answerNTInterference(hand, 'X')).toMatchObject({ call: 'XX', rule: 'straff/värden' })
  })

  it('under golvet (7 hp) utan egen färg → pass', () => {
    const hand = parseHand('S:Q96 H:J75 D:Q842 C:Q73') // 7 hp, jämn, ingen 5-färg
    expect(answerNTInterference(hand, '2H').call).toBe('P')
  })

  it('egen 5+ färg som når 2-läget → naturligt to play (även svag)', () => {
    // Svag hand, 5 spader; över deras 2♥ når spader 2-läget → 2♠.
    const hand = parseHand('S:KJ854 H:63 D:952 C:T74')
    expect(answerNTInterference(hand, '2H')).toMatchObject({ call: '2S', rule: 'naturligt (to play)' })
  })

  it('svag 5-korts-lågfärg som bara når 3-läget → pass (för högt)', () => {
    // 5 klöver, svag; över deras 2♥ hamnar klöver på 3-läget, < 6 kort → pass.
    const hand = parseHand('S:63 H:952 D:T74 C:KJ854')
    expect(answerNTInterference(hand, '2H').call).toBe('P')
  })

  it('6-korts lågfärg får bjudas på 3-läget (to play)', () => {
    const hand = parseHand('S:63 H:95 D:T7 C:KJ8542')
    expect(answerNTInterference(hand, '2H')).toMatchObject({ call: '3C', rule: 'naturligt (to play)' })
  })

  it('stark hand vars enda 5-färg bara når 3-läget → faller till straff-X', () => {
    // 12 hp, 5 klöver (bara 3-läget, < 6) → naturligt uteslutet → X (värden).
    const hand = parseHand('S:A3 H:K5 D:T74 C:KQ854')
    expect(answerNTInterference(hand, '2H')).toMatchObject({ call: 'X', rule: 'straff/värden' })
  })
})

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
