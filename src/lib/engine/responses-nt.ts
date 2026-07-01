// Budmotorns svar på partnerns 1NT-öppning (15–17 balanserad), ostörd.
// Härlett ur systemboken §4.3. Returnerar samma form som övriga svarsmotorer.
//
// Detta är svararens FÖRSTA bud. Fortsättningar (Smolen efter 2♣–2♦, svararens
// rebud efter fullföljd transfer m.m.) hör till hela auktioner och tas i nästa
// steg. Direkta naturliga 3-läges slamförsök (tabellens 3♣/3♦/3♥/3♠) är
// medvetet utelämnade här – de överlappar transfers/Minor Suit Stayman och tas
// upp om hålfinnaren visar att de behövs.

import type { Hand } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'

/** Vad svarar man på partnerns 1NT (15–17)? Systembok §4.3. */
export function respondTo1NT(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const sp = len.spades
  const he = len.hearts

  // ---- 5-4 i högfärgerna, inbjudan+ → Stayman (planerar Smolen vid GF) ----
  const fiveFourMajors = (sp === 5 && he === 4) || (he === 5 && sp === 4)
  if (fiveFourMajors && p >= 8) {
    return { call: '2C', rule: 'Stayman', explanation: `${p} hp, 5-4 i högfärgerna → 2♣ (Stayman; Smolen om öppnaren saknar högfärg).` }
  }

  // ---- Garbage/drop-dead Stayman: svag hand (0–7), exakt 4-4 i högfärgerna,
  // kort klöver (4-4-4-1 eller 4-4-5-0) → 2♣ och PASSA öppnarens svar. Alla tre
  // svaren (2♦/2♥/2♠) landar i en 4-4-fit eller 4+ ruter, bättre än 1NT med
  // klöversingel/renons. Ingen 5-korts högfärg (då transfer i stället). ----
  if (p <= 7 && sp === 4 && he === 4 && len.clubs <= 1) {
    return { call: '2C', rule: 'Stayman', explanation: `${p} hp, 4-4 i högfärgerna + kort klöver → 2♣ (garbage Stayman; passar öppnarens svar).` }
  }

  // ---- 5-5 i högfärgerna: transferriktningen KODAR styrkan (ägarbeslut) ----
  //  svag (0–7)   → 2♣ (garbage-route: passa hf-svar, annars 2 i bästa hf över 2♦)
  //  inbjudan(8–9)→ 2♦ (transfer ♥), sedan 2♠  = 5-5, inbjudan
  //  GF (10+)     → 2♥ (transfer ♠), sedan 3♥  = 5-5, GF
  if (sp === 5 && he === 5) {
    if (p >= 10) return { call: '2H', rule: 'Jacoby-transfer', explanation: `${p} hp, 5-5 i högfärgerna, GF → 2♥ (transfer till spader; 3♥ sedan = 5-5).` }
    if (p >= 8) return { call: '2D', rule: 'Jacoby-transfer', explanation: `${p} hp, 5-5 i högfärgerna, inbjudan → 2♦ (transfer till hjärter; 2♠ sedan = 5-5).` }
    return { call: '2C', rule: 'Stayman', explanation: `${p} hp, 5-5 i högfärgerna, svag → 2♣ (garbage; passar hf-svar, annars 2 i bästa hf).` }
  }

  // ---- 5+ högfärg → transfer (Jacoby) eller Texas ----
  const major = sp >= 5 && sp >= he ? 'spades' : he >= 5 ? 'hearts' : null
  if (major) {
    const L = len[major]
    if (L >= 6 && p >= 10 && p <= 15) {
      // Texas: 4♦ → ♥, 4♥ → ♠. Utgång utan slamintresse.
      const call = major === 'hearts' ? '4D' : '4H'
      const sym = major === 'hearts' ? '♥' : '♠'
      return { call, rule: 'Texas', explanation: `${p} hp med 6-korts ${sym === '♥' ? 'hjärter' : 'spader'} → ${call} (Texas, utgång).` }
    }
    // Jacoby: 2♦ → ♥, 2♥ → ♠. Svag signoff upp till mild slam.
    const call = major === 'hearts' ? '2D' : '2H'
    const sym = major === 'hearts' ? '♥' : '♠'
    return { call, rule: 'Jacoby-transfer', explanation: `${p} hp med ${L}-korts ${sym === '♥' ? 'hjärter' : 'spader'} → ${call} (Jacoby-transfer).` }
  }

  // ---- 4-korts högfärg, inbjudan+ → Stayman ----
  if ((sp >= 4 || he >= 4) && p >= 8) {
    return { call: '2C', rule: 'Stayman', explanation: `${p} hp med 4-korts högfärg → 2♣ (Stayman).` }
  }

  // Härefter: ingen biudbar 4-korts högfärg.

  // ---- Minor Suit Stayman: 5-4+ i minorerna, GF/slam ----
  const mss = (len.clubs >= 5 && len.diamonds >= 4) || (len.diamonds >= 5 && len.clubs >= 4)
  if (mss && p >= 13) {
    return { call: '2S', rule: 'Minor Suit Stayman', explanation: `${p} hp, 5-4+ i minorerna utan högfärg → 2♠ (Minor Suit Stayman, GF/slam).` }
  }

  // ---- NT-stegen (balanserade/övriga utan högfärg) ----
  if (p >= 16) {
    return { call: '4NT', rule: '4NT kvantitativ', explanation: `${p} hp balanserad → 4NT (kvantitativ slaminbjudan).` }
  }
  if (p >= 10) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp utan högfärg → 3NT (till spel).` }
  }
  if (p >= 8) {
    return { call: '2NT', rule: '2NT inbjudan', explanation: `${p} hp balanserad → 2NT (inbjudan).` }
  }
  return { call: 'P', rule: 'pass', explanation: `${p} hp – ingen utgångschans → pass.` }
}
