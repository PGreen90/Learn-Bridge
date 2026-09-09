// NÄR DE STÖR VÅR ÖPPNING — systembok §7.4 och §7.8, motorbytets etapp 4
// familj 3 (2026-09-08). Svararens första bud när LHO stört partnerns
// 1-läges färgöppning (negativ dubbling, fritt bud, cue, konkurrenshöjning,
// sang med stopp — eller Jordan 2NT/XX över deras X), inklivet över vårt svar
// från stolen mellan svararen och öppnaren, öppnarens stöddubbling och
// svaret på den, öppnarens svar på den negativa dubblingen och dubblarens
// fortsättning, samt Jordan-fortsättningen. Kunskapsfunktioner för
// beslutstabellen (`auction-decide.ts`): EGEN hand + auktionsläget
// (`AuctionFacts`, läst ur auktionen ensam) → ett bud. Ingen annan hand finns
// att läsa här.
//
// Innehållet är manusets `competitiveResponderAction` och stöddubblingsrond
// (auction.ts) och detektorerna som förr låg i `auction-live.ts`
// (supportDoubleToAnswer, supportDoubleFollowUpToAnswer, negativeDoubleToAnswer,
// negativeDoublerContinues, jordanToAnswer, jordanSignoffToAnswer) — samma
// bridgekunskap, nu som rena funktioner av hand + fakta. Lägesläsarna
// exporteras så tabellraderna kan uttrycka sina lägen exakt.
//
// Nytt i familjen: (1) svararen tar sitt konkurrensbeslut ur tabellen även när
// LHO:s inkliv inte var det manuset gissade (förr föll svararen till det gamla
// lagrets catch-all och dubblade aldrig negativt vid bordet); (2) manusets
// stöddubblingsrond är riven — den bjöd RHO:s inkliv över vårt svar BARA när
// öppnaren hade exakt tre stöd (manuset tittade i öppnarens hand innan RHO
// fick bjuda); stöddubblingen bjuds nu bara på ett inkliv som faktiskt
// lagts (vid bordet), och RHO:s inkliv över svaret i botauktionerna väntar
// på familj 4:s öppnarrader; (3) tvåfärgsinklivet över vår öppning läses ur
// auktionen (2NT direkt = ovanlig, cue av öppningsfärgen = Michaels), aldrig
// ur motståndarens regeletikett.

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { answerSupportDouble, negativeDouble, openerAnswerNegativeDouble, supportDouble, supportDoublerRebid } from './doubles'
import { pointsWithFloor } from './evaluation'
import { raiseWithFit } from './fit-raise'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'
import { openerRebidAfterJordan2NT } from './rebids'
import { jordanRaiseAfterSignoff } from './responder-rebids'
import type { Major, ResponseResult } from './responses'

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SUIT_SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/** Tolkar ett inkliv ("1S"/"2H"/"X"/"2NT") → nivå + ev. färg. */
function parseBid(call: string): { level: number; suit: Suit | null } {
  const m = call.match(/^([1-7])(C|D|H|S|NT)$/)
  if (!m) return { level: 0, suit: null }
  return { level: Number(m[1]), suit: m[2] === 'NT' ? null : SUIT_OF_LETTER[m[2]] }
}

/** Billigaste nivån för `suit` ovanför referensbudet (nivå + ev. färg). */
function cheapestLevelAbove(suit: Suit, refLevel: number, refSuit: Suit | null): number {
  if (refSuit === null) return refLevel + 1 // referensen är sang → all färg måste upp en nivå
  return rankIdx(suit) > rankIdx(refSuit) ? refLevel : refLevel + 1
}

/** Kunskap bara om budet är lagligt just nu — annars null (nästa regel, sedan det gamla lagret). */
function lawful(f: AuctionFacts, k: ResponseResult | Kunskap | null): Kunskap | null {
  if (!k) return null
  if (k.call !== 'P' && !legalCalls(f.history, f.seat).includes(k.call as Bid)) return null
  return k
}

// ============================================================================
// Lägesläsare
// ============================================================================

/**
 * Svararens första tur när LHO STÖRT partnerns 1-läges färgöppning: partnern
 * öppnade 1 i färg, stolen efter (min LHO) gjorde något annat än pass (färg-
 * inkliv på valfri nivå, 1NT, X, 2NT, cue) och det är min tur direkt. En
 * passad hand är fortfarande svarare här (samma beslut).
 */
export function contestedResponseSeat(f: AuctionFacts): { openerSuit: Suit; theirCall: string } | null {
  const open = f.opening
  if (!open || open.seat !== f.partner || open.level !== 1) return null
  const openerSuit = SUIT_OF_LETTER[open.strain]
  if (!openerSuit) return null
  const h = f.history
  if (h.length !== open.index + 2) return null
  const ov = h[open.index + 1]
  if (ov.bid === 'P') return null
  return { openerSuit, theirCall: ov.bid }
}

