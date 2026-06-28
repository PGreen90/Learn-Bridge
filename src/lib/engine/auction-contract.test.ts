import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { AuctionTurn, BuiltAuction } from './auction'
import { dealForPlay, finalContract, turnsToCalls } from './auction-contract'

function turn(seat: Seat, call: string, role: AuctionTurn['role'] = 'öppnare'): AuctionTurn {
  return { seat, call, role, rule: 't', explanation: 'e' }
}

function auction(turns: AuctionTurn[], open: boolean): BuiltAuction {
  return { openerSeat: turns[0].seat, responderSeat: 'N', openCall: turns[0].call, turns, open }
}

describe('finalContract – slutkontrakt ur en färdig auktion', () => {
  it('öppen auktion (motorn ej klar) → null', () => {
    expect(finalContract(auction([turn('S', '1S')], true))).toBeNull()
  })

  it('saknar kontraktsbud (bara passar) → null', () => {
    expect(finalContract(auction([turn('S', 'P')], false))).toBeNull()
  })

  it('1NT passat ut → 1 NT av öppnaren', () => {
    const c = finalContract(auction([turn('S', '1NT'), turn('N', 'P', 'svarare')], false))
    expect(c).toEqual({ declarer: 'S', strain: 'NT', level: 1 })
  })

  it('spelförare = den som FÖRST nämnde slutfärgen (svararen)', () => {
    // S 1C – N 1S – S 2S (höjning): spader ägs av N/S, först nämnd av N.
    const c = finalContract(
      auction(
        [turn('S', '1C'), turn('N', '1S', 'svarare'), turn('S', '2S'), turn('N', 'P', 'svarare')],
        false,
      ),
    )
    expect(c).toEqual({ declarer: 'N', strain: 'spades', level: 2 })
  })

  it('inkliv: motståndaren spelar slutkontraktet', () => {
    // S 1H – V 2D (inkliv) – passat ut: 2D av Väst (Ö/V).
    const c = finalContract(
      auction(
        [turn('S', '1H'), turn('W', '2D', 'motståndare'), turn('N', 'P', 'svarare')],
        false,
      ),
    )
    expect(c).toEqual({ declarer: 'W', strain: 'diamonds', level: 2 })
  })
})

describe('turnsToCalls – fyller i motståndarpassar', () => {
  it('öppnare S, svarare N (giv S): mellanliggande V passar', () => {
    const calls = turnsToCalls([turn('S', '1NT'), turn('N', '3NT', 'svarare')], 'S')
    expect(calls).toEqual([
      { seat: 'S', bid: '1NT' },
      { seat: 'W', bid: 'P' },
      { seat: 'N', bid: '3NT' },
    ])
  })
})

describe('dealForPlay – kontraktet matchar den visade budgivningen', () => {
  it('100 givar: när en auktion finns slutar den i kontraktet som spelas', () => {
    for (let i = 0; i < 100; i++) {
      const { contract, calls } = dealForPlay()
      expect(contract.level).toBeGreaterThanOrEqual(1)
      expect(contract.level).toBeLessThanOrEqual(7)
      if (calls) {
        // Sista kontraktsbudet i budföljden = kontraktet som spelas.
        const bids = calls.filter((c) => /^[1-7](C|D|H|S|NT)$/.test(c.bid))
        const last = bids[bids.length - 1]
        const strainLetter = contract.strain === 'NT' ? 'NT' : contract.strain[0].toUpperCase()
        expect(last.bid).toBe(`${contract.level}${strainLetter}`)
      }
    }
  })
})
