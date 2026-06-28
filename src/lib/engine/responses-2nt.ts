// Budmotorns svar på partnerns 2NT-öppning (20–21 balanserad) och hantering av
// 3NT-öppning (25–27 balanserad). Punkt 16 i arbetslistan.
//
// VIKTIGT: 2NT har INTE samma svarsstruktur som 1NT. Över 1NT (15–17) är utgång
// osäker → svararen har inbjudningsbud. Över 2NT (20–21) är paret i princip i
// utgångskrav så fort svararen har ~5 hp (20+5 = 25) → INGA inbjudningsbud.
// Konventionerna ligger dessutom ett steg upp: Stayman = 3♣, transfer = 3♦/3♥.
//
//   respondTo2NT             – svararens första bud över 2NT (GF-schema)
//   openerRebidAfter2NTResponse – öppnaren fullföljer Stayman/transfer/minorfråga
//   respondTo3NT             – svararen placerar kontraktet över 3NT (slam/pass)
//   openerRebidAfter3NTResponse – öppnaren tar ställning till kvantitativ 4NT
//
// Avgränsning: exakta slamverktyg (RKC, Gerber, storslam) hör till §6 (punkt
// 17–20). Tills dess är 4NT *kvantitativ* (inbjuder 6NT) och storslam flaggas.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

// === Svar på 2NT-öppning (20–21) ===========================================

/**
 * Vad svarar man på partnerns 2NT (20–21)? GF-schema, inga inbjudningsbud.
 *  - 3♣ Stayman (4-korts högfärg, utgångsvärden)
 *  - 3♦ → ♥, 3♥ → ♠ transfer (5+ högfärg; svag = signoff, stark = slam senare)
 *  - 3♠ minorfråga (5-4+ minorer, slamintresse)
 *  - 3NT till spel; 4♦/4♥ Texas (6+ högfärg, ren utgång); 4NT kvantitativ; 6NT
 */
