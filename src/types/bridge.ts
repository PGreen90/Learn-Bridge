// Grundläggande bridge-typer. Bara FORMEN på datan – ingen logik än.

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
  vulnerability: 'none' | 'ns' | 'ew' | 'all'
}

/** En budtränings-fråga: visa en hand, välj rätt bud. */
export interface BiddingQuestion {
  id: string
  /** Handen frågan gäller. */
  hand: Hand
  /** Kort beskrivning av situationen, t.ex. "Du sitter som öppnare". */
  situation: string
  /** Själva frågan, t.ex. "Vad öppnar du med?" */
  prompt: string
  /** Budalternativ att välja mellan, t.ex. ["Pass", "1♣", "1NT"]. */
  options: string[]
  /** Index i options som är rätt svar. */
  answerIndex: number
  /** Förklaring som visas efter svar. */
  explanation: string
}
