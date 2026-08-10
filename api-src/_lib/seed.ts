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
