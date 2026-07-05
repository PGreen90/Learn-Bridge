import { describe, it, expect } from 'vitest'
import { dealRandom } from './deal'
import { contractFromCalls } from './auction-contract'
import { side } from './play'
import { matchesTarget, simulateAuction, dealForTarget, describeTarget, type ContractTarget } from './contract-target'

// Deterministisk PRNG (mulberry32) så testerna alltid delar samma givar.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Slumpar (seedat) tills en giv matchar målet, eller ger upp efter maxTries. */
function findDeal(target: ContractTarget, seed: number, maxTries = 20000) {
  const rng = mulberry32(seed)
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom(rng)
    if (matchesTarget(deal, target)) return deal
  }
  return null
}

describe('matchesTarget – kontraktväljarens filter', () => {
  it('random matchar aldrig (går inte via filtret)', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 50; i++) {
      expect(matchesTarget(dealRandom(rng), 'random')).toBe(false)
    }
  })

  // Varje kontraktsmål: hitta en giv, och bevisa att den funna givens FAKTISKA
  // slutkontrakt (ur den simulerade auktionen) har rätt form och ägs av NS.
  const cases: Array<{
    target: ContractTarget
    seed: number
    check: (level: number, strain: string) => boolean
  }> = [
    { target: 'major-game', seed: 10, check: (l, s) => l === 4 && (s === 'hearts' || s === 'spades') },
    { target: 'minor-game', seed: 20, check: (l, s) => l === 5 && (s === 'clubs' || s === 'diamonds') },
    { target: 'nt-game', seed: 30, check: (l, s) => l === 3 && s === 'NT' },
    { target: 'small-slam', seed: 40, check: (l) => l === 6 },
    { target: 'grand-slam', seed: 50, check: (l) => l === 7 },
  ]

  for (const { target, seed, check } of cases) {
    it(`${target}: hittar en giv vars slutkontrakt matchar och ägs av NS`, () => {
      const deal = findDeal(target, seed)
      expect(deal, `ingen ${target}-giv hittad inom budgeten`).not.toBeNull()

      const contract = contractFromCalls(simulateAuction(deal!))!
      expect(contract).not.toBeNull()
      expect(side(contract.declarer)).toBe('NS')
      expect(check(contract.level, contract.strain)).toBe(true)
    })
  }

  it('competitive: NS äger kontraktet OCH Ö/V har stört med ett riktigt bud', () => {
    const deal = findDeal('competitive', 60)
    expect(deal, 'ingen störd NS-giv hittad inom budgeten').not.toBeNull()

    const calls = simulateAuction(deal!)
    const contract = contractFromCalls(calls)!
    expect(side(contract.declarer)).toBe('NS')

    const opponentBid = calls.some((c) => side(c.seat) === 'EW' && c.bid !== 'P')
    expect(opponentBid).toBe(true)
  })

  it('filtret är konsekvent med en direkt avläsning av den simulerade auktionen', () => {
    // För många slumpade givar: matchesTarget(small-slam) ska vara sant exakt
    // när den simulerade auktionens kontrakt är ett NS-kontrakt på 6-läget.
    const rng = mulberry32(70)
    for (let i = 0; i < 200; i++) {
      const deal = dealRandom(rng)
      const contract = contractFromCalls(simulateAuction(deal))
      const direct = !!contract && side(contract.declarer) === 'NS' && contract.level === 6
      expect(matchesTarget(deal, 'small-slam')).toBe(direct)
    }
  })

  it('dealForTarget hittar en giv som matchar målet (och random ger en giv direkt)', () => {
    const rng = mulberry32(80)
    expect(dealForTarget('random', 40000, rng)).not.toBeNull()
    for (const target of ['major-game', 'nt-game', 'competitive'] as ContractTarget[]) {
      const deal = dealForTarget(target, 40000, mulberry32(81))
      expect(deal, `dealForTarget hittade ingen ${target}`).not.toBeNull()
      expect(matchesTarget(deal!, target)).toBe(true)
    }
  })

  it('dealForTarget ger upp (null) när budgeten är för liten', () => {
    // 1 försök räcker nästan aldrig för storslam (~1 per 1500) → null-vägen körs.
    expect(dealForTarget('grand-slam', 1, mulberry32(82))).toBeNull()
  })

  it('describeTarget ger en läsbar rubrik för varje mål', () => {
    const targets: ContractTarget[] = [
      'random', 'major-game', 'minor-game', 'nt-game', 'small-slam', 'grand-slam', 'competitive',
    ]
    for (const t of targets) {
      expect(describeTarget(t).length).toBeGreaterThan(0)
    }
  })
})
