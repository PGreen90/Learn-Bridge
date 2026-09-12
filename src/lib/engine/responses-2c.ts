// Budmotorns svar på partnerns starka, konstgjorda 2♣-öppning (22+ hp, krav).
// Härlett ur systemboken §4.4. Tre delar i en ostörd auktion:
//   1. respondTo2C            – svararens FÖRSTA bud (2♦ väntebud + positiva)
//   2. openerRebidAfter2C     – öppnarens återbud (2NT/3NT eller krav-färg)
//   3. responderSecondBidAfter2C – svararens andra bud (andra negativa m.m.)
//
// Avgränsning: efter öppnarens 2NT (22–24) använder svararen NT-konventionerna
// med 22–24 mittemot. Den grenen överlappar §4.3 och byggs senare – tills dess
// stannar auktionen där (markeras som öppen), precis som andra ofärdiga grenar.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { playingTricks } from './evaluation'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'] // stigande budrang
const rankOf = (s: Suit) => RANK.indexOf(s)
const SUIT_OF_CALL: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
const isMajor = (s: Suit) => s === 'hearts' || s === 'spades'

function suitOfCall(call: string): Suit | null {
  const m = call.match(/^\d(C|D|H|S)$/)
  return m ? SUIT_OF_CALL[m[1]] : null
}

/** Längsta färgen med minst `min` kort; lika längd → högst rankad (mest beskrivande). */
function longestSuit(len: Record<Suit, number>, min: number): Suit | null {
  let best: Suit | null = null
  for (const s of RANK) {
    if (len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankOf(s) > rankOf(best))) best = s
  }
  return best
}

/** Lägsta lagliga budet i `suit` ovanför färgbudet `refCall`. */
function levelAbove(suit: Suit, refCall: string): number {
  const refSuit = suitOfCall(refCall)
  const refLevel = parseInt(refCall[0], 10)
  return refSuit && rankOf(suit) > rankOf(refSuit) ? refLevel : refLevel + 1
}

// === 1. Svararens första svar på 2♣ (2♦ väntebud) ==========================

/** Vad svarar man på partnerns starka 2♣? Systembok §4.4. */
export function respondTo2C(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)

  if (p >= 8) {
    // Positivt svar: visa en 5+ färg (högfärg på 2-läget, minor på 3-läget).
    const s5 = longestSuit(len, 5)
    if (s5) {
      const level = isMajor(s5) ? 2 : 3
      return {
        call: `${level}${BID[s5]}`,
        rule: '2♣-positivt',
        explanation: `8+ hp med 5+ ${SYM[s5]} → ${level}${SYM[s5]} (positivt, utgångskrav).`,
      }
    }
    // Balanserad 8+ utan 5-korts färg → 2NT (positivt, GF).
    if (isBalanced(hand)) {
      return { call: '2NT', rule: '2♣-positivt', explanation: `8+ balanserad → 2NT (positivt, utgångskrav).` }
    }
  }

  // 0–7 hp (eller 8+ obalanserad utan biudbar 5-färg): 2♦ konstgjort väntebud.
  return { call: '2D', rule: '2♦ väntebud', explanation: `Väntebud → 2♦ (konstgjort, säger inget om handen).` }
}

// === 2. Öppnarens återbud efter svararens svar =============================

