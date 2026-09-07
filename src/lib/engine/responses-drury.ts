// Punkt 17: Drury (tvåvägs Reverse), systembok §6.7.
//
// Gäller när SVARAREN är passad hand och partnern öppnar 1♥/1♠ (3:e/4:e hand,
// där lätta öppningar är vanliga). Drury begränsar limithöjningen så paret inte
// hamnar för högt mot en lätt öppning. Eftersom svararen redan är passad är allt
// begränsat till utgång – ingen slam.
//
//   2♣ = limithöjning (~10–12 hp), exakt 3 trumf
//   2♦ = limithöjning (~10–12 hp), 4+ trumf
//   Öppnarens återbud: rebjuden högfärg = lätt öppning (signoff); allt annat =
//   riktig öppning (accepterar utgång).
//
// Andra passad-hand-svar (svaga höjningar, ny färg, 1NT) delegeras till det
// vanliga svarsschemat – en passad hand har <12 hp så inga GF-bud uppstår.

import type { Hand } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { pointsWithFloor } from './evaluation'
import { respondToMajor, type Major, type ResponseResult } from './responses'

const SYM: Record<Major, string> = { hearts: '♥', spades: '♠' }
const BIDOF: Record<Major, string> = { hearts: 'H', spades: 'S' }

/**
 * Svararens svar på 1♥/1♠ när hon är PASSAD hand (§6.7; motorbytet §5b beslut 9,
 * 2026-09-07): Jacoby AV, Bergen AV, splinter AV — Drury tar alla limithöjningar.
 *   3M  = spärr, 4+ stöd under 6 hp
 *   4M  = 5+ trumf, 6–9 stödpoäng, formstark (spärr till utgång)
 *   2♣/2♦ = Drury, 10+ STÖDPOÄNG (3 resp. 4+ trumf) — tröskeln på stödpoäng, så
 *           4 trumf + kortfärg hamnar här och aldrig i splinter/Jacoby
 *   2M  = 6–9 med 3+ stöd
 *   1♠ över 1♥ = 4+ spader; 3♣/3♦ = 6+ färg, svag (6–9), ej krav
 *   2NT = naturlig inbjudan, 11+ hp balanserad, högst 2 trumf
 *   annars det vanliga schemat (utan fit når det aldrig Jacoby/Bergen).
 */
export function respondToMajorPassed(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const sym = SYM[opened]
  const bid = BIDOF[opened]
  const { points: sp } = pointsWithFloor(hand, opened, 'support')

  if (support >= 4 && p < 6) {
    return { call: `3${bid}`, rule: 'spärrhöjning', explanation: `Under 6 hp, 4+ trumf (passad hand) → 3${sym} (spärrhöjning, avslut).` }
  }
  if (support >= 5 && sp <= 9) {
    return { call: `4${bid}`, rule: 'spärr till utgång', explanation: `5+ trumf, svag och formstark (passad hand) → 4${sym} (spärr till utgång).` }
  }
  // Drury: limithöjning på STÖDPOÄNG (10+) med 3+ trumf → konstgjord 2♣/2♦.
  if (support >= 3 && sp >= 10) {
    if (support >= 4) {
      return { call: '2D', rule: 'Drury', explanation: `10–12 stödpoäng, 4+ trumf (passad hand) → 2♦ (Drury, limithöjning).` }
    }
    return { call: '2C', rule: 'Drury', explanation: `10–12 stödpoäng, 3 trumf (passad hand) → 2♣ (Drury, limithöjning).` }
  }
  if (p < 6) return { call: 'P', rule: 'pass', explanation: `För svagt för att svara → pass.` }
  if (support >= 3) {
    return { call: `2${bid}`, rule: 'enkel höjning', explanation: `6–9 med 3+ stöd (passad hand) → 2${sym} (enkel höjning, ej krav).` }
  }
  if (opened === 'hearts' && len.spades >= 4) {
    return { call: '1S', rule: 'ny färg (1-läget)', explanation: `4+ ♠ → 1♠ (krav 1 rond).` }
  }
  // Svag hand med lång lågfärg: naturligt 3♣/3♦ (6+ kort), ej krav.
  if (p <= 9) {
    const minor = len.clubs >= 6 && len.clubs >= len.diamonds ? 'C' : len.diamonds >= 6 ? 'D' : null
    if (minor) {
      const msym = minor === 'C' ? '♣' : '♦'
      return { call: `3${minor}`, rule: 'ny färg', explanation: `6+ ${msym}, svag (passad hand) → 3${msym} (naturligt, ej krav).` }
    }
  }
  // Naturlig sanginbjudan: balanserad 11–12 utan stöd (öppnaren 3NT med 14+).
  // (13–15 balanserad — bara människan — går till 3NT i det vanliga schemat.)
  if (isBalanced(hand) && p >= 11 && p <= 12 && support <= 2) {
    return { call: '2NT', rule: 'inbjudan', explanation: `Balanserad 11–12 utan stöd (passad hand) → 2NT (naturlig inbjudan, ej krav).` }
  }

  // Övriga svar (högst 2 trumf): vanligt schema — utan fit når det aldrig Jacoby/Bergen.
  return respondToMajor(hand, opened)
}

