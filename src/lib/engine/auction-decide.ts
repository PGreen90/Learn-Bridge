// BESLUTSTABELLEN — steg 3 "val" i den nya beslutsfunktionen
// (docs/motorbyte-plan.md §2, etapp 3). Varje stol bjuder som en människa:
// EGEN hand + auktionen hittills → ett bud. Ingen annan hand finns att läsa här,
// och det är konstruktionen som garanterar ärlig inferens (kikvakten,
// `kikvakt.test.ts`, bevisar det för varje familj som flyttar in).
//
// Tabellen växer familj för familj (etapp 3: den ostörda linjen, etapp 4:
// konkurrensen). En rad = ett LÄGE (ett villkor på fakta ur `auction-facts.ts`)
// → en kunskapsfunktion (openings.ts, responses*.ts, rebids.ts …). Lägena ska
// vara exakta och inbördes uteslutande, så ordningen i tabellen är ointressant;
// första rad vars läge stämmer OCH vars val ger ett bud väljer budet. Stämmer
// ingen rad svarar tabellen null och det gamla lagret (manus + detektorer i
// `auction-live.ts`) tar vid — tills alla familjer flyttat och det lagret rivs
// (etapp 5).
//
// Familjer som flyttat in:
//   1. Öppningen (2026-09-04): ingen har öppnat → `classifyOpening` med
//      position 1–4 i varvet från given och stolens sårbarhet.
//   2. Svaret (2026-09-04): partnern öppnade, motståndarna har passat, jag har
//      inte bjudit → svarsfunktionen för öppningsbudet (`responseDecision`),
//      passad hand → Drury över 1M; Gerber-handen frågar 4♣ över 1NT/2NT.
//      Öppningar utan svarsregler (4NT, 5m …) lämnas åt det gamla lagret.
//   3. Öppnarens återbud (2026-09-05): jag öppnade, partnern svarade ostört →
//      `openerSecondBid` med partnerns bud SOM JAG SER DET: bud + systemregel
//      härledd ur den nakna auktionen (`partnerResponseAsSeen`), aldrig ur
//      partnerns hand eller partnerns cachade regel. Gerber-frågan besvaras
//      med esssvaret. Svar utan återbudsregel lämnas åt det gamla lagret.
//   4a. Svararens andra bud (2026-09-05): jag svarade, partnern gav återbud
//      ostört → `responderSecondDecision`: manusets grenordning (systems on
//      efter 2♣–2♦–2NT / 2♣-positivt / hopp i egen minor / hopphöjning /
//      reverse–hoppskift / Jacoby–inverterad fit / splinter-relä / MSS /
//      1NT-återbudet, sedan `responderSecondBid`) där varje slamgren ger
//      KAPTENENS FÖRSTA STEG ur egen hand (`slamCaptainFirstStep` m.fl.).
//      Partnerns återbud läses med `rebidAsSeen`.
//   4b. Öppnarens tredje bud (2026-09-05): jag öppnade, partnern svarade, jag
//      gav återbud, partnern bjöd sitt andra bud — allt ostört →
//      `openerThirdDecision`: manusets grenar i samma ordning (2/1 försenat
//      stöd · NMF · fjärde färg · 1NT-auktionens inbjudan · semi-forcing 1NT ·
//      egen höjning + inbjudan · inverterad broms · reverse + preferens ·
//      2NT-checkback · 5-3-jakt · systems on efter 2♣–2♦–2NT · 2NT-öppningens
//      val efter Smolen/3NT-erbjudandet). Partnerns andra bud läses med
//      `secondAsSeen`; mitt eget återbud med samma `rebidAsSeen` som svararen
//      använder (den läser bara auktionen).
//   5. Slamutredningen per stol + svararens tredje bud (2026-09-05):
//      · raden *slam*: en slamsekvens pågår (kaptenens första slambud finns i
//        auktionen — `slamSituation` läser uppsättningen ur AUKTIONEN: trumf,
//        partnerns visade minimum, inbjudningsbud, kravläge) → nästa tur ur
//        EGEN hand: `slamTurn` (cue-ronden, 4NT, svar, placering, 5NT,
//        stopp, rättelse, inbjudans dom), `gerberTurn`, `exclusionTurn`,
//        `mssTurn`. Kaptenen (svararen) spelar upp sitt eget beslut på
//        prefixet för att få sin egen avsikt (samma hand, samma auktion);
//        öppnaren läser trumfen ur auktionen. Där 4NT är tvetydigt ur
//        öppnarens stol (reverse/hoppskift utan inbjudan, 2♣ med egen solid
//        färg, 4NT över 1NT-återbudet — bok-mot-motor-fynd 6) tiger raden.
//      · raden *svar3*: svararens tredje bud ur egen hand
//        (`responderThirdDecision`): slamsekvensens första steg efter 2/1-
//        försenat stöd och NMF-stöd, placeringarna efter NMF / fjärde färg /
//        inverterad broms / 2NT-checkback, systems on-placeringen efter
//        2♣–2♦–2NT.
//      · raden *fjärde*: öppnarens fjärde bud — valet efter Smolen och
//        3NT-erbjudandet i systems on efter 2♣–2♦–2NT.

