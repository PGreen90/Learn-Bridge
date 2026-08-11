// Beslut B etapp 2 (Led 2) — server-validering av ett inskickat tävlingsresultat.
//
// "Snabb" nivå (ägarbeslut 2026-08-11): kontrollera det som är BILLIGT och
// deterministiskt och som fångar PÅHITTADE resultat — servern litar aldrig på
// klientens giv eller poäng:
//   1. Given regenereras ur det hemliga fröet (klienten kan inte byta giv).
//   2. Auktionen: rätt budordning, Syds bud lagliga, och varje BOT-bud = motorns
//      bud (fångar en manipulerad auktion). Budgivningen är deterministisk.
//   3. Kortspelet: varje kort lagligt (motorns egen playCard), och antalet
//      spelförarstick ryms i spelet (och stämmer exakt när given spelats färdigt).
//   4. Poängen räknas ALLTID om på servern ur kontrakt + stick + zon.
//
// DJUP nivå (etapp 3, härdningen): att varje BOTKORT var motorns val (tungt,
// Monte-Carlo) skjuts dit — då byggs dolda händer på servern ändå. Tills dess
// är gränsen öppet redovisad (docs/beslut-b-plan.md, Nivå 1/2).
//
// Ren logik, ingen I/O — endpointen (api-src/skicka-in.ts) sköter auth + DB.
// Motorn buntas server-side av scripts/build-api.mjs.

import type { Card } from '../../src/types/bridge'
import type { ResolvedCall } from '../../src/lib/bidding'
import { dealFromSeed } from '../../src/lib/engine/deal'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from '../../src/lib/engine/auction-live'
import {
  contractResult,
  isComplete,
  legalCards,
  playCard,
  startPlay,
} from '../../src/lib/engine/play'
import { declarerTricksWon, remainingTricks } from '../../src/lib/engine/claim'
import { nsScore } from '../../src/lib/engine/matchpoints'
import { seedForBoard } from './seed'

/** Ett inskick för EN tävlingsgiv. Servern regenererar given själv ur fröet —
 *  därför skickas inte händerna, bara brickan + det spelaren gjorde. */
export interface Inskick {
  board: number
  history: ResolvedCall[]
  plays: Card[]
  /** Klientens antal spelförarstick — verifieras mot omspelningen, aldrig litat på. */
  declarerTricks: number
}

export type Validering =
  | { giltig: true; passad: boolean; declarerTricks: number; nsScore: number }
  | { giltig: false; skäl: string }

const fail = (skäl: string): Validering => ({ giltig: false, skäl })

function sammaKort(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

/** Validera ett inskick mot dagens hemliga frö. Returnerar giltig + omräknad
 *  N/S-poäng, eller ogiltig + ett skäl (för granskningsloggen). */
export function validera(secret: string, dateISO: string, inskick: Inskick): Validering {
  const { board, history, plays, declarerTricks } = inskick
  if (!Number.isInteger(board) || board < 1) return fail('ogiltig bricka')
  if (!Array.isArray(history) || !Array.isArray(plays)) return fail('inskicket saknar auktion/kort')

  // 1. Regenerera given ur fröet — allt nedan replayas mot DEN, inte klientens.
  const deal = dealFromSeed(seedForBoard(secret, dateISO, board), board)

  // 2. Auktionen: budordning, Syds lagliga bud, bot-bud = motorns.
  for (let i = 0; i < history.length; i++) {
    const seat = seatToAct(deal.dealer, i)
    const call = history[i]
    if (!call || call.seat !== seat) return fail(`fel budordning vid index ${i}`)
    const prefix = history.slice(0, i)
    if (seat === 'S') {
      if (!legalCalls(prefix, 'S').includes(call.bid)) return fail(`olagligt Syd-bud vid index ${i}`)
    } else {
      const motor = decideCall(deal, prefix, seat)
      if (motor.bid !== call.bid) {
        return fail(`boten (${seat}) skulle bjuda ${motor.bid}, inte ${call.bid} (index ${i})`)
      }
    }
  }
  if (!auctionComplete(history)) return fail('auktionen är inte avslutad')

  // 3. Kontraktet — eller en giltig utpassad giv (0 kort, 0 poäng).
  const contract = contractFromCalls(history)
  if (!contract) {
    if (plays.length > 0) return fail('utpassad giv men spelade kort finns')
    return { giltig: true, passad: true, declarerTricks: 0, nsScore: 0 }
  }

  // 4. Kortspelet: varje kort lagligt enligt motorns egen playCard.
  let state = startPlay(deal, contract)
  for (const card of plays) {
    if (!legalCards(state, state.toAct).some((c) => sammaKort(c, card))) {
      return fail('olagligt kort i spelet')
    }
    state = playCard(state, card)
  }

  // Spelförarsticken: måste rymmas i spelet, och stämma exakt när det är färdigt.
  const won = declarerTricksWon(state)
  const kvar = remainingTricks(state)
  if (!Number.isInteger(declarerTricks) || declarerTricks < won || declarerTricks > won + kvar) {
    return fail('orimligt antal spelförarstick')
  }
  if (isComplete(state) && declarerTricks !== contractResult(state).declarerTricks) {
    return fail('spelförarsticken stämmer inte med det spelade')
  }

  // 5. Poängen räknas om på servern (N/S-perspektiv för matchpoängen, Led 3).
  return {
    giltig: true,
    passad: false,
    declarerTricks,
    nsScore: nsScore(contract, declarerTricks, deal.vulnerability),
  }
}
