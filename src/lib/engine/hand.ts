// Rena hjälpfunktioner för att värdera en hand. Ingen budlogik här – bara
// honnörspoäng, färglängder, fördelning och balans-koll.

import type { Hand, Rank, Suit } from '../../types/bridge'

const HCP_BY_RANK: Partial<Record<Rank, number>> = { A: 4, K: 3, Q: 2, J: 1 }

const RANK_HIGH_TO_LOW: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

const LETTER: Record<Suit, string> = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' }

/** Honnörspoäng: A=4, K=3, D=2, kn=1. */
export function hcp(hand: Hand): number {
  return hand.reduce((sum, c) => sum + (HCP_BY_RANK[c.rank] ?? 0), 0)
}

/** Honnörspoäng inom EN färg (A=4, K=3, D=2, kn=1). */
export function suitHcp(hand: Hand, suit: Suit): number {
  return hand.reduce((sum, c) => sum + (c.suit === suit ? (HCP_BY_RANK[c.rank] ?? 0) : 0), 0)
}

/** Antal kort per färg, t.ex. { spades: 5, hearts: 3, diamonds: 3, clubs: 2 }. */
export function lengths(hand: Hand): Record<Suit, number> {
  const out: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 }
  for (const c of hand) out[c.suit]++
  return out
}

/** Fördelningsmönster sorterat fallande, t.ex. [5, 3, 3, 2]. */
export function shape(hand: Hand): number[] {
  return Object.values(lengths(hand)).sort((a, b) => b - a)
}

/**
 * ÄKTA kontroll i en färg (ägarens definition 2026-09-28): ess, renons, singel
 * eller kung och dam tillsammans. En ensam kung (Kxx) räknas INTE — bara om
 * man till 100 % vet var esset sitter, vilket motorn aldrig gör i v1.
 */
export function hasRealControl(hand: Hand, suit: Suit): boolean {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  if (ranks.length <= 1) return true
  if (ranks.includes('A')) return true
  return ranks.includes('K') && ranks.includes('Q')
}

/** Balanserad = 4-3-3-3, 4-4-3-2 eller 5-3-3-2 (ingen singel/renons). */
export function isBalanced(hand: Hand): boolean {
  const s = shape(hand).join('')
  return s === '4333' || s === '4432' || s === '5332'
}

/** Gör om en hand till kort text ("S:AKT62 H:K83 D:Q6 C:J52"). Tian = T. */
export function handToNotation(hand: Hand): string {
  return (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[])
    .map((suit) => {
      const ranks = hand
        .filter((c) => c.suit === suit)
        .map((c) => c.rank)
        .sort((a, b) => RANK_HIGH_TO_LOW.indexOf(a) - RANK_HIGH_TO_LOW.indexOf(b))
        .map((r) => (r === '10' ? 'T' : r))
      return `${LETTER[suit]}:${ranks.join('') || '-'}`
    })
    .join(' ')
}
