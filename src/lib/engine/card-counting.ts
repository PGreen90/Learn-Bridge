// Räknesubstratet för bot-hjärnan (docs/bot-hjarna.md, Steg 2-ryggraden).
// Rena, ÄRLIGA fakta som härleds ur spelläget – INGEN tjuvkik: allt här går att
// räkna ut ur det som faktiskt fallit + de händer den aktande platsen lagligt
// ser (egen hand + träkarlen). Bygger vidare på "säker vinnare"-räkningen som
// föddes i play-bot (Steg 1a) och lyfter ut den till en delad modul.

import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { dummyOf, type PlayState } from './play'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)
/** Antal kort per färg i en kortlek. */
const SUIT_SIZE = 13

/** Alla kort som redan fallit (avslutade stick + det pågående sticket). */
export function playedCards(state: PlayState): Card[] {
  const out: Card[] = []
  for (const t of state.completedTricks) for (const pc of t.cards) out.push(pc.card)
  for (const pc of state.currentTrick) out.push(pc.card)
  return out
}

/**
 * Kända renonser: för varje plats de färger platsen bevisat sig sakna genom att
 * INTE följa färg. Den starkaste inferensen i motspel/spelföring – en show-out
 * låser fördelningen. (Härleds bara ur spelade stick, aldrig ur dolda händer.)
 */
export function shownVoids(state: PlayState): Record<Seat, Set<Suit>> {
  const voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(), S: new Set(), W: new Set() }
  const scan = (cards: PlayState['currentTrick']) => {
    if (cards.length === 0) return
    const led = cards[0].card.suit
    for (const pc of cards) if (pc.card.suit !== led) voids[pc.seat].add(led)
  }
  for (const t of state.completedTricks) scan(t.cards)
  scan(state.currentTrick)
  return voids
}

/**
 * Säker vinnare (ärlig räkning): sant om inget HÖGRE kort i samma färg är
 * ospelat – dvs. varje högre rank är antingen redan spelad eller på egen hand.
 * Kräver inte att man vet VAR korten sitter, bara att inga finns kvar.
 */
export function isSureWinner(card: Card, hand: Hand, played: Card[]): boolean {
  const higher = RANK_LOW_TO_HIGH.slice(rankVal(card.rank) + 1)
  for (const r of higher) {
    const seen =
      played.some((c) => c.suit === card.suit && c.rank === r) ||
      hand.some((c) => c.suit === card.suit && c.rank === r)
    if (!seen) return false // ett högre kort är fortfarande ute → inte säkert stick
  }
  return true
}

/**
 * Vilka platser den aktande platsen ÄRLIGT ser korten på: egen hand + träkarlen
 * (som ligger öppen). Sitter man på spelförarsidan ser man hela den sidan.
 */
function visibleSeats(state: PlayState, seat: Seat): Seat[] {
  const dummy = dummyOf(state.contract)
  const declarer = state.contract.declarer
  if (seat === declarer || seat === dummy) return [declarer, dummy]
  return [seat, dummy]
}

/**
 * Antal trumf som ännu är OSEDDA för `seat` – varken spelade eller i de händer
 * platsen lagligt ser. 0 ⇒ ingen dold hand kan ha trumf ⇒ en sidofärgsvinnare
 * kan inte längre ruffas (grunden för Steg 1b: cash:a sidofärg när trumfen är
 * räknad). Sang (ingen trumf) ⇒ 0.
 */
export function unseenTrumpCount(state: PlayState, seat: Seat): number {
  const trump = state.trump
  if (trump === null) return 0
  let seen = playedCards(state).filter((c) => c.suit === trump).length
  const counted = new Set<Seat>()
  for (const s of visibleSeats(state, seat)) {
    if (counted.has(s)) continue
    counted.add(s)
    seen += state.hands[s].filter((c) => c.suit === trump).length
  }
  return SUIT_SIZE - seen
}
