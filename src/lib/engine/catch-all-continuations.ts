// Fyra små "sista utväg"-svar som låg kvar som detektorer i auction-live.ts när
// motorbytet nått etapp 5 (docs/motorbyte-plan.md). De har alla ett SMALT,
// faktauttryckbart läge (till skillnad från den generella offBookResponse) och
// flyttas hit som vanliga kunskapsfunktioner: EN hand + auktionsläget → ett bud,
// aldrig en annan hand (kikvakten). Beslutstabellen (auction-decide.ts) läser
// dem som rader; detektorerna raderas ur auction-live.ts.
//
//   · answerTransferGameChoice — partnerns 3NT efter fullföljd transfer = välj
//     utgång (felrapport #13).
//   · maybePenaltyDouble — straffdubbling av deras höga färgkontrakt
//     (ägarbeslut 2026-07-04).
//   · placeGameAfterFourthSuit — placera utgång efter att MIN fjärde färg (krav)
//     besvarats (systemrevisorns fynd frö 20260743).
//   · answerTwoOverOneRaise — sätt utgång efter att öppnaren höjt vår 2/1-färg
//     (felrapport #27).

import type { Bid, Hand, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { letterOfSuit, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { isGameOrHigher, parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
import { penaltyDouble } from './doubles'
import { side } from './play'

// ---- Transferns utgångsval (felrapport #13) --------------------------------

/**
 * Har partnern bett öppnaren VÄLJA UTGÅNG efter en Jacoby-transfer över en
 * 1NT-öppning? Mönstret (§5, ostört): `seat` öppnade 1NT, partnern överförde
 * (relät = färgen UNDER högfärgen), `seat` fullföljde transfern, partnern bjöd
 * 3NT = "pass med 2-korts stöd, 4M med 3+" och bara pass har följt. Motståndarna
 * tysta. Returnerar transferns högfärg, annars null. (2NT-öppningens transfer-val
 * ägs redan av raden *tredje* i systems-on-2NT — den här raden gäller bara 1NT,
 * som tabellen annars saknar en fortsättning för.)
 */
function transferGameChoiceToAnswer(f: AuctionFacts): Suit | null {
  const { seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null
  const bids = f.contractBids
  if (bids.length !== 4 || f.opponentsHaveBid) return null
  const [open, relay, complete, nt] = bids
  if (open.seat !== seat || open.bid !== '1NT') return null
  if (relay.seat !== PARTNER[seat] || (relay.bid !== '2D' && relay.bid !== '2H')) return null
  const target: Suit = relay.bid === '2D' ? 'hearts' : 'spades'
  if (complete.seat !== seat || complete.bid !== `2${letterOfSuit(target)}`) return null
  if (nt !== lastNonPass) return null
  return target
}

/** Läget för raden *transfer-utgång*: gäller den här stolen? */
export function transferGameChoiceSeat(f: AuctionFacts): boolean {
  return transferGameChoiceToAnswer(f) !== null
}

/**
 * Partnerns 3NT efter fullföljd transfer = välj utgång (felrapport #13): 4 i
 * högfärgen med 3-korts stöd, annars pass (3NT står).
 */
export function answerTransferGameChoice(hand: Hand, facts: AuctionFacts): ResolvedCall | null {
  const seat = facts.seat
  const transferMajor = transferGameChoiceToAnswer(facts)
  if (!transferMajor) return null
  const support = lengths(hand)[transferMajor]
  if (support >= 3) {
    const bid = `4${letterOfSuit(transferMajor)}` as Bid
    if (legalCalls(facts.history, seat).includes(bid)) {
      return {
        seat, bid, rule: 'till spel',
        explanation: `partnerns 3NT efter transfern = välj utgång: 3+ stöd i ${SWE_SYM[letterOfSuit(transferMajor)]} → 4 ${SWE_SYM[letterOfSuit(transferMajor)]} (5-3-fiten före sang).`,
      }
    }
  }
  return {
    seat, bid: 'P', rule: 'pass',
    explanation: `partnerns 3NT efter transfern = välj utgång: utan 3-stöd i ${SWE_SYM[letterOfSuit(transferMajor)]} → pass (3NT står).`,
  }
}

// ---- Straffdubbling av deras höga färgkontrakt (ägarbeslut 2026-07-04) ------

/**
 * Får `seat` STRAFFDUBBLA här? Kraven — medvetet stränga, så X:et aldrig kan
 * förväxlas med en konventionell dubbling:
 *  - senaste icke-pass är motståndarnas FÄRGKONTRAKT på 3-läget eller högre,
 *  - vår sida har gjort MINST TVÅ kontraktsbud (då kan partnern omöjligt läsa
 *    X:et som upplysning/negativt/tvåfärgssvar — alla de kräver max ett),
 *  - X är lagligt. Returnerar den dubblade färgen, annars null.
 */
export function penaltyDoubleSeat(f: AuctionFacts): Suit | null {
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(f.seat)) return null
  const cb = parseContractBid(lastNonPass.bid)
  if (!cb || cb.strain === 'NT' || cb.level < 3) return null
  if (f.ourContractBids.length < 2) return null
  if (!legalCalls(f.history, f.seat).includes('X')) return null
  return SUIT_OF_LETTER[cb.strain]
}

/** Straffdubblar handen deras höga färgkontrakt (2+ säkra trumfstick + 10+ hp)? */
export function maybePenaltyDouble(hand: Hand, facts: AuctionFacts): ResolvedCall | null {
  const suit = penaltyDoubleSeat(facts)
  if (!suit) return null
  const ans = penaltyDouble(hand, suit)
  if (!ans) return null
  return { seat: facts.seat, bid: 'X', rule: ans.rule, explanation: ans.explanation }
}

// ---- Placera utgång efter MIN fjärde färg (§6.6, krav) ----------------------

/**
 * Läget för raden *fjärde-färg-placering*: har `seat` bjudit fjärde färg (krav)
 * som partnern (öppnaren) just besvarat, ostört, under utgång, med bara pass
 * efter svaret? (Handberoende domen — 18+ går vidare till slam — ligger i valet.)
 */
export function fourthSuitPlacementSeat(f: AuctionFacts): boolean {
  const { history, seat } = f
  if (f.opponentsHaveBid) return false
  const contractBids = f.contractBids
  const fourth = [...contractBids].reverse().find((c) => c.seat === seat && c.rule === 'fjärde färg krav')
  if (!fourth) return false
  const last = contractBids[contractBids.length - 1]
  if (last.seat !== PARTNER[seat]) return false
  if (contractBids.indexOf(last) <= contractBids.indexOf(fourth)) return false
  if (history.slice(history.indexOf(last) + 1).some((c) => c.bid !== 'P')) return false
  if (isGameOrHigher(last.bid as Bid)) return false
  return true
}

/**
 * Svararens fortsättning efter att MIN fjärde färg (krav, §6.6) besvarats. Fjärde
 * färg lovar utgångsvärden → passa aldrig under utgång. Höjde öppnaren min
 * högfärg → 4 i den (fit), annars 3NT. Modesta utgångshänder placeras här; 18+
 * (slamintresse) → null (slam-/beskrivningsmaskineriet, felrapport #42).
 */
export function placeGameAfterFourthSuit(hand: Hand, facts: AuctionFacts): ResolvedCall | null {
  const { history, seat } = facts
  if (!fourthSuitPlacementSeat(facts)) return null
  if (hcp(hand) >= 18) return null
  const contractBids = facts.contractBids
  const last = contractBids[contractBids.length - 1]
  const legal = legalCalls(history, seat)
  const myFirst = contractBids.find((c) => c.seat === seat)!
  const myStrain = parseContractBid(myFirst.bid)!.strain
  const lastStrain = parseContractBid(last.bid)!.strain
  if ((myStrain === 'H' || myStrain === 'S') && lastStrain === myStrain) {
    const gameBid = `4${myStrain}` as Bid
    if (legal.includes(gameBid)) return {
      seat, bid: gameBid, rule: 'fjärde färg: utgång i fit',
      explanation: `Fjärde färg var krav; partnern höjde min ${SWE_SYM[myStrain]} → utgång ${gameBid}.`,
    }
  }
  if (legal.includes('3NT')) return {
    seat, bid: '3NT', rule: 'fjärde färg: placerar utgång',
    explanation: `Fjärde färg var krav (utgångsvärden); partnern har beskrivit sin hand → placerar 3NT.`,
  }
  return null
}

// ---- Sätt utgång efter höjt 2-över-1 (felrapport #27) ----------------------

/**
 * Har VÅR 2-över-1-svarare (utgångskrav) fått sin färg HÖJD av öppnaren, ostört,
 * så att svararen nu måste placera minst utgång? Mönster: motståndarna tysta,
 * VÅR 1-färgsöppning, partnerns svar = ny lägre färg på 2-läget (äkta 2/1),
 * öppnaren höjde den, svararens tur (bara pass efter höjningen), höjningen under
 * utgång. Returnerar den överenskomna färgen, annars null.
 */
function twoOverOneRaiseToAnswer(f: AuctionFacts): { strain: string } | null {
  const { history, seat } = f
  if (f.opponentsHaveBid) return null
  const open = f.opening
  if (!open || open.level !== 1 || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat)) return null
  const opener = open.seat
  const responder = PARTNER[opener]
  if (seat !== responder) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 3) return null
  const [openC, respC, raiseC] = ourBids
  if (openC.seat !== opener || respC.seat !== responder || raiseC.seat !== opener) return null
  const rb = parseContractBid(respC.bid)!
  if (rb.strain === 'NT' || rb.level !== 2 || rb.strain === open.strain) return null
  const openRank = SUIT_STRAINS.indexOf(open.strain as (typeof SUIT_STRAINS)[number])
  const respRank = SUIT_STRAINS.indexOf(rb.strain as (typeof SUIT_STRAINS)[number])
  if (openRank < 0 || respRank < 0 || respRank >= openRank) return null
  const raiseBid = parseContractBid(raiseC.bid)!
  if (raiseBid.strain !== rb.strain || raiseBid.level <= rb.level) return null
  const raiseIdx = history.indexOf(raiseC)
  if (history.slice(raiseIdx + 1).some((c) => parseContractBid(c.bid))) return null
  const isMajor = rb.strain === 'H' || rb.strain === 'S'
  const gameLevel = isMajor ? 4 : 5
  if (raiseBid.level >= gameLevel) return null
  return { strain: rb.strain }
}

/** Läget för raden *2/1-utgång*: gäller den här stolen? */
export function twoOverOneRaiseSeat(f: AuctionFacts): boolean {
  return twoOverOneRaiseToAnswer(f) !== null
}

/**
 * Svararen sätter utgång efter att öppnaren höjt vår 2/1-färg (felrapport #27):
 * högfärg → 4M; lågfärg → 3NT med stopp i de objudna färgerna, annars 5m.
 */
export function answerTwoOverOneRaise(hand: Hand, facts: AuctionFacts): ResolvedCall | null {
  const { history, seat } = facts
  const info = twoOverOneRaiseToAnswer(facts)
  if (!info) return null
  const legal = legalCalls(history, seat)
  const isMajor = info.strain === 'H' || info.strain === 'S'
  if (isMajor) {
    const bid = `4${info.strain}` as Bid
    if (!legal.includes(bid)) return null
    return {
      seat, bid, rule: '2/1 utgångskrav',
      explanation: `Vårt 2-över-1-svar var utgångskrav och partnern höjde min ${SWE_SYM[info.strain]} → jag sätter utgång ${prettyBid(bid)} (pass förbjudet).`,
    }
  }
  const open = facts.opening!
  const bidStrains = new Set<string>([open.strain, info.strain])
  const unbid = SUIT_STRAINS.filter((st) => !bidStrains.has(st))
  if (unbid.every((st) => hasStopper(hand, SUIT_OF_LETTER[st])) && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: '2/1 utgångskrav',
      explanation: `Vårt 2-över-1 var utgångskrav; med stopp i de objudna färgerna → 3NT (pass förbjudet).`,
    }
  }
  const bid = `5${info.strain}` as Bid
  if (!legal.includes(bid)) return null
  return {
    seat, bid, rule: '2/1 utgångskrav',
    explanation: `Vårt 2-över-1 var utgångskrav och partnern höjde min ${SWE_SYM[info.strain]} → utgång ${prettyBid(bid)} (pass förbjudet).`,
  }
}
