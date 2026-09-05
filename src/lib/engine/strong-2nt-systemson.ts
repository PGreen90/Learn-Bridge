// Systems-on efter 2♣–2♦–2NT (öppnarens 22–24 balanserade återbud). Svararen
// bjöd väntebudet 2♦ (0–7 hp) och använder EXAKT samma konventioner som mot en
// naturlig 2NT-öppning (Stayman/transfer/Texas) — bara med 22–24 mittemot i
// stället för 20–21, så poänggränserna sänks två steg (utgång redan från 3 hp).
//
// Sekvensen spelas tur för tur ur EN hand genom beslutstabellens rader
// (motorbytet etapp 3 familj 5, 2026-09-05): svararens första bud
// (`systemsOnFirstStep`, raden svar2), öppnarens svar (`openerRebidAfter2NTResponse`
// med 24 som maximum, raden tredje), svararens placering
// (`responderRebidIn2NTAuction` med 22 som minimum, raden svar3) och öppnarens
// val efter Smolen / 3NT-erbjudandet (`openerChoosesAfterSystemsOn`, raden
// fjärde — samma funktion avgör öppnarens tredje bud efter en 2NT-ÖPPNING).
// Manuset (`buildAuction`) går genom samma rader.

import type { Hand, Suit } from '../../types/bridge'
import { lengths } from './hand'
import { respondTo2NT } from './responses-2nt'
import type { ResponseResult } from './responses'

const OPENER_MIN = 22 // öppnaren visade 22–24 med sitt 2NT-återbud

/** Vilken 5-korts högfärg har svararen visat (transfer eller Smolen), om någon? */
function fiveCardMajorShown(resp: ResponseResult, place: ResponseResult): Suit | null {
  if (resp.rule === 'transfer (2NT)') return resp.call === '3D' ? 'hearts' : 'spades'
  // Smolen: 3♥ visar 5 spader, 3♠ visar 5 hjärter (bjuder 4-korten, lovar 5 i andra).
  if (place.rule === 'Smolen') return place.call === '3H' ? 'spades' : 'hearts'
  return null
}

/** Svararens FÖRSTA bud efter 2♣–2♦–2NT ur EGEN hand (sangsystemet mot 22–24). null = för svag (passar 2NT). */
export function systemsOnFirstStep(responderHand: Hand): ResponseResult | null {
  const resp = respondTo2NT(responderHand, OPENER_MIN)
  return resp.call === 'P' ? null : resp
}

/**
 * Öppnarens val efter svararens placering i sangsystemet (2NT-öppning eller
 * 2♣–2♦–2NT), ur EGEN hand: efter Smolen (svararen visade 5-4) 4 i 5-färgen
 * med 3+ stöd, annars 3NT; efter 3NT-erbjudandet efter en transfer (exakt
 * 5-korts högfärg) 4 i högfärgen med 3+ stöd (5-3-fit), annars står 3NT.
 * `resp` = svararens bud över sangen, `place` = svararens placering. null =
 * inget val att göra (redan placerat).
 */
export function openerChoosesAfterSystemsOn(hand: Hand, resp: ResponseResult, place: ResponseResult): ResponseResult | null {
  const oLen = lengths(hand)
  if (place.rule === 'Smolen') {
    const m = fiveCardMajorShown(resp, place)
    const call = m && oLen[m] >= 3 ? (m === 'spades' ? '4S' : '4H') : '3NT'
    const shown = call === '4S' ? '4♠' : call === '4H' ? '4♥' : call
    return { call, rule: 'väljer utgång efter Smolen', explanation: `Placerar utgången efter svararens 5-4 → ${shown}.` }
  }
  if (place.call === '3NT') {
    const m = fiveCardMajorShown(resp, place)
    if (m && oLen[m] >= 3) {
      const call = m === 'spades' ? '4S' : '4H'
      return { call, rule: 'väljer högfärgsutgång', explanation: `3-korts stöd i den visade 5-korts högfärgen → ${m === 'spades' ? '4♠' : '4♥'}.` }
    }
  }
  return null
}
