// @vitest-environment jsdom
// Två tryck gäller ALLTID (ägarbeslut 2026-09-13): den gamla genvägen som spelade
// en singelton (enda kortet i sin färg) direkt på första trycket gav feltryck vid
// bordet. Nu väljer första trycket färgen även för en singelton, och först det
// andra trycket spelar kortet — exakt som för alla andra kort.

import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import type { Contract } from '../../lib/engine/play'
import type { Deal, Suit } from '../../types/bridge'
import { usePlayTable } from './usePlayTable'

// Öst är spelförare → Syd (vi) spelar ut, så alla Syds kort är lagliga och
// inget bot-drag hinner före vårt. Sökningen ger första seedade giv där Syd
// håller en singelton (deterministiskt — samma giv varje körning).
const CONTRACT: Contract = { declarer: 'E', strain: 'NT', level: 1 }
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

function givMedSingelton(): { deal: Deal; singelton: Suit; lang: Suit } {
  for (let seed = 1; seed < 500; seed++) {
    const deal = { ...dealFromSeed(seed), dealer: 'E' as const }
    const antal = (s: Suit) => deal.hands.S.filter((c) => c.suit === s).length
    const singelton = SUITS.find((s) => antal(s) === 1)
    const lang = SUITS.find((s) => antal(s) >= 2)
    if (singelton && lang) return { deal, singelton, lang }
  }
  throw new Error('Ingen seedad giv med singelton hos Syd hittades')
}

afterEach(() => cleanup())

describe('två tryck gäller alltid — även för en singelton', () => {
  it('första trycket på en singelton väljer färgen, andra trycket spelar kortet', () => {
    const { deal, singelton } = givMedSingelton()
    const { result } = renderHook(() => usePlayTable(deal, CONTRACT, []))
    expect(result.current.play.toAct).toBe('S')
    const kort = deal.hands.S.find((c) => c.suit === singelton)!

    act(() => result.current.onCardClick(kort))
    expect(result.current.play.currentTrick.length).toBe(0)
    expect(result.current.selectedSuit).toBe(singelton)

    act(() => result.current.onCardClick(kort))
    expect(result.current.play.currentTrick.length).toBe(1)
    expect(result.current.play.currentTrick[0].card).toEqual(kort)
    expect(result.current.selectedSuit).toBeNull()
  })

  it('en flerkortsfärg fungerar som förr: välj, sedan spela', () => {
    const { deal, lang } = givMedSingelton()
    const { result } = renderHook(() => usePlayTable(deal, CONTRACT, []))
    const kort = deal.hands.S.find((c) => c.suit === lang)!

    act(() => result.current.onCardClick(kort))
    expect(result.current.play.currentTrick.length).toBe(0)
    expect(result.current.selectedSuit).toBe(lang)

    act(() => result.current.onCardClick(kort))
    expect(result.current.play.currentTrick.length).toBe(1)
  })
})
