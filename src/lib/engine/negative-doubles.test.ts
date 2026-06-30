import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { negativeDouble } from './doubles'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// FAS 2 punkt 7: verifiera negativa dubblingar för alla vanliga sekvenser.
// Systembok §7.3 (rad 730): svararens X = upplysning, visar de objudna färgerna
// (särskilt objudna högfärger), ~6+ hp.
//
// FACIT (arbetsregel A):
//   - objuden 4-korts högfärg → X (alla 1-/2-lägeslägen).
//   - båda objudna färgerna minorer (motst. klev in i andra högfärgen) → X med
//     4-4 minorer UTAN fit för partnern (med fit höjer man i stället).
// Obs: tian skrivs som T.

describe('FAS 2 punkt 7 – negativ dubbling, objuden högfärg (matris)', () => {
  const M: [string, 'clubs' | 'diamonds', string, string][] = [
    ['1♣–(1♦) 4-4 högfärger', 'clubs', '1D', 'S:KQ32 H:KJ43 D:32 C:432'],
    ['1♣–(1♥) 4 spader', 'clubs', '1H', 'S:KJ43 H:32 D:Q432 C:K32'],
    ['1♣–(1♠) 4 hjärter', 'clubs', '1S', 'S:32 H:KJ43 D:Q432 C:K32'],
    ['1♦–(1♥) 4 spader', 'diamonds', '1H', 'S:KJ43 H:32 D:K32 C:Q432'],
    ['1♦–(1♠) 4 hjärter', 'diamonds', '1S', 'S:32 H:KQ43 D:K32 C:5432'],
  ]
  for (const [name, open, their, hand] of M) {
    it(`${name} → X`, () => {
      expect(negativeDouble(parseHand(hand), open, their)?.call).toBe('X')
    })
  }

  it('2-lägesinkliv: 1♥–(2♣) 4 spader → X', () => {
    expect(negativeDouble(parseHand('S:KJ43 H:32 D:KQ32 C:43'), 'hearts', '2C')?.call).toBe('X')
  })
  it('2-lägesinkliv: 1♥–(2♦) 4 spader → X', () => {
    expect(negativeDouble(parseHand('S:KQ43 H:32 D:43 C:KJ32'), 'hearts', '2D')?.call).toBe('X')
  })
})

describe('FAS 2 punkt 7 – negativ dubbling på objudna minorer', () => {
  // Motståndaren klev in i den ANDRA högfärgen → båda objudna färgerna är minorer.
  it('1♥–(1♠) 4-4 minorer, ingen fit → X', () => {
    expect(negativeDouble(parseHand('S:32 H:43 D:KJ43 C:KQ32'), 'hearts', '1S')?.call).toBe('X')
  })
  it('1♠–(2♥) 4-4 minorer, ingen fit → X', () => {
    expect(negativeDouble(parseHand('S:32 H:43 D:KJ43 C:KQ32'), 'spades', '2H')?.call).toBe('X')
  })
  it('null med fit för partnern (höj i stället för att visa minorer)', () => {
    // 3 hjärter + 4-4 minorer efter 1♥–(1♠): höjning prioriteras, ingen minor-X.
    expect(negativeDouble(parseHand('S:32 H:432 D:KJ43 C:KQ32'), 'hearts', '1S')).toBeNull()
  })
  it('null med bara en lång minor (4-3 räcker inte)', () => {
    expect(negativeDouble(parseHand('S:5432 H:32 D:KJ32 C:Q54'), 'hearts', '1S')).toBeNull()
  })
})

describe('FAS 2 punkt 7 – minor-dubbling i levande auktion', () => {
  it('1♥ – (1♠) – X (negativ, objudna minorer)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K2 H:AKJ43 D:K32 C:432'), // 1♥
        E: parseHand('S:AQT98 H:K5 D:KT32 C:32'), // 1♠
        S: parseHand('S:32 H:43 D:KJ43 C:KQ32'), // 4-4 minorer, ingen fit → X
        W: parseHand('S:765 H:765 D:765 C:8765'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '1S', 'X'])
    expect(a?.turns[2].rule).toBe('negativ dubbling')
  })
})
