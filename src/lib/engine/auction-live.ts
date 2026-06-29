// Logiklagret bakom budlådan i "Spela kort": en LEVANDE budgivning som växer ett
// bud i taget runt bordet, i stället för en färdiggenererad auktion.
//
// Fyra rena, testbara delar:
//   - legalCalls       – vilka bud som är tillåtna just nu (bridge-reglerna)
//   - auctionComplete  – är budgivningen slut (tre pass efter ett bud / passat ut)?
//   - contractFromCalls – slutkontraktet ur en färdig budföljd (spelförare m.m.)
//   - decideCall       – "bot-hjärnan": vad bjuder datorn på en plats just nu?
//
// `decideCall` återanvänder hela den befintliga (testade) budmotorn via
// `buildAuction`: den bygger parets kanoniska systemlinje och spelar upp den
// bud för bud. Datorn (Väst/Nord/Öst) följer linjen; Syd bjuder själv. Så länge
// alla följer systemet stämmer historiken med linjen. (Udda Syd-bud "off-book"
// hanteras senare – tills dess passar datorn för att stänga rond.)

import type { Bid, Deal, Seat } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { turnsToCalls } from './auction-contract'
import { side, type Contract, type Strain } from './play'

// ---- Bud-tolkning ----------------------------------------------------------

const STRAINS = ['C', 'D', 'H', 'S', 'NT'] as const
const STRAIN_OF: Record<string, Strain> = {
  C: 'clubs',
  D: 'diamonds',
  H: 'hearts',
  S: 'spades',
  NT: 'NT',
}
const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/

/** Ett kontraktsbud (nivå + färg) tolkat, eller null för P/X/XX. */
function parseContractBid(bid: Bid): { level: number; strain: string } | null {
  const m = CONTRACT_BID.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}

/** Rangvärde så två kontraktsbud kan jämföras: högre tal = högre bud. */
function bidValue(level: number, strain: string): number {
  return level * 5 + STRAINS.indexOf(strain as (typeof STRAINS)[number])
}

/** Alla 35 kontraktsbud i stigande ordning (1♣ … 7NT). */
function allContractBids(): Bid[] {
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

// ---- Slutkontraktet ur en färdig budföljd ---------------------------------

/**
 * Härleder slutkontraktet ur en (färdig) budföljd. Spelföraren = den i den
 * vinnande sidan som FÖRST nämnde slutfärgen. Returnerar null när given passats
 * ut (inget kontraktsbud).
 */
export function contractFromCalls(history: ResolvedCall[]): Contract | null {
  let last: { level: number; strain: string } | null = null
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb) last = cb
  }
  if (!last) return null

  const winningSide = sideOfStrain(history, last.strain)
  let declarer: Seat | null = null
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && cb.strain === last.strain && side(c.seat) === winningSide) {
      declarer = c.seat
      break
    }
  }
  if (!declarer) return null

  return { declarer, strain: STRAIN_OF[last.strain], level: last.level }
}

/** Vilken sida som äger slutfärgen (den som bjöd den sist). */
function sideOfStrain(history: ResolvedCall[], strain: string): 'NS' | 'EW' {
  let owner: Seat = 'S'
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && cb.strain === strain) owner = c.seat
  }
  return side(owner)
}

// ---- Bot-hjärnan -----------------------------------------------------------

/**
 * Vad datorn bjuder på `seat` givet budgivningen så här långt. Bygger parets
 * kanoniska systemlinje med `buildAuction` och spelar upp den bud för bud.
 * När linjen tagit slut (eller given saknar öppning) passar datorn för att
 * stänga ronden.
 */
export function decideCall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall {
  const pass: ResolvedCall = { seat, bid: 'P' }
  const built = buildAuction(deal)
  if (!built) return pass // ingen öppnar given → alla passar

  const line = turnsToCalls(built.turns, deal.dealer)
  const next = line[history.length]
  if (next && next.seat === seat) return next
  return pass
}
