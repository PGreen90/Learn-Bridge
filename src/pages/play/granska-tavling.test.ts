// Facit för rondgenomgångens rekonstruktion (tävlings-UI-polish steg 5).

import { describe, test, expect } from 'vitest'
import type { Card, Deal } from '../../types/bridge'
import {
  contractResult,
  isComplete,
  legalCards,
  playCard,
  startPlay,
  type Contract,
} from '../../lib/engine/play'
import type { GivKontrakt } from '../../lib/backend/tavling'
import { gameFromSeed } from './useGame'
import { byggGranskning } from './granska-tavling'

/** Spela ut given genom att alltid lägga första lagliga kortet — ger en giltig
 *  kortsekvens (hel eller, med `antal`, avbruten som vid en claim). */
function spelaUt(deal: Deal, contract: Contract, antal = Infinity) {
  let state = startPlay(deal, contract)
  const plays: Card[] = []
  while (!isComplete(state) && plays.length < antal) {
    const card = legalCards(state, state.toAct)[0]
    plays.push(card)
    state = playCard(state, card)
  }
  return { plays, state }
}

const deal = gameFromSeed(4242).deal
const contract: Contract = { declarer: 'S', strain: 'NT', level: 3 }

describe('byggGranskning', () => {
  test('helt spelad giv: 13 stick, inget claim, resultat ur kontraktet', () => {
    const { plays, state } = spelaUt(deal, contract)
    const declarerTricks = contractResult(state).declarerTricks
    const kontrakt: GivKontrakt = { level: 3, strain: 'NT', declarer: 'S', diff: declarerTricks - 9 }

    const g = byggGranskning(deal, plays, kontrakt)
    expect(g.tricks).toHaveLength(13)
    expect(g.claimed).toBeNull()
    expect(g.result.declarerTricks).toBe(declarerTricks)
    expect(g.contract).toEqual({ declarer: 'S', strain: 'NT', level: 3, doubled: undefined })
  })

  test('klämtad giv (partiella kort): claimed satt, resultat ur bokfört kontrakt', () => {
    const { plays } = spelaUt(deal, contract, 40) // 40 kort = 10 stick spelade, 3 kvar
    const kontrakt: GivKontrakt = { level: 3, strain: 'NT', declarer: 'S', diff: 1 }

    const g = byggGranskning(deal, plays, kontrakt)
    expect(g.tricks.length).toBeLessThan(13)
    expect(g.claimed).toEqual({ total: 10, auto: false }) // 6 + 3 + diff(1)
    expect(g.result.diff).toBe(1)
    expect(g.result.made).toBe(true)
  })

  test('beten (negativ diff) ⇒ made = false', () => {
    const { plays, state } = spelaUt(deal, contract)
    void state
    const kontrakt: GivKontrakt = { level: 3, strain: 'NT', declarer: 'S', diff: -2 }
    const g = byggGranskning(deal, plays, kontrakt)
    expect(g.result.made).toBe(false)
    expect(g.result.declarerTricks).toBe(7) // 6 + 3 − 2
  })
})
