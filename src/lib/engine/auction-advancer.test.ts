import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// FAS 2 punkt 10: advancer-logik (systembok §7.1) inkopplad i den levande auktionen.
//
// FACIT (arbetsregel A): giv → rätt bud.
//   Ostört advance-läge: öppning 1 i färg – (LHO enkelt 1-läges inkliv) –
//   (svararen passar) – advancern (inklivarens partner) svarar: höjning,
//   cue = limithöjning+, ny färg, NT eller fit-jump (hopp = stöd + sidofärg).
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

describe('FAS 2 punkt 10 – advancer i den levande auktionen', () => {
  it('1♦ – (1♥) – P – fit-jump 2♠ (advancern: 4 hjärter + 5 spader)', () => {
    const a = buildAuction(
      deal(
        'S:A32 H:5 D:AKJ432 C:K32', // N: 15 hp, 6 ruter, singel hjärter → 1♦
        'S:A2 H:KQJ54 D:32 C:5432', // E (LHO): 10 hp, 5 hjärter → enkelt inkliv 1♥
        'S:762 H:J32 D:Q765 C:J43', // S: 4 hp → pass
        'S:KQJ54 H:A432 D:32 C:32', // W (advancer): 10 hp, 4 hjärter + 5 spader → fit-jump 2♠
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1D', '1H', 'P', '2S'])
    expect(a?.turns[3].rule).toBe('fit-jump')
    expect(a?.open).toBe(true)
  })

  it('1♦ – (1♥) – P – cue 2♦ (advancern: limithöjning+ med 3 stöd)', () => {
    const a = buildAuction(
      deal(
        'S:A32 H:5 D:AKJ432 C:K32', // N: 1♦
        'S:A2 H:KQJ54 D:32 C:5432', // E: enkelt inkliv 1♥
        'S:762 H:J32 D:Q765 C:J43', // S: pass
        'S:A32 H:KQ4 D:32 C:A5432', // W: 13 hp, 3 hjärter → cue 2♦ (limithöjning+)
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1D', '1H', 'P', '2D'])
    expect(a?.turns[3].rule).toBe('cue (limithöjning+)')
    expect(a?.open).toBe(true)
  })
})
