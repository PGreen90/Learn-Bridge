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

import type { Bid, Hand, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { answerPreemptInterference } from './contested-openings'
import { openerRebidAfterNewSuit, openerRebidAfterOgust, responderPlaceAfterOgust } from './responses-weak2'
import { conventionalDefense, defendPreempt } from './defense-conventional'
import { hcp, lengths } from './hand'
import { PUPPET, puppetAnswer } from './responses-2nt'
import { responderRebidIn2NTAuction } from './responder-rebids'
import { openerChoosesAfterSystemsOn } from './strong-2nt-systemson'
import type { ResponseResult } from './responses'
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
function ownPreemptInterferenceSeat(f: AuctionFacts): { ourSuit: Suit; ourLevel: number; theirCall: string; passedBefore: boolean } | null {
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
  const passedBefore = f.history.some((c, i) => i > open.index && c.seat === seat && c.bid === 'P')
  return { ourSuit, ourLevel: open.level, theirCall: lastNonPass.bid, passedBefore }
}

/**
 * Har PARTNERN cue-bjudit deras inklivsfärg över MIN svaga tvåa (felrapport #82:
 * 2♦–(2♠)–3♠–(P)–?)? Cuet är en stark höjning (limithöjning+, krav) och får
 * aldrig passas — förr fanns ingen rad, och öppnaren passade ut 3♠. Mönstret:
 * min svaga tvåa (2♦/2♥/2♠), exakt ett färginkliv av dem, partnerns bud = deras
 * färg (cue), bara pass efter.
 */
function ourWeakTwoCueSeat(f: AuctionFacts): { ourSuit: Suit; theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.level !== 2 || open.strain === 'C' || open.strain === 'NT' || open.seat !== seat) return null
  // Partnerns SENASTE kontraktsbud är cuet — oavsett om vi hunnit med Ogust
  // (2NT/3x) före deras inkliv (2♦–P–2NT–P–3♣–(3♠)–4♠, felrapport #82 forts.).
  const ours = f.ourContractBids
  const last = ours[ours.length - 1]
  if (ours.length < 2 || !last || last.seat !== PARTNER[seat]) return null
  const theirs = f.theirContractBids
  if (theirs.length !== 1) return null // exakt ett inkliv av dem
  const ov = parseContractBid(theirs[0].bid)
  const cue = parseContractBid(last.bid)
  if (!ov || !cue || ov.strain === 'NT' || cue.strain !== ov.strain) return null // partnerns bud = deras färg
  if (history.indexOf(theirs[0]) > history.indexOf(last)) return null // inklivet kom före cuet
  const cueIdx = history.indexOf(last)
  if (history.slice(cueIdx + 1).some((c) => c.bid !== 'P')) return null // bara pass efter cuet
  return { ourSuit: SUIT_OF_LETTER[open.strain]!, theirStrain: ov.strain }
}

/**
 * Öppnaren svarar partnerns cue-höjning över den egna svaga tvåan (felrapport
 * #82). Högfärg: 4M (partnerns cue lovar limithöjning+ → utgång, partnern går
 * vidare mot slam själv). Lågfärg: maximum (9–11 hp) med stopp i deras färg →
 * 3NT; annars (maximum utan stopp, eller minimum) → billigaste bud i egen färg
 * (4m) och partnern höjer med utgångsvärden (ägarbeslut 2026-09-25).
 * Aldrig pass. Bara lagliga bud (annars null → laglighetsvakten).
 */
