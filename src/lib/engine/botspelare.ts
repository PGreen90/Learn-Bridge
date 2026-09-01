// BOT-DELTAGAREN I DAGLIGA TÄVLINGEN (ägarbeslut 2026-08-31) — spelar EN
// tävlingsgiv precis som en människa vid bordet skulle, fast med bot-hjärnan
// även på Syds plats, och lämnar tillbaka ett inskick i exakt samma form som
// klientens (bricka + auktion + spelade kort + spelförarstick).
//
// Poängen med formen: inskicket går igenom SAMMA validera() som människors
// inskick (api-src/_lib/validera.ts) — samma regenererade giv, samma
// omräknade N/S-poäng. Boten får aldrig en egen poängväg.
//
// Determinism: auktionen är deterministisk (decideCall), och varje kortbeslut
// får sitt frö ur (playSeed, beslutsindex) — EXAKT samma väg som bottarna vid
// människans bord (usePlayTable) och som nattgranskningen replayar med
// (tavlingsgranskning.probe.test.ts). Därför godkänner djupgranskningen botens
// rader av sig själv, och en omkörning ger alltid samma resultat.
//
// Ren logik utan I/O och utan hemligheter — fröna räknas fram av anroparen
// (api-src/_lib/seed.ts har HMAC-hemligheten; den hör inte hemma här, modulen
// ska kunna importeras var som helst utan node:crypto).

import type { Card } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed, mulberry32 } from './deal'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-live'
import { contractResult, isComplete, playCard, startPlay } from './play'
import { botCardSmart } from './play-bot'
import { botDecisionSeed, playIndexOf } from './play-seed'

/** Samma form som api-src/_lib/validera.ts `Inskick` (medvetet strukturellt
 *  identisk, inte importerad — den filen drar in node:crypto via seed.ts). */
export interface BotInskick {
  board: number
  history: ResolvedCall[]
  plays: Card[]
  declarerTricks: number
}

/**
 * Spela en hel tävlingsgiv som bot: auktion (alla fyra säten via decideCall) +
 * kortspel (varje beslut fröat ur playSeed). `null` om auktionen skenar
 * (botAuctions vakt) — då får brickan inget bot-inskick, vilket rapporteras av
 * nattjobbet i stället för att gissas bort.
 */
export function spelaBotGiv(givSeed: number, playSeed: number, board: number): BotInskick | null {
  const deal = dealFromSeed(givSeed, board)
  const history = botAuction(deal)
  if (!history) return null

  // Utpassad giv: giltigt inskick med 0 kort och 0 stick (validera hanterar den).
  const contract = contractFromCalls(history)
  if (!contract) return { board, history, plays: [], declarerTricks: 0 }

  let state = startPlay(deal, contract)
  const plays: Card[] = []
  let guard = 0
  while (!isComplete(state) && guard++ < 60) {
    const index = playIndexOf(state.completedTricks.length, state.currentTrick.length)
    const rng = mulberry32(botDecisionSeed(playSeed, index))
    const card = botCardSmart(state, state.toAct, history, { rng })
    plays.push(card)
    state = playCard(state, card)
  }
  return { board, history, plays, declarerTricks: contractResult(state).declarerTricks }
}
