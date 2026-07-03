// Claim (ägarönskemål 2026-07-03): spelföraren kan när som helst påstå att sidan
// tar X stick totalt i given, och appen dömer om påståendet håller.
//
// Två skilda mått, med avsikt:
// - MANUELL claim döms mot PERFEKT spel (DDS-lösaren): claimen godkänns om
//   spelföraren kan SÄKRA så många stick mot bästa motspel. Spelaren behöver
//   alltså kunna spela hem dem – men appen kräver inte att resten spelas ut.
// - AUTO CLAIM kräver det mycket strängare "omöjligt att förlora": sidan vinner
//   varje återstående stick OAVSETT hur den själv spelar (t.ex. bara höga trumf
//   kvar, eller idel toppkort i sang). Då kan given stängas utan att någon –
//   människa eller bot – ens teoretiskt kan spela bort något.

import { doubleDummyDeclarerRemaining, sureWinAllRemaining } from './dds'
import { side, type PlayState } from './play'

/** Stick kvar att spela, inklusive ett ev. pågående stick. */
export function remainingTricks(state: PlayState): number {
  return Math.max(
    state.hands.N.length,
    state.hands.E.length,
    state.hands.S.length,
    state.hands.W.length,
  )
}

/** Stick spelförarsidan redan vunnit. */
export function declarerTricksWon(state: PlayState): number {
  return side(state.contract.declarer) === 'NS' ? state.tricksNS : state.tricksEW
}

export type ClaimVerdict =
  | { verdict: 'godkänd' } // claimen håller mot bästa motspel
  | { verdict: 'nekad' } // så många stick går inte att säkra
  | { verdict: 'oavgjord' } // ställningen för tung att räkna just nu

/**
 * Döm en manuell claim: håller påståendet "spelförarsidan tar totalt
 * `claimedTotal` stick i given" från den nuvarande ställningen (även mitt i ett
 * stick)? Godkänd om DDS-lösaren garanterar minst så många mot perfekt motspel;
 * att claima FÄRRE än vad som går är också tillåtet (man skänker resten).
 */
export function adjudicateClaim(
  state: PlayState,
  claimedTotal: number,
  maxNodes = 2_000_000,
): ClaimVerdict {
  const won = declarerTricksWon(state)
  if (claimedTotal < won || claimedTotal > won + remainingTricks(state)) {
    return { verdict: 'nekad' } // utanför det möjliga spannet
  }
  const rest = doubleDummyDeclarerRemaining(
    state.hands,
    state.contract.strain,
    state.contract.declarer,
    state.currentTrick,
    state.toAct,
    maxNodes,
  )
  if (rest === null) return { verdict: 'oavgjord' }
  return won + rest >= claimedTotal ? { verdict: 'godkänd' } : { verdict: 'nekad' }
}

/**
 * Auto Claim: sant när spelförarsidan omöjligt kan förlora något av de
 * återstående sticken, oavsett hur den spelar (motståndarna prövas också med
 * alla sina kort). Kollas bara vid stickstart – mitt i ett stick spelas klart.
 */
export function autoClaimAvailable(state: PlayState, maxNodes = 250_000): boolean {
  if (state.currentTrick.length > 0) return false
  if (remainingTricks(state) === 0) return false
  return sureWinAllRemaining(
    state.hands,
    state.contract.strain,
    state.contract.declarer,
    state.toAct,
    maxNodes,
  )
}
