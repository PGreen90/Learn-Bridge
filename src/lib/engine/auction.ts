// Liten auktions-hjälpare för titta-läget: hitta den första öppningen i en giv
// och – om den är 1♥/1♠ – räkna ut partnerns svar. Detta är fröet till en hel
// budgivning; just nu bara två bud (öppning + svar).

import type { Deal, Seat } from '../../types/bridge'
import { seatAt } from '../bidding'
import { dealRandom } from './deal'
import { classifyOpening } from './openings'
import { respondToMajor, respondToMinor, type Major, type ResponseResult } from './responses'
import { respondTo1NT } from './responses-nt'
import { openerSecondBid } from './rebids'

export interface MajorAuction {
  openerSeat: Seat
  openCall: string // '1H' eller '1S'
  openSuit: Major
  responderSeat: Seat
  response: ResponseResult
}

const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/**
 * Går runt bordet från given. Om den FÖRSTA öppningen är 1♥/1♠ returneras
 * öppnare + partnerns svar. Annars null (ingen ren högfärgsöppning den given).
 */
export function firstMajorOpeningAuction(deal: Deal): MajorAuction | null {
  for (let i = 0; i < 4; i++) {
    const seat = seatAt(deal.dealer, i)
    const open = classifyOpening(deal.hands[seat])
    if (open.call === 'P') continue
    if (open.call === '1H' || open.call === '1S') {
      const openSuit: Major = open.call === '1H' ? 'hearts' : 'spades'
      const responderSeat = PARTNER[seat]
      return {
        openerSeat: seat,
        openCall: open.call,
        openSuit,
        responderSeat,
        response: respondToMajor(deal.hands[responderSeat], openSuit),
      }
    }
    return null // första öppningen var något annat än 1♥/1♠
  }
  return null // alla passade
}

/** Slumpar givar tills en med ren 1♥/1♠-öppning dyker upp. */
export function dealWithMajorOpening(maxTries = 300): { deal: Deal; auction: MajorAuction } | null {
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom()
    const auction = firstMajorOpeningAuction(deal)
    if (auction) return { deal, auction }
  }
  return null
}

// ---- Allmän auktion: öppning → svar → (öppnarens återbud) ------------------
// Bygger en hel (men ostörd) auktion för alla öppningar vi kan svara på.
// Motståndarna passar. Auktionen växer så långt motorn har regler; saknas en
// regel (t.ex. återbud efter en höjning) stannar den och markeras som öppen.

const PARTNER_OF: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const RESPONDABLE = new Set(['1C', '1D', '1H', '1S', '1NT'])
const OPEN_SUIT: Record<string, Major | 'clubs' | 'diamonds'> = {
  '1C': 'clubs', '1D': 'diamonds', '1H': 'hearts', '1S': 'spades',
}

export interface AuctionTurn {
  seat: Seat
  role: 'öppnare' | 'svarare'
  call: string
  rule: string
  explanation: string
  uncertain?: boolean
}

export interface BuiltAuction {
  openerSeat: Seat
  responderSeat: Seat
  openCall: string
  turns: AuctionTurn[]
  /** Sant så länge motorn ännu inte har regler för nästa bud i sekvensen. */
  open: boolean
}

/** Räknar ut svararens första bud givet öppningsbudet. */
function computeResponse(openCall: string, responderHand: Deal['hands'][Seat]): ResponseResult {
  if (openCall === '1NT') return respondTo1NT(responderHand)
  const suit = OPEN_SUIT[openCall]
  if (suit === 'hearts' || suit === 'spades') return respondToMajor(responderHand, suit)
  return respondToMinor(responderHand, suit)
}

/** Bygger en ostörd auktion (öppning → svar → ev. återbud) för första öppningen. */
export function buildAuction(deal: Deal): BuiltAuction | null {
  let openerSeat: Seat | null = null
  let opening = null as ReturnType<typeof classifyOpening> | null
  for (let i = 0; i < 4; i++) {
    const seat = seatAt(deal.dealer, i)
    const o = classifyOpening(deal.hands[seat])
    if (o.call !== 'P') {
      openerSeat = seat
      opening = o
      break
    }
  }
  if (!openerSeat || !opening) return null

  const responderSeat = PARTNER_OF[openerSeat]
  const turns: AuctionTurn[] = [
    { seat: openerSeat, role: 'öppnare', call: opening.call, rule: opening.rule, explanation: opening.explanation, uncertain: opening.uncertain },
  ]

  // Öppningar vi inte har svarsregler för ännu: visa bara öppningen.
  if (!RESPONDABLE.has(opening.call)) {
    return { openerSeat, responderSeat, openCall: opening.call, turns, open: true }
  }

  const response = computeResponse(opening.call, deal.hands[responderSeat])
  turns.push({ seat: responderSeat, role: 'svarare', call: response.call, rule: response.rule, explanation: response.explanation, uncertain: response.uncertain })

  // Svararen passade → utbjudet kontrakt, auktionen är slut.
  if (response.call === 'P') return { openerSeat, responderSeat, openCall: opening.call, turns, open: false }

  // Öppnarens återbud (dispatchas på öppning + svar).
  const rebid = openerSecondBid(opening.call, response, deal.hands[openerSeat])
  if (rebid) {
    turns.push({ seat: openerSeat, role: 'öppnare', call: rebid.call, rule: rebid.rule, explanation: rebid.explanation, uncertain: rebid.uncertain })
    return { openerSeat, responderSeat, openCall: opening.call, turns, open: rebid.call !== 'P' }
  }

  // Inget återbud ännu (svarstyp utan regel): auktionen fortsätter senare.
  return { openerSeat, responderSeat, openCall: opening.call, turns, open: true }
}

/** Slumpar givar tills en med en öppning vi kan bygga vidare på dyker upp. */
export function dealWithAuction(maxTries = 300): { deal: Deal; auction: BuiltAuction } | null {
  for (let i = 0; i < maxTries; i++) {
    const deal = dealRandom()
    const auction = buildAuction(deal)
    if (auction && auction.turns.length >= 2) return { deal, auction }
  }
  return null
}
