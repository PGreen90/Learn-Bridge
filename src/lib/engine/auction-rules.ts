// BRIDGE-REGLERNA för en levande auktion — det som inte är budsystem utan
// spelets regler: vilka bud som är lagliga just nu, när auktionen är slut, och
// vems tur det är. Utbrutet ur `auction-live.ts` i motorbytets etapp 4 familj 1
// (2026-09-08) så att beslutstabellen (`auction-decide.ts`) och dess
// kunskapsmoduler kan fråga "är budet lagligt?" utan att importera det gamla
// lagret (som självt importerar tabellen). `auction-live.ts` re-exporterar
// allt härifrån, så befintliga importer fungerar oförändrat.

import type { Bid, Seat, Suit } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { parseContractBid, STRAINS, SUIT_OF_LETTER, SUIT_STRAINS } from './auction-facts'
import { side } from './play'

// ---- Bud-tolkning ----------------------------------------------------------

/** Rangvärde så två kontraktsbud kan jämföras: högre tal = högre bud. */
export function bidValue(level: number, strain: string): number {
  return level * 5 + STRAINS.indexOf(strain as (typeof STRAINS)[number])
}

/** Alla 35 kontraktsbud i stigande ordning (1♣ … 7NT). */
export function allContractBids(): Bid[] {
  const bids: Bid[] = []
  for (let level = 1; level <= 7; level++) {
    for (const s of STRAINS) bids.push(`${level}${s}`)
  }
  return bids
}

// ---- Vems tur är det? ------------------------------------------------------

/** Platsen som ska bjuda näst, räknat medurs från given. */
export function seatToAct(dealer: Seat, historyLength: number): Seat {
  return seatAt(dealer, historyLength)
}

// ---- Tillåtna bud (bridge-reglerna) ---------------------------------------

/**
 * Vilka bud `seat` lagligt får göra givet budgivningen så här långt.
 *  - Pass: alltid.
 *  - Färgbud/NT: alla som ligger HÖGRE än det senaste kontraktsbudet.
 *  - X (dubbelt): bara om motståndarsidans senaste icke-pass var ett kontraktsbud.
 *  - XX (redubbelt): bara om motståndarsidans senaste icke-pass var ett X.
 */
export function legalCalls(history: ResolvedCall[], seat: Seat): Bid[] {
  const calls: Bid[] = ['P']

  // Senaste kontraktsbudet sätter golvet för nya bud.
  let lastValue = 0
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb) lastValue = bidValue(cb.level, cb.strain)
  }
  for (const bid of allContractBids()) {
    const cb = parseContractBid(bid)!
    if (bidValue(cb.level, cb.strain) > lastValue) calls.push(bid)
  }

  // Senaste icke-pass-budet avgör om X/XX är tillåtet.
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (lastNonPass && side(lastNonPass.seat) !== side(seat)) {
    if (parseContractBid(lastNonPass.bid)) calls.push('X')
    else if (lastNonPass.bid === 'X') calls.push('XX')
  }

  return calls
}

// ---- Är budgivningen slut? -------------------------------------------------

/**
 * Slut när tre pass i rad följer på ett kontraktsbud, eller fyra inledande pass
 * (passat ut). Annars öppen.
 */
export function auctionComplete(history: ResolvedCall[]): boolean {
  if (history.length < 4) return false
  const anyBid = history.some((c) => c.bid !== 'P' && c.bid !== 'X' && c.bid !== 'XX')
  let trailingPasses = 0
  for (let i = history.length - 1; i >= 0 && history[i].bid === 'P'; i--) trailingPasses++
  if (!anyBid) return trailingPasses >= 4 // alla passade ut
  return trailingPasses >= 3
}

// ---- Små hjälpare som kunskapsmodulerna delar ------------------------------

export const SWE_SYM: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }

/** Bud med färgsymbol för FÖRKLARINGSTEXTEN ("3H" → "3♥"); NT/pass/dubbel oförändrade. */
export function prettyBid(bid: string): string {
  const m = bid.match(/^([1-7])(C|D|H|S)$/)
  return m ? `${m[1]}${SWE_SYM[m[2]]}` : bid
}

/** Lägsta lagliga budet i en färg/sang just nu (t.ex. "2H"), eller null. */
export function cheapestBidIn(history: ResolvedCall[], seat: Seat, strain: string): Bid | null {
  const legal = legalCalls(history, seat)
  for (let level = 1; level <= 7; level++) {
    const bid = `${level}${strain}` as Bid
    if (legal.includes(bid)) return bid
  }
  return null
}

/** Färgens bokstav ("hearts" → "H"). */
export function letterOfSuit(suit: Suit): (typeof SUIT_STRAINS)[number] {
  return SUIT_STRAINS.find((st) => SUIT_OF_LETTER[st] === suit)!
}
