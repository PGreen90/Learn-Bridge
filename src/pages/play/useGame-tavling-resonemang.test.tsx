// @vitest-environment jsdom
// `resonera`-valet i useGame (2026-09-24). Historik: tävling #54 giv 4 fick ✗ när
// den tidsstyrda bottens bud inte gick att räkna om på servern → lagret stängdes
// av i tävlingen. Sedan standardläget (bestämt antal händer, frö ur egen hand +
// auktion; servern godtar det tänkta budet, nattgranskningen räknar om det) är
// lagret på överallt; `resonera: false` finns kvar för att kunna stänga av det.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { gameFromDeal, gameFromSeed, useGame } from './useGame'

describe('useGame — resonera-valet', () => {
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