/** Öppnarens andra bud efter 2♣. §4.4. */
export function openerRebidAfter2C(hand: Hand, response: ResponseResult): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)

  // --- Efter 2♦ väntebud: visa jättehandens form ---
  if (response.call === '2D') {
    if (bal && p <= 24) return { call: '2NT', rule: 'rebid: 2NT (22–24)', explanation: `Balanserad (22–24) → 2NT (ej krav).` }
    if (bal) return { call: '3NT', rule: 'rebid: 3NT (28–30)', explanation: `Balanserad (28–30) → 3NT (ej krav).` }
    // Obalanserad jätte: naturlig 5+ färg, krav 1 rond. Ett 2♣-återbud i färg
    // LOVAR 5+ (live-prov 2026-09-12); den treifärgade jätten (4-4-4-1) utan
    // 5-korts färg får inte bjuda en 4-korts "krav-färg" — den bjuder 2NT.
    const s = longestSuit(len, 5)
    if (s) {
      const level = isMajor(s) ? 2 : 3
      return { call: `${level}${BID[s]}`, rule: 'rebid: krav-färg', explanation: `Jättehand med 5+ ${SYM[s]} → ${level}${SYM[s]} (naturlig, krav 1 rond).` }
    }
    return { call: '2NT', rule: 'rebid: 2NT (22–24)', explanation: `Stark treifärgshand utan 5-korts färg → 2NT.`, uncertain: true }
  }

  // --- Efter ett positivt svar: paret är i GF, sikta mot slam ---
  const rs = suitOfCall(response.call)
  if (rs) {
    if (len[rs] >= 3) {
      const lvl = parseInt(response.call[0], 10) + 1
      return { call: `${lvl}${BID[rs]}`, rule: 'rebid: stöd (GF)', explanation: `3+ stöd i ${SYM[rs]} → ${lvl}${SYM[rs]} (sätter trumf, utgångskrav/slamintresse).` }
    }
    const own = longestSuit(len, 5)
    if (own && own !== rs) {
      const lvl = levelAbove(own, response.call)
      return { call: `${lvl}${BID[own]}`, rule: 'rebid: egen färg (GF)', explanation: `5+ ${SYM[own]} → ${lvl}${SYM[own]} (naturlig, utgångskrav).` }
    }
  }
  // Efter 2NT-positivt (färglöst svar): jättehandens egen 5+ färg får aldrig
  // gömmas bakom 3NT (felrapport #17). Ägarbeslut 2026-07-04: 5-korts räcker för
  // att visa färgen naturligt (krav, GF) – inget hopp behövs, cue-bud kommer
  // sedan. Bara en genuint balanserad hand utan 5-färg bjuder 3NT.
  const ownSuit = longestSuit(len, 5)
  if (ownSuit) {
    const lvl = levelAbove(ownSuit, response.call)
    return { call: `${lvl}${BID[ownSuit]}`, rule: 'rebid: egen färg (GF)', explanation: `5+ ${SYM[ownSuit]} → ${lvl}${SYM[ownSuit]} (naturlig, utgångskrav – visar färgen före 3NT).` }
  }
  // Balanserat positivt (2NT) utan 5-färg → 3NT — om svaret ligger under 3NT.
  // Svarade partnern 3NT eller högre (människobud) är utgången redan satt → pass.
  const responseLevel = parseInt(response.call[0], 10)
  if (response.call === '3NT' || responseLevel >= 4) {
    return { call: 'P', rule: 'rebid: pass', explanation: `Utgången är redan bjuden och ingen egen 5-färg att visa → pass.` }
  }
  return { call: '3NT', rule: 'rebid: 3NT (GF)', explanation: `Ingen egen 5-färg → 3NT.`, uncertain: !bal }
}

// === 3. Svararens andra bud (andra negativa) ===============================

/** Svararens andra bud efter 2♣–2♦–(öppnarens krav-rebud). §4.4. */
export function responderSecondBidAfter2C(hand: Hand, response: ResponseResult, rebid: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)

  // Bara den definierade grenen: 2♦ väntebud följt av öppnarens krav-färgrebud.
  // (Efter 2NT/3NT agerar svararen via NT-stegen – tas senare.)
  if (response.call !== '2D' || rebid.rule !== 'rebid: krav-färg') return null
  const rs = suitOfCall(rebid.call)
  if (!rs) return null

  // Andra negativa = 2NT (§5b beslut 6, 2026-09-07): riktig bottenhand (0–3)
  // UTAN fit och UTAN 5-kortsfärg, efter en högfärg. 3♣/3♦ är naturliga (0–7,
  // 5+ kort) — bjud din riktiga färg så 2♣-öppnaren får beskriva en gång till.
  if (p <= 3 && isMajor(rs) && len[rs] < 3 && !longestSuit(len, 5)) {
    return { call: '2NT', rule: 'andra negativa', explanation: `Riktig bottenhand (0–3) utan fit och utan 5-kortsfärg → 2NT (andra negativa, säger inget om sang).` }
  }

  // Stöd i öppnarens färg → höj till utgång (GF, slamintresse i minor).
  if (isMajor(rs) && len[rs] >= 3) {
    return { call: `4${BID[rs]}`, rule: 'höjning (GF)', explanation: `3+ stöd → 4${SYM[rs]} (utgång).` }
  }
  if (!isMajor(rs) && len[rs] >= 4) {
    return { call: `4${BID[rs]}`, rule: 'höjning (GF)', explanation: `4+ stöd i ${SYM[rs]} → 4${SYM[rs]} (utgångskrav, slamintresse).` }
  }

  // Egen 5+ färg, naturlig (krav i GF). F5/E2 "finaste färg" (frö 20261040):
  // en egen MINOR som skulle SPRÄNGA 3NT (4♣/4♦) får inte gömma en 4-korts
  // högfärg som ryms under 3NT — då går högfärgssteget nedan före (4-4-fiten
  // i högfärgen är den finare utgången; minorn kan fortfarande visas senare).
  const own = longestSuit(len, 5)
  const ownMinorPast3NT = own && !isMajor(own) && own !== rs && levelAbove(own, rebid.call) >= 4
  if (ownMinorPast3NT && !isMajor(rs)) {
    for (const m of ['hearts', 'spades'] as Suit[]) {
      if (len[m] >= 4 && levelAbove(m, rebid.call) === 3) {
        return { call: `3${BID[m]}`, rule: 'ny färg (GF)', explanation: `4+ ${SYM[m]} → 3${SYM[m]} (4-korts högfärg under 3NT går före egen minor förbi 3NT, utgångskrav).` }
      }
    }
  }
  if (own && own !== rs) {
    const lvl = levelAbove(own, rebid.call)
    return { call: `${lvl}${BID[own]}`, rule: 'ny färg (GF)', explanation: `5+ ${SYM[own]} → ${lvl}${SYM[own]} (naturlig, utgångskrav).` }
  }

  // Efter öppnarens MINOR-rebud: visa en 4-korts högfärg under 3NT (fel färg-
  // spåret fix 2). En 4-4-högfärgsfit hittas bara om svararen visar färgen —
  // och utan fit hos öppnaren spelas sangen dessutom från den STARKA handen
  // (öppnaren bjuder 3NT) i stället för från svararens tomma. Billigast först
  // (hjärter före spader: spaderfiten kan fortfarande hittas i nästa steg).
  if (!isMajor(rs)) {
    for (const m of ['hearts', 'spades'] as Suit[]) {
      if (len[m] >= 4 && levelAbove(m, rebid.call) === 3) {
        return { call: `3${BID[m]}`, rule: 'ny färg (GF)', explanation: `4+ ${SYM[m]} → 3${SYM[m]} (4-korts högfärg under 3NT, utgångskrav – hittar 4-4-fiten).` }
      }
    }
  }

  // Inget bättre → 3NT till spel.
  return { call: '3NT', rule: 'till spel', explanation: `Ingen fit → 3NT.` }
}

