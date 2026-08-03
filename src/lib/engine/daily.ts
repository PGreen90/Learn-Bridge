// Dagens giv (2026-08-02): alla som öppnar appen samma dag spelar EXAKT samma
// giv — datumet är fröet, så ingen server behövs. Det är en förtitt på
// Funbridge-modellen (konkurrensplanen Fas 3): topplistan kommer först med
// konton, men "samma giv för alla + delbart resultat" fungerar redan nu.
// Ren logik utan I/O — delningsknappen (navigator.share/clipboard) bor i UI:t.

import type { Deal } from '../../types/bridge'
import { dealRandom, mulberry32 } from './deal'

/** Premiärdagen — Dagens giv #1. Lokal tid (spelarens "i dag"). */
const EPOCH = new Date(2026, 7, 2)

/** Fröet = datumet som åttasiffrigt tal (20260802), i spelarens lokala tid.
 *  Samma dag → samma frö → samma giv, precis som revisorns reproducerbara frön. */
export function dailySeed(date: Date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

/** Givens löpnummer: premiärdagen = #1, dagen efter = #2 … (lokala dygn). */
export function dailyNumber(date: Date = new Date()): number {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((day.getTime() - EPOCH.getTime()) / 86_400_000) + 1
}

/** Dagens giv — deterministisk ur datumet, med stabilt id ("dagens-1"). */
export function dailyDeal(date: Date = new Date()): Deal {
  const deal = dealRandom(mulberry32(dailySeed(date)))
  return { ...deal, id: `dagens-${dailyNumber(date)}` }
}

/**
 * Det delbara resultatet (Wordle-mekaniken): en kort text att klistra in i en
 * gruppchatt — varje delning är en inbjudan att spela samma giv själv.
 *
 * SPOILERFRI sedan Etapp B (granskningen 2026-08-02): den gamla texten skrev
 * ut kontrakt + hemma/bet + poäng i klartext — mottagaren fick facit innan hen
 * spelat. Nu delas bara DINA stick som rutrad (grönt = stick till din sida);
 * given förblir en överraskning, precis som Wordles färgrutor.
 */
export function shareText({ number, myTricks }: { number: number; myTricks: number }): string {
  const row = '🟩'.repeat(myTricks) + '⬛'.repeat(13 - myTricks)
  return [
    `rebidz · Dagens giv #${number}`,
    row,
    `Jag tog ${myTricks} av 13 stick — klarar du fler?`,
    'https://rebidz.com/#/spela-kort/dagens',
  ].join('\n')
}

// === Resultatloggen + streaken (Etapp B) ====================================
// Loggen bor i localStorage (nyckeln `daily-log` via lib/storage) men FORMEN
// och beräkningarna bor här — ren logik utan I/O, som resten av modulen.

/** Ett spelat dagens giv-resultat. `myTricks` = stick till DIN sida (N/S). */
export interface DailyEntry {
  myTricks: number
}

/** Givnummer → resultat. Nycklarna blir strängar i JSON — därför string|number. */
export type DailyLog = Record<string | number, DailyEntry>

/**
 * Streaken: hur många dagar i rad har du spelat, räknat bakåt från i dag?
 * Dagens giv ospelad → gårdagens svit lever fortfarande (som i Wordle bryts
 * streaken först när en HEL dag missats).
 */
export function dailyStreak(log: DailyLog, todayNumber: number): number {
  const start = log[todayNumber] !== undefined ? todayNumber : todayNumber - 1
  let n = 0
  while (log[start - n] !== undefined) n++
  return n
}
