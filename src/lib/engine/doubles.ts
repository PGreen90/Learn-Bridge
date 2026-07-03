// Punkt 23: dubblingar, systembok §7.3.
//
//   negativeDouble             – svararens dubbling när VI öppnat och de klivit in
//   openerAnswerNegativeDouble – öppnarens SVAR på den (rondkrav, aldrig pass)
//   responsiveDouble           – vår dubbling när de bjudit och höjt en färg
//   supportDouble              – öppnarens dubbling = exakt 3 stöd i partnerns hf
//   answerTakeoutDouble        – advancers svar på partnerns upplysningsdubbling
//
// Upplysningsdubblingen SJÄLV (när motståndaren öppnat) bor i `overcalls.ts`.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/** Färgen i ett färgbud på VALFRI nivå ("1S"/"2C" → spades/clubs; "X"/"1NT" → null). */
function suitOfBid(call: string): Suit | null {
  const m = call.match(/^[1-7](C|D|H|S)$/)
  return m ? SUIT_OF_LETTER[m[1]] : null
}

/**
 * Negativ dubbling: vi öppnade `ourOpen`, motståndaren klev in (`theirCall`).
 * Svararens X visar objudna färger – särskilt en objuden högfärg (4+), ~6+ hp.
 * null = ingen negativ dubbling (svara naturligt i stället).
 */
export function negativeDouble(hand: Hand, ourOpen: Suit, theirCall: string): ResponseResult | null {
  const their = suitOfBid(theirCall)
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

  // Ingen objuden högfärg: när motståndaren klivit in i den ANDRA högfärgen är
  // båda objudna färgerna minorer (t.ex. 1♥–(1♠), 1♠–(2♥)). X visar då minorerna
  // (4-4+) – men bara UTAN fit för partnern (med fit höjer man i stället).
  const unbid = RANK_ORDER.filter((s) => s !== ourOpen && s !== their)
  const bothMinors = unbid.length === 2 && unbid.every((s) => s === 'clubs' || s === 'diamonds')
  if (bothMinors && len.clubs >= 4 && len.diamonds >= 4 && len[ourOpen] < 3) {
    return { call: 'X', rule: 'negativ dubbling', explanation: `${p} hp, 4-4 i minorerna → X (negativ dubbling, visar objudna minorer).` }
  }
  return null
}

/**
 * Öppnarens SVAR på partnerns negativa dubbling (§7.3: "öppnaren svarar som på
 * en upplysningsdubbling"). Dubblingen är RONDKRAV – öppnaren får aldrig passa
 * (felrapport #2: auktionen dog när öppnaren lämnades att passa). Prioritet:
 *   1. den objudna högfärg dubblingen visar (4+ hos öppnaren) – billigast med
 *      minimum (12–15), hoppande med 16+,
 *   2. sang med stopp i deras färg (balanserat alternativ),
 *   3. återbud av egen 6+ färg,
 *   4. annan objuden 4+ färg (billigast),
 *   5. nödutväg: återbud av öppningsfärgen (svara MÅSTE man).
 */
