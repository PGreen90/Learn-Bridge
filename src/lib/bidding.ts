// Delade budhjälpare: handnotationen, platserna runt bordet och bud-typen
// som hela appen använder. (De handskrivna övningarna som förr lästes in här
// pensionerades 2026-11-11 — budträningen drivs nu av motorn, se
// engine/traning.ts.)

import type { Bid, Card, Hand, Rank, Seat, Suit } from '../types/bridge'

// ---- Kort & händer ---------------------------------------------------------

const SUIT_OF: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }

/** Gör om "S:AK974 H:K83 D:Q6 C:J52" till en lista med kort. "T" = tia. */
export function parseHand(notation: string): Hand {
  const cards: Card[] = []
  for (const group of notation.trim().split(/\s+/)) {
    const [letter, ranks] = group.split(':')
    const suit = SUIT_OF[letter]
    if (!suit || !ranks || ranks === '-') continue
    for (const ch of ranks) {
      const rank = (ch === 'T' ? '10' : ch) as Rank
      cards.push({ suit, rank })
    }
  }
  return cards
}

// ---- Platser runt bordet ---------------------------------------------------

const SEATS_CW: Seat[] = ['N', 'E', 'S', 'W']

export const SEAT_LABEL: Record<Seat, string> = { N: 'Nord', E: 'Öst', S: 'Syd', W: 'Väst' }

/** Vilken plats bjuder vid ett visst steg, räknat medurs från given. */
export function seatAt(dealer: Seat, index: number): Seat {
  const start = SEATS_CW.indexOf(dealer)
  return SEATS_CW[(start + index) % 4]
}

// ---- Budgivningens tillstånd ----------------------------------------------

export interface ResolvedCall {
  seat: Seat
  bid: Bid
  /** Budmotorns regelnamn (för alert-bedömning), om känt. */
  rule?: string
  /** Förklaring av budet (visas när man klickar på det i auktionsvyn), om känd. */
  explanation?: string
}
