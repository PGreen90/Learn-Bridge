// RKC-FRÅGARENS PLACERING — seat-agnostiskt (live-prov etapp 6, 2026-09-12).
//
// Slammodulen (`slam-auction.ts`) modellerar KAPTENEN som svararen: hela
// `slamTurn`-maskineriet antar att den som frågar 4NT RKC är öppnarens partner.
// När ÖPPNAREN själv driver slammen — den starka 2♣-öppnaren som visat sin färg
// och fått en höjning (Bricka 14: 2♣–2♦–2♠–4♠–4NT–5♦) — matchar ingen slamrad,
// och läget föll till catch-all PASS. 5♥ lästes då naturligt ("utgång i
// hjärter"), fast det är trumfdam-frågan.
//
// Här ligger frågarens placering som en funktion av EN hand + auktionen (ingen
// annan hand läses — samma ärliga mönster som `answerRKC` i
// `slam-answer-continuations.ts`), och den gäller OAVSETT vilken stol som
// frågade. Tre bitar:
//
//   1. FRÅGAREN placerar efter nyckelkortssvaret (5♣/5♦): saknas exakt ett
//      nyckelkort men trumfdamen är INTE säkrad (inte hållen, inte bevisad
//      10-korts fit, inte visad via 5♠-svaret) → bjud damfrågan (billigaste
//      icke-trumf över svaret). Är damen säkrad → 6-trumf; saknas två+
//      nyckelkort → 5-trumf/pass.
//   2. SVARAREN besvarar damfrågan (`respondToQueenAsk`, §6.1): dam nekas med
//      5-trumf, annars visas billigaste sidokung / 5NT.
//   3. FRÅGAREN placerar efter damsvaret: dam nekad → utgång står (pass/5-trumf);
//      dam visad → lillslam 6-trumf.
//
// AVGRÄNSNING (medvetet): den här vägen bjuder aldrig storslam — den starka
// handen tar lillslammen när ett nyckelkort saknas, och damfrågan avgör bara
// utgång-mot-lillslam. Storslam via öppnaren-som-kapten är en SENARE-kandidat
// (docs/bevaka.md). Den tvetydiga 1-eller-4/0-eller-3-räkningen backas ändå upp
// av svararens rättelse över stoppbudet (`rkcCorrection`), som redan är
// seat-agnostisk.

