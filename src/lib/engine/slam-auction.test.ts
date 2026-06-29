import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { slamInvestigation } from './slam-auction'

describe('slamInvestigation – RKC efter högfärgsfit', () => {
  it('lillslam: cue-rond före RKC, 4 nyckelkort → 6 i trumf', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:KJ7 C:82') // 3 nyckelkort, hjärteress
    const responder = parseHand('S:J762 H:KQ5 D:AQ64 C:K3') // 1 nyckelkort, ruteress
    const turns = slamInvestigation(opener, responder, 'spades')!
    // svararen cue:ar 4♦ (ruteress), öppnaren cue:ar 4♥ (hjärteress), sedan 4NT RKC
    expect(turns.map((t) => t.call)).toEqual(['4D', '4H', '4NT', '5D', '6S'])
    expect(turns[0].rule).toBe('cue-bid')
    expect(turns[1].rule).toBe('cue-bid')
    expect(turns[2].rule).toBe('1430 RKC')
  })

  it('ingen kontroll att visa → ingen cue-rond, rakt på 4NT', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2') // 5 nyckelkort
    const responder = parseHand('S:J7642 H:KQ5 D:KQ C:KQ4') // inget ess/renons → ingen cue
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns[0].call).toBe('4NT')
  })

  it('storslamszon, alla 5 nyckelkort + trumfdam → 5NT kungfråga; ingen sidokung → stannar i 6', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2') // 5 nyckelkort, inga sidokungar
    const responder = parseHand('S:J7642 H:KQ5 D:KQ C:KQ4')
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5S', '5NT', '6S'])
    expect(turns[2].rule).toBe('Sjöberg 5NT') // kaptenen frågar kungar
  })

  it('storslamszon, kungfråga visar en sidokung → kaptenen lyfter till storslam (7)', () => {
    const opener = parseHand('S:AKQ85 H:AK3 D:A52 C:A2') // 5 nyckelkort + hjärterkung
    const responder = parseHand('S:J7642 H:Q5 D:KQ C:KQ43')
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5S', '5NT', '6H', '7S'])
    expect(turns[4].rule).toBe('slamavslut')
  })

  it('under slamzon → null (ingen slamutredning, vanlig auktion fortsätter)', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2')
    const responder = parseHand('S:J7642 H:Q86 D:Q3 C:Q42') // svag
    expect(slamInvestigation(opener, responder, 'spades')).toBeNull()
  })
})

describe('buildAuction – slam växer fram via Jacoby 2NT', () => {
  it('1S–2NT–3S–4NT–5D–6S i en hel auktion', () => {
    const deal: Deal = {
      id: 'slam-jacoby',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AKQ85 H:A432 D:K2 C:32'), // obalanserad 5-4-2-2 → 1S
        E: parseHand('S:T943 H:876 D:T43 C:765'), // svag → inget inkliv
        S: parseHand('S:J762 H:KQ5 D:AQ6 C:K84'),
        W: parseHand('S:- H:JT9 D:J9875 C:AQJT9'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1S', '2NT', '3S', '4D', '4H', '4NT', '5D', '6S'])
    expect(a.open).toBe(false)
  })
})
