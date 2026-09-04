// Förklaringen av ett bud — en tunn läsare av betydelselagret
// (`auction-meaning.ts`, motorbytet etapp 1). UI:t (budlådan, auktionsrutan,
// rondrapporten, bordet) frågar hit; betydelsen räknas i `meaningOf`.
//
// Kärnlöftet: `interpretCall` ger ALLTID en förklaring – aldrig tomt. När
// motorn satt en `rule` på budet används dess text och kravnivå (säker);
// annars den härledda betydelsen ur auktionen, med ärlig säkerhetsgradering.

import type { ResolvedCall } from '../bidding'
import { meaningOf } from './auction-meaning'

export type { CallInterpretation, Confidence } from './auction-meaning'
import type { CallInterpretation } from './auction-meaning'

export function interpretCall(history: ResolvedCall[], index: number): CallInterpretation {
  const m = meaningOf(history, index)
  return { text: m.text, confidence: m.confidence, ...(m.forcing ? { forcing: m.forcing } : {}) }
}

/** Tolka det SENASTE budet i historiken (vanligaste anropet). */
export function interpretLastCall(history: ResolvedCall[]): CallInterpretation | null {
  if (history.length === 0) return null
  return interpretCall(history, history.length - 1)
}
