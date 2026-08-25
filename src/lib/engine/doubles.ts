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
import { hcp, isBalanced, lengths } from './hand'
import { pointsWithFloor } from './evaluation'
import { hasStopper } from './overcalls'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
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
  const fourPlus = unbidMajors.filter((m) => len[m] >= 4)
  // Är BÅDA högfärgerna objudna (inklivet i en lågfärg) och båda 4+ hos oss, visar
  // X:et BÅDA högfärgerna (minst 4-4) – förklaringen får inte fastna på bara den
  // ena (felrapport #45: 1♣–(2♦)–X med 5-4 lästes som "4+ hjärter").
  if (unbidMajors.length === 2 && fourPlus.length === 2) {
    return {
      call: 'X',
      rule: 'negativ dubbling',
      explanation: `6+ hp, minst 4-4 i ♥+♠ → X (negativ dubbling, visar båda objudna högfärgerna).`,
    }
  }
  for (const m of unbidMajors) {
    if (len[m] >= 4) {
      return { call: 'X', rule: 'negativ dubbling', explanation: `6+ hp, 4+ ${SYM[m]} → X (negativ dubbling, visar objuden högfärg).` }
    }
  }

  // Ingen objuden högfärg: när motståndaren klivit in i den ANDRA högfärgen är
  // båda objudna färgerna minorer (t.ex. 1♥–(1♠), 1♠–(2♥)). X visar då minorerna
  // (4-4+) – men bara UTAN fit för partnern (med fit höjer man i stället).
  const unbid = RANK_ORDER.filter((s) => s !== ourOpen && s !== their)
  const bothMinors = unbid.length === 2 && unbid.every((s) => s === 'clubs' || s === 'diamonds')
  if (bothMinors && len.clubs >= 4 && len.diamonds >= 4 && len[ourOpen] < 3) {
    return { call: 'X', rule: 'negativ dubbling', explanation: `6+ hp, 4-4 i minorerna → X (negativ dubbling, visar objudna minorer).` }
  }
  return null
}

