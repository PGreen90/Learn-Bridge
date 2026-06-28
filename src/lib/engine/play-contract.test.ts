import { describe, expect, it } from 'vitest'
import type { Deal, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { dealRandom } from './deal'
import { hcp, lengths } from './hand'
import { pickContract } from './play-contract'
import { side } from './play'

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('pickContract – exakt fall', () => {
  it('8-korts spaderfit + utgångsstyrka → 4♠ av starkaste handen', () => {
    const deal: Deal = {
      id: 't',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:KQ54 H:AQ2 D:K32 C:432'), // 14 hp, 4 spader
        S: parseHand('S:A763 H:K54 D:AQ4 C:765'), // 13 hp, 4 spader
        E: parseHand('S:JT98 H:J98 D:J98 C:AKQ'),
        W: parseHand('S:2 H:T763 D:T765 C:JT98'),
      },
    }
    expect(pickContract(deal)).toEqual({ declarer: 'N', strain: 'spades', level: 4 })
  })
})

describe('pickContract – egenskaper över slumpgivar', () => {
  for (const seed of [1, 2, 3, 7, 42, 99]) {
    it(`giv ${seed}: spelförarsidan är starkast, strain och nivå rimliga`, () => {
      const deal = dealRandom(mulberry32(seed))
      const c = pickContract(deal)
      const decl = side(c.declarer)
      const declHcp =
        decl === 'NS' ? hcp(deal.hands.N) + hcp(deal.hands.S) : hcp(deal.hands.E) + hcp(deal.hands.W)
      const oppHcp = 40 - declHcp
      expect(declHcp).toBeGreaterThanOrEqual(oppHcp) // starkaste sidan spelar

      const [a, b]: [Seat, Seat] = decl === 'NS' ? ['N', 'S'] : ['E', 'W']
      if (c.strain !== 'NT') {
        // Vald högfärg ska vara en äkta 8+ fit.
        const m = c.strain as Suit
        expect(lengths(deal.hands[a])[m] + lengths(deal.hands[b])[m]).toBeGreaterThanOrEqual(8)
      } else {
        // Sang valdes → ingen 8+ högfärgsfit ska finnas.
        for (const m of ['spades', 'hearts'] as Suit[]) {
          expect(lengths(deal.hands[a])[m] + lengths(deal.hands[b])[m]).toBeLessThan(8)
        }
      }
      expect(c.level).toBeGreaterThanOrEqual(1)
      expect(c.level).toBeLessThanOrEqual(7)
    })
  }
})