export function openerAnswerNegativeDouble(hand: Hand, ourOpen: Suit, theirCall: string): ResponseResult {
  const their = suitOfBid(theirCall)!
  const theirLevel = Number(theirCall[0])
  const p = hcp(hand)
  const len = lengths(hand)

  /** Billigaste nivån för `suit` över deras inkliv. */
  const cheapLevel = (suit: Suit) => (rankIdx(suit) > rankIdx(their) ? theirLevel : theirLevel + 1)

  // 1. Objuden högfärg (den dubblingen lovar 4+ kort i) – bjud den med 4+ stöd.
  const unbidMajors = (['hearts', 'spades'] as Suit[]).filter((s) => s !== ourOpen && s !== their)
  for (const m of unbidMajors) {
    if (len[m] >= 4) {
      const lvl = cheapLevel(m) + (p >= 16 ? 1 : 0)
      const strength = p >= 16 ? `${p} hp, hoppande (extra styrka)` : `${p} hp, minimum`
      return {
        call: `${lvl}${BID[m]}`,
        rule: 'svar på negativ dubbling',
        explanation: `Partnerns negativa dubbling visar 4+ ${NAME[m]} – ${strength} → ${lvl}${SYM[m]}.`,
      }
    }
  }

  // 2. Sang med stopp i deras färg.
  if (hasStopper(hand, their)) {
    const ntLevel = theirLevel // NT rankar över alla färger → alltid samma nivå
    return {
      call: `${ntLevel}NT`,
      rule: 'svar på negativ dubbling',
      explanation: `Ingen fjärde högfärg men stopp i deras färg → ${ntLevel} sang (${p} hp).`,
    }
  }

  // 3. Egen 6+ färg om.
  if (len[ourOpen] >= 6) {
    return {
      call: `${cheapLevel(ourOpen)}${BID[ourOpen]}`,
      rule: 'svar på negativ dubbling',
      explanation: `Ingen passande färg att visa – återbud av ${NAME[ourOpen]} (6+ kort, ${p} hp).`,
    }
  }

  // 4. Annan objuden 4+ färg, billigast.
  const others = RANK_ORDER.filter((s) => s !== ourOpen && s !== their && len[s] >= 4).sort(
    (a, b) => cheapLevel(a) - cheapLevel(b) || rankIdx(a) - rankIdx(b),
  )
  if (others.length > 0) {
    const s = others[0]
    return {
      call: `${cheapLevel(s)}${BID[s]}`,
      rule: 'svar på negativ dubbling',
      explanation: `Näst bästa färgen ${NAME[s]} (4+ kort, ${p} hp) – dubblingen måste besvaras.`,
    }
  }

  // 5. Nödutväg: billigaste återbud av öppningsfärgen (pass är förbjudet).
  return {
    call: `${cheapLevel(ourOpen)}${BID[ourOpen]}`,
    rule: 'svar på negativ dubbling',
    explanation: `Inget bättre att säga – återbud av ${NAME[ourOpen]} (dubblingen är rondkrav).`,
  }
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
 * Stöddubbling: 1m–(P)–1M–(RHO-inkliv). Öppnarens X visar EXAKT 3-korts stöd i
 * partnerns högfärg (en direkt höjning = 4 stöd). Gäller bara över ett
 * FÄRGINKLIV och bara så länge "2 i partnerns högfärg" fortfarande kan bjudas
 * (standard 2/1: t.o.m. 2M). Tar inklivet bort den nivån (t.ex. 1♥–(2♠))
 * betyder X något annat → null. null = ingen stöddubbling (bjud naturligt).
 */
export function supportDouble(hand: Hand, partnerMajor: Suit, rhoCall: string): ResponseResult | null {
  const their = suitOfBid(rhoCall)
  if (!their) return null // stöd-X finns bara över RHO:s färginkliv
  if (lengths(hand)[partnerMajor] !== 3) return null // exakt 3 stöd
  // Gäller bara om "2 i partnerns högfärg" fortfarande ligger över RHO:s inkliv.
  const ovLevel = Number(rhoCall[0])
  const twoMajorAvailable = 2 > ovLevel || (2 === ovLevel && rankIdx(partnerMajor) > rankIdx(their))
  if (!twoMajorAvailable) return null
  return { call: 'X', rule: 'stöddubbling', explanation: `exakt 3 stöd i ${NAME[partnerMajor]} → X (stöddubbling).` }
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

/**
 * STRAFFDUBBLING (ägarbeslut 2026-07-04, poängarbetet): dubbla motståndarnas
 * färgkontrakt när vi väntar oss att sätta det med marginal. Sunda krav —
 * medvetet stränga, en straffdubbling som går hem kostar utgången:
 *  - minst 2 SÄKRA trumfstick i deras färg (E; K bakom med 2+ kort; D med 3+),
 *  - minst 10 hp (styrka till sidostick utöver trumfsticken).
 * Vem X:et får riktas mot (nivå, att det inte kan läsas som upplysning/negativt)
 * vaktas av anroparen (`maybePenaltyDouble` i auction-live.ts).
 * null = ingen straffdubbling.
 */
export function penaltyDouble(hand: Hand, theirSuit: Suit): ResponseResult | null {
  const p = hcp(hand)
  if (p < 10) return null

  const holding = hand.filter((c) => c.suit === theirSuit)
  const has = (rank: string) => holding.some((c) => c.rank === rank)
  let trumpTricks = 0
  if (has('A')) trumpTricks++
  if (has('K') && holding.length >= 2) trumpTricks++
  if (has('Q') && holding.length >= 3) trumpTricks++
  if (trumpTricks < 2) return null

  return {
    call: 'X',
    rule: 'straffdubbling',
    explanation:
      `${trumpTricks} säkra trumfstick i deras ${NAME[theirSuit]} och ${p} hp – ` +
      `kontraktet ska betas, X (straffdubbling).`,
  }
}
