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
import { overcall, advanceOvercall } from './overcalls'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Forcing, Suit } from '../../types/bridge'
import { forcingOf, isAlertRule } from './rules'
import { negativeDouble, supportDouble, responsiveDouble } from './doubles'
import { openerSecondBid } from './rebids'
import { responderSecondBid } from './responder-rebids'
import { slamInvestigation, exclusionInvestigation, mssMinorFitContinuation } from './slam-auction'
import { gerberInvestigation, gerber2NTInvestigation } from './nt-slam'
import { dontOvercall } from './dont'
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

/** Bygger en (ev. störd) auktion för första öppningen. */
export function buildAuction(deal: Deal): BuiltAuction | null {
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
          return finish(adv.call !== 'P')
        }
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
  // sitsen har ett klart inkliv/X på handen. Samma krav som direkt sits
  // (medvetet konservativt – "låna en kung"-lättnaden är en senare förfining).
  // Fortsättningen (advancerns höjning m.m.) bjuds levande i budlådan
  // (`decideCall`), därför lämnas auktionen öppen.
  if (response.call === 'P') {
    if (openerSuit) {
      const balancerSeat = seatAt(deal.dealer, (openerIndex + 3) % 4)
      const bal = overcall(deal.hands[balancerSeat], opening.call)
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

  // Slamutredning: efter en överenskommen trumf i slamzon växer 1430 RKC (med
  // cue-rond + ev. Sjöbergs 5NT) auktionen vidare. Högfärgsfit via Jacoby 2NT
  // (Steg 1–2) eller minorfit via inverterad minor (Steg 3).
  const majorFit = response.rule === 'Jacoby 2NT' && (openerSuit === 'hearts' || openerSuit === 'spades')
  const minorFit = response.rule === 'inverterad minor' && (openerSuit === 'clubs' || openerSuit === 'diamonds')
  if (majorFit || minorFit) {
    // FAS 4 punkt 18: visade öppnaren en singel/renons (Jacoby-kortfärg) skickar
    // vi in den korta färgen så slamzonen nedvärderar svararens honnörer där.
    const openerShort = rebid.rule === 'Jacoby: kortfärg' ? (parseBid(rebid.call).suit ?? undefined) : undefined
    const slam = slamInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], openerSuit as Suit, rebid.call, openerShort)
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
    const exc = exclusionInvestigation(deal.hands[openerSeat], deal.hands[responderSeat], openerSuit as Suit)
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

  // Svararens andra bud (dispatchas på hela sekvensen).
  const second = responderSecondBid(opening.call, response, rebid, deal.hands[responderSeat])
  if (second) {
    turns.push({ seat: responderSeat, role: 'svarare', call: second.call, rule: second.rule, explanation: second.explanation, uncertain: second.uncertain })
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