import type { Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'
import { hcp, lengths } from './hand'
import { gerberAsk, gerberRebidFirstStep, gerberTurn, quantitativeAnswer } from './nt-slam'
import { classifyOpening } from './openings'
import { openerAfterDelayedMinorSupport, openerAnswer2NTCheckback, openerAnswer2NTMajorSeek, openerAnswerFourthSuit, openerAnswerNMF, openerSecondBid, openerThirdBidAfterInvertedBrake, openerThirdBidAfterOwnRaise, openerThirdBidAfterReverse, openerThirdBidAfterSemiForcing1NT, openerThirdBidIn1NTAuction } from './rebids'
import { responderPlaceAfter2NTCheckback, responderPlaceAfterNMF, responderRebidIn2NTAuction, responderSecondBid } from './responder-rebids'
import { openerRebidAfter2NTResponse } from './responses-2nt'
import { respondToGerber } from './slam'
import { exclusionFirstStep, exclusionTurn, familyAFitTrump, mssFirstStep, mssSetup, mssTurn, slamCaptainFirstStep, slamTurn, type SlamBid, type SlamContext, type SlamRole, type SlamSetup, type SlamTurn } from './slam-auction'
import { openerChoosesAfterSystemsOn, systemsOnFirstStep } from './strong-2nt-systemson'
import { respondToMajor, respondToMinor, type ResponseResult } from './responses'
import { respondToMajorPassed } from './responses-drury'
import { respondTo1NT } from './responses-nt'
import { respondTo2C } from './responses-2c'
import { respondTo2NT, respondTo3NT } from './responses-2nt'
import { preemptOf, respondToPreempt } from './responses-preempt'
import { respondToWeakTwo, suitOfWeakTwo } from './responses-weak2'
import { hasStopper } from './overcalls'

/** Ett beslutat bud. `uncertain` följer med från kunskapsfunktionen (manusets `AuctionTurn` visar den). */
export interface DecidedCall extends ResolvedCall {
  uncertain?: boolean
  /**
   * Budet PLACERAR kontraktet för min del (svararens utgångsplacering efter
   * 2♣ med fit, 6NT-avslutet, 2/1-utgången): partnern har inget att tillägga.
   * Manuset (`auction.ts`) läser flaggan för att lämna auktionen stängd åt det
   * gamla lagret — samma gräns som manusets tidigare `final`-plan.
   */
  avslut?: boolean
}

/** Tabellens svar: budet + källan (`tabell:<familj>`, syns i auktionsdumpen). */
export interface Decision {
  call: DecidedCall
  källa: string
}

/** Allt en stol får veta: egen hand, auktionsläget (ur auktionen ensam) och sin sårbarhet. */
export interface Situation {
  hand: Hand
  facts: AuctionFacts
  vulnerable: boolean
}

interface Row {
  /** Familjens namn — blir källan `tabell:<id>`. */
  id: string
  /** Läget: när gäller raden? Bara fakta, aldrig handen. */
  läge: (f: AuctionFacts) => boolean
  /** Valet: kunskapsfunktionen som ger budet ur handen + läget. null = ingen regel för det här svaret än (nästa rad, sedan det gamla lagret). */
  välj: (s: Situation) => DecidedCall | null
}

/** Position i varvet från given (1:a–4:e hand) — bara meningsfull innan någon öppnat. */
function position(f: AuctionFacts): 1 | 2 | 3 | 4 {
  return (f.history.length + 1) as 1 | 2 | 3 | 4
}

/** Öppningar vi har svarsregler för. Övriga (4NT, 5♣ …) lämnas åt det gamla lagret. */
export const RESPONDABLE = new Set([
  '1C', '1D', '1H', '1S', '1NT', '2C', '2D', '2H', '2S', '2NT',
  '3C', '3D', '3H', '3S', '3NT', '4C', '4D', '4H', '4S',
])
const OPEN_SUIT: Record<string, 'clubs' | 'diamonds' | 'hearts' | 'spades'> = {
  '1C': 'clubs', '1D': 'diamonds', '1H': 'hearts', '1S': 'spades',
}

/**
 * Svararens första bud på partnerns ostörda öppning `openCall`, ur egen hand.
 * `responderPassed` = svararen är passad hand (Drury över 1♥/1♠, §6.7).
 * null = ingen svarsregel för det öppningsbudet. Delas av tabellraden och
 * manuset (`auction.ts`), så båda läser samma svar.
 */
export function responseDecision(openCall: string, hand: Hand, responderPassed = false): ResponseResult | null {
  if (!RESPONDABLE.has(openCall)) return null
  if (openCall === '2C') return respondTo2C(hand)
  const weak = suitOfWeakTwo(openCall)
  if (weak) return respondToWeakTwo(hand, weak)
  const preempt = preemptOf(openCall)
  if (preempt) return respondToPreempt(hand, preempt.suit, preempt.level)
  if (openCall === '1NT' || openCall === '2NT') {
    // NT-slam (§6.4): Gerber-handen frågar ess före den vanliga kedjan.
    const g = gerberAsk(hand, openCall)
    if (g) return { call: g.call as ResponseResult['call'], rule: g.rule, explanation: g.explanation }
    return openCall === '1NT' ? respondTo1NT(hand) : respondTo2NT(hand)
  }
  if (openCall === '3NT') return respondTo3NT(hand)
  const suit = OPEN_SUIT[openCall]
  if (suit === 'hearts' || suit === 'spades') {
    return responderPassed ? respondToMajorPassed(hand, suit) : respondToMajor(hand, suit)
  }
  return respondToMinor(hand, suit)
}

/**
 * Partnerns bud nr `index` SOM JAG SER DET: budet + den systemregel som
 * återbudsfunktionerna dispatchar på, härledd ur den NAKNA auktionen
 * (regler bortskalade — som om alla bud vore människobud). Så läser
 * öppnaren aldrig partnerns hand, och inte heller partnerns egen motivering
 * (t.ex. ett "oklart" 1NT-svar ser ut som vilket 1NT-svar som helst).
 * null = betydelselagret namnger inte budet → ingen regel att dispatcha på.
 */
export function partnerResponseAsSeen(f: AuctionFacts, index: number): ResponseResult | null {
  const naken = f.history.map((c) => ({ seat: c.seat, bid: c.bid }) as ResolvedCall)
  const m = meaningOf(naken, index)
  let rule = m.rule
  if (!rule) return null
  const bid = f.history[index].bid
  // Läsarens namn → återbudsfunktionens namn, där motorn själv använde flera
  // namn för samma bud (1m–1NT: '1NT'/'gap-hand 1NT'; 1NT–2NT: '2NT inbjudan').
  if (rule === 'NT-svar') rule = '1NT'
  if (rule === 'inbjudan' && bid === '2NT' && f.opening?.strain === 'NT') rule = '2NT inbjudan'
  return { call: bid, rule, explanation: m.text }
}

/**
 * Partnerns ÅTERBUD nr `index` som svararen ser det: bud + den regel som
 * svararens andra-buds-funktioner dispatchar på, härledd ur den NAKNA
 * auktionen. Läsaren använder registrets namn; där motorn själv använder ett
 * annat namn för samma bud översätts det här (tabellen nedan). Kontexten
 * (öppning + svar) avgör: efter 1M–1NT (semi-forcing) heter reverse/hoppskift/
 * hopp "rebid: …" i motorn. null = läsaren namnger inte budet.
 */
export function rebidAsSeen(f: AuctionFacts, index: number): ResponseResult | null {
  const naken = f.history.map((c) => ({ seat: c.seat, bid: c.bid }) as ResolvedCall)
  const m = meaningOf(naken, index)
  let rule = m.rule
  if (!rule) return null
  const bid = f.history[index].bid
  const open = f.opening!
  const openCall = `${open.level}${open.strain}`
  const respBid = f.ourContractBids[1]?.bid ?? ''
  const respStrain = parseContractBid(respBid)?.strain
  // Motorns namn beror på sammanhanget: efter ett 1-lägessvar i färg heter
  // höjning/rebud/2NT/utgång 'enkel höjning'/'rebjuden färg'/'2NT (18–19)'/
  // 'höjning till utgång'; efter 1M–1NT (semi-forcing) och svag tvåa behåller
  // de läsarens 'rebid: …'-namn. Efter 2♣ heter öppnarens naturliga färg
  // 'rebid: egen färg (GF)'. Adaptersvepet i auction-decide.test.ts vaktar.
  const oneLevelSuit = /^1[CDHS]$/.test(respBid)
  const semi = (openCall === '1H' || openCall === '1S') && respBid === '1NT'
  const cb = parseContractBid(bid)
  if (rule === 'rebid: stöd' && oneLevelSuit) rule = respStrain === 'C' || respStrain === 'D' ? 'höjning av minor' : 'enkel höjning'
  else if (rule === 'rebid: egen färg' && oneLevelSuit) rule = 'rebjuden färg'
  else if (rule === 'hopp i egen färg (inbjudan)' && semi) rule = 'rebid: hopp (inbjudan)'
  else if (rule === 'reverse' && semi) rule = 'rebid: reverse'
  else if (rule === 'hoppskift' && semi) rule = 'rebid: hoppskift'
  else if (rule === 'rebid: 2NT (18–19)' && oneLevelSuit) rule = '2NT (18–19)'
  else if (rule === 'rebid: utgång' && oneLevelSuit && cb && cb.strain === respStrain) rule = 'höjning till utgång'
  else if (rule === 'rebid: ny färg (GF)' && openCall === '2C') rule = 'rebid: egen färg (GF)'
  return { call: bid, rule, explanation: m.text }
}

/**
 * Partnerns ANDRA bud nr `index` som öppnaren ser det: bud + den regel som
 * öppnarens tredje-buds-funktioner dispatchar på, härledd ur den NAKNA
 * auktionen. Läsaren och motorn använder samma namn för allt tredje budet
 * beror på (NMF, fjärde färg, inbjudan, broms, preferens, checkback …); ett
 * undantag översätts här: efter 1M–1NT–2M säger motorn 'inbjudan' om
 * 3M-limithöjningen, läsaren 'inbjudan (limithöjning)'. Terminala namn (till
 * spel/utgång) skiljer sig men avgör inget tredje bud. Adaptersvepet i
 * auction-decide.test.ts vaktar. null = läsaren namnger inte budet.
 */
export function secondAsSeen(f: AuctionFacts, index: number): ResponseResult | null {
  const naken = f.history.map((c) => ({ seat: c.seat, bid: c.bid }) as ResolvedCall)
  const m = meaningOf(naken, index)
  let rule = m.rule
  if (!rule) return null
  const bid = f.history[index].bid
  const open = f.opening!
  const openCall = `${open.level}${open.strain}`
  const respBid = f.ourContractBids[1]?.bid ?? ''
  const rebidBid = f.ourContractBids[2]?.bid ?? ''
  const semi = (openCall === '1H' || openCall === '1S') && respBid === '1NT'
  if (rule === 'inbjudan (limithöjning)' && semi && rebidBid === `2${open.strain}`) rule = 'inbjudan'
  return { call: bid, rule, explanation: m.text }
}

/**
 * Ett senare bud nr `index` (öppnarens tredje, svararens placering …) som
 * partnern ser det: läsarens namn rakt av. Svararens tredje bud dispatchar
 * bara på öppnarens 'inverterad: stopp-visning' (samma namn i läsaren och
 * motorn); resten läser nivå/färg ur själva budet, så ett bud läsaren inte
 * namnger får tom regel i stället för att stoppa beslutet.
 */
export function thirdAsSeen(f: AuctionFacts, index: number): ResponseResult {
  const naken = f.history.map((c) => ({ seat: c.seat, bid: c.bid }) as ResolvedCall)
  const m = meaningOf(naken, index)
  return { call: f.history[index].bid, rule: m.rule ?? '', explanation: m.text }
}

const STRONG_2C_SHOWN_MIN = 22
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const isMajorSuit = (s: Suit) => s === 'hearts' || s === 'spades'
const suitOf = (call: string): Suit | null => {
  const cb = parseContractBid(call)
  return cb && cb.strain !== 'NT' ? SUIT_OF_LETTER[cb.strain] : null
}
const asResponse = (t: SlamTurn | ResponseResult): ResponseResult => ({ call: t.call as ResponseResult['call'], rule: t.rule, explanation: t.explanation })
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const STRAIN_ORDER = ['C', 'D', 'H', 'S', 'NT']
/** Budets rang i stegen (1♣=0 … 7NT=34); pass/X = -1. */
const bidRank = (call: string): number => {
  const cb = parseContractBid(call)
  return cb ? (cb.level - 1) * 5 + STRAIN_ORDER.indexOf(cb.strain) : -1
}
const isGameOrHigher = (call: string): boolean => {
  const cb = parseContractBid(call)
  if (!cb) return false
  return cb.level >= (cb.strain === 'NT' ? 3 : cb.strain === 'H' || cb.strain === 'S' ? 4 : 5)
}

// ---- Slamkontexten per läge ------------------------------------------------
//
// Vad kaptenen VET om partnern i varje slamgren — allt ur auktionen (regler +
// bud), aldrig ur någon hand. Trumfen ges utifrån: kaptenens första steg tar
// den ur egen hand, tabellens slamrad läser den ur auktionen. Delad av båda så
// att manuset och bordet aldrig räknar mot olika visade minimum.

/** Vad öppnarens Jacoby-/inverterade återbud visade (systembok §4.1/§4.2). */
const SHOWN_MIN: Record<string, number> = {
  'Jacoby: minimum': 12,
  'Jacoby: 3NT': 14,
  'Jacoby: slamintresse': 16,
  'Jacoby: sidofärg': 12,
  'Jacoby: kortfärg': 12,
  'inverterad: 3NT': 18,
  'inverterad: 2NT': 12,
  'inverterad: stopp-visning': 12,
  'inverterad: minimum': 12,
}

/**
 * Slamgrenens kontext efter öppning–svar–återbud, givet trumfen `trump`.
 * null = auktionen är ingen slamgren med den trumfen.
 */
export function slamContextFor(openCall: string, response: ResponseResult, rebid: ResponseResult, trump: Suit): { ctx: SlamContext; partnerShort?: Suit } | null {
  const openerSuit = suitOf(openCall)
  const respSuit = suitOf(response.call)
  const rebidSuit = suitOf(rebid.call)
  const majorTrump = isMajorSuit(trump)

  // Stark 2♣ + positivt svar (§4.4): trumf funnen → kaptenen räknar mot visade 22+
  // med cue-ronden öppen; egen solid färg utan fit → bara driv (4NT).
  if (openCall === '2C' && response.rule === '2♣-positivt') {
    const fitTrump = rebid.rule === 'rebid: stöd (GF)' ? respSuit : rebid.rule === 'rebid: egen färg (GF)' ? rebidSuit : null
    if (fitTrump && trump === fitTrump) {
      // Inbjudan: 5M, eller 4m över öppnarens 3m. Har öppnaren redan bjudit 4m
      // ÄR 5m utgången — partnern kan inte skilja den från en inbjudan, så
      // ingen inbjudningsväg finns där (familj 5, 2026-09-05).
      const inviteCall = majorTrump
        ? `5${LETTER[trump]}`
        : rebid.call === `4${LETTER[trump]}`
          ? undefined
          : `4${LETTER[trump]}`
      return { ctx: { partnerMin: STRONG_2C_SHOWN_MIN, inviteCall, gameForcing: true, cueFloor: majorTrump ? undefined : '3NT' } }
    }
    if (respSuit && trump === respSuit) return { ctx: { partnerMin: STRONG_2C_SHOWN_MIN } }
    return null
  }

  // Hopp i egen minor (1m–1M–3m, visade 16–18 med 6+) + 3+ fit → slamport.
  if (
    (openCall === '1C' || openCall === '1D') &&
    response.rule === 'ny färg (1-läget)' &&
    rebid.rule === 'hopp i egen färg (inbjudan)' &&
    openerSuit && rebidSuit === openerSuit && trump === openerSuit
  ) {
    return { ctx: { partnerMin: 16, inviteCall: `4${LETTER[openerSuit]}` } }
  }

  // Hopphöjning av min högfärg (1x–1M–3M, visade 16–18 med 4-korts stöd).
  const respMajor = response.call === '1H' ? 'hearts' : response.call === '1S' ? 'spades' : null
  if (rebid.rule === 'hopphöjning (inbjudan)' && respMajor && rebidSuit === respMajor && trump === respMajor) {
    return { ctx: { partnerMin: 16, inviteCall: `5${LETTER[respMajor]}` } }
  }

  // Reverse (16+) / hoppskift (19+): trumf = öppnarens andra eller första färg.
  if ((rebid.rule === 'reverse' || rebid.rule === 'hoppskift') && rebidSuit && openerSuit && (trump === rebidSuit || trump === openerSuit)) {
    return { ctx: { partnerMin: rebid.rule === 'hoppskift' ? 19 : 16, inviteCall: majorTrump ? `5${LETTER[trump]}` : `4${LETTER[trump]}` } }
  }

  // Överenskommen trumf via Jacoby 2NT / inverterad minor → kaptenen räknar
  // mot vad öppnarens återbud visade (visat minimum per regel).
  const majorFit = response.rule === 'Jacoby 2NT' && (openerSuit === 'hearts' || openerSuit === 'spades')
  const minorFit = response.rule === 'inverterad minor' && (openerSuit === 'clubs' || openerSuit === 'diamonds')
  if ((majorFit || minorFit) && openerSuit && trump === openerSuit) {
    const openerShort = rebid.rule === 'Jacoby: kortfärg' ? (rebidSuit ?? undefined) : undefined
    return {
      ctx: {
        partnerMin: SHOWN_MIN[rebid.rule] ?? 12,
        inviteCall: majorFit ? `5${LETTER[openerSuit]}` : `4${LETTER[openerSuit]}`,
        gameForcing: true,
        cueFloor: minorFit ? '3NT' : undefined,
      },
      partnerShort: openerShort,
    }
  }

  // Öppnarens 1NT-återbud (12–14, familj A): säker fit på egen hand → hp mot
  // visade 12–14 (§5.2): ingen bjuden fit, kortfärger lyfter inte.
  if (response.rule === 'ny färg (1-läget)' && rebid.rule === '1NT (12–14)' && ((respMajor && trump === respMajor) || (openerSuit && !isMajorSuit(openerSuit) && trump === openerSuit))) {
    // Inbjudan 5M/4♦. I KLÖVER finns ingen: 4♣ över 1NT-återbudet ÄR Gerber (§6.4),
    // så samma bud kan inte också vara en klöverinbjudan (familj 5, 2026-09-05;
    // bok-mot-motor-fynd 15 — §5.7 säger "4m", §6.4 säger Gerber).
    const inviteCall = majorTrump ? `5${LETTER[trump]}` : trump === 'diamonds' ? '4D' : undefined
    return { ctx: { partnerMin: 12, inviteCall, hpOnly: true } }
  }

  return null
}

/**
 * Slamgrenens kontext efter öppnarens TREDJE bud (familj 4b:s slamgrenar):
 * 2/1 med försenat lågfärgsstöd (kaptenen räknar mot 2NT:s visade 12, cue-
 * ronden över 3NT) och NMF där öppnaren visade 3-korts stöd (5-3-fit satt;
 * hoppet 3M = maximum 14). Trumfen läses ur `slamTrumpAfterThird`. null = ingen.
 */
export function slamContextAfterThird(openCall: string, response: ResponseResult, second: ResponseResult, third: ResponseResult, trump: Suit): { ctx: SlamContext } | null {
  const openerSuit = suitOf(openCall)
  const respSuit = suitOf(response.call)
  if (second.rule === '2/1: försenat stöd' && openerSuit && !isMajorSuit(openerSuit) && trump === openerSuit) {
    return {
      ctx: {
        partnerMin: 12,
        // 4m över 3NT-förslaget inbjuder; över öppnarens 4m är 5m utgången (ingen inbjudan).
        inviteCall: third.call === '3NT' ? `4${LETTER[openerSuit]}` : undefined,
        gameForcing: true,
        cueFloor: '3NT',
      },
    }
  }
  if (second.rule === 'New Minor Forcing' && respSuit && isMajorSuit(respSuit) && suitOf(third.call) === respSuit && trump === respSuit) {
    return { ctx: { partnerMin: third.call.startsWith('3') ? 14 : 12, inviteCall: `5${LETTER[respSuit]}`, gameForcing: true } }
  }
  return null
}

/** Trumfen i familj 4b:s slamgrenar — entydig ur auktionen (fit bjuden av båda). */
function slamTrumpAfterThird(openCall: string, response: ResponseResult, second: ResponseResult, third: ResponseResult): Suit | null {
  const openerSuit = suitOf(openCall)
  const respSuit = suitOf(response.call)
  if (second.rule === '2/1: försenat stöd' && openerSuit && !isMajorSuit(openerSuit)) return openerSuit
  if (second.rule === 'New Minor Forcing' && respSuit && isMajorSuit(respSuit) && suitOf(third.call) === respSuit) return respSuit
  return null
}

/**
 * Trumfen i en slamsekvens efter öppning–svar–återbud, läst ur AUKTIONEN
 * (öppnarens stol — hen ser inte kaptenens hand). Entydig där fiten är bjuden
 * eller konventionellt satt (Jacoby, inverterad, hopphöjning, hopp i egen
 * minor, 2♣ med stöd); i de tvetydiga grenarna (reverse/hoppskift, 2♣ med
 * egen färg, 1NT-återbudet) syns trumfen bara i kaptenens INBJUDNINGSBUD
 * (5M/4m) eller — 2♣-grenen — i ett kontrollbud över 3NT som sätter
 * öppnarens färg. Ett naket 4NT där är tvetydigt (bok-mot-motor-fynd 6):
 * null → det gamla lagret som förut.
 */
function slamTrumpFromAuction(openCall: string, response: ResponseResult, rebid: ResponseResult, firstSlamCall: string): Suit | null {
  const openerSuit = suitOf(openCall)
  const respSuit = suitOf(response.call)
  const rebidSuit = suitOf(rebid.call)
  const respMajor: Suit | null = response.call === '1H' ? 'hearts' : response.call === '1S' ? 'spades' : null

  if (openCall === '2C' && response.rule === '2♣-positivt') {
    if (rebid.rule === 'rebid: stöd (GF)') return respSuit
    if (rebid.rule === 'rebid: egen färg (GF)' && rebidSuit) {
      // Öppnarens egen färg utan bjuden fit (familj 6, 2026-09-05 — förut tiger):
      //  · 4NT = essfrågan i SENAST BJUDNA FÄRG, öppnarens (samma regel som det
      //    gamla lagret svarar en människa efter, `slamAskTrump`). Kaptenen som
      //    frågade med en egen självbärande färg i tankarna (§4.4 "utan trumf")
      //    får sin egen avsikt via `captainIntent`; att de två kan skilja sig
      //    åt är bok-mot-motor-fynd 14 (ägarbeslut).
      //  · Ett kontrollbud i NY färg (inte kaptenens egen) över öppnarens färg
      //    och under dess utgång sätter öppnarens färg — betydelselagrets
      //    konvention (etapp 1): den balanserade 2♣-svararen cue:ar redan på
      //    3-läget; efter ett färgpositivt bara högfärgen. Kaptenens rebud i
      //    EGEN färg (2♣–3♦–3♥–4♦) är fortfarande naturligt i kravvakten och
      //    cue i manuset (etapp 1-fynd 7, facit frö 20271084 i kön) → tiger.
      if (firstSlamCall === '4NT') return rebidSuit
      // Slaminbjudan i öppnarens färg (5M / 4m över 3m, §4.4 "31–32") — öppnaren dömer.
      if (slamContextFor(openCall, response, rebid, rebidSuit)?.ctx.inviteCall === firstSlamCall) return rebidSuit
      const cueSuit = suitOf(firstSlamCall)
      const balanced = response.call === '2NT'
      const floor = isMajorSuit(rebidSuit) ? `3${LETTER[rebidSuit]}` : '3NT'
      const game = isMajorSuit(rebidSuit) ? `4${LETTER[rebidSuit]}` : `5${LETTER[rebidSuit]}`
      if (
        cueSuit && cueSuit !== rebidSuit && cueSuit !== respSuit &&
        (balanced || isMajorSuit(rebidSuit)) &&
        bidRank(firstSlamCall) > bidRank(floor) && bidRank(firstSlamCall) < bidRank(game)
      ) return rebidSuit
    }
    return null
  }
  if ((openCall === '1C' || openCall === '1D') && response.rule === 'ny färg (1-läget)' && rebid.rule === 'hopp i egen färg (inbjudan)' && openerSuit && rebidSuit === openerSuit) return openerSuit
  if (rebid.rule === 'hopphöjning (inbjudan)' && respMajor && rebidSuit === respMajor) return respMajor
  if (rebid.rule === 'reverse' || rebid.rule === 'hoppskift') {
    for (const t of [rebidSuit, openerSuit]) {
      if (t && slamContextFor(openCall, response, rebid, t)?.ctx.inviteCall === firstSlamCall) return t
    }
    return null
  }
  if (response.rule === 'Jacoby 2NT' && openerSuit && isMajorSuit(openerSuit)) return openerSuit
  if (response.rule === 'inverterad minor' && openerSuit && !isMajorSuit(openerSuit)) return openerSuit
  if (response.rule === 'ny färg (1-läget)' && rebid.rule === '1NT (12–14)') {
    for (const t of [respMajor, openerSuit && !isMajorSuit(openerSuit) ? openerSuit : null]) {
      if (t && slamContextFor(openCall, response, rebid, t)?.ctx.inviteCall === firstSlamCall) return t
    }
    return null
  }
  return null
}

/**
 * Svararens plan bakom sitt andra bud. Sedan familj 6 (2026-09-05) läser
 * ingen manuskod planen: slamgrenarnas fortsättning spelas tur för tur ur EN
 * hand genom raden *slam*; `final` blir flaggan `avslut` på budet.
 */
export type SecondPlan =
  | { kind: 'call' }
  | { kind: 'final' }
  | { kind: 'slam'; setup: SlamSetup }
  | { kind: 'exclusion'; trump: Suit; partnerMin: number }
  | { kind: 'mss'; minor: Suit; rebidCall: string }
  /** Gerber 4♣ över 1NT-återbudet (jämn 21+) eller kvantitativ 4NT (19–20); med `suit`: essfrågan för en egen självbärande färg, placeringen blir 6/7 i den (§5.7). */
  | { kind: 'gerberRebid'; suit?: Suit }

export interface SecondDecision {
  turn: ResponseResult
  plan: SecondPlan
}

/**
 * Svararens ANDRA bud på partnerns ostörda återbud, ur egen hand: manusets
 * grenar i samma ordning, där varje slamgren ger kaptenens första steg
 * (`slamCaptainFirstStep` m.fl. — bara egen hand + partnerns visade minimum;
 * kontexten ur `slamContextFor`). `response` = mitt eget svar, `rebid` =
 * partnerns återbud, båda som de ses i auktionen. null = ingen regel (det
 * gamla lagret tar vid).
 */
export function responderSecondDecision(openCall: string, response: ResponseResult, rebid: ResponseResult, hand: Hand): SecondDecision | null {
  if (rebid.call === 'P') return null
  const openerSuit = suitOf(openCall)
  const rl = lengths(hand)
  const slamStep = (trump: Suit): SecondDecision | null => {
    const c = slamContextFor(openCall, response, rebid, trump)
    if (!c) return null
    const first = slamCaptainFirstStep(hand, trump, rebid.call, c.ctx, c.partnerShort)
    return first ? { turn: asResponse(first), plan: { kind: 'slam', setup: { trump, lastCall: rebid.call, ctx: c.ctx, partnerShort: c.partnerShort } } } : null
  }

  // Systems on efter 2♣–2♦–2NT (22–24): Stayman/transfer som mot 2NT; resten
  // av sekvensen går genom raderna tredje/svar3/fjärde.
  if (openCall === '2C' && response.call === '2D' && rebid.call === '2NT') {
    const so = systemsOnFirstStep(hand)
    if (so) return { turn: so, plan: { kind: 'call' } }
  }

  // Slamutredning efter stark 2♣ + positivt svar (§4.4): trumf funnen →
  // kaptenen räknar mot visade 22+; annars egen solid färg / 6NT mot 3NT.
  if (openCall === '2C' && response.rule === '2♣-positivt') {
    const respSuit = suitOf(response.call)
    const rebidSuit = suitOf(rebid.call)
    const trump2C =
      rebid.rule === 'rebid: stöd (GF)' && respSuit
        ? respSuit
        : rebid.rule === 'rebid: egen färg (GF)' && rebidSuit && rl[rebidSuit] >= 3
          ? rebidSuit
          : null
    if (trump2C) {
      const majorTrump = isMajorSuit(trump2C)
      const gameCall = majorTrump ? `4${LETTER[trump2C]}` : `5${LETTER[trump2C]}`
      const slam = slamStep(trump2C)
      if (slam) return slam
      return {
        turn: {
          call: gameCall as ResponseResult['call'],
          rule: rebid.rule === 'rebid: stöd (GF)' ? 'till spel' : 'höjning (GF)',
          explanation: `under slamzonen mot partnerns visade ${STRONG_2C_SHOWN_MIN}+ → ${gameCall[0]}${SYM[trump2C]} (utgång).`,
        },
        plan: { kind: 'final' },
      }
    }
    if (hcp(hand) + STRONG_2C_SHOWN_MIN >= 33) {
      const topHonors = respSuit ? hand.filter((c) => c.suit === respSuit && (c.rank === 'A' || c.rank === 'K' || c.rank === 'Q')).length : 0
      const ownSolid = respSuit && rl[respSuit] >= 6 && topHonors >= 2 ? respSuit : null
      const slam = ownSolid ? slamStep(ownSolid) : null
      if (slam) return slam
      if (rebid.rule === 'rebid: 3NT (GF)') {
        return { turn: { call: '6NT', rule: 'slamavslut', explanation: `Slamzon mot visad balanserad ${STRONG_2C_SHOWN_MIN}+ → 6NT (sang behöver ingen fit).` }, plan: { kind: 'final' } }
      }
    }
  }

  // Hopp i egen minor (1m–1M–3m, visade 16–18 med 6+) + 3+ fit → slamport.
  if (
    (openCall === '1C' || openCall === '1D') &&
    response.rule === 'ny färg (1-läget)' &&
    rebid.rule === 'hopp i egen färg (inbjudan)' &&
    openerSuit && suitOf(rebid.call) === openerSuit &&
    rl[openerSuit] >= 3
  ) {
    const slam = slamStep(openerSuit)
    if (slam) return slam
  }

  // Hopphöjning av min högfärg (1x–1M–3M, visade 16–18 med 4-korts stöd).
  const respMajor = response.call === '1H' ? 'hearts' : response.call === '1S' ? 'spades' : null
  if (rebid.rule === 'hopphöjning (inbjudan)' && respMajor && suitOf(rebid.call) === respMajor) {
    const slam = slamStep(respMajor)
    if (slam) return slam
  }

  // Reverse (16+) / hoppskift (19+): trumf säkrad på EGEN kunskap.
  if (rebid.rule === 'reverse' || rebid.rule === 'hoppskift') {
    const secondSuit = suitOf(rebid.call)
    const firstSuitMin = rebid.rule === 'reverse' || openerSuit === 'hearts' || openerSuit === 'spades' ? 3 : 4
    const trumpC =
      secondSuit && rl[secondSuit] >= 4
        ? secondSuit
        : openerSuit && rl[openerSuit] >= firstSuitMin
          ? openerSuit
          : null
    if (trumpC) {
      const slam = slamStep(trumpC)
      if (slam) return slam
    }
  }

  // Överenskommen trumf via Jacoby 2NT / inverterad minor → kaptenen räknar
  // mot vad öppnarens återbud visade (visat minimum per regel).
  const majorFit = response.rule === 'Jacoby 2NT' && (openerSuit === 'hearts' || openerSuit === 'spades')
  const minorFit = response.rule === 'inverterad minor' && (openerSuit === 'clubs' || openerSuit === 'diamonds')
  if ((majorFit || minorFit) && openerSuit) {
    const slam = slamStep(openerSuit)
    if (slam) return slam
  }

  // Exclusion efter splinter + relä (öppnarens slamintresse, visat minimum 15).
  if (response.rule === 'tvetydig splinter' && rebid.rule === 'splinter-relä' && (openerSuit === 'hearts' || openerSuit === 'spades')) {
    const first = exclusionFirstStep(hand, openerSuit, 15)
    if (first) return { turn: asResponse(first), plan: { kind: 'exclusion', trump: openerSuit, partnerMin: 15 } }
  }

  // MSS: minorfit funnen efter 1NT–2♠–3m.
  if (openCall === '1NT' && response.rule === 'Minor Suit Stayman' && (rebid.call === '3C' || rebid.call === '3D')) {
    const minor: Suit = rebid.call === '3C' ? 'clubs' : 'diamonds'
    return { turn: asResponse(mssFirstStep(hand, minor, rebid.call)), plan: { kind: 'mss', minor, rebidCall: rebid.call } }
  }

  // Öppnarens 1NT-återbud (12–14): jämn 19+ → Gerber/kvantitativ; säker fit → slamport.
  if (response.rule === 'ny färg (1-läget)' && rebid.rule === '1NT (12–14)') {
    const g = gerberRebidFirstStep(hand)
    if (g) return { turn: asResponse(g), plan: { kind: 'gerberRebid' } }
    const trump = familyAFitTrump(hand, openerSuit, suitOf(response.call))
    if (trump) {
      const slam = slamStep(trump)
      // Drivzonen frågar med GERBER 4♣, inte 4NT (familj 6, 2026-09-05): 4NT
      // direkt över partnerns sang-återbud är kvantitativt (§5.7, den jämna
      // 19–20-handen) och partnern kan inte se att jag menar min egen färg.
      // 4♣ är entydigt ess-fråga (§6.4), och placeringen blir 6 i min färg.
      if (slam && slam.turn.call === '4NT') {
        return {
          turn: { call: '4C', rule: 'Gerber', explanation: `Självbärande ${SYM[trump]} och slamzon mot visade 12–14 → 4♣ (Gerber, frågar ess — placerar sedan i ${SYM[trump]}).` },
          plan: { kind: 'gerberRebid', suit: trump },
        }
      }
      if (slam) return slam
    }
  }

  // Öppnaren HÖJDE min 2-över-1-HÖGFÄRG under utgång (1♠–2♥–3♥): trumfen är
  // satt och utgångskravet står → utgång 4M (felrapport #27; §5.3-fortsättningen
  // saknar fallet eftersom boten själv höjer direkt till utgång). En höjd
  // lågfärg fortsätter som förut i `responderRebidIn2over1Auction` (3NT med
  // stopp, naturlig högfärg, 5m sist). Slamutredningen här (cue-ronden med
  // satt trumf) hör till familj 5.
  if (response.rule === '2-över-1 GF') {
    const rs = suitOf(response.call)
    const rb = parseContractBid(rebid.call)
    if (rs && isMajorSuit(rs) && rb && rb.strain !== 'NT' && SUIT_OF_LETTER[rb.strain] === rs && rb.level < 4) {
      return {
        turn: { call: `4${LETTER[rs]}` as ResponseResult['call'], rule: '2/1 utgångskrav', explanation: `Vårt 2-över-1-svar var utgångskrav och partnern höjde min ${SYM[rs]} → jag sätter utgång 4${SYM[rs]} (pass förbjudet).` },
        plan: { kind: 'final' },
      }
    }
  }

  const second = responderSecondBid(openCall, response, rebid, hand)
  return second ? { turn: second, plan: { kind: 'call' } } : null
}

/**
 * Öppnarens återbud på partnerns ostörda svar `seen` (bud + regel som öppnaren
 * ser det), ur egen hand. Gerber 4♣ besvaras med esssvaret; annars
 * `openerSecondBid`. null = ingen regel för svaret. Delas av tabellraden och
 * manuset (`auction.ts`).
 */
export function openerRebidDecision(openCall: string, seen: ResponseResult, hand: Hand): ResponseResult | null {
  if (seen.rule === 'Gerber' && seen.call === '4C' && (openCall === '1NT' || openCall === '2NT')) return respondToGerber(hand)
  return openerSecondBid(openCall, seen, hand)
}

/**
 * Öppnarens TREDJE bud på partnerns ostörda andra bud, ur egen hand: manusets
 * grenar i samma ordning. `response` = partnerns svar, `rebid` = mitt eget
 * återbud, `second` = partnerns andra bud — alla som de ses i auktionen.
 * null = ingen regel för läget (det gamla lagret tar vid: utgångsbud som
 * passas, 2/1-fortsättningar, preferens utan reverse …). Delas av tabellraden
 * och manuset (`auction.ts`).
 */
export function openerThirdDecision(openCall: string, response: ResponseResult, rebid: ResponseResult, second: ResponseResult, hand: Hand): ResponseResult | null {
  if (second.call === 'P') return null
  const openerSuit = suitOf(openCall)
  const respSuit = suitOf(response.call)

  // Systems on efter mitt 2NT-återbud på 2♣–2♦ (22–24): Stayman/transfer/
  // Texas/minorfråga/kvantitativ 4NT besvaras som mot en 2NT-öppning.
  if (openCall === '2C' && response.call === '2D' && rebid.call === '2NT') {
    return openerRebidAfter2NTResponse(second, hand, 24)
  }

  // 2NT-öppningen: efter svararens placering väljer öppnaren — Smolen (4 i
  // 5-färgen med 3+ stöd, annars 3NT) och 3NT-erbjudandet efter transfer
  // (4M med 3+ stöd). Annat är redan placerat.
  if (openCall === '2NT') return openerChoosesAfterSystemsOn(hand, response, second)

  // 2/1 med FÖRSENAT stöd i öppnarens lågfärg (1m–2m'–2NT–3m, felrapport #58):
  // öppnaren beskriver (3NT-förslag / 4m); kaptenen räknar sedan mot visade 12.
  if (second.rule === '2/1: försenat stöd' && openerSuit && !isMajorSuit(openerSuit)) {
    return openerAfterDelayedMinorSupport(hand, openerSuit)
  }

  // New Minor Forcing (§5.7, krav): öppnaren svarar alltid.
  if (second.rule === 'New Minor Forcing' && openerSuit && respSuit && isMajorSuit(respSuit)) {
    const nmfMinor = suitOf(second.call)
    if (nmfMinor) {
      const unbid = RANK.find((s) => s !== openerSuit && s !== respSuit && s !== nmfMinor)!
      return openerAnswerNMF(hand, openerSuit, respSuit, nmfMinor, unbid)
    }
  }

  // Fjärde färg (§6.6, utgångskrav): öppnaren beskriver. Svarsfunktionen är
  // byggd för bokens mönster — tre 1-lägesbud och fjärde färgen billigast på
  // 2-läget (kunde den bjudits på 1-läget är den naturlig). Annat → gamla lagret.
  if (second.rule === 'fjärde färg krav' && openerSuit && respSuit) {
    const secondSuit = suitOf(rebid.call)
    const fourth = suitOf(second.call)
    const cb = parseContractBid(second.call)
    if (secondSuit && fourth && cb && cb.level === 2 && response.call.startsWith('1') && rebid.call.startsWith('1') && RANK.indexOf(fourth) < RANK.indexOf(secondSuit)) {
      return openerAnswerFourthSuit(hand, openerSuit, secondSuit, respSuit, fourth)
    }
  }

  // Inbjudan i en 1NT-auktion (Stayman/transfer, felrapport #37).
  if (openCall === '1NT' && second.rule === 'inbjudan') {
    const t = openerThirdBidIn1NTAuction(response, rebid, second, hand)
    if (t) return t
  }

  // Efter semi-forcing 1NT: inbjudan (3M/2NT/höjning) eller svararens egen
  // färg till spel (etapp 5 fix 2, felrapport #59).
  if ((openCall === '1H' || openCall === '1S') && response.rule === 'semi-forcing 1NT' && (second.rule.startsWith('inbjudan') || second.rule === 'ny färg efter 1NT')) {
    const t = openerThirdBidAfterSemiForcing1NT(hand, openerSuit as 'hearts' | 'spades', rebid, second)
    if (t) return t
  }

  // Min enkla höjning av partnerns 1M + partnerns 3M-inbjudan: öppnaren
  // svarar alltid (systemfel #3 delfix 4b).
  if ((response.call === '1H' || response.call === '1S') && rebid.rule === 'enkel höjning' && second.rule === 'inbjudan' && second.call === `3${response.call[1]}`) {
    return openerThirdBidAfterOwnRaise(hand, respSuit as 'hearts' | 'spades')
  }

  // Svararens broms efter min stopp-visning i den inverterade minorn (B13).
  if (second.rule === 'inverterad: broms' && openerSuit && !isMajorSuit(openerSuit)) {
    return openerThirdBidAfterInvertedBrake(hand, openerSuit, suitOf(rebid.call))
  }

  // Min reverse + partnerns preferens tillbaka (delfix 4c).
  if (rebid.rule === 'reverse' && second.rule === 'preferens' && openerSuit && respSuit) {
    const reverseSuit = suitOf(rebid.call)
    if (reverseSuit) return openerThirdBidAfterReverse(hand, openerSuit, respSuit, reverseSuit, second.call)
  }

  // Systems on efter mitt 2NT-återbud: checkback resp. direkt 3M (5-3-jakt).
  if (second.rule === '2NT-checkback' && respSuit) return openerAnswer2NTCheckback(hand, respSuit)
  if (second.rule === '2NT-återbud (5-3-jakt)' && respSuit) return openerAnswer2NTMajorSeek(hand, respSuit)

  return null
}

/** Svararens plan bakom sitt tredje bud (slamgrenen fortsätter genom raden *slam*). */
export type ThirdPlan = { kind: 'call' } | { kind: 'slam'; setup: SlamSetup }

export interface ThirdDecision {
  turn: ResponseResult
  plan: ThirdPlan
}

/**
 * Svararens TREDJE bud på öppnarens ostörda tredje bud, ur egen hand: slam-
 * sekvensens första steg där öppnarens tredje bud satte trumfen (2/1 försenat
 * stöd, NMF-stöd), annars placeringarna (NMF, fjärde färg, inverterad broms,
 * 2NT-checkback) och systems on-placeringen efter 2♣–2♦–2NT. `response`/
 * `second` = mina bud, `rebid`/`third` = partnerns, alla som de ses i
 * auktionen. null = ingen regel (det gamla lagret tar vid: fjärde färg med
 * 18+ hp, utgångsbud som passas …). Delas av tabellraden och manuset.
 */
export function responderThirdDecision(openCall: string, response: ResponseResult, rebid: ResponseResult, second: ResponseResult, third: ResponseResult, hand: Hand): ThirdDecision | null {
  if (third.call === 'P') return null
  const openerSuit = suitOf(openCall)
  const respSuit = suitOf(response.call)
  const slamStep = (trump: Suit): ThirdDecision | null => {
    const c = slamContextAfterThird(openCall, response, second, third, trump)
    if (!c) return null
    const first = slamCaptainFirstStep(hand, trump, third.call, c.ctx)
    return first ? { turn: asResponse(first), plan: { kind: 'slam', setup: { trump, lastCall: third.call, ctx: c.ctx } } } : null
  }

  // Systems on efter 2♣–2♦–2NT: svararen placerar (Smolen / 4M / 3NT / pass).
  if (openCall === '2C' && response.call === '2D' && rebid.call === '2NT') {
    const p = responderRebidIn2NTAuction(second, third, hand, 22)
    return p ? { turn: p, plan: { kind: 'call' } } : null
  }

  // 2/1 med FÖRSENAT stöd (ägarbeslut 2026-09-03, felrapport #58): 1m–2m'–2NT–3m
  // satte trumf med slamintresse; öppnaren har beskrivit (3NT-förslag / 4m).
  // Nu räknar kaptenen mot 2NT:s visade 12 (ärliga slamportar): cue-ronden
  // över 3NT, driv 33+, inbjudan 31–32 — annars placeras utgången.
  if (second.rule === '2/1: försenat stöd' && openerSuit && !isMajorSuit(openerSuit)) {
    const slam = slamStep(openerSuit)
    if (slam) return slam
    const place: ResponseResult =
      third.call === '3NT'
        ? { call: 'P', rule: 'svararens pass', explanation: `Under slamzonen mot visade 12 → 3NT står (pass).` }
        : { call: `5${LETTER[openerSuit]}` as ResponseResult['call'], rule: 'höjning till utgång', explanation: `Under slamzonen → 5${SYM[openerSuit]} (utgång i den satta trumfen).` }
    return { turn: place, plan: { kind: 'call' } }
  }

  // NMF (§5.7): visade öppnaren 3-korts stöd i min högfärg är 5-3-fiten
  // satt → cue-ronden är gratis under utgång (§6.2); annars placeringen.
  if (second.rule === 'New Minor Forcing' && openerSuit && respSuit && isMajorSuit(respSuit)) {
    const nmfMinor = suitOf(second.call)
    if (!nmfMinor) return null
    // Cue-ronden är gratis bara i UTGÅNGSKRAV: NMF med 11–12 var en inbjudan,
    // så bara 13+ (GF) går in i slamsekvensen; annars placeras kontraktet.
    if (suitOf(third.call) === respSuit && lengths(hand)[respSuit] >= 5 && hcp(hand) >= 13) {
      const slam = slamStep(respSuit)
      if (slam) return slam
    }
    const otherMajor: Suit = respSuit === 'hearts' ? 'spades' : 'hearts'
    const unbid = RANK.find((s) => s !== openerSuit && s !== respSuit && s !== nmfMinor)!
    const cb = parseContractBid(third.call)!
    return { turn: responderPlaceAfterNMF(hand, respSuit, otherMajor, nmfMinor, openerSuit, unbid, { level: cb.level, strain: cb.strain }), plan: { kind: 'call' } }
  }

  // Fjärde färg (§6.6): öppnaren har beskrivit → placerar utgången: höjde
  // öppnaren min högfärg → 4 i den, annars 3NT. Bara MODESTA utgångshänder;
  // 18+ har slamintresse och går den gamla vägen (felrapport #42).
  if (second.rule === 'fjärde färg krav' && respSuit) {
    if (isGameOrHigher(third.call) || hcp(hand) >= 18) return null
    if (isMajorSuit(respSuit) && suitOf(third.call) === respSuit && bidRank(`4${LETTER[respSuit]}`) > bidRank(third.call)) {
      return { turn: { call: `4${LETTER[respSuit]}` as ResponseResult['call'], rule: 'fjärde färg: utgång i fit', explanation: `Fjärde färg var krav; partnern höjde min ${SYM[respSuit]} → utgång 4${SYM[respSuit]}.` }, plan: { kind: 'call' } }
    }
    if (bidRank('3NT') <= bidRank(third.call)) return null // öppnaren ligger redan över 3NT (hoppande fjärde färg) → gamla lagret
    return { turn: { call: '3NT', rule: 'fjärde färg: placerar utgång', explanation: `Fjärde färg var krav (utgångsvärden); partnern har beskrivit sin hand → placerar 3NT.` }, plan: { kind: 'call' } }
  }

  // B13 (2026-08-07): efter öppnarens ANDRA stopp-visning över min broms
  // täcker jag resten (3NT) eller tar 5m.
  if (second.rule === 'inverterad: broms' && third.rule === 'inverterad: stopp-visning' && openerSuit && !isMajorSuit(openerSuit)) {
    const shown1 = suitOf(rebid.call)
    const shown2 = suitOf(third.call)
    const rest = RANK.filter((s) => s !== openerSuit && s !== shown1 && s !== shown2)
    const turn: ResponseResult = rest.every((s) => hasStopper(hand, s))
      ? { call: '3NT', rule: '3NT till spel', explanation: `Öppnaren driver (15+) och resten är täckt → 3NT (till spel).` }
      : { call: `5${LETTER[openerSuit]}` as ResponseResult['call'], rule: 'höjning till utgång', explanation: `Öppnaren driver (15+) men 3NT är otäckt → 5${SYM[openerSuit]} (minorutgång).` }
    return { turn, plan: { kind: 'call' } }
  }

  // Systems on: efter öppnarens svar på checkbacken placerar jag 4-4-fiten
  // / 5-3-fiten eller passar 3NT.
  if (second.rule === '2NT-checkback' && respSuit) {
    return { turn: responderPlaceAfter2NTCheckback(hand, respSuit, third), plan: { kind: 'call' } }
  }

  return null
}

/**
 * Öppnarens FJÄRDE bud (efter sex ostörda kontraktsbud): valet efter Smolen
 * och 3NT-erbjudandet i systems on efter 2♣–2♦–2NT. `second` = partnerns
 * bud över 2NT, `fourth` = partnerns placering. null = ingen regel.
 */
export function openerFourthDecision(openCall: string, response: ResponseResult, rebid: ResponseResult, second: ResponseResult, fourth: ResponseResult, hand: Hand): ResponseResult | null {
  if (fourth.call === 'P') return null
  if (openCall === '2C' && response.call === '2D' && rebid.call === '2NT') return openerChoosesAfterSystemsOn(hand, second, fourth)
  return null
}

// ---- Slamsekvensen som den syns i auktionen ---------------------------------

/** En pågående slamsekvens läst ur auktionen ensam (öppnarens stol kan inte se mer). */
export interface SlamSituation {
  kind: 'slam' | 'gerber' | 'exclusion' | 'mss' | 'kvantitativ'
  captain: Seat
  /** Antal av vår sidas kontraktsbud före kaptenens första slambud. */
  prefix: number
  setup?: SlamSetup
  partnerMin?: number
  trump?: Suit
  minor?: Suit
  rebidCall?: string
  /** Gerber för en egen självbärande färg (§5.7): kaptenen placerar i den, inte i sang. Bara kaptenen vet. */
  placeSuit?: Suit
  /** Sekvensens bud hittills (från och med kaptenens första slambud). */
  sofar: SlamBid[]
}

/**
 * Läser den pågående slamsekvensen ur auktionen (bara fakta): ostörd, vår
 * sida bjöd öppning–svar–…, och kaptenens (svararens) första slambud finns.
 * null = ingen slamsekvens (eller en vars trumf inte går att läsa ur auktionen).
 */
export function slamSituation(f: AuctionFacts): SlamSituation | null {
  const open = f.opening
  if (!open || f.theirContractBids.length > 0) return null
  if (f.history.some((c) => c.bid === 'X' || c.bid === 'XX')) return null
  const ours = f.ourContractBids
  if (ours.length < 2 || ours[0].seat !== open.seat || ours[0] !== f.contractBids[0]) return null
  const opener = open.seat
  const captain = PARTNER[opener]
  for (let i = 0; i < ours.length; i++) if (ours[i].seat !== (i % 2 === 0 ? opener : captain)) return null
  const openCall = `${open.level}${open.strain}`
  const at = (i: number) => f.history.indexOf(ours[i])
  const sofarFrom = (k: number): SlamBid[] => ours.slice(k).map((c) => ({ role: c.seat === captain ? 'svarare' : 'öppnare', call: c.bid }))

  // Gerber 4♣ direkt över 1NT/2NT-öppningen (§6.4).
  if ((openCall === '1NT' || openCall === '2NT') && ours[1].bid === '4C') {
    const resp = partnerResponseAsSeen(f, at(1))
    if (resp?.rule === 'Gerber') return { kind: 'gerber', captain, prefix: 1, partnerMin: openCall === '1NT' ? 15 : 20, sofar: sofarFrom(1) }
    return null
  }
  if (ours.length < 4) return null
  const response = partnerResponseAsSeen(f, at(1))
  const rebid = rebidAsSeen(f, at(2))
  if (!response || !rebid) return null
  const openerSuit = suitOf(openCall)
  const first = ours[3].bid

  // Gerber över 1NT-återbudet (§5.7): 1m–1M–1NT–4♣. Och 4NT direkt över
  // sang-återbudet är KVANTITATIVT (den jämna 19–20-handen; standard-2/1) —
  // partnern dömer på sin hand mot visade 12–14 (familj 6, 2026-09-05).
  if (response.rule === 'ny färg (1-läget)' && rebid.rule === '1NT (12–14)') {
    if (first === '4C') return { kind: 'gerber', captain, prefix: 3, partnerMin: 12, sofar: sofarFrom(3) }
    if (first === '4NT') return { kind: 'kvantitativ', captain, prefix: 3, partnerMin: 12, sofar: sofarFrom(3) }
  }
  // Exclusion efter splinter + relä (§6.5).
  if (response.rule === 'tvetydig splinter' && rebid.rule === 'splinter-relä' && openerSuit && isMajorSuit(openerSuit) && /^5[CDHS]$/.test(first) && suitOf(first) !== openerSuit) {
    return { kind: 'exclusion', captain, prefix: 3, trump: openerSuit, partnerMin: 15, sofar: sofarFrom(3) }
  }
  // MSS: minorfit funnen efter 1NT–2♠–3m.
  if (openCall === '1NT' && response.rule === 'Minor Suit Stayman' && (rebid.call === '3C' || rebid.call === '3D')) {
    const minor: Suit = rebid.call === '3C' ? 'clubs' : 'diamonds'
    return { kind: 'mss', captain, prefix: 3, minor, rebidCall: rebid.call, setup: mssSetup(minor, rebid.call), sofar: sofarFrom(3) }
  }
  // Familj 4b:s slamgrenar: trumfen sattes av öppnarens tredje bud.
  if (ours.length >= 6) {
    const second = secondAsSeen(f, at(3))
    const third = thirdAsSeen(f, at(4))
    if (second && third) {
      const t5 = slamTrumpAfterThird(openCall, response, second, third)
      const c5 = t5 ? slamContextAfterThird(openCall, response, second, third, t5) : null
      if (t5 && c5) return { kind: 'slam', captain, prefix: 5, setup: { trump: t5, lastCall: third.call, ctx: c5.ctx }, sofar: sofarFrom(5) }
    }
  }
  // Slamgrenarna efter öppning–svar–återbud.
  const trump = slamTrumpFromAuction(openCall, response, rebid, first)
  if (!trump) return null
  const c = slamContextFor(openCall, response, rebid, trump)
  if (!c) return null
  return { kind: 'slam', captain, prefix: 3, setup: { trump, lastCall: rebid.call, ctx: c.ctx, partnerShort: c.partnerShort }, sofar: sofarFrom(3) }
}

/** Nästa tur i den lästa slamsekvensen för stolen `role`, ur `hand`. */
function slamSituationTurn(sit: SlamSituation, role: SlamRole, hand: Hand): SlamTurn | null {
  switch (sit.kind) {
    case 'gerber':
      return gerberTurn(role, hand, sit.partnerMin!, sit.sofar, sit.placeSuit)
    case 'kvantitativ':
      // Partnern dömer inbjudan på SIN hand; kaptenen har inget mer att säga.
      return role === 'öppnare' && sit.sofar.length === 1 ? quantitativeAnswer(hand, sit.partnerMin!) : null
    case 'exclusion':
      return exclusionTurn(role, hand, sit.trump!, sit.partnerMin!, sit.sofar)
    case 'mss':
      return mssTurn(role, hand, sit.minor!, sit.rebidCall!, sit.sofar)
    case 'slam':
      return slamTurn(role, hand, sit.setup!, sit.sofar)
  }
}

/**
 * Kaptenens EGEN avsikt: samma beslut som gav det första slambudet, spelat
 * upp igen på prefixet (samma hand, samma auktion). Där avsikten stämmer med
 * budet i auktionen gäller den (trumfen ur egen hand); annars den lästa
 * uppsättningen — kaptenstolen kan ha bjudit av någon annan (människan).
 */
function captainIntent(sit: SlamSituation, f: AuctionFacts, hand: Hand): SlamSituation {
  const ours = f.ourContractBids
  const at = (i: number) => f.history.indexOf(ours[i])
  const openCall = `${f.opening!.level}${f.opening!.strain}`
  const firstCall = ours[sit.prefix].bid
  if (sit.prefix === 3) {
    const response = partnerResponseAsSeen(f, at(1))
    const rebid = rebidAsSeen(f, at(2))
    const dec = response && rebid ? responderSecondDecision(openCall, response, rebid, hand) : null
    if (dec && dec.turn.call === firstCall) {
      if (dec.plan.kind === 'slam') return { ...sit, kind: 'slam', setup: dec.plan.setup }
      if (dec.plan.kind === 'exclusion') return { ...sit, kind: 'exclusion', trump: dec.plan.trump, partnerMin: dec.plan.partnerMin }
      if (dec.plan.kind === 'mss') return { ...sit, kind: 'mss', minor: dec.plan.minor, rebidCall: dec.plan.rebidCall }
      if (dec.plan.kind === 'gerberRebid' && dec.plan.suit && firstCall === '4C') return { ...sit, kind: 'gerber', partnerMin: 12, placeSuit: dec.plan.suit }
    }
  } else if (sit.prefix === 5) {
    const response = partnerResponseAsSeen(f, at(1))
    const rebid = rebidAsSeen(f, at(2))
    const second = secondAsSeen(f, at(3))
    const third = thirdAsSeen(f, at(4))
    const dec = response && rebid && second && third ? responderThirdDecision(openCall, response, rebid, second, third, hand) : null
    if (dec && dec.turn.call === firstCall && dec.plan.kind === 'slam') return { ...sit, kind: 'slam', setup: dec.plan.setup }
  }
  return sit
}

/**
 * Kaptenens tur i en slamsekvens vars trumf INTE går att läsa ur auktionen
 * (naket 4NT efter reverse/hoppskift eller över 1NT-återbudet — bok-mot-motor-
 * fynd 14): kaptenen vet ändå vad hon menade. Samma uppspelning som
 * `captainIntent`, men från noll: hennes eget beslut på prefixet måste ge
 * exakt budet i auktionen och en slamplan, annars null (människan i
 * kaptenstolen kan ha menat något annat). Familj 6, 2026-09-05 — förut
 * spelade manuset upp fortsättningen med båda händerna.
 */
function captainOwnSituation(f: AuctionFacts, hand: Hand): SlamSituation | null {
  const open = f.opening
  if (!open || f.theirContractBids.length > 0) return null
  if (f.history.some((c) => c.bid === 'X' || c.bid === 'XX')) return null
  const ours = f.ourContractBids
  const captain = PARTNER[open.seat]
  if (f.seat !== captain || ours.length < 5 || ours.length % 2 === 0) return null // kaptenens tur efter sitt första slamsteg
  if (ours[0] !== f.contractBids[0]) return null
  for (let i = 0; i < ours.length; i++) if (ours[i].seat !== (i % 2 === 0 ? open.seat : captain)) return null
  const sofarFrom = (k: number): SlamBid[] => ours.slice(k).map((c) => ({ role: c.seat === captain ? 'svarare' : 'öppnare', call: c.bid }))
  for (const prefix of [3, 5] as const) {
    if (ours.length <= prefix) break
    const guess: SlamSituation = { kind: 'slam', captain, prefix, sofar: sofarFrom(prefix) }
    const mine = captainIntent(guess, f, hand)
    if (mine !== guess) return mine
  }
  return null
}

const TABELL: Row[] = [
  // Familj 5 — slamutredningen per stol. En slamsekvens pågår (kaptenens
  // första slambud finns i den ostörda auktionen). Raden spänner över
  // budpositionerna — en slamsekvens är en delauktion inne i den ostörda
  // linjen — och ligger därför först; tiger den (inte min tur, sekvensen är
  // slut, oläsbar trumf) får positionsraderna ordet. Kaptenen får sin egen
  // avsikt även när trumfen inte syns i auktionen (`captainOwnSituation`).
  {
    id: 'slam',
    läge: (f) => slamSituation(f) !== null || (f.opening !== null && f.role === 'svarare' && f.ourContractBids.length >= 5),
    välj: ({ hand, facts }) => {
      const read = slamSituation(facts)
      const sit = read ?? captainOwnSituation(facts, hand)
      if (!sit) return null
      const role: SlamRole = facts.seat === sit.captain ? 'svarare' : 'öppnare'
      const mine = role === 'svarare' && read ? captainIntent(read, facts, hand) : sit
      const t = slamSituationTurn(mine, role, hand)
      if (!t) return null
      return { seat: facts.seat, bid: t.call, rule: t.rule, explanation: t.explanation }
    },
  },
  // Familj 1 — öppningen. Ingen har öppnat (inga kontraktsbud; X/XX kan inte
  // komma före ett bud), så stolen är i öppningsposition. Positionen styr
  // lättöppningen i 3:e hand och regeln om 15 i 4:e (systemboken §3).
  {
    id: 'öppning',
    läge: (f) => f.opening === null,
    välj: ({ hand, facts, vulnerable }) => {
      const o = classifyOpening(hand, vulnerable, position(facts))
      return { seat: facts.seat, bid: o.call, rule: o.rule, explanation: o.explanation, uncertain: o.uncertain }
    },
  },
  // Familj 2 — svaret. Partnern öppnade (enda kontraktsbudet), inget har hänt
  // sedan dess utom pass (ingen störning, ingen X), och jag har inte bjudit.
  // Passad hand läses ur fakta (Drury). Öppningar utan svarsregler lämnas åt
  // det gamla lagret genom att läget inte träffar.
  {
    id: 'svar',
    läge: (f) =>
      f.opening !== null &&
      f.role === 'svarare' &&
      f.contractBids.length === 1 &&
      f.lastNonPass !== null &&
      f.lastNonPass.seat === f.opening.seat &&
      f.lastNonPass.bid === `${f.opening.level}${f.opening.strain}` &&
      RESPONDABLE.has(f.lastNonPass.bid),
    välj: ({ hand, facts }) => {
      const open = facts.lastNonPass!.bid
      const r = responseDecision(open, hand, facts.passedHand[facts.seat])!
      return { seat: facts.seat, bid: r.call, rule: r.rule, explanation: r.explanation, uncertain: r.uncertain }
    },
  },
  // Familj 3 — öppnarens återbud. Jag öppnade, partnern svarade (vår sidas två
  // enda kontraktsbud), motståndarna har bara passat (ingen X, inget inkliv),
  // och svaret är det senaste som hänt. Partnerns bud läses som jag ser det.
  {
    id: 'återbud',
    läge: (f) =>
      f.opening !== null &&
      f.opening.seat === f.seat &&
      f.ourContractBids.length === 2 &&
      f.theirContractBids.length === 0 &&
      f.ourContractBids[1].seat === f.partner &&
      f.lastNonPass === f.ourContractBids[1] &&
      !f.history.some((c) => c.bid === 'X' || c.bid === 'XX'),
    välj: ({ hand, facts }) => {
      const seen = partnerResponseAsSeen(facts, facts.history.indexOf(facts.ourContractBids[1]))
      if (!seen) return null
      const r = openerRebidDecision(`${facts.opening!.level}${facts.opening!.strain}`, seen, hand)
      if (!r) return null
      return { seat: facts.seat, bid: r.call, rule: r.rule, explanation: r.explanation, uncertain: r.uncertain }
    },
  },
  // Familj 4a — svararens andra bud. Vår sida har exakt tre kontraktsbud
  // (öppning, mitt svar, partnerns återbud), motståndarna bara pass, ingen X,
  // och partnerns återbud är det senaste som hänt.
  {
    id: 'svar2',
    läge: (f) =>
      f.opening !== null &&
      f.role === 'svarare' &&
      f.ourContractBids.length === 3 &&
      f.theirContractBids.length === 0 &&
      f.ourContractBids[1].seat === f.seat &&
      f.ourContractBids[2].seat === f.partner &&
      f.lastNonPass === f.ourContractBids[2] &&
      !f.history.some((c) => c.bid === 'X' || c.bid === 'XX'),
    välj: ({ hand, facts }) => {
      const response = partnerResponseAsSeen(facts, facts.history.indexOf(facts.ourContractBids[1]))
      const rebid = rebidAsSeen(facts, facts.history.indexOf(facts.ourContractBids[2]))
      if (!response || !rebid) return null
      const dec = responderSecondDecision(`${facts.opening!.level}${facts.opening!.strain}`, response, rebid, hand)
      if (!dec) return null
      const t = dec.turn
      // `avslut`: placeringen efter 2♣ med fit, 6NT-avslutet och 2/1-utgången
      // sätter kontraktet — partnern har inget att tillägga (manuset läser den).
      return { seat: facts.seat, bid: t.call, rule: t.rule, explanation: t.explanation, uncertain: t.uncertain, avslut: dec.plan.kind === 'final' || undefined }
    },
  },
  // Familj 4b — öppnarens tredje bud. Vår sida har exakt fyra kontraktsbud
  // (min öppning, partnerns svar, mitt återbud, partnerns andra bud),
  // motståndarna bara pass, ingen X, och partnerns andra bud är det senaste.
  {
    id: 'tredje',
    läge: (f) =>
      f.opening !== null &&
      f.opening.seat === f.seat &&
      f.ourContractBids.length === 4 &&
      f.theirContractBids.length === 0 &&
      f.ourContractBids[1].seat === f.partner &&
      f.ourContractBids[2].seat === f.seat &&
      f.ourContractBids[3].seat === f.partner &&
      f.lastNonPass === f.ourContractBids[3] &&
      !f.history.some((c) => c.bid === 'X' || c.bid === 'XX'),
    välj: ({ hand, facts }) => {
      const at = (i: number) => facts.history.indexOf(facts.ourContractBids[i])
      const response = partnerResponseAsSeen(facts, at(1))
      const rebid = rebidAsSeen(facts, at(2))
      const second = secondAsSeen(facts, at(3))
      if (!response || !rebid || !second) return null
      const r = openerThirdDecision(`${facts.opening!.level}${facts.opening!.strain}`, response, rebid, second, hand)
      if (!r) return null
      return { seat: facts.seat, bid: r.call, rule: r.rule, explanation: r.explanation, uncertain: r.uncertain }
    },
  },
  // Familj 5 — svararens tredje bud. Vår sida har exakt fem kontraktsbud
  // (öppning, mitt svar, återbud, mitt andra bud, partnerns tredje bud),
  // motståndarna bara pass, ingen X, och partnerns tredje bud är det senaste.
  {
    id: 'svar3',
    läge: (f) =>
      f.opening !== null &&
      f.role === 'svarare' &&
      f.ourContractBids.length === 5 &&
      f.theirContractBids.length === 0 &&
      f.ourContractBids[1].seat === f.seat &&
      f.ourContractBids[2].seat === f.partner &&
      f.ourContractBids[3].seat === f.seat &&
      f.ourContractBids[4].seat === f.partner &&
      f.lastNonPass === f.ourContractBids[4] &&
      !f.history.some((c) => c.bid === 'X' || c.bid === 'XX'),
    välj: ({ hand, facts }) => {
      const at = (i: number) => facts.history.indexOf(facts.ourContractBids[i])
      const response = partnerResponseAsSeen(facts, at(1))
      const rebid = rebidAsSeen(facts, at(2))
      const second = secondAsSeen(facts, at(3))
      const third = thirdAsSeen(facts, at(4))
      if (!response || !rebid || !second || !third) return null
      const dec = responderThirdDecision(`${facts.opening!.level}${facts.opening!.strain}`, response, rebid, second, third, hand)
      if (!dec) return null
      const t = dec.turn
      return { seat: facts.seat, bid: t.call, rule: t.rule, explanation: t.explanation, uncertain: t.uncertain }
    },
  },
  // Familj 5 — öppnarens fjärde bud (systems on efter 2♣–2♦–2NT). Vår sida
  // har exakt sex kontraktsbud, motståndarna bara pass, ingen X, partnerns
  // placering är det senaste.
  {
    id: 'fjärde',
    läge: (f) =>
      f.opening !== null &&
      f.opening.seat === f.seat &&
      f.ourContractBids.length === 6 &&
      f.theirContractBids.length === 0 &&
      f.ourContractBids.every((c, i) => c.seat === (i % 2 === 0 ? f.seat : f.partner)) &&
      f.lastNonPass === f.ourContractBids[5] &&
      !f.history.some((c) => c.bid === 'X' || c.bid === 'XX'),
    välj: ({ hand, facts }) => {
      const at = (i: number) => facts.history.indexOf(facts.ourContractBids[i])
      const response = partnerResponseAsSeen(facts, at(1))
      const rebid = rebidAsSeen(facts, at(2))
      const second = secondAsSeen(facts, at(3))
      const fourth = thirdAsSeen(facts, at(5))
      if (!response || !rebid || !second || !fourth) return null
      const r = openerFourthDecision(`${facts.opening!.level}${facts.opening!.strain}`, response, rebid, second, fourth, hand)
      if (!r) return null
      return { seat: facts.seat, bid: r.call, rule: r.rule, explanation: r.explanation, uncertain: r.uncertain }
    },
  },
]

/**
 * Tabellens beslut för stolen i `facts.seat`, eller null när ingen rad täcker
 * läget än (då gäller det gamla lagret). Läser aldrig någon annan hand.
 */
export function decideFromTable(hand: Hand, facts: AuctionFacts, vulnerable: boolean): Decision | null {
  for (const row of TABELL) {
    if (!row.läge(facts)) continue
    const call = row.välj({ hand, facts, vulnerable })
    if (call) return { call, källa: `tabell:${row.id}` }
  }
  return null
}
