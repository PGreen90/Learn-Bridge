// @vitest-environment jsdom
// Kortflygningen (etapp 3, "känsla i kortspelet" 2026-07-28): ett spelat kort
// flyger som klon från handen till sin plats i sticket. jsdom saknar WAAPI —
// här stubbas Element.prototype.animate så flygvägen kan testas deterministiskt,
// och utan stubben verifieras att fallbacken (card-in) står orörd kvar.
// Seedad giv (dealFromSeed) och alla tider från tempo.ts (sifferregeln).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, playCard, startPlay, type Contract } from '../../lib/engine/play'
import { usePlayTable } from './usePlayTable'
import { TrickCenterLive } from './trick-views'
import { FlightLayer } from './FlightLayer'
import type { Flight } from './useCardFlight'
import { sameCard } from './common'
import { ms } from './tempo'

// Väst spelar 1♣ → Nord (bot) leder, Öst (bot) följer, Syd (vi) är tredje hand.
// Seedad giv → samma händer och samma kort varje körning.
const DEAL = { ...dealFromSeed(1), dealer: 'W' as const }
const CONTRACT: Contract = { declarer: 'W', strain: 'clubs', level: 1 }

/** En DOMRect-liknande ruta utan att förlita sig på jsdoms DOMRect-konstruktor. */
const rect = (x: number, y: number, w: number, h: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  }) as DOMRect

// WAAPI-stubben: fångar varje animate()-anrop och låter testet själv avgöra
// när "flygningen" är klar (resolve på finished-promisen).
type StubbedAnim = {
  keyframes: unknown
  options: KeyframeAnimationOptions
  resolve: () => void
  cancel: ReturnType<typeof vi.fn>
}
let anims: StubbedAnim[] = []

function stubAnimate() {
  ;(Element.prototype as unknown as { animate: unknown }).animate = vi.fn(
    (keyframes: unknown, options: KeyframeAnimationOptions) => {
      let resolve!: (v?: unknown) => void
      const finished = new Promise((r) => {
        resolve = r
      })
      const cancel = vi.fn()
      anims.push({ keyframes, options, resolve: () => resolve(), cancel })
      return { finished, cancel } as unknown as Animation
    },
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  anims = []
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (Element.prototype as unknown as { animate?: unknown }).animate
  localStorage.removeItem('learnbridge:playSpeed')
})

async function advance(msToRun: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(msToRun)
  })
}

describe('kortflygningen — flygstarten i usePlayTable', () => {
  it('utan WAAPI (jsdom-fallbacken) startar ingen flygning och inget märks som fluget', async () => {
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))
    await advance(ms('botDelay', 'normal')) // Nord leder
    expect(result.current.play.currentTrick.length).toBe(1)
    expect(result.current.flight).toBeNull()
    expect(result.current.wasFlown(result.current.play.currentTrick[0].card)).toBe(false)
  })

  it('med WAAPI flyger både botens och ditt kort; endFlight rensar bara den aktuella', async () => {
    stubAnimate()
    const { result } = renderHook(() => usePlayTable(DEAL, CONTRACT, []))

    // Nords utspel (dold hand → flygning från bordskanten, from = null).
    await advance(ms('botDelay', 'normal'))
    expect(result.current.flight?.seat).toBe('N')
    expect(result.current.flight?.from).toBeNull()

    // Öst följer, sedan spelar vi själva via två-klicksvalet.
    await advance(ms('botDelay', 'normal'))
    const mine = legalCards(result.current.play, 'S')[0]
    act(() => result.current.onCardClick(mine)) // klick 1: välj färgen
    act(() => result.current.onCardClick(mine)) // klick 2: spela kortet
    expect(result.current.flight?.seat).toBe('S')
    expect(sameCard(result.current.flight!.card, mine)).toBe(true)
    expect(result.current.wasFlown(mine)).toBe(true)

    // Bara den AKTUELLA flygningen får rensa sig (stale id ignoreras) — och
    // kortet minns att det flugit även efter landningen (ingen dubbel glidning).
    const id = result.current.flight!.id
    act(() => result.current.endFlight(id - 1))
    expect(result.current.flight).not.toBeNull()
    act(() => result.current.endFlight(id))
    expect(result.current.flight).toBeNull()
    expect(result.current.wasFlown(mine)).toBe(true)
  })
})

describe('kortflygningen — stickmitten (TrickCenterLive)', () => {
  it('kortet i luften är dolt, landade kort får ingen card-in, ofluget får fallbacken', () => {
    // Ett spelat kort: Nord (till vänster om spelförare Väst) leder.
    let p = startPlay(DEAL, CONTRACT)
    const seat = p.toAct
    const led = legalCards(p, seat)[0]
    p = playCard(p, led)
    const flight: Flight = { id: 1, seat, card: led, from: null, fromRotated: false }
    const shared = {
      play: p,
      thinking: false,
      sweep: null,
      onSkipSweep: () => {},
      onCardClick: () => {},
      hasReason: () => false,
    }

    const { container, rerender } = render(
      <TrickCenterLive {...shared} flight={flight} wasFlown={() => true} />,
    )
    const wrapper = container.querySelector(`[data-flight-target="${seat}"]`) as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.className).not.toContain('card-in')
    expect(wrapper.style.opacity).toBe('0')

    // Flygningen klar → kortet visas, fortfarande utan inglidningsklass.
    rerender(<TrickCenterLive {...shared} flight={null} wasFlown={() => true} />)
    expect(wrapper.style.opacity).not.toBe('0')
    expect(wrapper.className).not.toContain('card-in')

    // Fallback-vägen (kortet flög aldrig) → dagens card-in precis som förut.
    rerender(<TrickCenterLive {...shared} flight={null} wasFlown={() => false} />)
    expect(wrapper.className).toContain('card-in')
  })
})

describe('kortflygningen — FlightLayer', () => {
  const FLIGHT: Flight = {
    id: 7,
    seat: 'S',
    card: { suit: 'spades', rank: 'A' },
    from: rect(10, 300, 40, 56),
    fromRotated: false,
  }

  it('animerar klonen med flight-tiden och anmäler landningen med rätt id', async () => {
    stubAnimate()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 28, 40))
    const onDone = vi.fn()
    render(
      <div>
        <div data-flight-target="S" />
        <FlightLayer flight={FLIGHT} speed="normal" targetsKey="1" onDone={onDone} />
      </div>,
    )
    expect(anims.length).toBe(1)
    expect(anims[0].options.duration).toBe(ms('flight', 'normal'))
    expect(onDone).not.toHaveBeenCalled()

    await act(async () => {
      anims[0].resolve()
    })
    expect(onDone).toHaveBeenCalledWith(7)
  })

  it('väntar när landningsplatsen saknas och mäter om när stickmitten ritats om', () => {
    stubAnimate()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 28, 40))
    const onDone = vi.fn()
    // Fjärde kortet: mitten är tom EN commit (svepet inte satt ännu) → ingen
    // animation, inget onDone — flygningen väntar i stället för att ge upp.
    const { rerender } = render(
      <div>
        <FlightLayer flight={FLIGHT} speed="normal" targetsKey="0" onDone={onDone} />
      </div>,
    )
    expect(anims.length).toBe(0)
    expect(onDone).not.toHaveBeenCalled()

    // Svepet ritar sticket → targetsKey ändras → nu mäts och animeras det.
    rerender(
      <div>
        <div data-flight-target="S" />
        <FlightLayer flight={FLIGHT} speed="normal" targetsKey="svep" onDone={onDone} />
      </div>,
    )
    expect(anims.length).toBe(1)
  })
})
