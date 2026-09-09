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
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { answerNTInterference } from './contested-openings'
import { advanceDONT, dontOvercall } from './dont'
import { hcp, lengths } from './hand'
import { lebensohlAfter1NT, lebensohlAfter1NTRebid, naturalNTOvercall } from './lebensohl'
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

/** Motståndaren störde vårt 1NT med DONT/X och svararen ska svara (deras DONT-bud), annars null. */
function ntInterferenceToAnswer(f: AuctionFacts): string | null {
  const { seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null
  if (seat !== PARTNER[open.seat]) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  if (!['X', '2C', '2D', '2H', '2S'].includes(lastNonPass.bid)) return null
  return lastNonPass.bid
}

/** Öppnarens tur efter partnerns värde-X över deras 2-lägesstörning (DONT) av vårt 1NT? */
function ntValueDoubleOpenerToAnswer(f: AuctionFacts): { theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null
  let doubled: { level: number; strain: string; call: ResolvedCall } | null = null
  for (let i = history.length - 1; i >= 0; i--) {
    const cb = parseContractBid(history[i].bid)
    if (cb) { doubled = { level: cb.level, strain: cb.strain, call: history[i] }; break }
  }
  if (!doubled || side(doubled.call.seat) === side(seat) || doubled.level !== 2) return null
  if (!doubled.call.rule?.startsWith('DONT')) return null
  return { theirStrain: doubled.strain }
}

/** Öppnarens beskrivande svar på värde-X: 5-korts färg om den finns, annars 2NT. */
function answerNTValueDoubleOpener(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const ctx = ntValueDoubleOpenerToAnswer(f)
  if (!ctx) return null
  const len = lengths(hand)
  const theirSuit = SUIT_OF_LETTER[ctx.theirStrain]
  let five: Suit | null = null
  for (const s of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
    if (s !== theirSuit && len[s] >= 5) { five = s; break }
  }
  if (five) {
    const bid = cheapestBidIn(history, seat, letterOfSuit(five))
    if (bid) return { seat, bid, rule: 'öppnarens svar på värde-X', explanation: `5+ ${SWE_SYM[letterOfSuit(five)]} → ${prettyBid(bid)} (visar färgen; 2NT hade förnekat 5-kort).` }
  }
  const nt = '2NT' as Bid
  if (!legalCalls(history, seat).includes(nt)) return null
  return { seat, bid: nt, rule: 'öppnarens svar på värde-X', explanation: 'balanserad 15–17 utan 5+ färg → 2NT (förnekar 5+; partnern placerar: pass 8–10, 3NT 11+).' }
}

/** Dubblarens (svararens) tur efter att öppnaren beskrivit med 2NT/5-korts färg? */
function ntValueDoubleDoublerToAnswer(f: AuctionFacts): { openerBid: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat) || seat !== PARTNER[open.seat]) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  const myLastNonPass = [...history.filter((c) => c.seat === seat)].reverse().find((c) => c.bid !== 'P')
  if (!myLastNonPass || myLastNonPass.bid !== 'X') return null
  const openerBids = history.filter((c) => c.seat === open.seat && parseContractBid(c.bid))
  if (openerBids.length !== 2) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== open.seat) return null
  return { openerBid: openerBids[1].bid }
}

/** Svararen placerar efter öppnarens värde-X-svar (3NT 11+/pass; fit → höj). */
function answerNTValueDoubleDoubler(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const ctx = ntValueDoubleDoublerToAnswer(f)
  if (!ctx) return null
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const strong = p >= 11
  const openerCb = parseContractBid(ctx.openerBid as Bid)
  if (!openerCb) return null
  if (openerCb.strain !== 'NT') {
    const openerSuit = SUIT_OF_LETTER[openerCb.strain]
    const isMajor = openerSuit === 'hearts' || openerSuit === 'spades'
    if (isMajor && len[openerSuit] >= 3) {
      const bid = `${strong ? 4 : 3}${openerCb.strain}` as Bid
      if (legal.includes(bid)) return { seat, bid, rule: 'svar på öppnarens värde-X-fortsättning', explanation: `3+ stöd i ${SWE_SYM[openerCb.strain]} → ${prettyBid(bid)} (${strong ? 'utgång' : 'inbjudan'}).` }
    }
    if (strong && legal.includes('3NT' as Bid)) return { seat, bid: '3NT', rule: 'svar på öppnarens värde-X-fortsättning', explanation: `Utgångsvärden utan fit → 3NT.` }
    return { seat, bid: 'P', rule: 'pass', explanation: `Inget bättre → pass (${ctx.openerBid} står).` }
  }
  if (strong && legal.includes('3NT' as Bid)) return { seat, bid: '3NT', rule: 'placerar utgång efter öppnarens 2NT', explanation: `Utgångsvärden mitt emot öppnarens 15–17 → 3NT.` }
  return { seat, bid: 'P', rule: 'pass', explanation: `Minimum (8–10) → pass, 2NT står.` }
}

