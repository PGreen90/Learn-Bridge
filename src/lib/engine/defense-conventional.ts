// Punkt 26: försvar mot konventionella och svaga öppningar, systembok §7.6.
//
//   defendStrongClub – Mathe mot stark 1♣ (X = båda hf, 1NT = båda minorer)
//   defendWeakTwo    – mot svaga tvåor (takeout X, 2NT 15–18, cue stark, naturligt)
//   defendMulti      – mot Multi 2♦ (X stark 13+, 2NT 15–18, 2♥/2♠ naturligt)
//   defendPreempt    – mot deras spärr 3-läget+ (takeout X, 3NT, cue, naturligt)

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import type { ResponseResult } from './responses'
import { hasStopper } from './overcalls'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

function longestOther(len: Record<Suit, number>, their: Suit, min: number): Suit | null {
  let best: Suit | null = null
  for (const s of RANK_ORDER) {
    if (s === their || len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/** Är handen en upplysningsdubbling mot deras färg (`their`)? kort + stöd + styrka. */
function isTakeout(hand: Hand, their: Suit, minHcp: number): boolean {
  const len = lengths(hand)
  const unbid = RANK_ORDER.filter((s) => s !== their)
  return len[their] <= 2 && unbid.every((s) => len[s] >= 3) && hcp(hand) >= minHcp
}

/** Mathe mot stark (konstgjord) 1♣. §7.6. */
export function defendStrongClub(hand: Hand): ResponseResult {
  const len = lengths(hand)
  if (len.hearts >= 4 && len.spades >= 4) {
    return { call: 'X', rule: 'Mathe X (högfärger)', explanation: 'båda högfärgerna (4-4+) → X.' }
  }
  if (len.clubs >= 4 && len.diamonds >= 4) {
    return { call: '1NT', rule: 'Mathe 1NT (minorer)', explanation: 'båda minorerna (4-4+) → 1NT.' }
  }
  // Naturligt inkliv med en 5+ färg (klöver är deras konstgjorda färg).
  const suit = longestOther(len, 'clubs', 5)
  if (suit && hcp(hand) >= 8) {
    const lvl = rankIdx(suit) > rankIdx('clubs') ? 1 : 2
    return { call: `${lvl}${BID[suit]}`, rule: 'naturligt inkliv', explanation: `${len[suit]}-korts ${NAME[suit]} → ${lvl}${SYM[suit]} (naturligt).` }
  }
  return { call: 'P', rule: 'pass', explanation: 'ingen Mathe-hand → pass.' }
}

/** Mot motståndarnas svaga tvåöppning (`theirSuit` på 2-läget). §7.6. */
export function defendWeakTwo(hand: Hand, theirSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)

  // Cue (stark/Michaels-aktig): 5-5 i objudna färger.
  const twoLongOther = RANK_ORDER.filter((s) => s !== theirSuit && len[s] >= 5)
  if (twoLongOther.length >= 2) {
    return { call: `3${BID[theirSuit]}`, rule: 'cue (stark tvåfärg)', explanation: `5-5 i objudna färger → cue ${SYM[theirSuit]} (stark).` }
  }
  // 2NT-inkliv: 15–18 balanserad med stopp.
  if (isBalanced(hand) && p >= 15 && p <= 18 && hasStopper(hand, theirSuit)) {
    return { call: '2NT', rule: '2NT-inkliv (15–18)', explanation: `${p} hp balanserad med stopp → 2NT-inkliv.` }
  }
  // Upplysningsdubbling (takeout).
  if (isTakeout(hand, theirSuit, 12)) {
    return { call: 'X', rule: 'upplysningsdubbling', explanation: `${p} hp, kort i ${NAME[theirSuit]}, stöd i övriga → X.` }
  }
  // Naturligt inkliv med en 5+ färg.
  const suit = longestOther(len, theirSuit, 5)
  if (suit && p >= 10 && p <= 16) {
    const lvl = rankIdx(suit) > rankIdx(theirSuit) ? 2 : 3
    return { call: `${lvl}${BID[suit]}`, rule: 'naturligt inkliv', explanation: `${len[suit]}-korts ${NAME[suit]} → ${lvl}${SYM[suit]}.` }
  }
  return { call: 'P', rule: 'pass', explanation: 'ingen lämplig aktion → pass.' }
}

/** Mot Multi 2♦ (svag tvåa i okänd högfärg). §7.6. */
export function defendMulti(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  if (isBalanced(hand) && p >= 15 && p <= 18 && hasStopper(hand, 'diamonds')) {
    return { call: '2NT', rule: '2NT (15–18)', explanation: `${p} hp balanserad → 2NT.` }
  }
  // Naturligt högfärgsinkliv (2♥/2♠) med 5+.
  const major = (['hearts', 'spades'] as Suit[]).find((m) => len[m] >= 5)
  if (major && p >= 10 && p <= 15) {
    return { call: `2${BID[major]}`, rule: 'naturligt inkliv', explanation: `${len[major]}-korts ${NAME[major]} → 2${SYM[major]}.` }
  }
  // X = stark/takeout-aktig (~13+).
  if (p >= 13) {
    return { call: 'X', rule: 'X (stark/takeout)', explanation: `${p} hp – stark/takeout-aktig → X.` }
  }
  return { call: 'P', rule: 'pass', explanation: 'ingen lämplig aktion → pass.' }
}

/** Mot deras spärröppning på 3-läget eller högre. §7.6. */
export function defendPreempt(hand: Hand, theirSuit: Suit, level: number): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)

  // 3NT till spel: stopp i deras färg + utgångsvärden, balanserad.
  if (level === 3 && isBalanced(hand) && p >= 16 && hasStopper(hand, theirSuit)) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp med stopp i ${NAME[theirSuit]} → 3NT.` }
  }
  // Upplysningsdubbling (takeout): kort i deras färg, stöd i övriga, 14+ (högre nivå).
  if (isTakeout(hand, theirSuit, 14)) {
    return { call: 'X', rule: 'upplysningsdubbling', explanation: `${p} hp, kort i ${NAME[theirSuit]}, stöd i övriga → X (takeout).` }
  }
  // Naturligt inkliv med en bra 5+ färg (på nivån ovanför).
  const suit = longestOther(len, theirSuit, 5)
  if (suit && p >= 13) {
    const lvl = rankIdx(suit) > rankIdx(theirSuit) ? level : level + 1
    return { call: `${lvl}${BID[suit]}`, rule: 'naturligt inkliv', explanation: `${len[suit]}-korts ${NAME[suit]} → ${lvl}${SYM[suit]}.` }
  }
  return { call: 'P', rule: 'pass', explanation: 'ingen lämplig aktion → pass (spärren tar plats).' }
}
