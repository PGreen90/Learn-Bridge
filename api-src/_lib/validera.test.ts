// Facit för server-valideringen (Beslut B etapp 2, Led 2): ett ärligt
// motor-genererat inskick godkänns; en bytt giv, ett manipulerat bot-bud och
// ett påhittat stickantal avvisas.

import { describe, test, expect } from 'vitest'
import type { Card } from '../../src/types/bridge'
import type { ResolvedCall } from '../../src/lib/bidding'
import { dealFromSeed } from '../../src/lib/engine/deal'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  seatToAct,
} from '../../src/lib/engine/auction-live'
import { contractResult, isComplete, legalCards, playCard, startPlay } from '../../src/lib/engine/play'
import { seedForBoard } from './seed'
import { validera, type Inskick } from './validera'

const SECRET = 'hemlis'
const DATE = '2026-08-11'

/** Ett ärligt inskick: motorn budar alla stolar och spelar ut given med
 *  först-lagliga-kort. Räcker för valideringen (den snabba nivån bryr sig om
 *  laglighet + poäng, inte om vilket lagligt kort som valdes). */
function ärligtInskick(board: number): Inskick {
  const deal = dealFromSeed(seedForBoard(SECRET, DATE, board), board)
  const history: ResolvedCall[] = []
  while (!auctionComplete(history)) {
    const seat = seatToAct(deal.dealer, history.length)
    history.push(decideCall(deal, history, seat))
  }
  const contract = contractFromCalls(history)
  const plays: Card[] = []
  let declarerTricks = 0
  if (contract) {
    let s = startPlay(deal, contract)
    while (!isComplete(s)) {
      const card = legalCards(s, s.toAct)[0]
      plays.push(card)
      s = playCard(s, card)
    }
    declarerTricks = contractResult(s).declarerTricks
  }
  return { board, history, plays, declarerTricks }
}

/** Första brickan med ett riktigt kontrakt (inte utpassad) — för spel-testerna. */
function speladBricka(): { board: number; inskick: Inskick } {
  for (let board = 1; board <= 12; board++) {
    const inskick = ärligtInskick(board)
    if (inskick.plays.length > 0) return { board, inskick }
  }
  throw new Error('ingen bricka gav ett kontrakt (osannolikt)')
}

describe('validera — ärligt inskick', () => {
  test('alla 12 motor-spelade givar godkänns', () => {
    for (let board = 1; board <= 12; board++) {
      const v = validera(SECRET, DATE, ärligtInskick(board))
      expect(v.giltig, `bricka ${board}: ${v.giltig ? '' : v.skäl}`).toBe(true)
    }
  })

  test('godkänt inskick ger en omräknad N/S-poäng', () => {
    const { inskick } = speladBricka()
    const v = validera(SECRET, DATE, inskick)
    expect(v.giltig).toBe(true)
    if (v.giltig) expect(typeof v.nsScore).toBe('number')
  })
})

describe('validera — avvisar fusk', () => {
  test('bytt giv: inskick för en bricka validerat som en annan avvisas', () => {
    const a = ärligtInskick(1)
    // Validera brickа 1:s spel som om det vore brickа 2 → given (och därmed
    // bot-buden/korten) stämmer inte. (Skulle båda vara utpassade identiskt är
    // det ofarligt; i praktiken skiljer de sig.)
    const v = validera(SECRET, DATE, { ...a, board: 2 })
    expect(v.giltig).toBe(false)
  })

  test('manipulerat bot-bud avvisas', () => {
    const { inskick } = speladBricka()
    // Hitta ett bot-bud (icke-Syd) och byt det.
    const deal = dealFromSeed(seedForBoard(SECRET, DATE, inskick.board), inskick.board)
    const i = inskick.history.findIndex((_, idx) => seatToAct(deal.dealer, idx) !== 'S')
    expect(i).toBeGreaterThanOrEqual(0)
    const manipulerad = inskick.history.map((c, idx) =>
      idx === i ? { ...c, bid: c.bid === 'pass' ? '1NT' : 'pass' } : c,
    ) as ResolvedCall[]
    const v = validera(SECRET, DATE, { ...inskick, history: manipulerad })
    expect(v.giltig).toBe(false)
  })

  test('påhittat stickantal på en färdigspelad giv avvisas', () => {
    const { inskick } = speladBricka()
    const fejk = { ...inskick, declarerTricks: Math.min(13, inskick.declarerTricks + 1) }
    // +1 utöver de faktiska sticken ligger utanför spelets utfall → avvisas.
    const v = validera(SECRET, DATE, fejk)
    expect(v.giltig).toBe(false)
  })

  test('olagligt kort avvisas', () => {
    const { inskick } = speladBricka()
    // Byt ut ett spelat kort mot ett annat (nästan säkert olagligt i det läget).
    const trasig = [...inskick.plays]
    const annat: Card = { suit: 'spades', rank: trasig[0].suit === 'spades' ? '2' : 'A' }
    trasig[0] = annat
    const v = validera(SECRET, DATE, { ...inskick, plays: trasig })
    // Antingen olagligt kort, eller (om det råkar vara lagligt) fel stickantal.
    expect(v.giltig).toBe(false)
  })
})