/**
 * Öppnarens stol i STÖDDUBBLINGSFÖNSTRET (§7.4): jag öppnade 1 i färg, LHO
 * passade, partnern svarade 1♥/1♠, RHO klev in i en FÄRG (inte min) direkt
 * efter svaret, och det är min tur direkt efter inklivet. Ingen X/XX i
 * auktionen (deras X av svaret är systems on, en annan rad).
 */
export function supportDoubleSeat(f: AuctionFacts): { partnerMajor: Major; theirCall: string } | null {
  const open = f.opening
  if (!open || open.seat !== f.seat || open.level !== 1) return null
  const mySuit = SUIT_OF_LETTER[open.strain]
  if (!mySuit) return null
  const bids = f.contractBids
  if (bids.length !== 3) return null
  const [o, resp, over] = bids
  if (o.seat !== f.seat || resp.seat !== f.partner) return null
  const rb = parseContractBid(resp.bid)!
  if (rb.level !== 1 || (rb.strain !== 'H' && rb.strain !== 'S')) return null
  if (side(over.seat) === side(f.seat)) return null
  const ob = parseContractBid(over.bid)!
  const theirSuit = SUIT_OF_LETTER[ob.strain]
  if (!theirSuit || theirSuit === mySuit) return null // 1NT-inkliv / cue → andra regler
  const h = f.history
  if (h.indexOf(over) !== h.indexOf(resp) + 1 || h.length !== h.indexOf(over) + 1) return null
  if (h.some((c) => c.bid === 'X' || c.bid === 'XX')) return null
  return { partnerMajor: SUIT_OF_LETTER[rb.strain] as Major, theirCall: over.bid }
}

/**
 * Har partnern (öppnaren) just STÖDDUBBLAT som `seat` (svararen) måste svara på?
 * Mönstret (§7.4): partnerns 1-läges färgöppning – (pass) – vårt 1M-svar –
 * (RHO:s färginkliv) – partnerns X – (pass) – vi. X:et visar exakt 3 stöd och är
 * upplysande — svararen får aldrig lämnas att passa bort det (etapp 6 hål 1).
 * Kraven:
 *  - partnerns senaste icke-pass är ett X (bjuder RHO över är läget fritt),
 *  - kontraktsbuden är exakt tre: partnerns 1-i-färg, vårt 1♥/1♠, deras inkliv
 *    (i en annan färg än öppningens, efter vårt svar),
 *  - "2 i vår högfärg" gick fortfarande att bjuda (annars betyder X något annat
 *    — samma fönster som `supportDouble` i doubles.ts).
 */
export function supportDoubleToAnswer(
  f: AuctionFacts,
): { myMajor: Suit; openerSuit: Suit; theirBid: string } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null

  const bids = f.contractBids
  if (bids.length !== 3) return null
  const [open, resp, over] = bids

  const openCb = parseContractBid(open.bid)!
  if (open.seat !== PARTNER[seat] || openCb.level !== 1) return null
  const openerSuit = SUIT_OF_LETTER[openCb.strain]
  if (!openerSuit) return null // 1NT-öppning → X är något annat

  const respCb = parseContractBid(resp.bid)!
  if (resp.seat !== seat || respCb.level !== 1) return null
  const myMajor = SUIT_OF_LETTER[respCb.strain]
  if (myMajor !== 'hearts' && myMajor !== 'spades') return null

  const overCb = parseContractBid(over.bid)!
  if (side(over.seat) === side(seat)) return null
  const theirSuit = SUIT_OF_LETTER[overCb.strain]
  if (!theirSuit || theirSuit === openerSuit) return null
  // X:et måste ligga efter inklivet (öppnarens andra tur).
  if (history.indexOf(lastNonPass) < history.indexOf(over)) return null
  // Stöd-X-fönstret: 2M måste ha varit bjudbart över inklivet.
  const twoMajorAvailable =
    overCb.level < 2 || (overCb.level === 2 && rankIdx(myMajor) > rankIdx(theirSuit))
  if (!twoMajorAvailable) return null

  return { myMajor, openerSuit, theirBid: over.bid }
}

/**
 * Har `seat` (öppnaren) själv STÖDDUBBLAT och fått partnerns svar som nu ska
 * vägas (acceptera inbjudan med 15+, annars pass)? Kraven speglar
 * `supportDoubleToAnswer` — plus: vårt eget X ligger mellan inklivet och
 * partnerns svar, svaret är auktionens senaste icke-pass (stör motståndarna
 * efter svaret är läget fritt → generell konkurrenslogik).
 */
