// Beslut B etapp 4 (4A) — bordens grundvärden och rena hjälpare.
//
// Hålls fri från I/O så allt är trivialt att facittesta (bord-grund.test.ts).

import { randomInt } from 'node:crypto'

/** Globalt mjukt tak på samtidiga aktiva bord (ägarbeslut 2026-08-17) —
 *  säkerhetsventil för gratisnivåerna, höjs här när verkligheten visat att
 *  lasten bär (kapacitetskalkylen: gränsen går först vid ~40 samtidiga bord). */
export const MAX_AKTIVA_BORD = 10

/** Kodalfabetet: versaler + siffror utan de förväxlingsbara I/O/0/1 —
 *  koden ska gå att läsa upp över telefon ("kom till bordet KX7PQ2"). */
const KOD_ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const KOD_LANGD = 6

/** Ny inbjudningskod (6 tecken ur alfabetet ovan, ~1 miljard kombinationer).
 *  `slump(max)` = heltal 0..max-1; default node:crypto (privata bord vilar på
 *  att koden inte går att gissa — gå-med-endpointen är dessutom kvotad). */
export function nyBordKod(slump: (max: number) => number = randomInt): string {
  let kod = ''
  for (let i = 0; i < KOD_LANGD; i++) kod += KOD_ALFABET[slump(KOD_ALFABET.length)]
  return kod
}

/** Är strängen en välformad bordskod? (Vakt före databasuppslag.) */
export function giltigBordKod(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    s.length === KOD_LANGD &&
    [...s].every((c) => KOD_ALFABET.includes(c))
  )
}

export const STOLAR = ['N', 'E', 'S', 'W'] as const
export type Stol = (typeof STOLAR)[number]

export function giltigStol(s: unknown): s is Stol {
  return s === 'N' || s === 'E' || s === 'S' || s === 'W'
}
