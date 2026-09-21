// FÖRSVAR MOT 1NT — DONT, naturligt inkliv, Lebensohl, värde-X och flykt.
// Motorbytets etapp 4 familj 6 (2026-09-09). Kunskapsfunktioner för
// beslutstabellen (`auction-decide.ts`): EGEN hand + auktionsläget
// (`AuctionFacts`, läst ur auktionen ensam) → ett bud, eller null när regeln
// inte gäller läget. Ingen annan hand finns att läsa här.
//
// Bridgekunskapen bor kvar i sina moduler (`dont.ts`, `lebensohl.ts`,
// `contested-openings.ts`); det här är orkestreringen som förr låg i manuset
// (`auction.ts` 1NT-försvarsronden) och i konkurrensdetektorerna
// (`partnerDONTToAnswer`, `ownDONT*`, `lebensohl1NT*`, `answerNTValueDouble*`,
// `answerRunout`, `ntInterferenceToAnswer`).

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { isGameOrHigher, parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { advanceDONT, dontOvercall } from './dont'
import { hcp, lengths } from './hand'
import { naturalNTOvercall } from './lebensohl'
import { systemsOnAfterOur1NT } from './nt-systems-on'
import { stordOverforing } from './nt-transfer-stord'
import { side } from './play'

// ============================================================================
// Vårt försvar mot deras 1NT (raden *försvar-1nt*) + advancern (*dont-advance*)
// ============================================================================

/**
 * Deras 1NT-ÖPPNING och vår sidas FÖRSTA försvarsaktion (direkt sits eller
 * balansering), vår sida annars tyst. Analogt med `overcallSeat` men för en
 * 1NT-öppning. Returnerar om det är balansering (utpassningssitsen), annars null.
 */
export function defendTheirNTSeat(f: AuctionFacts): { balancing: boolean } | null {
  const open = f.opening
  if (!open || f.weOpened || open.strain !== 'NT' || open.level !== 1) return null
  if (f.contractBids.length !== 1) return null // bara deras 1NT hittills
  if (f.history.some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')) return null
  const after = f.history.slice(open.index + 1)
  const direct = after.length === 0
  const balancing = after.length === 2 && after.every((c) => c.bid === 'P')
  if (!direct && !balancing) return null
  return { balancing }
}

/**
 * Vårt första försvar mot deras 1NT (§7.5). Direkt sits: naturligt inkliv (6+,
 * 11–15) först, annars DONT från 8 hp (rätt form). Balansering (utpassningssits):
 * DONT från 6 hp ("låna en kung"). Ordagrant manusets 1NT-försvarsrond, nu ur
 * EGEN hand. null (pass) när ingenting passar.
 */
export function defendTheirNT(hand: Hand, seat: Seat, balancing: boolean): ResolvedCall | null {
  const asCall = (r: { call: string; rule: string; explanation: string }, extra = ''): ResolvedCall | null =>
    r.call === 'P' ? null : { seat, bid: r.call as Bid, rule: r.rule, explanation: r.explanation + extra }
  if (!balancing) {
    // Direkt sits: naturligt inkliv före DONT (en stark enfärgshand bjuds
    // naturellt så partnern kan spela Lebensohl).
    const nat = naturalNTOvercall(hand)
    if (nat.call !== 'P') return asCall(nat)
    if (hcp(hand) >= 8) return asCall(dontOvercall(hand))
    return null
  }
  // Balansering: DONT med lättare golv (6 hp).
  if (hcp(hand) >= 6) return asCall(dontOvercall(hand), ' (balansering)')
  return null
}

/** Är detta vår sidas läge EFTER ett DONT-/naturligt försvar mot deras 1NT (någon på vår sida har bjudit)? */
export function ntDefenseFollowUpSeat(f: AuctionFacts): boolean {
  const open = f.opening
  if (!open || f.weOpened || open.strain !== 'NT' || open.level !== 1) return false
  return f.history.some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')
}

/** Advancern svarar på partnerns DONT-bud (§7.5) — porterad `partnerDONTToAnswer` + `advanceDONT`. */
export function advancePartnerDONT(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  if (!['X', '2C', '2D', '2H', '2S'].includes(lastNonPass.bid)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 1 || ourActions[0] !== lastNonPass) return null
  const r = advanceDONT(hand, lastNonPass.bid)
  return r.call === 'P'
    ? { seat, bid: 'P', rule: r.rule, explanation: r.explanation }
    : { seat, bid: r.call as Bid, rule: r.rule, explanation: r.explanation }
}

/** Vår egen DONT-X (enfärg) rättas efter partnerns 2♣-relä — porterad `ownDONTXToCorrect`. */
export function correctOwnDONTX(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 2) return null
  if (ourActions[0].seat !== seat || ourActions[0].bid !== 'X') return null
  if (ourActions[1].seat !== PARTNER[seat] || ourActions[1].bid !== '2C') return null
  const idx = history.indexOf(ourActions[1])
  if (!history.slice(idx + 1).every((c) => c.bid === 'P')) return null

  const len = lengths(hand)
  const suit = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st]).find((s) => len[s] >= 6)
  if (!suit || suit === 'clubs') {
    return { seat, bid: 'P', rule: 'DONT: pass (klöver)', explanation: 'min DONT-enfärg är ♣ → passa partnerns 2♣-relä.' }
  }
  const bid = cheapestBidIn(history, seat, letterOfSuit(suit))
  if (!bid) return null
  return {
    seat, bid, rule: 'DONT: rättelse',
    explanation: `min DONT-enfärg är ${SWE_SYM[letterOfSuit(suit)]} (6+) → rättar partnerns 2♣-relä till ${prettyBid(bid)}.`,
  }
}