export function supportDoubleFollowUpToAnswer(
  f: AuctionFacts,
): { myOpenedSuit: Suit; partnerMajor: Suit; theirSuit: Suit; partnerAnswer: string } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  if (!parseContractBid(lastNonPass.bid)) return null

  const bids = f.contractBids
  if (bids.length !== 4) return null
  const [open, resp, over, answer] = bids
  if (answer !== lastNonPass) return null

  const openCb = parseContractBid(open.bid)!
  if (open.seat !== seat || openCb.level !== 1) return null
  const myOpenedSuit = SUIT_OF_LETTER[openCb.strain]
  if (!myOpenedSuit) return null

  const respCb = parseContractBid(resp.bid)!
  if (resp.seat !== PARTNER[seat] || respCb.level !== 1) return null
  const partnerMajor = SUIT_OF_LETTER[respCb.strain]
  if (partnerMajor !== 'hearts' && partnerMajor !== 'spades') return null

  const overCb = parseContractBid(over.bid)!
  if (side(over.seat) === side(seat)) return null
  const theirSuit = SUIT_OF_LETTER[overCb.strain]
  if (!theirSuit || theirSuit === myOpenedSuit) return null

  // Mitt X = stöddubblingen, mellan deras inkliv och partnerns svar.
  const myX = history.find(
    (c) =>
      c.seat === seat &&
      c.bid === 'X' &&
      history.indexOf(c) > history.indexOf(over) &&
      history.indexOf(c) < history.indexOf(answer),
  )
  if (!myX) return null

  return { myOpenedSuit, partnerMajor, theirSuit, partnerAnswer: answer.bid }
}

/**
 * Är `seat` (öppnaren) TVUNGEN att svara på partnerns NEGATIVA dubbling?
 * Mönstret (§7.4): vi öppnade 1 i färg – motståndaren klev in i färg – partnern
 * dubblade (negativt = upplysning, rondkrav) – och bara pass har följt sedan.
 * Öppnaren får då aldrig passa (felrapport #2: auktionen dog på öppnarens pass).
 * Kraven:
 *  - partnerns senaste icke-pass-bud är ett X (inget har bjudits över det),
 *  - auktionens FÖRSTA kontraktsbud är `seat`s egen 1-läges färgöppning,
 *  - vår sida har inte bjudit något annat kontraktsbud (X:et är svararens första
 *    besked, inte straff i en utvecklad auktion),
 *  - motståndarna har klivit in i EN FÄRG (det X:et dubblar).
 */
export function negativeDoubleToAnswer(
  f: AuctionFacts,
): { ourOpen: Suit; theirCall: string } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null

  const open = f.opening
  if (!open || open.seat !== seat || open.level !== 1) return null
  const ourOpen = SUIT_OF_LETTER[open.strain]
  if (!ourOpen) return null // 1NT-öppning → X:et är något annat än negativt

  // Vår sida får bara ha öppningen som kontraktsbud (annars är X:et inte negativt).
  if (f.ourContractBids.length !== 1) return null

  // Deras inkliv = senaste kontraktsbudet i historiken, från motståndarsidan, i färg.
  let theirCall: string | null = null
  for (const c of history) {
    if (!parseContractBid(c.bid)) continue
    theirCall = side(c.seat) !== side(seat) && SUIT_OF_LETTER[parseContractBid(c.bid)!.strain] ? c.bid : null
  }
  if (!theirCall) return null
  return { ourOpen, theirCall }
}

/**
 * Negativ-dubblarens ANDRA tur: partnern öppnade 1 i färg, de klev in i EN
 * färg, mitt enda besked är X:et, och partnerns svar (i färg, billigast — ett
 * hopp visar 16+ och är kravlogikens sak) är auktionens senaste icke-pass,
 * under utgång. Returnerar buden som läget bygger på.
 */
export function negativeDoublerSeat(
  f: AuctionFacts,
): { open: { level: number; strain: string }; answer: { level: number; strain: string }; their: { level: number; strain: string }; answerCall: ResolvedCall } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  const answer = parseContractBid(lastNonPass.bid)
  if (!answer) return null // (även partnerns sangsvar — förr lämnades det åt det gamla lagret)

  const open = f.opening
  if (!open || open.seat !== PARTNER[seat] || open.level !== 1) return null
  if (!SUIT_OF_LETTER[open.strain]) return null // 1NT-öppning → X:et var inte negativt

  // Mitt enda besked hittills ska vara X:et (den negativa dubblingen).
  const myCalls = history.filter((c) => c.seat === seat && c.bid !== 'P')
  if (myCalls.length !== 1 || myCalls[0].bid !== 'X') return null

  // Vår sida: exakt öppningen + svaret. Deras sida: exakt inklivet (ostört sedan).
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids[1] !== lastNonPass) return null
  const theirBids = f.theirContractBids
  if (theirBids.length !== 1) return null
  const theirCb = parseContractBid(theirBids[0].bid)!
  if (!SUIT_OF_LETTER[theirCb.strain]) return null

  // Bara partnerns BILLIGA svar (ett HOPP visar 16+ och sköts av kravlogiken).
  let minLevel = 1
  while (bidValue(minLevel, answer.strain) <= bidValue(theirCb.level, theirCb.strain)) minLevel++
  if (answer.level > minLevel) return null
  // Under utgång: partnerns utgångsbud står (det gamla lagrets vakt).
  const gameLevel = answer.strain === 'NT' ? 3 : answer.strain === 'H' || answer.strain === 'S' ? 4 : 5
  if (answer.level >= gameLevel) return null

  return { open: { level: open.level, strain: open.strain }, answer, their: theirCb, answerCall: lastNonPass }
}

