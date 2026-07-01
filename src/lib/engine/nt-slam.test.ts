import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { gerber2NTInvestigation, gerberInvestigation } from './nt-slam'

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

describe('gerber2NTInvestigation – Gerber 4♣ över 2NT (FAS 8)', () => {
  it('ett ess saknas → 6NT', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:AK32 C:K87') // 20 hp, ♠A+♦A (2 ess)
    const responder = parseHand('S:K32 H:AQ7 D:Q76 C:QJ32') // 14 hp, ♥A → totalt 3 ess
    const turns = gerber2NTInvestigation(opener, responder)!
    expect(turns.map((t) => t.call)).toEqual(['4C', '4S', '6NT'])
    expect(turns[0].rule).toBe('Gerber')
  })

  it('två ess saknas → stannar i 4NT', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:KQ32 C:KQ7') // 20 hp, 1 ess (♠A)
    const responder = parseHand('S:K32 H:AQ7 D:Q76 C:QJ32') // 14 hp, 1 ess (♥A) → 2 ess saknas
    const turns = gerber2NTInvestigation(opener, responder)!
    expect(turns.map((t) => t.call)).toEqual(['4C', '4H', '4NT'])
    expect(turns[2].rule).toBe('Gerber: stannar')
  })

  it('alla ess + storslamszon → kungfråga 5♣ → 7NT', () => {
    const opener = parseHand('S:AQ5 H:AK4 D:A532 C:K83') // 20 hp, ♠A+♥A+♦A, ♥K+♣K
    const responder = parseHand('S:K32 H:QJ7 D:KQ7 C:AQ64') // 17 hp, ♣A, ♠K+♦K → 37 ihop, 4 kungar
    const turns = gerber2NTInvestigation(opener, responder)!
    expect(turns.map((t) => t.call)).toEqual(['4C', '4NT', '5C', '5S', '7NT'])
  })

  it('för svag (11–12) → null (stannar som kvantitativ 4NT i respondTo2NT)', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:AK32 C:K87')
    const responder = parseHand('S:K32 H:KJ4 D:Q76 C:QJ32') // 12 hp
    expect(gerber2NTInvestigation(opener, responder)).toBeNull()
  })

  it('4-korts högfärg → null (Stayman/transfer-vägen)', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:AK32 C:K87')
    const responder = parseHand('S:KQ32 H:AQ4 D:AQ7 C:K3') // 4 spader
    expect(gerber2NTInvestigation(opener, responder)).toBeNull()
  })

  it('5-4 i minorerna → null (minorfråga/MSS-vägen)', () => {
    const opener = parseHand('S:AQ5 H:KJ4 D:AK32 C:K87')
    const responder = parseHand('S:A3 H:K4 D:AQ76 C:KQ432') // 5-4 minorer
    expect(gerber2NTInvestigation(opener, responder)).toBeNull()
  })
})

describe('buildAuction – Gerber växer fram över 2NT (FAS 8)', () => {
  it('2NT–4C–4S–6NT i en hel auktion (ett ess saknas)', () => {
    const deal: Deal = {
      id: 'slam-gerber-2nt',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AQ5 H:KJ4 D:AK32 C:K87'), // 20 hp balanserad → 2NT
        E: parseHand('S:JT98 H:T98 D:JT9 C:AT9'), // svag → inget inkliv
        S: parseHand('S:K32 H:AQ7 D:Q76 C:QJ32'), // 14 hp balanserad, ingen högfärg → Gerber
        W: parseHand('S:764 H:6532 D:854 C:654'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['2NT', '4C', '4S', '6NT'])
    expect(a.open).toBe(false)
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
