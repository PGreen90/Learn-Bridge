// Brygga mellan budmotorn och kortspelet (punkt 29 + UI): härleder ett
// SPELBART kontrakt ur en FÄRDIG (ostörd) auktion, så att kortet man spelar
// faktiskt matchar budgivningen som visas. Ersätter den fristående
// `pickContract`-heuristiken på "Spela kort"-fliken.
//
// En auktion räknas som färdig när motorn satt `open: false` – då har någon
// passat ut den (eller den nått ett slamavslut) och det SISTA kontraktsbudet i
// `turns` är slutkontraktet. Spelföraren = den i kontraktssidan som FÖRST
// nämnde slutkontraktets färg (vanlig bridgeregel).

import type { Deal, Seat } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { dealRandom } from './deal'
import { buildAuction, type AuctionTurn, type BuiltAuction } from './auction'
import { pickContract } from './play-contract'
import { side, type Contract, type Strain } from './play'

const STRAIN_OF: Record<string, Strain> = {
  C: 'clubs',
  D: 'diamonds',
  H: 'hearts',
  S: 'spades',
  NT: 'NT',
}

// Ett kontraktsbud: nivå 1–7 + färg/NT (till skillnad från P/X/XX).
const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/

/**
 * Motorns `turns` listar bara budsidans bud (öppnare/svarare + ev. inkliv).
 * För rutnätet/den återskapade auktionen behövs HELA medurs-följden från given,
 * så vi fyller i de mellanliggande motståndarpassarna.
 */
export function turnsToCalls(turns: AuctionTurn[], dealer: Seat): ResolvedCall[] {
  const calls: ResolvedCall[] = []
  let idx = 0
  for (const turn of turns) {
    let guard = 0
    while (seatAt(dealer, idx) !== turn.seat && guard++ < 8) {
      calls.push({ seat: seatAt(dealer, idx), bid: 'P' })
      idx++
    }
    calls.push({ seat: turn.seat, bid: turn.call, rule: turn.rule, explanation: turn.explanation })
    idx++
  }
  return calls
}

/**
 * Slutkontraktet ur en budföljd – EN sanningskälla för regeln (delas av
 * budlådan i "Spela kort" och `finalContract`). Sista kontraktsbudet ger nivå +
 * färg; spelföraren = den i den vinnande sidan som FÖRST nämnde slutfärgen
 * (vanlig bridgeregel). Returnerar null när inget kontraktsbud finns (utpassat).
 */
export function contractFromCalls(history: ResolvedCall[]): Contract | null {
  let last: { level: number; suit: string } | null = null
  for (const c of history) {
    const m = CONTRACT_BID.exec(c.bid)
    if (m) last = { level: Number(m[1]), suit: m[2] }
  }
  if (!last) return null

  const contractSide = sideOfStrain(history, last.suit)

  // Spelförare = den i kontraktssidan som FÖRST nämnde färgen.
  let declarer: Seat | null = null
  for (const c of history) {
    const m = CONTRACT_BID.exec(c.bid)
    if (m && m[2] === last.suit && side(c.seat) === contractSide) {
      declarer = c.seat
      break
    }
  }
  if (!declarer) return null

  return { declarer, strain: STRAIN_OF[last.suit], level: last.level }
}

/** Vilken sida (N/S eller Ö/V) som äger slutkontraktet (sista som bjöd färgen). */
function sideOfStrain(history: ResolvedCall[], suit: string): 'NS' | 'EW' {
  let owner: Seat = 'S'
  for (const c of history) {
    const m = CONTRACT_BID.exec(c.bid)
    if (m && m[2] === suit) owner = c.seat
  }
  return side(owner)
}

/**
 * Slutkontraktet ur en färdig auktion, eller `null` om auktionen ännu är öppen
 * (motorn har inte budat klart) eller saknar kontraktsbud. Delegerar till
 * `contractFromCalls` så härledningsregeln bara finns på ETT ställe.
 */
export function finalContract(auction: BuiltAuction): Contract | null {
  if (auction.open) return null
  return contractFromCalls(auction.turns.map((t) => ({ seat: t.seat, bid: t.call })))
}

export interface PlayDeal {
  deal: Deal
  contract: Contract
  /** Hela budföljden för rutnätet, eller `null` när vi fallit tillbaka. */
  calls: ResolvedCall[] | null
}

/**
 * Letar fram en giv vars (ostörda) auktion budats klart till ett spelbart
 * kontrakt – då matchar budgivningen kontraktet man spelar. Hittas ingen inom
 * `maxTries` faller vi tillbaka på heuristiken `pickContract` utan auktion, så
 * att fliken alltid får en giv att spela.
 */
export function dealForPlay(maxTries = 400): PlayDeal {
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom()
    const auction = buildAuction(deal)
    if (!auction) continue
    const contract = finalContract(auction)
    if (contract) {
      return { deal, contract, calls: turnsToCalls(auction.turns, deal.dealer) }
    }
  }
  const deal = dealRandom()
  return { deal, contract: pickContract(deal), calls: null }
}
