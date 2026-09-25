// Svararens svar när MOTSTÅNDAREN stör VÅR svaga tvåa / spärr (takeout-X eller
// ett naturligt inkliv) → answerPreemptInterference. Ägarbeslut 2026-07-04: XX =
// värden/straffintresse (golv 10 hp) mot deras X, annars fortsatt spärrhöjning
// med fit, annars pass.
//
// (Störning av vårt 1NT bodde här till 2026-09-18 — den strukturen är nu systems
// on + stulet bud i nt-systems-on.ts, ägarens spec efter felrapport #77.)

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
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
  /** Svararen har redan passat en gång i auktionen (begränsad hand): då finns
   *  inga konstruktiva svar (Ogust/3NT/ny färg) — bara XX, cue, höjning, straff-X. */
  passedBefore = false,
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

  // Ägarens struktur efter VÅR SVAGA TVÅA + deras färginkliv (2026-09-25, bricka 3:
  // ♠AKJ5 ♥A843 ♦JT ♣QJ8 = 16 hp passade 2♦–(2♥) och sedan 3♥):
  //   2NT = Ogust, systems on, krav (samma trösklar som ostört: 11+ med fit, 15+ utan)
  //   3NT = till spel, 18+ med stopp i deras färg
  //   ny färg = 5+ kort, 12+ hp, förnekar 2-korts stöd (högst 1 kort), krav 1 rond
  //   X av deras 3-lägesbud = straff (trumfstack + styrka)
  //   (X av deras 2-lägesinkliv är ännu odefinierad — ägarfråga.)
  const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
  const theirSuit: Suit | null = ov ? SUIT_OF[ov[2]] : null
  const theirLevel = ov ? Number(ov[1]) : 0
  const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
  const ogustLegal = ourLevel === 2 && theirLevel === 2 && !passedBefore

  // Fit 11–12 (13+ cue:ade ovan) → Ogust när 2NT ryms, annars spärrhöjningen.
  if (ogustLegal && support >= 3 && p >= 11) {
    return { call: '2NT', rule: 'Ogust', explanation: `11+ med 3+ stöd, utgångsintresse → 2NT (Ogust, systems on över deras inkliv; frågar min/max + kvalitet).` }
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

  // ---- Utan fit (ägarens struktur ovan) ----
  if (!passedBefore && theirSuit && theirLevel <= 3 && p >= 18 && hasStopper(hand, theirSuit)) {
    return { call: '3NT', rule: '3NT till spel', explanation: `18+ hp med stopp i deras ${SYM[theirSuit]} → 3NT (till spel).` }
  }
  if (theirSuit && theirLevel === 3 && ((len[theirSuit] >= 4 && p >= 12) || (len[theirSuit] >= 3 && p >= 15))) {
    return { call: 'X', rule: 'straffdubbling', explanation: `Trumfstack i deras ${SYM[theirSuit]} och styrka (12+) → X (straff — dubbling på 3-läget är straff efter vår svaga tvåa).` }
  }
  // Upplysningsdubbling av deras 2-lägesinkliv (ägarbeslut 2026-09-25): de två
  // objudna färgerna LIKA långa, minst 4-4; förnekar vår färg helt (0–1 kort);
  // ber partnern bjuda sin längsta av dem. 10+ hp.
  if (!passedBefore && ourLevel === 2 && theirLevel === 2 && theirSuit && support <= 1 && p >= 10) {
    const unbid = RANK.filter((s) => s !== ourSuit && s !== theirSuit)
    if (unbid.length === 2 && len[unbid[0]] === len[unbid[1]] && len[unbid[0]] >= 4) {
      return { call: 'X', rule: 'negativ dubbling', explanation: `Upplysning: ${SYM[unbid[1]]}+${SYM[unbid[0]]} lika långa (minst 4-4), högst 1 kort i partnerns ${SYM[ourSuit]}, 10+ hp → X (partnern bjuder sin längsta av dem).` }
    }
  }
  if (!passedBefore && ourLevel === 2 && theirSuit && p >= 12 && support <= 1) {
    let best: Suit | null = null
    for (const s of [...RANK].reverse()) { // högst rankad först vid lika längd (billigast)
      if (s === ourSuit || s === theirSuit || len[s] < 5) continue
      if (best === null || len[s] > len[best]) best = s
    }
    if (best) {
      const level = RANK.indexOf(best) > RANK.indexOf(theirSuit) ? theirLevel : theirLevel + 1
      if (level <= 3) {
        return { call: `${level}${BID[best]}`, rule: 'ny färg (krav)', explanation: `Egen 5+ ${SYM[best]}, 12+ hp och högst 1 kort i partnerns ${SYM[ourSuit]} → ${level}${SYM[best]} (naturlig, krav 1 rond).` }
      }
    }
  }
  if (ogustLegal && p >= 15) {
    return { call: '2NT', rule: 'Ogust', explanation: `Utgångsintresse (15+) utan fit → 2NT (Ogust, systems on över deras inkliv; värderar öppnarens färg).` }
  }
  // Exakt TVÅ kort i vår färg med dubblingshanden (ägarbeslut 2026-09-25: "med två
  // ruter på hand bjuder vi tre ruter"): tävlande höjning 3x, ej krav — dubblingen
  // förnekar vår färg helt, så tvåkortsstödet visas här. 10–14 hp (15+ frågade Ogust).
  if (!passedBefore && ourLevel === 2 && theirLevel === 2 && theirSuit && support === 2 && p >= 10) {
    const unbid = RANK.filter((s) => s !== ourSuit && s !== theirSuit)
    if (unbid.length === 2 && len[unbid[0]] === len[unbid[1]] && len[unbid[0]] >= 4) {
      return { call: `3${BID[ourSuit]}`, rule: 'konkurrenshöjning', explanation: `Två kort i partnerns ${SYM[ourSuit]}, 10+ hp och dubblingsform (${SYM[unbid[1]]}+${SYM[unbid[0]]} lika långa) → 3${SYM[ourSuit]} (tävlande, ej krav; dubblingen hade förnekat stöd helt).` }
    }
  }

  return { call: 'P', rule: 'pass', explanation: 'ingen värden-XX eller fit → pass.' }
}