/** Motståndarens naturliga inkliv över VÅRT 1NT (färg + budarens plats), annars null. */
function naturalOvercallOf1NT(f: AuctionFacts): { suit: Suit; seat: Seat } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null
  const over = history.find((c) => c.rule === 'naturligt inkliv (1NT)' && side(c.seat) !== side(seat))
  if (!over) return null
  const m = /^2([CDHS])$/.exec(over.bid)
  if (!m) return null
  return { suit: SUIT_OF_LETTER[m[1]], seat: over.seat }
}

/** Svararens FÖRSTA Lebensohl-bud över deras naturliga inkliv. */
function lebensohl1NTFirstToAnswer(f: AuctionFacts): Suit | null {
  const { seat } = f
  const open = f.opening
  if (!open || seat !== PARTNER[open.seat]) return null
  const nat = naturalOvercallOf1NT(f)
  if (!nat) return null
  if (f.ourContractBids.length !== 1) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== nat.seat) return null
  return nat.suit
}

/** Öppnaren tvingas 3♣ över svararens 2NT-relä. */
function lebensohl1NTRelayComplete(f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.seat !== seat) return null
  if (!naturalOvercallOf1NT(f)) return null
  const partnerBids = history.filter((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (partnerBids.length === 0 || partnerBids[partnerBids.length - 1].bid !== '2NT') return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null
  if (!legalCalls(history, seat).includes('3C' as Bid)) return null
  return { seat, bid: '3C' as Bid, rule: 'Lebensohl 3♣ (tvunget relä-svar)', explanation: 'partnerns 2NT var Lebensohl-relä → jag måste bjuda 3♣.' }
}

/** Svararens rättelse efter öppnarens tvungna 3♣. */
function lebensohl1NTRebidToAnswer(f: AuctionFacts): Suit | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || seat !== PARTNER[open.seat]) return null
  const nat = naturalOvercallOf1NT(f)
  if (!nat) return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1 || ourBids[0].bid !== '2NT') return null
  const openerBids = history.filter((c) => c.seat === open.seat && parseContractBid(c.bid))
  if (openerBids[openerBids.length - 1]?.bid !== '3C') return null
  return nat.suit
}

/** Öppnarens fortsättning efter svararens DIREKTA 3-läges krav (GF), annars null. */
function lebensohl1NTGFToAnswer(f: AuctionFacts): Suit | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.seat !== seat) return null
  if (!naturalOvercallOf1NT(f)) return null
  const partnerBids = history.filter((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (partnerBids.length !== 1) return null
  const m = /^3([CDHS])$/.exec(partnerBids[0].bid)
  if (!m) return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null
  return SUIT_OF_LETTER[m[1]]
}

/** Öppnarens svar på Lebensohl-kravet (major-fit → utgång, annars 3NT). */
function lebensohl1NTOpenerAnswerGF(hand: Hand, gfSuit: Suit): { call: string; rule: string; explanation: string } {
  const len = lengths(hand)
  const isMajor = gfSuit === 'hearts' || gfSuit === 'spades'
  if (isMajor && len[gfSuit] >= 3) {
    return { call: `4${letterOfSuit(gfSuit)}`, rule: 'Lebensohl höjer krav till utgång', explanation: `Stöd i partnerns ${SWE_SYM[letterOfSuit(gfSuit)]} → 4${SWE_SYM[letterOfSuit(gfSuit)]}.` }
  }
  return { call: '3NT', rule: 'Lebensohl 3NT (öppnaren väljer utgång)', explanation: 'inget bättre än 3NT över partnerns krav.' }
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
  const asCall = (r: { call: string; rule: string; explanation: string }): ResolvedCall =>
    ({ seat: f.seat, bid: r.call as Bid, rule: r.rule, explanation: r.explanation })

  const runout = answerRunout(f)
  if (runout) return runout

  const leb1 = lebensohl1NTFirstToAnswer(f)
  if (leb1) return asCall(lebensohlAfter1NT(hand, leb1))

  const relay = lebensohl1NTRelayComplete(f)
  if (relay) return relay

  const lebRebid = lebensohl1NTRebidToAnswer(f)
  if (lebRebid) return asCall(lebensohlAfter1NTRebid(hand, lebRebid))

  const lebGF = lebensohl1NTGFToAnswer(f)
  if (lebGF) return asCall(lebensohl1NTOpenerAnswerGF(hand, lebGF))

  const inter = ntInterferenceToAnswer(f)
  if (inter) return asCall(answerNTInterference(hand, inter))

  return answerNTValueDoubleOpener(hand, f) ?? answerNTValueDoubleDoubler(hand, f)
}
