// Slumpar en komplett giv (52 kort, 13 till varje plats). rng kan skickas in
// för deterministiska tester.

import type { Card, Deal, Hand, Rank, Seat, Suit, Vulnerability } from '../../types/bridge'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const VULNS: Vulnerability[] = ['none', 'ns', 'ew', 'all']

/**
 * Standard-duplikatschema: bricknummer 1–16 → vem som ger och vilken zon.
 * Giv roterar N→Ö→S→V. Zonen följer det fasta 16-brickorsmönstret
 * (bricka 1 = ingen, 13 = alla, osv. – samma som BBO visar).
 */
export function boardInfo(board: number): { dealer: Seat; vulnerability: Vulnerability } {
  const i = ((board - 1) % 16 + 16) % 16
  return {
    dealer: SEATS[i % 4],
    vulnerability: VULNS[(i + Math.floor(i / 4)) % 4],
  }
}

function fullDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

/** Mulberry32 — liten deterministisk RNG så en giv kan återskapas ur sitt frö.
 *  Bor här (flyttad från revisor.ts 2026-08-02) så lätta moduler (Dagens giv)
 *  kan seeda utan att dra in hela revisorn; revisorn återexporterar den. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Blandar leken och delar ut 13 kort till varje plats. Delad kärna för både
 *  slumpgiven och den frö-baserade tävlingsgiven — så exakt samma utdelnings-
 *  logik gäller överallt. */
function shuffledHands(rng: () => number): Record<Seat, Hand> {
  const deck = fullDeck()
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
  deck.forEach((card, i) => hands[SEATS[i % 4]].push(card))
  return hands
}

/** Blandar och delar ut. Standard: äkta slump (Math.random). */
export function dealRandom(rng: () => number = Math.random): Deal {
  const hands = shuffledHands(rng)
  const board = 1 + Math.floor(rng() * 16)
  const { dealer, vulnerability } = boardInfo(board)
  return {
    id: Math.random().toString(36).slice(2, 8),
    hands,
    dealer,
    vulnerability,
    board,
  }
}

/**
 * Delar ut en giv DETERMINISTISKT ur ett heltalsfrö, för ett bestämt
 * bricknummer. Till skillnad från dealRandom slumpas varken bricka eller id:
 * brickan (och därmed given + zonen) är exakt `board`, och id:t är stabilt.
 *
 * Används av serverns tävlingsgiv-generering (Beslut B etapp 2): samma
 * hemliga frö → exakt samma giv, både när dagens givar skapas och när ett
 * inskickat resultat spelas om vid valideringen. Ingen Math.random inblandad.
 */
export function dealFromSeed(seed: number, board: number): Deal {
  const hands = shuffledHands(mulberry32(seed))
  const { dealer, vulnerability } = boardInfo(board)
  return { id: `giv-${board}`, hands, dealer, vulnerability, board }
}