function answerOurWeakTwoCue(hand: Hand, f: AuctionFacts, s: { ourSuit: Suit; theirStrain: string }): ResolvedCall | null {
  const { history, seat } = f
  const legal = legalCalls(history, seat)
  const strain = LETTER_OF_SUIT[s.ourSuit]
  const sym = SWE_SYM[strain]
  const deras = SWE_SYM[s.theirStrain]
  const p = hcp(hand)
  const max = p >= 9
  const pick = (bid: Bid, rule: string, explanation: string): ResolvedCall | null =>
    legal.includes(bid) ? { seat, bid, rule, explanation } : null
  if (s.ourSuit === 'hearts' || s.ourSuit === 'spades') {
    return pick(`4${strain}` as Bid, 'svar på cue (svag tvåa): utgång', `Partnerns cue i deras ${deras} är en stark höjning (krav) → 4${sym} (utgång; partnern går vidare mot slam med kontrollbud om hen vill).`)
  }
  if (max && hasStopperIn(hand, SUIT_OF_LETTER[s.theirStrain]!)) {
    const r = pick('3NT', 'svar på cue (svag tvåa): 3NT', `Partnerns cue i deras ${deras} är en stark höjning (krav): maximum (9–11 hp) med stopp i deras ${deras} → 3NT.`)
    if (r) return r
  }
  // Maximum UTAN stopp: 4m, inte 5m (ägarbeslut 2026-09-25: "låt partnern höja").
  const cheapest = cheapestBidIn(history, seat, strain)
  if (!cheapest) return null
  if (max) {
    return pick(cheapest, 'svar på cue (svag tvåa): minimum', `Partnerns cue i deras ${deras} är en stark höjning (krav): inget stopp i deras ${deras} för sang → ${prettyBid(cheapest)}, lägsta bud i egen färg. Partnern höjer med utgångsvärden.`)
  }
  return pick(cheapest, 'svar på cue (svag tvåa): minimum', `Partnerns cue i deras ${deras} är en stark höjning (krav): minimum (6–8 hp) → ${prettyBid(cheapest)}, lägsta bud i egen färg. Partnern får passa.`)
}

/**
 * SYSTEMS ON efter vår svaga tvåa + deras färginkliv (ägarens struktur
 * 2026-09-25): Ogust 2NT och ny färg spelas som ostört, fast raderna återbud
 * och svar2 kräver tyst motstånd. Läget: vår svaga tvåa (2♦/2♥/2♠), exakt ett
 * färginkliv av dem (ingen X), och partnerns senaste bud är det som ska besvaras
 * (bara pass efter). Tre fall: öppnaren svarar Ogust · öppnaren svarar partnerns
 * nya färg · svararen placerar efter öppnarens Ogust-svar.
 */
function ourWeakTwoSystemsOnSeat(f: AuctionFacts): { kind: 'ogust' | 'nyfärg' | 'placering' | 'x-svar' | 'x-passa'; ourSuit: Suit; theirStrain?: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.level !== 2 || open.strain === 'C' || open.strain === 'NT' || side(open.seat) !== side(seat)) return null
  const theirs = f.theirContractBids
  if (theirs.length !== 1) return null
  const ov = parseContractBid(theirs[0].bid)
  if (!ov || ov.strain === 'NT') return null
  if (history.some((c) => side(c.seat) !== side(seat) && (c.bid === 'X' || c.bid === 'XX'))) return null
  const ours = f.ourContractBids
  // Partnerns upplysningsdubbling av deras 2-lägesinkliv (ägarbeslut 2026-09-25):
  // jag (öppnaren) bjuder min längsta av de två objudna färgerna.
  if (seat === open.seat && ours.length === 1 && ov.level === 2 && f.lastNonPass?.seat === PARTNER[seat] && f.lastNonPass.bid === 'X') {
    return { kind: 'x-svar', ourSuit: SUIT_OF_LETTER[open.strain]!, theirStrain: ov.strain }
  }
  // Dubblaren efter öppnarens svar på upplysningsdubblingen: svaret är ej krav → pass
  // (annars hittade catch-allen på en höjning till utgång på 10 hp).
  const myX = history.find((c) => c.seat === seat && c.bid === 'X')
  if (seat === PARTNER[open.seat] && ours.length === 2 && ov.level === 2 && myX && history.indexOf(myX) > history.indexOf(theirs[0]) &&
      ours[1].seat === open.seat && f.lastNonPass === ours[1] && history.indexOf(ours[1]) > history.indexOf(myX)) {
    return { kind: 'x-passa', ourSuit: SUIT_OF_LETTER[open.strain]! }
  }
  const last = ours[ours.length - 1]
  if (!last || last.seat !== PARTNER[seat]) return null
  if (history.slice(history.indexOf(last) + 1).some((c) => c.bid !== 'P')) return null // bara pass efter
  const ourSuit = SUIT_OF_LETTER[open.strain]!
  const lastCb = parseContractBid(last.bid)!
  if (seat === open.seat && ours.length === 2) {
    if (last.bid === '2NT') return { kind: 'ogust', ourSuit }
    if (lastCb.strain !== 'NT' && lastCb.strain !== open.strain && lastCb.strain !== ov.strain) return { kind: 'nyfärg', ourSuit }
    return null
  }
  if (seat === PARTNER[open.seat] && ours.length === 3 && ours[1].seat === seat && ours[1].bid === '2NT' && lastCb.level === 3) {
    return { kind: 'placering', ourSuit }
  }
  return null
}

