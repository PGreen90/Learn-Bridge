// FÖRSVAR MOT DERAS SVAGA TVÅOR OCH SPÄRRAR + störning över VÅR svaga tvåa/spärr.
// Motorbytets etapp 4 familj 7 (2026-09-09). Kunskapsfunktioner för
// beslutstabellen (`auction-decide.ts`): EGEN hand + auktionsläget
// (`AuctionFacts`, läst ur auktionen ensam) → ett bud, eller null när regeln
// inte gäller läget. Ingen annan hand finns att läsa här.
//
// Bridgekunskapen bor kvar i sina moduler (`defense-conventional.ts`:
// `conventionalDefense`/`defendPreempt`; `contested-openings.ts`:
// `answerPreemptInterference`); det här är orkestreringen som förr låg i manuset
// (`auction.ts` §7.6-ronderna, direkt + balansering) och i detektorerna
// (`defendRaisedPreempt`, `ownPreemptInterferenceToAnswer`, `answerWeakTwoCue`).

import type { Bid, Hand, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { answerPreemptInterference } from './contested-openings'
import { conventionalDefense, defendPreempt } from './defense-conventional'
import { lengths } from './hand'
import { side } from './play'

// ============================================================================
// Vårt försvar mot deras svaga tvåa/spärr (raden *försvar-svag2*)
// ============================================================================

/**
 * Deras öppning en svag tvåa (2♦/2♥/2♠) eller spärr (3-läget+ i färg)? 2♣ är
 * stark/konstgjord och försvaras inte här (`conventionalDefense` returnerar
 * null för den). null = ingen svag tvåa/spärr.
 */
function theirPreemptOpening(f: AuctionFacts): { level: number; strain: string; suit: Suit } | null {
  const open = f.opening
  if (!open || f.weOpened || open.strain === 'NT') return null
  const isWeakTwo = open.level === 2 && open.strain !== 'C'
  const isPreempt = open.level >= 3
  if (!isWeakTwo && !isPreempt) return null
  return { level: open.level, strain: open.strain, suit: SUIT_OF_LETTER[open.strain] }
}

/**
 * Deras svaga tvåa/spärr-ÖPPNING och vår sidas FÖRSTA försvarsaktion (direkt
 * sits eller balansering), vår sida annars tyst. Analogt med `overcallSeat` /
 * `defendTheirNTSeat` men för en svag tvåa/spärr. Returnerar om det är
 * balansering (utpassningssitsen), annars null.
 */
export function defendTheirPreemptSeat(f: AuctionFacts): { balancing: boolean } | null {
  const open = theirPreemptOpening(f)
  if (!open) return null
  if (f.contractBids.length !== 1) return null // bara deras öppning hittills
  if (f.history.some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')) return null
  const after = f.history.slice(f.opening!.index + 1)
  const direct = after.length === 0
  const balancing = after.length === 2 && after.every((c) => c.bid === 'P')
  if (!direct && !balancing) return null
  return { balancing }
}

/**
 * Deras öppning + spärrHÖJNING till 3-läget (etapp 6 hål 4): 2♠–P–3♠ eller
 * 1♣–P–3♣, och vår sida har inte sagt ett ljud. Sitsen är direkt (höjningen är
 * senaste icke-pass) eller balansering (höjningen följd av exakt två pass →
 * "låna en kung"). Höjningar förbi 3-läget (2♠–P–4♠) lämnas medvetet tysta.
 * Porterad ur `raisedPreemptToDefend` (auction-live.ts).
 */
export function defendRaisedPreemptSeat(f: AuctionFacts): { suit: Suit; balancing: boolean } | null {
  const { history, seat } = f
  if (f.weOpened) return null
  // Vår sida har aldrig gjort något annat än pass.
  if (history.some((c) => side(c.seat) === side(seat) && c.bid !== 'P')) return null
  // Deras aktioner: exakt två kontraktsbud (öppning + höjning i samma färg av
  // partnern till 3-läget), inga X/XX.
  const theirs = history.filter((c) => c.bid !== 'P')
  if (theirs.length !== 2) return null
  const open = parseContractBid(theirs[0].bid)
  const raise = parseContractBid(theirs[1].bid)
  if (!open || !raise) return null
  if (theirs[1].seat !== PARTNER[theirs[0].seat]) return null
  const suit = SUIT_OF_LETTER[open.strain]
  if (!suit || open.strain !== raise.strain || raise.level !== 3) return null
  const after = history.slice(history.indexOf(theirs[1]) + 1)
  if (after.length !== 0 && after.length !== 2) return null
  return { suit, balancing: after.length === 2 }
}

/** Är `seat` i försvarssits över deras svaga tvåa/spärr — öppning ELLER spärrhöjning? */
export function defendPreemptSeat(f: AuctionFacts): boolean {
  return defendTheirPreemptSeat(f) !== null || defendRaisedPreemptSeat(f) !== null
}

/**
 * Vårt första försvar mot deras svaga tvåa/spärr (§7.6), ur EGEN hand. Öppningen
 * försvaras med `conventionalDefense` (takeout-X/2NT/cue/naturligt/3NT, golv per
 * sårbarhet och sits); en spärrhöjning med `defendPreempt(raised)`. "Låna en
 * kung" i balansering (utpassningssitsen). null (pass) när ingenting passar.
 */
export function defendTheirPreempt(hand: Hand, f: AuctionFacts, vulnerable: boolean): ResolvedCall | null {
  const asCall = (r: { call: string; rule: string; explanation: string }, extra = ''): ResolvedCall | null =>
    r.call === 'P' ? null : { seat: f.seat, bid: r.call as Bid, rule: r.rule, explanation: r.explanation + extra }

  const opening = defendTheirPreemptSeat(f)
  if (opening) {
    const def = conventionalDefense(hand, f.history[f.opening!.index].bid, { vulnerable, balancing: opening.balancing })
    if (!def) return null
    return asCall(def, opening.balancing && def.call !== 'P' ? ' (balansering)' : '')
  }

  const raised = defendRaisedPreemptSeat(f)
  if (raised) {
    const def = defendPreempt(hand, raised.suit, 3, raised.balancing, true)
    return asCall(def, raised.balancing && def.call !== 'P' ? ' (balansering – "låna en kung")' : '')
  }
  return null
}

// ============================================================================
// Fortsättningar i preempt-konkurrensen (raden *svag2-fortsättning*)
// ============================================================================

/**
 * Har PARTNERN cue-bjudit deras SVAGA TVÅA som en stark tvåfärgshand (§7.6 "cue
 * (stark tvåfärg)", 15+ 5-5), så att jag (advancern) måste ge preferens i
 * stället för att passa (felrapport #18)? Mönstret: deras svaga tvåa (2♦/2♥/2♠,
 * ej 2♣), partnerns bud = 3-i-deras-färg (cuet), vår sidas ENDA kontraktsbud och
 * senaste (bara pass efter). Porterad ur `partnerWeakTwoCueToAnswer`.
 */
function partnerWeakTwoCueSeat(f: AuctionFacts): { theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.level !== 2 || open.strain === 'C' || open.strain === 'NT') return null
  if (side(open.seat) === side(seat)) return null // motståndarnas svaga tvåa
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== PARTNER[seat]) return null
  const cue = ourBids[0]
  const cb = parseContractBid(cue.bid)!
  if (cb.level !== 3 || cb.strain !== open.strain) return null // cue = 3 i deras färg
  const cueIdx = history.indexOf(cue)
  if (history.slice(cueIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter
  return { theirStrain: open.strain }
}

/**
 * Advancern svarar partnerns TVÅFÄRGS-cue över deras svaga tvåa (felrapport
 * #18): ge preferens till längsta sidofärg (≠ deras), passa aldrig. Lika långa
 * färger avgörs av billigaste nivån. Porterad ur `answerWeakTwoCue`; väljer bara
 * bland lagliga bud (null om inget lagligt preferensbud finns).
 */
function answerWeakTwoCue(hand: Hand, f: AuctionFacts, theirStrain: string): ResolvedCall | null {
  const { history, seat } = f
  const len = lengths(hand)
  const sideStrains = SUIT_STRAINS.filter((st) => st !== theirStrain)
  const legal = legalCalls(history, seat)
  let best: string | null = null
  let bestBid: Bid | null = null
  for (const st of sideStrains) {
    const stBid = cheapestBidIn(history, seat, st)
    if (!stBid || !legal.includes(stBid)) continue
    const cb = parseContractBid(stBid)!
    const better =
      best === null ||
      len[SUIT_OF_LETTER[st]] > len[SUIT_OF_LETTER[best]] ||
      (len[SUIT_OF_LETTER[st]] === len[SUIT_OF_LETTER[best]] &&
        bidValue(cb.level, cb.strain) < bidValue(parseContractBid(bestBid!)!.level, parseContractBid(bestBid!)!.strain))
    if (better) {
      best = st
      bestBid = stBid
    }
  }
  if (bestBid && best) {
    return {
      seat, bid: bestBid, rule: 'svar på tvåfärgs-cue',
      explanation: `Partnerns cue lovar en stark tvåfärgshand (krav) – jag ger preferens till min längsta sidofärg ${SWE_SYM[best]} (${prettyBid(bestBid)}), passar aldrig cuet.`,
    }
  }
  return null
}

/**
 * Har motståndaren stört VÅR svaga tvåa/spärr, så att svararen ska svara?
 * Mönstret: vår öppning är en svag tvåa (2♦/2♥/2♠) eller spärr (3-läget+ i färg),
 * motståndarens störning (X / inkliv) är senaste icke-pass och vår sida har bara
 * bjudit öppningen. Porterad ur `ownPreemptInterferenceToAnswer`.
 */
function ownPreemptInterferenceSeat(f: AuctionFacts): { ourSuit: Suit; ourLevel: number; theirCall: string } | null {
  const { seat } = f
  const open = f.opening
  if (!open) return null
  const ourSuit = SUIT_OF_LETTER[open.strain]
  if (!ourSuit) return null // 1NT/2NT-öppning – hanteras inte här
  const isWeakTwo = open.level === 2 && open.strain !== 'C' // 2♣ = stark, ej svag tvåa
  const isPreempt = open.level >= 3
  if (!isWeakTwo && !isPreempt) return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  if (seat !== PARTNER[open.seat]) return null // seat = svararen (öppnarens partner)
  if (f.ourContractBids.length !== 1) return null // bara öppningen bjuden av oss
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  if (lastNonPass.bid === 'XX') return null // deras ev. XX besvaras inte här
  return { ourSuit, ourLevel: open.level, theirCall: lastNonPass.bid }
}

/** Vår sidas läge i preempt-konkurrensens fortsättningar (advancerns cue-svar / svararen efter störning). */
export function preemptFollowUpSeat(f: AuctionFacts): boolean {
  return partnerWeakTwoCueSeat(f) !== null || ownPreemptInterferenceSeat(f) !== null
}

/**
 * Fortsättningen i preempt-konkurrensen (raden *svag2-fortsättning*): advancern
 * svarar partnerns tvåfärgs-cue över deras svaga tvåa (krav, aldrig pass), och
 * svararen svarar på störning av VÅR svaga tvåa/spärr (XX värden / fortsatt
 * spärr). null → det gamla lagret (ett olagligt svar blir också null så att det
 * gamla lagret får pröva, precis som detektorernas `answered` gjorde).
 */
export function respondInPreemptCompetition(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const cue = partnerWeakTwoCueSeat(f)
  if (cue) return answerWeakTwoCue(hand, f, cue.theirStrain)

  const inter = ownPreemptInterferenceSeat(f)
  if (inter) {
    const r = answerPreemptInterference(hand, inter.ourSuit, inter.theirCall, inter.ourLevel)
    if (r.call === 'P') return { seat: f.seat, bid: 'P', rule: r.rule, explanation: r.explanation }
    const bid = r.call as Bid
    if (!legalCalls(f.history, f.seat).includes(bid)) return null // olagligt → gamla lagret
    return { seat: f.seat, bid, rule: r.rule, explanation: r.explanation }
  }
  return null
}
