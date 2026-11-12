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

/** Europe/Stockholms UTC-offset (i ms) vid en given instant — via IANA-zonen,
 *  så sommartid räknas rätt. T.ex. +1h vintertid, +2h sommartid. */
function stockholmOffsetMs(epoch: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Stockholm',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(epoch))
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(tz)
  if (!m) return 0
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  return (h * 60 + (h < 0 ? -min : min)) * 60_000
}

/** Epoch-ms för en väggklockstid (år/månad/dag/timme) i Europe/Stockholm,
 *  DST-säkert. Midnatt (h=0) ligger aldrig på en DST-övergång (de sker 02–03
 *  lokal tid), så offseten vid den instanten är stabil. */
function stockholmWallToEpoch(y: number, m: number, d: number, h: number): number {
  const somOmUTC = Date.UTC(y, m - 1, d, h)
  return somOmUTC - stockholmOffsetMs(somOmUTC)
}

/** Fröet = datumet som åttasiffrigt tal (20260802), i Europe/Stockholm.
 *  Samma dag → samma frö → samma giv, precis som revisorns reproducerbara frön. */
export function dailySeed(date: Date = new Date()): number {
  const { y, m, d } = stockholmYMD(date)
  return y * 10000 + m * 100 + d
}

/** Kalenderdagen i Europe/Stockholm som ISO-sträng "ÅÅÅÅ-MM-DD". Serverns
 *  tävlingsgiv-generering (Beslut B etapp 2) använder den som tävlingsdagens
 *  nyckel och som del av det hemliga HMAC-fröet — oavsett var funktionen kör. */
export function stockholmDateISO(date: Date = new Date()): string {
  const { y, m, d } = stockholmYMD(date)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
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

/**
 * Det delbara TÄVLINGSRESULTATET (nästa nivå etapp 2, 2026-11-11): placering +
 * resultat för en färdigspelad tävling. Spoilerfritt — inga givar, kontrakt
 * eller kort — och länken leder mottagaren rakt in i samma tävling.
 * `resultat` är den färdiga texten ("62,4 %" eller "+12 IMP").
 */
export function tavlingShareText({
  form,
  nummer,
  placering,
  antalSpelare,
  resultat,
}: {
  form: 'mp' | 'imp' | 'guld'
  nummer: number
  placering: number
  antalSpelare: number
  resultat: string
}): string {
  const namn = form === 'imp' ? 'Dagens IMP' : form === 'guld' ? 'Veckans stjärntävling' : 'Dagens MP%'
  return [
    `rebidz · ${namn} #${nummer}`,
    `Jag fick ${resultat} — plats ${placering} av ${antalSpelare} just nu. Slår du det?`,
    `https://rebidz.com/#/spela-kort/tavling${form === 'mp' ? '' : `?form=${form}`}`,
  ].join('\n')
}

// === Veckans stjärntävling (ägarbeslut 2026-11-11) ============================

/** Måndagen i veckan som `dateISO` (YYYY-MM-DD) ligger i. Räknat mitt på dagen
 *  UTC så sommartidsbyten aldrig flyttar datumet. */
export function veckansMandag(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`)
  const sedanMandag = (d.getUTCDay() + 6) % 7 // mån=0 … sön=6
  d.setUTCDate(d.getUTCDate() - sedanMandag)
  return d.toISOString().slice(0, 10)
}

/** "9–15 nov" / "30 nov–6 dec": veckan måndag–söndag ur måndagens datum. */
export function veckoText(mandagISO: string): string {
  const MANAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const man = new Date(`${mandagISO}T12:00:00Z`)
  const son = new Date(man)
  son.setUTCDate(son.getUTCDate() + 6)
  const slut = `${son.getUTCDate()} ${MANAD[son.getUTCMonth()]}`
  return man.getUTCMonth() === son.getUTCMonth()
    ? `${man.getUTCDate()}–${slut}`
    : `${man.getUTCDate()} ${MANAD[man.getUTCMonth()]}–${slut}`
}

/** Första guld-veckans måndag — tävling nr 1. */
export const GULD_PREMIAR = '2026-11-09'

/** Guld-tävlingens löpnummer: premiärveckan = 1, veckan efter = 2 … */
export function guldNummer(mandagISO: string): number {
  const ms = Date.parse(`${mandagISO}T12:00:00Z`) - Date.parse(`${GULD_PREMIAR}T12:00:00Z`)
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000)) + 1
}

/** Millisekunder kvar till nästa måndag 00:00 svensk tid (då nästa guld-tävling
 *  öppnar). Bygger på samma midnattsräkning som den dagliga nedräkningen. */
export function msTillNastaGuld(now: Date = new Date()): number {
  const idag = stockholmDateISO(now)
  const dagarKvar = 6 - ((new Date(`${idag}T12:00:00Z`).getUTCDay() + 6) % 7) // hela dagar efter i dag
  return msTillNastaTavling(now) + dagarKvar * 24 * 60 * 60 * 1000
}

// === Nedräkning till nästa tävling (Beslut B etapp 2, UI) ====================

/** Millisekunder tills nästa dagliga tävling börjar = nästa midnatt i
 *  Europe/Stockholm (tävlingsdagen byts vid det svenska dygnsskiftet). Så länge
 *  har man på sig att spela klart dagens. DST-säkert och OBEROENDE av spelarens
 *  egen tidszon — samma nedräkning för alla, var i världen man än sitter. */
export function msTillNastaTavling(now: Date = new Date()): number {
  const { y, m, d } = stockholmYMD(now)
  // Morgondagens kalenderdatum i Stockholm (noon-ankare undviker datumglidning).
  const imorgon = new Date(Date.UTC(y, m - 1, d + 1, 12))
  const midnatt = stockholmWallToEpoch(
    imorgon.getUTCFullYear(),
    imorgon.getUTCMonth() + 1,
    imorgon.getUTCDate(),
    0,
  )
  return midnatt - now.getTime()
}

/** "HH:MM:SS" ur ett millisekundintervall (nedräkningsklockan). Negativt/0 → 0. */
export function formatNedrakning(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
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
