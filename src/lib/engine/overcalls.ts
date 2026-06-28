// Punkt 21–22: inkliv och tvåfärgsinkliv, systembok §7.1–7.2.
//
//   overcall          – vad bjuder vi när motståndaren öppnat 1 i färg?
//                       (enkelt inkliv, 1NT-inkliv, Michaels, ovanlig 2NT,
//                        upplysningsdubbling, pass)
//   advanceOvercall   – svar på partnerns enkla inkliv (höjning, cue=limit+,
//                       ny färg, NT)
//
// Avgränsning: hanterar motståndarens 1-läges färgöppning (1♣/1♦/1♥/1♠) – det
// vanligaste störningsläget. Svar mot deras 1NT (DONT) ligger i `dont.ts`, mot
// konventionella/svaga öppningar i `defense-conventional.ts`, och dubblingar när
// VI öppnat (negativ/responsiv/stöd) i `doubles.ts`.

import type { Hand, Rank, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)
const isMinor = (s: Suit) => s === 'clubs' || s === 'diamonds'

/** Tolkar en 1-läges färgöppning ("1H" → hearts). null annars (t.ex. 1NT). */
export function openingSuit(call: string): Suit | null {
  const m = call.match(/^1(C|D|H|S)$/)
  return m ? SUIT_OF_LETTER[m[1]] : null
}

/** Grov stopp-koll för NT: A, Kx, Qxx eller J10xx. */
export function hasStopper(hand: Hand, suit: Suit): boolean {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  const n = ranks.length
  const has = (r: Rank) => ranks.includes(r)
  if (has('A')) return true
  if (has('K') && n >= 2) return true
  if (has('Q') && n >= 3) return true
  if (has('J') && has('10') && n >= 4) return true
  return false
}

/** Nivån vårt inkliv hamnar på (1 om vår färg rankar över deras, annars 2). */
function overcallLevel(our: Suit, their: Suit): number {
  return rankIdx(our) > rankIdx(their) ? 1 : 2
}

