// FACIT FÖRE FIX — markeringsinventeringen 2026-11-24: BOTTARNA LÄSER
// PARTNERNS UPPMUNTRAN OCH RÄKNING (§8.5).
//
// Förr lästes bara en avskräckning ("bevisligen lägsta kortet = ingen dam"),
// och den regeln hade kända luckor (D-2 dubbelton lägger också sitt lägsta).
// Nu läser bottarna så som en människa gör vid bordet: "skulle partnern ha lagt
// det där kortet från den där handen?" Läsaren kör SAMMA regel som den som
// markerar (`foljBetydelse`/`foljKort` i signals.ts) på varje tänkt hand, och
// en hand som skulle ha markerat tvärtom stryks ur de troliga lägena.
//
// Ärlig inferens: bara kortet som lades, korten som fallit och systemet. Aldrig
// en dold hand.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildHandModel } from './hand-model'
import { sampleLayouts } from './monte-carlo'
import { playCard, startPlay, type Contract, type PlayState, type Trick } from './play'
import { applySignalReads, markeringStammer } from './signal-decode'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (t: string): Card => ({ suit: SUIT[t[0]], rank: (t.slice(1) === 'T' ? '10' : t.slice(1)) as Rank })
const kort = (suit: Suit, ...ranks: string[]): Card[] => ranks.map((r) => ({ suit, rank: (r === 'T' ? '10' : r) as Rank }))
const deal = (N: string, E: string, S: string, W: string): Deal =>
  ({ id: 't', board: 1, dealer: 'S', vulnerability: 'none', hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) } }) as Deal
const spela = (d: Deal, strain: Contract['strain'], sekvens: string): PlayState =>
  sekvens.split(' ').reduce((s, k) => playCard(s, card(k)), startPlay(d, { level: 3, strain, declarer: 'S' }))

// Väst ♥A-K-J-10-7, bordet (Nord) ♥6-4, Öst ♥9-5-3-2, Syd ♥D-8.
const NIA = deal('S:AKQ H:64 D:AKQ4 C:AKQJ', 'S:9876 H:9532 D:98 C:432', 'S:JT5 H:Q8 D:JT73 C:T965', 'S:432 H:AKJT7 D:652 C:87')

/** Östs enda lästa markering efter stick 1, ur Västs synvinkel. */
function ostsMarkering(strain: Contract['strain'], sekvens: string) {
  const model = applySignalReads(buildHandModel([]), spela(NIA, strain, sekvens), 'W')
  const m = model.E.markeringar ?? []
  expect(m.length).toBe(1)
  return m[0]
}

describe('attityd i sang: partnern ledde ess, jag läser kortet partnern lade', () => {
  it('LÅGT (♥2): ingen hand som skulle ha uppmuntrat stämmer', () => {
    const m = ostsMarkering('NT', 'HA H4 H2 H8')
    expect(markeringStammer(m, kort('hearts', '9', '5', '2'))).toBe(true) // tre hackor avskräcker
    expect(markeringStammer(m, kort('hearts', 'Q', '5', '2'))).toBe(false) // dam tredje hade lagt femman
    expect(markeringStammer(m, kort('hearts', '9', '5', '3', '2'))).toBe(false) // fyra kort uppmuntrar i sang
  })

  it('LÅGT ur dam-2 dubbelton är tvingat — handen stryks INTE (den gamla luckan)', () => {
    const m = ostsMarkering('NT', 'HA H4 H2 H8')
    expect(markeringStammer(m, kort('hearts', 'Q', '2'))).toBe(true)
  })

  it('HÖGT (♥9): dam eller längd stämmer, tre hackor eller en dubbelton gör det inte', () => {
    const m = ostsMarkering('NT', 'HA H4 H9 H8')
    expect(markeringStammer(m, kort('hearts', '9', '5', '3', '2'))).toBe(true) // längd
    expect(markeringStammer(m, kort('hearts', 'Q', '9', '3'))).toBe(true) // dam
    expect(markeringStammer(m, kort('hearts', '9', '5', '3'))).toBe(false) // hade lagt trean
    expect(markeringStammer(m, kort('hearts', '9', '3'))).toBe(false) // dubbelton uppmuntrar inte i sang
  })
})

describe('attityd i trumf: kort färg uppmuntrar, längd gör det inte', () => {
  it('HÖGT (♥9) mot spaderkontrakt: dubbelton eller dam stämmer, fyra hackor gör det inte', () => {
    const m = ostsMarkering('spades', 'HA H4 H9 H8')
    expect(markeringStammer(m, kort('hearts', '9', '3'))).toBe(true) // vill stjäla
    expect(markeringStammer(m, kort('hearts', 'Q', '9', '3'))).toBe(true)
    expect(markeringStammer(m, kort('hearts', '9', '5', '3', '2'))).toBe(false) // längd uppmuntrar bara i sang
  })
})

