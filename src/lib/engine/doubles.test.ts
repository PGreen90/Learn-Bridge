import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { negativeDouble, openerAnswerNegativeDouble, responsiveDouble, supportDouble, answerTakeoutDouble } from './doubles'

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

// Öppnarens svar på partnerns negativa dubbling – rondkrav, aldrig pass.
// Facit ur felrapport #2 (bricka 14): 1♣–(2♥)–X → öppnaren bjuder sin 4-korts
// spader billigast med minimum. §7.3: "öppnaren svarar som på en upplysningsdubbling".
describe('openerAnswerNegativeDouble (§7.3, felrapport #2)', () => {
  it('1♣–(2♥)–X, minimum med 4 spader → 2♠ (billigast)', () => {
    // Östs hand ur felrapporten (12 hp, JT97 i spader).
    const r = openerAnswerNegativeDouble(parseHand('S:JT97 H:KJ D:53 C:AK852'), 'clubs', '2H')
    expect(r.call).toBe('2S')
    expect(r.rule).toBe('svar på negativ dubbling')
  })
  it('extra styrka (16+) → hoppande 3♠', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:AQ97 H:KJ D:A3 C:AK852'), 'clubs', '2H').call).toBe('3S')
  })
  it('1♦–(1♠)–X med 4 hjärter → 2♥ (högfärgen rankar under deras → nivån upp)', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:32 H:KQ43 D:AQJ32 C:43'), 'diamonds', '1S').call).toBe('2H')
  })
  it('ingen fjärde högfärg men stopp i deras färg → billigaste sang', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:32 H:KQ2 D:AQ432 C:K32'), 'diamonds', '2H').call).toBe('2NT')
  })
  it('varken högfärg eller stopp: 6+ egen färg → återbud (aldrig pass)', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:432 H:32 D:AKQJ32 C:K2'), 'diamonds', '2H').call).toBe('3D')
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
