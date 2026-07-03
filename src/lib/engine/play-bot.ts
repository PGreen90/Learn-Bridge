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
import { currentWinner, dummyOf, legalCards, side, type PlayState } from './play'
import { isSureWinner, playedCards, shownVoids, unseenTrumpCount, visibleSeats } from './card-counting'
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

/**
 * Kast-vakt (Steg B1, docs/bot-hjarna.md): när SPELFÖRARSIDAN sakar (kan inte
 * följa färg) väljs kortet med minst framtida värde – inte blint "lägst rank".
 * Tumregelns gamla val (lägsta kortet) kastar annars bort hotkort: en femma
 * bredvid partnerns ess kan växa till ett stick (skvis/promovering) medan en
 * hacka i en lång stark färg är rent överskott.
 *
 * Ärlig räkning (ingen tjuvkik): platsen ser sin egen hand + träkarlen
 * (spelförarsidan ser hela sin sida via `visibleSeats`) och det som fallit.
 * Ett kort är LASTBÄRANDE (kan växa till ett stick) om antalet OSEDDA högre
 * kort i färgen är ≤ egna sidans kvarvarande högre kort i färgen – våra toppar
 * kan då dra ut/fälla allt som sitter över. Sakningsordning:
 *   1. icke-lastbärande kort, lägst rank först (rent skräp åker först),
 *   2. annars det lastbärande kort med FLEST egna högre kort över sig
 *      (djupast överskott – hackan i en lång stark färg), lägst rank vid lika.
 *
 * Returnerar `null` när vakten inte gäller (motspelare, följer färg, eller
 * bara trumf kvar) – då tar den gamla tumregeln (`lowAvoidRuff`) över.
 */
