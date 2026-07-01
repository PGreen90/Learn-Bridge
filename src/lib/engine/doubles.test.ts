import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { negativeDouble, responsiveDouble, supportDouble, answerTakeoutDouble } from './doubles'

describe('negativeDouble (§7.3)', () => {
  it('1♦–(1♠)–X med 4+ hjärter', () => {
    expect(negativeDouble(parseHand('S:32 H:KQ43 D:K32 C:5432'), 'diamonds', '1S')?.call).toBe('X')
  })
  it('null utan objuden 4-korts högfärg', () => {
    expect(negativeDouble(parseHand('S:32 H:K3 D:KQ43 C:5432'), 'diamonds', '1S')).toBeNull()
  })
  it('gäller även inkliv på 2-läget: 1♦–(2♣)–X med 4 hjärter', () => {
    expect(negativeDouble(parseHand('S:32 H:KQ43 D:K32 C:5432'), 'diamonds', '2C')?.call).toBe('X')
  })
})

describe('responsiveDouble (§7.3)', () => {
  it('(1♥)–X–(2♥)–X med stöd i objudna färger', () => {
    expect(responsiveDouble(parseHand('S:K43 H:2 D:K432 C:Q432'), 'hearts')?.call).toBe('X')
  })
  it('null med egen lång färg', () => {
    expect(responsiveDouble(parseHand('S:KQ432 H:2 D:K43 C:432'), 'hearts')).toBeNull()
  })
})

describe('supportDouble (§7.3)', () => {
  // 1♦–(P)–1♥–(inkliv): öppnaren med exakt 3 hjärter.
  const threeHearts = parseHand('S:A32 H:K32 D:KQ432 C:32')
  it('exakt 3 stöd, inkliv 1♠ (2♥ finns kvar) → X', () => {
    expect(supportDouble(threeHearts, 'hearts', '1S')?.call).toBe('X')
  })
  it('exakt 3 stöd, inkliv 2♣ (2♥ finns kvar) → X', () => {
    expect(supportDouble(threeHearts, 'hearts', '2C')?.call).toBe('X')
  })
  it('exakt 3 spader, inkliv 2♥ (2♠ finns kvar) → X', () => {
    expect(supportDouble(parseHand('S:K32 H:A32 D:32 C:KQ432'), 'spades', '2H')?.call).toBe('X')
  })
  it('exakt 3 stöd men inkliv 2♠ tar bort 2♥ → null (stöd-X av)', () => {
    expect(supportDouble(threeHearts, 'hearts', '2S')).toBeNull()
  })
  it('inget inkliv (RHO pass) → null (stöd-X finns inte)', () => {
    expect(supportDouble(threeHearts, 'hearts', 'P')).toBeNull()
  })
  it('4 stöd → null (höj naturligt i stället)', () => {
    expect(supportDouble(parseHand('S:K432 H:A32 D:KQ3 C:432'), 'spades', '2H')).toBeNull()
  })
  it('2 stöd → null', () => {
    expect(supportDouble(parseHand('S:K2 H:A32 D:KQ432 C:432'), 'spades', '2H')).toBeNull()
  })
})

describe('answerTakeoutDouble (§7.3)', () => {
  it('svag hand → billigaste färgbud (1♠)', () => {
    expect(answerTakeoutDouble(parseHand('S:KQ43 H:5432 D:32 C:432'), 'diamonds').call).toBe('1S')
  })
  it('9–11 → hoppbud (2♠)', () => {
    expect(answerTakeoutDouble(parseHand('S:KQ43 H:KJ32 D:32 C:432'), 'diamonds').call).toBe('2S')
  })
  it('12+ → cue deras färg (krav)', () => {
    expect(answerTakeoutDouble(parseHand('S:AQ43 H:KJ32 D:32 C:K32'), 'diamonds').call).toBe('2D')
  })
})