/** Öppnarens återbud efter Drury (2♣/2♦). §6.7. */
export function openerRebidAfterDrury(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const sym = SYM[opened]
  const bid = BIDOF[opened]

  // Riktig öppning → utgång (mot 10–12 limithöjning räcker ~14+ för 25+).
  if (p >= 15) {
    return { call: `4${bid}`, rule: 'Drury: riktig öppning', explanation: `Riktig öppning (15+) → 4${sym} (utgång).` }
  }
  // Måttlig öppning → inbjuder genom att bjuda 3 i färgen (krav på svararens topp).
  if (p >= 13) {
    return { call: `3${bid}`, rule: 'Drury: utgångsförsök', explanation: `Möjlig utgång (13–14) → 3${sym} (utgångsförsök).` }
  }
  // Lätt öppning → rebjuden högfärg = signoff (svararen passar).
  return { call: `2${bid}`, rule: 'Drury: lätt öppning', explanation: `Lätt öppning → 2${sym} (signoff, svararen passar).` }
}

/**
 * Svararens placering efter öppnarens Drury-återbud (FAS 9).
 *   - 2M (lätt öppning, signoff) → pass.
 *   - 3M (utgångsförsök) → acceptera 4M med **stödpoäng ≥ 11** (ägarbeslut
 *     2026-07-01: samma omvärdering `max(hp, dummyPoints)` som resten av
 *     motorn – 4+ trumf och korta sidofärger lyfter toppen av 10–12-intervallet
 *     över tröskeln), annars pass (botten av intervallet).
 *   - 4M (riktig öppning, utgång) → pass.
 * Svararen är passad hand → allt är begränsat till utgång, aldrig slam.
 */
export function responderAnswerDrury(hand: Hand, opened: Major, rebid: ResponseResult): ResponseResult {
  const sym = SYM[opened]
  const bid = BIDOF[opened]

  // Bara öppnarens utgångsförsök (3M) kräver ett beslut – signoff/utgång passas.
  if (rebid.call === `3${bid}`) {
    const sp = pointsWithFloor(hand, opened, 'support')
    if (sp.points >= 11) {
      return { call: `4${bid}`, rule: 'Drury: accepterar utgångsförsök', explanation: `Toppen av limithöjningen → 4${sym} (accepterar).` }
    }
    return { call: 'P', rule: 'Drury: avböjer utgångsförsök', explanation: `Botten av limithöjningen → pass (avböjer 3${sym}).` }
  }

  // Öppnaren har redan placerat kontraktet (2M signoff / 4M utgång) → pass.
  return { call: 'P', rule: 'Drury: passar öppnarens placering', explanation: `Öppnaren placerade kontraktet (${rebid.call}) → pass.` }
}
