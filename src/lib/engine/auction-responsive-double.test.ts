import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// FAS 2 punkt 9: responsiv dubbling (systembok §7.3) inkopplad i den levande auktionen.
//
// FACIT (arbetsregel A): giv → rätt bud.
//   Sekvens: (1M) – X (partnerns upplysningsdubbling) – (2M, svararen höjer) –
//   X (advancern = dubblarens partner, responsiv). Visar stöd i de objudna
//   färgerna (7+ hp, ingen lång egen färg). Gäller när MOTSTÅNDARENS färg höjts.
// Obs: hands per giv utvärderas oberoende av buildAuction (kortöverlapp spelar
// ingen roll), precis som filler-handen i övriga auktionstester.

function deal(N: string, E: string, S: string, W: string): Deal {
  return {
    id: 'test',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) },
  }
}

describe('FAS 2 punkt 9 – responsiv dubbling i den levande auktionen', () => {
  it('1♥ – (X) – 2♥ – (X responsiv av advancern)', () => {
    const a = buildAuction(
      deal(
        'S:K2 H:AKJ43 D:K32 C:432', // N: 14 hp, 5 hjärter → 1♥
        'S:AQ32 H:5 D:KJ32 C:KQ32', // E (LHO): 15 hp, kort hjärter, stöd i övriga → X
        'S:Q765 H:Q83 D:QT9 C:765', // S: 6 hp, 3 hjärter → konkurrenshöjning 2♥
        'S:KJ87 H:2 D:AJ54 C:JT98', // W (advancer): 10 hp, stöd i objudna färger → responsiv X
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', 'X', '2H', 'X'])
    expect(a?.turns[3].rule).toBe('responsiv dubbling')
    expect(a?.open).toBe(true)
  })
})
