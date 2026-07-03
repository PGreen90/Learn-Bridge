// Spelmotorn (kortspel, arbetslista punkt 29). Ren logik: inget UI, ingen slump.
// Modellerar de 13 sticken – följa färg, trumf, stickvinnare och stickräkning.
// Bottarnas tumregler ligger i play-bot.ts; facit/DDS (punkt 28) kopplas senare.

import type { Card, Deal, Hand, Rank, Seat, Suit } from '../../types/bridge'

/** Kontraktets färg, eller sang. */
export type Strain = Suit | 'NT'

export interface Contract {
  declarer: Seat
  strain: Strain
  level: number // 1–7
  /** Dubblat (X) eller redubblat (XX) kontrakt; utelämnat = odubblat. */
  doubled?: 'X' | 'XX'
}

export interface PlayedCard {
  seat: Seat
  card: Card
}

export interface Trick {
  leader: Seat
  cards: PlayedCard[] // i spelad ordning
  winner: Seat
}

export interface PlayState {
  contract: Contract
  trump: Suit | null // null i sang
  /** Återstående kort per plats. */
  hands: Record<Seat, Hand>
  /** Vem som spelar ut till det pågående sticket. */
  leader: Seat
  /** Vems tur det är att lägga ett kort. */
  toAct: Seat
  /** Kort lagda i det pågående sticket (0–3 st). */
  currentTrick: PlayedCard[]
  completedTricks: Trick[]
  tricksNS: number
  tricksEW: number
}

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** Medurs nästa plats (N→Ö→S→V→N). */
export const NEXT_SEAT: Record<Seat, Seat> = { N: 'E', E: 'S', S: 'W', W: 'N' }
/** Partnern mittemot. */
export const PARTNER_SEAT: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/** Sidan en plats tillhör. */
export function side(seat: Seat): 'NS' | 'EW' {
  return seat === 'N' || seat === 'S' ? 'NS' : 'EW'
}

/** Träkarlen = spelförarens partner (korten läggs öppet efter utspelet). */
export function dummyOf(contract: Contract): Seat {
  return PARTNER_SEAT[contract.declarer]
}

const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)
const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank

/** Startläge: rätt utspelare (spelförarens vänstra motståndare) och tomma stick. */
export function startPlay(deal: Deal, contract: Contract): PlayState {
  const leader = NEXT_SEAT[contract.declarer]
  const hands = Object.fromEntries(SEATS.map((s) => [s, [...deal.hands[s]]])) as Record<Seat, Hand>
  return {
    contract,
    trump: contract.strain === 'NT' ? null : contract.strain,
    hands,
    leader,
    toAct: leader,
    currentTrick: [],
    completedTricks: [],
    tricksNS: 0,
    tricksEW: 0,
  }
}

/** Vilka kort `seat` får lägga just nu: följa utspelsfärgen om man kan, annars valfritt. */
export function legalCards(state: PlayState, seat: Seat): Hand {
  const hand = state.hands[seat]
  if (state.currentTrick.length === 0) return hand // utspelaren får välja fritt
  const led = state.currentTrick[0].card.suit
  const inLed = hand.filter((c) => c.suit === led)
  return inLed.length > 0 ? inLed : hand
}

/** Sant om `card` slår `against` givet utspelsfärg och trumf. */
function beats(card: Card, against: Card, led: Suit, trump: Suit | null): boolean {
  const cT = trump !== null && card.suit === trump
  const aT = trump !== null && against.suit === trump
  if (cT !== aT) return cT // trumf slår icke-trumf
  if (cT && aT) return rankVal(card.rank) > rankVal(against.rank)
  // Ingen trumf inblandad: bara den utspelade färgen kan vinna.
  const cLed = card.suit === led
  const aLed = against.suit === led
  if (cLed !== aLed) return cLed
  if (cLed && aLed) return rankVal(card.rank) > rankVal(against.rank)
  return false
}

/** Vem som leder ett (fullständigt eller pågående) stick. */
export function currentWinner(cards: PlayedCard[], trump: Suit | null): Seat {
  const led = cards[0].card.suit
  let best = cards[0]
  for (const pc of cards.slice(1)) if (beats(pc.card, best.card, led, trump)) best = pc
  return best.seat
}

/**
 * Lägg ett kort för den vars tur det är. Kastar om kortet inte är lagligt.
 * Returnerar ett NYTT läge (muterar inte indata).
 */
export function playCard(state: PlayState, card: Card): PlayState {
  const seat = state.toAct
  if (!legalCards(state, seat).some((c) => sameCard(c, card))) {
    throw new Error(`Olagligt kort för ${seat}: ${card.rank}${card.suit}`)
  }

  const hands = { ...state.hands, [seat]: state.hands[seat].filter((c) => !sameCard(c, card)) }
  const currentTrick = [...state.currentTrick, { seat, card }]

  // Sticket ofullständigt → nästa plats lägger.
  if (currentTrick.length < 4) {
    return { ...state, hands, currentTrick, toAct: NEXT_SEAT[seat] }
  }

  // Fjärde kortet: avgör vinnaren, räkna sticket, vinnaren spelar ut nästa.
  const winner = currentWinner(currentTrick, state.trump)
  const trick: Trick = { leader: state.leader, cards: currentTrick, winner }
  const winNS = side(winner) === 'NS'
  return {
    ...state,
    hands,
    leader: winner,
    toAct: winner,
    currentTrick: [],
    completedTricks: [...state.completedTricks, trick],
    tricksNS: state.tricksNS + (winNS ? 1 : 0),
    tricksEW: state.tricksEW + (winNS ? 0 : 1),
  }
}

/** Sant när alla 13 stick är spelade. */
export function isComplete(state: PlayState): boolean {
  return state.completedTricks.length === 13
}

export interface PlayResult {
  /** Spelförarsidans antal stick. */
  declarerTricks: number
  /** Stick som krävs (6 + nivån). */
  needed: number
  /** Sant om kontraktet är hemma. */
  made: boolean
  /** Översticket (+) eller beten (−) mot kravet. */
  diff: number
}

/** Resultatet mot kontraktet (oavsett om alla stick är spelade ännu). */
export function contractResult(state: PlayState): PlayResult {
  const declarerTricks = side(state.contract.declarer) === 'NS' ? state.tricksNS : state.tricksEW
  const needed = 6 + state.contract.level
  return { declarerTricks, needed, made: declarerTricks >= needed, diff: declarerTricks - needed }
}
