// Låser konventionerna i bridge-dds-adaptern (revisor-dds.ts): PBN-formatet,
// resTable-indexeringen och DealerPar-tecknet. Körs i vanliga sviten — snabb
// (en trivial giv), och skyddar mätriggen mot tysta indexfel.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { computeOracle, dealToPbn, getDds } from './revisor-dds'

/** N har 13 topstick i NT/♠ — facit är känt utan lösare. */
const SOLID: Deal = {
  id: 'solid',
  board: 1,
  dealer: 'E',
  vulnerability: 'none',
  hands: {
    N: parseHand('S:AKQJ H:AKQ D:AKQ C:AKQ'),
    E: parseHand('S:T987 H:J87 D:J87 C:J87'),
    S: parseHand('S:6543 H:T96 D:T96 C:T96'),
    W: parseHand('S:2 H:5432 D:5432 C:5432'),
  },
}

describe('revisor-dds (bridge-dds-adaptern)', () => {
  it('dealToPbn skriver given i PBN-form medurs från N', () => {
    expect(dealToPbn(SOLID)).toBe(
      'N:AKQJ.AKQ.AKQ.AKQ T987.J87.J87.J87 6543.T96.T96.T96 2.5432.5432.5432',
    )
  })

  it('tabellen och par stämmer på en giv med känt facit', async () => {
    const dds = await getDds()
    const oracle = computeOracle(dds, SOLID)
    // N tar 13 stick i NT och ♠; Ö/V tar aldrig 7 i något.
    expect(oracle.solve('N', 'NT')).toBe(13)
    expect(oracle.solve('N', 'spades')).toBe(13)
    expect(oracle.solve('E', 'NT')).toBeLessThan(7)
    expect(oracle.solve('W', 'hearts')).toBeLessThan(7)
    // Par = 7NT av N/S, ozon = 220 + 300 + 1000 = +1520 sett från N/S — givaren
    // är Ö, så plustecknet låser att DealerPar-poängen är NS-orienterad.
    expect(oracle.parNS).toBe(1520)
  })
})
