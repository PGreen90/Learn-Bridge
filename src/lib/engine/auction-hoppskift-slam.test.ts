// FACIT-TEST för ETAPP 4 (F1 familj C-resten), se docs/systemrevisorn.md.
//
// DEL 1 — semi-forcing-hoppskiftets fortsättning (`rebid: hoppskift`, visade
// 16+): svararen svarade med en 3M-PREFERENS UNDER UTGÅNG som öppnaren sedan
// passade (kravet dog), och fit i själva hoppskiftsfärgen kollades aldrig.
//
// Systemrevisorns frön (frö 20260721-serien, M11/M13):
//  - 20260799: `1♠–1NT–3♥–3♠–P` — W har K942 i hjärter (4-korts fit i
//    hoppskiftets färg!) men prefererade 3♠ som E passade. 4♥ fanns (tapp 1200).
//  - 20260765: `1♠–1NT–3♥–3NT–P` — N har AJ974 (5-korts hjärterfit) men valde
//    3NT. 4♥ ger 13 stick på DD (tapp 1050).
//  - 20261334: `1♥–1NT–3♦–3NT–P` — E har KJ982 (5-korts ruterfit) utan
//    spaderstopp men valde 3NT. Ruterfiten ska sättas.
//
// Facit: svararen värderar STÖDPOÄNG mot hoppskiftet — med 4+ i hoppskiftets
// färg och ~8+ stödpoäng sätts UTGÅNGEN i fiten (4M; minor: 3NT bara med håll
// i de objudna färgerna, annars 5m); 3-korts M-preferens med utgångsvärden
// lyfts till 4M. Svaga händer behåller dagens billiga preferens.
//
// DEL 2 — slamport efter 1-lägessvarens hoppskift (19+) och reverse (16+):
// svararen är obegränsad, så kaptensmatten (egen hand + visat minimum) kan nå
// slamzonen: driv 33+ (4NT RKC), inbjudan 31–32, annars dagens flöde.
// Syntetiska givar (DD-verifierade: slammen står).

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

// ---- Frö 20260799: 1♠–1NT–3♥ och svararen W har K942 i hjärter -------------

const HANDS_799 = {
  N: 'S:T2 H:Q6 D:T6542 C:Q953',
  E: 'S:AKJ43 H:AJ73 D:9 C:A64',
  S: 'S:Q85 H:T85 D:Q873 C:KJ8',
  W: 'S:976 H:K942 D:AKJ C:T72',
}
const HISTORY_799: ResolvedCall[] = [
  call('E', '1S'), call('S', 'P'), call('W', '1NT'), call('N', 'P'),
  call('E', '3H'), call('S', 'P'),
]

// ---- Frö 20260765: 1♠–1NT–3♥ och svararen N har AJ974 i hjärter ------------

const HANDS_765 = {
  N: 'S:8 H:AJ974 D:9532 C:AT2',
  E: 'S:QJ953 H:82 D:Q7 C:K876',
  S: 'S:AK764 H:KT63 D:AKJ C:5',
  W: 'S:T2 H:Q5 D:T864 C:QJ943',
}
const HISTORY_765: ResolvedCall[] = [
  call('E', 'P'), call('S', '1S'), call('W', 'P'), call('N', '1NT'),
  call('E', 'P'), call('S', '3H'), call('W', 'P'),
]

// ---- Frö 20261334: 1♥–1NT–3♦ och svararen E har KJ982 i ruter --------------

const HANDS_1334 = {
  N: 'S:KJ93 H:T753 D:T65 C:Q9',
  E: 'S:Q2 H:84 D:KJ982 C:AJ64',
  S: 'S:T875 H:92 D:Q C:KT7532',
  W: 'S:A64 H:AKQJ6 D:A743 C:8',
}
const HISTORY_1334: ResolvedCall[] = [
  call('E', 'P'), call('S', 'P'), call('W', '1H'), call('N', 'P'),
  call('E', '1NT'), call('S', 'P'), call('W', '3D'), call('N', 'P'),
]

