// Systems-on efter 2♣–2♦–2NT (öppnarens 22–24 balanserade återbud). Svararen
// bjöd väntebudet 2♦ (0–7 hp) och använder EXAKT samma konventioner som mot en
// naturlig 2NT-öppning (Stayman/transfer/Texas) — bara med 22–24 mittemot i
// stället för 20–21, så poänggränserna sänks två steg (utgång redan från 3 hp).
//
// Egen modul för att undvika importcykel: den knyter ihop 2NT-svarsstegen
// (`responses-2nt`) med svararens placering (`responder-rebids`), och importeras
// bara av `auction.ts` (`buildAuction`), som bygger hela sekvensen deterministiskt
// eftersom båda händerna är kända.

import type { Hand, Suit } from '../../types/bridge'
import { lengths } from './hand'
import { respondTo2NT, openerRebidAfter2NTResponse } from './responses-2nt'
import { responderRebidIn2NTAuction } from './responder-rebids'
import type { ResponseResult } from './responses'

const OPENER_MIN = 22 // öppnaren visade 22–24 med sitt 2NT-återbud
const OPENER_MAX = 24

export interface SystemsOnTurn {
  role: 'öppnare' | 'svarare'
  call: string
  rule: string
  explanation: string
}

const t = (role: 'öppnare' | 'svarare', r: ResponseResult): SystemsOnTurn => ({
  role, call: r.call, rule: r.rule, explanation: r.explanation,
})

/** Vilken 5-korts högfärg har svararen visat (transfer eller Smolen), om någon? */
function fiveCardMajorShown(resp: ResponseResult, place: ResponseResult): Suit | null {
  if (resp.rule === 'transfer (2NT)') return resp.call === '3D' ? 'hearts' : 'spades'
  // Smolen: 3♥ visar 5 spader, 3♠ visar 5 hjärter (bjuder 4-korten, lovar 5 i andra).
  if (place.rule === 'Smolen') return place.call === '3H' ? 'spades' : 'hearts'
  return null
}

/**
 * Bygger sekvensen EFTER 2♣–2♦–2NT. Returnerar turerna (svararens bud, öppnarens
 * svar, svararens placering, ev. öppnarens val) och om linjen är TERMINAL
 * (`open:false`) eller ska fortsätta i budlådan. Returnerar `null` när svararen är
 * för svag för utgång (0–2 hp → respondTo2NT ger pass): då passar hen 2NT och det
 * vanliga flödet (buildAuction/live) sköter utpassningen.
 */
export function strong2NTSystemsOn(openerHand: Hand, responderHand: Hand): { turns: SystemsOnTurn[]; open: boolean } | null {
  const resp = respondTo2NT(responderHand, OPENER_MIN)
  if (resp.call === 'P') return null // 0–2 hp: passar 2NT (hanteras utanför)

  const turns: SystemsOnTurn[] = [t('svarare', resp)]

  // Öppnaren fullföljer (Stayman-svar / transfer / Texas / accepterar kvantitativ).
  const answer = openerRebidAfter2NTResponse(resp, openerHand, OPENER_MAX)
  if (!answer || answer.call === 'P') return { turns, open: false } // svararens bud var slutbud (3NT/6NT) → öppnaren passar
  turns.push(t('öppnare', answer))

  // Svararen placerar kontraktet (höj funnen fit → 4M, annars 3NT; Smolen; osv.).
  const place = responderRebidIn2NTAuction(resp, answer, responderHand, OPENER_MIN)
  if (!place) return { turns, open: false } // Texas/minorfråga redan placerad av öppnarens svar
  turns.push(t('svarare', place))

  const oLen = lengths(openerHand)

  // Efter Smolen (svararen visade 5-4): öppnaren väljer 4 i 5-färgen med 3+ stöd.
  if (place.rule === 'Smolen') {
    const m = fiveCardMajorShown(resp, place)
    const call = m && oLen[m] >= 3 ? (m === 'spades' ? '4S' : '4H') : '3NT'
    turns.push({ role: 'öppnare', call, rule: 'väljer utgång efter Smolen', explanation: `Placerar utgången efter svararens 5-4 → ${call}.` })
    return { turns, open: false }
  }

  // Efter en transfer där svararen erbjöd 3NT (exakt 5-korts högfärg): öppnaren
  // väljer 4 i högfärgen med 3+ stöd (5-3-fit), annars står 3NT.
  if (place.call === '3NT') {
    const m = fiveCardMajorShown(resp, place)
    if (m && oLen[m] >= 3) {
      const call = m === 'spades' ? '4S' : '4H'
      turns.push({ role: 'öppnare', call, rule: 'väljer högfärgsutgång', explanation: `3-korts stöd i den visade 5-korts högfärgen → ${call}.` })
    }
  }
  return { turns, open: false }
}
