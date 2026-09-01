// FACIT för bot-deltagaren i dagliga tävlingen (skrivet FÖRE nattjobbet).
//
// Tre löften som hela funktionen vilar på:
//   1. Botens inskick går igenom SAMMA validera() som människors inskick —
//      annars har boten en egen poängväg, vilket är förbjudet (paritetskravet).
//   2. Determinism: samma (frö, playSeed) → exakt samma inskick, så nattjobbet
//      är idempotent och en omkörning aldrig ger nya resultat.
//   3. Nattgranskningsparitet: djupgranskningen (tavlingsgranskning.probe)
//      replayar botsätenas kort ur (playSeed, beslutsindex) — botens kort på de
//      säten den granskar måste vara exakt motorns val, annars flyttas botens
//      rader till 'granskning' varje natt.
//
// Hemligheten här är en TESThemlighet — poängen är att allt (giv, playSeed,
// validering) härleds ur samma sträng, precis som i skarp drift.

import { describe, expect, it } from 'vitest'
import type { Card, Seat } from '../../types/bridge'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { validera } from '../../../api-src/_lib/validera'
import { spelaBotGiv, type BotInskick } from './botspelare'
import { dealFromSeed, mulberry32 } from './deal'
import { contractFromCalls } from './auction-live'
import { playCard, side, startPlay } from './play'
import { botCardSmart } from './play-bot'
import { botDecisionSeed, playIndexOf } from './play-seed'

const SECRET = 'facit-testhemlighet'
const DATUM = '2026-08-31'
// Två brickor räcker som facit i deploygrinden (nattjobbet spelar alla 12) —
// en giv tar ~40 s att spela (MC-besluten), så fler brickor = tyngre `npm test`
// utan mer bevisvärde. Egna tidsgränser per test, som de tunga DDS-testerna.
const BRICKOR = [1, 2]
const TUNG = 300_000

const farsktSpel = (board: number): BotInskick | null =>
  spelaBotGiv(seedForBoard(SECRET, DATUM, board), playSeedForBoard(SECRET, DATUM, board), board)

// Memo: spelet är dyrt och deterministiskt (eget facit nedan) — spela varje
// bricka EN gång och låt testerna dela resultatet.
const memo = new Map<number, BotInskick | null>()
const spela = (board: number): BotInskick | null => {
  if (!memo.has(board)) memo.set(board, farsktSpel(board))
  return memo.get(board)!
}

describe('bot-deltagarens inskick', () => {
  it('godkänns av samma validera() som människors inskick', { timeout: TUNG }, () => {
    for (const board of BRICKOR) {
      const inskick = spela(board)
      expect(inskick, `bricka ${board}: auktionen skenade`).not.toBeNull()
      const v = validera(SECRET, DATUM, inskick!)
      expect(v.giltig, `bricka ${board}: ${v.giltig ? '' : v.skäl}`).toBe(true)
    }
  })

  it('är deterministiskt — samma frön ger exakt samma inskick', { timeout: TUNG }, () => {
    // Memoiserat resultat mot en FÄRSK genomspelning — annars testas bara memon.
    expect(farsktSpel(1)).toEqual(spela(1))
  })

  it('klarar nattgranskningens replay — botsätenas kort är motorns egna val', { timeout: TUNG }, () => {
    for (const board of BRICKOR) {
      const inskick = spela(board)!
      const contract = contractFromCalls(inskick.history)
      if (!contract || !inskick.plays.length) continue
      const deal = dealFromSeed(seedForBoard(SECRET, DATUM, board), board)
      const playSeed = playSeedForBoard(SECRET, DATUM, board)
      // Exakt granskningens urval: "människan" (här boten på Syds plats) styr S,
      // och hela N/S-sidan när N/S är spelförande — övriga säten granskas.
      const granskas = (seat: Seat) =>
        side(contract.declarer) === 'NS' ? side(seat) !== 'NS' : seat !== 'S'
      let state = startPlay(deal, contract)
      for (const spelat of inskick.plays) {
        const seat = state.toAct
        if (granskas(seat)) {
          const index = playIndexOf(state.completedTricks.length, state.currentTrick.length)
          const rng = mulberry32(botDecisionSeed(playSeed, index))
          const motorns: Card = botCardSmart(state, seat, inskick.history, { rng })
          expect(motorns, `bricka ${board}, kort ${index + 1} (${seat})`).toEqual(spelat)
        }
        state = playCard(state, spelat)
      }
    }
  })
})
