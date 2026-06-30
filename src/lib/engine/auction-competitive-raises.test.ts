import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// FAS 2 punkt 5+6: svararens höjningar när motståndaren stört vår högfärgsöppning,
// samt Jordan 2NT (limithöjning efter upplysningsdubbling, systembok §7.3, rad 193).
//
// FACIT (arbetsregel A): giv → rätt bud.
//   - cue i deras färg = limithöjning eller bättre (bra stöd, krav) — systembok §7.1, rad 711.
//   - höjning = konkurrens/spärr, 6–9 (ej inbjudan) — rad 710.
//   - Jordan 2NT = limithöjning med 4+ trumf efter X — rad 193.
//   - XX = 10+ hp utan 4-korts fit.
// Obs: tian skrivs som T i parseHand (inte "10").

const W_FILLER = parseHand('S:765 H:765 D:765 C:8765')

function deal(N: string, E: string, S: string): Deal {
  return {
    id: 'test',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: W_FILLER },
  }
}

describe('FAS 2 punkt 6 – Jordan 2NT efter upplysningsdubbling', () => {
  it('1♥ – (X) – 2NT (Jordan, limithöjning med 4 trumf)', () => {
    const a = buildAuction(
      deal(
        'S:K2 H:AKJ43 D:K32 C:432', // 14 hp, 5 hjärter → 1♥
        'S:AQ32 H:5 D:KJ32 C:KQ32', // 15 hp, kort hjärter, stöd i övriga → X
        'S:KQ3 H:QT98 D:K43 C:432', // 10 hp, 4 hjärter → Jordan 2NT
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', 'X', '2NT'])
    expect(a?.turns[2].rule).toBe('Jordan 2NT')
    // Får ALDRIG tolkas som Jacoby 2NT (utgångskrav, kortfärgsfråga).
    expect(a?.turns[2].rule).not.toBe('Jacoby 2NT')
  })

  it('1♥ – (X) – XX (10+ utan 4-korts fit)', () => {
    const a = buildAuction(
      deal(
        'S:K2 H:AKJ43 D:K32 C:432', // 1♥
        'S:AQ32 H:5 D:KJ32 C:KQ32', // X
        'S:AQ3 H:K3 D:KJ32 C:5432', // 13 hp, bara 2 hjärter → XX
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', 'X', 'XX'])
    expect(a?.turns[2].rule).toBe('redubbling')
  })
})

describe('FAS 2 punkt 5 – svararens höjningar efter färginkliv', () => {
  it('1♥ – (1♠) – 2♠ (cue = limithöjning med stöd)', () => {
    const a = buildAuction(
      deal(
        'S:K2 H:AKJ43 D:K32 C:432', // 1♥
        'S:AQT98 H:K5 D:KT32 C:32', // 12 hp, 5 spader → 1♠
        'S:K32 H:KQ3 D:QT98 C:432', // 10 hp, 3 hjärter → cue 2♠
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '1S', '2S'])
    expect(a?.turns[2].rule).toBe('cue (limithöjning+)')
  })

  it('1♥ – (2♣) – 3♣ (cue = limithöjning på 3-läget)', () => {
    const a = buildAuction(
      deal(
        'S:K2 H:AKJ43 D:K32 C:432', // 1♥
        'S:K3 H:32 D:KT32 C:AQT98', // 12 hp, 5 klöver → 2♣
        'S:K43 H:KQ3 D:KJ32 C:432', // 12 hp, 3 hjärter → cue 3♣
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '2C', '3C'])
    expect(a?.turns[2].rule).toBe('cue (limithöjning+)')
  })

  it('1♥ – (2♦) – 2♥ (svag höjning stannar enkel, ej cue)', () => {
    const a = buildAuction(
      deal(
        'S:K2 H:AKJ43 D:K32 C:432', // 1♥
        'S:K3 H:32 D:AQT98 C:KT32', // 12 hp, 5 ruter → 2♦
        'S:Q43 H:K98 D:32 C:Q5432', // 7 hp, 3 hjärter → enkel 2♥
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '2D', '2H'])
    expect(a?.turns[2].rule).toBe('konkurrenshöjning')
  })

  it('1♠ – (2♥) – 3♥ (cue = limithöjning, spaderfit)', () => {
    const a = buildAuction(
      deal(
        'S:AKJ43 H:K2 D:K32 C:432', // 1♠
        'S:32 H:AQT987 D:KT4 C:K2', // 12 hp, 6 hjärter → 2♥
        'S:QT98 H:K3 D:KQ3 C:5432', // 10 hp, 4 spader → cue 3♥
      ),
    )
    expect(a?.turns.map((t) => t.call)).toEqual(['1S', '2H', '3H'])
    expect(a?.turns[2].rule).toBe('cue (limithöjning+)')
  })
})
