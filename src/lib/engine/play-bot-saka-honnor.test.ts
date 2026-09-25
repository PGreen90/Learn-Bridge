// FACIT FÖRE FIX — felrapport #78 + #79 (2026-09-20/24): försvararen SAKAR
// HONNÖRER "som en nybörjare" när kontraktet ändå är hemma.
//
// #79 (bricka 6, 4♠ av Öst): Nord sitter med ♥Q965 ♦KQ542 ♣K och ska saka på
// spelförarens trumf i stick 5 — och kastar ♣K (den enda kvarvarande höga
// klövern!). Anledningen: honnörsvakten `defenderGuardDiscard` letade en färg
// UTAN slagbar honnör att saka ur, hittade klöver (esset var borta, kungen kan
// inte slås) — och sakade honnören SJÄLV. Vakten skulle skydda honnörer, inte
// kasta dem. I stick 8 kastar Nord sedan ♦K (Monte-Carlo-lagret).
//
// #78 (bricka 3, 4♥ av Väst): Nord (♠K9542 ♦98) sakar ♠K i stick 7 — Monte-
// Carlo-lagret fann alla kort DD-likvärdiga (kontraktet är hemma) och tog det
// FÖRSTA i listan = det högsta. Vid lika ska det billigaste kortet spelas.
//
// Principen (docs/speldiagnos.md): RÄTT kort, inte max stick — bland DD-lika
// kort sakas alltid det lägsta, aldrig en honnör.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { mulberry32 } from './deal'
import { botCardReasoned, botCardSmartReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (code: string): Card => ({ suit: SU[code[0]], rank: (code.slice(1) === 'T' ? '10' : code.slice(1)) as Rank })
const NEXT: Record<Seat, Seat> = { N: 'E', E: 'S', S: 'W', W: 'N' }
function dealOf(dealer: Seat, vul: Deal['vulnerability'], h: Record<Seat, string>): Deal {
  return { id: 't', dealer, vulnerability: vul, board: 1, hands: { N: parseHand(h.N), E: parseHand(h.E), S: parseHand(h.S), W: parseHand(h.W) } }
}
function callsOf(dealer: Seat, bids: string[]): ResolvedCall[] {
  let seat = dealer
  return bids.map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = NEXT[seat]; return c })
}
/** Spelar rapportens kort i ordning tills `n` kort lagts. */
function after(deal: Deal, contract: Contract, played: string[], n: number): PlayState {
  let s = startPlay(deal, contract)
  for (const c of played.slice(0, n)) s = playCard(s, card(c))
  return s
}

describe('felrapport #79 – Nord sakar inte ♣K/♦K på spelförarens trumf (4♠ av Öst)', () => {
  const deal = dealOf('E', 'ew', {
    N: 'S:- H:Q96532 D:KQ542 C:K5',
    E: 'S:AK9876 H:A7 D:J9 C:A97',
    S: 'S:T5 H:KT84 D:T876 C:J32',
    W: 'S:QJ432 H:J D:A3 C:QT864',
  })
  const contract: Contract = { declarer: 'E', strain: 'spades', level: 4 }
  const calls = callsOf('E', ['1S', 'P', '3H', 'P', '3S', 'P', '4D', 'P', '4H', 'P', '4S', 'P', 'P', 'P'])
  const played = [
    'ST', 'S2', 'H6', 'SK', 'SA', 'S5', 'S3', 'H2', 'HA', 'H4', 'HJ', 'H3', 'CA', 'C2', 'C4', 'C5',
    'S7', 'D6', 'S4', /* Nord sakar */ 'CK', 'S8', 'C3', 'SJ', 'D4', 'SQ', 'D5', 'S9', 'CJ', 'C8', 'DK', 'C7', 'H8',
  ]

  it('stick 5 (9 kort kvar, tumregeln): Nord sakar en hacka, inte ♣K', () => {
    const s = after(deal, contract, played, 19)
    expect(s.toAct).toBe('N')
    const heur = botCardReasoned(s, 'N').card
    expect(heur).not.toEqual(card('CK'))
    expect(['J', 'Q', 'K', 'A']).not.toContain(heur.rank)
    expect(botCardSmartReasoned(s, 'N', calls, { rng: mulberry32(7) }).card).not.toEqual(card('CK'))
  })

  it('stick 8 (6 kort kvar, Monte-Carlo): Nord sakar inte ♦K', () => {
    const s = after(deal, contract, played, 29)
    expect(s.toAct).toBe('N')
    for (const seed of [1, 2, 3]) {
      const c = botCardSmartReasoned(s, 'N', calls, { rng: mulberry32(seed) }).card
      expect(c).not.toEqual(card('DK'))
    }
  })
})

describe('felrapport #78 – Nord sakar inte ♠K på spelförarens klöver (4♥ av Väst)', () => {
  const deal = dealOf('S', 'ew', {
    N: 'S:K9542 H:K D:9874 C:T73',
    E: 'S:A H:QJ82 D:QT65 C:AK42',
    S: 'S:T876 H:75 D:AKJ2 C:J96',
    W: 'S:QJ3 H:AT9643 D:3 C:Q85',
  })
  const contract: Contract = { declarer: 'W', strain: 'hearts', level: 4 }
  const calls = callsOf('S', ['P', '2H', 'P', '2NT', 'P', '3H', 'P', '4H', 'P', 'P', 'P'])
  const played = [
    'D7', 'D5', 'DJ', 'D3', 'DA', 'H3', 'D4', 'D6', 'HA', 'HK', 'H2', 'H5', 'H6', 'C3', 'H8', 'H7',
    'CA', 'C6', 'C5', 'C7', 'HQ', 'S6', 'H9', /* Nord sakar */ 'CT', 'C4', 'C9', 'CQ', /* Nord sakar */ 'SK',
  ]

  it('stick 7 (7 kort kvar, Monte-Carlo): Nord sakar en hacka, inte ♠K', () => {
    const s = after(deal, contract, played, 27)
    expect(s.toAct).toBe('N')
    for (const seed of [1, 2, 3]) {
      const c = botCardSmartReasoned(s, 'N', calls, { rng: mulberry32(seed) }).card
      expect(c).not.toEqual(card('SK'))
    }
  })

  it('stick 6 (8 kort kvar, Monte-Carlo): inte ♠K heller', () => {
    const s = after(deal, contract, played, 23)
    expect(s.toAct).toBe('N')
    for (const seed of [1, 2, 3]) {
      const c = botCardSmartReasoned(s, 'N', calls, { rng: mulberry32(seed) }).card
      expect(c).not.toEqual(card('SK'))
    }
  })
})