describe('räkning: spelföraren spelar färgen, jag läser partnerns antal', () => {
  /** Syd (spelförare) leder ♠5, Väst lägger `vast`, bordet ♠A, Öst ♠2. Öst läser Väst. */
  function efterSpader(vast: string, strain: Contract['strain'] = 'NT', stick = 1): PlayState {
    const utfyllnad: Trick = {
      leader: 'S',
      cards: [
        { seat: 'S', card: card('DA') }, { seat: 'W', card: card('DK') },
        { seat: 'N', card: card('DQ') }, { seat: 'E', card: card('DJ') },
      ],
      winner: 'S',
    }
    const trick: Trick = {
      leader: 'S',
      cards: [
        { seat: 'S', card: card('S5') }, { seat: 'W', card: card(vast) },
        { seat: 'N', card: card('SA') }, { seat: 'E', card: card('S2') },
      ],
      winner: 'N',
    }
    return {
      contract: { declarer: 'S', strain, level: 3 }, trump: strain === 'NT' ? null : strain,
      hands: { N: [], E: [], S: [], W: [] }, leader: 'N', toAct: 'N', currentTrick: [],
      completedTricks: [...Array.from({ length: stick - 1 }, () => utfyllnad), trick], tricksNS: 0, tricksEW: 0,
    }
  }
  const vastsMarkeringar = (s: PlayState) => applySignalReads(buildHandModel([]), s, 'E').W.markeringar ?? []

  it('HÖGT (♠7) visar jämnt antal: sju-tre stämmer, sju-fyra-tre gör det inte', () => {
    const [m] = vastsMarkeringar(efterSpader('S7'))
    expect(markeringStammer(m, kort('spades', '7', '3'))).toBe(true)
    expect(markeringStammer(m, kort('spades', '7', '4', '3'))).toBe(false)
    expect(markeringStammer(m, kort('spades', '8', '7', '4', '3'))).toBe(true) // inte det högsta: läses inte hårt
  })

  it('LÅGT (♠3) visar udda antal: tre kort stämmer, fyra hackor gör det inte', () => {
    const [m] = vastsMarkeringar(efterSpader('S3'))
    expect(markeringStammer(m, kort('spades', '7', '4', '3'))).toBe(true)
    expect(markeringStammer(m, kort('spades', '8', '7', '4', '3'))).toBe(false)
    expect(markeringStammer(m, kort('spades', '7', '3'))).toBe(false)
  })

  it('ett tvingat kort säger ingenting: kung-sju lägger sjuan, singeln lägger sitt enda', () => {
    const [m] = vastsMarkeringar(efterSpader('S7'))
    expect(markeringStammer(m, kort('spades', 'K', '7'))).toBe(true)
    expect(markeringStammer(m, kort('spades', '7'))).toBe(true)
    expect(markeringStammer(m, kort('spades', 'K', 'Q', '7'))).toBe(true) // bara sjuan är fri
  })

  it('ingen räkning läses i trumffärgen (§8.5)', () => {
    expect(vastsMarkeringar(efterSpader('S7', 'spades'))).toEqual([])
  })

  it('efter de fem första sticken markerar ingen — då läses inget', () => {
    expect(vastsMarkeringar(efterSpader('S7', 'NT', 5)).length).toBe(1)
    expect(vastsMarkeringar(efterSpader('S7', 'NT', 6))).toEqual([])
  })
})

describe('det som inte är en markering läses inte', () => {
  it('ett kort som försöker ta sticket (tredje hand högt) är ingen attityd', () => {
    // Väst leder ♥7, bordet ♥4, Öst lägger ♥9 ÖVER partnerns sjua.
    const model = applySignalReads(buildHandModel([]), spela(NIA, 'NT', 'H7 H4 H9 HQ'), 'W')
    expect(model.E.markeringar ?? []).toEqual([])
  })

  it('spelförarsidans kort och mina egna läses aldrig', () => {
    const model = applySignalReads(buildHandModel([]), spela(NIA, 'NT', 'HA H4 H2 H8'), 'W')
    for (const s of ['N', 'S', 'W'] as Seat[]) expect(model[s].markeringar ?? []).toEqual([])
  })
})

describe('samplaren delar bara ut händer som stämmer med markeringen', () => {
  it('Öst lade ♥2 på esset: inget tänkt läge ger Öst dam tredje eller fyra hjärter', () => {
    const state = spela(NIA, 'NT', 'HA H4 H2 H8')
    const model = applySignalReads(buildHandModel([]), state, 'W')
    const [m] = model.E.markeringar ?? []
    const layouts = sampleLayouts(state, 'W', model, 24)
    expect(layouts.length).toBeGreaterThan(0)
    for (const L of layouts) {
      const ursprung = [...L.E, card('H2')]
      expect(markeringStammer(m, ursprung)).toBe(true)
      expect(ursprung.filter((c) => c.suit === 'hearts').length).toBeLessThanOrEqual(3)
    }
  })
})