/** Längsta inklivbara 5+ färg (≠ deras); lika längd → högst rankad. */
function bestOvercallSuit(len: Record<Suit, number>, their: Suit): Suit | null {
  let best: Suit | null = null
  for (const s of RANK_ORDER) {
    if (s === their || len[s] < 5) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/** Vad bjuder vi över motståndarens 1-läges färgöppning? §7.1–7.2. */
export function overcall(hand: Hand, theirCall: string): ResponseResult {
  const their = openingSuit(theirCall)
  const pass: ResponseResult = { call: 'P', rule: 'pass', explanation: 'ingen lämplig aktion → pass.' }
  if (!their) return pass

  const p = hcp(hand)
  const len = lengths(hand)
  const unbid = RANK_ORDER.filter((s) => s !== their)

  // 1) Ovanlig 2NT: 5-5 i de två lägsta objudna färgerna.
  const twoLowest = unbid.slice(0, 2)
  if (len[twoLowest[0]] >= 5 && len[twoLowest[1]] >= 5) {
    return { call: '2NT', rule: 'ovanlig 2NT', explanation: `5-5 i ${NAME[twoLowest[0]]}+${NAME[twoLowest[1]]} → 2NT (ovanlig, två lägsta objudna).` }
  }

  // 2) Michaels cue-bud (5-5).
  if (isMinor(their)) {
    if (len.hearts >= 5 && len.spades >= 5) {
      return { call: `2${BID[their]}`, rule: 'Michaels', explanation: `5-5 i högfärgerna → 2${SYM[their]} (Michaels cue).` }
    }
  } else {
    const otherMajor: Suit = their === 'hearts' ? 'spades' : 'hearts'
    const bestMinor: Suit = len.clubs >= len.diamonds ? 'clubs' : 'diamonds'
    if (len[otherMajor] >= 5 && len[bestMinor] >= 5) {
      return { call: `2${BID[their]}`, rule: 'Michaels', explanation: `5-5 ${NAME[otherMajor]} + minor → 2${SYM[their]} (Michaels cue).` }
    }
  }

  // 3) 1NT-inkliv: 15–18 balanserad med stopp.
  if (isBalanced(hand) && p >= 15 && p <= 18 && hasStopper(hand, their)) {
    return { call: '1NT', rule: '1NT-inkliv', explanation: `${p} hp balanserad med stopp i ${NAME[their]} → 1NT-inkliv (kör 1NT-systemet).` }
  }

  // 4) Upplysningsdubbling: kort i deras färg, stöd i övriga, öppningsstyrka.
  const shortTheirs = len[their] <= 2
  const supportUnbid = unbid.every((s) => len[s] >= 3)
  const longestUnbid = Math.max(...unbid.map((s) => len[s]))
  if (shortTheirs && supportUnbid && p >= 12 && longestUnbid <= 5) {
    return { call: 'X', rule: 'upplysningsdubbling', explanation: `${p} hp, kort i ${NAME[their]}, stöd i övriga → X (upplysning).` }
  }

  // 5) Enkelt inkliv: bra 5+ färg, 8–16 hp.
  const ov = bestOvercallSuit(len, their)
  if (ov && p >= 8 && p <= 16) {
    const lvl = overcallLevel(ov, their)
    // Svagt hoppinkliv: 6-korts färg, 6–10 hp som annars hade krävt 2-läget.
    return { call: `${lvl}${BID[ov]}`, rule: 'enkelt inkliv', explanation: `${p} hp med ${len[ov]}-korts ${NAME[ov]} → ${lvl}${SYM[ov]} (inkliv).` }
  }

  // 6) Svagt hoppinkliv: 6-korts färg, 6–10 hp (spärr).
  if (ov && len[ov] >= 6 && p >= 6 && p <= 10) {
    const lvl = overcallLevel(ov, their) + 1
    return { call: `${lvl}${BID[ov]}`, rule: 'hoppinkliv', explanation: `${p} hp med 6-korts ${NAME[ov]} → ${lvl}${SYM[ov]} (svagt hoppinkliv, spärr).` }
  }

  return pass
}

/** Svar på partnerns enkla inkliv (advancer). §7.1. */
export function advanceOvercall(hand: Hand, partnerSuit: Suit, theirSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[partnerSuit]
  const sym = SYM[partnerSuit]
  const bid = BID[partnerSuit]

  if (p < 6 && support < 3) return { call: 'P', rule: 'pass', explanation: `${p} hp utan stöd → pass.` }

  // Cue-bud i deras färg = limithöjning eller bättre (bra stöd, krav).
  if (support >= 3 && p >= 11) {
    return { call: `2${BID[theirSuit]}`, rule: 'cue (limithöjning+)', explanation: `${p} hp, ${support} stöd → cue ${SYM[theirSuit]} (limithöjning+, krav).` }
  }

  // Höjning: stöd, konkurrens (inte inbjudan i sig).
  if (support >= 3) {
    const lvl = rankIdx(partnerSuit) > rankIdx(theirSuit) ? 2 : 3
    return { call: `${lvl}${bid}`, rule: 'höjning', explanation: `${p} hp, ${support} stöd → ${lvl}${sym} (konkurrenshöjning).` }
  }

  // Ny färg: naturlig, konstruktiv (ej krav).
  const ownSuit = bestOvercallSuit(len, partnerSuit)
  if (ownSuit && p >= 8 && rankIdx(ownSuit) > rankIdx(partnerSuit)) {
    return { call: `2${BID[ownSuit]}`, rule: 'ny färg', explanation: `${p} hp med ${len[ownSuit]}-korts ${NAME[ownSuit]} → 2${SYM[ownSuit]} (naturlig, ej krav).` }
  }

  // NT: stopp i deras färg, balanserad, lämplig styrka.
  if (isBalanced(hand) && hasStopper(hand, theirSuit) && p >= 8) {
    const call = p >= 11 ? '2NT' : '1NT'
    return { call, rule: 'NT-svar', explanation: `${p} hp balanserad med stopp i ${NAME[theirSuit]} → ${call}.` }
  }

  return { call: 'P', rule: 'pass', explanation: `${p} hp – inget lämpligt → pass.` }
}
