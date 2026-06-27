// Budmotorns svar på partnerns spärröppning på 3- eller 4-läget (7+/8+ korts
// färg, svag). Härlett ur systemboken §4.6. Svararen är KAPTEN och beslutar
// oftast direkt – pass är vanligast.
//
//   1. respondToPreempt          – svararens bud (pass, höjning, ny färg, 3NT)
//   2. openerRebidAfterPreemptNewSuit – öppnarens svar på krav-ny-färg
//
// Avgränsning: 4NT (1430 RKC) och cue-bid mot slam hör till §6 (slamverktyg,
// punkt 17–18) och tas där – tills dess passar/avslutar svararen.

import type { Hand, Rank, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankOf = (s: Suit) => RANK.indexOf(s)
const SUIT_OF_CALL: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
const isMajor = (s: Suit) => s === 'hearts' || s === 'spades'

/** Tolkar en spärröppning ("3H" → hearts, level 3). null om det inte är en spärr. */
export function preemptOf(call: string): { suit: Suit; level: number } | null {
  const m = call.match(/^([34])(C|D|H|S)$/)
  return m ? { suit: SUIT_OF_CALL[m[2]], level: parseInt(m[1], 10) } : null
}

/** Grov stopp-koll för NT: A, Kx, Qxx eller J10xx. */
function hasStopper(hand: Hand, suit: Suit): boolean {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  const n = ranks.length
  const has = (r: Rank) => ranks.includes(r)
  if (has('A')) return true
  if (has('K') && n >= 2) return true
  if (has('Q') && n >= 3) return true
  if (has('J') && has('10') && n >= 4) return true
  return false
}

/** Längsta sidofärgen (≠ trumf) med minst `min` kort; lika → högst rankad. */
function longestSide(len: Record<Suit, number>, opened: Suit, min: number): Suit | null {
  let best: Suit | null = null
  for (const s of RANK) {
    if (s === opened || len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankOf(s) > rankOf(best))) best = s
  }
  return best
}

function levelAbove(suit: Suit, refSuit: Suit, refLevel: number): number {
  return rankOf(suit) > rankOf(refSuit) ? refLevel : refLevel + 1
}

// === 1. Svararens svar på en spärröppning ==================================

/** Vad svarar man på partnerns spärröppning 3X/4X? Systembok §4.6. */
export function respondToPreempt(hand: Hand, opened: Suit, level: number): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const sym = SYM[opened]
  const bid = BID[opened]
  const pass: ResponseResult = { call: 'P', rule: 'spärr-pass', explanation: `${p} hp – ingen utgång → pass (spärren är redan högt).` }

  // 4-läget: nästan ingen plats. Slam via 4NT/cue tas i §6 → tills dess pass.
  if (level >= 4) return pass

  // 3-läget. Krav-värden för att flytta: ~16+ hp.
  if (p < 16) {
    // Utgång ändå med stark fit i högfärg (lång trumf täcker svaghet).
    if (isMajor(opened) && support >= 4 && p >= 13) {
      return { call: `4${bid}`, rule: 'höjning till utgång', explanation: `${p} hp, ${support} stöd → 4${sym} (utgång, lång fit).` }
    }
    return pass
  }

  // 16+ : kaptenen letar utgång.
  // Fit i öppnarens högfärg → utgång.
  if (isMajor(opened) && support >= 2) {
    return { call: `4${bid}`, rule: 'höjning till utgång', explanation: `${p} hp, ${support} stöd → 4${sym} (utgång).` }
  }
  // Egen stark 5+ sidofärg → ny färg, krav 1 rond.
  const side = longestSide(len, opened, 5)
  if (side) {
    const lvl = levelAbove(side, opened, 3)
    return { call: `${lvl}${BID[side]}`, rule: 'ny färg (krav)', explanation: `${p} hp med ${len[side]}-korts ${NAME[side]} → ${lvl}${SYM[side]} (naturlig, krav 1 rond).` }
  }
  // 3NT till spel: stopp i sidofärgerna, räknar med öppnarens långa färg.
  const sideSuits = RANK.filter((s) => s !== opened)
  if (isBalanced(hand) || sideSuits.every((s) => hasStopper(hand, s) || len[s] <= 2)) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp med stopp i sidofärgerna → 3NT (öppnarens långfärg ger stick).` }
  }
  return pass
}

// === 2. Öppnarens svar på krav-ny-färg =====================================

/** Öppnarens återbud efter svararens krav-ny-färg över en spärr. §4.6. */
export function openerRebidAfterPreemptNewSuit(hand: Hand, opened: Suit, newSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const responderLevel = levelAbove(newSuit, opened, 3) // nivån svararen bjöd den nya färgen på
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'rebid: pass', explanation: `${p} hp – ${why} → pass.` })

  // Stöd (3+) i svararens färg → sätt utgång (eller passa om den redan är nådd).
  if (len[newSuit] >= 3) {
    const gameLevel = isMajor(newSuit) ? 4 : 5
    if (responderLevel >= gameLevel) return pass(`stöd i ${NAME[newSuit]}, utgång redan nådd`)
    return { call: `${gameLevel}${BID[newSuit]}`, rule: 'rebid: stöd', explanation: `${p} hp, ${len[newSuit]} stöd i ${NAME[newSuit]} → ${gameLevel}${SYM[newSuit]} (utgång).` }
  }

  // Ingen passning: rebjuda egen färg billigast om det ryms under/på utgång.
  const ownLevel = rankOf(opened) > rankOf(newSuit) ? responderLevel : responderLevel + 1
  const ownGame = isMajor(opened) ? 4 : 5
  if (ownLevel <= ownGame) {
    return { call: `${ownLevel}${BID[opened]}`, rule: 'rebid: egen färg', explanation: `${p} hp – minimum, ingen passning → ${ownLevel}${SYM[opened]} (rebjuden färg).` }
  }
  return pass('minimum, inget bättre')
}
