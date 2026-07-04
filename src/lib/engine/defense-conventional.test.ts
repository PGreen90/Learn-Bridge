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
})
