// FACIT-TEST för F3 (C12 i docs/budsystem-revision.md): ADVANCER-RABATTEN i det
// GENERELLA balanseringsfallet — partnern balanserar över deras 1-LÄGESÖPPNING
// (1♥–P–P–inkliv/X) och har då redan "lånat en kung" (§7.6: golven sänkta ~3 hp).
// Advancern som svarar måste räkna av den lånade kungen, annars värderas samma
// styrka två gånger och delkontraktsvärden blåses till utgång — precis det som
// fix 5a lagade för svaga tvåor (auction-balansering-svag2.test.ts); här stängs
// det generella fallet (senare.md 2026-07-05: "det generella fallet återstår").
//
// Rabatten: −3 i värderingen + tak på 3-läget utan äkta utgångsvärden efter
// rabatten. Gäller BÅDE höjningen av partnerns balansinkliv (raiseWithFit) och
// svaret på partnerns balanserings-X (answerTakeoutDouble). Direkt sits är
// orörd (regressionsvakterna sist).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('F3: höjning av partnerns balansinkliv (1♥–P–P–1♠–P–advancern)', () => {
  // E öppnar 1♥, S/W passar, N BALANSERAR 1♠ (utpassningsläget), E passar → S.
  const BAL = [call('E', '1H'), call('S', 'P'), call('W', 'P'), call('N', '1S'), call('E', 'P')]

  it('11 stödpoäng → ENKEL höjning 2♠ (rabatt −3; utan rabatten: invit-hopp 3♠)', () => {
    const deal = dealOf('E', {
      E: 'S:85 H:AKJ92 D:K82 C:K76',   // öppnade 1♥
      S: 'S:KQ72 H:864 D:A953 C:Q4',   // 11 sp med spaderfit — passade 1♥ först
      W: 'S:43 H:QT7 D:JT7 C:JT953',   // 4 hp, passade
      N: 'S:AJT96 H:53 D:Q64 C:A82',   // balanserade 1♠ ("lånad kung")
    })
    expect(decideCall(deal, BAL, 'S').bid).toBe('2S')
  })

  it('14 stödpoäng → INVIT 3♠, inte utgång (rabatt −3 + tak på 3-läget)', () => {
    const deal = dealOf('E', {
      E: 'S:85 H:AKJ92 D:K82 C:K73',   // öppnade 1♥
      S: 'S:KQ72 H:8 D:AQ53 C:9642',   // 14 sp (11 hp + hjärtersingel) — under X-golvet 12 → passade
      W: 'S:43 H:QT764 D:JT7 C:JT5',   // 4 hp, passade
      N: 'S:AJT96 H:53 D:964 C:AQ8',   // balanserade 1♠
    })
    expect(decideCall(deal, BAL, 'S').bid).toBe('3S')
  })
})

describe('F3: svar på partnerns balanserings-X (1♥–P–P–X–P–advancern)', () => {
  const BALX = [call('E', '1H'), call('S', 'P'), call('W', 'P'), call('N', 'X'), call('E', 'P')]

  it('10 hp → BILLIGASTE färgbud 1♠ (rabatt −3; utan rabatten: hoppbud 2♠)', () => {
    const deal = dealOf('E', {
      E: 'S:84 H:AKQ92 D:J97 C:K63',   // öppnade 1♥
      S: 'S:QJ72 H:864 D:AK53 C:94',   // 10 hp — passade 1♥ (inget inkliv, X kräver 12)
      W: 'S:K93 H:JT73 D:T4 C:JT85',   // 5 hp, passade
      N: 'S:AT65 H:5 D:Q862 C:AQ72',   // balanserings-X (12 hp, form)
    })
    expect(decideCall(deal, BALX, 'S').bid).toBe('1S')
  })

  it('13 hp → HOPPBUD 2♠, inte cue (rabatt −3: 13 räknas som 10)', () => {
    const deal = dealOf('E', {
      E: 'S:84 H:AKQ92 D:J97 C:K63',   // öppnade 1♥
      S: 'S:KQJ2 H:864 D:AK53 C:94',   // 13 hp men 3 hjärter → kunde inte X:a direkt (trap pass)
      W: 'S:973 H:JT73 D:T4 C:JT85',   // 3 hp, passade
      N: 'S:AT65 H:5 D:Q862 C:AQ72',   // balanserings-X
    })
    expect(decideCall(deal, BALX, 'S').bid).toBe('2S')
  })
})

describe('F3 regressionsvakt: DIREKT sits är orörd', () => {
  it('svar på partnerns direkta X: 10 hp → hoppbud 2♠ som förut (ingen rabatt)', () => {
    // E öppnar 1♥, S dubblar DIREKT (12 hp, singel hjärter), W passar → N svarar.
    const DIRX = [call('E', '1H'), call('S', 'X'), call('W', 'P')]
    const deal = dealOf('E', {
      E: 'S:84 H:AKQ92 D:J87 C:K63',   // öppnade 1♥
      S: 'S:KT65 H:5 D:AQ62 C:QJ72',   // direkt upplysnings-X (12 hp, form)
      W: 'S:A93 H:JT73 D:T4 C:T985',   // 5 hp, passade
      N: 'S:QJ72 H:864 D:K953 C:A4',   // 10 hp → hoppbud (inbjudan) precis som förr
    })
    expect(decideCall(deal, DIRX, 'N').bid).toBe('2S')
  })
})
