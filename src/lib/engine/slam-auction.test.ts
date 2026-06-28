import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { slamInvestigation } from './slam-auction'

describe('slamInvestigation – RKC efter högfärgsfit', () => {
  it('lillslam: par i slamzon, 4 nyckelkort → 4NT, svar, 6 i trumf', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:KJ7 C:82') // 3 nyckelkort
    const responder = parseHand('S:J762 H:KQ5 D:AQ64 C:K3') // 1 nyckelkort
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '6S'])
    expect(turns[0].role).toBe('svarare') // kaptenen frågar
    expect(turns[1].role).toBe('öppnare') // öppnaren svarar
  })

  it('storslam: alla 5 nyckelkort + trumfdam i storslamszon → 7 i trumf', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2') // alla 5 nyckelkort
    const responder = parseHand('S:J7642 H:KQ5 D:KQ C:KQ4')
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5S', '7S'])
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
    expect(a.turns.map((t) => t.call)).toEqual(['1S', '2NT', '3S', '4NT', '5D', '6S'])
    expect(a.open).toBe(false)
  })
})
