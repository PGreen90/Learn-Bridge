// Delad layout-logik för att visa kort sorterade i färg, både vid spelbordet
// (Play) och i omspelningen (PlayReplay). Håller färgordning och sortering på
// ett ställe.

import type { Card, Rank, Seat, Suit } from '../types/bridge'
import type { Contract } from './engine/play'

// Grundordning som ALTERNERAR svart/röd för läsbarhet: ♠ ♦ ♣ ♥. Cyklisk, så den
// kan roteras med trumfen utan att alterneringen bryts. Högsta kortet vänster.
export const DISPLAY_SUITS: Suit[] = ['spades', 'diamonds', 'clubs', 'hearts']
const RANK_HIGH_TO_LOW: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

/** Korten i en hand av en viss färg, sorterade högst → lägst. */
export function bySuit(hand: Card[], suit: Suit): Card[] {
  return hand
    .filter((c) => c.suit === suit)
    .sort((a, b) => RANK_HIGH_TO_LOW.indexOf(a.rank) - RANK_HIGH_TO_LOW.indexOf(b.rank))
}

/**
 * Färgernas ordning på en plats, sett från Syds (din) vy – med trumfen på
 * spelförarens högra hand precis som vid ett riktigt bord:
 *  - Nord/Syd (uppe/nere): trumfen längst till HÖGER.
 *  - Öst (sida): trumfen NEDERST (= spelföraren Väst:s höger).
 *  - Väst (sida): trumfen ÖVERST (= spelföraren Öst:s höger).
 * Sang (NT) → ingen trumf, vanlig ordning ♠ ♦ ♣ ♥.
 */
export function orderedSuits(seat: Seat, contract: Contract): Suit[] {
  const trump = contract.strain === 'NT' ? null : (contract.strain as Suit)
  if (!trump) return DISPLAY_SUITS
  const i = DISPLAY_SUITS.indexOf(trump)
  return seat === 'W'
    ? [...DISPLAY_SUITS.slice(i), ...DISPLAY_SUITS.slice(0, i)]
    : [...DISPLAY_SUITS.slice(i + 1), ...DISPLAY_SUITS.slice(0, i + 1)]
}