/**
 * Grundmönstret för Jordan/Truscott (§7.8 d): vår 1M-öppning, DIREKT X från
 * motståndaren, partnerns 2NT som sidans första svar. Positionsexakt läsning
 * (öppning → X → 2NT) så en försenad 2NT eller sang i annan sits aldrig
 * feltolkas. Delas av öppnarens svarsplikt och Jordan-bjudarens fortsättning.
 */
function jordanBase(f: AuctionFacts): { openerSeat: Seat; major: Major; ntIdx: number } | null {
  const { history } = f
  const open = f.opening
  if (!open || open.level !== 1) return null
  const major = SUIT_OF_LETTER[open.strain]
  if (major !== 'hearts' && major !== 'spades') return null
  const openIdx = open.index
  const dbl = history[openIdx + 1]
  if (!dbl || dbl.bid !== 'X') return null
  const nt = history[openIdx + 2]
  if (!nt || nt.bid !== '2NT' || nt.seat !== PARTNER[open.seat]) return null
  return { openerSeat: open.seat, major, ntIdx: openIdx + 2 }
}

/**
 * Partnerns Jordan 2NT väntar på mitt (öppnarens) svar — jag passar ALDRIG
 * (systemfel #4, frö 20260739). Bjuder advancern vidare över 2NT lämnas läget
 * till det ordinarie konkurrensmaskineriet (Jordan är inbjudan, inte rondkrav
 * i störd fortsättning).
 */
export function jordanToAnswer(f: AuctionFacts): { major: Major } | null {
  const { history, seat } = f
  const j = jordanBase(f)
  if (!j || j.openerSeat !== seat) return null
  for (let i = j.ntIdx + 1; i < history.length; i++) {
    if (history[i].bid !== 'P') return null
  }
  return { major: j.major }
}

/**
 * Öppnaren avslutade 3M på min Jordan 2NT — med utgångsstyrka (13+) går jag
 * vidare, med ren limithöjning står avslutet.
 */
export function jordanSignoffToAnswer(f: AuctionFacts): { major: Major } | null {
  const { history, seat } = f
  const j = jordanBase(f)
  if (!j || PARTNER[j.openerSeat] !== seat) return null
  let i = j.ntIdx + 1
  while (i < history.length && history[i].bid === 'P') i++
  const signoff = history[i]
  const letter = j.major === 'hearts' ? 'H' : 'S'
  if (!signoff || signoff.seat !== j.openerSeat || signoff.bid !== `3${letter}`) return null
  for (let k = i + 1; k < history.length; k++) {
    if (history[k].bid !== 'P') return null
  }
  return { major: j.major }
}

// ============================================================================
// Kunskap — svararen när de stört öppningen (raden *svar-stört*)
// ============================================================================

/**
 * Svararens reaktion när motståndaren (LHO) stört partnerns 1-läges färg-
 * öppning. §7.4/§7.8: negativ dubbling, fritt bud, cue (limithöjning+),
 * konkurrenshöjning, NT med stopp, fritt lågfärgsbud, eller pass; mot 1NT-
 * inkliv och tvåfärgsinkliv K3-tabellen (§7.8 e); mot deras X Jordan 2NT /
 * XX / höjning (§7.8 d). Tvåfärgsinklivet läses ur AUKTIONEN: 2NT direkt över
 * öppningen är ovanlig 2NT, 2 i öppningsfärgen är Michaels — aldrig ur
 * motståndarens regeletikett (den finns inte vid bordet).
 */
