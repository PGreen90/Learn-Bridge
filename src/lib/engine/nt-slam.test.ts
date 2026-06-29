import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { gerberInvestigation } from './nt-slam'

describe('gerberInvestigation – Gerber 4♣ över 1NT (Steg 4)', () => {
  it('ett ess saknas → 6NT', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:K532 C:A87') // 17 hp, ♠A+♣A (2 ess)
    const responder = parseHand('S:K32 H:KQ4 D:AQ76 C:KQ3') // 19 hp, ♦A (totalt 3 ess)
    const turns = gerberInvestigation(opener, responder)!
    expect(turns.map((t) => t.call)).toEqual(['4C', '4S', '6NT'])
    expect(turns[0].rule).toBe('Gerber')
  })

  it('två ess saknas → stannar i 4NT', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:KJ32 C:K83') // 17 hp, 1 ess (♠A)
    const responder = parseHand('S:K32 H:KQ4 D:AQ76 C:KQ3') // 19 hp, 1 ess (♦A) → 2 ess saknas
    const turns = gerberInvestigation(opener, responder)!
    expect(turns.map((t) => t.call)).toEqual(['4C', '4H', '4NT'])
    expect(turns[2].rule).toBe('Gerber: stannar')
  })

  it('alla ess + storslamszon → kungfråga 5♣ → 7NT', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:A532 C:K83') // 17 hp, ♠A+♦A, ♥K+♣K
    const responder = parseHand('S:K32 H:AQ4 D:KQ7 C:AQ76') // 20 hp, ♥A+♣A, ♠K+♦K
    const turns = gerberInvestigation(opener, responder)!
    expect(turns.map((t) => t.call)).toEqual(['4C', '4S', '5C', '5S', '7NT'])
  })

  it('för svag (16–17) → null (stannar som kvantitativ 4NT)', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:K532 C:A87')
    const responder = parseHand('S:K32 H:Q54 D:AQ76 C:KQ3') // ~16 hp
    expect(gerberInvestigation(opener, responder)).toBeNull()
  })

  it('4-korts högfärg → null (Stayman/transfer-vägen)', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:K532 C:A87')
    const responder = parseHand('S:KQ32 H:AQ4 D:AQ7 C:K3') // 4 spader
    expect(gerberInvestigation(opener, responder)).toBeNull()
  })
})

describe('buildAuction – Gerber växer fram över 1NT (Steg 4)', () => {
  it('1NT–4C–4S–5C–5S–7NT i en hel auktion', () => {
    const deal: Deal = {
      id: 'slam-gerber',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AQ5 H:KJ4 D:K532 C:A87'), // 17 hp balanserad → 1NT
        E: parseHand('S:JT9 H:T98 D:JT8 C:JT96'), // svag → inget inkliv
        S: parseHand('S:K83 H:AQ3 D:AQ7 C:KQ32'), // 20 hp balanserad, ingen högfärg → Gerber
        W: parseHand('S:7642 H:7652 D:964 C:54'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1NT', '4C', '4S', '5C', '5S', '7NT'])
    expect(a.open).toBe(false)
  })
})
