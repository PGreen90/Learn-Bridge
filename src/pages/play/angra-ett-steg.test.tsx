// @vitest-environment jsdom
// Ångra bara ETT steg (ägarbeslut 2026-10-27): ångra är till för feltryck. Efter
// ett ångra är knappen borta tills man lagt ett nytt kort — man kan inte backa
// stick för stick. Golvet följer med i sparningen (restoredUndoFloor), så en
// omladdning låser inte upp ett nytt ångra på samma kort.

import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, playCard, startPlay, type Contract } from '../../lib/engine/play'
import { playsFrom } from '../../lib/engine/resume'
import { usePlayTable } from './usePlayTable'

// Öst är spelförare → Syd (vi) spelar ut; bottarna svarar via timers som aldrig
// hinner i testet (vi avancerar inga timers), så bordet står still mellan stegen.
const CONTRACT: Contract = { declarer: 'E', strain: 'NT', level: 1 }
const deal = { ...dealFromSeed(7), dealer: 'E' as const }

/** Ett färdigt första stick (S V N Ö) + Syds utspel i stick 2 om Syd vann, annars
 *  korten fram till att Syd lagt ett kort till — bara för att få ett läge med
 *  TVÅ egna kort i följden. */
function tvaEgnaKort() {
  let s = startPlay(deal, CONTRACT)
  let syd = 0
  while (syd < 2) {
    const seat = s.toAct
    s = playCard(s, legalCards(s, seat)[0])
    if (seat === 'S') syd++
  }
  return playsFrom(s)
}

afterEach(() => cleanup())

describe('ångra bara ett steg', () => {
  it('efter ett ångra är knappen borta; ett nytt kort går att ångra igen', () => {
    const plays = tvaEgnaKort()
    const { result } = renderHook(() => usePlayTable(deal, CONTRACT, [], plays))
    expect(result.current.undoable).toBe(true)
    const fore = result.current.play
    act(() => result.current.onUndo())
    // Backat till före Syds senaste kort — och golvet ligger där.
    expect(result.current.play.toAct).toBe('S')
    expect(result.current.undoFloor).toBe(playsFrom(result.current.play).length)
    expect(result.current.undoable).toBe(false) // Syds FÖRSTA kort kan inte ångras
    expect(playsFrom(result.current.play).length).toBeLessThan(playsFrom(fore).length)
    // Ett nytt kort → det (och bara det) går att ångra.
    const kort = legalCards(result.current.play, 'S')[0]
    act(() => result.current.onCardClick(kort))
    act(() => result.current.onCardClick(kort))
    expect(result.current.undoable).toBe(true)
    act(() => result.current.onUndo())
    expect(result.current.undoable).toBe(false)
  })

  it('golvet ur sparningen gäller från start (omladdning låser inte upp ångra)', () => {
    const plays = tvaEgnaKort()
    const { result } = renderHook(() => usePlayTable(deal, CONTRACT, [], plays, undefined, plays.length))
    expect(result.current.undoable).toBe(false)
    const utan = renderHook(() => usePlayTable(deal, CONTRACT, [], plays, undefined, 0))
    expect(utan.result.current.undoable).toBe(true)
  })
})
