// Grundläggande bridge-typer. Bara FORMEN på datan – ingen logik här.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7'
  | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  suit: Suit
  rank: Rank
}

/** En hand = (oftast) 13 kort. */
export type Hand = Card[]

/** De fyra positionerna runt bordet (Nord/Öst/Syd/Väst). */
export type Seat = 'N' | 'E' | 'S' | 'W'

/** En komplett giv: alla fyra händer + vem som ger. */
export interface Deal {
  id: string
  hands: Record<Seat, Hand>
  dealer: Seat
  vulnerability: Vulnerability
}

export type Vulnerability = 'none' | 'ns' | 'ew' | 'all'

// ---- Budträning ------------------------------------------------------------

/**
 * Ett bud skrivet som kort text:
 *  - "1C" "1D" "1H" "1S" = 1 klöver/ruter/hjärter/spader
 *  - "1NT" = 1 sang, "P" = pass, "X" = dubbelt, "XX" = redubbelt
 */
export type Bid = string

/** De tre lägena användaren kan välja mellan. */
export type Scope = 'opening' | 'opening-response' | 'full-auction'

/** Ett steg där det är DIN tur: välj bland alternativen, ett är rätt. */
export interface Decision {
  options: Bid[]
  answer: Bid
  explanation: string
}

/**
 * Ett steg i budgivningen. Antingen ett färdigt manus-bud (partner/motståndare)
 * eller ett av dina beslut. Vem som bjuder räknas ut från ordningen + given.
 */
export type AuctionStep = { bid: Bid } | { decision: Decision }

/** En övning = en hand + en budgivning där vissa steg är dina. */
export interface Exercise {
  id: string
  scope: Scope
  theme: string
  dealer: Seat
  vulnerability: Vulnerability
  yourSeat: Seat
  yourHand: Hand
  auction: AuctionStep[]
}

/** Ett tema/lektion som man kan välja i listan. */
export interface Theme {
  id: string
  scope: Scope
  title: string
  description: string
}
