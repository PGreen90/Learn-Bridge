// @vitest-environment jsdom
// Sticksvepet (etapp 2, "känsla i kortspelet" 2026-07-28): när ett stick blir
// klart går UI-fasen hold (vinnarglow) → slide (svepet) → borta, botarna och
// nästa kort VÄNTAR under svepet, och ett klick hoppar över det. Seedad giv
// (dealFromSeed) och alla tider från tempo.ts (sifferregeln).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, type Contract } from '../../lib/engine/play'
import { usePlayTable } from './usePlayTable'
import { ms } from './tempo'

// Väst spelar 1♣ → Nord (bot) leder, Öst (bot) följer, Syd (vi) är tredje hand,
// Väst (bot) fjärde. Seedad giv → samma händer och samma stickvinnare varje gång.
const DEAL = { ...dealFromSeed(1), dealer: 'W' as const }
const CONTRACT: Contract = { declarer: 'W', strain: 'clubs', level: 1 }

beforeEach(() => {
  vi.useFakeTimers()
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

/** Spelar klart första sticket: Nord + Öst på bottimern, Syd via två-klick,
 *  Väst på bottimern (fjärde kortet → sticket bokförs och svepet startar). */
async function playFirstTrick(result: Table) {
  await advance(ms('botDelay', 'normal')) // Nord leder
  await advance(ms('botDelay', 'normal')) // Öst följer
  const mine = legalCards(result.current.play, 'S')[0]
  act(() => result.current.onCardClick(mine)) // klick 1: välj färgen
  act(() => result.current.onCardClick(mine)) // klick 2: spela kortet
  await advance(ms('botDelay', 'normal')) // Väst lägger fjärde kortet
}

describe('sticksvepet — fasmaskinen', () => {
  it('stick klart → hold → slide → borta, och botarna väntar under svepet', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    await playFirstTrick(result)

    // Sticket är bokfört och svepet står i pausfasen med vinnarglow.
    expect(result.current.play.completedTricks.length).toBe(1)
    expect(result.current.play.currentTrick.length).toBe(0)
    expect(result.current.sweep?.phase).toBe('hold')

    // Pausen håller hela sin tid (botDelay < sweepHold — inget kort får smyga in).
    await advance(ms('sweepHold', 'normal') - 1)
    expect(result.current.sweep?.phase).toBe('hold')
    expect(result.current.play.currentTrick.length).toBe(0)

    // …sedan svepet…
    await advance(1)
    expect(result.current.sweep?.phase).toBe('slide')
    expect(result.current.play.currentTrick.length).toBe(0)

    // …och borta. Under hela svepet (hold + slide > botDelay) spelades inget kort.
    await advance(ms('sweepSlide', 'normal'))
    expect(result.current.sweep).toBeNull()
    expect(result.current.play.currentTrick.length).toBe(0)

    // Efter svepet återupptas spelet: vinnaren leder (bot efter botDelay,
    // eller vi själva — då står bordet still tills vi klickar).
    const winner = result.current.play.completedTricks[0].winner
    await advance(ms('botDelay', 'normal'))
    if (winner === 'S') {
      expect(result.current.play.toAct).toBe('S')
      expect(result.current.play.currentTrick.length).toBe(0)
    } else {
      expect(result.current.play.currentTrick.length).toBe(1)
    }
  })

  it('ett klick hoppar över svepet direkt (skipSweep)', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.sweep?.phase).toBe('hold')

    act(() => result.current.skipSweep())
    expect(result.current.sweep).toBeNull()

    // Spelet rullar vidare som vanligt efter hoppet.
    const winner = result.current.play.completedTricks[0].winner
    await advance(ms('botDelay', 'normal'))
    if (winner === 'S') {
      expect(result.current.play.toAct).toBe('S')
    } else {
      expect(result.current.play.currentTrick.length).toBe(1)
    }
  })
})
