// @vitest-environment jsdom
// STICKVÄNTAN (ägarbeslut 2026-09-14): "sticket försvann för snabbt från bordets
// mitt". Leder DU nästa stick ligger sticket kvar tills du trycker på det
// ('vanta'; den pekande handen tänds efter sweepHint). Leder boten ligger det
// kvar SWEEP_HOLD (2/3/4 s, ringen fylls) och sveps sedan ('hold'). Ett tryck (advanceSweep) går
// alltid vidare direkt — även under botens paus. Seedade givar (dealFromSeed)
// och alla tider från tempo.ts (sifferregeln). FACIT FÖRE FIX.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, startPlay, type Contract } from '../../lib/engine/play'
import { RING_FADE_MS, TrickCenterLive } from './trick-views'
import { usePlayTable } from './usePlayTable'
import { svepStartFas } from './common'
import { jagLederNasta } from '../bord/useBordSpel'
import { ms, SWEEP_HOLD, sweepHoldMs } from './tempo'

// Väst spelar 1♣ → Nord (bot) leder, Öst (bot) följer, Syd (vi) tredje hand,
// Väst (bot) fjärde. Frö 2: Syd vinner första sticket (vi leder nästa).
// Frö 1: Nord vinner (boten leder nästa). Proben som valde fröna: spela första
// sticket med usePlayTable och läs completedTricks[0].winner.
const CONTRACT: Contract = { declarer: 'W', strain: 'clubs', level: 1 }
const DEAL_VI_VINNER = { ...dealFromSeed(2), dealer: 'W' as const }
const DEAL_BOT_VINNER = { ...dealFromSeed(1), dealer: 'W' as const }

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

async function playFirstTrick(result: Table) {
  await advance(ms('botDelay', 'normal')) // Nord leder
  await advance(ms('botDelay', 'normal')) // Öst följer
  const mine = legalCards(result.current.play, 'S')[0]
  act(() => result.current.onCardClick(mine)) // klick 1: välj färgen
  act(() => result.current.onCardClick(mine)) // klick 2: spela kortet
  await advance(ms('botDelay', 'normal')) // Väst lägger fjärde kortet
}

describe('svepStartFas — vem leder nästa stick avgör', () => {
  const W1C: Contract = { declarer: 'W', strain: 'clubs', level: 1 }
  const N1C: Contract = { declarer: 'N', strain: 'clubs', level: 1 }
  it('vi försvarar: Syd vinner → vanta, alla andra → hold', () => {
    expect(svepStartFas(W1C, 'S', false)).toBe('vanta')
    expect(svepStartFas(W1C, 'N', false)).toBe('hold')
    expect(svepStartFas(W1C, 'W', false)).toBe('hold')
  })
  it('vi spelar (Nord spelförare, vi styr båda): Nord eller Syd vinner → vanta', () => {
    expect(svepStartFas(N1C, 'N', false)).toBe('vanta')
    expect(svepStartFas(N1C, 'S', false)).toBe('vanta')
    expect(svepStartFas(N1C, 'E', false)).toBe('hold')
  })
  it('sista sticket väntar aldrig — resultatet ska komma av sig självt', () => {
    expect(svepStartFas(W1C, 'S', true)).toBe('hold')
    expect(svepStartFas(N1C, 'N', true)).toBe('hold')
  })
})

describe('jagLederNasta — vänner-bordet (visuella stolar, jag = Syd)', () => {
  it('jag spelför: min stol eller träkarlen (Nord) leder → väntan', () => {
    expect(jagLederNasta('S', 'S')).toBe(true)
    expect(jagLederNasta('S', 'N')).toBe(true)
    expect(jagLederNasta('S', 'E')).toBe(false)
  })
  it('jag är träkarl (partnern spelför): jag spelar aldrig → ingen väntan', () => {
    expect(jagLederNasta('N', 'S')).toBe(false)
    expect(jagLederNasta('N', 'N')).toBe(false)
  })
  it('jag försvarar: bara min egen stol', () => {
    expect(jagLederNasta('W', 'S')).toBe(true)
    expect(jagLederNasta('W', 'N')).toBe(false)
    expect(jagLederNasta('E', 'W')).toBe(false)
  })
})

describe('usePlayTable — vi vinner sticket (frö 2): sticket ligger kvar tills vi trycker', () => {
  it('vanta utan tidsgräns, handen tänds efter sweepHint, tryck → slide → borta', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_VI_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.play.completedTricks[0].winner).toBe('S')
    expect(result.current.sweep?.phase).toBe('vanta')
    expect(result.current.sweep?.hint).toBeUndefined()

    // Handen tänds exakt efter sweepHint — fasen är fortfarande vanta.
    await advance(ms('sweepHint', 'normal') - 1)
    expect(result.current.sweep?.hint).toBeUndefined()
    await advance(1)
    expect(result.current.sweep?.phase).toBe('vanta')
    expect(result.current.sweep?.hint).toBe(true)

    // Ingen tidsgräns: långt efter sweepHold ligger sticket kvar och inget
    // kort har spelats (vi leder — bordet väntar på oss).
    await advance(sweepHoldMs('normal') * 10)
    expect(result.current.sweep?.phase).toBe('vanta')
    expect(result.current.play.currentTrick.length).toBe(0)
    expect(result.current.play.toAct).toBe('S')

    // Trycket på stickytan: svepet startar direkt och sticket försvinner.
    act(() => result.current.advanceSweep())
    expect(result.current.sweep?.phase).toBe('slide')
    await advance(ms('sweepSlide', 'normal'))
    expect(result.current.sweep).toBeNull()
    expect(result.current.play.toAct).toBe('S')
  })

  it('ett klick på ett kort hoppar över väntan som förut (skipSweep)', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_VI_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.sweep?.phase).toBe('vanta')
    act(() => result.current.skipSweep())
    expect(result.current.sweep).toBeNull()
  })
})

