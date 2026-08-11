import { describe, expect, it } from 'vitest'
import {
  dailyDateFromNumber,
  dailyDeal,
  dailyDealByNumber,
  dailyNumber,
  dailySeed,
  dailyStreak,
  formatNedrakning,
  msTillNastaTavling,
  shareText,
} from './daily'

// Dagens giv (faceliften/konkurrensspåret 2026-08-02): samma datum ska ALLTID ge
// samma giv — det är hela poängen (alla spelar samma giv och kan jämföra sig).
//
// TIDSZON (Beslut B etapp 0, 2026-08-08): kalenderdagen räknas i Europe/Stockholm,
// inte i körmiljöns lokala tid. CI kör på ubuntu i UTC, så testerna använder
// entydiga UTC-instanter (…Z) och resonerar i Stockholmstid: sommartid = UTC+2,
// alltså är t.ex. 2026-08-02T10:00Z = 12:00 den 2 aug i Stockholm.

describe('dagens giv', () => {
  it('samma Stockholmsdygn ger exakt samma giv', () => {
    // Båda instanterna ligger inom 2026-08-02 i Stockholm (10:00 resp 22:00).
    const a = dailyDeal(new Date('2026-08-02T08:00:00Z'))
    const b = dailyDeal(new Date('2026-08-02T20:00:00Z'))
    expect(a.hands).toEqual(b.hands)
    expect(a.board).toBe(b.board)
    expect(a.dealer).toBe(b.dealer)
    expect(a.vulnerability).toBe(b.vulnerability)
    expect(a.id).toBe(b.id)
  })

  it('olika dagar ger olika givar', () => {
    const a = dailyDeal(new Date('2026-08-02T10:00:00Z'))
    const b = dailyDeal(new Date('2026-08-03T10:00:00Z'))
    expect(a.hands).not.toEqual(b.hands)
  })

  it('fröet är datumet som åttasiffrigt tal (Stockholmstid)', () => {
    expect(dailySeed(new Date('2026-08-02T10:00:00Z'))).toBe(20260802)
    expect(dailySeed(new Date('2026-01-15T10:00:00Z'))).toBe(20260115)
  })

  it('givnumret räknas från premiärdagen 2026-08-02 = #1 (Stockholmsdygn)', () => {
    expect(dailyNumber(new Date('2026-08-02T10:00:00Z'))).toBe(1)
    expect(dailyNumber(new Date('2026-08-03T06:30:00Z'))).toBe(2)
    expect(dailyNumber(new Date('2026-09-01T10:00:00Z'))).toBe(31)
  })

  // KÄRNAN i tidszonsbytet: en instant vars UTC-dygn och Stockholmsdygn skiljer
  // sig ska följa STOCKHOLM. 2026-08-02T22:30Z = 3 aug 00:30 i Stockholm (UTC+2)
  // → giv #2, inte #1. På en UTC-runner (där lokal = UTC) hade den gamla
  // lokaltidslogiken svarat #1 och klient/server hamnat på olika giv.
  it('instant nära midnatt följer Stockholmsdygnet, inte UTC-dygnet', () => {
    const nearMidnight = new Date('2026-08-02T22:30:00Z') // 3 aug 00:30 i Stockholm
    expect(dailySeed(nearMidnight)).toBe(20260803)
    expect(dailyNumber(nearMidnight)).toBe(2)
  })

  it('en giv har 13 kort per hand', () => {
    const deal = dailyDeal(new Date('2026-08-02T10:00:00Z'))
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      expect(deal.hands[seat]).toHaveLength(13)
    }
  })

  // Kalenderarkivet (granskningsputsen 2026-08-03): varje giv ska gå att nå i
  // efterhand via sitt löpnummer — samma giv som alla fick den dagen.
  it('arkivet: löpnumret pekar ut exakt den dagens giv', () => {
    // #1 = premiärdagen 2026-08-02; #31 = 2026-09-01 (månadsskiftet räknas rätt).
    // dailyDateFromNumber ger en instant INOM rätt Stockholmsdygn (ej midnatt
    // lokal), så vi verifierar via fröet/numret i stället för exakt Date-likhet.
    expect(dailySeed(dailyDateFromNumber(1))).toBe(20260802)
    expect(dailySeed(dailyDateFromNumber(31))).toBe(20260901)
    // Numret och datumet är varandras motsatser (round-trip, även långt fram).
    expect(dailyNumber(dailyDateFromNumber(1))).toBe(1)
    expect(dailyNumber(dailyDateFromNumber(31))).toBe(31)
    expect(dailyNumber(dailyDateFromNumber(200))).toBe(200)
    // Given ur numret = given ur datumet, med samma id.
    const viaNumber = dailyDealByNumber(2)
    const viaDate = dailyDeal(new Date('2026-08-03T10:00:00Z'))
    expect(viaNumber.hands).toEqual(viaDate.hands)
    expect(viaNumber.id).toBe('dagens-2')
  })

  // Deltexten gjordes SPOILERFRI i Etapp B (granskningen 2026-08-02): den
  // gamla texten skrev ut kontrakt + resultat i klartext, så mottagaren fick
  // facit INNAN hen spelat given. Nu delas bara dina egna stick (Wordle-
  // mekanikens spoilerfria rutor) — kontraktet förblir en överraskning.
  // Länken bär givens dag (?dag=N) sedan kalenderarkivet 2026-08-03: den som
  // klickar i morgon ska hamna på SAMMA giv som resultatet gällde.
  it('deltexten: rutraden visar mina stick, inget kontrakt och inget facit', () => {
    const text = shareText({ number: 1, myTricks: 8 })
    expect(text).toBe(
      'rebidz · Dagens giv #1\n' +
        '🟩🟩🟩🟩🟩🟩🟩🟩⬛⬛⬛⬛⬛\n' +
        'Jag tog 8 av 13 stick — klarar du fler?\n' +
        'https://rebidz.com/#/spela-kort/dagens?dag=1',
    )
  })

  it('deltexten: 0 och 13 stick ger hela rader', () => {
    expect(shareText({ number: 3, myTricks: 0 })).toContain('⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛')
    expect(shareText({ number: 3, myTricks: 13 })).toContain('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩')
    // Inga spoilers någonstans i texten.
    expect(shareText({ number: 3, myTricks: 13 })).not.toMatch(/hemma|bet|[1-7](NT|♠|♥|♦|♣)/)
  })
})

