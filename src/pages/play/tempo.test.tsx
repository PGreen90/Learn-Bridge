// @vitest-environment jsdom
// Tempot i kortspelet (etapp 1, "känsla i kortspelet" 2026-07-28): skalningen
// i tempo.ts, att hastighetsvalet sparas och överlever en omladdning, och att
// botens paus faktiskt följer valet. Seedad giv (dealFromSeed) — aldrig slump
// i volym-/UI-tester, och alla tider importeras från tempo.ts (sifferregeln).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import type { Contract } from '../../lib/engine/play'
import { usePlayTable } from './usePlayTable'
import { BASE, ms, SPEED_FACTOR } from './tempo'

// Väst spelar 1♣ → Nord (bot) gör utspelet: bottarnas timer är först ut och
// Syd (vi) rör ingenting. Given är seedad → samma händer varje körning.
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

describe('tempo.ts — skalningen', () => {
  it('ms() skalar bastiden med hastighetsfaktorn och rundar till hela ms', () => {
    expect(ms('botDelay', 'normal')).toBe(BASE.botDelay)
    expect(ms('botDelay', 'lugn')).toBe(Math.round(BASE.botDelay * SPEED_FACTOR.lugn))
    expect(ms('botDelay', 'snabb')).toBe(Math.round(BASE.botDelay * SPEED_FACTOR.snabb))
  })
})

describe('usePlayTable — hastighetsvalet', () => {
  it('sparas i lagringen och överlever en omladdning', () => {
    const first = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    expect(first.result.current.speed).toBe('normal')
    act(() => first.result.current.setSpeed('snabb'))
    expect(first.result.current.speed).toBe('snabb')
    expect(localStorage.getItem('learnbridge:playSpeed')).toBe('"snabb"')

    // "Omladdad sida": ny render läser valet ur lagringen.
    first.unmount()
    const second = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    expect(second.result.current.speed).toBe('snabb')
  })

  it('botens paus följer tempovalet (Normal → Snabb)', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))

    // Normal: utspelet kommer efter precis botDelay (inte tidigare).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms('botDelay', 'normal') - 1)
    })
    expect(result.current.play.currentTrick.length).toBe(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result.current.play.currentTrick.length).toBe(1)

    // Snabb: nästa botkort (Öst är träkarl åt Väst) kommer redan efter den
    // kortare pausen.
    act(() => result.current.setSpeed('snabb'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms('botDelay', 'snabb'))
    })
    expect(result.current.play.currentTrick.length).toBe(2)
  })
})