import type { Hand, Suit } from '../../types/bridge'
import { auctionFacts, parseContractBid, PARTNER, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { bidValue, letterOfSuit, SWE_SYM } from './auction-rules'
import { lengths } from './hand'
import { side } from './play'
import { keycards, queenAskBid, respondToQueenAsk, slamValEfterSvar } from './slam'
import { partnerShownTrumpLength, slamAskTrump, slamAskTrumpAtAnswer } from './slam-answer-continuations'
import type { Kunskap } from './overcall-continuations'

/** Budets rang (1♣=… ; pass/X/XX = -1) för lagligt-jämförelser. */
function rank(bid: string): number {
  const cb = parseContractBid(bid)
  return cb ? bidValue(cb.level, cb.strain) : -1
}

const isKeycardAnswer = (bid: string) => bid === '5C' || bid === '5D' || bid === '5H' || bid === '5S'
const heldQueen = (hand: Hand, trump: Suit) => hand.some((c) => c.suit === trump && c.rank === 'Q')

/**
 * Trumfen för MIN essfråga: vår sidas SENASTE naturliga färg FÖRE frågan
 * (`myAskIdx`) — samma regel som `slamAskTrump`s fallback, men förankrad i MITT
 * 4NT. Medvetet läser den bara auktionen FÖRE frågan och trustar INTE det
 * globala `f.agreedTrump`: efter frågan kan konstgjorda bud förorena den (den
 * starka 2♣-öppningen + partnerns 6♣-kungvisning "enas" felaktigt om klöver).
 * Jacoby-fiten (naturlig trumf utan färgbud) är den enda undantagsvägen.
 */
function askerTrump(f: AuctionFacts, myAskIdx: number): Suit | null {
  // Ägarbeslut 2026-10-02: frågare och svarare läser SAMMA färg — den partnern
  // räknar i när hen svarar (`slamAskTrump` sedd från partnerns stol vid frågan).
  const partnerns = slamAskTrump(auctionFacts(f.history.slice(0, myAskIdx + 1), PARTNER[f.seat]))
  if (partnerns) return partnerns
  for (let i = myAskIdx - 1; i >= 0; i--) {
    const c = f.history[i]
    if (side(c.seat) !== side(f.seat)) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    if (cb.strain === 'NT') continue // sang på vägen är inte trumf — fortsätt bakåt
    if (f.theirStrains.has(cb.strain)) continue
    return SUIT_OF_LETTER[cb.strain]
  }
  return f.jacobyTrump ?? null
}

/** Damfrågan — delad med kaptensvägen (`queenAskBid` i slam.ts). */
const queenAskCall = queenAskBid

/** Partnerns nyckelkort ur svaret + egen räkning (konservativt: det låga
 *  alternativet när svaret är tvetydigt — svararens rättelse backar upp). */
function derivePartner(answerBid: string, own: number): { assumed: number; certain: boolean } {
  const options = answerBid === '5C' ? [1, 4] : answerBid === '5D' ? [0, 3] : [2, 5]
  const possible = options.filter((o) => own + o <= 5)
  if (possible.length === 1) return { assumed: possible[0], certain: true }
  return { assumed: Math.min(...possible), certain: false }
}

/** Är trumfdamen SÄKRAD? Hålls den, visad via 5♠-svaret, eller bevisad 10-fit. */
function queenSecured(hand: Hand, trump: Suit, f: AuctionFacts, answerBid: string): boolean {
  if (heldQueen(hand, trump)) return true
  if (answerBid === '5S') return true
  return lengths(hand)[trump] + partnerShownTrumpLength(f, trump) >= 10
}

/** FRÅGAREN placerar efter nyckelkortssvaret (fas 1). */
function placeAfterKeycards(hand: Hand, trump: Suit, f: AuctionFacts, answerBid: string): Kunskap {
  const L = letterOfSuit(trump)
  const SYM = SWE_SYM[L]
  const signoff = `5${L}`
  const own = keycards(hand, trump)
  const { assumed, certain } = derivePartner(answerBid, own)
  const total = own + assumed

  if (total <= 3) {
    // Två+ nyckelkort saknas → stanna i utgång.
    if (answerBid === signoff) return { call: 'P', rule: 'RKC: stopp', explanation: `för få nyckelkort → passar; ${signoff[0]}${SYM} står.` }
    if (rank(signoff) > rank(answerBid)) return { call: signoff, rule: 'RKC: stopp', explanation: certain ? `två nyckelkort saknas → stannar i 5${SYM}.` : `svaret är tvetydigt; räknar lågt → stannar i 5${SYM}.` }
    return { call: `6${L}`, rule: 'slamavslut', explanation: `svaret gick förbi stoppnivån → 6${SYM}.` }
  }

  // Ägarens slamtabell (2026-10-02, §6.1; `slamValEfterSvar`): 5 nyckelkort =
  // alltid slam (storslam söks inte på den här vägen, se AVGRÄNSNING) · 4 + dam =
  // alltid slam · 4 utan dam = "sök slam, inget måste": damfrågan när den finns;
  // annars lillslam med 8+ kända trumf — men stopp när 5♥-svaret nekat damen.
  const kända = lengths(hand)[trump] + partnerShownTrumpLength(f, trump)
  const ask = queenAskCall(trump, answerBid)
  const val = slamValEfterSvar(total, queenSecured(hand, trump, f, answerBid), kända, ask !== null, answerBid === '5H')
  if (val === 'sök-storslam' || val === 'lillslam') {
    const varför = total >= 5 ? 'alla fem nyckelkort' : queenSecured(hand, trump, f, answerBid) ? 'ett nyckelkort saknas, trumfdamen säkrad' : `ett nyckelkort saknas, damen osäkrad men ${kända}+ kända trumf`
    return { call: `6${L}`, rule: 'slamavslut', explanation: `${varför} → 6${SYM} (lillslam).` }
  }
  if (val === 'fråga-dam' && ask) {
    const askSym = `${ask[0]}${SWE_SYM[ask[1] as 'C' | 'D' | 'H' | 'S']}`
    return { call: ask, rule: 'trumfdam-fråga', explanation: `Alla nyckelkort utom ett — men trumfdamen är inte säkrad → ${askSym} frågar damen; visas den bjuds 6${SYM}, annars står 5${SYM}.` }
  }
  // Ingen fråga att ställa → utan säkrad dam stannar vi i utgång.
  const varför = answerBid === '5H' ? 'svaret nekade trumfdamen' : 'trumfdamen är inte säkrad och ingen fråga ryms'
  if (answerBid === signoff) return { call: 'P', rule: 'RKC: stopp', explanation: `${varför} → passar; 5${SYM} står.` }
  if (rank(signoff) > rank(answerBid)) return { call: signoff, rule: 'RKC: stopp', explanation: `${varför} → stannar i 5${SYM}.` }
  return { call: `6${L}`, rule: 'slamavslut', explanation: `svaret gick förbi stoppnivån → 6${SYM}.` }
}

/** FRÅGAREN placerar efter DAMSVARET (fas 3). */
function placeAfterQueen(trump: Suit, queenAnswer: string): Kunskap {
  const L = letterOfSuit(trump)
  const SYM = SWE_SYM[L]
  const signoff = `5${L}`
  if (queenAnswer === signoff) {
    return { call: 'P', rule: 'RKC: dam nekad', explanation: `trumfdamen nekad → utgång är taket, ${signoff[0]}${SYM} står.` }
  }
  // Damen visad (5NT / sidokung) → lillslam.
  if (rank(`6${L}`) > rank(queenAnswer)) return { call: `6${L}`, rule: 'slamavslut', explanation: `trumfdamen visad → 6${SYM} (lillslam).` }
  return { call: 'P', rule: 'slamavslut', explanation: `trumfdamen visad; partnern nådde redan nivån → pass.` }
}

/**
 * FRÅGARENS placering: jag bjöd 4NT RKC, partnern svarade. null = det här är
 * inte min fråga, eller läget är inte frågarens placering.
 */
function askerPlacement(hand: Hand, f: AuctionFacts): Kunskap | null {
  const seat = f.seat
  const partner = PARTNER[seat]
  const last = f.lastNonPass
  if (!last || last.seat !== partner) return null

  const myAskIdx = f.history.findIndex((c) => c.seat === seat && c.bid === '4NT')
  if (myAskIdx < 0) return null
  const trump = askerTrump(f, myAskIdx)
  if (!trump) return null

  // Partnerns nyckelkortssvar = partnerns första icke-pass efter mitt 4NT.
  const answer = f.history.find((c, i) => i > myAskIdx && c.seat === partner && c.bid !== 'P')
  if (!answer || !isKeycardAnswer(answer.bid)) return null

  // Har JAG redan bjudit något efter svaret? (damfrågan, i så fall)
  const answerIdx = f.history.indexOf(answer)
  const myFollow = f.history.find((c, i) => i > answerIdx && c.seat === seat && c.bid !== 'P')

  if (!myFollow) {
    // Fas 1: placera efter nyckelkortssvaret. Bara när partnerns svar är det
    // SENASTE budet (ingen fortsättning har hänt).
    if (last !== answer) return null
    return placeAfterKeycards(hand, trump, f, answer.bid)
  }

  // Fas 3: jag ställde damfrågan; partnern har svarat.
  const ask = queenAskCall(trump, answer.bid)
  if (!ask || myFollow.bid !== ask) return null
  const followIdx = f.history.indexOf(myFollow)
  const queenAnswer = f.history.find((c, i) => i > followIdx && c.seat === partner && c.bid !== 'P')
  if (!queenAnswer || last !== queenAnswer) return null
  return placeAfterQueen(trump, queenAnswer.bid)
}

/**
 * SVARAREN besvarar partnerns damfråga (fas 2): partnern bjöd 4NT, jag svarade
 * nyckelkort (5♣/5♦), och partnern ställde damfrågan. null = inte det läget.
 */
function answerQueenAsk(hand: Hand, f: AuctionFacts): Kunskap | null {
  const seat = f.seat
  const partner = PARTNER[seat]
  const last = f.lastNonPass
  if (!last || last.seat !== partner) return null

  const partnerAskIdx = f.history.findIndex((c) => c.seat === partner && c.bid === '4NT')
  if (partnerAskIdx < 0) return null
  const trump = slamAskTrumpAtAnswer(f)
  if (!trump) return null

  // Mitt nyckelkortssvar (5♣/5♦ — bara de tvetydiga svaren kan följas av en
  // damfråga; 5♥/5♠ visade redan damstatus).
  const myAnswer = f.history.find((c, i) => i > partnerAskIdx && c.seat === seat && c.bid !== 'P')
  if (!myAnswer || (myAnswer.bid !== '5C' && myAnswer.bid !== '5D')) return null
  const ask = queenAskCall(trump, myAnswer.bid)
  if (!ask || last.bid !== ask) return null
  return respondToQueenAsk(hand, trump, lengths(hand)[trump] + partnerShownTrumpLength(f, trump))
}

/** Läget för raden: partnerns senaste icke-pass är ett 5/6-lägesbud och vår
 *  sida har ställt en essfråga (4NT) — någon av de tre bitarna kan gälla. */
export function rkcAskerSeat(f: AuctionFacts): boolean {
  const last = f.lastNonPass
  if (!last || last.seat !== f.partner) return false
  if (!/^[56][CDHS]$/.test(last.bid) && last.bid !== '5NT') return false
  return f.ourContractBids.some((c) => c.bid === '4NT')
}

/** Radens val: frågarens placering, annars svararens damsvar, annars null. */
export function rkcAskerContinuation(hand: Hand, f: AuctionFacts): Kunskap | null {
  return askerPlacement(hand, f) ?? answerQueenAsk(hand, f)
}
