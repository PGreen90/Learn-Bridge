// Budmotorns svar på partnerns 2NT-öppning (20–21 balanserad). Punkt 16 i
// arbetslistan. (3NT-öppningen är Gambling sedan 2026-09-14 — `gambling-3nt.ts`.)
//
// VIKTIGT: 2NT har INTE samma svarsstruktur som 1NT. Över 1NT (15–17) är utgång
// osäker → svararen har inbjudningsbud. Över 2NT (20–21) är paret i princip i
// utgångskrav så fort svararen har ~5 hp (20+5 = 25) → INGA inbjudningsbud.
// Konventionerna ligger dessutom ett steg upp: transfer = 3♦/3♥ — och 3♣ är
// **Puppet Stayman** (ägardirektiv 2026-09-15, `docs/puppet-stayman-plan.md`):
// 2NT-öppningen får ha 5-3-3-2 med en 5-korts högfärg, så 3♣ frågar FÖRST
// efter en 5-korts högfärg (svar 3♥/3♠), i andra hand en 4-korts (3♦ = minst
// en, 3NT = ingen). Vanlig Stayman hittade bara 4-4-fiten.
//
//   respondTo2NT             – svararens första bud över 2NT (GF-schema)
//   openerRebidAfter2NTResponse – öppnaren fullföljer Puppet/transfer/minorfråga
//
// Avgränsning: exakta slamverktyg (RKC, Gerber, storslam) hör till §6. Här är
// 4NT *kvantitativ* (inbjuder 6NT); slamporten efter en Puppet-fit ligger i
// beslutstabellen (`auction-decide.ts`).

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths, suitHcp } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

/** Regel-id:n i Puppet-strukturen (delas av betydelselagret och beslutstabellen). */
export const PUPPET = {
  ask: 'Puppet Stayman',
  answer: 'Puppet-svar',
  answerNone: 'Puppet-svar: ingen högfärg',
  fourSpades: 'Puppet: 4 spader',
  fourHearts: 'Puppet: 4 hjärter',
  both: 'Puppet: båda högfärgerna',
  bothSlam: 'Puppet: båda, slamintresse',
  /** Kaptenens trumfsättning efter öppnarens 5-korts: 3♠ över 3♥, 4♥ över 3♠ (slamintresse; sondens fynd 2026-09-15). */
  agree: 'Puppet: trumf satt, slamintresse',
  choose: 'väljer utgång efter Puppet',
  transferFourSpades: 'transfer: 4 spader',
  transferFiveHearts: 'transfer: 5 hjärter',
} as const

// === Svar på 2NT-öppning (20–21) ===========================================

/**
 * Vad svarar man på partnerns 2NT (20–21)? GF-schema, inga inbjudningsbud.
 *  - 3♣ Puppet Stayman: utgångsvärden + minst en 3-korts högfärg (ägarbeslut
 *    2026-09-15: inget annat krav) — även 5♠4♥ (efter 3♦ visar 4♦ båda).
 *  - 3♦ → ♥, 3♥ → ♠ transfer (5+ högfärg; svag = signoff, stark = slam senare);
 *    5♥4♠ går ALLTID via transfern (visar spadern med 3♠ under 3NT), 5-5 via
 *    3♥ (visar hjärtern med 4♥).
 *  - 3♠ minorfråga (5-4+ minorer, slamintresse) — går före 3-korts-Puppet.
 *  - 3NT till spel (ingen 3-korts högfärg); 4♦/4♥ Texas (6+ högfärg, ren
 *    utgång); 4NT kvantitativ; 6NT.
 * `openerMin` = 20 för 2NT-öppningen, 22 för 2♣–2♦–2NT, 16 mot 2NT-inklivet.
 */