const OGUST_RULE: Record<string, string> = {
  '3C': 'Ogust: min/dålig', '3D': 'Ogust: min/bra', '3H': 'Ogust: max/dålig', '3S': 'Ogust: max/bra', '3NT': 'Ogust: max/utmärkt',
}

function answerOurWeakTwoSystemsOn(hand: Hand, f: AuctionFacts, s: { kind: 'ogust' | 'nyfärg' | 'placering' | 'x-svar' | 'x-passa'; ourSuit: Suit; theirStrain?: string }): ResolvedCall | null {
  const { history, seat } = f
  const legal = legalCalls(history, seat)
  if (s.kind === 'x-svar') {
    // Längsta av de två objudna färgerna; lika → den som kan bjudas billigast.
    const len = lengths(hand)
    const unbid: string[] = SUIT_STRAINS.filter((st) => st !== LETTER_OF_SUIT[s.ourSuit] && st !== s.theirStrain)
    const cands: { st: string; bid: Bid; n: number }[] = []
    for (const st of unbid) {
      const bid = cheapestBidIn(history, seat, st)
      if (bid && legal.includes(bid)) cands.push({ st, bid, n: len[SUIT_OF_LETTER[st]!] })
    }
    cands.sort((a, b) => b.n - a.n || bidValue(parseContractBid(a.bid)!.level, a.st) - bidValue(parseContractBid(b.bid)!.level, b.st))
    const c = cands[0]
    if (!c) return null
    return { seat, bid: c.bid, rule: 'svar på negativ dubbling', explanation: `Partnerns upplysningsdubbling bad om min längsta av de objudna färgerna → ${prettyBid(c.bid)} (${c.n} kort i ${SWE_SYM[c.st]}). Ej krav.` }
  }
  if (s.kind === 'x-passa') {
    return { seat, bid: 'P', rule: 'pass', explanation: 'Partnern svarade på min upplysningsdubbling med sin längsta färg (ej krav) — jag passar.' }
  }
  const last = f.ourContractBids[f.ourContractBids.length - 1]
  let r: ResponseResult | null = null
  if (s.kind === 'ogust') r = openerRebidAfterOgust(hand, s.ourSuit)
  else if (s.kind === 'nyfärg') {
    const cb = parseContractBid(last.bid)!
    r = openerRebidAfterNewSuit(hand, s.ourSuit, SUIT_OF_LETTER[cb.strain]!, cb.level)
  } else {
    const rule = OGUST_RULE[last.bid]
    if (!rule) return null
    r = responderPlaceAfterOgust(hand, s.ourSuit, { call: last.bid, rule, explanation: '' })
  }
  if (!r) return null
  if (r.call !== 'P' && !legal.includes(r.call as Bid)) return null // olagligt → vakterna
  return { seat, bid: r.call as Bid, rule: r.rule, explanation: r.explanation + ' (systems on över deras inkliv)' }
}

