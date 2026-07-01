import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { buildHandModel } from './hand-model'
import type { HandModel } from './hand-model'
import type { Contract, PlayState } from './play'
import { sampleLayouts } from './monte-carlo'
import { hcp } from './hand'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** Hela kortleken (52 kort). */
function fullDeck(): Card[] {
  const out: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) out.push({ suit, rank })
  return out
}

const key = (c: Card) => `${c.suit}${c.rank}`

/**
 * Delar ut kortleken runt-om (N,Ö,S,V) i färg-major-ordning så varje hand får
 * en spridning över alla fyra färger – ger en pool (de dolda) med alla färger.
 */
function dealAround(): Record<Seat, Hand> {
  const order: Seat[] = ['N', 'E', 'S', 'W']
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
  fullDeck().forEach((c, i) => hands[order[i % 4]].push(c))
  return hands
}

/** Ett spelläge på trick 1 (dummy synlig), alla fyra händer fulla. */
function mkState(hands: Record<Seat, Hand>, declarer: Seat, strain: Contract['strain']): PlayState {
  const contract: Contract = { declarer, strain, level: 3 }
  return {
    contract,
    trump: strain === 'NT' ? null : strain,
    hands,
    leader: 'E',
    toAct: 'N',
    currentTrick: [],
    completedTricks: [],
    tricksNS: 0,
    tricksEW: 0,
  }
}

/** Fräsch, obegränsad modell att peta constraints i per test. */
function freshModel(): HandModel {
  return buildHandModel([])
}

const suitCount = (hand: Hand, suit: Suit) => hand.filter((c) => c.suit === suit).length

describe('sampleLayouts – ärlig utdelning av de dolda korten (Steg 3a)', () => {
  // Spelförare N → träkarl S. Botten sitter N och ser N+S. Dolda: Ö och V.
  const hands = dealAround()

  it('varje sampel: rätt kortantal, träkarl + egen hand orörda, inga dubbletter', () => {
    const state = mkState(hands, 'N', 'NT')
    const layouts = sampleLayouts(state, 'N', freshModel(), 10)
    expect(layouts.length).toBe(10)
    for (const L of layouts) {
      // Dolda platser behåller sina kortantal (13 var här).
      expect(L.E.length).toBe(hands.E.length)
      expect(L.W.length).toBe(hands.W.length)
      // Synliga platser är oförändrade.
      expect(L.N).toEqual(hands.N)
      expect(L.S).toEqual(hands.S)
      // Alla 52 kort exakt en gång.
      const all = [...L.N, ...L.E, ...L.S, ...L.W].map(key)
      expect(new Set(all).size).toBe(52)
    }
  })

  it('placerar aldrig ett sett kort (egen hand / träkarl) i en dold hand', () => {
    const state = mkState(hands, 'N', 'NT')
    const seen = new Set([...hands.N, ...hands.S].map(key))
    for (const L of sampleLayouts(state, 'N', freshModel(), 10)) {
      for (const c of [...L.E, ...L.W]) expect(seen.has(key(c))).toBe(false)
    }
  })

  it('renons (void) respekteras: en dold plats får aldrig den färgen', () => {
    const model = freshModel()
    model.E.voids.add('spades')
    const state = mkState(hands, 'N', 'NT')
    for (const L of sampleLayouts(state, 'N', model, 15)) {
      expect(suitCount(L.E, 'spades')).toBe(0)
    }
  })

  it('längd-TAK ur modellen respekteras (Ö högst 1 klöver)', () => {
    const model = freshModel()
    model.E.length.clubs.max = 1
    const state = mkState(hands, 'N', 'NT')
    for (const L of sampleLayouts(state, 'N', model, 15)) {
      expect(suitCount(L.E, 'clubs')).toBeLessThanOrEqual(1)
    }
  })

  it('längd-GOLV ur modellen respekteras (Ö minst 5 ruter)', () => {
    const model = freshModel()
    model.E.length.diamonds.min = 5
    const state = mkState(hands, 'N', 'NT')
    const layouts = sampleLayouts(state, 'N', model, 15)
    expect(layouts.length).toBeGreaterThan(0)
    for (const L of layouts) expect(suitCount(L.E, 'diamonds')).toBeGreaterThanOrEqual(5)
  })

  it('HP-TAK ur modellen respekteras (Ö högst 3 hp)', () => {
    const model = freshModel()
    model.E.hcpMax = 3
    const state = mkState(hands, 'N', 'NT')
    const layouts = sampleLayouts(state, 'N', model, 15)
    expect(layouts.length).toBeGreaterThan(0)
    for (const L of layouts) expect(hcp(L.E)).toBeLessThanOrEqual(3)
  })

  it('omöjlig constraint (båda dolda renons i spader, men pool har spader) → inga sampel', () => {
    const model = freshModel()
    model.E.voids.add('spades')
    model.W.voids.add('spades')
    const state = mkState(hands, 'N', 'NT')
    expect(sampleLayouts(state, 'N', model, 5)).toEqual([])
  })

  it('motspelare ser bara egen hand + träkarl (dold: spelföraren + partnern)', () => {
    // Spelförare Ö → träkarl V. Bot sitter N (motspelare) och ser N + V.
    // Dolda: Ö (spelföraren) och S (partnern).
    const state = mkState(hands, 'E', 'NT')
    for (const L of sampleLayouts(state, 'N', freshModel(), 8)) {
      expect(L.N).toEqual(hands.N) // egen hand orörd
      expect(L.W).toEqual(hands.W) // träkarlen orörd
      expect(L.E.length).toBe(hands.E.length)
      expect(L.S.length).toBe(hands.S.length)
    }
  })
})

describe('sampleLayouts – skärper med redan spelade kort', () => {
  it('räknar en dold plats ursprungslängd som spelade + tilldelade kort', () => {
    // Ö har redan spelat en spader i ett avslutat stick. Modellen säger Ö hade
    // exakt 2 spader i ursprungshanden → högst 1 spader kan finnas kvar.
    const base = dealAround()
    const state = mkState(base, 'N', 'NT')
    const played: Card = { suit: 'spades', rank: '3' } // ett kort Ö faktiskt har i dealAround
    expect(base.E.some((c) => key(c) === key(played))).toBe(true)
    // Bygg ett avslutat stick där Ö la en spader, och ta bort kortet ur Ö:s hand.
    state.hands.E = state.hands.E.filter((c) => key(c) !== key(played))
    state.completedTricks = [
      { leader: 'E', winner: 'N', cards: [{ seat: 'E', card: played }] },
    ]
    const model = freshModel()
    model.E.length.spades.max = 2 // ursprungshanden: högst 2 spader
    for (const L of sampleLayouts(state, 'N', model, 12)) {
      // tilldelade + spelade (1) ≤ 2 → högst 1 spader kvar tilldelad
      expect(suitCount(L.E, 'spades')).toBeLessThanOrEqual(1)
    }
  })
})
