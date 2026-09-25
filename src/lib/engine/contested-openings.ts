// Svararens svar när MOTSTÅNDAREN stör VÅR svaga tvåa / spärr (takeout-X eller
// ett naturligt inkliv) → answerPreemptInterference. Ägarbeslut 2026-07-04: XX =
// värden/straffintresse (golv 10 hp) mot deras X, annars fortsatt spärrhöjning
// med fit, annars pass.
//
// (Störning av vårt 1NT bodde här till 2026-09-18 — den strukturen är nu systems
// on + stulet bud i nt-systems-on.ts, ägarens spec efter felrapport #77.)

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
/**
 * Svararens svar när motståndaren stört VÅR svaga tvåa/spärr (`ourSuit` på
 * `ourLevel`). `theirCall` = deras störning: 'X' (upplysningsdubbling) eller ett
 * inkliv/2NT/cue/3NT. Schema (ägarbeslut): XX = värden/straffintresse (10+) mot
 * deras X, annars fortsatt spärrhöjning med fit, annars pass.
 */
export function answerPreemptInterference(
  hand: Hand,
  ourSuit: Suit,
  theirCall: string,
  ourLevel: number,
): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[ourSuit]
  const isTheirX = theirCall === 'X'

  // Deras upplysningsdubbling → XX = värden/straffintresse (ägargolv 10 hp).
  if (isTheirX && p >= 10) {
    return {
      call: 'XX',
      rule: 'redubbling (värden)',
      explanation: `10+ hp – värden/straffintresse mot deras upplysningsdubbling → XX.`,
    }
  }

  // Stark höjning (felrapport #82: 2♦–(2♠) med ♠– ♥AQ95 ♦KQ2 ♣AQT743 = 17 hp
  // fick "spärrhöjning" 3♦): 3+ stöd och 13+ hp → CUE i deras inklivsfärg =
  // limithöjning eller bättre, krav — öppnaren svarar (minimum → billigaste bud i
  // vår färg, maximum → utgång/3NT med stopp). Bara mot ett FÄRGinkliv; mot
  // deras X gäller XX/höjning ovan.
  const ov = /^([1-7])([CDHS])$/.exec(theirCall)
  if (ov && support >= 3 && p >= 13) {
    const lvl = Number(ov[1]) + 1
    const SYM_L: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
    return {
      call: `${lvl}${ov[2]}`,
      rule: 'cue (limithöjning+)',
      explanation: `3+ stöd och 13+ hp mot deras inkliv → ${lvl}${SYM_L[ov[2]]} (cue = stark höjning av vår ${SYM[ourSuit]}, krav).`,
    }
  }

  // Fortsatt spärr: höj vår färg ett steg med fit (lag om totala stick). En svag
  // tvåa (öppnaren 6+) kräver 3-korts stöd (9 trumf); en spärr (7+) räcker 2.
  const needed = ourLevel === 2 ? 3 : 2
  if (support >= needed) {
    return {
      call: `${ourLevel + 1}${BID[ourSuit]}`,
      rule: 'spärrhöjning',
      explanation: `Med stöd → ${ourLevel + 1}${SYM[ourSuit]} (fortsatt spärr, lag om totala stick).`,
    }
  }

  return { call: 'P', rule: 'pass', explanation: 'ingen värden-XX eller fit → pass.' }
}