/**
 * Öppnarens SVAR på partnerns negativa dubbling (§7.3: "öppnaren svarar som på
 * en upplysningsdubbling"). Dubblingen är RONDKRAV – öppnaren får aldrig passa
 * (felrapport #2: auktionen dog när öppnaren lämnades att passa). Prioritet:
 *   1. den objudna högfärg dubblingen visar (4+ hos öppnaren) – billigast med
 *      minimum (12–15), hoppande med 16+,
 *   2. sang med stopp i deras färg (på 1-läget alltid; på 2-läget+ kräver ~15+),
 *   3. återbud av egen 6+ färg,
 *   4. utan nivåhöjning i tur och ordning: annan objuden 4+ färg → eget
 *      5-korts återbud → sang-med-stopp (minimums sista utvägar),
 *   5. annan objuden 4+ färg (billigast, även en nivå upp),
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
      const strength = p >= 16 ? '16+ (extra styrka, hoppande)' : 'minimum (12–15)'
      return {
        call: `${lvl}${BID[m]}`,
        rule: 'svar på negativ dubbling',
        explanation: `Partnerns negativa dubbling visar 4+ ${SYM[m]} – ${strength} → ${lvl}${SYM[m]}.`,
      }
    }
  }

  // 2. Sang med stopp i deras färg. På 1-läget (1NT) räcker minimum, men på
  //    2-läget+ kräver sangen extra (~15+): en minimiöppnare som lyfter till
  //    2NT bara för stoppet spelar sang utan värdena (frö 20260763: 11 hp →
  //    2NT två bet fast 2♦ fanns). Minimum utan billigt färgåterbud får sang
  //    som SISTA utväg i steg 3c nedan.
  if (hasStopper(hand, their) && (theirLevel === 1 || p >= 15)) {
    const ntLevel = theirLevel // NT rankar över alla färger → alltid samma nivå
    return {
      call: `${ntLevel}NT`,
      rule: 'svar på negativ dubbling',
      explanation: `Ingen fjärde högfärg men stopp i deras färg → ${ntLevel} sang.`,
    }
  }

  // 3. Egen 6+ färg om.
  if (len[ourOpen] >= 6) {
    return {
      call: `${cheapLevel(ourOpen)}${BID[ourOpen]}`,
      rule: 'svar på negativ dubbling',
      explanation: `Ingen passande färg att visa – återbud av ${SYM[ourOpen]} (6+ kort).`,
    }
  }

  // 4. Annan objuden 4+ färg som kan bjudas på SAMMA nivå som deras inkliv —
  //    mer konstruktivt än ett rebud (dubblingen bad om objudna färger, och en
  //    4-4-fit kan gömma sig där; frö 20261351: 5♥+4♦ visar 2♦, inte 2♥).
  const cheapOthers = RANK_ORDER.filter(
    (s) => s !== ourOpen && s !== their && len[s] >= 4 && cheapLevel(s) === theirLevel,
  )
  if (cheapOthers.length > 0) {
    const s = cheapOthers[0]
    return {
      call: `${theirLevel}${BID[s]}`,
      rule: 'svar på negativ dubbling',
      explanation: `Näst bästa färgen ${SYM[s]} (4+ kort) – dubblingen måste besvaras.`,
    }
  }

  // 4b. Minimum: rebjud 5-korts öppningsfärg när det går UTAN nivåhöjning
  //     (billigare besked än sang utan värdena; frö 20260763).
  if (len[ourOpen] >= 5 && cheapLevel(ourOpen) === theirLevel) {
    return {
      call: `${theirLevel}${BID[ourOpen]}`,
      rule: 'svar på negativ dubbling',
      explanation: `Minimum utan fjärde högfärg – billigt återbud av ${SYM[ourOpen]} (5+ kort).`,
    }
  }

  // 4c. Minimum med stopp men inget billigt färgåterbud → sang ändå (bättre än
  //     en ny färg en nivå upp).
  if (hasStopper(hand, their)) {
    return {
      call: `${theirLevel}NT`,
      rule: 'svar på negativ dubbling',
      explanation: `Ingen fjärde högfärg men stopp i deras färg → ${theirLevel} sang.`,
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
      explanation: `Näst bästa färgen ${SYM[s]} (4+ kort) – dubblingen måste besvaras.`,
    }
  }

  // 5. Nödutväg: billigaste återbud av öppningsfärgen (pass är förbjudet).
  return {
    call: `${cheapLevel(ourOpen)}${BID[ourOpen]}`,
    rule: 'svar på negativ dubbling',
    explanation: `Inget bättre att säga – återbud av ${SYM[ourOpen]} (dubblingen är rondkrav).`,
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
    return { call: 'X', rule: 'responsiv dubbling', explanation: `7+ hp, stöd i objudna färger → X (responsiv, upplysning).` }
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
  return { call: 'X', rule: 'stöddubbling', explanation: `exakt 3 stöd i ${SYM[partnerMajor]} → X (stöddubbling).` }
}

/**
 * Advancers svar på partnerns upplysningsdubbling (bjud bästa färg). §7.3.
 * `theirLevel` = nivån motståndarnas öppning (den dubblade färgen) ligger på.
 * Default 1 (bakåtkompatibelt). Dubblas en SVAG TVÅA måste svaret hamna över
 * 2-läget – annars räknar motorn fram olagliga 1-lägesbud och budet släpps av
 * anroparens laglighetsvakt → påtvingat svar tappas (R1-fynd #5).
 * `balancing` = X:et var en BALANSERING (utpassningsläget, §7.6): golvet är
 * sänkt ~3 hp ("låna en kung") så advancern räknar av den lånade kungen i
 * graderingen (−3 på trösklarna för cue/hopp) — annars värderas samma kung två
 * gånger och svaret drivs en nivå för högt (F3/C12, 2026-08-07).
 */