// === 4. Efter andra negativa (2♣–2♦–2M–2NT), §4.4 "Vid miss" ==============
// §5b beslut 6 (2026-09-07): svararen har visat 0–3 utan fit och utan
// 5-kortsfärg. Öppnaren får stanna lågt — inget krav längre.

/** Öppnarens tredje bud efter partnerns andra negativa (2NT) på kravfärgen `M`. */
export function openerThirdAfterSecondNegative(hand: Hand, M: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  // Utgången på egen hand: 6+ trumf och 24+, eller 9½+ spelstick (solid lång
  // färg; 2♣ öppnas på 8½) — partnern lovade bara 0–3 utan fit.
  if (len[M] >= 6 && (p >= 24 || playingTricks(hand) >= 9.5)) {
    return { call: `4${BID[M]}`, rule: 'utgång', explanation: `6+ ${SYM[M]} och ${p >= 24 ? '24+' : '9½+ spelstick'} → 4${SYM[M]} (utgång på egen hand trots bottenhanden).` }
  }
  if (len[M] >= 6) {
    return { call: `3${BID[M]}`, rule: 'rebid: egen färg', explanation: `6+ ${SYM[M]} mittemot bottenhanden → 3${SYM[M]} (ej krav, partnern får passa).` }
  }
  const second = (['hearts', 'spades', 'diamonds', 'clubs'] as Suit[]).filter((s) => s !== M && len[s] >= 4).sort((a, b) => len[b] - len[a])[0]
  if (second) {
    return { call: `3${BID[second]}`, rule: 'rebid: ny färg', explanation: `Andra färgen, 4+ ${SYM[second]} → 3${SYM[second]} (naturligt, ej krav — partnern väljer).` }
  }
  return { call: `3${BID[M]}`, rule: 'rebid: egen färg', explanation: `Inget bättre mittemot bottenhanden → 3${SYM[M]} (ej krav).` }
}

/** Svararens placering efter öppnarens fortsättning på andra negativa. `M` = öppnarens kravfärg. */
export function responderAfterSecondNegative(hand: Hand, M: Suit, third: ResponseResult): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${why} → pass.` })
  const level = parseInt(third.call[0], 10)
  if (level >= 4 || third.call.endsWith('NT')) return pass('öppnaren placerade kontraktet')
  const shown = suitOfCall(third.call)
  if (shown === M) {
    // 3M (ej krav): höj till utgång bara med 3 trumf och något av värde (2+ hp).
    if (len[M] >= 3 && p >= 2) return { call: `4${BID[M]}`, rule: 'höjning', explanation: `3 trumf och ${p} hp mittemot jättehanden → 4${SYM[M]} (höjer bottenhandens max).` }
    return pass('bottenhand utan trumfstöd – 3' + SYM[M] + ' räcker')
  }
  if (shown) {
    // Öppnarens andra färg (ej krav): stanna med 4+, annars preferens till kravfärgen om den ryms på 3-läget.
    if (len[shown] >= 4) return pass(`4+ ${SYM[shown]} – öppnarens andra färg står`)
    if (rankOf(M) > rankOf(shown)) return { call: `3${BID[M]}`, rule: 'preferens', explanation: `Preferens till öppnarens första färg → 3${SYM[M]} (ej krav).` }
    return pass('ingen bättre plats')
  }
  return pass('öppnaren placerade kontraktet')
}
