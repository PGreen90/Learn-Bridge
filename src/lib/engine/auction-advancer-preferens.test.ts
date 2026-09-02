// Felrapport #56 (github.com/PGreen90/Learn-Bridge/issues/56), bricka 6:
// 1♥(E) – 1♠(S) – 3♥(W) – P(N) – P – 4♦(S) – P – P(N) – P. Syd (ägaren) klev in
// 1♠ och bjöd sedan en NY färg, 4♦: "jag visar spader och ruter, partnern ska
// välja". Nord hade ♠K9873 ♥JT6 ♦T86 ♣86 (fem spader, tre ruter) och passade
// 4♦ — fast preferensen 4♠ kostar inget (samma nivå) och spadern är den klart
// bättre fiten. Ägaren: "Partner måste bjuda spader här. Även med låga poäng."
//
// Regeln (§7.1): inklivarens andra färg är naturlig och ber om PREFERENS —
// advancern väljer den av partnerns två färger hen har bäst stöd i, oavsett
// poäng. Kostar preferensen ingen nivå räcker lika lång eller längre
// inklivsfärg; kostar den en nivå krävs en klar skillnad (2+ kort).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, vul: Deal['vulnerability'], hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: vul, board: 6,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

const DEAL_56 = dealOf('E', 'ew', {
  N: 'S:K9873 H:JT6 D:T86 C:86',
  E: 'S:T H:A9875 D:K32 C:A753',
  S: 'S:AJ542 H:2 D:AQ74 C:Q42',
  W: 'S:Q6 H:KQ43 D:J95 C:KJT9',
})
const HIST_56 = [call('E', '1H'), call('S', '1S'), call('W', '3H'), call('N', 'P'), call('E', 'P'), call('S', '4D'), call('W', 'P')]

describe('felrapport #56 – advancern ger preferens till inklivsfärgen', () => {
  it('1♥ – 1♠ – 3♥ – P – P – 4♦ – P: Nord bjuder 4♠ (fem spader mot tre ruter), inte pass', () => {
    const c = decideCall(DEAL_56, HIST_56, 'N')
    expect(c.bid).toBe('4S')
    expect(c.rule).toBe('preferens till inklivsfärgen')
  })

  it('bättre stöd i den ANDRA färgen → ingen preferens (lämnar 4♦)', () => {
    const deal = dealOf('E', 'ew', {
      N: 'S:98 H:JT6 D:KT86 C:8763',
      E: 'S:KT7 H:A9875 D:32 C:A95',
      S: 'S:AJ542 H:2 D:AQ74 C:Q42',
      W: 'S:Q63 H:KQ43 D:J95 C:KJT',
    })
    expect(decideCall(deal, HIST_56, 'N').bid).toBe('P')
  })

  it('kostar preferensen en nivå (1♦-inkliv, sedan 2♠) krävs klar skillnad: 3-1 → 3♦', () => {
    // W öppnar 1♣, N kliver in 1♦, E höjer 2♣, S passar, W passar, N bjuder 2♠ (ny färg).
    const deal = dealOf('W', 'none', {
      N: 'S:AQJ8 H:6 D:AKJ974 C:83',
      E: 'S:T97 H:K953 D:5 C:AJT96',
      S: 'S:6 H:QT8742 D:T86 C:752',
      W: 'S:K5432 H:AJ D:Q32 C:KQ4',
    })
    const hist = [call('W', '1C'), call('N', '1D'), call('E', '2C'), call('S', 'P'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('3D')
  })

  it('kostar preferensen en nivå och skillnaden är liten (3-2) → ingen preferens', () => {
    const deal = dealOf('W', 'none', {
      N: 'S:AQJ8 H:6 D:AKJ974 C:83',
      E: 'S:T9 H:K953 D:5 C:AJT964',
      S: 'S:76 H:QT8742 D:T86 C:75',
      W: 'S:K5432 H:AJ D:Q32 C:KQ2',
    })
    const hist = [call('W', '1C'), call('N', '1D'), call('E', '2C'), call('S', 'P'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('P')
  })
})
