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
import { leadFromSuit } from './signals'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)

/** Lägsta kortet (efter valör) i en lista. */
function lowest(cards: Hand): Card {
  return cards.reduce((lo, c) => (rankVal(c.rank) < rankVal(lo.rank) ? c : lo))
}

/** Högsta kortet (efter valör) i en lista. */
function highest(cards: Hand): Card {
  return cards.reduce((hi, c) => (rankVal(c.rank) > rankVal(hi.rank) ? c : hi))
}

/** Alla kort som redan fallit (avslutade stick + det pågående sticket). */
function playedCards(state: PlayState): Card[] {
  const out: Card[] = []
  for (const t of state.completedTricks) for (const pc of t.cards) out.push(pc.card)
  for (const pc of state.currentTrick) out.push(pc.card)
  return out
}

/**
 * Säker vinnare (ärlig räkning, INGEN tjuvkik): sant om inget HÖGRE kort i samma
 * färg är ospelat. Räknas som "varje högre rank i färgen är antingen redan spelad
 * eller på egen hand". Kräver inte att man vet VAR korten sitter – bara att inga
 * finns kvar. Detta är grundstenen i bottens korträkning (docs/bot-hjarna.md).
 */
function isSureWinner(card: Card, hand: Hand, played: Card[]): boolean {
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
 * Får vinnaren cash:as riskfritt? Sang: alltid. Trumfkontrakt: bara trumffärgens
 * vinnare (Steg 1a) – en sidofärgsvinnare kan ruffas av en renons-motståndare.
 * Den skärpningen (cash:a sidofärg tills en känd renons dyker upp) hör till Steg
 * 1b/Steg 2 när korträkningen vet vem som saknar färgen.
 */
function cashSafe(card: Card, trump: Suit | null): boolean {
  return trump === null || card.suit === trump
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
 * Utspel (§8.3): välj längsta färgen och spela ut rätt kort i den – topp av en
 * honnörssekvens (KQJ→K, QJ10→Q, AK→A), annars spotkort 3:e bästa (jämn längd)
 * / 5:e=lägsta (udda längd). Kortvalet ligger i `signals.leadFromSuit`.
 */
function openingLead(cards: Hand): Card {
  return leadFromSuit(longestSuit(cards))
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

  // På lead:
  if (state.currentTrick.length === 0) {
    // Äkta utspel (trick 1, inga avslutade stick): utspelsdoktrin, inte cash-out
    // – man underleder inte ess/vinnare på utspelet.
    if (state.completedTricks.length === 0) return openingLead(legal)
    // Mitt i given och inne: cash:a säkra vinnare uppifrån i stället för att leda
    // lågt ur längsta färgen (annars tas 10 stick där 13 var kalla).
    const played = playedCards(state)
    const cashable = legal.filter((c) => cashSafe(c, state.trump) && isSureWinner(c, legal, played))
    if (cashable.length > 0) return highest(cashable)
    return openingLead(legal)
  }

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
