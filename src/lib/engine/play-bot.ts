// Bott-tumregler för kortspelet (punkt 29). INTE optimalt spel (dubbeldummy/DDS
// är punkt 28) – bara enkla, lagliga val så en giv kan spelas ut mot datorn:
//   • Utspelare: lägg lågt från din längsta färg.
//   • Följer du och partnern redan leder sticket: lägg lågt (slösa inte).
//   • Annars: vinn så billigt som möjligt om du kan, annars lägg lägst.

import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Rank } from '../../types/bridge'
import { currentWinner, legalCards, side, type PlayState } from './play'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)

/** Lägsta kortet (efter valör) i en lista. */
function lowest(cards: Hand): Card {
  return cards.reduce((lo, c) => (rankVal(c.rank) < rankVal(lo.rank) ? c : lo))
}

/** Lägsta kortet i den längsta färgen (för utspel). */
function lowFromLongest(cards: Hand): Card {
  const bySuit = new Map<Suit, Card[]>()
  for (const c of cards) (bySuit.get(c.suit) ?? bySuit.set(c.suit, []).get(c.suit)!).push(c)
  let bestSuit: Card[] | null = null
  for (const group of bySuit.values()) {
    if (!bestSuit || group.length > bestSuit.length) bestSuit = group
  }
  return lowest(bestSuit!)
}

/** Sant om `card` slår `against` givet utspelsfärg och trumf (samma regel som motorn). */
function beats(card: Card, against: Card, led: Suit, trump: Suit | null): boolean {
  const cT = trump !== null && card.suit === trump
  const aT = trump !== null && against.suit === trump
  if (cT !== aT) return cT
  if (cT && aT) return rankVal(card.rank) > rankVal(against.rank)
  const cLed = card.suit === led
  const aLed = against.suit === led
  if (cLed !== aLed) return cLed
  if (cLed && aLed) return rankVal(card.rank) > rankVal(against.rank)
  return false
}

/** Väljer ett lagligt kort åt `seat` enligt enkla tumregler. */
export function botCard(state: PlayState, seat: Seat): Card {
  const legal = legalCards(state, seat)

  // Utspel: lågt från längsta färgen.
  if (state.currentTrick.length === 0) return lowFromLongest(legal)

  const led = state.currentTrick[0].card.suit
  const bestSeat = currentWinner(state.currentTrick, state.trump)
  const bestCard = state.currentTrick.find((pc) => pc.seat === bestSeat)!.card

  // Partnern leder redan sticket → slösa inte, lägg lågt.
  if (side(bestSeat) === side(seat)) return lowest(legal)

  // Annars: vinn billigast möjligt om något lagligt kort slår, annars lägg lägst.
  const winners = legal.filter((c) => beats(c, bestCard, led, state.trump))
  return winners.length > 0 ? lowest(winners) : lowest(legal)
}