export function answerTakeoutDouble(hand: Hand, theirSuit: Suit, theirLevel = 1, bidSuits: Suit[] = [theirSuit], balancing = false): ResponseResult {
  const p = hcp(hand)
  const graded = p - (balancing ? 3 : 0) // rabatten: kungen är redan lånad av balanseraren
  const rabatt = balancing ? ` (balanseringsrabatt −3)` : ''
  const len = lengths(hand)
  // Uteslut ALLA färger motståndarna bjudit (inte bara den dubblade). När två
  // färger är bjudna – t.ex. 1♦–1♥–X – får svaret aldrig hamna i öppnarens ruter
  // (felrapport-uppföljning: advancern bjöd deras egen färg).
  const unbid = RANK_ORDER.filter((s) => !bidSuits.includes(s))

  // Längsta objudna färg; lika längd → högfärg/högre rankad — utom när svaret
  // tvingas upp över en dubblad spärr/spärrhöjning (theirLevel 3+): där väljer
  // en människa den HONNÖRSSTARKARE färgen på lika längd (A832 före J982 —
  // Mätning #18, frö 20261680: 4♥ på hackorna gick två bet när 4♣ stod).
  const HONOR: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 }
  const suitHcp = (s: Suit) => hand.filter((c) => c.suit === s).reduce((sum, c) => sum + (HONOR[c.rank] ?? 0), 0)
  let best = unbid[0]
  for (const s of unbid) {
    if (len[s] > len[best]) { best = s; continue }
    if (len[s] !== len[best]) continue
    const tiebreak = theirLevel >= 3
      ? suitHcp(s) > suitHcp(best) || (suitHcp(s) === suitHcp(best) && rankIdx(s) > rankIdx(best))
      : rankIdx(s) > rankIdx(best)
    if (tiebreak) best = s
  }
  // Billigaste nivån att bjuda `best` på ÖVER deras öppning: en färg som rankar
  // över deras kan bjudas på samma nivå, annars ett steg upp.
  const lvl = rankIdx(best) > rankIdx(theirSuit) ? theirLevel : theirLevel + 1
  const cueLevel = theirLevel + 1 // cue i deras färg = ett steg upp över öppningen

  // 12+ → cue deras färg (utgångskrav, låter partnern beskriva vidare) — men
  // BARA medan det finns rum (deras öppning på 1–2-läget). Över en dubblad
  // spärr/spärrhöjning (3-läget) är ett cue på 4-läget meningslöst och kan
  // passas ut i DERAS färg (Mätning #18, frö 20260825: 3♥–P–P–X–P–4♥ blev
  // slutbudet, 4-1-fit). Där väljs 3NT med stopp, annars bästa färg nedan.
  if (graded >= 12) {
    if (theirLevel <= 2) {
      return { call: `${cueLevel}${BID[theirSuit]}`, rule: 'cue (krav)', explanation: `12+ hp – för starkt för bara ett färgbud → cue ${SYM[theirSuit]} (krav).${rabatt}` }
    }
    if (hasStopper(hand, theirSuit)) {
      return { call: '3NT', rule: '3NT till spel', explanation: `12+ hp med stopp i ${SYM[theirSuit]} → 3NT till spel.${rabatt}` }
    }
  }
  // 9–11 → hoppbud (inbjudande) – bara meningsfullt över en 1-lägesöppning; över
  // en svag tvåa har öppningen redan ätit utrymmet, så vi bjuder naturligt.
  if (graded >= 9 && theirLevel === 1) {
    return { call: `${lvl + 1}${BID[best]}`, rule: 'hoppbud (inbjudan)', explanation: `9–11 hp med 4+ ${SYM[best]} → ${lvl + 1}${SYM[best]} (inbjudande).${rabatt}` }
  }
  // 0–8 (och 9–11 över en högre öppning) → billigaste färgbud (påtvingat svar).
  return { call: `${lvl}${BID[best]}`, rule: 'färgbud', explanation: `Bjuder bästa färg ${SYM[best]} → ${lvl}${SYM[best]} (påtvingat svar).${rabatt}` }
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
    explanation: `Säkra trumfstick i deras ${SYM[theirSuit]} – kontraktet ska betas → X (straffdubbling).`,
  }
}

