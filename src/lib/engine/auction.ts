// Liten auktions-hjälpare för titta-läget: hitta den första öppningen i en giv
// och – om den är 1♥/1♠ – räkna ut partnerns svar. Detta är fröet till en hel
// budgivning; just nu bara två bud (öppning + svar).

import type { Deal, Seat } from '../../types/bridge'
import { seatAt } from '../bidding'
import { dealRandom } from './deal'
import { classifyOpening, isVulnerable } from './openings'
import { respondToMajor, respondToMinor, type Major, type ResponseResult } from './responses'
import { respondTo1NT } from './responses-nt'
import { respondTo2C } from './responses-2c'
import { respondToWeakTwo, suitOfWeakTwo } from './responses-weak2'
import { respondToPreempt, preemptOf } from './responses-preempt'
import { respondTo2NT, respondTo3NT } from './responses-2nt'
import { respondToMajorPassed } from './responses-drury'
import { overcall, advanceOvercall, advanceTwoSuiter, takeoutOfResponse } from './overcalls'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Forcing, Suit } from '../../types/bridge'
import { forcingOf, isAlertRule } from './rules'
import { negativeDouble, supportDouble, responsiveDouble } from './doubles'
import { openerAnswerNMF, openerSecondBid, openerThirdBidAfterInvertedBrake, openerThirdBidAfterOwnRaise, openerThirdBidAfterReverse, openerThirdBidAfterSemiForcing1NT, openerThirdBidIn1NTAuction } from './rebids'
import { responderSecondBid } from './responder-rebids'
import { slamInvestigation, exclusionInvestigation, mssMinorFitContinuation, familyAFitTrump, type SlamTurn } from './slam-auction'
import { strong2NTSystemsOn } from './strong-2nt-systemson'
import { gerberInvestigation, gerber2NTInvestigation, gerberRebidInvestigation } from './nt-slam'
import { dontOvercall } from './dont'
import { naturalNTOvercall } from './lebensohl'
import { conventionalDefense } from './defense-conventional'

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

// ---- Allmän auktion: öppning → svar → (öppnarens återbud) ------------------
// Bygger en hel (men ostörd) auktion för alla öppningar vi kan svara på.
// Motståndarna passar. Auktionen växer så långt motorn har regler; saknas en
// regel (t.ex. återbud efter en höjning) stannar den och markeras som öppen.

const PARTNER_OF: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const RESPONDABLE = new Set([
  '1C', '1D', '1H', '1S', '1NT', '2C', '2D', '2H', '2S', '2NT',
  '3C', '3D', '3H', '3S', '3NT', '4C', '4D', '4H', '4S',
])
const OPEN_SUIT: Record<string, Major | 'clubs' | 'diamonds'> = {
  '1C': 'clubs', '1D': 'diamonds', '1H': 'hearts', '1S': 'spades',
}

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
  /** Sant så länge motorn ännu inte har regler för nästa bud i sekvensen. */
  open: boolean
}

/** Räknar ut svararens första bud givet öppningsbudet. */
function computeResponse(openCall: string, responderHand: Deal['hands'][Seat], responderPassed = false): ResponseResult {
  if (openCall === '2C') return respondTo2C(responderHand)
  const weak = suitOfWeakTwo(openCall)
  if (weak) return respondToWeakTwo(responderHand, weak)
  const preempt = preemptOf(openCall)
  if (preempt) return respondToPreempt(responderHand, preempt.suit, preempt.level)
  if (openCall === '1NT') return respondTo1NT(responderHand)
  if (openCall === '2NT') return respondTo2NT(responderHand)
  if (openCall === '3NT') return respondTo3NT(responderHand)
  const suit = OPEN_SUIT[openCall]
  if (suit === 'hearts' || suit === 'spades') {
    // Passad hand över 1♥/1♠ → Drury (§6.7).
    return responderPassed ? respondToMajorPassed(responderHand, suit) : respondToMajor(responderHand, suit)
  }
  return respondToMinor(responderHand, suit)
}

// ---- Störd budgivning (punkt 27): motståndaren kliver in på riktigt --------

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SUIT_SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

// Vad den starka 2♣-öppningen VISADE som minimum (§4.4): 22+ hp balanserad
// eller ~9+ spelstick ("en stick från utgång" ≈ samma spelvärde). Kaptenens
// slammatte efter positivt svar räknar mot detta — aldrig öppnarens kort.
const STRONG_2C_SHOWN_MIN = 22
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/** Tolkar ett inkliv ("1S"/"2H"/"X"/"2NT") → nivå + ev. färg. */
function parseBid(call: string): { level: number; suit: Suit | null } {
  const m = call.match(/^([1-7])(C|D|H|S)$/)
  if (m) return { level: parseInt(m[1], 10), suit: { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }[m[2]] as Suit }
  const nt = call.match(/^([1-7])NT$/)
  if (nt) return { level: parseInt(nt[1], 10), suit: null }
  return { level: 0, suit: null }
}

/** Lägsta nivå där (level, suit) ligger över referensbudet (refLevel, refSuit). */
function cheapestLevelAbove(suit: Suit, refLevel: number, refSuit: Suit | null): number {
  for (let L = 1; L <= 7; L++) {
    const above = L > refLevel || (L === refLevel && refSuit !== null && rankIdx(suit) > rankIdx(refSuit))
    if (above) return L
  }
  return 7
}

/**
 * Svararens reaktion när motståndaren (LHO) klivit in efter vår öppning. §7.3.
 * Negativ dubbling, konkurrenshöjning, NT med stopp, ny färg eller pass.
 */
