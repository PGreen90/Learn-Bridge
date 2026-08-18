// Systems on över ett 1NT-INKLIV (ägarbeslut 2026-08-18, uppföljning av
// felrapport #53). Motorn körde sangsystemet (Stayman/transfer) bara över en
// 1NT-ÖPPNING; över ett 1NT-inkliv passade advancern och inklivaren fullföljde
// inte. Nu gäller samma respondTo1NT-maskineri även när partnern klev in 1NT.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

// W öppnar 1D, N kliver in 1NT (15–18 bal, D-stopp).
const NORTH_1NT = 'S:KQ5 H:AQ4 D:KJ6 C:Q982' // 16 hp bal, D-stopp

describe('systems on över 1NT-inkliv – advancern svarar', () => {
  it('advancern med 5-korts högfärg transfererar (2♦ = transfer till hjärter)', () => {
    const deal = dealOf('W', {
      N: NORTH_1NT,
      E: 'S:JT876 H:65 D:Q9 C:JT43',
      S: 'S:A2 H:KJ932 D:64 C:8765', // 5 hjärter → transfer
      W: 'S:94 H:T7 D:AT8752 C:AK',
    })
    const history = [call('W', '1D'), call('N', '1NT'), call('E', 'P')]
    expect(decideCall(deal, history, 'S').bid).toBe('2D')
  })

  it('advancern med 4-korts högfärg + inbjudan+ bjuder Stayman (2♣)', () => {
    const deal = dealOf('W', {
      N: NORTH_1NT,
      E: 'S:T876 H:65 D:Q97 C:JT43',
      S: 'S:KJ54 H:QT94 D:A5 C:632', // 10 hp, 4-4 högfärg → Stayman
      W: 'S:A92 H:K873 D:T8732 C:A',
    })
    const history = [call('W', '1D'), call('N', '1NT'), call('E', 'P')]
    expect(decideCall(deal, history, 'S').bid).toBe('2C')
  })
})

describe('systems on över 1NT-inkliv – inklivaren fullföljer', () => {
  const deal = dealOf('W', {
    N: NORTH_1NT,
    E: 'S:JT876 H:65 D:Q9 C:JT43',
    S: 'S:A2 H:KJ932 D:64 C:8765',
    W: 'S:94 H:T7 D:AT8752 C:AK',
  })

  it('fullföljer transfern: efter 2♦ (transfer) bjuder inklivaren 2♥', () => {
    const history = [
      call('W', '1D'), call('N', '1NT'), call('E', 'P'),
      call('S', '2D'), call('E', 'P'),
    ]
    expect(decideCall(deal, history, 'N').bid).toBe('2H')
  })

  it('svarar på Stayman: efter 2♣ bjuder inklivaren en högfärg eller 2♦', () => {
    const stayDeal = dealOf('W', {
      N: NORTH_1NT, // 4-korts hjärter (AQ4? nej 3) – har KQ5 spader (3). Svar 2♦ (ingen 4-hf)
      E: 'S:T876 H:65 D:Q97 C:JT43',
      S: 'S:KJ54 H:QT94 D:A5 C:632',
      W: 'S:A92 H:K873 D:T8732 C:A',
    })
    const history = [
      call('W', '1D'), call('N', '1NT'), call('E', 'P'),
      call('S', '2C'), call('E', 'P'),
    ]
    const c = decideCall(stayDeal, history, 'N')
    expect(['2D', '2H', '2S']).toContain(c.bid) // ett giltigt Stayman-svar
  })
})

describe('vakt: ovanlig 2NT triggar INTE sangsystemet', () => {
  it('advancern över partnerns ovanliga 2NT-inkliv kör inte respondTo1NT', () => {
    // W 1H, N 2NT (ovanlig, två lägsta = klöver+ruter), E P, S advancer.
    const deal = dealOf('W', {
      N: 'S:4 H:6 D:KQJ98 C:KQJ98', // 5-5 minorer → ovanlig 2NT
      E: 'S:AQJ97 H:AK3 D:65 C:762',
      S: 'S:K8632 H:QJ942 D:7 C:A3',
      W: 'S:T5 H:T875 D:AT432 C:T4',
    })
    const history = [call('W', '1H'), call('N', '2NT'), call('E', 'P')]
    const c = decideCall(deal, history, 'S')
    // Skulle systems-on felaktigt trigga vore 3♦/3♥ (transfer) möjligt; här ska
    // det INTE vara ett sangsystem-svar – advancern väljer en minor (preferens).
    expect(c.rule ?? '').not.toMatch(/transfer|Stayman/i)
  })
})
