// FACIT-TEST för etapp 6 hål 3 (billig offring, docs/systemrevisorn.md
// "Etapp 6 FÖRSKANNAD", 2026-07-25): TAKET I FÖRSVARET MOT SVAGA TVÅOR.
//
// Rot: `defendWeakTwo` (defense-conventional.ts) hade cue (15+ 5-5),
// 2NT-fönstret (15–18 direkt / 12–15 balansering), takeout-X och naturligt
// inkliv (10–16) — men INGET utlopp uppåt. En balanserad 21-poängare i
// balanseringssitsen (frö 20260767) och en 17-poängare med sexkorts klöver
// (frö 20261571) passade ut deras svaga tvåa. Jämför `defendPreempt` som
// hela tiden haft "3NT till spel".
//
// Målkontrakten är DD-verifierade (dd-tabell-proben): 3NT ger 10 stick på
// alla tre givarna — 430/430/630, i praktiken par.

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

function finalOf(d: Deal) {
  const history = botAuction(d)
  expect(history).not.toBeNull()
  return { contract: contractFromCalls(history!), bids: history!.map((c) => c.bid) }
}

describe('taket i försvaret mot svaga tvåor (etapp 6 hål 3)', () => {
  it('frö 20260767: (2♦)–P–P → balanserad 21-poängare i balansering bjuder 3NT till spel', () => {
    const d = deal('offring-20260767', 'N', 'none', {
      N: 'S:Q H:KT9 D:976543 C:J53',
      E: 'S:972 H:AJ876 D:8 C:K964',
      S: 'S:JT843 H:52 D:T2 C:AT87',
      W: 'S:AK65 H:Q43 D:AKQJ C:Q2',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3NT')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })

  it('frö 20261571: (2♥) → 17 hp med stark 6-korts klöver och hjärterstopp bjuder 3NT direkt', () => {
    const d = deal('offring-20261571', 'E', 'ew', {
      N: 'S:62 H:K97 D:AK C:AQJT94',
      E: 'S:T97 H:AQJT65 D:T32 C:3',
      S: 'S:AKJ5 H:43 D:854 C:K752',
      W: 'S:Q843 H:82 D:QJ976 C:86',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3NT')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })

  it('frö 20261582: (2♥)–P–P → 17 hp balanserad i balansering (över 12–15-fönstret) bjuder 3NT', () => {
    const d = deal('offring-20261582', 'E', 'all', {
      N: 'S:94 H:AKT85 D:AQ7 C:A98',
      E: 'S:A65 H:QJ9764 D:8643 C:-',
      S: 'S:QJT H:- D:JT5 C:KJT7642',
      W: 'S:K8732 H:32 D:K92 C:Q53',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3NT')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })
})