function competitiveResponderAction(hand: Deal['hands'][Seat], openerSuit: Suit, overcallCall: string): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const { level: ovLevel, suit: ovSuit } = parseBid(overcallCall)

  // Mot ett färginkliv:
  if (ovSuit) {
    // Negativ dubbling (§7.3) – EN källa: samma logik som doubles.ts (gäller
    // inkliv på valfri nivå, inte bara 1-läget).
    const neg = negativeDouble(hand, openerSuit, overcallCall)
    if (neg) return neg
    // Limithöjning eller bättre (§7.1): cue i DERAS färg med 3+ stöd och 10+ hp
    // (krav). Skiljer en inbjudande+ höjning från den rena konkurrenshöjningen.
    if (len[openerSuit] >= 3 && p >= 10) {
      const L = ovLevel + 1 // billigaste cue av deras färg ligger en nivå över inklivet
      return { call: `${L}${LETTER[ovSuit]}`, rule: 'cue (limithöjning+)', explanation: `${p} hp, ${len[openerSuit]} stöd → cue ${SUIT_SYM[ovSuit]} (limithöjning+, krav).` }
    }
    // Konkurrenshöjning: 3+ stöd i öppnarens färg, 6–9 (spärr/konkurrens, ej inbjudan).
    if (len[openerSuit] >= 3 && p >= 6) {
      const L = cheapestLevelAbove(openerSuit, ovLevel, ovSuit)
      return { call: `${L}${LETTER[openerSuit]}`, rule: 'konkurrenshöjning', explanation: `${p} hp, ${len[openerSuit]} stöd → ${L}${SUIT_SYM[openerSuit]} (konkurrens).` }
    }
    // NT med stopp i deras färg – bara mot inkliv på 1–2-läget. Mot ett
    // hoppinkliv på 3-läget vore 2NT OLAGLIGT (under deras bud) och 3NT
    // osunt på bara 8+ → då passar svararen i stället (FAS 1 punkt 3).
    if (ovLevel <= 2 && isBalanced(hand) && hasStopper(hand, ovSuit) && p >= 8) {
      // Billigaste NT över ett FÄRGinkliv på nivå `ovLevel` är exakt `ovLevel`:
      // sang rankar över alla färger, så 1NT är lagligt över (1♠), 2NT över (2♣)
      // osv. (Tidigare beräknades nivån via klöver som proxy → alltid en nivå
      // för högt: 1♥–(1♠)–2NT i stället för naturligt 1NT. R1-fynd #1.)
      const L = ovLevel
      return { call: `${L}NT`, rule: 'NT med stopp', explanation: `${p} hp balanserad med stopp → ${L}NT.` }
    }
    return { call: 'P', rule: 'pass', explanation: `${p} hp – inget lämpligt i konkurrens → pass.` }
  }

  // Mot upplysningsdubbling (X): Jordan 2NT (limithöjning, 4+ trumf), annars
  // redubbla med 10+ utan fit, annars stöd/pass.
  if (overcallCall === 'X') {
    // Jordan 2NT (§7.3, rad 193): 4+ stöd och limitvärden → 2NT, INTE Jacoby.
    if (len[openerSuit] >= 4 && p >= 10) {
      return { call: '2NT', rule: 'Jordan 2NT', explanation: `${p} hp, ${len[openerSuit]} trumf → 2NT (Jordan, limithöjning+ med fit).` }
    }
    if (p >= 10) return { call: 'XX', rule: 'redubbling', explanation: `${p} hp → XX (redubbling, lovar styrka).` }
    if (len[openerSuit] >= 3) return { call: `2${LETTER[openerSuit]}`, rule: 'konkurrenshöjning', explanation: `${p} hp, ${len[openerSuit]} stöd → 2${SUIT_SYM[openerSuit]}.` }
    return { call: 'P', rule: 'pass', explanation: `${p} hp – pass.` }
  }

  return { call: 'P', rule: 'pass', explanation: `${p} hp – pass.` }
}

// (`pairControlsSideSuits` — kontroll-gaten som läste BÅDA händerna — togs bort
// 2026-07-07, ägarbeslutet "ärliga slamportar": ingen kontrollkoll, lita på
// poängen + nyckelkortssvaret. Bottarna kan därmed, som människor, någon gång
// bjuda en slam där motståndarna tar två snabba stick.)

/** Bygger en (ev. störd) auktion för första öppningen. */
// Minne per giv (R2-fynd #3): `buildAuction` är en ren funktion av given, och
// samma giv byggs om vid VARJE bot-tur (`decideCall` anropar den varje gång) och
// vid varje omritning i spelskärmen. En `WeakMap` på giv-objektet återanvänder den
// redan byggda linjen i stället för att räkna om den. Säkert eftersom given är
// oföränderlig under handen och alla anropare bara LÄSER resultatet. WeakMap →
// posten städas automatiskt när given inte längre används (inget minnesläckage).
const auctionCache = new WeakMap<Deal, BuiltAuction | null>()

export function buildAuction(deal: Deal): BuiltAuction | null {
  const cached = auctionCache.get(deal)
  if (cached !== undefined) return cached // OBS: null är ett giltigt cachat svar (ingen öppnar)
  const result = buildAuctionCore(deal)
  auctionCache.set(deal, result)
  return result
}

