// FACIT-TEST för fel färg-spåret FIX 6 (docs/systemrevisorn.md): fyra mönster
// ur mönsterjakten i de 130 kvarvarande fel färg-givarna (Mätning #7).
//
// Systemrevisorns frön (frö 20260721-serien):
//  - 20261090/20261409/20261459 ("5♣-utgångsblåsen mot passad partner"):
//    negativ-dubblaren höjde öppnarens OHÖJDA 1♣ till 5♣ på 13–16 stödpoäng —
//    fast öppnaren just PASSAT i konkurrensen (= minimum, inget utgångsintresse).
//    Fix: partnerns färska pass kapar höjningen till billigaste (tävlande).
//  - 20261112 ("höjning läses som ny färg"): svararens 4♥ i en färg ÖPPNAREN
//    redan bjudit (1♦–1♠–2♣–2♦–2♥–4♥) tolkades som "ny färg = rondkrav" →
//    öppnaren tvingades rebjuda 5♦ ÖVER partnerns utgång (bet, fast 4♥ = par).
//    Fix: en färg vår sida redan bjudit är en HÖJNING; utgång skapar inget
//    rondkrav.
//  - 20261375 ("tävlar över deras utgång"): öppnaren "tävlade" 5♥ (6-korts
//    färg, partnern hade passat på 5 hp) över deras 4♠ → sex stick, −500.
//    Fix: återöppnings-/tävlingsbudet efter partnerns pass går aldrig över
//    deras utgång.
//  - 20260906 ("cue-höjaren blåser 5m på limit-värden"): cue-höjningen lovar
//    "limithöjning ELLER BÄTTRE" — med bara limit (11–12) ska cue-bjudaren få
//    passa öppnarens minimum-återgång (3♦) i stället för att tvingas till 5♦.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'
import { decideCall } from './auction-live'

function deal(
  id: string,
  dealer: Deal['dealer'],
  vulnerability: Deal['vulnerability'],
  hands: Record<'N' | 'E' | 'S' | 'W', string>,
): Deal {
  return {
    id,
    board: 1,
    dealer,
    vulnerability,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

// ---- Mönster 1: 5♣-utgångsblåsen mot passad partner ------------------------

// Frö 20261090: N öppnar 1♣, E kliver in 1♥, S negativ-dubblar, W 1♠, N+E pass.
// S (10 hp, 4-korts klöverfit, 13 sp) ska TÄVLA billigt (2♣), inte blåsa 5♣.
const HANDS_1090 = {
  N: 'S:A54 H:K753 D:J83 C:A84',
  E: 'S:KJ H:AJT86 D:T76 C:J53',
  S: 'S:Q986 H:9 D:AQ52 C:QT62',
  W: 'S:T732 H:Q42 D:K94 C:K97',
}
const HISTORY_1090: ResolvedCall[] = [
  call('N', '1C'), call('E', '1H'), call('S', 'X'), call('W', '1S'),
  call('N', 'P'), call('E', 'P'),
]

// Frö 20261459: N öppnar 1♣, E 1♥, S X, W höjer 2♥, N+E pass. S (16 sp) ska
// ändå inte blåsa 5♣ mot en passad öppnare — billigaste klöverhöjning (3♣).
const HANDS_1459 = {
  N: 'S:T82 H:T532 D:AQ7 C:AKT',
  E: 'S:4 H:AQ864 D:K852 C:854',
  S: 'S:KQJ93 H:- D:J96 C:Q9632',
  W: 'S:A765 H:KJ97 D:T43 C:J7',
}
const HISTORY_1459: ResolvedCall[] = [
  call('W', 'P'), call('N', '1C'), call('E', '1H'), call('S', 'X'),
  call('W', '2H'), call('N', 'P'), call('E', 'P'),
]

// ---- Mönster 2: höjning läses som ny färg (rondkrav över utgång) -----------

// Frö 20261112: 1♦–1♠–2♣–2♦–2♥–4♥ (ostört). N får INTE dra partnerns 4♥ till 5♦.
const HANDS_1112 = {
  N: 'S:- H:AQT8 D:J9764 C:KQ93',
  E: 'S:KQT4 H:KJ3 D:Q85 C:T74',
  S: 'S:A9765 H:6542 D:KT C:A5',
  W: 'S:J832 H:97 D:A32 C:J862',
}
const HISTORY_1112: ResolvedCall[] = [
  call('N', '1D'), call('E', 'P'), call('S', '1S'), call('W', 'P'),
  call('N', '2C'), call('E', 'P'), call('S', '2D'), call('W', 'P'),
  call('N', '2H'), call('E', 'P'), call('S', '4H'), call('W', 'P'),
]

// ---- Mönster 3: tävla aldrig över deras utgång ------------------------------

// Frö 20261375: S öppnade 1♥ (partnern N passade på 5 hp), E balanserade 1♠,
// W lyfte till 4♠. S (6-korts hjärter) ska INTE "tävla" 5♥ över deras utgång.
const HANDS_1375 = {
  N: 'S:K32 H:J D:J98432 C:642',
  E: 'S:Q9875 H:Q97 D:5 C:A875',
  S: 'S:6 H:K85432 D:AK7 C:KQ3',
  W: 'S:AJT4 H:AT6 D:QT6 C:JT9',
}
const HISTORY_1375: ResolvedCall[] = [
  call('E', 'P'), call('S', '1H'), call('W', 'P'), call('N', 'P'),
  call('E', '1S'), call('S', 'P'), call('W', '4S'), call('N', 'P'), call('E', 'P'),
]

// ---- Mönster 4: cue-höjaren med limit-värden passar minimum-återgången -----

// Frö 20260906: N öppnar 1♦, E 1♠, S cue-höjer 2♠ (limit+, 11 hp), N återgår
// 3♦ (minimum). S ska PASSA (limit mot minimum), inte blåsa 5♦.
const HANDS_906 = {
  N: 'S:542 H:AT3 D:AK854 C:86',
  E: 'S:AKQ63 H:754 D:T93 C:T3',
  S: 'S:JT H:QJ9 D:Q72 C:AJ942',
  W: 'S:987 H:K862 D:J6 C:KQ75',
}
const HISTORY_906: ResolvedCall[] = [
  call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '1D'),
  call('E', '1S'), call('S', '2S'), call('W', 'P'), call('N', '3D'), call('E', 'P'),
]

describe('mönster 1: höjning mot partner som just passat kapas till tävlande nivå', () => {
  it('frö 20261090-läget: S tävlar 2♣, blåser inte 5♣', () => {
    const d = deal('felfarg-20261090-pos', 'N', 'none', HANDS_1090)
    expect(decideCall(d, HISTORY_1090, 'S').bid).toBe('2C')
  })

  it('frö 20261459-läget: S tävlar 3♣ (billigast över 2♥), även med 16 sp', () => {
    const d = deal('felfarg-20261459-pos', 'W', 'all', HANDS_1459)
    expect(decideCall(d, HISTORY_1459, 'S').bid).toBe('3C')
  })
})

describe('mönster 2: svararens bud i öppnarens färg är en höjning, inte ett rondkrav', () => {
  it('frö 20261112-läget: N passar partnerns 4♥ (rycker inte till 5♦)', () => {
    const d = deal('felfarg-20261112-pos', 'N', 'all', HANDS_1112)
    expect(decideCall(d, HISTORY_1112, 'N').bid).toBe('P')
  })

  it('frö 20261112 hela auktionen: 4♥ står (= par 620)', () => {
    const d = deal('felfarg-20261112', 'N', 'all', HANDS_1112)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 4, strain: 'hearts' })
  })
})

