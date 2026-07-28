import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { defendStrongClub, defendWeakTwo, defendMulti, defendPreempt } from './defense-conventional'

describe('defendStrongClub – Mathe (§7.6)', () => {
  it('båda högfärgerna → X', () => {
    expect(defendStrongClub(parseHand('S:KQ43 H:KQ43 D:32 C:432')).call).toBe('X')
  })
  it('båda minorerna → 1NT', () => {
    expect(defendStrongClub(parseHand('S:32 H:32 D:KQ43 C:KQ43')).call).toBe('1NT')
  })
  it('en 5-färg → naturligt inkliv (1♠)', () => {
    expect(defendStrongClub(parseHand('S:KQ543 H:K2 D:K32 C:432')).call).toBe('1S')
  })
})

describe('defendWeakTwo (§7.6)', () => {
  // Felrapport #18 (github.com/PGreen90/Learn-Bridge/issues/18): cue-budet är
  // krav och tvingar partnern upp på 3-läget – golv 15 hp (ägarbeslut
  // 2026-07-04). En STARK 5-5-hand cue-bjuder …
  it('stark 5-5 (15+) → cue (stark tvåfärg)', () => {
    expect(defendWeakTwo(parseHand('S:AKQ43 H:2 D:AKQ43 C:32'), 'hearts').call).toBe('3H') // 18 hp
  })
  // … men en SVAG 5-5 (10 hp) får inte längre cue-bjuda (förr blev det 3-läges-
  // cue på skräp som sedan spelades i deras färg) – den inkliver naturligt.
  it('svag 5-5 (<15) cue-bjuder ej – naturligt inkliv i stället', () => {
    expect(defendWeakTwo(parseHand('S:KQ543 H:2 D:KQ543 C:32'), 'hearts').call).toBe('2S') // 10 hp
  })
  it('15–18 balanserad med stopp → 2NT-inkliv', () => {
    expect(defendWeakTwo(parseHand('S:K43 H:KQ4 D:KQ32 C:KJ2'), 'spades').call).toBe('2NT')
  })
  it('kort i deras färg + stöd + 12+ → X', () => {
    expect(defendWeakTwo(parseHand('S:KQ43 H:2 D:KQ32 C:Q432'), 'hearts').call).toBe('X')
  })
  it('5-färg utan takeout-form → naturligt inkliv (2♠)', () => {
    expect(defendWeakTwo(parseHand('S:KQ543 H:K32 D:K32 C:32'), 'hearts').call).toBe('2S')
  })

  // Etapp 6 hål 3 (billig offring): TAKET. Fönstren (2NT 15–18/12–15, inkliv
  // 10–16) hade inget utlopp uppåt — starka händer passade ut svaga tvåor.
  it('balanserad 19+ med stopp DIREKT → 3NT till spel (frö 20260767-handen)', () => {
    expect(defendWeakTwo(parseHand('S:AK65 H:Q43 D:AKQJ C:Q2'), 'diamonds').call).toBe('3NT')
  })
  it('balanserad 16+ med stopp i BALANSERING (över 2NT-fönstret 12–15) → 3NT (frö 20261582)', () => {
    expect(defendWeakTwo(parseHand('S:94 H:AKT85 D:AQ7 C:A98'), 'hearts', 10, true).call).toBe('3NT')
  })
  it('stark 6+ minor (två topphonnörer) med stopp från 15 → 3NT till spel (frö 20261571)', () => {
    expect(defendWeakTwo(parseHand('S:62 H:K97 D:AK C:AQJT94'), 'hearts').call).toBe('3NT')
  })
  it('17+ utan stopp och utan takeout-form → X (sälj aldrig given)', () => {
    expect(defendWeakTwo(parseHand('S:AKQ4 H:432 D:AKQ4 C:432'), 'hearts').call).toBe('X')
  })
  it('17 balanserad med stopp DIREKT ligger kvar i 2NT-fönstret (taket rör inte 15–18)', () => {
    expect(defendWeakTwo(parseHand('S:K43 H:KQ4 D:KQ32 C:KJ2'), 'spades').call).toBe('2NT')
  })
})

