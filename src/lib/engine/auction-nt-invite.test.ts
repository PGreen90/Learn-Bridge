import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

// FACIT (felrapport #37): öppnarens svar på svararens INBJUDAN i en 1NT-auktion
// saknades i den kanoniska linjen → föll igenom till det generella off-book-
// svaret som bjöd 3NT med förklaringen "inget stöd för partnern" — trots att
// Stayman just HITTAT hjärterfiten och öppnaren satt med 17 hp och FEM hjärter.
// Rätt: maximum (16–17, eller 15 med 5-korts trumf) accepterar inbjudan → 4♥.

function dealOf(dealer: Seat, vulnerability: Deal['vulnerability'], hands: Record<Seat, string>): Deal {
  return { id: 't', dealer, vulnerability, board: 15,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}
const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('FACIT: öppnaren svarar sang-inbjudan (felrapport #37)', () => {
  it('1NT–2♣–2♥–3♥: Väst (17 hp, 5 hjärter) accepterar → 4♥, inte 3NT', () => {
    const deal = dealOf('S', 'ns', {
      N: 'S:Q95 H:7 D:874 C:QJ8754',
      E: 'S:74 H:KJ53 D:9632 C:AT2',
      S: 'S:T8632 H:Q64 D:KQT5 C:K',
      W: 'S:AKJ H:AT982 D:AJ C:963',
    })
    const history: ResolvedCall[] = [
      call('S', 'P'), call('W', '1NT'), call('N', 'P'), call('E', '2C'),
      call('S', 'P'), call('W', '2H'), call('N', 'P'), call('E', '3H'),
      call('S', 'P'),
    ]
    const w = decideCall(deal, history, 'W')
    expect(w.bid).toBe('4H')
    // Förklaringen ska handla om att inbjudan accepteras med fit — inte "inget stöd".
    expect(w.explanation ?? '').not.toContain('inget stöd')
  })

  it('1NT–2♣–2♥–3♥: minimum (15 hp, 4-korts trumf) avböjer → pass', () => {
    // Samma auktion men öppnaren har blott minimum utan femte trumf → pass.
    const deal = dealOf('S', 'ns', {
      N: 'S:Q95 H:7 D:874 C:QJ8754',
      E: 'S:74 H:KJ53 D:9632 C:AT2',
      S: 'S:T8632 H:Q64 D:KQT5 C:K',
      W: 'S:KQJ H:A982 D:KQ2 C:963', // 15 hp, 3-4-3-3
    })
    const history: ResolvedCall[] = [
      call('S', 'P'), call('W', '1NT'), call('N', 'P'), call('E', '2C'),
      call('S', 'P'), call('W', '2H'), call('N', 'P'), call('E', '3H'),
      call('S', 'P'),
    ]
    const w = decideCall(deal, history, 'W')
    expect(w.bid).toBe('P')
  })
})
