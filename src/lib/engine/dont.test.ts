import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { dontOvercall, advanceDONT } from './dont'

const d = (n: string) => dontOvercall(parseHand(n)).call

describe('dontOvercall – DONT mot deras 1NT (§7.5)', () => {
  it('enfärgshand (hjärter 6+) → X', () => {
    expect(d('S:32 H:KQ9876 D:K32 C:32')).toBe('X')
  })
  it('klöver + högre färg → 2♣', () => {
    expect(d('S:32 H:KQ43 D:32 C:KQ542')).toBe('2C')
  })
  it('ruter + högre färg → 2♦', () => {
    expect(d('S:32 H:KQ43 D:KQ542 C:32')).toBe('2D')
  })
  it('hjärter + spader → 2♥', () => {
    expect(d('S:KQ43 H:KQ542 D:32 C:32')).toBe('2H')
  })
  it('svag spader-enfärgare → 2♠', () => {
    expect(d('S:KQ9876 H:32 D:K32 C:32')).toBe('2S')
  })
  it('ingen en-/tvåfärgshand → pass', () => {
    expect(d('S:QJ3 H:QJ3 D:QJ3 C:J32')).toBe('P')
  })
})

describe('advanceDONT', () => {
  it('svar på X → 2♣ (relä)', () => {
    expect(advanceDONT(parseHand('S:432 H:432 D:5432 C:432'), 'X').call).toBe('2C')
  })
})