/** Vårt DONT-tvåfärgsbud (2♣/2♦) rättas till den högre färgen efter partnerns relä — porterad `ownDONTTwoSuiterToCorrect`. */
export function correctOwnDONTTwoSuiter(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 2) return null
  const [mine, relay] = ourActions
  if (mine.seat !== seat) return null
  const relayFor: Record<string, string> = { '2C': '2D', '2D': '2H' }
  const expectRelay = relayFor[mine.bid]
  if (!expectRelay || relay.seat !== PARTNER[seat] || relay.bid !== expectRelay) return null
  const idx = history.indexOf(relay)
  if (!history.slice(idx + 1).every((c) => c.bid === 'P')) return null

  const len = lengths(hand)
  const twoLongest = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st])
    .sort((a, b) => len[b] - len[a] || SUIT_STRAINS.indexOf(letterOfSuit(b)) - SUIT_STRAINS.indexOf(letterOfSuit(a)))
    .slice(0, 2)
  const higher = SUIT_STRAINS.indexOf(letterOfSuit(twoLongest[0])) > SUIT_STRAINS.indexOf(letterOfSuit(twoLongest[1]))
    ? twoLongest[0]
    : twoLongest[1]
  const bid = cheapestBidIn(history, seat, letterOfSuit(higher))
  if (!bid) return null
  return {
    seat, bid, rule: 'DONT: rättelse (tvåfärg)',
    explanation: `partnern relä:ade (${prettyBid(relay.bid)}) → visar min högre färg ${SWE_SYM[letterOfSuit(higher)]} → ${prettyBid(bid)}.`,
  }
}

// ============================================================================
// STÖRNING ÖVER VÅRT 1NT — Lebensohl, värde-X och flykt (raden *vårt-1nt-stört*)
// Porterade ur detektorerna; kunskapshandlarna (answerNTInterference,
// lebensohlAfter1NT/Rebid) bor kvar i sina moduler.
// ============================================================================

/** Vår sidas läge när VÅRT 1NT har störts (motståndaren har bjudit eller dubblat). */
export function ourNTContestedSeat(f: AuctionFacts): boolean {
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || !f.weOpened) return false
  return f.history.some((c) => side(c.seat) !== side(f.seat) && c.bid !== 'P')
}

