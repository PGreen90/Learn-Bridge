// @vitest-environment jsdom
// Hooken bakom rondgenomgångens DD-dom (etapp 3). I jsdom finns ingen Worker —
// så det som testas här är just RESERVVÄGEN (inline-beräkningen), precis som
// för Monte-Carlo-workern. Seedad giv + deterministisk utspelning.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { Deal } from '../../types/bridge'
import { contractFromCalls } from '../../lib/engine/auction-contract'
import { isComplete, legalCards, playCard, startPlay } from '../../lib/engine/play'
import type { Contract, Trick } from '../../lib/engine/play'
import { botAuction, dealFromSeed } from '../../lib/engine/revisor'
import { useDdAnalys } from './useDdAnalys'

afterEach(cleanup)

function seedadUtspeladGiv(): { deal: Deal; contract: Contract; tricks: Trick[] } {
  for (let seed = 1; seed <= 20; seed++) {
    const deal = dealFromSeed(seed)
    const calls = botAuction(deal)
    const contract = calls && contractFromCalls(calls)
    if (!contract) continue
    let st = startPlay(deal, contract)
    while (!isComplete(st)) st = playCard(st, legalCards(st, st.toAct)[0])
    return { deal, contract, tricks: st.completedTricks }
  }
  throw new Error('ingen seedad giv med kontrakt bland fröna 1–20')
}

describe('useDdAnalys — inline-reserven (ingen Worker i jsdom)', () => {
  it('enabled=false → ingenting startar', () => {
    const { deal, contract, tricks } = seedadUtspeladGiv()
    const { result } = renderHook(() => useDdAnalys(deal, contract, tricks, false, 50_000))
    expect(result.current.running).toBe(false)
    expect(result.current.analys).toBeNull()
  })

  it('enabled=true → analysen levereras och running släcks', async () => {
    const { deal, contract, tricks } = seedadUtspeladGiv()
    const { result } = renderHook(() => useDdAnalys(deal, contract, tricks, true, 50_000))
    await waitFor(() => expect(result.current.analys).not.toBeNull())
    expect(result.current.running).toBe(false)
    expect(result.current.analys!.boundaries).toHaveLength(14)
    // Sista gränsen är alltid beräknad (0 kort kvar) — även med snål budget.
    expect(result.current.analys!.boundaries[13]).not.toBeNull()
  })

  it('trasig indata (stick som inte går att spela ur given) → ingen dom, ingen krasch', async () => {
    const { deal, contract } = seedadUtspeladGiv()
    const trasigt: Trick[] = [
      {
        leader: 'W',
        cards: [
          { seat: 'W', card: { suit: 'hearts', rank: '5' } },
          { seat: 'N', card: { suit: 'hearts', rank: '5' } },
          { seat: 'E', card: { suit: 'hearts', rank: '5' } },
          { seat: 'S', card: { suit: 'hearts', rank: '5' } },
        ],
        winner: 'W',
      },
    ]
    const { result } = renderHook(() => useDdAnalys(deal, contract, trasigt, true, 50_000))
    await waitFor(() => expect(result.current.running).toBe(false))
    expect(result.current.analys).toBeNull()
  })
})
