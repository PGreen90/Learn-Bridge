import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import {
  legalCards,
  playCard,
  side,
  startPlay,
  type Contract,
  type PlayState,
  type Strain,
} from './play'
import {
  doubleDummyDeclarerRemaining,
  doubleDummyDeclarerTricks,
  doubleDummyTricks,
  tryDoubleDummyDeclarerTricks,
} from './dds'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** En slumpgiv med `perHand` kort per plats (delmängd av leken, för snabb orakel-koll). */
function randomSmallDeal(rng: () => number, perHand: number): Deal {
  const deck: Card[] = []
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const hands = {} as Record<Seat, Card[]>
  SEATS.forEach((seat, i) => (hands[seat] = deck.slice(i * perHand, i * perHand + perHand)))
  return { id: 'r', dealer: 'N', vulnerability: 'none', board: 1, hands }
}

/** Bygg ett spelläge med valfri utspelare (för oraklet). */
function stateFor(deal: Deal, strain: Strain, leader: Seat): PlayState {
  const base = startPlay(deal, { declarer: 'N', strain, level: 1 })
  return { ...base, leader, toAct: leader }
}

/**
 * ORAKEL: ren minimax (ingen alfa-beta, ingen transposition) byggd på den
 * separat testade spelmotorn `play.ts`. Långsam men uppenbart korrekt – används
 * bara på små givar för att verifiera den optimerade lösaren.
 */
function oracle(state: PlayState, target: 'NS' | 'EW'): number {
  // Klart när alla händer är tomma (play.ts isComplete antar 13 stick; våra
  // testgivar har färre, så vi kollar tomma händer i stället).
  if (SEATS.every((s) => state.hands[s].length === 0)) return 0
  const seat = state.toAct
  const maximizing = side(seat) === target
  let best = maximizing ? -Infinity : Infinity
  for (const c of legalCards(state, seat)) {
    const next = playCard(state, c)
    let gain = 0
    if (next.completedTricks.length > state.completedTricks.length) {
      const w = next.completedTricks[next.completedTricks.length - 1].winner
      gain = side(w) === target ? 1 : 0
    }
    const val = gain + oracle(next, target)
    best = maximizing ? Math.max(best, val) : Math.min(best, val)
  }
  return best
}

describe('double-dummy solver – stämmer mot oraklet (ren minimax) på små givar', () => {
  // Passerar isolerat men den tunga minimax-loopen kan spräcka standardgränsen
  // 5 s under full-suite-last (CPU-strid) → egen timeout, som djuptesten nedan.
  it('100 slumpgivar (3 kort/hand), alla strain × utspelare', () => {
    const rng = mulberry32(12345)
    let checked = 0
    for (let n = 0; n < 100; n++) {
      const deal = randomSmallDeal(rng, 3)
      for (const strain of [...SUITS, 'NT'] as Strain[]) {
        for (const leader of SEATS) {
          const got = doubleDummyTricks(deal, strain, leader)
          const want = oracle(stateFor(deal, strain, leader), side(leader))
          expect(got, `strain=${strain} leader=${leader}`).toBe(want)
          checked++
        }
      }
    }
    expect(checked).toBe(100 * 5 * 4)
  }, 30000)

  // Tung men korrekt: djupare DDS-träd som passerar isolerat (~7 s) men kan
  // spräcka standardgränsen 5 s under full-suite-last → egen timeout (ej logik).
  it('30 slumpgivar (4 kort/hand) – djupare träd', () => {
    const rng = mulberry32(999)
    for (let n = 0; n < 30; n++) {
      const deal = randomSmallDeal(rng, 4)
      for (const strain of ['spades', 'NT'] as Strain[]) {
        for (const leader of ['E', 'N'] as Seat[]) {
          const got = doubleDummyTricks(deal, strain, leader)
          const want = oracle(stateFor(deal, strain, leader), side(leader))
          expect(got, `strain=${strain} leader=${leader}`).toBe(want)
        }
      }
    }
  }, 30000)

  it('position-mitt-i-spelet (delvis spelat stick) stämmer mot oraklet', () => {
    const rng = mulberry32(2024)
    for (let n = 0; n < 24; n++) {
      const deal = randomSmallDeal(rng, 4)
      let state = stateFor(deal, 'spades', 'E')
      const steps = n % 7 // 0–6 kort framåt → även mitt i ett stick
      for (let i = 0; i < steps; i++) state = playCard(state, legalCards(state, state.toAct)[0])
      const want = oracle(state, 'NS') // N/S = spelförarsidan (declarer N)
      const got = doubleDummyDeclarerRemaining(state.hands, 'spades', 'N', state.currentTrick, state.toAct, 5_000_000)
      expect(got, `n=${n} steps=${steps}`).toBe(want)
    }
  })
})

describe('double-dummy solver – kända fulla givar (13 kort/hand)', () => {
  // Nord har alla topphonnörer i varje färg → tar alla 13 i sang/trumf oavsett.
  const solid: Deal = {
    id: 'solid',
    dealer: 'N',
    vulnerability: 'none',
    board: 1,
    hands: {
      N: parseHand('S:AKQJ H:AKQ D:AKQ C:AKQ'), // alla topphonnörer = 13 stick
      E: parseHand('S:T98 H:JT98 D:JT9 C:JT9'),
      S: parseHand('S:765 H:765 D:8765 C:876'),
      W: parseHand('S:432 H:432 D:432 C:5432'),
    },
  }

  it('Nord på utspel i sang tar alla 13', () => {
    expect(doubleDummyTricks(solid, 'NT', 'N')).toBe(13)
  })

  it('Nord som spelförare (motspel på utspel) tar ändå alla 13 i sang', () => {
    const c: Contract = { declarer: 'N', strain: 'NT', level: 7 }
    expect(doubleDummyDeclarerTricks(solid, c)).toBe(13)
  })

  it('Nord som spelförare i spader tar alla 13', () => {
    expect(doubleDummyDeclarerTricks(solid, { declarer: 'N', strain: 'spades', level: 7 })).toBe(13)
  })

  it('spelförare + motspel = 13 (nollsummespel)', () => {
    const decl = doubleDummyDeclarerTricks(solid, { declarer: 'N', strain: 'NT', level: 1 })
    const def = doubleDummyTricks(solid, 'NT', 'E') // motspelet (Ö/V) på utspel
    expect(decl + def).toBe(13)
  })
})

describe('budget – fryser aldrig gränssnittet', () => {
  const solid: Deal = {
    id: 'solid',
    dealer: 'N',
    vulnerability: 'none',
    board: 1,
    hands: {
      N: parseHand('S:AKQJ H:AKQ D:AKQ C:AKQ'),
      E: parseHand('S:T98 H:JT98 D:JT9 C:JT9'),
      S: parseHand('S:765 H:765 D:8765 C:876'),
      W: parseHand('S:432 H:432 D:432 C:5432'),
    },
  }
  const c: Contract = { declarer: 'N', strain: 'NT', level: 7 }

  it('rejäl budget → exakt facit', () => {
    expect(tryDoubleDummyDeclarerTricks(solid, c, 5_000_000)).toBe(13)
  })

  it('extremt liten budget → null (inget hängande)', () => {
    // En slumpgiv är tung; med bara 50 noder hinner lösaren inte → null.
    const rng = mulberry32(42)
    const deal = randomSmallDeal(rng, 13)
    expect(tryDoubleDummyDeclarerTricks(deal, { declarer: 'N', strain: 'NT', level: 3 }, 50)).toBeNull()
  })
})