function guardedDiscard(state: PlayState, seat: Seat, legal: Hand): Card | null {
  if (side(seat) !== side(state.contract.declarer)) return null // bara spelförarsidan
  if (state.currentTrick.length === 0) return null // utspel, ingen sakning
  const led = state.currentTrick[0].card.suit
  if (legal.some((c) => c.suit === led)) return null // följer färg → ingen sakning
  const candidates = state.trump === null ? legal : legal.filter((c) => c.suit !== state.trump)
  if (candidates.length === 0) return null // bara trumf kvar → gamla regeln

  // Sedda kort per färg: spelade + egna sidans händer (ärligt synligt).
  const seen = new Map<Suit, Set<Rank>>()
  const note = (c: Card) => (seen.get(c.suit) ?? seen.set(c.suit, new Set()).get(c.suit)!).add(c.rank)
  for (const c of playedCards(state)) note(c)
  const visible = visibleSeats(state, seat)
  for (const v of visible) for (const c of state.hands[v]) note(c)

  /** Egna sidans kvarvarande högre kort i färgen. */
  const ownHigher = (card: Card) =>
    visible.reduce(
      (n, v) => n + state.hands[v].filter((c) => c.suit === card.suit && rankVal(c.rank) > rankVal(card.rank)).length,
      0,
    )
  /** Osedda högre kort i färgen (kan sitta hos motståndarna). */
  const unseenHigher = (card: Card) => {
    const s = seen.get(card.suit) ?? new Set<Rank>()
    return RANK_LOW_TO_HIGH.slice(rankVal(card.rank) + 1).filter((r) => !s.has(r)).length
  }

  let best: Card | null = null
  let bestKey: [number, number, number] | null = null // [lastbärande, -överskott, rank]
  for (const c of candidates) {
    const own = ownHigher(c)
    const loadBearing = unseenHigher(c) <= own ? 1 : 0
    const key: [number, number, number] = [loadBearing, -own, rankVal(c.rank)]
    if (
      bestKey === null ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
    ) {
      best = c
      bestKey = key
    }
  }
  return best
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
    // MOTSPELAREN cash:ar försiktigare än spelförarsidan (felrapport #6): ett
    // ENSAMT säkert stick i en FÄRSK färg (t.ex. ett torrt ess) gör spelförarens
    // honnörer under stora. Cash:a bara när färgen har minst två säkra vinnare
    // (löpande topp) eller när vår sida redan attackerat färgen (lett den i ett
    // färdigt stick – då är den etablerad, t.ex. sista vinnaren efter EK cashade).
    // Annars gäller §8-doktrinen: fortsätt utspelfärgen i stället för att öppna
    // en ny färg åt spelföraren.
    const defender = side(seat) !== side(state.contract.declarer)
    const attacked = new Set<Suit>()
    if (defender) {
      for (const t of state.completedTricks) {
        const first = t.cards[0]
        if (first && side(first.seat) === side(seat)) attacked.add(first.card.suit)
      }
    }
    const safeCash = defender
      ? cashable.filter(
          (c) => attacked.has(c.suit) || cashable.filter((w) => w.suit === c.suit).length >= 2,
        )
      : cashable
    if (safeCash.length > 0) {
      return { card: highest(safeCash), reason: 'Jag är inne och cashar en säker vinnare – inget högre kort är kvar i färgen.' }
    }
    // Motspelets utspelfärg (trick 1, om den leddes av vår sida) fortsätts före
    // allt annat – partnerns honnörer sitter ofta bakom den.
    const t1 = state.completedTricks[0]?.cards[0]
    const attackSuit = defender && t1 && side(t1.seat) === side(seat) ? t1.card.suit : null
    const attack = attackSuit !== null ? legal.filter((c) => c.suit === attackSuit) : []
    if (attack.length > 0) {
      return {
        card: leadFromSuit(attack),
        reason: 'Jag fortsätter motspelets utspelfärg (§8) – vi bygger vidare på den i stället för att öppna en ny färg åt spelföraren.',
      }
    }
    return { card: openingLead(legal), reason: 'Jag är inne och spelar ut ur min längsta färg.' }
  }

  const led = state.currentTrick[0].card.suit
  const bestSeat = currentWinner(state.currentTrick, state.trump)
  const bestCard = state.currentTrick.find((pc) => pc.seat === bestSeat)!.card

  // Vid sakning (kan inte följa färg) vaktar spelförarsidan sina hotkort
  // (Steg B1, kast-vakten) – annars gäller gamla "kasta lågt".
  const guardReason =
    'Jag vaktar mina hotkort: sakar ur färgen där vår sida har störst överskott och behåller kort som kan växa till stick.'

  // Partnern leder redan sticket → slösa inte, kasta lågt (ruffa aldrig partnern).
  if (side(bestSeat) === side(seat)) {
    const guarded = guardedDiscard(state, seat, legal)
    if (guarded) return { card: guarded, reason: guardReason }
    return { card: lowAvoidRuff(legal, state.trump), reason: 'Partnern vinner redan sticket – jag kastar lågt och ruffar aldrig partnerns stick.' }
  }

  // Andra hand (bara utspelet lagt än så länge, motståndaren leder) → lågt.
  // UNDANTAG (felrapport #12): med LÖPANDE toppvinnare i den ledda färgen
  // (2+ säkra vinnare) finns inget att spara på – gå upp med den billigaste
  // säkra vinnaren i stället för att skänka bort sticket (Väst la ♥8 ur
  // ♥AKQT98 och Nords knekt vann). Ett ENSAMT säkert kort (t.ex. torrt ess)
  // läggs fortfarande lågt – hold-up/andra hand lågt-doktrinen består. Har en
  // kvarvarande spelare visat renons i färgen kan honnören ruffas → lågt.
  if (state.currentTrick.length === 1) {
    const sure = legal.filter((c) => c.suit === led && isSureWinner(c, legal, playedCards(state)))
    if (sure.length >= 2) {
      const voids = shownVoids(state)
      const yetToPlay = (['N', 'E', 'S', 'W'] as Seat[]).filter(
        (s) => s !== seat && !state.currentTrick.some((pc) => pc.seat === s),
      )
      const ruffRisk =
        state.trump !== null && led !== state.trump && yetToPlay.some((s) => voids[s].has(led))
      if (!ruffRisk) {
        return {
          card: lowest(sure),
          reason: 'Löpande toppvinnare i färgen – jag går upp med den billigaste säkra vinnaren i stället för att maska bort sticket.',
        }
      }
    }
    const guarded = guardedDiscard(state, seat, legal)
    if (guarded) return { card: guarded, reason: guardReason }
    return { card: lowAvoidRuff(legal, state.trump), reason: 'Andra hand lågt – jag sparar honnörerna till senare.' }
  }

  // Tredje/fjärde hand: vinn billigast möjligt om något slår, annars kasta lågt.
  const winners = legal.filter((c) => beats(c, bestCard, led, state.trump))
  if (winners.length > 0) {
    // Träkarlen spelar EFTER oss (motspel, tredje hand) → öppen information:
    // "billigast" måste hålla även mot bordets bästa svar, annars går bordets
    // hacka över vår (felrapport #1: V slog ♥3 med ♥4, bordets ♥5 vann).
    // Toppar bordet allt vi har gäller gamla regeln (billigaste vinnaren).
    const dummy = dummyOf(state.contract)
    const dummyPlaysAfterUs =
      side(seat) !== side(state.contract.declarer) &&
      !state.currentTrick.some((pc) => pc.seat === dummy)
    if (dummyPlaysAfterUs) {
      const dummyInLed = state.hands[dummy].filter((c) => c.suit === led)
      const dummyLegal = dummyInLed.length > 0 ? dummyInLed : state.hands[dummy]
      const holding = winners.filter((c) => !dummyLegal.some((d) => beats(d, c, led, state.trump)))
      if (holding.length > 0) {
        return {
          card: lowest(holding),
          reason: 'Jag vinner sticket så billigt som möjligt – men högt nog att bordet inte går över.',
        }
      }
    }
    return { card: lowest(winners), reason: 'Jag vinner sticket så billigt som möjligt.' }
  }
  const guarded = guardedDiscard(state, seat, legal)
  if (guarded) return { card: guarded, reason: guardReason }
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