export function respondTo2NT(hand: Hand, openerMin = 20): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const sp = len.spades
  const he = len.hearts
  // Poänggränser härledda ur öppnarens minsta styrka. Utgång ≈ 25, slaminbjudan
  // ≈ 31, slam ≈ 33 tillsammans → tröskeln = (total) − openerMin. Med
  // openerMin=20 blir det exakt 5/11/13.
  const game = 25 - openerMin
  const slamInvite = 31 - openerMin
  const slam = 33 - openerMin

  const puppet = (why: string): ResponseResult => ({
    call: '3C', rule: PUPPET.ask,
    explanation: `${why} → 3♣ (Puppet Stayman: frågar efter partnerns 5-korts högfärg, i andra hand en 4-korts).`,
  })

  // ---- 5-4 i högfärgerna med utgångsvärden (beslut 2, hybriden) ----------
  if (p >= game && he === 5 && sp === 4) {
    return { call: '3D', rule: 'transfer (2NT)', explanation: `5 ♥ och 4 ♠ → 3♦ (transfer till hjärter; spadern visas sedan med 3♠).` }
  }
  if (p >= game && sp === 5 && he === 4) return puppet('5 ♠ och 4 ♥')

  // ---- 5+ högfärg → transfer eller Texas ----
  const major: Suit | null = sp >= 5 && sp >= he ? 'spades' : he >= 5 ? 'hearts' : null
  if (major) {
    const L = len[major]
    const sym = SYM[major]
    // Texas: 6+ kort, ren utgång (utgångsstyrka utan slamintresse) → sätt direkt.
    if (L >= 6 && p >= game && p < slamInvite) {
      const call = major === 'hearts' ? '4D' : '4H'
      const shown = major === 'hearts' ? '4♦' : '4♥'
      return { call, rule: 'Texas (2NT)', explanation: `6+ ${sym} → ${shown} (Texas — transfer till ${sym}, utgång utan slamiver).` }
    }
    // Transfer på 3-läget: 3♦ → ♥, 3♥ → ♠. Svag = signoff i delkontrakt, slam = 11+.
    const call = major === 'hearts' ? '3D' : '3H'
    const shown = major === 'hearts' ? '3♦' : '3♥'
    const strength = p < game ? 'signoff i delkontrakt' : p >= slamInvite ? 'slamintresse' : 'utgång'
    const fiveFive = sp >= 5 && he >= 5 && p >= game ? '; hjärtern visas sedan med 4♥' : ''
    return { call, rule: 'transfer (2NT)', explanation: `5+ ${sym} → ${shown} (transfer till ${sym}, ${strength}${fiveFive}).` }
  }

  // ---- 4-korts högfärg, utgångsvärden → Puppet ----
  if ((sp >= 4 || he >= 4) && p >= game) return puppet('4-korts högfärg')

  // ---- Minorfråga: 5-4+ i minorerna med slamintresse → 3♠ ----
  const minors = (len.clubs >= 5 && len.diamonds >= 4) || (len.diamonds >= 5 && len.clubs >= 4)
  if (minors && p >= slamInvite) {
    return { call: '3S', rule: 'minorfråga (2NT)', explanation: `5-4+ i minorerna med slamvärden → 3♠ (frågar efter minorfit).` }
  }

  // ---- 3-korts högfärg, utgångsvärden → Puppet (letar partnerns 5-korts) ----
  if ((sp >= 3 || he >= 3) && p >= game) return puppet('3-korts högfärg (en 5-3-fit hos partnern spelar bättre än sang)')

  // ---- NT-stegen ----
  if (p >= slam) {
    return { call: '6NT', rule: '6NT till spel', explanation: `Balanserad, slamzon → 6NT.` }
  }
  if (p >= slamInvite) {
    return { call: '4NT', rule: '4NT kvantitativ', explanation: `Balanserad slaminbjudan → 4NT (kvantitativ, inbjuder 6NT).` }
  }
  if (p >= game) {
    return { call: '3NT', rule: '3NT till spel', explanation: `Utgångsvärden utan 3-korts högfärg → 3NT (till spel).` }
  }
  return { call: 'P', rule: 'pass', explanation: `För svagt för utgång → pass.` }
}

/** Öppnarens Puppet-svar ur EGEN hand: 5-korts högfärg först, sedan 4-korts, annars 3NT. */
export function puppetAnswer(hand: Hand): ResponseResult {
  const len = lengths(hand)
  if (len.hearts >= 5) return { call: '3H', rule: PUPPET.answer, explanation: '5 ♥ → 3♥ (svar på Puppet Stayman).' }
  if (len.spades >= 5) return { call: '3S', rule: PUPPET.answer, explanation: '5 ♠ → 3♠ (svar på Puppet Stayman).' }
  if (len.hearts >= 4 || len.spades >= 4) return { call: '3D', rule: PUPPET.answer, explanation: 'minst en 4-korts högfärg, ingen 5-korts → 3♦ (partnern visar sin högfärg).' }
  return { call: '3NT', rule: PUPPET.answerNone, explanation: 'varken 4- eller 5-korts högfärg → 3NT.' }
}

/** Öppnarens BÄTTRE 4-korts högfärg (flest honnörspoäng; lika → hjärter), eller null utan 4-korts. */
export function betterFourCardMajor(hand: Hand): Suit | null {
  const len = lengths(hand)
  const majors = (['hearts', 'spades'] as Suit[]).filter((m) => len[m] >= 4)
  if (majors.length === 0) return null
  if (majors.length === 1) return majors[0]
  return suitHcp(hand, 'spades') > suitHcp(hand, 'hearts') ? 'spades' : 'hearts'
}

/** Öppnaren fullföljer svararens 2NT-svar (Puppet/transfer/Texas/minorfråga).
 * `openerMax` = övre gränsen på öppnarens styrka (21 för 2NT-öppning, 24 för
 * 2♣–2♦–2NT-återbudet) → styr acceptansen av en kvantitativ 4NT. */
export function openerRebidAfter2NTResponse(response: ResponseResult, hand: Hand, openerMax = 21): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)

  switch (response.rule) {
    case PUPPET.ask:
      return puppetAnswer(hand)
    case 'transfer (2NT)': {
      const target: Suit = response.call === '3D' ? 'hearts' : 'spades'
      return { call: `3${BID[target]}`, rule: 'fullföljd transfer', explanation: `fullföljer transfern → 3${SYM[target]}.` }
    }
    case 'Texas (2NT)': {
      const target: Suit = response.call === '4D' ? 'hearts' : 'spades'
      return { call: `4${BID[target]}`, rule: 'fullföljd Texas', explanation: `fullföljer Texas → 4${SYM[target]}.` }
    }
    case 'minorfråga (2NT)':
      if (len.clubs >= 4) return { call: '4C', rule: 'minorsvar', explanation: '4+ ♣ → 4♣.' }
      if (len.diamonds >= 4) return { call: '4D', rule: 'minorsvar', explanation: '4+ ♦ (förnekar 4 ♣) → 4♦.' }
      return { call: '3NT', rule: 'minorsvar', explanation: 'ingen 4+ minor → 3NT.' }
    case '3NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'till spel → pass.' }
    case '4NT kvantitativ':
      return p >= openerMax ? { call: '6NT', rule: 'accepterar slaminbjudan', explanation: `Maximum → 6NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `Minimum → pass.` }
    case '6NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'slam satt → pass.' }
    default:
      return null
  }
}
