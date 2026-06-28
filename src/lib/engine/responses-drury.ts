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
import { hcp, lengths } from './hand'
import { respondToMajor, type Major, type ResponseResult } from './responses'

const SYM: Record<Major, string> = { hearts: '♥', spades: '♠' }
const BIDOF: Record<Major, string> = { hearts: 'H', spades: 'S' }

/** Svararens svar på 1♥/1♠ när hon är PASSAD hand. Drury för limithöjningar. */
export function respondToMajorPassed(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]

  // Drury: limithöjning (10–12 hp) med stöd → konstgjord 2♣/2♦.
  if (p >= 10 && p <= 12 && support >= 3) {
    if (support >= 4) {
      return { call: '2D', rule: 'Drury', explanation: `${p} hp, ${support} trumf (passad hand) → 2♦ (Drury, limithöjning 4+).` }
    }
    return { call: '2C', rule: 'Drury', explanation: `${p} hp, 3 trumf (passad hand) → 2♣ (Drury, limithöjning).` }
  }

  // Övriga svar: vanligt schema (passad hand → begränsat, inga GF-bud i praktiken).
  return respondToMajor(hand, opened)
}

/** Öppnarens återbud efter Drury (2♣/2♦). §6.7. */
export function openerRebidAfterDrury(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const sym = SYM[opened]
  const bid = BIDOF[opened]

  // Riktig öppning → utgång (mot 10–12 limithöjning räcker ~14+ för 25+).
  if (p >= 15) {
    return { call: `4${bid}`, rule: 'Drury: riktig öppning', explanation: `${p} hp – riktig öppning, utgång → 4${sym}.` }
  }
  // Måttlig öppning → inbjuder genom att bjuda 3 i färgen (krav på svararens topp).
  if (p >= 13) {
    return { call: `3${bid}`, rule: 'Drury: utgångsförsök', explanation: `${p} hp – möjlig utgång → 3${sym} (utgångsförsök).` }
  }
  // Lätt öppning → rebjuden högfärg = signoff (svararen passar).
  return { call: `2${bid}`, rule: 'Drury: lätt öppning', explanation: `${p} hp – lätt öppning → 2${sym} (signoff, svararen passar).` }
}
