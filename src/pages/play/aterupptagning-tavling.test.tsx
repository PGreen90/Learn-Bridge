// @vitest-environment jsdom
// Återuppta en tävlingsgiv EXAKT (ägarbeslut 2026-10-27): förr sparades
// tävlingsgivar aldrig — stängde man appen (eller gick till översikten) mitt i
// given fick man bjuda och spela om hela given med facit i huvudet. Nu sparas
// läget per tävlingsform och startläget hämtas ur sparningen när nummer + bricka
// stämmer. Övningsläget (omspel ur giv-detaljvyn) rör aldrig sparningen.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dealFromSeed } from '../../lib/engine/revisor'
import { legalCards, playCard, startPlay, type Contract } from '../../lib/engine/play'
import { playsFrom, type SparadTavlingsgiv } from '../../lib/engine/resume'
import { loadTavlingPagaende, saveTavlingPagaende } from '../../lib/backend'
import type { ResolvedCall } from '../../lib/bidding'
import type { TavlingSpel } from './tavling-mode'
import { initialTavlingGame } from '../Play'

const deal = { ...dealFromSeed(11), dealer: 'E' as const, board: 4 }
const CONTRACT: Contract = { declarer: 'E', strain: 'NT', level: 1 }
const HISTORY: ResolvedCall[] = [
  { seat: 'E', bid: '1NT' }, { seat: 'S', bid: 'P' }, { seat: 'W', bid: 'P' }, { seat: 'N', bid: 'P' },
]
function femKort() {
  let s = startPlay(deal, CONTRACT)
  for (let i = 0; i < 5; i++) s = playCard(s, legalCards(s, s.toAct)[0])
  return playsFrom(s)
}
const spel = (extra: Partial<TavlingSpel> = {}): TavlingSpel => ({
  giv: { deal, playSeed: 123 } as TavlingSpel['giv'],
  nummer: 77, form: 'mp', board: 4, total: 12, sista: false,
  onResultat: () => {}, onNästa: () => {}, onÖversikt: () => {},
  ...extra,
})

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('återuppta en tävlingsgiv exakt', () => {
  it('utan sparning: färsk giv i budfasen', () => {
    const start = initialTavlingGame(spel())
    expect(start.game?.phase).toBe('bidding')
    expect(start.game?.history).toEqual([])
    expect(start.plays).toEqual([])
    expect(start.undoFloor).toBe(0)
  })

  it('sparat spelläge för samma nummer + bricka: auktionen, korten och ångra-golvet kommer tillbaka', () => {
    const plays = femKort()
    const sparad: SparadTavlingsgiv = { v: 1, nummer: 77, form: 'mp', board: 4, history: HISTORY, phase: 'play', plays, undoFloor: 4 }
    saveTavlingPagaende(sparad, 'mp')
    const start = initialTavlingGame(spel())
    expect(start.game?.phase).toBe('play')
    expect(start.game?.contract).toMatchObject({ declarer: 'E', strain: 'NT', level: 1 })
    expect(start.game?.history).toEqual(HISTORY)
    expect(start.plays).toEqual(plays)
    expect(start.undoFloor).toBe(4)
  })

  it('sparat budläge: auktionen hittills kommer tillbaka', () => {
    const sparad: SparadTavlingsgiv = { v: 1, nummer: 77, form: 'mp', board: 4, history: HISTORY.slice(0, 2), phase: 'bidding', plays: [], undoFloor: 0 }
    saveTavlingPagaende(sparad, 'mp')
    const start = initialTavlingGame(spel())
    expect(start.game?.phase).toBe('bidding')
    expect(start.game?.history).toEqual(HISTORY.slice(0, 2))
  })

  it('annan bricka, annat tävlingsnummer eller annan form återupptas INTE', () => {
    const sparad: SparadTavlingsgiv = { v: 1, nummer: 77, form: 'mp', board: 4, history: HISTORY, phase: 'play', plays: femKort(), undoFloor: 0 }
    saveTavlingPagaende(sparad, 'mp')
    expect(initialTavlingGame(spel({ board: 5 })).game?.phase).toBe('bidding')
    expect(initialTavlingGame(spel({ nummer: 78 })).game?.phase).toBe('bidding')
    expect(initialTavlingGame(spel({ form: 'imp' })).game?.phase).toBe('bidding') // IMP har egen lucka
  })

  it('övningsläget rör aldrig sparningen: startar färskt fast en sparning finns', () => {
    const sparad: SparadTavlingsgiv = { v: 1, nummer: 77, form: 'mp', board: 4, history: HISTORY, phase: 'play', plays: femKort(), undoFloor: 0 }
    saveTavlingPagaende(sparad, 'mp')
    expect(initialTavlingGame(spel({ övning: true })).game?.phase).toBe('bidding')
    expect(loadTavlingPagaende('mp')).toEqual(sparad)
  })

  it('skräp i luckan ignoreras tyst', () => {
    localStorage.setItem('learnbridge:tavling-pagaende', '{"v":1,"nummer":77,"board":4,"phase":"play"}')
    expect(initialTavlingGame(spel()).game?.phase).toBe('bidding')
  })
})