function buildAuctionCore(deal: Deal): BuiltAuction | null {
  let openerSeat: Seat | null = null
  let openerIndex = -1
  let opening = null as ReturnType<typeof classifyOpening> | null
  for (let i = 0; i < 4; i++) {
    const seat = seatAt(deal.dealer, i)
    // Positionen (1:a–4:e hand) trådas in för TP-steg F: 3:e/4:e hand öppnar lätt.
    const o = classifyOpening(deal.hands[seat], isVulnerable(seat, deal.vulnerability), (i + 1) as 1 | 2 | 3 | 4)
    if (o.call !== 'P') {
      openerSeat = seat
      openerIndex = i
      opening = o
      break
    }
  }
  if (!openerSeat || !opening) return null

  const responderSeat = PARTNER_OF[openerSeat]
  // Svararen är passad hand om hennes plats kom (och passade) före öppnarens i
  // varvet från given – då gäller Drury över 1♥/1♠ (§6.7).
  let responderIndex = -1
  for (let i = 0; i < 4; i++) if (seatAt(deal.dealer, i) === responderSeat) responderIndex = i
  const responderPassed = responderIndex < openerIndex
  const turns: AuctionTurn[] = [
    { seat: openerSeat, role: 'öppnare', call: opening.call, rule: opening.rule, explanation: opening.explanation, uncertain: opening.uncertain },
  ]

  // Enda chokepoint för att bygga resultatet: fyller varje turns kravnivå
  // (§2) ur regelregistret innan auktionen returneras, så `forcing` alltid
  // härleds ur SAMMA regel som budet.
  const finish = (open: boolean): BuiltAuction => {
    for (const t of turns) {
      if (t.forcing === undefined) t.forcing = forcingOf(t.rule)
      if (t.alert === undefined) t.alert = isAlertRule(t.rule)
    }
    return { openerSeat: openerSeat!, responderSeat, openCall: opening!.call, turns, open }
  }

  // Öppningar vi inte har svarsregler för ännu: visa bara öppningen.
  if (!RESPONDABLE.has(opening.call)) {
    return finish(true)
  }

  // Störd budgivning (punkt 27): efter en 1-läges färgöppning kan LHO kliva in.
  const openerSuit = OPEN_SUIT[opening.call]
  if (openerSuit) {
    const lhoSeat = seatAt(deal.dealer, (openerIndex + 1) % 4)
    const ov = overcall(deal.hands[lhoSeat], opening.call)
    if (ov.call !== 'P') {
      turns.push({ seat: lhoSeat, role: 'motståndare', call: ov.call, rule: ov.rule, explanation: ov.explanation, uncertain: ov.uncertain })
      const action = competitiveResponderAction(deal.hands[responderSeat], openerSuit, ov.call)
      turns.push({ seat: responderSeat, role: 'svarare', call: action.call, rule: action.rule, explanation: action.explanation, uncertain: action.uncertain })
      // En upplysningsdubbling som svararen passar är INTE utbjuden: advancern
      // (LHO:s partner) är skyldig att svara. Lämna auktionen öppen så vi inte
      // härleder ett felaktigt "passat ut"-kontrakt – det levande svaret bjuds i
      // budlådan (decideCall). Övriga konkurrensgrenar modelleras en rond.
      if (ov.call === 'X' && action.call === 'P') {
        return finish(true)
      }
      // Responsiv dubbling (punkt 9, §7.3): (1M)–X(LHO upplysning)–2M(svararen
      // höjer)–X(advancern). När svararen HÖJT öppnarens färg efter en
      // upplysningsdubbling kan advancern (dubblarens partner) svara responsivt
      // med stöd i de objudna färgerna. Bara efter en enkel höjning av vår färg.
      if (ov.call === 'X' && action.rule === 'konkurrenshöjning') {
        const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
        const resp = responsiveDouble(deal.hands[advancerSeat], openerSuit)
        if (resp) {
          turns.push({ seat: advancerSeat, role: 'motståndare', call: resp.call, rule: resp.rule, explanation: resp.explanation })
          return finish(true)
        }
      }
      // Advancer-logik (punkt 10, §7.1): efter partnerns enkla 1-läges inkliv och
      // svararens pass svarar advancern (inklivarens partner): höjning, cue =
      // limithöjning+, ny färg, NT eller fit-jump. Bara i det ostörda advance-
      // läget (svararen passade) över ett 1-läges inkliv, så budet blir lagligt.
      if (ov.rule === 'enkelt inkliv' && /^1[CDHS]$/.test(ov.call) && action.call === 'P') {
        const partnerSuit = parseBid(ov.call).suit
        if (partnerSuit) {
          const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
          const adv = advanceOvercall(deal.hands[advancerSeat], partnerSuit, openerSuit, 1)
          turns.push({ seat: advancerSeat, role: 'motståndare', call: adv.call, rule: adv.rule, explanation: adv.explanation })
          // Auktionen är INTE död när advancern passar (felrapport #38): öppnaren
          // sitter då i utpassningssitsen och ska få återöppningsfrågan
          // (openerReopensBalancing i decideCall) — annars säljs given i 1-läget.
          return finish(true)
        }
      }
      // Advancer-logik över ett 1NT-INKLIV (§4.3, systems on – uppföljning
      // felrapport #53): partnerns 1NT-inkliv (15–18 bal) visar samma sorts hand
      // som en 1NT-öppning, så efter svararens pass kör advancern sangsystemet
      // (Stayman/transfer/Texas/MSS) precis som över en öppning. Lämna auktionen
      // ÖPPEN – inklivaren fullföljer (transfer/Stayman-svar) levande i budlådan.
      if (ov.rule === '1NT-inkliv' && action.call === 'P') {
        const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
        const adv = respondTo1NT(deal.hands[advancerSeat])
        turns.push({ seat: advancerSeat, role: 'motståndare', call: adv.call, rule: adv.rule, explanation: adv.explanation })
        return finish(true)
      }
      // Advancer-logik för TVÅFÄRGSINKLIV (§7.2, Michaels / ovanlig 2NT): efter
      // partnerns tvåfärgsbud och svararens pass ger advancern preferens till sin
      // längsta av partnerns visade färger – i en OSTÖRD budgivning aldrig pass
      // (felrapport #14: linjen 1♠–2NT–P stängdes med advancern passande, så
      // advanceTwoSuiter nåddes aldrig och Syd fick pass som förslag). Utan denna
      // gren föll tvåfärgsinklivet till finish(false) och auktionen dog en rond
      // för tidigt.
      if ((ov.rule === 'Michaels' || ov.rule === 'ovanlig 2NT') && action.call === 'P') {
        const advancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
        const adv = advanceTwoSuiter(deal.hands[advancerSeat], ov.call, openerSuit, false)
        turns.push({ seat: advancerSeat, role: 'motståndare', call: adv.call, rule: adv.rule, explanation: adv.explanation })
        return finish(adv.call !== 'P')
      }
      // Svararen PASSADE ett naturligt inkliv (2-läges, eller ett 1-läges inkliv
      // som inte är "enkelt inkliv"): buildAuction stängde förr given här och
      // öppnaren SÅLDE den (flerronds del B, proben giv #56 + #552). Men auktionen
      // är inte slut – advancern (RHO) och öppnarens ÅTERÖPPNING i utpassningssitsen
      // bjuds levande i budlådan (decideCall), precis som takeout-X/Michaels-
      // grenarna ovan. Lämna öppen. (Ett äkta pass-ut faller ändå ut live – samma
      // slutkontrakt – medan en återöppningshand nu tävlar i stället för att sälja.)
      if (action.call === 'P' && parseBid(ov.call).suit) {
        return finish(true)
      }
      return finish(action.call !== 'P')
    }
  }

  // §7.5 DONT mot deras 1NT (Fynd #2, delbit 1): LHO stör direkt över en
  // 1NT-öppning. Ägarbeslut 2026-07-04: golv 8 hp i direkt sits + rätt form
  // (dontOvercall kräver 5-4+ eller 6-korts). Vi modellerar bara SJÄLVA inklivet
  // här (en rond) och lämnar auktionen öppen – advancerns relä/preferens och
  // X-arens rättelse bjuds levande i budlådan (`decideCall`). Balansering (efter
  // två pass) hanteras också i `decideCall`.
  if (opening.call === '1NT') {
    const lhoSeat = seatAt(deal.dealer, (openerIndex + 1) % 4)
    // §7.5 (Lebensohl): en stark enfärgshand (6+, 11–15) klivar in NATURELLT –
    // då spelar svararen Lebensohl (decideCall). Tvåfärgade/svaga händer tar DONT.
    const nat = naturalNTOvercall(deal.hands[lhoSeat])
    if (nat.call !== 'P') {
      turns.push({ seat: lhoSeat, role: 'motståndare', call: nat.call, rule: nat.rule, explanation: nat.explanation })
      return finish(true)
    }
    if (hcp(deal.hands[lhoSeat]) >= 8) {
      const d = dontOvercall(deal.hands[lhoSeat])
      if (d.call !== 'P') {
        turns.push({ seat: lhoSeat, role: 'motståndare', call: d.call, rule: d.rule, explanation: d.explanation })
        return finish(true)
      }
    }
  }

  // §7.6 Försvar mot deras SVAGA TVÅA (2♦/2♥/2♠) eller SPÄRR (3-läget+) — Fynd #2
  // delbit 2. LHO stör direkt (takeout-X/2NT/cue/naturligt/3NT). Ägarbeslut
  // 2026-07-04: takeout-golv 12 hp ej sårbar / 13 sårbar i direkt sits. Vi
  // modellerar bara själva inklivet (en rond) och lämnar auktionen öppen –
  // svaret på ett takeout-X (level-medvetet, Fynd #5) och övriga fortsättningar
  // bjuds levande i budlådan (`decideCall`). 2♣/1NT hanteras inte här.
  {
    const lhoSeat = seatAt(deal.dealer, (openerIndex + 1) % 4)
    const def = conventionalDefense(deal.hands[lhoSeat], opening.call, {
      vulnerable: isVulnerable(lhoSeat, deal.vulnerability),
      balancing: false,
    })
    if (def && def.call !== 'P') {
      turns.push({ seat: lhoSeat, role: 'motståndare', call: def.call, rule: def.rule, explanation: def.explanation })
      return finish(true)
    }
  }

  // NT-slam (Steg 4): över en naturlig 1NT kan svararen med en slamsäker
  // balanserad hand fråga ess med Gerber 4♣ (i stället för kvantitativ 4NT).
  if (opening.call === '1NT') {
    const g = gerberInvestigation(deal.hands[openerSeat], deal.hands[responderSeat])
    if (g) {
      for (const t of g) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  // NT-slam över 2NT (FAS 8): en balanserad slamsäker svarare (13+ mittemot
  // 20–21 ≈ 33+) frågar ess med Gerber 4♣ i stället för att blint blåsa 6NT.
  if (opening.call === '2NT') {
    const g = gerber2NTInvestigation(deal.hands[openerSeat], deal.hands[responderSeat])
    if (g) {
      for (const t of g) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  const response = computeResponse(opening.call, deal.hands[responderSeat], responderPassed)
  turns.push({ seat: responderSeat, role: 'svarare', call: response.call, rule: response.rule, explanation: response.explanation, uncertain: response.uncertain })

  // Svararen passade → given är på väg att passas ut till öppningsbudet.
  // BALANSERING (felrapport #5): innan kontraktet sätts får fjärde hand
  // (utpassningsläget) en riktig §7-chans – given ska inte dö när balanserings-
  // sitsen har ett klart inkliv/X på handen. "Låna en kung" (2026-07-05):
  // `balancing=true` sänker §7-golven med 3 hp (partnern är markerad med värden).
  // Fortsättningen (advancerns höjning m.m.) bjuds levande i budlådan
  // (`decideCall`), därför lämnas auktionen öppen.
  if (response.call === 'P') {
    if (openerSuit) {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      const bal = overcall(deal.hands[balancerSeat], opening.call, true)
      if (bal.call !== 'P') {
        turns.push({
          seat: balancerSeat,
          role: 'motståndare',
          call: bal.call,
          rule: bal.rule,
          explanation: `${bal.explanation} (balansering – utpassningsläget)`,
          uncertain: bal.uncertain,
        })
        return finish(true)
      }
    }
    // §7.5 DONT i balansering (Fynd #2, delbit 1): deras 1NT passas ut till
    // fjärde hand. Ägarbeslut: lättare golv (6 hp) i balansering. Alla DONT-bud
    // (2-läget/X) ligger över 1NT → alltid lagliga här.
    if (opening.call === '1NT') {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      if (hcp(deal.hands[balancerSeat]) >= 6) {
        const d = dontOvercall(deal.hands[balancerSeat])
        if (d.call !== 'P') {
          turns.push({ seat: balancerSeat, role: 'motståndare', call: d.call, rule: d.rule, explanation: `${d.explanation} (balansering)` })
          return finish(true)
        }
      }
    }
    // §7.6 balansering mot deras svaga tvåa/spärr (Fynd #2 delbit 2): passas
    // öppningen runt till fjärde hand får den ett lättare försvar – ägarbeslut:
    // takeout-golv 10 hp i balansering. Alla försvarsbud ligger över öppningen.
    {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      const def = conventionalDefense(deal.hands[balancerSeat], opening.call, {
        vulnerable: isVulnerable(balancerSeat, deal.vulnerability),
        balancing: true,
      })
      if (def && def.call !== 'P') {
        turns.push({ seat: balancerSeat, role: 'motståndare', call: def.call, rule: def.rule, explanation: `${def.explanation} (balansering)` })
        return finish(true)
      }
    }
    return finish(false)
  }

  // F6 (C5, §7.3 "efter två bjudna färger"): motståndarna har bjudit TVÅ
  // 1-lägesfärger (öppning + svar i ny färg, t.ex. 1♦–P–1♥) och spelaren DIREKT
  // ÖVER svararen sitter med den STARKA enfärgshanden (17+ hp, egen 5+ objuden
  // färg). Utan den här ronden låg hennes pass INBAKAT i linjen och decideCall
  // följde det – live-detektorn `maybeTakeoutOfResponse` nåddes aldrig on-book
  // (senare.md-hålet 2026-07-05). Vi modellerar BARA den starka dubblingen
  // (rondkrav; tvångssvaret + det starka återbudet bjuds levande i budlådan).
  // Den vanliga 4-4-dubblingen förblir MEDVETET live-only – att träda in den
  // ändrar en stor andel ostörda linjer och är ett eget beslut (`docs/senare.md`).
  const respNew = parseBid(response.call)
  if (openerSuit && respNew.level === 1 && respNew.suit && respNew.suit !== openerSuit) {
    const rhoSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
    const takeout = takeoutOfResponse(deal.hands[rhoSeat], openerSuit, respNew.suit)
    if (takeout.rule === 'upplysningsdubbling (stark)') {
      turns.push({ seat: rhoSeat, role: 'motståndare', call: takeout.call, rule: takeout.rule, explanation: takeout.explanation })
      return finish(true)
    }
  }

  // Stöddubbling (punkt 8, §7.3): öppning 1 i färg – (LHO pass) – svararen 1♥/1♠
  // – (RHO kliver in). Öppnaren med EXAKT 3 stöd upplyser med en stöddubbling
  // (en direkt höjning = 4 stöd). Vi modellerar den här störningsronden BARA när
  // stöd-X faktiskt slår till – annars skulle vi trunkera massor av ostörda
  // auktioner. Öppnarens övriga konkurrenssvar hör till en senare punkt, så då
  // lämnas linjen ostörd som förut (RHO:s ev. inkliv modelleras inte).
  const respMajor: Suit | null = response.call === '1H' ? 'hearts' : response.call === '1S' ? 'spades' : null
  if (openerSuit && respMajor) {
    const rhoSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
    const rho = overcall(deal.hands[rhoSeat], response.call)
    // Bara ett äkta färginkliv (ej i öppnarens egen färg) kan utlösa stöd-X.
    if (rho.call !== 'P' && parseBid(rho.call).suit !== openerSuit) {
      const sd = supportDouble(deal.hands[openerSeat], respMajor, rho.call)
      if (sd) {
        turns.push({ seat: rhoSeat, role: 'motståndare', call: rho.call, rule: rho.rule, explanation: rho.explanation, uncertain: rho.uncertain })
        turns.push({ seat: openerSeat, role: 'öppnare', call: sd.call, rule: sd.rule, explanation: sd.explanation })
        return finish(true)
      }
    }
  }

  // Öppnarens återbud (dispatchas på öppning + svar).
  const rebid = openerSecondBid(opening.call, response, deal.hands[openerSeat])
  if (!rebid) {
    // Inget återbud ännu (svarstyp utan regel): auktionen fortsätter senare.
    return finish(true)
  }
  turns.push({ seat: openerSeat, role: 'öppnare', call: rebid.call, rule: rebid.rule, explanation: rebid.explanation, uncertain: rebid.uncertain })

  // Öppnaren passade svararens bud → kontraktet är satt.
  if (rebid.call === 'P') return finish(false)

  // Systems-on efter 2♣–2♦–2NT (öppnarens 22–24): svararen använder Stayman/
  // transfer precis som mot en 2NT-öppning (fast 22–24 mittemot). Bygger hela
  // sekvensen deterministiskt. null = svararen för svag (0–2) → faller igenom och
  // passar 2NT via det vanliga flödet.
  if (opening.call === '2C' && response.call === '2D' && rebid.call === '2NT') {
    const so = strong2NTSystemsOn(deal.hands[openerSeat], deal.hands[responderSeat])
    if (so) {
      for (const st of so.turns) {
        const seat = st.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: st.role, call: st.call, rule: st.rule, explanation: st.explanation })
      }
      return finish(so.open)
    }
  }

  // Slamutredning efter stark 2♣ + POSITIVT svar (ETAPP 4, F1 familj B fix 1).
  // 2♣ VISADE ~22+ (stark balanserad 22+ hp eller ~9+ spelstick — "en stick
  // från utgång", §4.4); det positiva svaret visade 8+. När en trumf är funnen
  // räknar SVARAREN (kaptenen) sin egen hand mot det visade minimumet (ärliga
  // slamportar): driv 33+ (4NT RKC), inbjudan 31–32 (öppnaren dömer accepten
  // på sina EGNA Bergenpoäng — så räknas spelstick-händernas längd ärligt),
  // annars sätts utgången (GF). Aldrig partnerns kort.
  if (opening.call === '2C' && response.rule === '2♣-positivt') {
    const respSuit = parseBid(response.call).suit
    const rebidSuit = parseBid(rebid.call).suit
    // Trumfen: öppnaren stödde svararens färg (B1), eller svararen har 3+ kort
    // i öppnarens naturliga färgrebud som lovade 5+ (B2).
    const trump2C =
      rebid.rule === 'rebid: stöd (GF)' && respSuit
        ? respSuit
        : rebid.rule === 'rebid: egen färg (GF)' && rebidSuit && lengths(deal.hands[responderSeat])[rebidSuit] >= 3
          ? rebidSuit
          : null
    if (trump2C) {
      const majorTrump = trump2C === 'hearts' || trump2C === 'spades'
      const gameCall = majorTrump ? `4${LETTER[trump2C]}` : `5${LETTER[trump2C]}`
      // Inbjudan: höjningen till 5M, respektive stödhöjningen 4m ("enkel
      // stödhöjning efter positivt svar = slamintresse", §4.4) — men aldrig
      // under öppnarens sista bud (stöd-återbudet i minor står redan på 4m).
      const inviteCall = majorTrump
        ? `5${LETTER[trump2C]}`
        : rebid.call === `4${LETTER[trump2C]}`
          ? `5${LETTER[trump2C]}`
          : `4${LETTER[trump2C]}`
      const slam = slamInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], trump2C, rebid.call, {
        partnerMin: STRONG_2C_SHOWN_MIN,
        inviteCall,
        // B13 (2026-08-07): trumfen är AGREED (stöd-återbudet/3+ stöd) och 2♣-
        // auktionen är GF per system → cue-ronden (§6.2) körs. I minortrumf
        // först ÖVER 3NT (sangen kan fortfarande vara rätt kontrakt under den).
        gameForcing: true,
        cueFloor: majorTrump ? undefined : '3NT',
      })
      if (slam) {
        for (const t of slam) {
          const seat = t.role === 'öppnare' ? openerSeat : responderSeat
          turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
        }
        return finish(false)
      }
      // Under slamzonen: kaptenen sätter utgången (GF) i den funna trumfen.
      turns.push({
        seat: responderSeat,
        role: 'svarare',
        call: gameCall,
        rule: rebid.rule === 'rebid: stöd (GF)' ? 'till spel' : 'höjning (GF)',
        explanation: `under slamzonen mot partnerns visade ${STRONG_2C_SHOWN_MIN}+ → ${gameCall[0]}${SUIT_SYM[trump2C]} (utgång).`,
      })
      return finish(false)
    }

    // FIX 2: INGEN trumf funnen — kaptenen kan ändå stå i slamzon (33+ mot
    // visade 22). Egen redan VISAD 6+ färg med minst två topphonnörer (A/K/Q)
    // är en självbärande trumf → RKC i den (nyckelkortssvaret vaktar mot att
    // en spelstick-öppning saknar essen). 6NT direkt bjuds BARA när öppnarens
    // återbud var 3NT — då är styrkan visad BALANSERAD (riktiga hp); efter ett
    // FÄRG-återbud kan "22:an" vara en spelstick-hand vars längd inte ger
    // sangstick utan fit (frö 20261107: 13 hp 6-5 → 6NT åtta stick), så där
    // fortsätter auktionen naturligt. Under 33 → vanliga flödet står kvar
    // (avgränsning: ingen kvantitativ inbjudan i 31–32 utan trumf).
    const rh = deal.hands[responderSeat]
    if (hcp(rh) + STRONG_2C_SHOWN_MIN >= 33) {
      const topHonors = respSuit
        ? rh.filter((c) => c.suit === respSuit && (c.rank === 'A' || c.rank === 'K' || c.rank === 'Q')).length
        : 0
      const ownSolid = respSuit && lengths(rh)[respSuit] >= 6 && topHonors >= 2 ? respSuit : null
      const slam = ownSolid
        ? slamInvestigation(deal.hands[openerSeat], rh, ownSolid, rebid.call, { partnerMin: STRONG_2C_SHOWN_MIN })
        : null
      if (slam) {
        for (const t of slam) {
          const seat = t.role === 'öppnare' ? openerSeat : responderSeat
          turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
        }
        return finish(false)
      }
      if (rebid.rule === 'rebid: 3NT (GF)') {
        turns.push({
          seat: responderSeat,
          role: 'svarare',
          call: '6NT',
          rule: 'slamavslut',
          explanation: `${hcp(rh)} hp mot visad balanserad ${STRONG_2C_SHOWN_MIN}+ → 6NT (slamzon, sang behöver ingen fit).`,
        })
        return finish(false)
      }
      // Färg-återbud utan fit och utan egen solid färg: ingen blast — vidare.
    }
  }

  // Slamutredning efter öppnarens HOPP-ÅTERBUD i egen minor (1m–1M–3m, felrapport
  // #29): återbudet VISADE 16–18 med 6+ färg. Svararen (kaptenen) med 3+ fit
  // räknar SIN hand mot det visade minimumet (ärliga slamportar 2026-07-07):
  // driv 33+, inbjudan 4m i kanske-zonen, annars står den vanliga auktionen.
  if (
    (opening.call === '1C' || opening.call === '1D') &&
    response.rule === 'ny färg (1-läget)' &&
    rebid.rule === 'hopp i egen färg (inbjudan)' &&
    openerSuit && parseBid(rebid.call).suit === openerSuit &&
    lengths(deal.hands[responderSeat])[openerSuit] >= 3
  ) {
    const slam = slamInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], openerSuit, rebid.call, {
      partnerMin: 16,
      inviteCall: `4${LETTER[openerSuit]}`,
    })
    if (slam) {
      for (const t of slam) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  // Slamutredning efter öppnarens HOPPHÖJNING av svararens högfärg (1x–1M–3M,
  // F1 familj C). Hopphöjningen VISADE 16–18 med 4-korts stöd; trumfen är redan
  // överenskommen. Svararen (kaptenen) räknar SIN hand mot det visade minimumet
  // (ärliga slamportar 2026-07-07): driv 33+ (4NT RKC), inbjudan 5M i kanske-
  // zonen, annars står den vanliga kedjan kvar (accepterar 4M / passar).
  if (
    rebid.rule === 'hopphöjning (inbjudan)' &&
    respMajor && parseBid(rebid.call).suit === respMajor
  ) {
    const slam = slamInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], respMajor, rebid.call, {
      partnerMin: 16,
      inviteCall: `5${LETTER[respMajor]}`,
    })
    if (slam) {
      for (const t of slam) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  // Slamutredning efter öppnarens REVERSE (visade 16+) eller HOPPSKIFT i ny
  // färg (visade 19+) — ETAPP 4, F1 familj C-resten. Svararen (kaptenen,
  // obegränsad efter sitt svar) räknar SIN hand mot det visade minimumet när
  // en trumf är säkrad på EGEN kunskap: öppnarens ANDRA färg med 4+ egna
  // (4 lovade där), eller öppnarens FÖRSTA färg med 3+ — en reverse lovar 5+
  // där (längre första färg), liksom en högfärgsöppning; bara hoppskiftets
  // MINOR-öppning (kan vara 4) kräver 4+ egna. Driv 33+ (4NT RKC), inbjudan
  // 31–32 (öppnaren accepterar på egna Bergenpoäng), annars står dagens
  // flöde (fourthSuit-graderingen m.m.) kvar.
  if (rebid.rule === 'reverse' || rebid.rule === 'hoppskift') {
    const secondSuit = parseBid(rebid.call).suit
    const rl = lengths(deal.hands[responderSeat])
    const firstSuitMin =
      rebid.rule === 'reverse' || openerSuit === 'hearts' || openerSuit === 'spades' ? 3 : 4
    const trumpC =
      secondSuit && rl[secondSuit] >= 4
        ? secondSuit
        : openerSuit && rl[openerSuit] >= firstSuitMin
          ? openerSuit
          : null
    if (trumpC) {
      const majorT = trumpC === 'hearts' || trumpC === 'spades'
      const slam = slamInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], trumpC, rebid.call, {
        partnerMin: rebid.rule === 'hoppskift' ? 19 : 16,
        inviteCall: majorT ? `5${LETTER[trumpC]}` : `4${LETTER[trumpC]}`,
        // Ingen cue-flagga: trumfen här är INFERRERAD (svararens längd), inte
        // agreed via buden → ett cue skulle läsas som naturligt. Cue-bud kräver
        // överenskommen trumf (§6.2). Återkoms i ett senare steg.
      })
      if (slam) {
        for (const t of slam) {
          const seat = t.role === 'öppnare' ? openerSeat : responderSeat
          turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
        }
        return finish(false)
      }
    }
  }

  // Slamutredning: efter en överenskommen trumf växer 1430 RKC (+ ev. Sjöbergs
  // 5NT) auktionen vidare. Högfärgsfit via Jacoby 2NT (Steg 1–2) eller minorfit
  // via inverterad minor (Steg 3). Ärliga slamportar 2026-07-07: kaptenen räknar
  // SIN hand mot vad öppnarens ÅTERBUD visade (intervallets minimum per regel).
  const majorFit = response.rule === 'Jacoby 2NT' && (openerSuit === 'hearts' || openerSuit === 'spades')
  const minorFit = response.rule === 'inverterad minor' && (openerSuit === 'clubs' || openerSuit === 'diamonds')
  if (majorFit || minorFit) {
    // FAS 4 punkt 18: visade öppnaren en singel/renons (Jacoby-kortfärg) skickar
    // vi in den korta färgen så kaptenen nedvärderar sina honnörer där (ärligt:
    // kortheten är BJUDEN). Visat minimum per återbudsregel — regler som kan
    // döljas av starkare händer (sidofärg/kortfärg går före styrkevisning) får
    // sitt LÄGSTA möjliga värde; det är precis vad en människa vet.
    const openerShort = rebid.rule === 'Jacoby: kortfärg' ? (parseBid(rebid.call).suit ?? undefined) : undefined
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
    const trumpS = openerSuit as Suit
    const slam = slamInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], trumpS, rebid.call, {
      partnerMin: SHOWN_MIN[rebid.rule] ?? 12,
      inviteCall: majorFit ? `5${LETTER[trumpS]}` : `4${LETTER[trumpS]}`,
      // Jacoby 2NT = utgångskravande högfärgshöjning → cue-bud fritt under utgång
      // (§6.2, ägarbeslut 2026-08-03). B13 (2026-08-07): även minorfiten cue:ar —
      // men först ÖVER 3NT (under 3NT betyder nya färger STOPP, §4.2), så de två
      // budspråken aldrig krockar. cueFloor sätter den gränsen.
      gameForcing: true,
      cueFloor: minorFit ? '3NT' : undefined,
    }, openerShort)
    if (slam) {
      for (const t of slam) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  // Exclusion Blackwood (Steg 5): efter en splinter där öppnaren visat
  // slamintresse (splinter-relä) kan svararen med en sidorenons hoppa till
  // 5 i renonsfärgen och fråga nyckelkort utom esset där.
  if (response.rule === 'tvetydig splinter' && rebid.rule === 'splinter-relä' && (openerSuit === 'hearts' || openerSuit === 'spades')) {
    // Splinter-relät visade slamintresse (Bergen ≥15) → kaptenens visade minimum = 15.
    const exc = exclusionInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], openerSuit as Suit, 15)
    if (exc) {
      for (const t of exc) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  // MSS-slam (FAS 8): efter 1NT–2♠–3♣/3♦ har svararen (kaptenen) 5-4+ i minorerna
  // och en minorfit är garanterad. Svararen driver mot slam med hela arsenalen och
  // placerar NT-slam (6NT/7NT) när alla färger är täckta, annars minor-slam/utgång
  // (behöver BÅDA händerna → ligger här, inte i responderSecondBid).
  if (opening.call === '1NT' && response.rule === 'Minor Suit Stayman' && (rebid.call === '3C' || rebid.call === '3D')) {
    const minor: Suit = rebid.call === '3C' ? 'clubs' : 'diamonds'
    const cont = mssMinorFitContinuation(deal.hands[openerSeat], deal.hands[responderSeat], minor, rebid.call)
    for (const t of cont) {
      const seat = t.role === 'öppnare' ? openerSeat : responderSeat
      turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
    }
    return finish(false)
  }

  // Slamutredning efter öppnarens 1NT-ÅTERBUD (1m–1M–1NT, visade 12–14; F1
  // familj A). Svararen (kaptenen) dömer på SIN hand mot det visade intervallet
  // (ärliga slamportar 2026-07-07). Två vägar:
  //  • JÄMN svarare (ingen 5-korts färg): 21+ hp → Gerber 4♣ → 6NT/7NT;
  //    19–20 hp → kvantitativ 4NT-inbjudan (öppnaren accepterar med 13–14).
  //  • OBALANSERAD med en SÄKER färgfit på egen hand (6+ egen högfärg, eller 5+
  //    kort i öppnarens minor som lovade 3+) → färgslam via 4NT RKC; inbjudan i
  //    kanske-zonen. Gömda 4-4-fits jagas inte längre (kräver kikande).
  // Utanför zonerna står den vanliga kedjan (NMF / sang-stegen) kvar.
  if (response.rule === 'ny färg (1-läget)' && rebid.rule === '1NT (12–14)') {
    const oh = deal.hands[openerSeat]
    const rh = deal.hands[responderSeat]
    let slam: SlamTurn[] | null = gerberRebidInvestigation(oh, rh)
    if (!slam) {
      const trump = familyAFitTrump(rh, openerSuit, parseBid(response.call).suit)
      if (trump) {
        const isMajorTrump = trump === 'hearts' || trump === 'spades'
        slam = slamInvestigation(oh, rh, trump, rebid.call, {
          partnerMin: 12,
          inviteCall: isMajorTrump ? `5${LETTER[trump]}` : `4${LETTER[trump]}`,
        })
      }
    }
    if (slam) {
      for (const t of slam) {
        const seat = t.role === 'öppnare' ? openerSeat : responderSeat
        turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
      }
      return finish(false)
    }
  }

  // Svararens andra bud (dispatchas på hela sekvensen).
  const second = responderSecondBid(opening.call, response, rebid, deal.hands[responderSeat])
  if (second) {
    turns.push({ seat: responderSeat, role: 'svarare', call: second.call, rule: second.rule, explanation: second.explanation, uncertain: second.uncertain })

    // NMF-SLAM (hål C, cue-bud 2026-08-03): efter 1m–1M–1NT–2m(NMF) svarar
    // öppnaren, och visar hen fördröjt 3-korts stöd i svararens högfärg är en
    // 5-3-fit AGREED → trumf klar → cue-ronden (§6.2) körs. Tas on-book BARA när
    // det faktiskt når slam (6/7); annars lämnas auktionen öppen och live-lagret
    // placerar utgången via responderPlaceAfterNMF precis som förut.
    if (second.rule === 'New Minor Forcing' && openerSuit) {
      const oh = deal.hands[openerSeat]
      const rh = deal.hands[responderSeat]
      const responderMajor = parseBid(response.call).suit
      const nmfMinor = parseBid(second.call).suit
      if (responderMajor && nmfMinor) {
        const unbid = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).find(
          (s) => s !== openerSuit && s !== responderMajor && s !== nmfMinor,
        )!
        const ans = openerAnswerNMF(oh, openerSuit, responderMajor, nmfMinor, unbid)
        if (parseBid(ans.call).suit === responderMajor && lengths(rh)[responderMajor] >= 5) {
          const slam = slamInvestigation(oh, rh, responderMajor, ans.call, {
            partnerMin: ans.call.startsWith('3') ? 14 : 12, // öppnarens hopp = maximum
            inviteCall: `5${LETTER[responderMajor]}`,
            gameForcing: true,
          })
          if (slam && Number(slam[slam.length - 1].call[0]) >= 6) {
            turns.push({ seat: openerSeat, role: 'öppnare', call: ans.call, rule: ans.rule, explanation: ans.explanation })
            for (const t of slam) {
              const seat = t.role === 'öppnare' ? openerSeat : responderSeat
              turns.push({ seat, role: t.role, call: t.call, rule: t.rule, explanation: t.explanation })
            }
            return finish(false)
          }
        }
      }
    }

    // Öppnarens TREDJE bud (felrapport #37): en INBJUDAN i en 1NT-auktion
    // besvaras on-book (accept med maximum / pass med minimum) i stället för
    // att falla igenom till off-book-svaret (som bjöd 3NT "utan stöd" mitt i
    // en Stayman-hittad hjärterfit).
    if (opening.call === '1NT' && second.rule === 'inbjudan') {
      const third = openerThirdBidIn1NTAuction(response, rebid, second, deal.hands[openerSeat])
      if (third) {
        turns.push({ seat: openerSeat, role: 'öppnare', call: third.call, rule: third.rule, explanation: third.explanation })
        return finish(false)
      }
    }
    // ETAPP 5 fix 2: samma sak efter semi-forcing 1NT (1♥/1♠–1NT–…). Öppnaren
    // svarade förr inte alls på svararens inbjudan → off-book-lagret passade
    // och utgången försvann (frö 20260843: 2NT med AQT863 + 14 hp, 4♠ hemma).
    if ((opening.call === '1H' || opening.call === '1S') && response.rule === 'semi-forcing 1NT' && second.rule.startsWith('inbjudan')) {
      const third = openerThirdBidAfterSemiForcing1NT(
        deal.hands[openerSeat],
        opening.call === '1H' ? 'hearts' : 'spades',
        rebid,
        second,
      )
      if (third) {
        turns.push({ seat: openerSeat, role: 'öppnare', call: third.call, rule: third.rule, explanation: third.explanation })
        return finish(false)
      }
    }
    // Systemfel #3 delfix 4b (2026-08-07): öppnaren höjde svararens 1M till 2M
    // (enkel höjning) och svararen inviterar 3M — öppnaren svarar ALLTID:
    // 14+ stödpoäng mot fiten accepterar (4M), annars pass (frö 20260982:
    // 15 hp + 4 trumf + singel passade inviten → 3♥ på 26 hp).
    if (
      (response.call === '1H' || response.call === '1S') &&
      rebid.rule === 'enkel höjning' &&
      second.rule === 'inbjudan' &&
      second.call === `3${response.call[1]}`
    ) {
      const M4b = response.call === '1H' ? ('hearts' as const) : ('spades' as const)
      const third = openerThirdBidAfterOwnRaise(deal.hands[openerSeat], M4b)
      turns.push({ seat: openerSeat, role: 'öppnare', call: third.call, rule: third.rule, explanation: third.explanation })
      return finish(false)
    }
    // B13 (2026-08-07): svararens BROMS efter öppnarens stopp-visning i den
    // inverterade minorn (1m–2m–ny färg–3m = "bara minimum, 10–12"). Öppnaren
    // svarar alltid: pass med 12–14, driv med 15+ (3NT / andra stoppen / 5m).
    // Efter en andra stopp-visning täcker svararen resten eller tar 5m.
    if (second.rule === 'inverterad: broms' && openerSuit && (openerSuit === 'clubs' || openerSuit === 'diamonds')) {
      const third = openerThirdBidAfterInvertedBrake(deal.hands[openerSeat], openerSuit, parseBid(rebid.call).suit)
      turns.push({ seat: openerSeat, role: 'öppnare', call: third.call, rule: third.rule, explanation: third.explanation })
      if (third.rule === 'inverterad: stopp-visning') {
        const shown1 = parseBid(rebid.call).suit
        const shown2 = parseBid(third.call).suit
        const rh = deal.hands[responderSeat]
        const rest = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).filter(
          (s) => s !== openerSuit && s !== shown1 && s !== shown2,
        )
        const rp = hcp(rh)
        const fourth = rest.every((s) => hasStopper(rh, s))
          ? { call: '3NT', rule: '3NT till spel', explanation: `${rp} hp – öppnaren driver (15+) och resten är täckt → 3NT (till spel).` }
          : { call: `5${LETTER[openerSuit]}`, rule: 'höjning till utgång', explanation: `${rp} hp – öppnaren driver (15+) men 3NT är otäckt → 5${SUIT_SYM[openerSuit]} (minorutgång).` }
        turns.push({ seat: responderSeat, role: 'svarare', call: fourth.call, rule: fourth.rule, explanation: fourth.explanation })
      }
      return finish(false)
    }
    // Delfix 4c: öppnarens reverse + svararens preferens tillbaka — reversens
    // 17-minimum får passa, 18+ driver till utgång (3NT med håll i objudna
    // färgen + 2+ kort i partnerns färg, annars fiten; frö 20261111 → 5♣).
    if (rebid.rule === 'reverse' && second.rule === 'preferens' && openerSuit) {
      const responderSuit4c = parseBid(response.call).suit
      const reverseSuit4c = parseBid(rebid.call).suit
      if (responderSuit4c && reverseSuit4c) {
        const third = openerThirdBidAfterReverse(deal.hands[openerSeat], openerSuit, responderSuit4c, reverseSuit4c, second.call)
        turns.push({ seat: openerSeat, role: 'öppnare', call: third.call, rule: third.rule, explanation: third.explanation })
        return finish(false)
      }
    }
    return finish(second.call !== 'P')
  }

  // Svararens andra bud saknar regel än: auktionen fortsätter senare.
  return finish(true)
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