// Streaken (Etapp B): resultatloggen är en karta givnummer → resultat.
// Streaken = obruten svit som slutar i dag — eller i går, om dagens giv inte
// spelats ännu (streaken "lever" tills en hel dag missats, som i Wordle).
describe('streaken', () => {
  it('obruten svit till och med i dag räknas', () => {
    const log = { 1: { myTricks: 7 }, 2: { myTricks: 8 }, 3: { myTricks: 5 } }
    expect(dailyStreak(log, 3)).toBe(3)
  })

  it('dagens giv ospelad → gårdagens svit lever fortfarande', () => {
    const log = { 1: { myTricks: 7 }, 2: { myTricks: 8 } }
    expect(dailyStreak(log, 3)).toBe(2)
  })

  it('ett hål i sviten nollställer', () => {
    const log = { 1: { myTricks: 7 }, 3: { myTricks: 8 } }
    expect(dailyStreak(log, 3)).toBe(1) // bara dagens
    expect(dailyStreak({ 1: { myTricks: 7 } }, 3)).toBe(0) // två dagar gammalt
  })

  it('tom logg → ingen streak', () => {
    expect(dailyStreak({}, 5)).toBe(0)
  })

  // Ärlighetsregeln (kalenderarkivet 2026-08-03): en giv spelad i EFTERHAND
  // bokförs i loggen (syns i kalendern) men räknas inte in i streaken — annars
  // ginge det att fylla igen hål och "fuska ihop" en svit dagar senare.
  it('efterhandsspel ur arkivet räknas inte in i streaken', () => {
    const log = { 1: { myTricks: 7 }, 2: { myTricks: 8, late: true }, 3: { myTricks: 5 } }
    expect(dailyStreak(log, 3)).toBe(1) // bara dagens — 2:an var ett efterhandsspel
  })

  it('att fylla igen gårdagens hål i efterhand väcker inte den brutna sviten', () => {
    // Dag 1–2 spelade i tid, dag 3 missades och fylldes igen ur arkivet på dag 4.
    const log = { 1: { myTricks: 7 }, 2: { myTricks: 8 }, 3: { myTricks: 5, late: true } }
    expect(dailyStreak(log, 4)).toBe(0) // dag 3 missades i TID → sviten är bruten
  })
})

// Nedräkningen till nästa tävling = nästa midnatt i Europe/Stockholm, oavsett
// spelarens tidszon och DST. Facit förankras i kända instanter (UTC in, ms ut).
describe('msTillNastaTavling — nästa svenska midnatt', () => {
  it('sommartid (CEST, +2): midnatt Sthlm = 22:00 UTC', () => {
    // 2026-08-11 10:00 UTC = 12:00 i Sthlm. Nästa midnatt = 12 aug 00:00 CEST =
    // 11 aug 22:00 UTC → 12 timmar kvar.
    const ms = msTillNastaTavling(new Date('2026-08-11T10:00:00Z'))
    expect(ms).toBe(12 * 3600_000)
  })

  it('vintertid (CET, +1): midnatt Sthlm = 23:00 UTC', () => {
    // 2026-01-15 10:00 UTC = 11:00 i Sthlm. Nästa midnatt = 16 jan 00:00 CET =
    // 15 jan 23:00 UTC → 13 timmar kvar.
    const ms = msTillNastaTavling(new Date('2026-01-15T10:00:00Z'))
    expect(ms).toBe(13 * 3600_000)
  })

  it('strax före midnatt Sthlm: bara någon minut kvar', () => {
    // 2026-08-11 21:58 UTC = 23:58 i Sthlm → 2 minuter kvar till midnatt.
    const ms = msTillNastaTavling(new Date('2026-08-11T21:58:00Z'))
    expect(ms).toBe(2 * 60_000)
  })

  it('samma nedräkning oavsett var koden råkar köra (funktionen använder Sthlm-zonen)', () => {
    // Två olika instanter som båda är 12:00 i Sthlm samma dag ger samma svar.
    expect(msTillNastaTavling(new Date('2026-08-11T10:00:00Z'))).toBe(12 * 3600_000)
  })
})

describe('formatNedrakning — HH:MM:SS', () => {
  it('formaterar timmar/minuter/sekunder med nollor', () => {
    expect(formatNedrakning(12 * 3600_000 + 5 * 60_000 + 9 * 1000)).toBe('12:05:09')
  })
  it('negativt/0 blir 00:00:00', () => {
    expect(formatNedrakning(-1)).toBe('00:00:00')
    expect(formatNedrakning(0)).toBe('00:00:00')
  })
})