/** Vår sidas läge i preempt-konkurrensens fortsättningar (advancerns cue-svar / svararen efter störning / öppnarens svar på partnerns cue / systems on). */
export function preemptFollowUpSeat(f: AuctionFacts): boolean {
  return partnerWeakTwoCueSeat(f) !== null || ownPreemptInterferenceSeat(f) !== null || ourWeakTwoCueSeat(f) !== null || ourWeakTwoSystemsOnSeat(f) !== null
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

  const ourCue = ourWeakTwoCueSeat(f)
  if (ourCue) return answerOurWeakTwoCue(hand, f, ourCue)

  const systemsOn = ourWeakTwoSystemsOnSeat(f)
  if (systemsOn) return answerOurWeakTwoSystemsOn(hand, f, systemsOn)

  const inter = ownPreemptInterferenceSeat(f)
  if (inter) {
    const r = answerPreemptInterference(hand, inter.ourSuit, inter.theirCall, inter.ourLevel, inter.passedBefore)
    if (r.call === 'P') return { seat: f.seat, bid: 'P', rule: r.rule, explanation: r.explanation }
    const bid = r.call as Bid
    if (!legalCalls(f.history, f.seat).includes(bid)) return null // olagligt → gamla lagret
    return { seat: f.seat, bid, rule: r.rule, explanation: r.explanation }
  }
  return null
}

// ============================================================================
// Systems on efter VÅRT naturliga 2NT-inkliv över deras svaga tvåa/spärr
// (raden *svag2-2nt-systemson*, live-prov 2026-09-11). Advancern svarar som
// över en 2NT-öppning men med uppskjutna poängtrösklar (inklivet är 15–18, inte
// 20–21): 3♦→hjärter / 3♥→spader (transfers), 3NT till spel, pass svag.
// Inklivaren fullföljer transfern (super-accept 4M med 17–18 + 3-korts stöd,
// annars 3M), och advancern bjuder om (pass svag / 3NT med stopp i deras färg /
// 4M med 6-korts högfärg). Förr föll advancerns 3♦ till "naturlig ny färg".
// ============================================================================

/** 3♦ visar hjärter, 3♥ visar spader (transferns målfärg). */
const TRANSFER_TARGET: Record<string, { suit: Suit; letter: string }> = {
  D: { suit: 'hearts', letter: 'H' },
  H: { suit: 'spades', letter: 'S' },
}

/** Har handen ett stopp i `suit` (A / Kx / Qxx / Jxxx)? */
function hasStopperIn(hand: Hand, suit: Suit): boolean {
  const cards = hand.filter((c) => c.suit === suit)
  const has = (r: Rank) => cards.some((c) => c.rank === r)
  const n = cards.length
  return has('A') || (has('K') && n >= 2) || (has('Q') && n >= 3) || (has('J') && n >= 4)
}

/** Vår sidas DIREKTA naturliga 2NT-inkliv (15–18) över deras svaga tvåa/spärr,
 *  ostört. Bara det direkta inklivet (2NT direkt efter deras öppning) — det
 *  balanserande 2NT:t (12–15, "lånad kung") har lägre styrka och andra trösklar,
 *  så systems-on gäller det inte (ägarspecen var 15–18). Returnerar inklivarens
 *  stol, annars null. */
function ourNTOvercallOfPreempt(f: AuctionFacts): Seat | null {
  const open = theirPreemptOpening(f)
  if (!open) return null
  if (f.history.some((c) => c.bid === 'X' || c.bid === 'XX')) return null
  if (f.theirContractBids.length !== 1) return null // bara deras öppning
  const ours = f.ourContractBids
  if (ours.length < 1 || ours[0].bid !== '2NT') return null
  if (f.history.indexOf(ours[0]) !== f.opening!.index + 1) return null // direkt, ej balansering
  return ours[0].seat
}

