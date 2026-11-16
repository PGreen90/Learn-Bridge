// @vitest-environment jsdom
// Bottarnas pauser (tempot steg 2–3, 2026-11-16): boten som leder nästa stick
// har redan "tänkt" under stickväntan — kortet kommer strax efter svepet, inte
// efter en hel botpaus till. Och ett tvingat kort (bara ett lagligt) läggs
// snabbare än ett val. Seedad giv, alla tider från tempo.ts (sifferregeln).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, type Contract } from '../../lib/engine/play'
import { usePlayTable } from './usePlayTable'
import { BASE, botPausMs, ms, sweepHoldMs } from './tempo'

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

describe('botPausMs — vilken paus boten tar', () => {
  it('ett vanligt val mitt i sticket: hela botpausen', () => {
    expect(botPausMs({ nyttStick: false, tvingat: false }, 'normal')).toBe(ms('botDelay', 'normal'))
  })

  it('tvingat kort: kortare paus', () => {
    expect(botPausMs({ nyttStick: false, tvingat: true }, 'normal')).toBe(ms('botTvingat', 'normal'))
    expect(BASE.botTvingat).toBeLessThan(BASE.botDelay)
  })

  it('leder nästa stick efter stickväntan: kortast paus (även om kortet är tvingat)', () => {
    expect(botPausMs({ nyttStick: true, tvingat: false }, 'normal')).toBe(ms('botLed', 'normal'))
    expect(botPausMs({ nyttStick: true, tvingat: true }, 'normal')).toBe(ms('botLed', 'normal'))
    expect(BASE.botLed).toBeLessThan(BASE.botTvingat)
  })

  it('följer tempovalet', () => {
    expect(botPausMs({ nyttStick: true, tvingat: false }, 'snabb')).toBe(ms('botLed', 'snabb'))
    expect(botPausMs({ nyttStick: false, tvingat: true }, 'lugn')).toBe(ms('botTvingat', 'lugn'))
  })
})

describe('usePlayTable — boten leder direkt efter svepet', () => {
  it('öppningsutspelet tar hela botpausen, utspelet till stick två bara botLed', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))

    // Öppningsutspelet (inget svep före): hela botpausen.
    await advance(ms('botDelay', 'normal') - 1)
    expect(result.current.play.currentTrick.length).toBe(0)
    await advance(1)
    expect(result.current.play.currentTrick.length).toBe(1)

    // Spela klart sticket: bottarna får generöst med tid, Syd lägger sitt kort.
    for (let i = 0; i < 6 && result.current.play.completedTricks.length === 0; i++) {
      if (result.current.play.toAct === 'S') {
        const mine = legalCards(result.current.play, 'S')[0]
        act(() => result.current.onCardClick(mine))
        act(() => result.current.onCardClick(mine))
      } else {
        await advance(ms('botDelay', 'normal'))
      }
    }
    expect(result.current.play.completedTricks.length).toBe(1)
    // Förutsättningen för testet: en BOT vann sticket (seedad giv → alltid samma).
    expect(result.current.play.completedTricks[0].winner).not.toBe('S')
    expect(result.current.sweep?.phase).toBe('hold')

    // Stickväntan + svepet: inget kort.
    await advance(sweepHoldMs('normal'))
    await advance(ms('sweepSlide', 'normal'))
    expect(result.current.sweep).toBeNull()
    expect(result.current.play.currentTrick.length).toBe(0)

    // Utspelet kommer efter botLed — inte efter en hel botpaus till.
    await advance(ms('botLed', 'normal') - 1)
    expect(result.current.play.currentTrick.length).toBe(0)
    await advance(1)
    expect(result.current.play.currentTrick.length).toBe(1)
  })
})
