// @vitest-environment jsdom
// Regressionsfacit (2026-09-24, ägarens giv 4 i tävling #54 fick ✗ "Inskicket
// avvisades"): resonemangslagret får ALDRIG köra i tävlingen. Servern validerar
// varje botbud mot regeltabellen (decideCall) — en bot som "tänker" och bjuder
// annat får hela inskicket avvisat, och alla i fältet ska möta samma bottar.
// Med `resonera: false` startas ingen resonemangsworker → bottarna budar ur tabellen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { gameFromDeal, gameFromSeed, useGame } from './useGame'

describe('useGame — resonemangslagret av i tävlingen', () => {
  const skapade = vi.fn()
  beforeEach(() => {
    skapade.mockReset()
    vi.stubGlobal(
      'Worker',
      class {
        constructor() { skapade() }
        postMessage() {}
        terminate() {}
        onmessage: unknown = null
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  const start = () => gameFromDeal(gameFromSeed(4242).deal)

  it('Spela mot datorn (standard): resonemangsworkern startas', () => {
    renderHook(() => useGame(false, start()))
    expect(skapade).toHaveBeenCalledTimes(1)
  })

  it('tävlingsgiv (resonera: false): ingen worker — bottarna budar bara ur tabellen', () => {
    renderHook(() => useGame(false, start(), undefined, { resonera: false }))
    expect(skapade).not.toHaveBeenCalled()
  })
})
