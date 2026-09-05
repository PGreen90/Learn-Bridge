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

import type { Hand } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import type { AuctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'
import { gerberAsk } from './nt-slam'
import { classifyOpening } from './openings'
import { openerSecondBid } from './rebids'
import { respondToGerber } from './slam'
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
