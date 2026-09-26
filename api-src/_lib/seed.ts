// Beslut B etapp 2 — det hemliga tävlingsfröet (server-only, node:crypto).
//
// Dagens frö FÅR inte gå att förberäkna (annars kan vem som helst med appens kod
// räkna fram givarna i förväg — se docs/beslut-b-plan.md). Därför HMAC-SHA256 av
// "nyckel:bricka" med en hemlighet som bara bor i serverns miljövariabler.
//
// Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md): två tävlingar
// samma dag behöver OLIKA givar. Därför hashas en FRÖNYCKEL i stället för
// datumet: MP-tävlingens nyckel ÄR datumet (byte-identiskt med förr, så gamla
// dagars omprov och validering ger exakt samma givar), IMP-tävlingens är
// "datum#imp". Alla anrop går via `fronyckel(dag, form)`.

import { createHmac } from 'node:crypto'
import type { TavlingsForm } from '../../src/lib/engine/matchpoints'

/** Frönyckeln för en tävling: MP = datumet självt (oförändrat sedan etapp 2),
 *  IMP = datumet + "#imp". Facit låser att MP-nyckeln aldrig flyttar sig. */
export function fronyckel(dateISO: string, form: TavlingsForm): string {
  return form === 'imp' ? `${dateISO}#imp` : dateISO
}

/** Oförberäkneligt heltalsfrö för (frönyckel, bricka): första 4 byte av
 *  HMAC-SHA256("nyckel:bricka", hemlighet) som osignerat 32-bitars heltal —
 *  samma form som mulberry32 vill ha. `nyckel` är `fronyckel(dag, form)`. */
export function seedForBoard(secret: string, nyckel: string, board: number): number {
  const mac = createHmac('sha256', secret).update(`${nyckel}:${board}`).digest()
  return mac.readUInt32BE(0)
}

/** Fröet för BOTTARNAS spel i en tävlingsgiv (skilt från giv-fröet ovan). Med
 *  det spelar bottarna deterministiskt (src/lib/engine/play-seed.ts) så servern
 *  kan spela om ett inskickat resultat och validera det. Behöver inte vara
 *  hemligt — klienten får det i svaret och servern re-härleder samma tal vid
 *  valideringen — men vi härleder det ur samma hemlighet för EN sanningskälla.
 *  ":play"-suffixet gör att play-fröet aldrig sammanfaller med giv-fröet. */
export function playSeedForBoard(secret: string, nyckel: string, board: number): number {
  const mac = createHmac('sha256', secret).update(`${nyckel}:${board}:play`).digest()
  return mac.readUInt32BE(0)
}
