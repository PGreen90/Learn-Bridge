// Facit för fröet till tävlingens bot-slump: samma ställning ⇒ samma frö
// (reproducerbart för serverns validering), olika ställning ⇒ väl spritt frö.

import { describe, test, expect } from 'vitest'
import { botDecisionSeed, playIndexOf } from './play-seed'

describe('botDecisionSeed', () => {
  test('deterministiskt: samma play-frö + index ⇒ samma frö', () => {
    expect(botDecisionSeed(123456, 7)).toBe(botDecisionSeed(123456, 7))
  })

  test('olika beslutsindex ⇒ olika frö', () => {
    const s = new Set([0, 1, 2, 3, 12, 51].map((i) => botDecisionSeed(999, i)))
    expect(s.size).toBe(6)
  })

  test('olika play-frö ⇒ olika frö (samma index)', () => {
    expect(botDecisionSeed(1, 5)).not.toBe(botDecisionSeed(2, 5))
  })

  test('alltid osignerat 32-bitars heltal', () => {
    for (const [seed, i] of [
      [0, 0],
      [0xffffffff, 51],
      [123456789, 13],
    ] as const) {
      const v = botDecisionSeed(seed, i)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(0xffffffff)
    }
  })
})

describe('playIndexOf', () => {
  test('= spelade kort (0 vid utspel, 4 efter första sticket)', () => {
    expect(playIndexOf(0, 0)).toBe(0)
    expect(playIndexOf(0, 3)).toBe(3)
    expect(playIndexOf(1, 0)).toBe(4)
    expect(playIndexOf(12, 3)).toBe(51)
  })
})
