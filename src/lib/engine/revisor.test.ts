// Enhetstest för Systemrevisorns rena logik (docs/systemrevisorn.md).
// DD-lösaren FEJKAS här (injicerad funktion) så testerna är blixtsnabba —
// den riktiga mätningen bor i revisor.probe.test.ts (REVISOR-gated).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import {
  bestSideContract,
  botAuction,
  dealFromSeed,
  judgeDeal,
  mulberry32,
  type DDSolver,
} from './revisor'
import { auctionComplete } from './auction-live'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']

/** Testgiv med LÅST dealer (N) och zon så budföljder & poäng är deterministiska. */
const DEAL: Deal = { ...dealFromSeed(1), dealer: 'N', vulnerability: 'none' }

/** Fejkad DD: N/S-stick per strain (E/W via ewTricks), allt annat 6 stick. */
function nsSolver(ns: Partial<Record<string, number>>, ew: Partial<Record<string, number>> = {}): DDSolver {
  return (declarer, strain) => {
    const table = declarer === 'N' || declarer === 'S' ? ns : ew
    return table[strain] ?? 6
  }
}

/** Budföljd medurs från N. */
function calls(bids: string[]): ResolvedCall[] {
  return bids.map((bid, i) => ({ seat: SEATS[i % 4], bid: bid as ResolvedCall['bid'] }))
}

describe('mulberry32/dealFromSeed', () => {
  it('samma frö ger exakt samma giv (repro-garantin)', () => {
    const a = dealFromSeed(42)
    const b = dealFromSeed(42)
    expect(a.hands).toEqual(b.hands)
    expect(a.dealer).toBe(b.dealer)
    expect(a.vulnerability).toBe(b.vulnerability)
    const r1 = mulberry32(7)
    const r2 = mulberry32(7)
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()])
  })

  it('olika frön ger olika givar', () => {
    expect(dealFromSeed(1).hands).not.toEqual(dealFromSeed(2).hands)
  })
})

describe('botAuction', () => {
  it('bjuder klart en giv med alla fyra sätena och auktionen är komplett', () => {
    const deal = dealFromSeed(1)
    const history = botAuction(deal)
    expect(history).not.toBeNull()
    expect(auctionComplete(history!)).toBe(true)
    const start = SEATS.indexOf(deal.dealer)
    history!.forEach((c, i) => expect(c.seat).toBe(SEATS[(start + i) % 4]))
  })
})

describe('bestSideContract', () => {
  it('väljer kontraktet med högst poäng och bjuder på exakt görbar nivå', () => {
    // N/S: 10 stick i hjärter (4H = utgång) slår 9 i sang (bara 1NT+/3NT gräns).
    const best = bestSideContract(DEAL, nsSolver({ hearts: 10, NT: 9 }), 'NS')
    expect(best).toBeTruthy()
    expect(best!.contract.strain).toBe('hearts')
    expect(best!.contract.level).toBe(4)
    expect(best!.tricks).toBe(10)
  })

  it('returnerar null när sidan inte kan ta hem något', () => {
    expect(bestSideContract(DEAL, () => 5, 'NS')).toBeNull()
  })

  it('returnerar undefined när nodbudgeten sprängs', () => {
    expect(bestSideContract(DEAL, () => null, 'NS')).toBeUndefined()
  })
})

