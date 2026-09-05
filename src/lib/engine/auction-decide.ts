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
// första rad vars läge stämmer väljer budet. Stämmer ingen rad svarar tabellen
// null och det gamla lagret (manus + detektorer i `auction-live.ts`) tar vid —
// tills alla familjer flyttat och det lagret rivs (etapp 5).
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
//      efter 2♣–2♦–2NT, slamportarna efter 2♣-positivt / hopp i egen minor /
//      hopphöjning / reverse–hoppskift / Jacoby–inverterad fit / splinter-relä
//      / MSS / 1NT-återbudet, sedan `responderSecondBid`) där varje slamgren
//      ger KAPTENENS FÖRSTA STEG ur egen hand (`slamCaptainFirstStep` m.fl.).
//      Partnerns återbud läses med `rebidAsSeen`. Familj 4b (öppnarens tredje
//      bud) och familj 5 (resten av slamsekvenserna) är kvar i manuset.

import type { Hand, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'
import { hcp, lengths } from './hand'
import { gerberAsk, gerberRebidFirstStep } from './nt-slam'
import { classifyOpening } from './openings'
import { openerSecondBid } from './rebids'
import { responderSecondBid } from './responder-rebids'
import { respondToGerber } from './slam'
import { exclusionFirstStep, familyAFitTrump, mssFirstStep, slamCaptainFirstStep, type SlamContext, type SlamTurn } from './slam-auction'
import { systemsOnFirstStep } from './strong-2nt-systemson'
import { respondToMajor, respondToMinor, type ResponseResult } from './responses'
import { respondToMajorPassed } from './responses-drury'
import { respondTo1NT } from './responses-nt'
import { respondTo2C } from './responses-2c'
import { respondTo2NT, respondTo3NT } from './responses-2nt'
import { preemptOf, respondToPreempt } from './responses-preempt'
import { respondToWeakTwo, suitOfWeakTwo } from './responses-weak2'

/** Ett beslutat bud. `uncertain` följer med från kunskapsfunktionen (manusets `AuctionTurn` visar den). */
export interface DecidedCall extends ResolvedCall {
  uncertain?: boolean
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
  /** Valet: kunskapsfunktionen som ger budet ur handen + läget. null = ingen regel för det här svaret än (det gamla lagret tar vid). */
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

const STRONG_2C_SHOWN_MIN = 22
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const isMajorSuit = (s: Suit) => s === 'hearts' || s === 'spades'
const suitOf = (call: string): Suit | null => {
  const cb = parseContractBid(call)
  return cb && cb.strain !== 'NT' ? SUIT_OF_LETTER[cb.strain] : null
}
const asResponse = (t: SlamTurn | ResponseResult): ResponseResult => ({ call: t.call as ResponseResult['call'], rule: t.rule, explanation: t.explanation })

/** Vad manuset ska bygga vidare på efter svararens andra bud (tills familj 5 flyttar sekvenserna). */
export type SecondPlan =
  | { kind: 'call' }
  | { kind: 'final' }
  | { kind: 'systemsOn' }
  | { kind: 'slam'; trump: Suit; lastCall: string; ctx: SlamContext; partnerShort?: Suit }
  | { kind: 'exclusion'; trump: Suit; partnerMin: number }
  | { kind: 'mss'; minor: Suit; rebidCall: string }
  | { kind: 'gerberRebid' }

export interface SecondDecision {
  turn: ResponseResult
  plan: SecondPlan
}

/**
 * Svararens ANDRA bud på partnerns ostörda återbud, ur egen hand: manusets
 * grenar i samma ordning, där varje slamgren ger kaptenens första steg
 * (`slamCaptainFirstStep` m.fl. — bara egen hand + partnerns visade minimum).
 * `response` = mitt eget svar, `rebid` = partnerns återbud, båda som de ses i
 * auktionen. null = ingen regel (det gamla lagret tar vid).
 */
export function responderSecondDecision(openCall: string, response: ResponseResult, rebid: ResponseResult, hand: Hand): SecondDecision | null {
  if (rebid.call === 'P') return null
  const openerSuit = suitOf(openCall)
  const rl = lengths(hand)
  const slamStep = (trump: Suit, ctx: SlamContext, partnerShort?: Suit): SecondDecision | null => {
    const first = slamCaptainFirstStep(hand, trump, rebid.call, ctx, partnerShort)
    return first ? { turn: asResponse(first), plan: { kind: 'slam', trump, lastCall: rebid.call, ctx, partnerShort } } : null
  }

  // Systems on efter 2♣–2♦–2NT (22–24): Stayman/transfer som mot 2NT.
  if (openCall === '2C' && response.call === '2D' && rebid.call === '2NT') {
    const so = systemsOnFirstStep(hand)
    if (so) return { turn: so, plan: { kind: 'systemsOn' } }
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
      const inviteCall = majorTrump
        ? `5${LETTER[trump2C]}`
        : rebid.call === `4${LETTER[trump2C]}`
          ? `5${LETTER[trump2C]}`
          : `4${LETTER[trump2C]}`
      const slam = slamStep(trump2C, { partnerMin: STRONG_2C_SHOWN_MIN, inviteCall, gameForcing: true, cueFloor: majorTrump ? undefined : '3NT' })
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
      const slam = ownSolid ? slamStep(ownSolid, { partnerMin: STRONG_2C_SHOWN_MIN }) : null
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
    const slam = slamStep(openerSuit, { partnerMin: 16, inviteCall: `4${LETTER[openerSuit]}` })
    if (slam) return slam
  }

  // Hopphöjning av min högfärg (1x–1M–3M, visade 16–18 med 4-korts stöd).
  const respMajor = response.call === '1H' ? 'hearts' : response.call === '1S' ? 'spades' : null
  if (rebid.rule === 'hopphöjning (inbjudan)' && respMajor && suitOf(rebid.call) === respMajor) {
    const slam = slamStep(respMajor, { partnerMin: 16, inviteCall: `5${LETTER[respMajor]}` })
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
      const slam = slamStep(trumpC, {
        partnerMin: rebid.rule === 'hoppskift' ? 19 : 16,
        inviteCall: isMajorSuit(trumpC) ? `5${LETTER[trumpC]}` : `4${LETTER[trumpC]}`,
      })
      if (slam) return slam
    }
  }

  // Överenskommen trumf via Jacoby 2NT / inverterad minor → kaptenen räknar
  // mot vad öppnarens återbud visade (visat minimum per regel).
  const majorFit = response.rule === 'Jacoby 2NT' && (openerSuit === 'hearts' || openerSuit === 'spades')
  const minorFit = response.rule === 'inverterad minor' && (openerSuit === 'clubs' || openerSuit === 'diamonds')
  if ((majorFit || minorFit) && openerSuit) {
    const openerShort = rebid.rule === 'Jacoby: kortfärg' ? (suitOf(rebid.call) ?? undefined) : undefined
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
    const slam = slamStep(openerSuit, {
      partnerMin: SHOWN_MIN[rebid.rule] ?? 12,
      inviteCall: majorFit ? `5${LETTER[openerSuit]}` : `4${LETTER[openerSuit]}`,
      gameForcing: true,
      cueFloor: minorFit ? '3NT' : undefined,
    }, openerShort)
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
      // hp mot visade 12–14 (§5.2): ingen bjuden fit, kortfärger lyfter inte.
      const slam = slamStep(trump, { partnerMin: 12, inviteCall: isMajorSuit(trump) ? `5${LETTER[trump]}` : `4${LETTER[trump]}`, hpOnly: true })
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

const TABELL: Row[] = [
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
      return { seat: facts.seat, bid: t.call, rule: t.rule, explanation: t.explanation, uncertain: t.uncertain }
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