/**
 * Fasen i systems-on efter vårt 2NT-inkliv, sett från `f.seat`:
 *  'advance'  – advancern svarar på 2NT-inklivet;
 *  'complete' – inklivaren fullföljer advancerns transfer (3♦/3♥);
 *  'rebid'    – advancern bjuder om efter inklivarens enkla fullföljning (3♥/3♠).
 * Allt ostört. null = ingen.
 */
export function overcallNTSystemsOnSeat(f: AuctionFacts): 'advance' | 'complete' | 'rebid' | 'choose' | null {
  const overcaller = ourNTOvercallOfPreempt(f)
  if (overcaller === null) return null
  const advancer = PARTNER[overcaller]
  const ours = f.ourContractBids
  if (ours.length === 1 && f.seat === advancer && f.lastNonPass === ours[0]) return 'advance'
  const puppet = ours.length >= 2 && ours[1].seat === advancer && ours[1].bid === '3C'
  if (ours.length === 2 && f.seat === overcaller && ours[1].seat === advancer && f.lastNonPass === ours[1]) {
    if (puppet) return 'complete'
    const t = parseContractBid(ours[1].bid)
    return t && t.level === 3 && (t.strain === 'D' || t.strain === 'H') ? 'complete' : null
  }
  if (ours.length === 3 && f.seat === advancer && ours[2].seat === overcaller && f.lastNonPass === ours[2]) {
    if (puppet) return /^3(D|H|S|NT)$/.test(ours[2].bid) ? 'rebid' : null
    const c = parseContractBid(ours[2].bid)
    return c && c.level === 3 && (c.strain === 'H' || c.strain === 'S') ? 'rebid' : null
  }
  if (puppet && ours.length === 4 && f.seat === overcaller && ours[3].seat === advancer && f.lastNonPass === ours[3]) return 'choose'
  return null
}

/** Svararens Puppet-placering läst ur BUDET (aldrig ur handen). */
function puppetPlacementRule(bid: string): string | null {
  switch (bid) {
    case '3H': return PUPPET.fourSpades
    case '3S': return PUPPET.fourHearts
    case '4D': return PUPPET.both
    case '4C': return PUPPET.bothSlam
    default: return null
  }
}

/** Advancern räknar mot inklivets 15–18 som mot 16: utgång från 9 hp (ägarspec 2026-09-11). */
const OVERCALL_NT_MIN = 16

/**
 * Systems-on-budet efter vårt 2NT-inkliv, ur EGEN hand + auktionsläget. null när
 * regeln inte ger ett bud (svag advancer passar; olagligt → gamla lagret).
 * Puppet Stayman (ägarbeslut 2026-09-15, beslut 7): 3♣ som över en 2NT-öppning,
 * med samma svar och fortsättning (`responderRebidIn2NTAuction` /
 * `openerChoosesAfterSystemsOn`) — trösklarna mot 15–18 i stället för 20–21.
 * Transfer-grenen är ägarspecen från 2026-09-11 (super-accept, 3NT-inbjudan).
 */
