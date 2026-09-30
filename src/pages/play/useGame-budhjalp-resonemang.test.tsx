// @vitest-environment jsdom
// BUDHJÄLPEN TÄNKER (ägarbeslut 2026-09-30, felrapport #93): när tabellen saknar
// regel för människans (Syds) läge och läget är värt att tänka på, frågar
// budhjälpen resonemangslagret i workern; svaret blir rekommendationen (regel
// 'resonemang' → gul fyrkant i budlådan) och används som budets etikett om
// spelaren följer det. Budstöd av → ingen worker-fråga.

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import { dealFromSeed } from '../../lib/engine/revisor'
import { saveBidHelp } from '../../lib/backend'
import { useGame, type Game } from './useGame'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
// Ett läge tabellen saknar regel för (resonemangsplanens provläge, frö 20291093):
// Syd som XX-hand efter (P)–P–(P)–1♥–(X)–XX–(1♠)–P–(P), Syd i tur.
const deal: Deal = dealFromSeed(20291093)
const game = (history: ResolvedCall[]): Game => ({ deal, history, phase: 'bidding', contract: null, seed: null, round: 0 })

describe('useGame — budhjälpen tänker när tabellen saknar regel', () => {
  let workers: { posted: unknown[]; onmessage: ((e: { data: unknown }) => void) | null }[] = []
  beforeEach(() => {
    workers = []
    localStorage.clear()
    vi.stubGlobal(
      'Worker',
      class {
        posted: unknown[] = []
        onmessage: ((e: { data: unknown }) => void) | null = null
        constructor() { workers.push(this) }
        postMessage(m: unknown) { this.posted.push(m) }
        terminate() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Syds tur utan tabellregel → workern frågas för S, "tänker", och svaret blir rekommendationen', async () => {
    const hist = H('E', 'P P P 1H X XX 1S P P')
    const { result } = renderHook(() => useGame(false, game(hist)))
    await act(async () => {})
    const w = workers[0]
    const req = w.posted.find((m) => (m as { seat: Seat }).seat === 'S') as { reqId: number; seat: Seat } | undefined
    expect(req).toBeDefined()
    expect(result.current.tanker).toBe('S')
    expect(result.current.rekommendation).toBeNull()
    await act(async () => {
      w.onmessage?.({ data: { reqId: req!.reqId, call: { seat: 'S', bid: '2H', rule: 'resonemang', explanation: 'Av 16 händer …' } } })
    })
    expect(result.current.tanker).toBeNull()
    expect(result.current.rekommendation).toMatchObject({ bid: '2H', rule: 'resonemang' })
    // Följer spelaren budet får det resonemangets etikett (inte "eget bud").
    act(() => result.current.onBid('2H'))
    expect(result.current.game.history[result.current.game.history.length - 1]).toMatchObject({ seat: 'S', bid: '2H', rule: 'resonemang' })
  })

  it('läge med tabellregel → tabellens bud direkt, ingen worker-fråga för S', async () => {
    const { result } = renderHook(() => useGame(false, game(H('E', 'P'))))
    await act(async () => {})
    expect(result.current.rekommendation).toMatchObject({ seat: 'S' })
    expect(result.current.rekommendation?.rule).not.toBe('resonemang')
    expect(workers[0]?.posted.length ?? 0).toBe(0)
  })

  it('budstöd av → ingen rekommendation och ingen worker-fråga', async () => {
    saveBidHelp(false)
    const hist = H('E', 'P P P 1H X XX 1S P P')
    const { result } = renderHook(() => useGame(false, game(hist)))
    await act(async () => {})
    expect(result.current.bidHelp).toBe(false)
    expect(result.current.rekommendation).toBeNull()
    expect(workers[0]?.posted.length ?? 0).toBe(0)
  })
})
