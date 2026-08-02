// Delad layout-logik för att visa kort sorterade i färg, både vid spelbordet
// (Play) och i omspelningen (PlayReplay). Håller färgordning och sortering på
// ett ställe.

import type { Card, Rank, Seat, Suit } from '../types/bridge'
import type { Contract } from './engine/play'

// Grundordning som ALTERNERAR svart/röd för läsbarhet: ♠ ♦ ♣ ♥. Cyklisk, så den
// kan roteras med trumfen utan att alterneringen bryts. Högsta kortet vänster.
export const DISPLAY_SUITS: Suit[] = ['spades', 'diamonds', 'clubs', 'hearts']

// Handens färgordning i budfasen (Synrey-ordning, fyrfärgslek): ♠ ♥ ♣ ♦.
// Ingen trumf ännu — med fyra kulörer behövs ingen svart/röd-alternering.
export const HAND_SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds']

// Överlappet inom en färg för den VILANDE kortraden (handen inte i tur att spela).
// DELAS av budgivningen/budträningen/budvisningen (`HandFan`) och spelbordets
// vilande hand (`SouthFan`) så handen ser IDENTISK ut i alla vyer — ingen
// "hopp"-känsla när man går från budgivning till spel (ägarbeslut 2026-07-30:
// samma look överallt = proffskänsla). Ändra på ETT ställe, ändras överallt.
export const REST_OVERLAP = '-ml-10 sm:-ml-6'

// Överlappet för den SAMMANHÄNGANDE kortraden (fasta xl-kort 64×96): SAMMA
// överlapp över hela raden, även över färggränsen — inget glapp mellan färgerna,
// fyrfärgsleken skiljer dem åt (ägarbeslut 2026-08-02). Remsan är exakt 23,75 px
// (kort 64 − överlapp 40,25) så 13 kort spänner 64 + 12×23,75 = 349 px — 5 px
// marginal per sida i den ~359 px breda ytan på mobil. Delas av spelbordets
// vilande hand (`SouthFan`) och budfasens kortrad (`HandFan flat`).
export const FLAT_OVERLAP = '-ml-[40.25px]'

/**
 * Färgordningen när trumfen är känd (ägarbeslut 2026-07-02, som Synrey):
 * trumfen längst till VÄNSTER, sedan övriga färger i Synrey-ordningen.
 * Sang → ingen trumf, vanliga ordningen ♠ ♥ ♣ ♦.
 */
export function handSuitsTrumpFirst(strain: Suit | 'NT'): Suit[] {
  if (strain === 'NT') return HAND_SUITS
  return [strain, ...HAND_SUITS.filter((s) => s !== strain)]
}
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
