// Fynd #2 delbit 4: svararens svar när MOTSTÅNDAREN stör VÅR icke-1-färgs-öppning.
//
// Två lägen som faktiskt uppstår i appen (buildAuction modellerar dem):
//   (a) Vårt 1NT störs av DONT (deras X-relä eller ett 2-lägesbud) → answerNTInterference.
//   (b) Vår svaga tvåa / spärr störs av takeout-X eller ett naturligt inkliv → answerPreemptInterference.
//
// Ägarbeslut 2026-07-04 (väg A, exempelhänder + ja):
//   - Över DONT-störning av vårt 1NT: X/XX = straff/värden (vi äger ofta handen
//     mitt emot 15–17), annars naturligt "to play" / pass. Värde-golv 8 hp.
//   - Över takeout-X av vår svaga tvåa/spärr: XX = värden/straffintresse (golv 10 hp),
//     annars fortsatt spärrhöjning med fit, annars pass.
//
// Naturligt-1NT-inkliv och störning av vårt 2♣ modelleras INTE av appen, så de
// byggs medvetet inte här (skulle bli kod som aldrig nås – jfr R1 Fynd #4).

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/** Vår längsta egna färg (≥ `min`), helst inte deras visade färg; lika → högst rankad. */
function longestOwn(len: Record<Suit, number>, min: number, avoid: Suit | null): Suit | null {
  let best: Suit | null = null
  for (const s of RANK_ORDER) {
    if (s === avoid || len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/**
 * Svararens svar när motståndaren stört VÅRT 1NT med DONT. `theirCall` är deras
 * DONT-bud: 'X' (enfärgs-relä) eller ett 2-lägesbud ('2C'/'2D'/'2H'/'2S').
 * Schema (ägarbeslut): X/XX = straff/värden (8+ utan egen långfärg), annars
 * naturligt "to play" med en egen 5+ färg, annars pass.
 */
export function answerNTInterference(hand: Hand, theirCall: string): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const isX = theirCall === 'X'
  const theirSuit = isX ? null : SUIT_OF_LETTER[theirCall[1]]

  // Egen 5+ färg → naturligt "to play"/konkurrens, om den landar lagom lågt.
  const longest = longestOwn(len, 5, theirSuit)
  if (longest) {
    // Över deras X blir en ny färg ett 2-lägesbud; över ett färgbud beror nivån
    // på rangordningen (vår färg över deras = 2-läget, annars 3-läget).
    const lvl = isX ? 2 : rankIdx(longest) > rankIdx(theirSuit!) ? 2 : 3
    // 3-läget kräver 6+ kort (annars för högt på en femkortsfärg).
    if (lvl === 2 || len[longest] >= 6) {
      return {
        call: `${lvl}${BID[longest]}`,
        rule: 'naturligt (to play)',
        explanation: `${len[longest]}-korts ${NAME[longest]} → ${lvl}${SYM[longest]} (naturligt, konkurrerar).`,
      }
    }
  }

  // Straff/värden: 8+ hp utan lämplig egen färg → dubbla dem (vi äger ofta
  // handen mitt emot 15–17). Deras X-relä bemöts med XX, ett färgbud med X.
  if (p >= 8) {
    return {
      call: isX ? 'XX' : 'X',
      rule: 'straff/värden',
      explanation: `${p} hp mitt emot 15–17 utan egen långfärg → ${isX ? 'XX' : 'X'} (straff/värden).`,
    }
  }

  return { call: 'P', rule: 'pass', explanation: 'svag hand utan egen färg → pass.' }
}

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
      explanation: `${p} hp – värden/straffintresse mot deras upplysningsdubbling → XX.`,
    }
  }

  // Fortsatt spärr: höj vår färg ett steg med fit (lag om totala stick). En svag
  // tvåa (öppnaren 6+) kräver 3-korts stöd (9 trumf); en spärr (7+) räcker 2.
  const needed = ourLevel === 2 ? 3 : 2
  if (support >= needed) {
    return {
      call: `${ourLevel + 1}${BID[ourSuit]}`,
      rule: 'spärrhöjning',
      explanation: `${support}-korts stöd → ${ourLevel + 1}${SYM[ourSuit]} (fortsatt spärr, lag om totala stick).`,
    }
  }

  return { call: 'P', rule: 'pass', explanation: 'ingen värden-XX eller fit → pass.' }
}