export function contestedResponse(hand: Hand, openerSuit: Suit, theirCall: string): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const { level: ovLevel, suit: ovSuit } = parseBid(theirCall)
  const isMajorOpening = openerSuit === 'hearts' || openerSuit === 'spades'

  // Mot ett 1NT-INKLIV (pliktsvepet K3 b, ägarbeslut 2026-09-02): förr fanns
  // inget svar alls, så svararen passade med 4-korts stöd (frö 20260732:
  // 1♥–(1NT)–P på ♥9752 + 7 hp). 10+ hp → X = straff (vi äger balansen mot
  // deras 15–18); 3+ stöd och 6–9 → 2M (konkurrenshöjning); annars pass.
  if (theirCall === '1NT') {
    if (p >= 10) return { call: 'X', rule: 'straffdubbling', explanation: `10+ hp mot deras 1NT-inkliv → X (straff – vi har balansen).` }
    if (len[openerSuit] >= 3 && p >= 6) {
      return { call: `2${LETTER[openerSuit]}` as Bid, rule: 'konkurrenshöjning', explanation: `3+ stöd (6–9) → 2${SUIT_SYM[openerSuit]} (konkurrenshöjning över deras 1NT).` }
    }
    return { call: 'P', rule: 'pass', explanation: `Inget lämpligt mot deras 1NT-inkliv → pass.` }
  }

  // Mot ett TVÅFÄRGSINKLIV (Michaels-cue i vår färg / ovanlig 2NT; K3 c): höjningen
  // är TÄVLANDE, inte spärr (ägarbeslut 2026-09-02). Motståndarna har visat 5-5,
  // så med 4+ stöd (9 trumf) tävlar vi till 3M; med 10+ stödpoäng bjuds 4M direkt.
  // 3-korts stöd tävlar 3M bara med 10+. Förr passade svararen allt (frö
  // 20263327: ♠K9874 + 17 stödpoäng passade 2NT). Bara efter 1♥/1♠.
  const twoSuiter = theirCall === '2NT' || ovSuit === openerSuit
  if (twoSuiter && isMajorOpening) {
    const support = len[openerSuit]
    const sp = pointsWithFloor(hand, openerSuit, 'support')
    if (support >= 4 && sp.points >= 10) {
      return { call: `4${LETTER[openerSuit]}` as Bid, rule: 'höjning till utgång', explanation: `4+ stöd och ${sp.text} mot deras tvåfärgsinkliv → 4${SUIT_SYM[openerSuit]} direkt.` }
    }
    if (support >= 4 || (support === 3 && sp.points >= 10)) {
      return { call: `3${LETTER[openerSuit]}` as Bid, rule: 'konkurrenshöjning', explanation: `${support >= 4 ? '4+ stöd (9 trumf)' : `3-korts stöd med ${sp.text}`} mot deras tvåfärgsinkliv → 3${SUIT_SYM[openerSuit]} (tävlande höjning, ej krav).` }
    }
    return { call: 'P', rule: 'pass', explanation: `Inget lämpligt mot deras tvåfärgsinkliv → pass.` }
  }

  // Mot ett färginkliv:
  if (ovSuit) {
    // §7.4 (ägarbeslut 2026-09-09): med 3+ STÖD i partnerns öppnade HÖGFÄRG
    // bjuder vi ALDRIG negativ dubbling — en negativ dubbling förnekar (visar
    // inte) stöd, så fiten skulle döljas. Vi visar den i stället (cue/höjning
    // nedan). Vakten `openerMajorFit` fanns redan för fritt-bud-grenen men var
    // inte kopplad till dubblingen (frö 20272221: 1♥–(3♣) med ♠KQT53 ♥742 gav
    // X i stället för 3♥). Utan sådant stöd (minoröppning, eller ≤2 i högfärgen)
    // gäller negativ dubbling som förr — EN källa, samma logik som doubles.ts.
    const openerMajorFit = isMajorOpening && len[openerSuit] >= 3
    if (!openerMajorFit) {
      const neg = negativeDouble(hand, openerSuit, theirCall)
      if (neg) return neg
    }
    // Fritt bud i en 5+ HÖGFÄRG (§5.5, felrapport #55): på 1-läget från 6 hp,
    // på 2-läget från 10 hp — rondkrav. Högfärgen visas före cue/höjning, UTOM
    // när öppnaren öppnade en högfärg vi har 3+ stöd i (då är fiten känd och
    // cue/höjning säger mer). Förr saknades grenen helt: med 7-korts spader
    // efter 1♦–(1♥) dubblade svararen negativt (lovar 4) och passade sedan.
    if (!openerMajorFit) {
      for (const m of ['spades', 'hearts'] as Suit[]) {
        if (m === openerSuit || m === ovSuit || len[m] < 5) continue
        const L = cheapestLevelAbove(m, ovLevel, ovSuit)
        if ((L === 1 && p >= 6) || (L === 2 && p >= 10)) {
          return {
            call: `${L}${LETTER[m]}` as Bid,
            rule: 'fritt bud',
            explanation: `5+ ${SUIT_SYM[m]} → ${L}${SUIT_SYM[m]} (fritt bud i konkurrens, ${L === 1 ? '6' : '10'}+ hp, rondkrav).`,
          }
        }
      }
    }
    // Limithöjning eller bättre (§7.1): cue i DERAS färg med 3+ stöd och 10+ hp
    // (krav). Skiljer en inbjudande+ höjning från den rena konkurrenshöjningen.
    if (len[openerSuit] >= 3 && p >= 10) {
      const L = ovLevel + 1 // billigaste cue av deras färg ligger en nivå över inklivet
      return { call: `${L}${LETTER[ovSuit]}` as Bid, rule: 'cue (limithöjning+)', explanation: `10+ hp, 3+ stöd → cue ${SUIT_SYM[ovSuit]} (limithöjning+, krav).` }
    }
    // Konkurrenshöjning: 3+ stöd i öppnarens färg, 6–9 (spärr/konkurrens, ej inbjudan).
    if (len[openerSuit] >= 3 && p >= 6) {
      const L = cheapestLevelAbove(openerSuit, ovLevel, ovSuit)
      return { call: `${L}${LETTER[openerSuit]}` as Bid, rule: 'konkurrenshöjning', explanation: `3+ stöd (6–9) → ${L}${SUIT_SYM[openerSuit]} (konkurrens).` }
    }
    // NT med stopp i deras färg – bara mot inkliv på 1–2-läget. Mot ett
    // hoppinkliv på 3-läget vore 2NT OLAGLIGT (under deras bud) och 3NT
    // osunt på bara 8+ → då passar svararen i stället (FAS 1 punkt 3).
    if (ovLevel <= 2 && isBalanced(hand) && hasStopper(hand, ovSuit) && p >= 8) {
      // Billigaste NT över ett FÄRGinkliv på nivå `ovLevel` är exakt `ovLevel`:
      // sang rankar över alla färger, så 1NT är lagligt över (1♠), 2NT över (2♣)
      // osv. (R1-fynd #1.)
      const L = ovLevel
      return { call: `${L}NT` as Bid, rule: 'NT med stopp', explanation: `Balanserad med stopp (8+) → ${L}NT.` }
    }
    // Fritt bud i en 5+ LÅGFÄRG på 2-läget (§5.5, felrapport #55): 10+ hp,
    // utan fit och utan sang-alternativ — rondkrav, lovar värden men inte utgång.
    for (const m of ['diamonds', 'clubs'] as Suit[]) {
      if (m === openerSuit || m === ovSuit || len[m] < 5 || p < 10) continue
      if (cheapestLevelAbove(m, ovLevel, ovSuit) !== 2) continue
      return {
        call: `2${LETTER[m]}` as Bid,
        rule: 'fritt bud',
        explanation: `5+ ${SUIT_SYM[m]} → 2${SUIT_SYM[m]} (fritt bud i konkurrens, 10+ hp, rondkrav).`,
      }
    }
    return { call: 'P', rule: 'pass', explanation: `Inget lämpligt i konkurrens → pass.` }
  }

  // Mot upplysningsdubbling (X): Jordan 2NT (limithöjning, 4+ trumf) efter
  // 1♥/1♠, annars redubbla med 10+, annars stöd/pass. (Förr bjöds "Jordan"
  // även över 1♣/1♦ — boken §7.8 d definierar den bara efter högfärgs-
  // öppningen och öppnaren hade inget svar: 2NT passades ut. Etapp 4 familj
  // 3, 2026-09-08: över 1m gäller XX = 10+ som §7.8 b.)
  if (theirCall === 'X') {
    // Jordan 2NT (§7.8 d): 4+ stöd och limitvärden → 2NT, INTE Jacoby.
    if (isMajorOpening && len[openerSuit] >= 4 && p >= 10) {
      return { call: '2NT', rule: 'Jordan 2NT', explanation: `10+ hp, 4+ trumf → 2NT (Jordan, limithöjning+ med fit).` }
    }
    if (p >= 10) return { call: 'XX', rule: 'redubbling', explanation: `10+ hp → XX (redubbling, lovar styrka).` }
    if (len[openerSuit] >= 3) return { call: `2${LETTER[openerSuit]}` as Bid, rule: 'konkurrenshöjning', explanation: `3+ stöd → 2${SUIT_SYM[openerSuit]} (konkurrenshöjning).` }
    return { call: 'P', rule: 'pass', explanation: `Inget lämpligt → pass.` }
  }

  return { call: 'P', rule: 'pass', explanation: `Inget lämpligt → pass.` }
}

