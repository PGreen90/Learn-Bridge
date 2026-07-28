// @vitest-environment jsdom
// Ljuden (etapp 4, "känsla i kortspelet" 2026-07-28): tre diskreta
// syntetiserade ljud (card/sweep/deal), standard PÅ, toggle i ⋮-menyn som
// sparas. jsdom saknar Web Audio — själva ljudmodulen ska no-op:a tyst, och
// hook-punkterna testas med playSound utbytt mot en mock. Seedad giv
// (dealFromSeed) och alla tider från tempo.ts (sifferregeln).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, type Contract } from '../../lib/engine/play'
import { usePlayTable } from './usePlayTable'
import { ms } from './tempo'
import { playSound } from '../../lib/sound'

// playSound/armSound mockas (jsdom kan inte spela något ändå); av/på-läsningen
// och sparandet (isSoundEnabled/setSoundEnabled) behålls äkta — persistensen
// ska testas på riktigt mot localStorage.
vi.mock('../../lib/sound', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/sound')>()
  return { ...mod, playSound: vi.fn(), armSound: vi.fn() }
})

// Väst spelar 1♣ → Nord (bot) leder, Öst (bot) följer, Syd (vi) är tredje hand,
// Väst (bot) fjärde. Seedad giv → samma händer och samma vinnare varje gång.
const DEAL = { ...dealFromSeed(1), dealer: 'W' as const }
const CONTRACT: Contract = { declarer: 'W', strain: 'clubs', level: 1 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(playSound).mockClear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.removeItem('learnbridge:sound')
  localStorage.removeItem('learnbridge:playSpeed')
})

async function advance(msToRun: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(msToRun)
  })
}

/** Alla ljud som spelats hittills, i ordning. */
const heard = () => vi.mocked(playSound).mock.calls.map((c) => c[0])

describe('ljudmodulen — säker utan Web Audio (jsdom)', () => {
  it('armSound och playSound no-op:ar tyst när AudioContext saknas', async () => {
    const real = await vi.importActual<typeof import('../../lib/sound')>('../../lib/sound')
    expect(() => {
      real.armSound()
      real.playSound('card')
      real.playSound('sweep')
      real.playSound('deal')
    }).not.toThrow()
  })

  it('av/på-valet är PÅ som standard och sparas under learnbridge:sound', async () => {
    const real = await vi.importActual<typeof import('../../lib/sound')>('../../lib/sound')
    expect(real.isSoundEnabled()).toBe(true)
    real.setSoundEnabled(false)
    expect(localStorage.getItem('learnbridge:sound')).toBe('false')
    expect(real.isSoundEnabled()).toBe(false)
  })
})

describe('usePlayTable — ljudvalet', () => {
  it('toggleSound sparas och överlever en omladdning', () => {
    const first = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    expect(first.result.current.sound).toBe(true)
    act(() => first.result.current.toggleSound())
    expect(first.result.current.sound).toBe(false)
    expect(localStorage.getItem('learnbridge:sound')).toBe('false')

    // "Omladdad sida": ny render läser valet ur lagringen.
    first.unmount()
    const second = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    expect(second.result.current.sound).toBe(false)
  })
})

describe('usePlayTable — hook-punkterna', () => {
  it('kortknäpp vid botens kort och giv-klar-tick efter kaskaden', async () => {
    renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    expect(heard()).toEqual([])

    // Nords utspel efter botDelay (750) → kortknäppen; giv-klar-ticken kommer
    // strax därefter (dealSoundDelay 760 — kaskadens slut).
    await advance(ms('botDelay', 'normal'))
    expect(heard()).toEqual(['card'])
    await advance(ms('dealSoundDelay', 'normal') - ms('botDelay', 'normal'))
    expect(heard()).toEqual(['card', 'deal'])
  })

  it('svischet spelas när svepet går in i slide-fasen', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))

    // Spela klart första sticket: Nord + Öst på bottimern, Syd via två-klick,
    // Väst fjärde — varje kort ska ge en knäpp, även det fjärde.
    await advance(ms('botDelay', 'normal'))
    await advance(ms('botDelay', 'normal'))
    const mine = legalCards(result.current.play, 'S')[0]
    act(() => result.current.onCardClick(mine)) // klick 1: välj färgen
    act(() => result.current.onCardClick(mine)) // klick 2: spela kortet
    await advance(ms('botDelay', 'normal'))
    expect(heard().filter((k) => k === 'card').length).toBe(4)
    expect(heard()).not.toContain('sweep')

    // Vinnarglow-pausen är tyst; svischet kommer exakt när sliden börjar.
    await advance(ms('sweepHold', 'normal'))
    expect(result.current.sweep?.phase).toBe('slide')
    expect(heard().filter((k) => k === 'sweep').length).toBe(1)
  })

  it('med ljudet AV spelas ingenting', async () => {
    localStorage.setItem('learnbridge:sound', 'false')
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    expect(result.current.sound).toBe(false)

    // Botens kort + giv-klar-tidpunkten + en bit till — allt ska vara tyst.
    await advance(ms('dealSoundDelay', 'normal') + ms('botDelay', 'normal'))
    expect(heard()).toEqual([])
  })
})
