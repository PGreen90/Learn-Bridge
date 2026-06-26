// Slumpar en komplett giv (52 kort, 13 till varje plats). rng kan skickas in
// för deterministiska tester.

import type { Card, Deal, Hand, Rank, Seat, Suit } from '../../types/bridge'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SEATS: Seat[] = ['N', 'E', 'S', 'W']

function fullDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

/** Blandar och delar ut. Standard: äkta slump (Math.random). */
export function dealRandom(rng: () => number = Math.random): Deal {
  const deck = fullDeck()
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
  deck.forEach((card, i) => hands[SEATS[i % 4]].push(card))
  const dealer = SEATS[Math.floor(rng() * 4)]
  return {
    id: Math.random().toString(36).slice(2, 8),
    hands,
    dealer,
    vulnerability: 'none',
  }
}
