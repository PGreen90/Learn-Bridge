// @vitest-environment jsdom
// Regressionsfacit (2026-08-12): "Spela om samma giv" (startSameGame) för en
// FRÖFRI giv ska spela om den NUVARANDE given — inte en nygenererad dagsgiv.
// Buggen: tävlingsgiven i övningsläge saknar frö OCH dailyNr, så det gamla
// `newDailyGame(round+1, undefined)` gav dagens slumpgiv i stället för samma
// giv. Nu återskapas given ur `g.deal` (samma deal.id, ny omgång).

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { gameFromDeal, gameFromSeed, useGame } from './useGame'

describe('useGame.startSameGame — fröfri giv spelar om SAMMA giv', () => {
  it('behåller deal.id och bumpar round (ingen ny slumpgiv)', () => {
    // En fröfri giv (som en tävlingsgiv i övningsläge): seed = null.
    const start = gameFromDeal(gameFromSeed(4242).deal)
    const { result } = renderHook(() => useGame(false, start))

    const idFöre = result.current.game.deal.id
    expect(result.current.game.seed).toBeNull()
    expect(result.current.game.round).toBe(0)

    act(() => result.current.startSameGame())

    // Samma giv, ny omgång — inte en nygenererad dagsgiv.
    expect(result.current.game.deal.id).toBe(idFöre)
    expect(result.current.game.round).toBe(1)
    expect(result.current.game.phase).toBe('bidding')
  })
})
