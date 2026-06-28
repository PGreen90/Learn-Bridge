// Punkt 23: dubblingar, systembok §7.3.
//
//   negativeDouble       – svararens dubbling när VI öppnat och de klivit in
//   responsiveDouble     – vår dubbling när de bjudit och höjt en färg
//   supportDouble        – öppnarens dubbling = exakt 3 stöd i partnerns hf
//   answerTakeoutDouble  – advancers svar på partnerns upplysningsdubbling
//
// Upplysningsdubblingen SJÄLV (när motståndaren öppnat) bor i `overcalls.ts`.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'
import { openingSuit } from './overcalls'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/**
 * Negativ dubbling: vi öppnade `ourOpen`, motståndaren klev in (`theirCall`).
 * Svararens X visar objudna färger – särskilt en objuden högfärg (4+), ~6+ hp.
 * null = ingen negativ dubbling (svara naturligt i stället).
 */
export function negativeDouble(hand: Hand, ourOpen: Suit, theirCall: string): ResponseResult | null {
  const their = openingSuit(theirCall)
  if (!their) return null
  const p = hcp(hand)
  const len = lengths(hand)
  if (p < 6) return null

  const unbidMajors = (['hearts', 'spades'] as Suit[]).filter((s) => s !== ourOpen && s !== their)
  for (const m of unbidMajors) {
    if (len[m] >= 4) {
      return { call: 'X', rule: 'negativ dubbling', explanation: `${p} hp, 4+ ${NAME[m]} → X (negativ dubbling, visar objuden högfärg).` }
    }
  }
  return null
}

/**
 * Responsiv dubbling: partnern upplysningsdubblade, motståndarna höjde sin färg.
 * Vår X = upplysning, oftast de två objudna färgerna (~7+ hp, ingen lång egen).
 * null = ingen responsiv dubbling.
 */
export function responsiveDouble(hand: Hand, theirSuit: Suit): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  if (p < 7) return null
  const unbid = RANK_ORDER.filter((s) => s !== theirSuit)
  const supported = unbid.filter((s) => len[s] >= 3).length
  if (supported >= 2 && !unbid.some((s) => len[s] >= 5)) {
    return { call: 'X', rule: 'responsiv dubbling', explanation: `${p} hp, stöd i objudna färger → X (responsiv, upplysning).` }
  }
  return null
}

/**
 * Stöddubbling: 1m–(P)–1M–(inkliv). Öppnarens X visar EXAKT 3-korts stöd i
 * partnerns högfärg (direkt höjning = 4 stöd). null = ingen stöddubbling.
 */
export function supportDouble(hand: Hand, partnerMajor: Suit): ResponseResult | null {
  const support = lengths(hand)[partnerMajor]
  if (support === 3) {
    return { call: 'X', rule: 'stöddubbling', explanation: `exakt 3 stöd i ${NAME[partnerMajor]} → X (stöddubbling).` }
  }
  return null
}

/** Advancers svar på partnerns upplysningsdubbling (bjud bästa färg). §7.3. */
export function answerTakeoutDouble(hand: Hand, theirSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const unbid = RANK_ORDER.filter((s) => s !== theirSuit)

  // Längsta objudna färg; lika längd → högfärg/högre rankad.
  let best = unbid[0]
  for (const s of unbid) {
    if (len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  const lvl = rankIdx(best) > rankIdx(theirSuit) ? 1 : 2

  // 12+ → cue deras färg (utgångskrav, låter partnern beskriva vidare).
  if (p >= 12) {
    return { call: `2${BID[theirSuit]}`, rule: 'cue (krav)', explanation: `${p} hp – för starkt för bara ett färgbud → cue ${SYM[theirSuit]} (krav).` }
  }
  // 9–11 → hoppbud (inbjudande).
  if (p >= 9) {
    return { call: `${lvl + 1}${BID[best]}`, rule: 'hoppbud (inbjudan)', explanation: `${p} hp med ${len[best]}-korts ${NAME[best]} → ${lvl + 1}${SYM[best]} (inbjudande).` }
  }
  // 0–8 → billigaste färgbud (påtvingat svar; svaghet tillåts).
  return { call: `${lvl}${BID[best]}`, rule: 'färgbud', explanation: `${p} hp – bjuder bästa färg ${NAME[best]} → ${lvl}${SYM[best]}.` }
}
