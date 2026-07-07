import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

// FACIT (felrapport #33): en inbjudande/enkel höjning med fit får ALDRIG gå förbi
// utgång. N (advancer, 11 hp) hoppade till 7♦ över partnerns 5♦ eftersom
// "inbjudande hopp" = partnerns nivå + 2 (5+2 = 7). Nu kapas höjningen vid
// utgångsnivån (lågfärg = 5) och N passar när partnern redan nått utgång.

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return { id: 't', dealer, vulnerability: 'ns', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}
const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('FACIT: advancern hoppar inte förbi utgång (felrapport #33)', () => {
  it('N hoppar inte till 7♦ över partnerns 5♦', () => {
    const deal = dealOf('E', {
      N: 'S:J6 H:KJ8 D:KQ754 C:Q85',
      E: 'S:AKT732 H:52 D:T C:JT43',
      S: 'S:Q95 H:AT9 D:A986 C:AK6',
      W: 'S:84 H:Q7643 D:J32 C:972',
    })
    // Ägaren (Syd) dubblade och drev via 3♦/5♦; boten (Nord) svarar.
    const history: ResolvedCall[] = [
      call('E', '1S'), call('S', 'X'), call('W', 'P'), call('N', '2S'), call('E', 'P'),
      call('S', '3D'), call('W', 'P'), call('N', '3S'), call('E', 'P'),
      call('S', '5D'), call('W', 'P'),
    ]
    const n = decideCall(deal, history, 'N')
    expect(n.bid).not.toBe('7D')
    expect(n.bid).not.toBe('6D') // ingen slamzon (28 hp ihop) → inte heller lillslam
    expect(n.bid).toBe('P') // partnern har nått utgång, inga slamvärden → pass
  })

  it('advancern behåller den inbjudande höjningen på LÅG nivå (1♥-inkliv)', () => {
    // Regressionsskydd: fixen får inte döda den vanliga inbjudande hopphöjningen.
    const deal = dealOf('N', {
      N: 'S:A5 H:KQ76 D:K843 C:762', // 11 hp, 4-korts hjärterfit → inbjudande 3♥
      E: 'S:KQ98 H:2 D:AQJ96 C:AJ3',
      S: 'S:JT7642 H:AJ83 D:5 C:Q5',
      W: 'S:3 H:T954 D:T72 C:KT984',
    })
    // Öst öppnar 1♦, Syd kliver in 1♥, Väst passar → advancern (N) höjer.
    const history: ResolvedCall[] = [call('E', '1D'), call('S', '1H'), call('W', 'P')]
    const n = decideCall(deal, history, 'N')
    // Ska vara en riktig höjning (inte pass, inte förbi 4♥ utgång).
    expect(['2H', '3H', '4H']).toContain(n.bid)
  })
})
