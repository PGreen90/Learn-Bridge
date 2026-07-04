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
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
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
        explanation: `${p} hp med ${len[s5]}-korts ${NAME[s5]} → ${level}${SYM[s5]} (positivt, GF).`,
      }
    }
    // Balanserad 8+ utan 5-korts färg → 2NT (positivt, GF).
    if (isBalanced(hand)) {
      return { call: '2NT', rule: '2♣-positivt', explanation: `${p} hp balanserad → 2NT (positivt, GF).` }
    }
  }

  // 0–7 hp (eller 8+ obalanserad utan biudbar 5-färg): 2♦ konstgjort väntebud.
  return { call: '2D', rule: '2♦ väntebud', explanation: `${p} hp → 2♦ (konstgjort väntebud, säger inget om handen).` }
}

// === 2. Öppnarens återbud efter svararens svar =============================

/** Öppnarens andra bud efter 2♣. §4.4. */
export function openerRebidAfter2C(hand: Hand, response: ResponseResult): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)

  // --- Efter 2♦ väntebud: visa jättehandens form ---
  if (response.call === '2D') {
    if (bal && p <= 24) return { call: '2NT', rule: 'rebid: 2NT (22–24)', explanation: `${p} hp balanserad → 2NT (22–24, ej krav).` }
    if (bal) return { call: '3NT', rule: 'rebid: 3NT (28–30)', explanation: `${p} hp balanserad → 3NT (28–30, ej krav).` }
    // Obalanserad jätte: naturlig längsta färg, krav 1 rond.
    const s = longestSuit(len, 5) ?? longestSuit(len, 4)
    if (s) {
      const level = isMajor(s) ? 2 : 3
      return { call: `${level}${BID[s]}`, rule: 'rebid: krav-färg', explanation: `${p} hp med ${len[s]}-korts ${NAME[s]} → ${level}${SYM[s]} (naturlig, krav 1 rond).` }
    }
    return { call: '2NT', rule: 'rebid: 2NT (22–24)', explanation: `${p} hp → 2NT.`, uncertain: true }
  }

  // --- Efter ett positivt svar: paret är i GF, sikta mot slam ---
  const rs = suitOfCall(response.call)
  if (rs) {
    if (len[rs] >= 3) {
      const lvl = parseInt(response.call[0], 10) + 1
      return { call: `${lvl}${BID[rs]}`, rule: 'rebid: stöd (GF)', explanation: `${p} hp, ${len[rs]} stöd i ${NAME[rs]} → ${lvl}${SYM[rs]} (sätter trumf, GF/slamintresse).` }
    }
    const own = longestSuit(len, 5)
    if (own && own !== rs) {
      const lvl = levelAbove(own, response.call)
      return { call: `${lvl}${BID[own]}`, rule: 'rebid: egen färg (GF)', explanation: `${p} hp med ${len[own]}-korts ${NAME[own]} → ${lvl}${SYM[own]} (naturlig, GF).` }
    }
  }
  // Efter 2NT-positivt (färglöst svar): jättehandens egen 5+ färg får aldrig
  // gömmas bakom 3NT (felrapport #17). Ägarbeslut 2026-07-04: 5-korts räcker för
  // att visa färgen naturligt (krav, GF) – inget hopp behövs, cue-bud kommer
  // sedan. Bara en genuint balanserad hand utan 5-färg bjuder 3NT.
  const ownSuit = longestSuit(len, 5)
  if (ownSuit) {
    const lvl = levelAbove(ownSuit, response.call)
    return { call: `${lvl}${BID[ownSuit]}`, rule: 'rebid: egen färg (GF)', explanation: `${p} hp med ${len[ownSuit]}-korts ${NAME[ownSuit]} → ${lvl}${SYM[ownSuit]} (naturlig, GF – visar färgen före 3NT).` }
  }
  // Balanserat positivt (2NT) utan 5-färg → 3NT.
  return { call: '3NT', rule: 'rebid: 3NT (GF)', explanation: `${p} hp – ingen egen 5-färg → 3NT.`, uncertain: !bal }
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

  // Andra negativa: riktig bottenhand (0–3) → billigaste klöver, efter en högfärg.
  if (p <= 3 && isMajor(rs)) {
    return { call: '3C', rule: 'andra negativa', explanation: `${p} hp – riktig bottenhand → 3♣ (andra negativa, 0–3).` }
  }

  // Stöd i öppnarens färg → höj till utgång (GF, slamintresse i minor).
  if (isMajor(rs) && len[rs] >= 3) {
    return { call: `4${BID[rs]}`, rule: 'höjning (GF)', explanation: `${p} hp, ${len[rs]} stöd → 4${SYM[rs]} (utgång, GF).` }
  }
  if (!isMajor(rs) && len[rs] >= 4) {
    return { call: `4${BID[rs]}`, rule: 'höjning (GF)', explanation: `${p} hp, ${len[rs]} stöd i ${NAME[rs]} → 4${SYM[rs]} (GF, slamintresse).` }
  }

  // Egen 5+ färg, naturlig (krav i GF).
  const own = longestSuit(len, 5)
  if (own && own !== rs) {
    const lvl = levelAbove(own, rebid.call)
    return { call: `${lvl}${BID[own]}`, rule: 'ny färg (GF)', explanation: `${p} hp med ${len[own]}-korts ${NAME[own]} → ${lvl}${SYM[own]} (naturlig, GF).` }
  }

  // Inget bättre → 3NT till spel.
  return { call: '3NT', rule: 'till spel', explanation: `${p} hp – ingen fit → 3NT.` }
}
