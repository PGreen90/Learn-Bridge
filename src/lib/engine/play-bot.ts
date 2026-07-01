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
import type { ResolvedCall } from '../bidding'
import { currentWinner, legalCards, side, type PlayState } from './play'
import { isSureWinner, playedCards, shownVoids, unseenTrumpCount } from './card-counting'
import { buildHandModel } from './hand-model'
import { applyOpeningLeadSignal } from './signal-decode'
import { chooseCardMonteCarlo } from './monte-carlo'
import { honorLead, leadFromSuit } from './signals'

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

/** Ett kortval + en förklaring i klartext (för "Varför?"-knappen, docs/bot-hjarna.md). */
export interface CardChoice {
  card: Card
  reason: string
}

/**
 * Tumregel-valet MED förklaring. Samma logik som `botCard` men returnerar också
 * en klartextsmotivering ("Varför?"). Beskrivningarna följer nybörjardoktrinen.
 */
export function botCardReasoned(state: PlayState, seat: Seat): CardChoice {
  const legal = legalCards(state, seat)
  if (legal.length === 1) return { card: legal[0], reason: 'Bara ett lagligt kort att spela.' }

  // På lead:
  if (state.currentTrick.length === 0) {
    // Äkta utspel (trick 1, inga avslutade stick): utspelsdoktrin, inte cash-out
    // – man underleder inte ess/vinnare på utspelet.
    if (state.completedTricks.length === 0) {
      const card = openingLead(legal)
      const isHonor = honorLead(longestSuit(legal)) !== null
      const reason = isHonor
        ? 'Utspel (§8.3): jag spelar ut min längsta färg och toppar honnörssekvensen.'
        : 'Utspel (§8.3): jag spelar ut min längsta färg med 3:e/5:e bästa kort så partnern ser längden.'
      return { card, reason }
    }
    // Mitt i given och inne: cash:a säkra vinnare uppifrån i stället för att leda
    // lågt ur längsta färgen (annars tas 10 stick där 13 var kalla).
    // Sang eller räknad trumf (ingen dold hand kan ruffa) → även sidofärgs­-
    // vinnare är säkra (Steg 1b). Annars bara trumffärgens vinnare (Steg 1a).
    const played = playedCards(state)
    const noRuffThreat = state.trump === null || unseenTrumpCount(state, seat) === 0
    const cashable = legal.filter(
      (c) => isSureWinner(c, legal, played) && (noRuffThreat || c.suit === state.trump),
    )
    if (cashable.length > 0) {
      return { card: highest(cashable), reason: 'Jag är inne och cashar en säker vinnare – inget högre kort är kvar i färgen.' }
    }
    return { card: openingLead(legal), reason: 'Jag är inne och spelar ut ur min längsta färg.' }
  }

  const led = state.currentTrick[0].card.suit
  const bestSeat = currentWinner(state.currentTrick, state.trump)
  const bestCard = state.currentTrick.find((pc) => pc.seat === bestSeat)!.card

  // Partnern leder redan sticket → slösa inte, kasta lågt (ruffa aldrig partnern).
  if (side(bestSeat) === side(seat)) {
    return { card: lowAvoidRuff(legal, state.trump), reason: 'Partnern vinner redan sticket – jag kastar lågt och ruffar aldrig partnerns stick.' }
  }

  // Andra hand (bara utspelet lagt än så länge, motståndaren leder) → lågt.
  if (state.currentTrick.length === 1) {
    return { card: lowAvoidRuff(legal, state.trump), reason: 'Andra hand lågt – jag sparar honnörerna till senare.' }
  }

  // Tredje/fjärde hand: vinn billigast möjligt om något slår, annars kasta lågt.
  const winners = legal.filter((c) => beats(c, bestCard, led, state.trump))
  if (winners.length > 0) {
    return { card: lowest(winners), reason: 'Jag vinner sticket så billigt som möjligt.' }
  }
  return { card: lowAvoidRuff(legal, state.trump), reason: 'Inget av mina kort vinner sticket – jag kastar lågt.' }
}

/** Väljer ett lagligt kort åt `seat` enligt enkla tumregler. */
export function botCard(state: PlayState, seat: Seat): Card {
  return botCardReasoned(state, seat).card
}

export interface SmartOpts {
  /** Antal Monte-Carlo-sampel per beslut. */
  samples?: number
  /** Nodbudget per DDS-körning (håller webbläsaren responsiv). */
  maxNodes?: number
  /** Max kort kvar i handen för att MC ska köras (annars tumregler). */
  maxCardsForMC?: number
}