describe('familj C del 1: semi-forcing-hoppskiftets fortsättning', () => {
  it('frö 20260799-läget: W höjer hoppskiftets hjärter till utgång (4♥)', () => {
    const d = deal('cslam-20260799-pos', 'E', 'all', HANDS_799)
    expect(decideCall(d, HISTORY_799, 'W').bid).toBe('4H')
  })

  it('frö 20260799 hela auktionen: utgång nås (aldrig pass under utgång)', () => {
    const d = deal('cslam-20260799', 'E', 'all', HANDS_799)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(4)
  })

  it('frö 20260765-läget: N sätter 5-korts hjärterfiten (4♥), inte 3NT', () => {
    const d = deal('cslam-20260765-pos', 'E', 'none', HANDS_765)
    expect(decideCall(d, HISTORY_765, 'N').bid).toBe('4H')
  })

  it('frö 20260765 hela auktionen: hjärterutgång nås', () => {
    const d = deal('cslam-20260765', 'E', 'none', HANDS_765)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ strain: 'hearts' })
  })

  it('frö 20261334-läget: E sätter ruterfiten (5♦ — inget spaderstopp för 3NT)', () => {
    const d = deal('cslam-20261334-pos', 'E', 'none', HANDS_1334)
    expect(decideCall(d, HISTORY_1334, 'E').bid).toBe('5D')
  })

  it('frö 20261334 hela auktionen: ruterkontrakt, inte 3NT', () => {
    const d = deal('cslam-20261334', 'E', 'none', HANDS_1334)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ strain: 'diamonds' })
  })
})

// ---- DEL 2: slamport efter 1-lägessvarens hoppskift (19+) / reverse (16+) ---

// Syntetisk hoppskift-driv: S öppnar 1♦ (19 hp, 5-4), hoppskiftar 3♣.
// N (13 hp + singel = 16 stödpoäng med 4-korts klöverfit) räknar 16 + visade
// 19 = 35 → driv 4NT RKC → 6♣ (DD-verifierad).
const HANDS_HOPP_DRIVE = {
  N: 'S:KQJ74 H:A42 D:5 C:K852',
  E: 'S:A98 H:QJT9 D:T98 C:JT6',
  S: 'S:32 H:K5 D:AKQJ4 C:AQ74',
  W: 'S:T65 H:8763 D:7632 C:93',
}
const HISTORY_HOPP: ResolvedCall[] = [
  call('S', '1D'), call('W', 'P'), call('N', '1S'), call('E', 'P'),
  call('S', '3C'), call('W', 'P'),
]

// Syntetisk reverse-inbjudan: S öppnar 1♣ (18 hp — under 2♣-zonen), reverse
// 2♦ (visade 16+). N (14 hp + dubbelton = 15 stödpoäng med 3-korts
// klöverstöd) räknar 15 + 16 = 31 → slaminbjudan 4♣; S accepterar på egna
// Bergenpoäng (mer än blott 16) → 6♣.
const HANDS_REV_INVIT = {
  N: 'S:K43 H:AQJ76 D:52 C:A83',
  E: 'S:QJT9 H:T98 D:JT93 C:KJ',
  S: 'S:A2 H:K5 D:AKQ4 C:Q7642',
  W: 'S:8765 H:432 D:876 C:T95',
}
const HISTORY_REV: ResolvedCall[] = [
  call('S', '1C'), call('W', 'P'), call('N', '1H'), call('E', 'P'),
  call('S', '2D'), call('W', 'P'),
]

describe('familj C del 2: slamport efter hoppskift/reverse på 1-lägessvar', () => {
  it('hoppskift-driv: N (16 stödp. mot visade 19) frågar 4NT', () => {
    const d = deal('cslam-hopp-drive-pos', 'S', 'none', HANDS_HOPP_DRIVE)
    expect(decideCall(d, HISTORY_HOPP, 'N').bid).toBe('4NT')
  })

  it('hoppskift-driv hela auktionen: 6♣ nås', () => {
    const d = deal('cslam-hopp-drive', 'S', 'none', HANDS_HOPP_DRIVE)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'clubs' })
  })

  it('reverse-inbjudan: N (15 stödp. mot visade 16) bjuder in med 4♣', () => {
    const d = deal('cslam-rev-invit-pos', 'S', 'none', HANDS_REV_INVIT)
    expect(decideCall(d, HISTORY_REV, 'N').bid).toBe('4C')
  })

  it('reverse-inbjudan hela auktionen: S accepterar → 6♣', () => {
    const d = deal('cslam-rev-invit', 'S', 'none', HANDS_REV_INVIT)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'clubs' })
  })
})
