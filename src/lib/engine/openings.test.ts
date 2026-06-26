import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { classifyOpening } from './openings'

function call(notation: string): string {
  return classifyOpening(parseHand(notation)).call
}

describe('classifyOpening', () => {
  it('1NT med balanserad 15–17', () => {
    expect(call('S:AQ5 H:KJ7 D:Q842 C:K93')).toBe('1NT') // 15 hp, 3-3-4-3
  })

  it('2NT med balanserad 20–21', () => {
    expect(call('S:AQ5 H:KQ7 D:AQ82 C:KJ3')).toBe('2NT') // 21 hp, 3-3-4-3
  })

  it('1-högfärg med 5-korts färg och 12+', () => {
    expect(call('S:AKT62 H:K83 D:Q6 C:J52')).toBe('1S') // 13 hp, 5 spader
    expect(call('S:K83 H:AKT62 D:Q6 C:J52')).toBe('1H') // 13 hp, 5 hjärter
  })

  it('minor-regeln utan 5-korts högfärg', () => {
    expect(call('S:KQ72 H:A85 D:K84 C:QT3')).toBe('1C') // 14 hp, 4-3-3-3, klöver 3-3
    expect(call('S:KQ5 H:A8 D:KT62 C:QT43')).toBe('1D') // 14 hp, minorer 4-4
  })

  it('svag tvåa med 6-korts ♦/♥/♠ och 6–11', () => {
    expect(call('S:KQT743 H:84 D:Q72 C:95')).toBe('2S') // 7 hp, 6 spader
  })

  it('spärr på 3-läget med 7-korts färg och svag', () => {
    expect(call('S:KQT7432 H:8 D:Q72 C:95')).toBe('3S') // 7 hp, 7 spader
  })

  it('stark 2♣ med obalanserad 22+', () => {
    expect(call('S:AKQJT98 H:AK D:AKQ C:4')).toBe('2C') // 26 hp, 7-2-3-1
  })

  it('pass med för svag hand', () => {
    expect(call('S:K85 H:Q84 D:J762 C:Q93')).toBe('P') // 8 hp, balanserad
  })
})
