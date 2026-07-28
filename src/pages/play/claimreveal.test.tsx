// @vitest-environment jsdom
// Claim-revealen + resultatövergången (etapp 5, "känsla i kortspelet"
// 2026-07-28): en godkänd claim visar ALLA händer öppet (pendingClaim) och
// vyn LIGGER KVAR — ingen timer — tills spelaren går vidare med knappen
// (finishClaimReveal, ägarbeslut samma kväll: precis som i verkligheten).
// Först därefter avslutas given, och resultatvyn väntar ut bordets uttoning
// (resultOutro). Claim-DOMEN (DDS) testas i claim.test.ts — här mockas den
// som godkänd så fasmaskinen kan köras deterministiskt. Seedad giv och alla
// tider från tempo.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import type { Contract } from '../../lib/engine/play'
import { adjudicateClaim, autoClaimAvailable } from '../../lib/engine/claim'
import { usePlayTable } from './usePlayTable'
import { ms } from './tempo'

// Claim-domen och auto-claim-detektorn mockas (styrbara per test); resten av
// claim-modulen (stickräkningen) behålls äkta.
vi.mock('../../lib/engine/claim', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/engine/claim')>()
  return {
    ...mod,
    adjudicateClaim: vi.fn(() => ({ verdict: 'godkänd' })),
    autoClaimAvailable: vi.fn(() => false),
  }
})

// Väst spelar 1♣ → Nord (bot) skulle leda; Ö/V är dolda händer i vanliga fall.
const DEAL = { ...dealFromSeed(1), dealer: 'W' as const }
const CONTRACT: Contract = { declarer: 'W', strain: 'clubs', level: 1 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(adjudicateClaim).mockClear()
  vi.mocked(autoClaimAvailable).mockReturnValue(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.removeItem('learnbridge:playSpeed')
})

async function advance(msToRun: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(msToRun)
  })
}

describe('claim-revealen — korten ligger kvar tills spelaren går vidare', () => {
  it('godkänd claim → alla händer öppna, botarna väntar, INGEN timer avslutar', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))

    act(() => result.current.onClaim(9))
    // Revealen är igång: claimen är INTE committad, alla säten ligger öppna.
    expect(result.current.pendingClaim).toEqual({ total: 9, auto: false })
    expect(result.current.claimed).toBeNull()
    expect(result.current.done).toBe(false)
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      expect(result.current.isFaceUp(seat)).toBe(true)
    }

    // Långt förbi alla speltimers: revealen ligger KVAR, botarna har inte
    // lagt några kort och given är inte avslutad — vyn väntar på spelaren.
    await advance(ms('botDelay', 'normal') * 20)
    expect(result.current.pendingClaim).toEqual({ total: 9, auto: false })
    expect(result.current.claimed).toBeNull()
    expect(result.current.done).toBe(false)
    expect(result.current.play.currentTrick.length).toBe(0)
  })

  it('Gå vidare-knappen (finishClaimReveal) committar claimen och avslutar given', () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    act(() => result.current.onClaim(8))
    expect(result.current.pendingClaim).not.toBeNull()

    act(() => result.current.finishClaimReveal())
    expect(result.current.pendingClaim).toBeNull()
    expect(result.current.claimed).toEqual({ total: 8, auto: false })
    expect(result.current.done).toBe(true)
  })

  it('auto-claim går också via revealen (auto: true) och ligger också kvar', async () => {
    vi.mocked(autoClaimAvailable).mockReturnValue(true)
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))

    // Effekten slår till direkt (nytt stick ska börja) → reveal, inte klipp —
    // och den ligger kvar tills spelaren går vidare.
    expect(result.current.pendingClaim?.auto).toBe(true)
    expect(result.current.claimed).toBeNull()
    await advance(ms('botDelay', 'normal') * 20)
    expect(result.current.pendingClaim?.auto).toBe(true)

    act(() => result.current.finishClaimReveal())
    expect(result.current.claimed?.auto).toBe(true)
    expect(result.current.done).toBe(true)
  })
})

describe('resultatövergången — showResult', () => {
  it('done → bordet får tona ut i resultOutro innan resultatvyn tar över', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    act(() => result.current.onClaim(9))
    act(() => result.current.finishClaimReveal())
    expect(result.current.done).toBe(true)
    expect(result.current.showResult).toBe(false)

    await advance(ms('resultOutro', 'normal') - 1)
    expect(result.current.showResult).toBe(false)
    await advance(1)
    expect(result.current.showResult).toBe(true)
  })
})
