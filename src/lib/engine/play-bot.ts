// Bott-tumregler för kortspelet (punkt 29). INTE optimalt spel (dubbeldummy/DDS
// är punkt 28) – bara enkla, lagliga och rimligt RIKTIGA val så en giv kan
// spelas ut mot datorn. Tumreglerna följer klassisk nybörjardoktrin:
//   • Utspel: längsta färgen – topp av en honnörssekvens (KQJ→K, QJ10→Q),
//     annars lågt.
//   • Andra hand (näst att lägga, motståndaren leder): LÅGT – spar honnörerna.
//   • Partnern leder redan sticket: kasta lågt och trumfa ALDRIG partnerns
//     vinnande stick.
//   • Tredje/fjärde hand mot motståndaren: vinn så billigt som möjligt, annars
//     kasta lågt (ruffa bara när det vinner sticket).

import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Rank } from '../../types/bridge'
import { currentWinner, legalCards, side, type PlayState } from './play'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)

/** Lägsta kortet (efter valör) i en lista. */
function lowest(cards: Hand): Card {
  return cards.reduce((lo, c) => (rankVal(c.rank) < rankVal(lo.rank) ? c : lo))
}

/**
 * Lägsta kortet, men undvik att trumfa i onödan: kasta hellre lågt i en sidofärg
 * (så vi inte ruffar partnerns egna vinnande stick eller slösar trumf utan att
 * vinna). Måste vi följa trumf, eller har bara trumf, tas lägsta trumfen.
 */
function lowAvoidRuff(legal: Hand, trump: Suit | null): Card {
  if (!trump) return lowest(legal)
  const offTrump = legal.filter((c) => c.suit !== trump)
  return lowest(offTrump.length > 0 ? offTrump : legal)
}

/** Korten i den längsta färgen (vid lika: första i kortordningen). */
function longestSuit(cards: Hand): Hand {
  const bySuit = new Map<Suit, Card[]>()
  for (const c of cards) (bySuit.get(c.suit) ?? bySuit.set(c.suit, []).get(c.suit)!).push(c)
  let best: Card[] | null = null
  for (const group of bySuit.values()) {
    if (!best || group.length > best.length) best = group
  }
  return best!
}

/**
 * Utspel: välj längsta färgen, och i den toppen av en honnörssekvens
 * (sammanhängande svit från toppen, ≥2 kort med toppkort J eller högre –
 * t.ex. KQJ→K, QJ10→Q, AK→A). Annars lågt från längsta färgen.
 */
function openingLead(cards: Hand): Card {
  const suit = longestSuit(cards)
  const highToLow = [...suit].sort((a, b) => rankVal(b.rank) - rankVal(a.rank))
  let run = 1
  while (run < highToLow.length && rankVal(highToLow[run - 1].rank) - rankVal(highToLow[run].rank) === 1) {
    run++
  }
  const top = highToLow[0]
  if (run >= 2 && rankVal(top.rank) >= rankVal('J')) return top
  return lowest(suit)
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

  // Utspel: topp av sekvens, annars lågt från längsta färgen.
  if (state.currentTrick.length === 0) return openingLead(legal)

  const led = state.currentTrick[0].card.suit
  const bestSeat = currentWinner(state.currentTrick, state.trump)
  const bestCard = state.currentTrick.find((pc) => pc.seat === bestSeat)!.card

  // Partnern leder redan sticket → slösa inte, kasta lågt (ruffa aldrig partnern).
  if (side(bestSeat) === side(seat)) return lowAvoidRuff(legal, state.trump)

  // Andra hand (bara utspelet lagt än så länge, motståndaren leder) → lågt.
  if (state.currentTrick.length === 1) return lowAvoidRuff(legal, state.trump)

  // Tredje/fjärde hand: vinn billigast möjligt om något slår, annars kasta lågt.
  const winners = legal.filter((c) => beats(c, bestCard, led, state.trump))
  return winners.length > 0 ? lowest(winners) : lowAvoidRuff(legal, state.trump)
}
