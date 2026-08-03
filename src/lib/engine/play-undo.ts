// Ångra i kortspelet (Etapp C, granskningen 2026-08-02): ett feltryck på
// mobilen spelar kortet direkt — utan ångra straffas tummen med hela given.
// Ångra backar till läget FÖRE ditt senaste kort: allt från och med det
// kortet (även bottarnas svar efteråt) spelas bort, och det är din tur igen.
// Läget byggs upp via motorns egen playCard-replay (resume.ts) — resultatet
// är per definition ett lagligt läge.

import type { Deal, Seat } from '../../types/bridge'
import { type Contract, type PlayState } from './play'
import { rebuildPlay } from './resume'

/** Alla lagda kort i ordning, med plats (färdiga stick + pågående). */
function sequence(state: PlayState) {
  return [...state.completedTricks.flatMap((t) => t.cards), ...state.currentTrick]
}

/** Finns något att ångra — har någon av dina platser lagt ett kort? */
export function canUndo(state: PlayState, humanSeats: Seat[]): boolean {
  return sequence(state).some((pc) => humanSeats.includes(pc.seat))
}

/**
 * Läget före ditt senaste kort (ditt kort och allt efter det ospelas).
 * null om du inte lagt något kort än — då finns inget att ångra.
 */
export function undoLastHumanCard(
  deal: Deal,
  contract: Contract,
  state: PlayState,
  humanSeats: Seat[],
): PlayState | null {
  const seq = sequence(state)
  for (let i = seq.length - 1; i >= 0; i--) {
    if (humanSeats.includes(seq[i].seat)) {
      return rebuildPlay(deal, contract, seq.slice(0, i).map((pc) => pc.card))
    }
  }
  return null
}
