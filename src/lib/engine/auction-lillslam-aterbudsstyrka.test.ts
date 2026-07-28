// FACIT-TEST för ETAPP 7 hål 1 (missad lillslam): ÖPPNARENS SUUTREBID SA
// "MINIMUM" MED EXTRA STYRKA.
//
// Förskanningen (docs/systemrevisorn.md "ETAPP 7 FÖRSKANNAD") hittade fyra
// givar där öppnaren rebjöd sin 6-korts färg billigast och beskrev sig som
// "minimum 12–15" — varpå svararen helt korrekt passade eller nöjde sig med en
// inbjudan. Två skilda rötter i SAMMA regel (`openerRebidAfter1LevelResponse`
// steg 5, rebids.ts):
//
//  1. INGEN RUNG FÖR 19+. Stegen var `p >= 16 && p <= 18 → 3m` och därefter
//     "minimum". En 19+-hand föll alltså igenom TAKET och landade i
//     minimibudet. Frö 20261020: 20 hp / 23 TP rebjöd 2♣ märkt "minimum
//     12–15", svararen passade med 10 hp — 6NT fanns (tapp 820).
//     Systerfunktionen `openerRebidAfterSemiForcing1NT` hade rungen hela tiden
//     (19+ → 4M), så det var ett rent glapp mellan två närbesläktade stegar.
//
//  2. STEGET RÄKNADE RÅ HP, INTE TP. Grannreglerna i samma funktion (reverse
//     steg 3, hoppskift steg 4b) väger med `pointsWithFloor(..., 'starting')`
//     — bara suutrebidet räknade `hcp`. En 15 hp-hand med 18–19 TP (6-korts
//     färg = längdpoäng) kallade sig därför minimum. Frö 20261279 (15 hp /
//     19 TP), 20261661 (15/18) och 20261136 (15/18).
//     Låst regel (CLAUDE.md): TP får aldrig NEDGRADERA, bara uppgradera —
//     `pointsWithFloor` golvar vid hp, så en platt 15:a påverkas inte.

import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { openerRebidAfter1LevelResponse } from './rebids'
import { hcp } from './hand'
import { startingPoints } from './evaluation'

const reb = (n: string, opened: 'clubs' | 'diamonds' | 'hearts' | 'spades', resp: 'clubs' | 'diamonds' | 'hearts' | 'spades') =>
  openerRebidAfter1LevelResponse(parseHand(n), opened, resp)

describe('etapp 7 hål 1 – suutrebidet får inte säga "minimum" med extra styrka', () => {
  // ---- Rot 1: taket saknades, 19+ föll ned i minimibudet -------------------
  it('frö 20261020: 20 hp / 23 TP med 6-korts klöver rebjuder inte 2♣ som minimum', () => {
    const hand = 'S:K H:AK3 D:AT5 C:AQT843'
    expect(hcp(parseHand(hand))).toBe(20)
    const res = reb(hand, 'clubs', 'hearts')
    expect(res.call).not.toBe('2C')
    expect(res.explanation).not.toMatch(/minimum/i)
    expect(res.call).toBe('3C')
  })

  it('19+ med 6-korts HÖGFÄRG sätter utgången (samma rung som efter semi-forcing 1NT)', () => {
    const res = reb('S:A3 H:AKQJ742 D:KQ2 C:4', 'hearts', 'spades')
    expect(res.call).toBe('4H')
    expect(res.explanation).not.toMatch(/minimum/i)
  })

  // ---- Rot 2: stegen räknade rå hp, inte TP -------------------------------
  it('frö 20261279: 15 hp men 19 TP (6-korts ruter) hoppar 3♦ i stället för 2♦', () => {
    const hand = 'S:AT2 H:AJ7 D:AQT743 C:6'
    expect(hcp(parseHand(hand))).toBe(15)
    expect(startingPoints(parseHand(hand)).startingPoints).toBeGreaterThanOrEqual(16)
    const res = reb(hand, 'diamonds', 'hearts')
    expect(res.call).toBe('3D')
    expect(res.explanation).not.toMatch(/minimum/i)
  })

  it('frö 20261661: 15 hp / 18 TP med AKT985 i klöver hoppar 3♣', () => {
    expect(reb('S:T5 H:A62 D:A5 C:AKT985', 'clubs', 'spades').call).toBe('3C')
  })

  it('frö 20261136: 15 hp / 18 TP med AQT983 i klöver hoppar 3♣', () => {
    expect(reb('S:JT2 H:A5 D:AT C:AQT983', 'clubs', 'spades').call).toBe('3C')
  })

  // ---- Gränsvakter: ett ÄKTA minimum ska fortfarande säga minimum ---------
  it('äkta minimum (12 hp, platt värdering) rebjuder 2♥ och SÄGER minimum', () => {
    const res = reb('S:3 H:AQ8742 D:K52 C:K42', 'hearts', 'spades')
    expect(res.call).toBe('2H')
    expect(res.explanation).toMatch(/minimum/i)
  })

  it('TP får aldrig NEDGRADERA: en platt 16:a hoppar fortfarande', () => {
    const res = reb('S:A3 H:AQJ742 D:KQ2 C:42', 'hearts', 'spades')
    expect(res.call).toBe('3H')
  })
})