/** Deras FÄRGflykt efter vårt 1NT + partnerns värde-XX (vi äger handen), annars null. */
function runoutAfterOurRedouble(f: AuctionFacts): { suit: Suit; level: number } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null
  if (!history.some((c) => side(c.seat) === side(seat) && c.bid === 'XX')) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  const cb = parseContractBid(lastNonPass.bid)
  if (!cb || cb.strain === 'NT') return null
  if (!legalCalls(history, seat).includes('X')) return null
  return { suit: SUIT_OF_LETTER[cb.strain], level: cb.level }
}

/** Straffdubbla motståndarnas flykt efter vår XX (vi äger handen). */
function answerRunout(f: AuctionFacts): ResolvedCall | null {
  const { seat } = f
  const runout = runoutAfterOurRedouble(f)
  if (!runout) return null
  return {
    seat, bid: 'X', rule: 'straffdubbling (vi äger handen)',
    explanation: `Vi öppnade 1NT och partnern redubblade (XX) – vår sida har 23+ och äger handen. Motståndarna flyr till ${runout.level}${SWE_SYM[letterOfSuit(runout.suit)]} → straffdubbling.`,
  }
}

/**
 * Svararens/öppnarens svar när VÅRT 1NT störts (raden *vårt-1nt-stört*). Ordningen
 * är detektorkedjans: flykt-straffet först, sedan Lebensohl-stegen, ntInterference
 * (DONT-svaret), och värde-X-flödet sist. null → det gamla lagret.
 */
export function respondToOurNTInterference(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const runout = answerRunout(f)
  if (runout) return runout

  // Ägarens struktur 2026-09-18 (felrapport #77): systems on + stulet bud mot ALLA
  // inkliv i direkt sits — ersatte Lebensohl-stegen, DONT-svaret och värde-X-flödet.
  // Fjärde hand bjuder en färg efter svararens överföring (ägarens regler
  // 2026-09-20, tävlingsbricka 5) — gäller även när 1NT självt var ostört.
  return stordOverforing(hand, f) ?? systemsOnAfterOur1NT(hand, f)
}

/**
 * DONT-dubblarens EGEN fortsättning när partnerns relä uteblev (motorbytets
 * slutförande 2026-09-13, facit-kön frö 20272187): jag dubblade deras 1NT
 * (enfärg, 6+), RHO bjöd en färg över X:et så partnern inte kunde relä:a 2♣,
 * partnern passade — nu visar jag färgen själv. På 2-läget alltid (det är
 * exakt vad X:et lovade); på 3-läget bara med substans (12+ hp eller 7+ kort).
 * Läget: vår sidas enda aktion är mitt X, deras senaste färgbud (under utgång)
 * är senaste icke-pass. null → pass.
 */
export function dontDoublerShowsSuit(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 1 || ourActions[0].seat !== seat || ourActions[0].bid !== 'X') return null
  const xIdx = history.indexOf(ourActions[0])
  if (!history.slice(xIdx + 1).some((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid))) return null
  const last = f.lastNonPass
  if (!last || side(last.seat) === side(seat) || !parseContractBid(last.bid)) return null
  if (isGameOrHigher(last.bid as Bid)) return null
  const len = lengths(hand)
  const suit = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st]).find((s) => len[s] >= 6)
  if (!suit) return null
  const bid = cheapestBidIn(history, seat, letterOfSuit(suit))
  if (!bid || !legalCalls(history, seat).includes(bid)) return null
  const level = parseContractBid(bid)!.level
  if (level > 3) return null
  if (level === 3 && hcp(hand) < 12 && len[suit] < 7) return null
  const sym = SWE_SYM[letterOfSuit(suit)]
  return {
    seat, bid, rule: 'DONT: visar enfärgen själv',
    explanation: level === 2
      ? `Partnern kunde inte relä:a 2♣ (de bjöd över min dubbling) → visar min DONT-enfärg ${sym} (6+) själv: ${prettyBid(bid)} (till spel, ej krav).`
      : `Partnern kunde inte relä:a 2♣ (de bjöd över min dubbling) → visar min DONT-enfärg ${sym} (6+) på 3-läget: ${prettyBid(bid)} — lovar substans (12+ hp eller 7+ kort), ej krav.`,
  }
}
