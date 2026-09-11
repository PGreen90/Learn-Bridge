// Manuset — det som är kvar av det (motorbytet, docs/motorbyte-plan.md).
//
// Sedan etapp 3 familj 6 (2026-09-05) avgör `buildAuction` INGA bud i en ostörd
// auktion: öppningen, svaret och hela fortsättningen spelas ut stol för stol ur
// beslutstabellen (`auction-decide.ts`) — samma beslut som stolen tar vid
// bordet, ur egen hand + auktionen. Det manuset fortfarande äger är
//   · konkurrensronden (LHO:s inkliv/X/DONT/försvar, svararens svar på det,
//     advancern, balanseringen, den starka dubblingen, stöddubblingen) — den
//     flyttar in i tabellen familj för familj i etapp 4;
//   · flaggan `open`: får det gamla lagrets konkurrensdetektorer bjuda vidare
//     när tabellen tiger, eller är resten bara avslutande pass?
// När etapp 4 är klar blir `buildAuction` hjälparen "spela ut fyra stolar"
// (jfr `botAuction` i revisor.ts) och `open` försvinner.
//
// Överst: den lilla hjälparen för titta-läget (första 1♥/1♠-öppningen + svar).

import type { Deal, Seat } from '../../types/bridge'
import { seatAt } from '../bidding'
import { dealRandom } from './deal'
import { classifyOpening, isVulnerable } from './openings'
import { auctionComplete } from './auction-rules'
import { decideCall } from './auction-live'
import type { ResolvedCall } from '../bidding'
import { respondToMajor, type Major, type ResponseResult } from './responses'
import type { Forcing } from '../../types/bridge'
import { forcingOf, isAlertRule } from './rules'
import { side } from './play'

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
    const open = classifyOpening(deal.hands[seat], isVulnerable(seat, deal.vulnerability))
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

// ---- Auktionen ur tabellen (spela ut fyra stolar) ---------------------------
// `turns` = auktionens bud i ordning; motståndarnas pass utelämnas. Sedan
// motorbytets etapp 5 (2026-09-11) byggs den genom att spela `decideCall` stol
// för stol tills budgivningen är slut — inget eget manus.

const PARTNER_OF: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }

export interface AuctionTurn {
  seat: Seat
  role: 'öppnare' | 'svarare' | 'motståndare'
  call: string
  rule: string
  explanation: string
  uncertain?: boolean
  /** Kravnivå (§2), härledd ur `rule` via regelregistret. Frivillig. */
  forcing?: Forcing
  /** Konstgjort/alertpliktigt bud, härlett ur `rule` via registret. Frivilligt. */
  alert?: boolean
}

export interface BuiltAuction {
  openerSeat: Seat
  responderSeat: Seat
  openCall: string
  turns: AuctionTurn[]
}

// (`pairControlsSideSuits` — kontroll-gaten som läste BÅDA händerna — togs bort
// 2026-07-07, ägarbeslutet "ärliga slamportar": ingen kontrollkoll, lita på
// poängen + nyckelkortssvaret. Bottarna kan därmed, som människor, någon gång
// bjuda en slam där motståndarna tar två snabba stick.)

// Bygger auktionen för given genom att spela ut fyra stolar ur beslutstabellen
// (samma `decideCall` som vid bordet), tills budgivningen är slut. Manuset
// (`buildAuctionCore` med konkurrensronden + `open`-flaggan) revs i motorbytets
// etapp 5 session B (2026-09-11): linjen byggdes redan ur tabellen, så en egen
// manusloop kunde aldrig ge något annat. `turns` = alla bud från öppningen t.o.m.
// sista icke-passet; motståndarnas pass utelämnas, öppnarsidans egna behålls.
//
// Minne per giv (R2-fynd #3): samma giv byggs om vid varje bot-tur och varje
// omritning i spelskärmen. En WeakMap på giv-objektet återanvänder resultatet.
const auctionCache = new WeakMap<Deal, BuiltAuction | null>()

export function buildAuction(deal: Deal): BuiltAuction | null {
  const cached = auctionCache.get(deal)
  if (cached !== undefined) return cached // OBS: null är ett giltigt cachat svar (ingen öppnar)
  const result = buildAuctionFromDecisions(deal)
  auctionCache.set(deal, result)
  return result
}

const CONTRACT = /^[1-7](C|D|H|S|NT)$/

function buildAuctionFromDecisions(deal: Deal): BuiltAuction | null {
  // Spela ut fyra stolar tills budgivningen är slut (samma beslut som vid bordet).
  const history: ResolvedCall[] = []
  let guard = 0
  while (!auctionComplete(history) && guard++ < 40) {
    history.push(decideCall(deal, history, seatAt(deal.dealer, history.length)))
  }
  // Öppningen = första kontraktsbudet. Passade given ut → ingen auktion.
  const openIdx = history.findIndex((c) => CONTRACT.test(c.bid))
  if (openIdx < 0) return null
  const openerSeat = history[openIdx].seat
  const responderSeat = PARTNER_OF[openerSeat]

  let lastNonPass = history.length - 1
  while (lastNonPass >= 0 && history[lastNonPass].bid === 'P') lastNonPass--

  const turns: AuctionTurn[] = []
  for (let i = openIdx; i <= lastNonPass; i++) {
    const c = history[i]
    const ourSide = side(c.seat) === side(openerSeat)
    if (c.bid === 'P' && !ourSide) continue // motståndarnas pass utelämnas; auktionen slutar vid sista icke-passet
    const role = c.seat === openerSeat ? 'öppnare' : c.seat === responderSeat ? 'svarare' : 'motståndare'
    turns.push({
      seat: c.seat,
      role,
      call: c.bid,
      rule: c.rule ?? '',
      explanation: c.explanation ?? '',
      forcing: forcingOf(c.rule ?? ''),
      alert: isAlertRule(c.rule),
    })
  }
  return { openerSeat, responderSeat, openCall: history[openIdx].bid, turns }
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
