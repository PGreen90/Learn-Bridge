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

  // Felrapport #20: efter 2♣ (klöver + högre) fick advancern ALLTID pass, även
  // med singel klöver → misfit. Nu: stöd i klöver passar, utan stöd relä 2♦.
  it('2♣ med singel klöver → 2♦ (pass-eller-rätta, ej pass)', () => {
    // Nord i bricka 12: ♠JT97 ♥J732 ♦9862 ♣K – 1 klöver.
    expect(advanceDONT(parseHand('S:JT97 H:J732 D:9862 C:K'), '2C').call).toBe('2D')
  })
  it('2♣ med klöverstöd (3+) → pass', () => {
    expect(advanceDONT(parseHand('S:J97 H:J72 D:982 C:K843'), '2C').call).toBe('P')
  })
  it('2♦ utan ruterstöd → 2♥ (pass-eller-rätta)', () => {
    expect(advanceDONT(parseHand('S:KJ97 H:KJ72 D:2 C:9843'), '2D').call).toBe('2H')
  })
})