/**
 * ADVANCERNS svar när motståndarna bjuder ÖVER partnerns upplysningsdubbling
 * (etapp 6 hål 2, billig offring): (1♣)–X–(2♣)–? Svarstvånget är borta (RHO
 * "räddade" oss), men upplysningen gäller fortfarande — partnern visade 10+
 * med form (eller 17+). Fritt läge, värde-/formstyrt:
 *  - deras XX: tvångsflykt — svara som om RHO passat (`answerTakeoutDouble`);
 *    att sitta kvar i deras redubblade kontrakt är aldrig planen,
 *  - 12+: 3NT med stopp i alla deras bjudna färger, annars cue i den dubblade
 *    färgen (utgångskrav),
 *  - 9–11: hoppbud i egen 5+ färg (inbjudan), annars 2NT med stopp,
 *  - 6–8: billigaste bud i egen 5+ färg (på 2-läget),
 *  - extrem form (6+ färg eller 5-5) får bjuda billigast oavsett poäng (upp
 *    till 3-läget),
 *  - annars null = passa (fritt läge, tunna händer tiger).
 */
export function advancerFreeBidAfterDouble(
  hand: Hand,
  doubledSuit: Suit,
  openLevel: number,
  theirSuits: Suit[],
  lastBid: string,
): ResponseResult | null {
  // Deras XX: flykten är tvingad — samma svar som om RHO passat.
  if (lastBid === 'XX') return answerTakeoutDouble(hand, doubledSuit, openLevel, theirSuits)

  const RULE = 'fritt svar på upplysningsdubbling'
  const lastCb = lastBid.match(/^([1-7])(C|D|H|S)$/)
  if (!lastCb) return null
  const lastLevel = Number(lastCb[1])
  const lastSuit = SUIT_OF_LETTER[lastCb[2]]
  const p = hcp(hand)
  const len = lengths(hand)
  /** Billigaste nivån för `suit` ÖVER deras senaste bud. */
  const cheapLevel = (suit: Suit) => (rankIdx(suit) > rankIdx(lastSuit) ? lastLevel : lastLevel + 1)

  // Längsta egna färg utanför deras bjudna.
  const unbid = RANK_ORDER.filter((s) => !theirSuits.includes(s))
  let best = unbid[0]
  for (const s of unbid) {
    if (len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }

  // 12+: utgångszon mot partnerns visade 10+.
  if (p >= 12) {
    if (theirSuits.every((s) => hasStopper(hand, s)) && lastLevel <= 3) {
      return { call: '3NT', rule: RULE, explanation: `12+ hp med stopp i deras färg → 3NT.` }
    }
    const cueLvl = cheapLevel(doubledSuit)
    return { call: `${cueLvl}${BID[doubledSuit]}`, rule: 'cue (krav)', explanation: `12+ hp – för starkt för ett fritt färgbud → cue ${SYM[doubledSuit]} (krav).` }
  }

  // 9–11: inbjudan.
  if (p >= 9) {
    if (len[best] >= 5) {
      const jumpLvl = cheapLevel(best) + 1
      if (jumpLvl <= 3) {
        return { call: `${jumpLvl}${BID[best]}`, rule: RULE, explanation: `9–11 hp med 5+ ${SYM[best]} → hoppbud ${jumpLvl}${SYM[best]} (inbjudande, fritt).` }
      }
    }
    if (theirSuits.every((s) => hasStopper(hand, s)) && lastLevel <= 2) {
      return { call: '2NT', rule: RULE, explanation: `9–11 hp jämnt med stopp i deras färg → 2NT (inbjudan, fritt).` }
    }
  }

  // Extrem form talar oavsett poäng (partnern lovade stöd för objudna färger).
  const secondLongest = Math.max(...unbid.filter((s) => s !== best).map((s) => len[s]), 0)
  const bigShape = len[best] >= 6 || (len[best] >= 5 && secondLongest >= 5)
  if (bigShape && cheapLevel(best) <= 3) {
    return {
      call: `${cheapLevel(best)}${BID[best]}`,
      rule: RULE,
      explanation: `Lång ${SYM[best]}${secondLongest >= 5 ? ' (tvåfärgshand)' : ''} – formen bjuder oavsett poäng (fritt).`,
    }
  }

  // 6–8: billigaste egna 5+ färg på 2-läget.
  if (p >= 6 && len[best] >= 5 && cheapLevel(best) <= 2) {
    return { call: `${cheapLevel(best)}${BID[best]}`, rule: RULE, explanation: `6–8 hp med 5+ ${SYM[best]} → ${cheapLevel(best)}${SYM[best]} (fritt, ej krav).` }
  }

  return null // tunt och fritt → pass
}

/**
 * DUBBLARENS svar på advancerns cue efter upplysningsdubblingen (utgångskrav —
 * får aldrig passas): cuet jagar i första hand högfärgsfiten, så billigaste
 * objudna 4+ högfärg visas FÖRST (felrapport #11: preferens 3♠ med KJ53, inte
 * 3NT på Kx). Utan 4-korts högfärg: 3NT med stopp i deras färg, annars längsta
 * objudna färg billigast.
 */
export function doublerAnswersCue(hand: Hand, theirSuits: Suit[], cueBid: string): ResponseResult {
  const RULE = 'dubblarens svar på cue'
  const cueLevel = Number(cueBid[0]) || 2
  const cueSuit = suitOfBid(cueBid) ?? theirSuits[0]
  const len = lengths(hand)
  const cheapLevel = (suit: Suit) => (rankIdx(suit) > rankIdx(cueSuit) ? cueLevel : cueLevel + 1)

  const unbid = RANK_ORDER.filter((s) => !theirSuits.includes(s))
  const majors = unbid.filter((s) => (s === 'hearts' || s === 'spades') && len[s] >= 4).sort((a, b) => cheapLevel(a) - cheapLevel(b) || rankIdx(a) - rankIdx(b))
  if (majors[0]) {
    return {
      call: `${cheapLevel(majors[0])}${BID[majors[0]]}`,
      rule: RULE,
      explanation: `Partnerns cue är krav – visar 4+ ${SYM[majors[0]]} (högfärgen först).`,
    }
  }
  if (theirSuits.every((s) => hasStopper(hand, s)) && cueLevel <= 3) {
    return { call: '3NT', rule: RULE, explanation: `Ingen 4+ högfärg men stopp i deras ${theirSuits.map((s) => SYM[s]).join(' och ')} → 3NT på partnerns cue (krav).` }
  }
  const pick = [...unbid].sort((a, b) => len[b] - len[a] || rankIdx(b) - rankIdx(a))[0]
  return {
    call: `${cheapLevel(pick)}${BID[pick]}`,
    rule: RULE,
    explanation: `Partnerns cue är krav – visar längsta objudna ${SYM[pick]} billigast.`,
  }
}

/**
 * SVARARENS svar på öppnarens stöddubbling (etapp 6 hål 1, billig offring):
 * 1x–(P)–1M–(inkliv)–X–(P)–? X:et visade exakt 3 stöd — svararen får aldrig
 * passa bort upplysningen (utom som MEDVETET straffpass med trumfstack).
 * Svaren är naturliga och nivåstyrda av handstyrkan:
 *  - straffpass: ≤12 hp med straffdubblingskraven i deras färg (2+ trumfstick),
 *  - 13+ (stödpoäng vid 5+ trumf): 4M med 5-korts högfärg (5-3-fiten är känd);
 *    3NT med stopp och 2+ kort i partnerns färg; annars 4M på 4-3 (Moysian —
 *    kort färg ger stölder på den korta handen),
 *  - 10–12: 3M med 5-korts högfärg; egen 6+ sidofärg billigast; invithöjning 3
 *    i öppnarens färg (4+ stöd, eller 3 med honnör); 2NT med stopp,
 *  - annars (påtvingat): 2M med 5-korts, billig preferens till öppnarens färg,
 *    sista utväg 2M på 4-3. Stöd-X-fönstret garanterar att 2M är lagligt.
 */
export function answerSupportDouble(hand: Hand, myMajor: Suit, openerSuit: Suit, theirBid: string): ResponseResult {
  const theirSuit = suitOfBid(theirBid) ?? openerSuit // stöd-X finns bara över färginkliv
  const theirLevel = Number(theirBid[0]) || 1
  const p = hcp(hand)
  const len = lengths(hand)
  const cheapLevel = (suit: Suit) => (rankIdx(suit) > rankIdx(theirSuit) ? theirLevel : theirLevel + 1)

  // Medvetet straffpass: trumfstacken gör deras dubblade kontrakt till bästa affär.
  const pen = penaltyDouble(hand, theirSuit)
  if (pen && p <= 12) {
    return {
      call: 'P',
      rule: 'straffpass på stöddubbling',
      explanation: `Trumfstack i deras ${SYM[theirSuit]} – passar MEDVETET och gör partnerns stöddubbling till straff.`,
    }
  }

  // Stödpoäng räknas bara med äkta 8-kortsfit (5+ egna trumf mot visade 3).
  const fp = len[myMajor] >= 5 ? pointsWithFloor(hand, myMajor, 'support') : null
  const points = fp ? fp.points : p

  // Utgångsvärden (13+): kaptenen sätter utgången mot visat minimum.
  if (points >= 13) {
    if (len[myMajor] >= 5) {
      return {
        call: `4${BID[myMajor]}`,
        rule: 'svar på stöddubbling',
        explanation: `13+ stödpoäng med 5+ ${SYM[myMajor]} mot visade 3 stöd → 4${SYM[myMajor]} (utgång i 5-3-fiten).`,
      }
    }
    if (hasStopper(hand, theirSuit) && len[openerSuit] >= 2) {
      return {
        call: '3NT',
        rule: 'svar på stöddubbling',
        explanation: `13+ hp med stopp i deras ${SYM[theirSuit]} (4-3-fit i ${SYM[myMajor]}) → 3NT.`,
      }
    }
    return {
      call: `4${BID[myMajor]}`,
      rule: 'svar på stöddubbling',
      explanation: `13+ – 4${SYM[myMajor]} på 4-3-fiten (kort sidofärg ger stölder, inget sangalternativ).`,
    }
  }

  // Inbjudande (10–12): visa handtypen en nivå under utgång.
  if (points >= 10) {
    if (len[myMajor] >= 5) {
      return {
        call: `3${BID[myMajor]}`,
        rule: 'svar på stöddubbling',
        explanation: `10–12 stödpoäng med 5+ ${SYM[myMajor]} → 3${SYM[myMajor]} (inbjudan i 5-3-fiten).`,
      }
    }
    const side = RANK_ORDER.filter((s) => s !== myMajor && s !== openerSuit && s !== theirSuit && len[s] >= 6)
    if (side.length > 0 && cheapLevel(side[0]) <= 3) {
      const s = side[0]
      return {
        call: `${cheapLevel(s)}${BID[s]}`,
        rule: 'svar på stöddubbling',
        explanation: `10–12 hp med egen 6+ ${SYM[s]} → ${cheapLevel(s)}${SYM[s]} (naturligt, inbjudande).`,
      }
    }
    const honorSupport = hand.some((c) => c.suit === openerSuit && (c.rank === 'A' || c.rank === 'K' || c.rank === 'Q'))
    if (len[openerSuit] >= 4 || (len[openerSuit] === 3 && honorSupport)) {
      return {
        call: `3${BID[openerSuit]}`,
        rule: 'svar på stöddubbling',
        explanation: `10–12 hp med stöd för partnerns ${SYM[openerSuit]} → 3${SYM[openerSuit]} (invithöjning).`,
      }
    }
    if (hasStopper(hand, theirSuit)) {
      return {
        call: '2NT',
        rule: 'svar på stöddubbling',
        explanation: `10–12 hp jämnt med stopp i deras ${SYM[theirSuit]} → 2NT (inbjudan).`,
      }
    }
  }

  // Minimum (påtvingat svar — dubblingen får inte dö).
  if (len[myMajor] >= 5) {
    return {
      call: `2${BID[myMajor]}`,
      rule: 'svar på stöddubbling',
      explanation: `Minimum med 5+ ${SYM[myMajor]} → 2${SYM[myMajor]} (5-3-fit).`,
    }
  }
  if (len[openerSuit] >= 3 && cheapLevel(openerSuit) <= 2) {
    return {
      call: `${cheapLevel(openerSuit)}${BID[openerSuit]}`,
      rule: 'svar på stöddubbling',
      explanation: `Minimum – billig preferens till partnerns ${SYM[openerSuit]} (dubblingen måste besvaras).`,
    }
  }
  return {
    call: `2${BID[myMajor]}`,
    rule: 'svar på stöddubbling',
    explanation: `Minimum – 2${SYM[myMajor]} på 4-3-fiten (påtvingat svar, dubblingen får inte dö).`,
  }
}

/**
 * Öppnarens FORTSÄTTNING efter egen stöddubbling: partnerns svar är naturligt
 * och inbjudande (aldrig krav) — öppnaren accepterar med 15+ (Bergenpoäng när
 * fit finns), annars pass. Partnerns utgångsbud står alltid. Nivåerna:
 *  - 2-lägessvar (minimum/preferens) → pass,
 *  - 2NT → 3NT med 15+,
 *  - 3M (5-3-fit) → 4M med 15+,
 *  - höjning av öppningsfärgen till 3 → med 15+: 3NT om jämn med stopp i deras
 *    färg (minoröppning), annars utgång i färgen,
 *  - ny färg (naturlig 6+) är ett FRITT BUD i konkurrens = RONDKRAV (§5.5) och
 *    får ALDRIG passas: med 3+ stöd (partnern lovar 6) → utgång med 15+, annars
 *    enkel höjning; utan stöd → sang med stopp, egen 6+ färg, eller preferens
 *    till partnerns högfärg som sista utväg.
 */
export function supportDoublerRebid(
  hand: Hand,
  myOpenedSuit: Suit,
  partnerMajor: Suit,
  theirSuit: Suit,
  partnerAnswer: string,
): ResponseResult {
  const RULE = 'stöddubblarens fortsättning'
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: RULE, explanation: why })
  const m = partnerAnswer.match(/^([1-7])(NT|C|D|H|S)$/)
  if (!m) return pass('Inget att tillägga.')
  const level = Number(m[1])
  const strain = m[2]
  const answerSuit = strain === 'NT' ? null : SUIT_OF_LETTER[strain]

  // Partnerns utgångsbud står — dra det ALDRIG någon annanstans.
  const isGame =
    (strain === 'NT' && level >= 3) ||
    (answerSuit && (answerSuit === 'hearts' || answerSuit === 'spades') && level >= 4) ||
    (answerSuit && (answerSuit === 'clubs' || answerSuit === 'diamonds') && level >= 5)
  if (isGame) return pass('Partnerns utgångsbud står.')

  const p = hcp(hand)
  const len = lengths(hand)

  // 2NT-inbjudan: acceptera med 15+.
  if (strain === 'NT') {
    if (p >= 15) return { call: '3NT', rule: RULE, explanation: `15+ hp mot partnerns 2NT-inbjudan → 3NT.` }
    return pass(`Under 15 hp – avböjer 2NT-inbjudan.`)
  }

  // Partnerns egen högfärg: 2M = minimum (passbart), 3M = inbjudan i 5-3-fiten.
  if (answerSuit === partnerMajor) {
    if (level <= 2) return pass(`Partnerns 2${SYM[partnerMajor]} är minimum – pass.`)
    const fp = pointsWithFloor(hand, partnerMajor, 'bergen')
    if (fp.points >= 15) {
      return { call: `4${BID[partnerMajor]}`, rule: RULE, explanation: `15+ med 3 stöd i 5-3-fiten → 4${SYM[partnerMajor]}.` }
    }
    return pass(`Under 15 – avböjer inbjudan i ${SYM[partnerMajor]}.`)
  }

  // Min öppningsfärg: 2-läget = påtvingad preferens (passbart), 3-läget = invit.
  if (answerSuit === myOpenedSuit) {
    if (level <= 2) return pass(`Partnerns preferens ${level}${SYM[myOpenedSuit]} är minimum – pass.`)
    const fp = pointsWithFloor(hand, myOpenedSuit, 'bergen')
    if (fp.points >= 15) {
      const minorOpen = myOpenedSuit === 'clubs' || myOpenedSuit === 'diamonds'
      if (minorOpen && isBalanced(hand) && hasStopper(hand, theirSuit)) {
        return { call: '3NT', rule: RULE, explanation: `15+, jämn hand med stopp i deras ${SYM[theirSuit]} → 3NT framför 5${SYM[myOpenedSuit]}.` }
      }
      const gameLevel = minorOpen ? 5 : 4
      return { call: `${gameLevel}${BID[myOpenedSuit]}`, rule: RULE, explanation: `15+ – accepterar invithöjningen → ${gameLevel}${SYM[myOpenedSuit]}.` }
    }
    return pass(`Under 15 – avböjer invithöjningen.`)
  }

  // Ny färg (på VILKEN nivå som helst) = naturlig 6+ OCH ett fritt bud i
  // konkurrens = RONDKRAV (§5.5): öppnaren får aldrig passa.
  if (answerSuit) {
    if (len[answerSuit] >= 3) {
      // Partnern lovar 6+ → 3 kort är en äkta fit (9+ kort ihop).
      const fp = pointsWithFloor(hand, answerSuit, 'bergen')
      const gameLevel = answerSuit === 'hearts' || answerSuit === 'spades' ? 4 : 5
      if (fp.points >= 15) {
        return { call: `${gameLevel}${BID[answerSuit]}`, rule: RULE, explanation: `15+ med 3+ stöd för partnerns 6+ ${SYM[answerSuit]} → ${gameLevel}${SYM[answerSuit]}.` }
      }
      return {
        call: `${Math.min(level + 1, gameLevel)}${BID[answerSuit]}`,
        rule: RULE,
        explanation: `Under 15 – enkel höjning av partnerns ${SYM[answerSuit]} (rondkrav; utgångsaccept kräver 15+).`,
      }
    }
    if (hasStopper(hand, theirSuit)) {
      return { call: `${level}NT`, rule: RULE, explanation: `Utan stöd för partnerns ${SYM[answerSuit]} men stopp i deras ${SYM[theirSuit]} → ${level}NT (rondkravet får inte passas).` }
    }
    if (len[myOpenedSuit] >= 6) {
      const lvl = rankIdx(myOpenedSuit) > rankIdx(answerSuit) ? level : level + 1
      return { call: `${lvl}${BID[myOpenedSuit]}`, rule: RULE, explanation: `Utan stöd och utan stopp – återbud av egen 6+ ${SYM[myOpenedSuit]} (rondkravet får inte passas).` }
    }
    const prefLvl = rankIdx(partnerMajor) > rankIdx(answerSuit) ? level : level + 1
    return { call: `${prefLvl}${BID[partnerMajor]}`, rule: RULE, explanation: `Rondkravet får inte passas – preferens till partnerns ${SYM[partnerMajor]} (mina visade 3 stöd).` }
  }
  return pass('Inget att tillägga.')
}