// ============================================================================
// Kunskap — stöddubblingen (raderna *stöd-x*, *stöd-x-svar*, *stöd-x-öppnaren*)
// ============================================================================

/** Öppnarens stöddubbling (exakt 3 stöd) i fönstret — eller null (det gamla lagret, familj 4). */
export function openerSupportDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = supportDoubleSeat(f)
  if (!s) return null
  return lawful(f, supportDouble(hand, s.partnerMajor, s.theirCall))
}

/** Svararens svar på partnerns stöddubbling (aldrig bortpassad utom som medvetet straffpass). */
export function answerPartnersSupportDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = supportDoubleToAnswer(f)
  if (!s) return null
  return lawful(f, answerSupportDouble(hand, s.myMajor, s.openerSuit, s.theirBid))
}

/** Stöddubblarens fortsättning: väger partnerns inbjudan (15+ accepterar), låter utgångsbud stå, passar aldrig ett fritt bud. */
export function supportDoublerContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = supportDoubleFollowUpToAnswer(f)
  if (!s) return null
  return lawful(f, supportDoublerRebid(hand, s.myOpenedSuit, s.partnerMajor, s.theirSuit, s.partnerAnswer))
}

// ============================================================================
// Kunskap — den negativa dubblingen (raderna *negativ-x-öppnaren*, *negativ-dubblaren*)
// ============================================================================

