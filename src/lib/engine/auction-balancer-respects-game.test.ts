import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

// FACIT (felrapport #35): en redan begränsad hand höjer inte partnerns
// beslutsbud. Öst (8 hp) balanserings-dubblade och bjöd sedan minsta 1♠ —
// hela handen är visad. När Väst därefter hoppar till 4♠ är det VÄSTS beslut
// (kaptenen); Öst har inget extra och ska passa, inte "höja vidare" till 5♠.
// I rapporten bjöd Öst 5♠ → 3 bet i stället för 1.

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return { id: 't', dealer, vulnerability: 'ns', board: 5,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}
const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('FACIT: balanseraren passar partnerns utgångsbeslut (felrapport #35)', () => {
  it('Öst passar 4♠ i stället för att bjuda 5♠', () => {
    const deal = dealOf('N', {
      N: 'S:Q5 H:T764 D:64 C:J8763',
      E: 'S:J976 H:K983 D:52 C:A54',
      S: 'S:T83 H:AQJ2 D:AKJ87 C:T',
      W: 'S:AK42 H:5 D:QT93 C:KQ92',
    })
    // Ägaren (Syd) öppnade 1♦ och bjöd om ♥/♦; Öst balanserade med X,
    // Väst dubblade responsivt, Öst bjöd minsta 1♠, Väst hoppade till 4♠.
    const history: ResolvedCall[] = [
      call('N', 'P'), call('E', 'P'), call('S', '1D'), call('W', 'P'),
      call('N', 'P'), call('E', 'X'), call('S', '1H'), call('W', 'X'),
      call('N', 'P'), call('E', '1S'), call('S', '2D'), call('W', '4S'),
      call('N', 'P'),
    ]
    const e = decideCall(deal, history, 'E')
    expect(e.bid).toBe('P')
  })
})