export function respondToOvercallNTSystemsOn(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const phase = overcallNTSystemsOnSeat(f)
  if (!phase) return null
  const legal = legalCalls(f.history, f.seat)
  const mk = (bid: string, rule: string, explanation: string): ResolvedCall | null =>
    legal.includes(bid as Bid) ? { seat: f.seat, bid: bid as Bid, rule, explanation } : null
  const len = lengths(hand)
  const ours = f.ourContractBids
  const puppetAsk: ResponseResult = { call: '3C', rule: PUPPET.ask, explanation: '' }

  if (phase === 'advance') {
    if (len.hearts >= 5 && len.hearts >= len.spades)
      return mk('3D', '2NT-inkliv: transfer', 'Transfer till hjärter (5+ ♥) – systems on över partnerns 2NT-inkliv.')
    if (len.spades >= 5)
      return mk('3H', '2NT-inkliv: transfer', 'Transfer till spader (5+ ♠) – systems on över partnerns 2NT-inkliv.')
    if (hcp(hand) >= 25 - OVERCALL_NT_MIN && (len.spades >= 3 || len.hearts >= 3))
      return mk('3C', PUPPET.ask, 'Utgångsvärden mot 15–18 och minst en 3-korts högfärg → 3♣ (Puppet Stayman: frågar efter partnerns 5-korts högfärg, i andra hand en 4-korts).')
    if (hcp(hand) >= 25 - OVERCALL_NT_MIN)
      return mk('3NT', '2NT-inkliv: till spel', 'Till spel: 9+ hp balanserad utan 3-korts högfärg mittemot partnerns 15–18.')
    return null // för svag → pass
  }

  if (phase === 'complete') {
    if (ours[1].bid === '3C') {
      const a = puppetAnswer(hand)
      return mk(a.call, a.rule, a.explanation)
    }
    const t = parseContractBid(ours[1].bid)!
    const tgt = TRANSFER_TARGET[t.strain]
    if (!tgt) return null
    if (hcp(hand) >= 17 && len[tgt.suit] >= 3)
      return mk(`4${tgt.letter}`, '2NT-inkliv: super-accept', `Maximum (17–18) med 3-korts stöd i ${SWE_SYM[tgt.letter]} → hopp till utgång (super-accept).`)
    return mk(`3${tgt.letter}`, '2NT-inkliv: fullföljd transfer', `Fullföljer transfern till ${SWE_SYM[tgt.letter]}.`)
  }

  if (phase === 'rebid' && ours[1].bid === '3C') {
    const answer: ResponseResult = { call: ours[2].bid, rule: ours[2].bid === '3NT' ? PUPPET.answerNone : PUPPET.answer, explanation: '' }
    // Inga färgslamvägar över inklivet (motståndarna har öppnat — slamraden gäller ostört): bara kvantitativt 4NT.
    const r = responderRebidIn2NTAuction(puppetAsk, answer, hand, OVERCALL_NT_MIN, false)
    if (!r) return null
    if (r.call === 'P') return { seat: f.seat, bid: 'P', rule: r.rule, explanation: r.explanation }
    return mk(r.call, r.rule, r.explanation)
  }

  if (phase === 'choose') {
    const rule = puppetPlacementRule(ours[3].bid)
    if (!rule) return null
    const c = openerChoosesAfterSystemsOn(hand, puppetAsk, { call: ours[3].bid, rule, explanation: '' }, 18)
    if (!c) return null
    if (c.call === 'P') return { seat: f.seat, bid: 'P', rule: c.rule, explanation: c.explanation }
    return mk(c.call, c.rule, c.explanation)
  }

  // rebid efter enkel fullföljning (3♥/3♠)
  const compl = parseContractBid(ours[2].bid)!
  const major: Suit = compl.strain === 'H' ? 'hearts' : 'spades'
  const theirSuit = theirPreemptOpening(f)?.suit
  if (len[major] >= 6)
    return mk(`4${compl.strain}`, '2NT-inkliv: utgång', `6+ ${SWE_SYM[compl.strain]} → utgång 4${SWE_SYM[compl.strain]}.`)
  if (hcp(hand) >= 9 && theirSuit && hasStopperIn(hand, theirSuit))
    return mk('3NT', '2NT-inkliv: inbjudan', `Inbjudan med stopp i deras ${SWE_SYM[LETTER_OF_SUIT[theirSuit]]} → 3NT; partnern väljer 3NT eller utgång i högfärgen.`)
  // Svag → stanna i utgångsfärgen (explicit pass; annars höjer en catch-all fiten).
  return { seat: f.seat, bid: 'P', rule: '2NT-inkliv: stannar', explanation: `Minimum efter transfern → stannar i 3${SWE_SYM[compl.strain]}.` }
}

const LETTER_OF_SUIT: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