describe('SWEEP_HOLD — bot-pausen är runda tal per tempo (2/3/4 s), inte faktor-skalad', () => {
  it('snabb 2000 · normal 3000 · lugn 4000', () => {
    expect(SWEEP_HOLD).toEqual({ snabb: 2000, normal: 3000, lugn: 4000 })
    expect(sweepHoldMs('lugn')).toBe(4000)
  })
})

describe('HoldRing — ringen bär bot-pausens tid och tonar in/ut som del av den', () => {
  function rendera(sweepFas: 'hold' | 'vanta', holdMs?: number) {
    const play = startPlay(DEAL_BOT_VINNER, CONTRACT)
    const trick = { cards: [], leader: 'N' as const, winner: 'N' as const }
    return render(
      <TrickCenterLive
        play={play}
        thinking={false}
        sweep={{ trick, phase: sweepFas, holdMs }}
        onSkipSweep={() => {}}
        onCardClick={() => {}}
        hasReason={() => false}
      />,
    )
  }
  it('hold med holdMs 3000: fyllningen tar 3000 ms, fade 500 ms in och ut med utfasen vid 2500 ms', () => {
    const { container } = rendera('hold', 3000)
    const ring = container.querySelector<SVGElement>('.stick-ring')!
    expect(ring).not.toBeNull()
    expect(ring.style.animationDuration).toBe(`${RING_FADE_MS}ms, ${RING_FADE_MS}ms`)
    expect(ring.style.animationDelay).toBe(`0ms, ${3000 - RING_FADE_MS}ms`)
    const fill = container.querySelector<SVGElement>('.stick-ring-fill')!
    expect(fill.style.animationDuration).toBe('3000ms')
  })
  it('vanta visar ingen ring', () => {
    const { container } = rendera('vanta')
    expect(container.querySelector('.stick-ring')).toBeNull()
  })
})

describe('claim-revealen släcker ett väntande stick (ägarens skärmbild 2026-09-14)', () => {
  it('vanta + ge upp → revealen visas och svepet är borta (ingen hängande hand)', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_VI_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.sweep?.phase).toBe('vanta')
    act(() => result.current.onConcede())
    expect(result.current.pendingClaim).not.toBeNull()
    expect(result.current.sweep).toBeNull()
  })
})

describe('usePlayTable — boten vinner sticket (frö 1): bot-pausen med ringen, sedan svep', () => {
  it('hold bär ringens tid (holdMs = SWEEP_HOLD vid tempot), vanta gör det inte', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.sweep?.phase).toBe('hold')
    expect(result.current.sweep?.holdMs).toBe(sweepHoldMs('normal'))
    const vi2 = renderHook(() => usePlayTable(DEAL_VI_VINNER, CONTRACT, []))
    await playFirstTrick(vi2.result)
    expect(vi2.result.current.sweep?.phase).toBe('vanta')
    expect(vi2.result.current.sweep?.holdMs).toBeUndefined()
  })

  it('hold hela bot-pausen, sedan slide, sedan spelar boten vidare', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.play.completedTricks[0].winner).not.toBe('S')
    expect(result.current.sweep?.phase).toBe('hold')

    await advance(sweepHoldMs('normal') - 1)
    expect(result.current.sweep?.phase).toBe('hold')
    await advance(1)
    expect(result.current.sweep?.phase).toBe('slide')
    await advance(ms('sweepSlide', 'normal'))
    expect(result.current.sweep).toBeNull()

    // Vinnaren (boten) leder efter sin paus.
    await advance(ms('botDelay', 'normal'))
    expect(result.current.play.currentTrick.length).toBe(1)
  })

  it('ett tryck under botens paus sveper direkt (otåliga blockeras aldrig)', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    expect(result.current.sweep?.phase).toBe('hold')
    act(() => result.current.advanceSweep())
    expect(result.current.sweep?.phase).toBe('slide')
    await advance(ms('sweepSlide', 'normal'))
    expect(result.current.sweep).toBeNull()
  })

  it('advanceSweep under slide ändrar ingenting', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL_BOT_VINNER, CONTRACT, []))
    await playFirstTrick(result)
    await advance(sweepHoldMs('normal'))
    expect(result.current.sweep?.phase).toBe('slide')
    act(() => result.current.advanceSweep())
    expect(result.current.sweep?.phase).toBe('slide')
  })
})
