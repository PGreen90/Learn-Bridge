// Facit för spara/återuppta-given (Etapp B): det återuppbyggda läget ska vara
// EXAKT det sparade — annars fortsätter spelaren i en annan giv än den hen
// lämnade. Seedat (arbetsregeln: volymtester alltid seedade).

import { describe, expect, it } from 'vitest'
import { dealRandom, mulberry32 } from './deal'
import { legalCards, playCard, startPlay, type Contract } from './play'
import { playsFrom, rebuildPlay, validSavedGame } from './resume'

const deal = dealRandom(mulberry32(20260803))
const contract: Contract = { declarer: 'E', strain: 'spades', level: 2 }

/** Spela n kort deterministiskt (alltid första lagliga kortet). */
function playN(n: number) {
  let s = startPlay(deal, contract)
  for (let i = 0; i < n; i++) s = playCard(s, legalCards(s, s.toAct)[0])
  return s
}

describe('spara/återuppta given', () => {
  it('rundresan: spela 17 kort → spara → bygg upp → exakt samma läge', () => {
    const state = playN(17) // mitt i femte sticket
    const rebuilt = rebuildPlay(deal, contract, playsFrom(state))
    expect(rebuilt).toEqual(state)
  })

  it('rundresan funkar även vid 0 kort och vid färdigspelad giv', () => {
    const fresh = playN(0)
    expect(rebuildPlay(deal, contract, playsFrom(fresh))).toEqual(fresh)
    const complete = playN(52)
    expect(rebuildPlay(deal, contract, playsFrom(complete))).toEqual(complete)
  })

  it('korrupt kortlista → null i stället för krasch', () => {
    // Samma kort två gånger är alltid olagligt andra gången.
    const first = legalCards(startPlay(deal, contract), startPlay(deal, contract).toAct)[0]
    expect(rebuildPlay(deal, contract, [first, first])).toBeNull()
  })

  it('validSavedGame släpper igenom rätt form och stoppar skräp', () => {
    const ok = {
      v: 1,
      daily: false,
      number: null,
      seed: 42,
      deal,
      history: [],
      phase: 'bidding',
      plays: [],
    }
    expect(validSavedGame(ok)).toBe(true)
    expect(validSavedGame(null)).toBe(false)
    expect(validSavedGame('turbo')).toBe(false)
    expect(validSavedGame({ ...ok, v: 2 })).toBe(false) // framtida schema ignoreras
    expect(validSavedGame({ ...ok, phase: 'mitt-i' })).toBe(false)
    expect(validSavedGame({ ...ok, deal: { hands: { N: [] } } })).toBe(false)
  })
})
