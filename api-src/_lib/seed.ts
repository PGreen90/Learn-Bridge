// Beslut B etapp 2 — det hemliga tävlingsfröet (server-only, node:crypto).
//
// Dagens frö FÅR inte gå att förberäkna (annars kan vem som helst med appens kod
// räkna fram givarna i förväg — se docs/beslut-b-plan.md). Därför HMAC-SHA256 av
// "datum:bricka" med en hemlighet som bara bor i serverns miljövariabler.

import { createHmac } from 'node:crypto'

/** Oförberäkneligt heltalsfrö för (tävlingsdag, bricka): första 4 byte av
 *  HMAC-SHA256("datum:bricka", hemlighet) som osignerat 32-bitars heltal —
 *  samma form som mulberry32 vill ha. */
export function seedForBoard(secret: string, dateISO: string, board: number): number {
  const mac = createHmac('sha256', secret).update(`${dateISO}:${board}`).digest()
  return mac.readUInt32BE(0)
}

/** Fröet för BOTTARNAS spel i en tävlingsgiv (skilt från giv-fröet ovan). Med
 *  det spelar bottarna deterministiskt (src/lib/engine/play-seed.ts) så servern
 *  kan spela om ett inskickat resultat och validera det. Behöver inte vara
 *  hemligt — klienten får det i svaret och servern re-härleder samma tal vid
 *  valideringen — men vi härleder det ur samma hemlighet för EN sanningskälla.
 *  ":play"-suffixet gör att play-fröet aldrig sammanfaller med giv-fröet. */
export function playSeedForBoard(secret: string, dateISO: string, board: number): number {
  const mac = createHmac('sha256', secret).update(`${dateISO}:${board}:play`).digest()
  return mac.readUInt32BE(0)
}
