// Brygga mellan budmotorn och kortspelet (punkt 29 + UI): härleder ett
// SPELBART kontrakt ur en FÄRDIG (ostörd) auktion, så att kortet man spelar
// faktiskt matchar budgivningen som visas. Ersätter den fristående
// `pickContract`-heuristiken på "Spela kort"-fliken.
//
// En auktion räknas som färdig när motorn satt `open: false` – då har någon
// passat ut den (eller den nått ett slamavslut) och det SISTA kontraktsbudet i
// `turns` är slutkontraktet. Spelföraren = den i kontraktssidan som FÖRST
// nämnde slutkontraktets färg (vanlig bridgeregel).

import type { Seat } from '../../types/bridge'
import { type ResolvedCall } from '../bidding'
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
 * Slutkontraktet ur en budföljd – EN sanningskälla för regeln (delas av
 * budlådan i "Spela kort" och `finalContract`). Sista kontraktsbudet ger nivå +
 * färg; spelföraren = den i den vinnande sidan som FÖRST nämnde slutfärgen
 * (vanlig bridgeregel). Returnerar null när inget kontraktsbud finns (utpassat).
 */
export function contractFromCalls(history: ResolvedCall[]): Contract | null {
  let last: { level: number; suit: string } | null = null
  // X/XX gäller det SENASTE kontraktsbudet – ett nytt bud nollställer dubblingen.
  let doubled: 'X' | 'XX' | undefined
  for (const c of history) {
    const m = CONTRACT_BID.exec(c.bid)
    if (m) {
      last = { level: Number(m[1]), suit: m[2] }
      doubled = undefined
    } else if (c.bid === 'X') {
      doubled = 'X'
    } else if (c.bid === 'XX') {
      doubled = 'XX'
    }
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

  const contract: Contract = { declarer, strain: STRAIN_OF[last.suit], level: last.level }
  if (doubled) contract.doubled = doubled
  return contract
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