/** Öppnarens svar på partnerns negativa dubbling (rondkrav — aldrig pass). */
export function answerPartnersNegativeDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const n = negativeDoubleToAnswer(f)
  if (!n) return null
  return lawful(f, openerAnswerNegativeDouble(hand, n.ourOpen, n.theirCall))
}

/**
 * Negativ-dubblarens andra tur (§7.4): först höjningen av partnerns svar med
 * fit (`raiseWithFit` — samma dom som det gamla lagrets catch-all gav), sedan
 * invit-fortsättningen för 9–12-handen (fel färg-spåret fix 5b) och den svaga
 * preferensen (pliktsvepet K2): preferens till öppningsfärgen, egen 5+/6+
 * färg billigast, 2NT med stopp. 13+ (utgångsvärden) och svagare händer utan
 * något att säga lämnas åt det gamla lagret (null).
 */
export function negativeDoublerContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = negativeDoublerSeat(f)
  if (!s) return null
  const { history, seat } = f
  const { open, answer, their: theirCb, answerCall } = s

  const suitAnswer = answer.strain !== 'NT'

  // Höjningen av den svarade färgen (fit + tillräckliga stödpoäng) går före:
  // dubblaren får inte dra en egen sidofärg förbi en höjning (regressions-
  // vakter 20261621/20261351: dubbelton-höjning av rebjuden 1M resp. 5-korts
  // ruterstöd). Förr gav det gamla lagrets catch-all samma höjning.
  const raise = suitAnswer ? raiseWithFit(hand, f, answer) : null
  if (raise) {
    const lvl = parseContractBid(raise.bid)!.level
    const gameLvl = answer.strain === 'H' || answer.strain === 'S' ? 4 : 5
    const grad = lvl >= gameLvl || raise.bid === '3NT' ? 'utgång' : /inbjudande/.test(raise.explanation ?? '') ? 'inbjudan' : 'enkel'
    return { call: raise.bid, rule: `höjning efter negativ dubbling (${grad})`, explanation: raise.explanation ?? '' }
  }

  const p = hcp(hand)
  const len = lengths(hand)
  const theirSuit = SUIT_OF_LETTER[theirCb.strain]
  const legal = legalCalls(history, seat)

  // Utgångsvärden (13+) utan fit för svaret (etapp 4 familj 3, 2026-09-08):
  // partnerns sang-svar visade stopp och minimum → 3NT; partnerns färgsvar
  // utan fit → 3NT med jämn hand och eget stopp i deras färg. Förr föll de
  // här händerna till det gamla lagrets catch-all, som bjöd en 4-kortsfärg på
  // 2-läget (avvikelsedumpen 20270004: 1♦–(1♠)–X–P–1NT–P med ♠54 ♥AJ54 ♦AJ6
  // ♣KJ98 → 2♣, nu 3NT). Övriga 13+-händer (ojämna, utan stopp) lämnas åt
  // det gamla lagret tills familj 4.
  if (p >= 13) {
    const nt = legal.includes('3NT' as Bid)
    if (nt && !suitAnswer) return {
      call: '3NT', rule: 'negativ-dubblarens utgång',
      explanation: `Utgångsvärden (13+) mot partnerns ${prettyBid(answerCall.bid)} (minimum med stopp i deras ${SWE_SYM[theirCb.strain]}) → 3NT.`,
    }
    if (nt && isBalanced(hand) && hasStopper(hand, theirSuit)) return {
      call: '3NT', rule: 'negativ-dubblarens utgång',
      explanation: `Utgångsvärden (13+), jämn hand med stopp i deras ${SWE_SYM[theirCb.strain]} och ingen fit för partnerns ${prettyBid(answerCall.bid)} → 3NT.`,
    }
    return null
  }

  // Partnerns SANGSVAR (1NT/2NT = minimum med stopp): 10–12 bjuder 2NT
  // (inbjudan), en egen 6+ färg visas nedan; annars pass via det gamla lagret.
  if (!suitAnswer) {
    if (p >= 10 && legal.includes('2NT' as Bid)) return {
      call: '2NT', rule: 'negativ-dubblarens invit-fortsättning',
      explanation: `10–12 hp mot partnerns ${prettyBid(answerCall.bid)} (minimum med stopp) → 2NT (inbjudan, ej krav).`,
    }
  }

  // Pliktsvepet K2 (2026-09-02): SVAG PREFERENS till öppningsfärgen. Partnerns
  // tvingade svar på min dubbling landade i en färg jag stöder sämre än
  // öppningsfärgen (frö 20262871: 1♦–(1♠)–X–P–2♣ med ♦K752 ♣73 → 2♦, förr pass).
  // Samma kriterier som advancerns preferens (§7.1, felrapport #56): kostar
  // preferensen ingen nivå räcker lika lång eller längre öppningsfärg (minst 3
  // kort); kostar den en nivå krävs klar skillnad (2+ kort). Aldrig förbi utgång.
  if (suitAnswer && p < 10 && answer.strain !== open.strain) {
    const pref = cheapestBidIn(history, seat, open.strain)
    if (pref) {
      const lvl = Number(pref[0])
      const gameLvl = open.strain === 'H' || open.strain === 'S' ? 4 : 5
      const costs = lvl > answer.level
      const lo = len[SUIT_OF_LETTER[open.strain]]
      const la = len[SUIT_OF_LETTER[answer.strain]]
      const better = lo >= 3 && (costs ? lo >= la + 2 : lo >= la)
      if (better && lvl <= gameLvl && legal.includes(pref)) return {
        call: pref, rule: 'negativ-dubblarens preferens',
        explanation: `Partnerns ${prettyBid(answerCall.bid)} var ett tvingat svar på min dubbling; bättre stöd i öppningsfärgen ${SWE_SYM[open.strain]} (${lo}–${la}) → ${prettyBid(pref)} (preferens, ej krav).`,
      }
    }
  }

  const hasSix = SUIT_STRAINS.some((st) => st !== theirCb.strain && len[SUIT_OF_LETTER[st]] >= 6)
  if (p < 10 && !(p >= 9 && hasSix)) return null // under invitzonen → pass som förr

  // 1. Invit-preferens: 3+ stöd i partnerns ÖPPNINGSFÄRG när svaret var en annan.
  if (suitAnswer && answer.strain !== open.strain && len[SUIT_OF_LETTER[open.strain]] >= 3) {
    const cheapest = cheapestBidIn(history, seat, open.strain)
    if (cheapest) {
      const lvl = Math.min(Number(cheapest[0]) + (p >= 11 ? 1 : 0), 3)
      const bid = `${lvl}${open.strain}` as Bid
      if (legal.includes(bid)) return {
        call: bid, rule: 'negativ-dubblarens invit-fortsättning',
        explanation: `3-korts stöd för partnerns öppnade ${SWE_SYM[open.strain]} → ${lvl === Number(cheapest[0]) ? 'preferens' : 'invit-preferens'} ${prettyBid(bid)} (ej krav).`,
      }
    }
  }

  // 2. Egen 5+ färg (9 hp kräver 6+): längsta först, billigast — ej krav.
  const own = SUIT_STRAINS.filter(
    (st) =>
      st !== theirCb.strain && st !== open.strain && st !== answer.strain &&
      len[SUIT_OF_LETTER[st]] >= (p >= 10 ? 5 : 6),
  ).sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]])
  for (const st of own) {
    const bid = cheapestBidIn(history, seat, st)
    if (bid && Number(bid[0]) <= 3 && legal.includes(bid)) return {
      call: bid, rule: 'negativ-dubblarens invit-fortsättning',
      explanation: `6+ ${SWE_SYM[st]} — rebjuder färgen billigast (invit, ej krav) i stället för att passa partnerns tvingade svar.`,
    }
  }

  // 3. Jämn hand med stopp i deras färg → 2NT (invit).
  if (isBalanced(hand) && hasStopper(hand, theirSuit) && legal.includes('2NT' as Bid)) {
    return {
      call: '2NT', rule: 'negativ-dubblarens invit-fortsättning',
      explanation: `Jämn med stopp i deras ${SWE_SYM[theirCb.strain]} → 2NT (invit, ej krav).`,
    }
  }
  return null
}

// ============================================================================
// Kunskap — Jordan 2NT (raderna *jordan-öppnaren*, *jordan-svararen*)
// ============================================================================

/** Öppnarens svar på partnerns Jordan 2NT: 3M minimum/avslut, 4M med 15+ stödpoäng — aldrig pass. */
export function answerJordan(hand: Hand, f: AuctionFacts): Kunskap | null {
  const j = jordanToAnswer(f)
  if (!j) return null
  return lawful(f, openerRebidAfterJordan2NT(hand, j.major))
}

/** Jordan-bjudaren väger öppnarens 3M-avslut: 13+ höjer till utgång, annars pass. */
export function jordanBidderAfterSignoff(hand: Hand, f: AuctionFacts): Kunskap | null {
  const j = jordanSignoffToAnswer(f)
  if (!j) return null
  return lawful(f, jordanRaiseAfterSignoff(hand, j.major))
}
