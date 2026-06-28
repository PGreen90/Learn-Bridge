import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { dealToPbn } from './dds'

// Den faktiska DDS-uträkningen (CalcDDTablePBN) verifieras i webbläsaren – wasm
// kör inte tillförlitligt i vitest-miljön. Här testas den rena PBN-omvandlingen.

const deal: Deal = {
  id: 'pbn',
  dealer: 'N',
  vulnerability: 'none',
  board: 1,
  hands: {
    N: parseHand('S:AKQ85 H:A432 D:K2 C:32'),
    E: parseHand('S:T943 H:876 D:T43 C:765'),
    S: parseHand('S:J762 H:KQ5 D:AQ6 C:K84'),
    W: parseHand('S:- H:JT9 D:J9875 C:AQJT9'),
  },
}

describe('dealToPbn', () => {
  it('skriver "N:<N> <E> <S> <W>" med S.H.D.C och tian som T', () => {
    expect(dealToPbn(deal)).toBe(
      'N:AKQ85.A432.K2.32 T943.876.T43.765 J762.KQ5.AQ6.K84 .JT9.J9875.AQJT9',
    )
  })

  it('tom färg blir tom grupp (renons visas som inget mellan punkterna)', () => {
    const pbn = dealToPbn(deal)
    expect(pbn.split(' ')[3]).toBe('.JT9.J9875.AQJT9') // Väst renons i spader
  })
})
