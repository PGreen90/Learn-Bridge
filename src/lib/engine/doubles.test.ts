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
  it('exakt 3 stöd → X', () => {
    expect(supportDouble(parseHand('S:K43 H:A32 D:KQ32 C:432'), 'spades')?.call).toBe('X')
  })
  it('4 stöd → null (höj naturligt i stället)', () => {
    expect(supportDouble(parseHand('S:K432 H:A32 D:KQ3 C:432'), 'spades')).toBeNull()
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