/**
 * Adaptiv Monte-Carlo-budget efter hur många kort som är kvar. Uppmätt (riktiga
 * givar, se historiken): DDS-kostnaden växer brant med kortantalet. Ju djupare in
 * i given (färre kort) desto billigare → fler sampel = högre kvalitet. Vid den
 * tänjda kanten (8 kort) skärs sampel/nodbudget ner så en körning stannar run
 * ett par sekunder – acceptabelt eftersom MC nu körs i en webworker (av
 * huvudtråden), aldrig fryser gränssnittet.
 */
export function mcBudget(cardsLeft: number): { samples: number; maxNodes: number } {
  if (cardsLeft <= 6) return { samples: 30, maxNodes: 200_000 }
  if (cardsLeft === 7) return { samples: 24, maxNodes: 150_000 }
  return { samples: 12, maxNodes: 110_000 } // 8 kort (tänjt fönster): bantad budget
}

/**
 * Bottens kortval MED bot-hjärnan (docs/bot-hjarna.md, Steg 3c). Använder
 * Monte-Carlo-DDS (`chooseCardMonteCarlo`) i slutspelet – när given är liten nog
 * att lösas snabbt – och faller annars tillbaka på de ärliga tumreglerna
 * (`botCard`). Hand-modellen seedas ur den verkliga auktionen (`calls`) plus
 * kända renonser från spelet (`shownVoids`). Ingen tjuvkik: modellen och
 * samplingen ser bara ärligt känd information.
 *
 * MC hoppas över (→ tumregler) när:
 *  • det bara finns ett lagligt kort (inget att välja på),
 *  • det är öppningsutspelet (trick 1, motspelet – utspelsdoktrin gäller, §8.3),
 *  • handen är större än `maxCardsForMC` (tidiga, tunga ställningar = för långsamt;
 *    vinsten ligger ändå i slutspelet: stickföring, ingångar, slutkast).
 */
export function botCardSmartReasoned(
  state: PlayState,
  seat: Seat,
  calls: ResolvedCall[] = [],
  opts: SmartOpts = {},
): CardChoice {
  const legal = legalCards(state, seat)
  if (legal.length === 1) return { card: legal[0], reason: 'Bara ett lagligt kort att spela.' }

  const openingLead = state.completedTricks.length === 0 && state.currentTrick.length === 0
  const cardsLeft = state.hands[seat].length
  const maxCards = opts.maxCardsForMC ?? 8
  if (openingLead || cardsLeft > maxCards) return botCardReasoned(state, seat)

  const model = buildHandModel(calls, { voids: shownVoids(state) })
  // Signalavkodning (pt 50): skärp modellen med det öppningsutspelet avslöjar
  // (längd + ev. touchérande honnör), sett ur den agerande platsens synvinkel.
  applyOpeningLeadSignal(model, state, seat)
  const budget = mcBudget(cardsLeft)
  const choice = chooseCardMonteCarlo(state, seat, model, {
    samples: opts.samples ?? budget.samples,
    maxNodes: opts.maxNodes ?? budget.maxNodes,
  })
  if (!choice) return botCardReasoned(state, seat)
  return {
    card: choice.card,
    reason:
      `Bot-hjärnan tänkte som en expert: jag delade ut ${choice.samples} troliga lägen (utifrån ` +
      `budgivningen och korten som fallit) och spelade igenom dem – det här kortet gav flest stick i snitt.`,
  }
}

/**
 * Sant om `botCardSmartReasoned` skulle köra Monte-Carlo (tung, sekunder) för det
 * här läget – i motsats till en direkt tumregel (öppningsutspel / ett lagligt kort
 * / över MC-fönstret). Gränssnittet använder detta för att avgöra om draget ska
 * räknas i en webworker (av huvudtråden) med en "tänker …"-indikator.
 */
export function usesMonteCarlo(state: PlayState, seat: Seat, opts: SmartOpts = {}): boolean {
  if (legalCards(state, seat).length <= 1) return false
  const openingLead = state.completedTricks.length === 0 && state.currentTrick.length === 0
  const maxCards = opts.maxCardsForMC ?? 8
  return !openingLead && state.hands[seat].length <= maxCards
}

/** Bottens kortval MED bot-hjärnan (docs/bot-hjarna.md, Steg 3c). Se `botCardSmartReasoned`. */
export function botCardSmart(
  state: PlayState,
  seat: Seat,
  calls: ResolvedCall[] = [],
  opts: SmartOpts = {},
): Card {
  return botCardSmartReasoned(state, seat, calls, opts).card
}
