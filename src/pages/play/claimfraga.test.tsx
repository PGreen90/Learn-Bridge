// @vitest-environment jsdom
// CLAIM-FRÅGAN (ägarbeslut 2026-09-19, "det bara blinkar till"): auto-claimen
// klipper inte längre in i samma bildruta som fjärde kortet landar. Ordningen är
// sticket får sitt svep → ett andetag (claimBeat) → FRÅGAN "[Väderstreck] gör
// anspråk på resten" (claimOffer; OK / Spela klart, ingen timer) → först efter
// OK läggs händerna upp, en i taget (revealStep). "Spela klart" → spelet går
// vidare och ingen ny fråga ställs i given. Bottarna står stilla från det att
// claimen är aktuell tills frågan är besvarad. Auto-claim-detektorn mockas
// (styrbar per test); seedade givar och alla tider från tempo.ts. FACIT FÖRE FIX.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, type Contract, type PlayState } from '../../lib/engine/play'
import { autoClaimAvailable } from '../../lib/engine/claim'
import { usePlayTable } from './usePlayTable'
import { ms, sweepHoldMs } from './tempo'

vi.mock('../../lib/engine/claim', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/engine/claim')>()
  return { ...mod, autoClaimAvailable: vi.fn(() => false) }
})

// Samma givar som stickvantan.test.tsx: Väst spelar 1♣, Nord (bot) leder.
// Frö 1: en bot vinner första sticket. Frö 2: Syd (vi) vinner det.
const CONTRACT: Contract = { declarer: 'W', strain: 'clubs', level: 1 }
const DEAL_BOT_VINNER = { ...dealFromSeed(1), dealer: 'W' as const }
const DEAL_VI_VINNER = { ...dealFromSeed(2), dealer: 'W' as const }

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(autoClaimAvailable).mockReset()
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

type Table = { current: ReturnType<typeof usePlayTable> }

async function playFirstTrick(result: Table) {
  await advance(ms('botDelay', 'normal')) // Nord leder
  await advance(ms('botDelay', 'normal')) // Öst följer
  const mine = legalCards(result.current.play, 'S')[0]
  act(() => result.current.onCardClick(mine))
  act(() => result.current.onCardClick(mine))
  await advance(ms('botDelay', 'normal')) // Väst lägger fjärde kortet
}

/** Claimen blir aktuell först när första sticket är spelat. */
const efterForstaSticket = (s: PlayState) => s.completedTricks.length >= 1

describe('claim-frågan — andetag, fråga, inga bottar under tiden', () => {
  it('claimen aktuell → INGET klipp: frågan kommer efter claimBeat, revealen först efter OK', async () => {
    vi.mocked(autoClaimAvailable).mockReturnValue(true)
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    expect(result.current.pendingClaim).toBeNull()
    expect(result.current.claimOffer).toBeNull()

    await advance(ms('claimBeat', 'normal') - 1)
    expect(result.current.claimOffer).toBeNull()
    await advance(1)
    expect(result.current.claimOffer).toEqual({ total: 13, seat: 'W' })
    expect(result.current.pendingClaim).toBeNull()

    // Ingen timer svarar åt spelaren, och bottarna rör inte korten.
    await advance(ms('botDelay', 'normal') * 20)
    expect(result.current.claimOffer).not.toBeNull()
    expect(result.current.play.currentTrick.length).toBe(0)

    act(() => result.current.acceptClaimOffer())
    expect(result.current.claimOffer).toBeNull()
    expect(result.current.pendingClaim).toEqual({ total: 13, auto: true })
  })

  it('"Spela klart" → spelet går vidare och ingen ny fråga ställs i given', async () => {
    vi.mocked(autoClaimAvailable).mockReturnValue(true)
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await advance(ms('claimBeat', 'normal'))
    expect(result.current.claimOffer).not.toBeNull()

    act(() => result.current.declineClaimOffer())
    expect(result.current.claimOffer).toBeNull()
    await advance(ms('botDelay', 'normal')) // Nord leder — spelet rullar igen
    expect(result.current.play.currentTrick.length).toBe(1)
    await advance(ms('claimBeat', 'normal') * 10)
    expect(result.current.claimOffer).toBeNull()
    expect(result.current.pendingClaim).toBeNull()
  })

  it('kortklick under frågan spelar inget kort', async () => {
    vi.mocked(autoClaimAvailable).mockImplementation(efterForstaSticket)
    const { result } = renderHook(() => usePlayTable(DEAL_VI_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    await advance(sweepHoldMs('normal'))
    await advance(ms('sweepSlide', 'normal'))
    await advance(ms('claimBeat', 'normal'))
    expect(result.current.claimOffer).not.toBeNull()
    const mine = legalCards(result.current.play, 'S')[0]
    act(() => result.current.onCardClick(mine))
    act(() => result.current.onCardClick(mine))
    expect(result.current.play.currentTrick.length).toBe(0)
    expect(result.current.claimOffer).not.toBeNull()
  })
})

describe('claim-frågan — sista sticket får sitt svep FÖRE frågan', () => {
  it('bot vinner sticket: hold → slide → andetag → fråga (aldrig under svepet)', async () => {
    vi.mocked(autoClaimAvailable).mockImplementation(efterForstaSticket)
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.sweep?.phase).toBe('hold')
    expect(result.current.pendingClaim).toBeNull()
    expect(result.current.claimOffer).toBeNull()

    await advance(sweepHoldMs('normal'))
    expect(result.current.sweep?.phase).toBe('slide')
    expect(result.current.claimOffer).toBeNull()
    await advance(ms('sweepSlide', 'normal'))
    expect(result.current.sweep).toBeNull()
    expect(result.current.claimOffer).toBeNull()

    await advance(ms('claimBeat', 'normal'))
    expect(result.current.claimOffer?.seat).toBe('W')
    expect(result.current.play.currentTrick.length).toBe(0)
  })

  it('VI vinner sticket men claimen är aktuell: ingen stickväntan — svepet går av sig självt', async () => {
    vi.mocked(autoClaimAvailable).mockImplementation(efterForstaSticket)
    const { result } = renderHook(() => usePlayTable(DEAL_VI_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.play.completedTricks[0].winner).toBe('S')
    expect(result.current.sweep?.phase).toBe('hold')
  })
})

describe('claim-revealen — händerna läggs upp en i taget', () => {
  it('efter OK: spelföraren först, sedan nästa dolda hand per revealStep', async () => {
    vi.mocked(autoClaimAvailable).mockReturnValue(true)
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await advance(ms('claimBeat', 'normal'))
    // Före utspelet är W (spelförare), N och E dolda; Syd ser bara sin hand.
    expect(result.current.isFaceUp('W')).toBe(false)

    act(() => result.current.acceptClaimOffer())
    expect(result.current.isFaceUp('W')).toBe(true)
    expect(result.current.isFaceUp('N')).toBe(false)
    expect(result.current.isFaceUp('E')).toBe(false)
    await advance(ms('revealStep', 'normal'))
    expect(result.current.isFaceUp('N')).toBe(true)
    expect(result.current.isFaceUp('E')).toBe(false)
    await advance(ms('revealStep', 'normal'))
    expect(result.current.isFaceUp('E')).toBe(true)
  })
})
