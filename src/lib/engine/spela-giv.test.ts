// Facit för den delade helgivsspelaren (Speldiagnosen steg 1). Låser MODULENS
// kontrakt — inte botens spelstyrka (den mäts av probarna):
//   • en hel giv spelas till exakt 13 stick / 52 kort,
//   • spelaMedFro är deterministisk: samma (giv, playSeed) → identisk kortföljd,
//   • cardFor-kroken tvingar ett kort (utspelet) utan att röra resten.
// Snabbt (går i npm test): MC-fönstret hålls litet via maxCardsForMC.

import { describe, expect, it } from 'vitest'
import { botAuction, dealFromSeed } from './revisor'
import { contractFromCalls } from './auction-contract'
import { legalCards, startPlay, type Contract } from './play'
import { spelaHelGiv, spelaMedFro } from './spela-giv'
import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'

/** Första fröet från `from` vars auktion landar i ett kontrakt (deterministiskt). */
function forstaSpelbara(from: number): { seed: number; deal: Deal; calls: ResolvedCall[]; contract: Contract } {
  for (let seed = from; seed < from + 50; seed++) {
    const deal = dealFromSeed(seed)
    const calls = botAuction(deal)
    const contract = calls && contractFromCalls(calls)
    if (calls && contract) return { seed, deal, calls, contract }
  }
  throw new Error('ingen spelbar giv i frö-fönstret')
}

// Billiga inställningar: tumregler hela vägen (inget Monte-Carlo) → millisekunder.
const BILLIG = { maxCardsForMC: 0 }

describe('spelaHelGiv', () => {
  const { deal, calls, contract } = forstaSpelbara(20260721)

  it('spelar en hel giv till 13 stick / 52 kort och räknar spelförarstick', () => {
    const res = spelaHelGiv(deal, contract, calls, { smart: BILLIG })
    expect(res.tricks).toHaveLength(13)
    expect(res.tricks.flatMap((t) => t.cards)).toHaveLength(52)
    expect(res.finalState.tricksNS + res.finalState.tricksEW).toBe(13)
    expect(res.declarerTricks).toBeGreaterThanOrEqual(0)
    expect(res.declarerTricks).toBeLessThanOrEqual(13)
  })

  it('cardFor tvingar utspelskortet utan att störa resten av given', () => {
    const st0 = startPlay(deal, contract)
    const tvingat = legalCards(st0, st0.toAct)[0]
    const res = spelaHelGiv(deal, contract, calls, {
      smart: BILLIG,
      cardFor: (st) => (st.completedTricks.length === 0 && st.currentTrick.length === 0 ? tvingat : null),
    })
    expect(res.tricks[0].cards[0].card).toEqual(tvingat)
    expect(res.tricks).toHaveLength(13)
  })
})

describe('spelaMedFro', () => {
  const { seed, deal, calls, contract } = forstaSpelbara(20260721)
  // Litet MC-fönster: slumpen ANVÄNDS (sista ~5-kortslägena) men körningen är billig.
  const SMART = { samples: 5, maxNodes: 20_000, maxCardsForMC: 5 }

  it('samma (giv, playSeed) → exakt samma kortföljd', () => {
    const a = spelaMedFro(deal, contract, calls, seed, SMART)
    const b = spelaMedFro(deal, contract, calls, seed, SMART)
    const följd = (r: typeof a) => r.tricks.flatMap((t) => t.cards.map((pc) => `${pc.seat}:${pc.card.suit}${pc.card.rank}`))
    expect(följd(a)).toEqual(följd(b))
    expect(a.declarerTricks).toBe(b.declarerTricks)
  })
})
