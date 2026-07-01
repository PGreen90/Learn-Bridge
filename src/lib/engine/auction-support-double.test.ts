import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// FAS 2 punkt 8: stöddubbling (systembok §7.3) inkopplad i den levande auktionen.
//
// FACIT (arbetsregel A): giv → rätt bud.
//   Sekvens: öppning 1 i färg – (LHO pass) – svararen 1♥/1♠ – (RHO färginkliv).
//   Öppnaren med EXAKT 3 stöd i svararens högfärg upplyser med X (stöddubbling);
//   en direkt höjning skulle visa 4 stöd. Gäller bara så länge "2 i partnerns
//   högfärg" fortfarande kan bjudas (standard: t.o.m. 2M).
// Obs: tian skrivs som T i parseHand (inte "10").

function deal(N: string, E: string, S: string, W: string): Deal {
  return {
    id: 'test',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) },
  }
}

describe('FAS 2 punkt 8 – stöddubbling i den levande auktionen', () => {
  it('1♦ – (P) – 1♥ – (1♠) – X (öppnaren visar exakt 3 hjärter)', () => {
    const a = buildAuction(
      deal(
        'S:A32 H:K32 D:AKJ432 C:2', // N: 15 hp, 6 ruter, EXAKT 3 hjärter → 1♦, sedan stöd-X
        'S:76 H:JT98 D:T8 C:KJT98', // E: 5 hp, inget inkliv → pass
        'S:Q54 H:AQ54 D:65 C:Q543', // S: 10 hp, 4 hjärter → 1♥
        'S:KJT98 H:76 D:Q97 C:A76', // W: 10 hp, 5 spader → inkliv 1♠
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1D', '1H', '1S', 'X'])
    expect(a?.turns[3].rule).toBe('stöddubbling')
    // Stöddubblingen är upplysande → auktionen lämnas öppen (inte utbjuden).
    expect(a?.open).toBe(true)
  })
})