describe('mönster 3: öppnaren tävlar inte över deras utgång efter partnerns pass', () => {
  it('frö 20261375-läget: S passar deras 4♠ (bjuder inte 5♥ på 6-1)', () => {
    const d = deal('felfarg-20261375-pos', 'E', 'ns', HANDS_1375)
    expect(decideCall(d, HISTORY_1375, 'S').bid).toBe('P')
  })
})

describe('mönster 4: cue-höjaren med bara limit-värden passar minimum-återgången', () => {
  it('frö 20260906-läget: S (11 hp) passar 3♦, blåser inte 5♦', () => {
    const d = deal('felfarg-20260906-pos', 'E', 'all', HANDS_906)
    expect(decideCall(d, HISTORY_906, 'S').bid).toBe('P')
  })

  it('med äkta utgångsvärden (14 hp) driver cue-bjudaren fortfarande', () => {
    // Samma läge men S:s hand starkare: kravet står, minimum-återgången passas inte.
    const d = deal('cue-limit-stark', 'E', 'all', {
      ...HANDS_906,
      S: 'S:JT H:AQ9 D:KQ72 C:AJ94',
    })
    expect(decideCall(d, HISTORY_906, 'S').bid).not.toBe('P')
  })
})

describe('hela auktionen (Systemrevisorns frön, motorn bjuder alla fyra)', () => {
  it('frö 20261090: klöverdelkontrakt (max 3♣), inte 5♣ bet', () => {
    const d = deal('felfarg-20261090', 'N', 'none', HANDS_1090)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('clubs')
    expect(contract!.level).toBeLessThanOrEqual(3)
  })

  it('frö 20261375: given dör i deras spaderkontrakt — N/S offrar inte 5♥', () => {
    const d = deal('felfarg-20261375', 'E', 'ns', HANDS_1375)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('spades')
  })

  it('frö 20260906: ruterdelkontrakt på 3-läget, inte 5♦ bet', () => {
    const d = deal('felfarg-20260906', 'E', 'all', HANDS_906)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 3, strain: 'diamonds', declarer: 'N' })
  })
})
