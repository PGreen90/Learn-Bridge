import { describe, expect, it } from 'vitest'
import {
  dailyDateFromNumber,
  dailyDeal,
  dailyDealByNumber,
  dailyNumber,
  dailySeed,
  dailyStreak,
  shareText,
} from './daily'

// Dagens giv (faceliften/konkurrensspåret 2026-08-02): samma datum ska ALLTID ge
// samma giv — det är hela poängen (alla spelar samma giv och kan jämföra sig).

describe('dagens giv', () => {
  it('samma datum ger exakt samma giv', () => {
    const a = dailyDeal(new Date(2026, 7, 2, 9, 0))
    const b = dailyDeal(new Date(2026, 7, 2, 23, 59)) // senare på samma dag
    expect(a.hands).toEqual(b.hands)
    expect(a.board).toBe(b.board)
    expect(a.dealer).toBe(b.dealer)
    expect(a.vulnerability).toBe(b.vulnerability)
    expect(a.id).toBe(b.id)
  })

  it('olika dagar ger olika givar', () => {
    const a = dailyDeal(new Date(2026, 7, 2))
    const b = dailyDeal(new Date(2026, 7, 3))
    expect(a.hands).not.toEqual(b.hands)
  })

  it('fröet är datumet som åttasiffrigt tal (lokal tid)', () => {
    expect(dailySeed(new Date(2026, 7, 2))).toBe(20260802)
    expect(dailySeed(new Date(2026, 0, 15))).toBe(20260115)
  })

  it('givnumret räknas från premiärdagen 2026-08-02 = #1', () => {
    expect(dailyNumber(new Date(2026, 7, 2))).toBe(1)
    expect(dailyNumber(new Date(2026, 7, 3, 8, 30))).toBe(2)
    expect(dailyNumber(new Date(2026, 8, 1))).toBe(31)
  })

  it('en giv har 13 kort per hand', () => {
    const deal = dailyDeal(new Date(2026, 7, 2))
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      expect(deal.hands[seat]).toHaveLength(13)
    }
  })

  // Kalenderarkivet (granskningsputsen 2026-08-03): varje giv ska gå att nå i
  // efterhand via sitt löpnummer — samma giv som alla fick den dagen.
  it('arkivet: löpnumret pekar ut exakt den dagens giv', () => {
    // #1 = premiärdagen 2026-08-02; #31 = 2026-09-01 (månadsskiftet räknas rätt).
    expect(dailyDateFromNumber(1)).toEqual(new Date(2026, 7, 2))
    expect(dailyDateFromNumber(31)).toEqual(new Date(2026, 8, 1))
    // Numret och datumet är varandras motsatser.
    expect(dailyNumber(dailyDateFromNumber(200))).toBe(200)
    // Given ur numret = given ur datumet, med samma id.
    const viaNumber = dailyDealByNumber(2)
    const viaDate = dailyDeal(new Date(2026, 7, 3))
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
