// Systems-on efter 2♣–2♦–2NT (öppnarens 22–24 balanserade återbud). Svararen
// bjöd väntebudet 2♦ (0–7 hp) och använder EXAKT samma konventioner som mot en
// naturlig 2NT-öppning (Puppet Stayman/transfer/Texas) — bara med 22–24 mittemot
// i stället för 20–21, så poänggränserna sänks två steg (utgång redan från 3 hp).
//
// Sekvensen spelas tur för tur ur EN hand genom beslutstabellens rader
// (motorbytet etapp 3 familj 5, 2026-09-05): svararens första bud
// (`systemsOnFirstStep`, raden svar2), öppnarens svar (`openerRebidAfter2NTResponse`
// med 24 som maximum, raden tredje), svararens placering
// (`responderRebidIn2NTAuction` med 22 som minimum, raden svar3) och öppnarens
// val efter svararens placering (`openerChoosesAfterSystemsOn`, raden fjärde —
// samma funktion avgör öppnarens tredje bud efter en 2NT-ÖPPNING).
//
// Puppet Stayman (ägardirektiv 2026-09-15): öppnarens val efter svararens
// Puppet-fortsättning (3♥ = 4 spader / 3♠ = 4 hjärter / 4♦ & 4♣ = båda) och
// efter transfer + andra högfärgen (3♠ = 5♥4♠, 4♥ = 5-5).

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import { betterFourCardMajor, PUPPET, respondTo2NT } from './responses-2nt'
import type { ResponseResult } from './responses'

const OPENER_MIN = 22 // öppnaren visade 22–24 med sitt 2NT-återbud
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }

/** Vilken 5-korts högfärg har svararen visat med sin transfer, om någon? */
function fiveCardMajorShown(resp: ResponseResult): Suit | null {
  if (resp.rule === 'transfer (2NT)') return resp.call === '3D' ? 'hearts' : 'spades'
  return null
}

/** Svararens FÖRSTA bud efter 2♣–2♦–2NT ur EGEN hand (sangsystemet mot 22–24). null = för svag (passar 2NT). */
export function systemsOnFirstStep(responderHand: Hand): ResponseResult | null {
  const resp = respondTo2NT(responderHand, OPENER_MIN)
  return resp.call === 'P' ? null : resp
}

/**
 * Öppnarens val efter svararens placering i sangsystemet (2NT-öppning eller
 * 2♣–2♦–2NT), ur EGEN hand:
 *  · efter Puppet 3♣–3♦ och svararens 3♥ (4 spader) / 3♠ (4 hjärter): 4 i den
 *    högfärgen med 4-korts stöd, annars 3NT; efter 4♦/4♣ (båda): den bättre
 *    4-korts högfärgen (3♦ lovade minst en);
 *  · efter transfer + 3♠ (5♥4♠): 4♠ med 4 spader, 4♥ med 3 hjärter, annars 3NT;
 *    efter transfer + 4♥ (5-5): 4♠ med fler spader än hjärter, annars står 4♥;
 *  · efter 3NT-erbjudandet efter en transfer (exakt 5-korts högfärg): 4 i
 *    högfärgen med 3+ stöd (5-3-fit), annars står 3NT.
 * `resp` = svararens bud över sangen, `place` = svararens placering,
 * `openerMax` = mitt visade maximum (21 / 24 / 18 — styr accepten av 4NT). null =
 * inget val att göra (redan placerat).
 */
export function openerChoosesAfterSystemsOn(hand: Hand, resp: ResponseResult, place: ResponseResult, openerMax = 21): ResponseResult | null {
  const oLen = lengths(hand)
  // Kvantitativ 4NT direkt över mitt Puppet-svar (3♦/3♥/3♠/3NT): maximum → 6NT, annars pass. 6NT står.
  if (resp.rule === PUPPET.ask && place.call === '4NT') {
    return hcp(hand) >= openerMax ? { call: '6NT', rule: 'accepterar slaminbjudan', explanation: 'Maximum mot partnerns kvantitativa 4NT → 6NT.' } : { call: 'P', rule: 'rebid: pass', explanation: 'Minimum mot partnerns kvantitativa 4NT → pass.' }
  }
  if (resp.rule === PUPPET.ask && place.call === '6NT') return { call: 'P', rule: 'rebid: pass', explanation: 'Partnern satte 6NT → pass.' }
  const game = (m: Suit, why: string): ResponseResult => ({ call: `4${BID[m]}`, rule: PUPPET.choose, explanation: `${why} → 4${SYM[m]}.` })

  if (resp.rule === PUPPET.ask) {
    if (place.call === '3H') return oLen.spades >= 4 ? game('spades', 'partnern visade 4 spader och jag har 4') : { call: '3NT', rule: PUPPET.choose, explanation: 'partnern visade 4 spader, jag har inte 4 → 3NT.' }
    if (place.call === '3S') return oLen.hearts >= 4 ? game('hearts', 'partnern visade 4 hjärter och jag har 4') : { call: '3NT', rule: PUPPET.choose, explanation: 'partnern visade 4 hjärter, jag har inte 4 → 3NT.' }
    if (place.call === '4D' || place.call === '4C') {
      const m = betterFourCardMajor(hand)
      return m ? game(m, `partnern visade båda högfärgerna${place.call === '4C' ? ' med slamintresse' : ''} — min bättre 4-korts är ${SYM[m]}`) : null
    }
    return null
  }

  if (resp.rule === 'transfer (2NT)') {
    if (place.rule === PUPPET.transferFourSpades || (place.call === '3S' && resp.call === '3D')) {
      if (oLen.spades >= 4) return { call: '4S', rule: 'väljer högfärgsutgång', explanation: 'partnern visade 5 hjärter och 4 spader; 4-korts spader → 4♠ (4-4-fit).' }
      if (oLen.hearts >= 3) return { call: '4H', rule: 'väljer högfärgsutgång', explanation: 'partnern visade 5 hjärter och 4 spader; 3-korts hjärter → 4♥ (5-3-fit).' }
      return { call: '3NT', rule: 'till spel', explanation: 'partnern visade 5 hjärter och 4 spader; varken 3 hjärter eller 4 spader → 3NT.' }
    }
    if (place.rule === PUPPET.transferFiveHearts || (place.call === '4H' && resp.call === '3H')) {
      if (oLen.spades > oLen.hearts) return { call: '4S', rule: 'väljer högfärgsutgång', explanation: 'partnern visade 5 spader och 5 hjärter; fler spader → 4♠.' }
      return { call: 'P', rule: 'rebid: pass', explanation: 'partnern visade 5 spader och 5 hjärter; minst lika många hjärter → 4♥ står.' }
    }
    if (place.call === '3NT') {
      const m = fiveCardMajorShown(resp)
      if (m && oLen[m] >= 3) {
        const call = m === 'spades' ? '4S' : '4H'
        return { call, rule: 'väljer högfärgsutgång', explanation: `3-korts stöd i den visade 5-korts högfärgen → ${m === 'spades' ? '4♠' : '4♥'}.` }
      }
    }
  }
  return null
}