describe('judgeDeal — kategorisering', () => {
  it('motorn landar i optimum → ratt, poängtapp 0', () => {
    const v = judgeDeal(DEAL, calls(['1H', 'P', '4H', 'P', 'P', 'P']), nsSolver({ hearts: 10 }), 1)
    expect(v!.category).toBe('ratt')
    expect(v!.loss).toBe(0)
  })

  it('utpassad giv med görbart kontrakt → utpassad', () => {
    const v = judgeDeal(DEAL, calls(['P', 'P', 'P', 'P']), nsSolver({ spades: 9 }), 1)
    expect(v!.category).toBe('utpassad')
    expect(v!.loss).toBeGreaterThan(0)
  })

  it('stannar i delkontrakt när utgång fanns → missad-utgang', () => {
    const v = judgeDeal(DEAL, calls(['1S', 'P', '2S', 'P', 'P', 'P']), nsSolver({ spades: 10 }), 1)
    expect(v!.category).toBe('missad-utgang')
  })

  it('stannar i utgång när lillslam fanns → missad-lillslam', () => {
    const v = judgeDeal(DEAL, calls(['1S', 'P', '4S', 'P', 'P', 'P']), nsSolver({ spades: 12 }), 1)
    expect(v!.category).toBe('missad-lillslam')
  })

  it('stannar i lillslam när storslam fanns → missad-storslam', () => {
    const v = judgeDeal(DEAL, calls(['1S', 'P', '6S', 'P', 'P', 'P']), nsSolver({ spades: 13 }), 1)
    expect(v!.category).toBe('missad-storslam')
  })

  it('bet i rätt strain → for-hogt', () => {
    const v = judgeDeal(DEAL, calls(['1S', 'P', '4S', 'P', 'P', 'P']), nsSolver({ spades: 8 }), 1)
    expect(v!.category).toBe('for-hogt')
  })

  it('bet där facit låg i en annan strain → fel-farg-bet', () => {
    const v = judgeDeal(
      DEAL,
      calls(['1S', 'P', '4S', 'P', 'P', 'P']),
      nsSolver({ spades: 8, hearts: 10 }),
      1,
    )
    expect(v!.category).toBe('fel-farg-bet')
  })

  it('hemspelat men fel strain lämnar poäng → fel-strain', () => {
    // 3NT går (9 stick, 400/600) men 4S (10 stick, 420/620) var bäst.
    const v = judgeDeal(
      DEAL,
      calls(['1NT', 'P', '3NT', 'P', 'P', 'P']),
      nsSolver({ NT: 9, spades: 10 }),
      1,
    )
    expect(v!.category).toBe('fel-strain')
  })

  it('motståndarna köper och spelar hem fast vi ägde given → sald-giv', () => {
    // E spelar hem 1S (8 stick) medan N/S hade 3NT.
    const v = judgeDeal(
      DEAL,
      calls(['P', '1S', 'P', 'P', 'P']),
      nsSolver({ NT: 9 }, { spades: 8 }),
      1,
    )
    expect(v!.category).toBe('sald-giv')
  })

  it('motståndarna offrar och går bet för billigt → billig-offring', () => {
    // E går bet odubblat i 3S medan N/S hade 4H.
    const v = judgeDeal(
      DEAL,
      calls(['1H', '3S', 'P', 'P', 'P']),
      nsSolver({ hearts: 10 }, { spades: 7 }),
      1,
    )
    expect(v!.category).toBe('billig-offring')
  })

  it('dubblad hemgång ger mer än v1-facit → battre-an-facit', () => {
    // N/S spelar hem 4S dubblat (insult + dubblade trickpoäng > odubblat facit).
    const v = judgeDeal(
      DEAL,
      calls(['1S', 'P', '4S', 'X', 'P', 'P', 'P']),
      nsSolver({ spades: 10 }),
      1,
    )
    expect(v!.category).toBe('battre-an-facit')
  })

  it('olösbar giv → undefined (given skippas)', () => {
    expect(judgeDeal(DEAL, calls(['P', 'P', 'P', 'P']), () => null, 1)).toBeUndefined()
  })
})

describe('judgeDeal — riktig par-poäng som facit', () => {
  const auction4S = calls(['1S', 'P', '4S', 'P', 'P', 'P'])

  it('par-referensen styr poängtappet (exakt par → ratt)', () => {
    // 4S av N/S i ozon = 420; parNS säger också 420 → 0 i tapp.
    const v = judgeDeal(DEAL, auction4S, nsSolver({ spades: 10 }), 1, 420)
    expect(v!.optimumNS).toBe(420)
    expect(v!.loss).toBe(0)
    expect(v!.category).toBe('ratt')
  })

  it('mer än par (motståndarna offrade inte) → battre-an-facit', () => {
    // Par var bara +300 (deras billiga offring), men de lät 4S=420 stå.
    const v = judgeDeal(DEAL, auction4S, nsSolver({ spades: 10 }), 1, 300)
    expect(v!.achievedNS).toBe(420)
    expect(v!.optimumNS).toBe(300)
    expect(v!.loss).toBe(120)
    expect(v!.category).toBe('battre-an-facit')
  })
})