describe('defendMulti – mot Multi 2♦ (§7.6)', () => {
  it('15–18 balanserad → 2NT', () => {
    expect(defendMulti(parseHand('S:K43 H:KQ4 D:KQ32 C:KJ2')).call).toBe('2NT')
  })
  it('5-korts högfärg → naturligt 2♥', () => {
    expect(defendMulti(parseHand('S:K2 H:KQ543 D:K32 C:432')).call).toBe('2H')
  })
  it('stark hand utan klart färgbud → X', () => {
    expect(defendMulti(parseHand('S:AQ43 H:2 D:KQ32 C:K432')).call).toBe('X')
  })
})

describe('defendPreempt – mot deras spärr 3-läget (§7.6)', () => {
  it('balanserad 16+ med stopp → 3NT', () => {
    expect(defendPreempt(parseHand('S:AQ4 H:KQ3 D:KQ42 C:K32'), 'clubs', 3).call).toBe('3NT')
  })
  it('kort i deras färg + stöd + 14+ → X (takeout)', () => {
    expect(defendPreempt(parseHand('S:KQ43 H:KQ43 D:KQ43 C:2'), 'clubs', 3).call).toBe('X')
  })
  it('bra 5-färg utan stopp/takeout → naturligt inkliv (3♠)', () => {
    expect(defendPreempt(parseHand('S:AKQ43 H:K2 D:K32 C:432'), 'clubs', 3).call).toBe('3S')
  })
  it('svag hand → pass', () => {
    expect(defendPreempt(parseHand('S:Q432 H:Q32 D:Q32 C:432'), 'clubs', 3).call).toBe('P')
  })

  // Etapp 6 hål 4 (ägarbeslut 2026-07-28): tak 16 på naturliga inklivet,
  // 17+ utan fönster dubblar (sälj aldrig given), balansering lånar en kung.
  it('17+ med fel form för allt (2-4-2-5, 21 hp) → X i stället för pass (frö 20261477)', () => {
    expect(defendPreempt(parseHand('S:AK H:AK92 D:T5 C:AQJT2'), 'diamonds', 3).call).toBe('X')
  })
  it('17+ med lång färg utan stopp dubblar först (tak 16 på naturliga inklivet)', () => {
    expect(defendPreempt(parseHand('S:AKQJ43 H:A2 D:K32 C:32'), 'clubs', 3).call).toBe('X')
  })
  it('balansering lånar en kung: takeout-X redan från 11 hp (och 3 kort i deras färg ok)', () => {
    const hand = parseHand('S:KJ43 H:KQ43 D:Q32 C:32')
    expect(defendPreempt(hand, 'clubs', 3).call).toBe('P') // 11 hp direkt: under golvet 14
    expect(defendPreempt(hand, 'clubs', 3, true).call).toBe('X')
  })
  it('kungen lånas INTE mot en 4-lägesöppning (Mätning #18, frö 20261533)', () => {
    const hand = parseHand('S:82 H:KQT972 D:6 C:AQ32') // 11 hp, 6-korts hjärter
    expect(defendPreempt(hand, 'diamonds', 4, true).call).toBe('P') // ingen rabatt på 4-läget
  })
  it('över deras HÖJDA spärr kräver direkta 3NT 19 (X:et tar över under det)', () => {
    const hand = parseHand('S:KT84 H:K9 D:AK82 C:K85') // 16 hp bal, Kx-stopp (frö 20261045)
    expect(defendPreempt(hand, 'hearts', 3, false, true).call).toBe('X') // inte 3NT på 16
    const twenty = parseHand('S:KT84 H:AK9 D:AK82 C:K8') // 20 hp bal (4-3-4-2)
    expect(defendPreempt(twenty, 'hearts', 3, false, true).call).toBe('3NT')
  })
})