export function respondTo2NT(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const sp = len.spades
  const he = len.hearts

  // ---- 5-4 i högfärgerna, utgångsvärden → Stayman (hittar 4-4 och 5-3) ----
  const fiveFourMajors = (sp === 5 && he === 4) || (he === 5 && sp === 4)
  if (fiveFourMajors && p >= 5) {
    return { call: '3C', rule: 'Stayman (2NT)', explanation: `${p} hp, 5-4 i högfärgerna → 3♣ (Stayman; visar sedan 5-färgen om fit saknas).` }
  }

  // ---- 5+ högfärg → transfer eller Texas ----
  const major: Suit | null = sp >= 5 && sp >= he ? 'spades' : he >= 5 ? 'hearts' : null
  if (major) {
    const L = len[major]
    const sym = SYM[major]
    // Texas: 6+ kort, ren utgång (5–10 hp utan slamintresse) → sätt färgen direkt.
    if (L >= 6 && p >= 5 && p <= 10) {
      const call = major === 'hearts' ? '4D' : '4H'
      return { call, rule: 'Texas (2NT)', explanation: `${p} hp med 6-korts ${sym} → ${call} (Texas, utgång utan slamiver).` }
    }
    // Transfer på 3-läget: 3♦ → ♥, 3♥ → ♠. Svag = signoff i delkontrakt, 11+ = slam.
    const call = major === 'hearts' ? '3D' : '3H'
    const strength = p < 5 ? 'signoff i delkontrakt' : p >= 11 ? 'slamintresse' : 'utgång'
    return { call, rule: 'transfer (2NT)', explanation: `${p} hp med ${L}-korts ${sym} → ${call} (transfer, ${strength}).` }
  }

  // ---- 4-korts högfärg, utgångsvärden → Stayman ----
  if ((sp >= 4 || he >= 4) && p >= 5) {
    return { call: '3C', rule: 'Stayman (2NT)', explanation: `${p} hp med 4-korts högfärg → 3♣ (Stayman).` }
  }

  // Härefter: ingen biudbar högfärg.

  // ---- Minorfråga: 5-4+ i minorerna med slamintresse → 3♠ ----
  const minors = (len.clubs >= 5 && len.diamonds >= 4) || (len.diamonds >= 5 && len.clubs >= 4)
  if (minors && p >= 11) {
    return { call: '3S', rule: 'minorfråga (2NT)', explanation: `${p} hp, 5-4+ i minorerna med slamvärden → 3♠ (frågar efter minorfit).` }
  }

  // ---- NT-stegen ----
  if (p >= 13) {
    return { call: '6NT', rule: '6NT till spel', explanation: `${p} hp balanserad (≈33+ tillsammans) → 6NT.` }
  }
  if (p >= 11) {
    return { call: '4NT', rule: '4NT kvantitativ', explanation: `${p} hp balanserad → 4NT (kvantitativ, inbjuder 6NT).` }
  }
  if (p >= 5) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp utan högfärg → 3NT (till spel).` }
  }
  return { call: 'P', rule: 'pass', explanation: `${p} hp – för svagt för utgång → pass.` }
}

/** Öppnaren fullföljer svararens 2NT-svar (Stayman/transfer/Texas/minorfråga). */
export function openerRebidAfter2NTResponse(response: ResponseResult, hand: Hand): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)

  switch (response.rule) {
    case 'Stayman (2NT)':
      if (len.hearts >= 4) return { call: '3H', rule: 'Stayman-svar', explanation: '4+ hjärter → 3♥.' }
      if (len.spades >= 4) return { call: '3S', rule: 'Stayman-svar', explanation: '4 spader (förnekar 4 hjärter) → 3♠.' }
      return { call: '3D', rule: 'Stayman-svar', explanation: 'ingen 4-korts högfärg → 3♦.' }
    case 'transfer (2NT)': {
      const target: Suit = response.call === '3D' ? 'hearts' : 'spades'
      return { call: `3${BID[target]}`, rule: 'fullföljd transfer', explanation: `fullföljer transfern → 3${SYM[target]}.` }
    }
    case 'Texas (2NT)': {
      const target: Suit = response.call === '4D' ? 'hearts' : 'spades'
      return { call: `4${BID[target]}`, rule: 'fullföljd Texas', explanation: `fullföljer Texas → 4${SYM[target]}.` }
    }
    case 'minorfråga (2NT)':
      if (len.clubs >= 4) return { call: '4C', rule: 'minorsvar', explanation: '4+ klöver → 4♣.' }
      if (len.diamonds >= 4) return { call: '4D', rule: 'minorsvar', explanation: '4+ ruter (förnekar 4 klöver) → 4♦.' }
      return { call: '3NT', rule: 'minorsvar', explanation: 'ingen 4-korts minor → 3NT.' }
    case '3NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'till spel → pass.' }
    case '4NT kvantitativ':
      return p >= 21 ? { call: '6NT', rule: 'accepterar slaminbjudan', explanation: `${p} hp (max) → 6NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `${p} hp (minimum) → pass.` }
    case '6NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'slam satt → pass.' }
    default:
      return null
  }
}

// === Hantering av 3NT-öppning (25–27) ======================================

/**
 * Svar på partnerns 3NT-öppning (25–27, stor balanserad). Svararen placerar
 * kontraktet: nästan alltid pass (utgång är redan nådd) – med slamvärden 6NT,
 * eller 4NT kvantitativ som inbjudan. Exakt storslam hör till §6 (flaggas).
 */
export function respondTo3NT(hand: Hand): ResponseResult {
  const p = hcp(hand)
  // Tillsammans: 6NT ≈ 33, 7NT ≈ 37. Mittemot 25–27 → ~6 = slam, ~12 = storslam.
  if (p >= 12) {
    return { call: '6NT', rule: '6NT till spel', explanation: `${p} hp – storslam kan finnas, men exakt fråga (RKC/Gerber) tas i §6 → 6NT så länge.`, uncertain: true }
  }
  if (p >= 8) {
    return { call: '6NT', rule: '6NT till spel', explanation: `${p} hp mittemot 25–27 (≈33+) → 6NT.` }
  }
  if (p >= 5) {
    return { call: '4NT', rule: '4NT kvantitativ', explanation: `${p} hp → 4NT (kvantitativ, inbjuder 6NT).` }
  }
  return { call: 'P', rule: 'pass', explanation: `${p} hp – utgång räcker → pass.` }
}

/** Öppnaren tar ställning till svararens kvantitativa 4NT över 3NT-öppningen. */
export function openerRebidAfter3NTResponse(response: ResponseResult, hand: Hand): ResponseResult | null {
  const p = hcp(hand)
  switch (response.rule) {
    case '4NT kvantitativ':
      return p >= 26 ? { call: '6NT', rule: 'accepterar slaminbjudan', explanation: `${p} hp (max) → 6NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `${p} hp (minimum) → pass.` }
    case '6NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'slam satt → pass.' }
    default:
      return null
  }
}
