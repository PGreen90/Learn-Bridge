// Tävlings-UI-polish steg 5 — rondgenomgången för en FÄRDIGSPELAD tävlingsgiv.
//
// Framsteget sparar (Led 1) auktionen + de spelade korten + det kompakta
// kontraktet för varje klar giv. Härifrån kan rondgenomgången (RondRapportView)
// återskapas DETERMINISTISKT utan att gå in i det interaktiva bordet igen: spela
// om korten genom motorn för sticken, och läs resultatet ur det bokförda
// kontraktet (samma tal servern validerade). Klämtade givar (partiella kort) får
// `claimed` satt och resultatet ur kontraktet i stället för ur sista sticket.
//
// Ren logik utan I/O — facit testar den isolerat (granska-tavling.test.ts).

import type { Card, Deal } from '../../types/bridge'
import {
  isComplete,
  playCard,
  startPlay,
  type Contract,
  type PlayResult,
  type Trick,
} from '../../lib/engine/play'
import { scoreLine, type ScoreLine } from '../../lib/engine/scoring'
import type { GivKontrakt } from '../../lib/backend/tavling'

/** Allt RondRapportView behöver för en färdigspelad tävlingsgiv. */
export interface Granskning {
  contract: Contract
  tricks: Trick[]
  result: PlayResult
  score: ScoreLine
  /** Satt när given klämtades (färre än 13 spelade stick) — annars null. */
  claimed: { total: number; auto: boolean } | null
}

/** Bygg rondgenomgångens indata ur en klar tävlingsgiv. `plays` och kontraktet
 *  kommer från framsteget; given (`deal`) från dagens tävling. Antar giltiga
 *  kort (de validerades vid inskicket) — spelas om rakt genom motorn. */
export function byggGranskning(deal: Deal, plays: Card[], kontrakt: GivKontrakt): Granskning {
  const contract: Contract = {
    declarer: kontrakt.declarer,
    strain: kontrakt.strain,
    level: kontrakt.level,
    doubled: kontrakt.doubled,
  }
  let state = startPlay(deal, contract)
  for (const card of plays) state = playCard(state, card)

  const needed = 6 + contract.level
  const declarerTricks = needed + kontrakt.diff
  const result: PlayResult = {
    declarerTricks,
    needed,
    made: kontrakt.diff >= 0,
    diff: kontrakt.diff,
  }
  const score = scoreLine(contract, declarerTricks, deal.vulnerability)
  const claimed = isComplete(state) ? null : { total: declarerTricks, auto: false }
  return { contract, tricks: state.completedTricks, result, score, claimed }
}
