// FACIT-TEST för "5♣-ryckaren" (fel färg-spåret fix 1, docs/systemrevisorn.md
// mönsteranalysen, 2026-07-21): öppnaren DROG partnerns 3NT-avslut till 5♣
// efter Stayman. Rot: live-lagrets partnerLastSuit läste partnerns
// ARTIFICIELLA Stayman-2♣/3♣ som en naturlig klöverfärg, och raiseWithFits
// minorutgångsgren kunde inte bjuda 3NT (redan bjudet) → 5♣. Dessutom
// saknades respekten för partnerns AVSLUT: står partnerns utgångsbud obestritt
// ska boten inte hitta på en "höjning" till en ny strain.
//
// Givarna är Systemrevisorns frön 20260752, 20260896, 20260965 (baslinjen,
// frö 20260721) — alla tre slutade i 5♣ bet i stället för hemspelad 3NT.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'

function deal(
  id: string,
  dealer: Deal['dealer'],
  vulnerability: Deal['vulnerability'],
  hands: Record<'N' | 'E' | 'S' | 'W', string>,
): Deal {
  return {
    id,
    board: 1,
    dealer,
    vulnerability,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

/** Motorn bjuder alla fyra händerna; slutkontraktet ska bli 3NT (inte 5♣). */
function finalOf(d: Deal) {
  const history = botAuction(d)
  expect(history).not.toBeNull()
  return { contract: contractFromCalls(history!), bids: history!.map((c) => c.bid) }
}

describe('5♣-ryckaren: partnerns Stayman är ingen klöverfärg och 3NT-avslut respekteras', () => {
  it('frö 20260752: 1NT–2♣(Stayman)–2♥–3NT ska stå — öppnaren rycker inte 5♣', () => {
    const d = deal('felfarg-20260752', 'N', 'all', {
      N: 'S:97 H:74 D:KQJT7 C:J632',
      E: 'S:K852 H:QJ5 D:A962 C:T9',
      S: 'S:AJ43 H:K962 D:84 C:875',
      W: 'S:QT6 H:AT83 D:53 C:AKQ4',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).not.toContain('5C')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })

  it('frö 20260896: 1NT–2♣(Stayman)–2♦–3NT ska stå — öppnaren rycker inte 5♣', () => {
    const d = deal('felfarg-20260896', 'N', 'none', {
      N: 'S:T873 H:Q7 D:T632 C:AJ7',
      E: 'S:A6 H:864 D:AQJ9 C:K643',
      S: 'S:J952 H:K953 D:K84 C:T2',
      W: 'S:KQ4 H:AJT2 D:75 C:Q985',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).not.toContain('5C')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })

  it('frö 20260965: 2NT–3♣(Stayman)–3♦–3NT ska stå — öppnaren rycker inte 5♣', () => {
    const d = deal('felfarg-20260965', 'W', 'none', {
      N: 'S:J53 H:KJ8 D:Q92 C:9853',
      E: 'S:AKT H:A94 D:K87 C:AK74',
      S: 'S:Q72 H:76532 D:J4 C:QT2',
      W: 'S:9864 H:QT D:AT653 C:J6',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).not.toContain('5C')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })
})
