// Spara/återuppta en pågående giv (Etapp B, granskningen 2026-08-02): förr
// bodde HELA spelläget i minnet — en omladdning, ett telefonlås som slängde
// fliken eller ett bakåtsvep kastade bort given. Nu sparas det som behövs för
// att bygga upp EXAKT samma läge igen: given, budhistoriken och de spelade
// korten i ordning. Uppspelningen går genom motorns egna playCard, så det
// återuppbyggda läget är per definition ett lagligt läge.
//
// Ren logik utan I/O — localStorage-läsning/skrivningen bor i UI:t
// (lib/storage). ResolvedCall importeras BARA som typ (raderas vid bygget),
// så modulen drar inte in övnings-JSON:en från lib/bidding.

import type { Card, Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { playCard, startPlay, type Contract, type PlayState } from './play'

/** Formen som sparas under `learnbridge:pagaende-giv`. `v` är schemaversionen —
 *  ändras formen i framtiden bumpas den, och gamla sparningar ignoreras tyst
 *  (validSavedGame släpper inte igenom dem). */
export interface SavedGame {
  v: 1
  daily: boolean
  /** Dagens givs löpnummer när daily — en sparad gårdagsgiv ska inte återupptas. */
  number: number | null
  /** Slumpfröet för fria givar (null för dagens giv och äldre mål-sökta givar). */
  seed: number | null
  deal: Deal
  history: ResolvedCall[]
  phase: 'bidding' | 'play'
  /** Spelade kort i exakt ordning (motorn vet själv vems tur det var). */
  plays: Card[]
}

/** De spelade korten i ordning, ur ett spel-läge (färdiga stick + pågående). */
export function playsFrom(state: PlayState): Card[] {
  return [
    ...state.completedTricks.flatMap((t) => t.cards.map((pc) => pc.card)),
    ...state.currentTrick.map((pc) => pc.card),
  ]
}

/** Bygg upp spel-läget igen genom att spela korten i tur och ordning.
 *  null om något kort är olagligt (korrupt/gammal sparning) — då börjar
 *  given hellre om än kraschar. */
export function rebuildPlay(deal: Deal, contract: Contract, plays: Card[]): PlayState | null {
  try {
    return plays.reduce((s, c) => playCard(s, c), startPlay(deal, contract))
  } catch {
    return null
  }
}

const SEATS: Seat[] = ['N', 'E', 'S', 'W']

/** Strukturkontroll av en inläst sparning (granskningens punkt om att giltig
 *  JSON med fel form annars går rakt igenom). Ytlig med flit: djupet — att
 *  korten är lagliga — kontrolleras av rebuildPlay/motorn vid uppspelningen. */
export function validSavedGame(x: unknown): x is SavedGame {
  if (typeof x !== 'object' || x === null) return false
  const g = x as Record<string, unknown>
  if (g.v !== 1) return false
  if (typeof g.daily !== 'boolean') return false
  if (g.phase !== 'bidding' && g.phase !== 'play') return false
  if (!Array.isArray(g.history) || !Array.isArray(g.plays)) return false
  const deal = g.deal as Record<string, unknown> | null
  if (typeof deal !== 'object' || deal === null) return false
  const hands = deal.hands as Record<string, unknown> | null
  if (typeof hands !== 'object' || hands === null) return false
  return SEATS.every((s) => Array.isArray(hands[s]) && (hands[s] as unknown[]).length <= 13)
}
