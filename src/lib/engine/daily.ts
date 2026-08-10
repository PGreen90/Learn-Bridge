// Dagens giv (2026-08-02): alla som öppnar appen samma dag spelar EXAKT samma
// giv — datumet är fröet, så ingen server behövs. Det är en förtitt på
// Funbridge-modellen (konkurrensplanen Fas 3): topplistan kommer först med
// konton, men "samma giv för alla + delbart resultat" fungerar redan nu.
// Ren logik utan I/O — delningsknappen (navigator.share/clipboard) bor i UI:t.

import type { Deal } from '../../types/bridge'
import { dealRandom, mulberry32 } from './deal'

/** Premiärdagen — Dagens giv #1 = 2026-08-02 i Europe/Stockholm. */
const EPOCH_Y = 2026
const EPOCH_M = 8 // augusti (1-baserad, som stockholmYMD ger)
const EPOCH_D = 2

/**
 * Kalenderdagen (år/månad/dag) i Europe/Stockholm, oavsett var koden kör.
 *
 * Varför: fröet och givnumret MÅSTE vara samma för alla spelare (och en
 * framtida server) samma dygn. Räknade vi i körmiljöns lokala tid skulle en
 * server i UTC och en spelare i Sverige kunna hamna på olika giv runt midnatt.
 * `Intl.DateTimeFormat` med `timeZone: 'Europe/Stockholm'` ger rätt kalenderdag
 * i Stockholm för vilken instant som helst, med sommartid inräknad.
 */
function stockholmYMD(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** Fröet = datumet som åttasiffrigt tal (20260802), i Europe/Stockholm.
 *  Samma dag → samma frö → samma giv, precis som revisorns reproducerbara frön. */
export function dailySeed(date: Date = new Date()): number {
  const { y, m, d } = stockholmYMD(date)
  return y * 10000 + m * 100 + d
}

/** Givens löpnummer: premiärdagen = #1, dagen efter = #2 … (Stockholmsdygn).
 *  Båda dagarna ankras på UTC-mitt-på-dagen (kl 12) så sommartidens 23- och
 *  25-timmarsdygn aldrig får differensen att hamna fel vid heltalsdivisionen. */
export function dailyNumber(date: Date = new Date()): number {
  const { y, m, d } = stockholmYMD(date)
  const dayAnchor = Date.UTC(y, m - 1, d, 12)
  const epochAnchor = Date.UTC(EPOCH_Y, EPOCH_M - 1, EPOCH_D, 12)
  return Math.round((dayAnchor - epochAnchor) / 86_400_000) + 1
}

/** Dagens giv — deterministisk ur datumet, med stabilt id ("dagens-1"). */
export function dailyDeal(date: Date = new Date()): Deal {
  const deal = dealRandom(mulberry32(dailySeed(date)))
  return { ...deal, id: `dagens-${dailyNumber(date)}` }
}

/** Datumet för giv #n — dailyNumbers motsats (kalenderarkivet 2026-08-03).
 *  Ankras på premiärdagens UTC-mitt-på-dagen + (n−1) dygn: instanten hamnar
 *  kl 12 UTC = 13/14 i Stockholm, alltså tryggt inom rätt Stockholmsdygn, så
 *  `dailyNumber(dailyDateFromNumber(n)) === n` gäller året runt (även DST). */
export function dailyDateFromNumber(n: number): Date {
  const epochAnchor = Date.UTC(EPOCH_Y, EPOCH_M - 1, EPOCH_D, 12)
  return new Date(epochAnchor + (n - 1) * 86_400_000)
}

/** Giv #n ur arkivet: exakt samma giv som alla fick den dagen. */
export function dailyDealByNumber(n: number): Deal {
  return dailyDeal(dailyDateFromNumber(n))
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
    // ?dag=N (kalenderarkivet 2026-08-03): den som klickar länken i morgon ska
    // hamna på SAMMA giv som resultatet gällde, inte på morgondagens.
    `https://rebidz.com/#/spela-kort/dagens?dag=${number}`,
  ].join('\n')
}

// === Resultatloggen + streaken (Etapp B) ====================================
// Loggen bor i localStorage (nyckeln `daily-log` via lib/storage) men FORMEN
// och beräkningarna bor här — ren logik utan I/O, som resten av modulen.

/** Ett spelat dagens giv-resultat. `myTricks` = stick till DIN sida (N/S).
 *  `late` (kalenderarkivet 2026-08-03) = given spelades i EFTERHAND, en senare
 *  dag än sin egen — syns i kalendern men räknas inte in i streaken. */
export interface DailyEntry {
  myTricks: number
  late?: boolean
}

/** Givnummer → resultat. Nycklarna blir strängar i JSON — därför string|number. */
export type DailyLog = Record<string | number, DailyEntry>

/**
 * Streaken: hur många dagar i rad har du spelat, räknat bakåt från i dag?
 * Dagens giv ospelad → gårdagens svit lever fortfarande (som i Wordle bryts
 * streaken först när en HEL dag missats). Efterhandsspel ur kalenderarkivet
 * (`late`) räknas INTE — ett igenfyllt hål väcker inte en bruten svit.
 */
export function dailyStreak(log: DailyLog, todayNumber: number): number {
  const onTime = (n: number) => log[n] !== undefined && log[n].late !== true
  const start = onTime(todayNumber) ? todayNumber : todayNumber - 1
  let n = 0
  while (onTime(start - n)) n++
  return n
}
