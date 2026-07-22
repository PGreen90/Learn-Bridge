// FACIT-TEST för fel färg-spåret FIX 5b (docs/systemrevisorn.md, buggfamilj 4,
// exponerad lucka #2): NEGATIV-DUBBLARENS INVIT-FORTSÄTTNING saknades —
// 10–12-handen passade öppnarens (tvingade) färgsvar och delkontraktet stod
// kvar fast utgång/bättre delkontrakt fanns.
//
// Systemrevisorns frön (baslinjen, frö 20260721):
//  - 20261354: 1♠–(2♥)–X–P–2♠–P–**P** — dubblaren (E, 10 hp, 5-korts ruter)
//    passade öppnarens minimum-rebud. Par 5♦-EW 600. Fix: dubblaren bjuder sin
//    egen 5+ färg billigast (3♦, invit) — öppnaren (15 hp, 4-korts stöd) höjer.
//  - 20261179: 1♠–(2♣)–X–P–2♦–P–**P** — dubblaren (W, 9 hp, SEX hjärter)
//    passade det tvingade 2♦-svaret; 2♦ gick bet fast hjärtern bär (par 4♥-EW).
//    Fix: 9 hp med 6-korts färg räcker för att rebjuda den (2♥, ej krav).
//  - 20261139: 1♥–(2♣)–X–P–2♦–P–**2♠** — dubblaren (W, 12 hp) bjöd en 4-korts
//    NY färg på 2-läget fast hen hade 3-korts stöd för partnerns ÖPPNADE
//    hjärter (par 5♥-EW). Fix: invit-preferens till öppningsfärgen (3♥) går
//    före en egen 4-korts färg.

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

// Frö 20261354: W öppnar 1♠, N kliver in 2♥, E negativ-dubblar (minorerna),
// W rebjuder 2♠ (minimum) — E ska fortsätta 3♦ (invit), inte passa.
const HANDS_1354 = {
  N: 'S:KJ32 H:KQJ983 D:- C:972',
  E: 'S:6 H:AT5 D:AT965 C:QT53',
  S: 'S:T74 H:762 D:KQ87 C:864',
  W: 'S:AQ985 H:4 D:J432 C:AKJ',
}
const HISTORY_1354: ResolvedCall[] = [
  call('W', '1S'), call('N', '2H'), call('E', 'X'), call('S', 'P'),
  call('W', '2S'), call('N', 'P'),
]

// Frö 20261179: E öppnar 1♠, S kliver in 2♣, W negativ-dubblar (4+ hjärter),
// E svarar tvingat 2♦ — W (9 hp, 6 hjärter) ska rebjuda 2♥, inte passa.
const HANDS_1179 = {
  N: 'S:A942 H:T4 D:Q8732 C:43',
  E: 'S:KT765 H:A D:A654 C:KT5',
  S: 'S:QJ H:K876 D:K9 C:Q9876',
  W: 'S:83 H:QJ9532 D:JT C:AJ2',
}
const HISTORY_1179: ResolvedCall[] = [
  call('E', '1S'), call('S', '2C'), call('W', 'X'), call('N', 'P'),
  call('E', '2D'), call('S', 'P'),
]

// Frö 20261139: E öppnar 1♥, S kliver in 2♣, W negativ-dubblar (4+ spader),
// E svarar tvingat 2♦ — W (12 hp, 3-korts hjärterstöd) ska invit-preferera 3♥.
const HANDS_1139 = {
  N: 'S:K876432 H:9 D:QJ7 C:J9',
  E: 'S:9 H:Q8643 D:AKT843 C:5',
  S: 'S:T H:KT52 D:9 C:AKQ6432',
  W: 'S:AQJ5 H:AJ7 D:652 C:T87',
}
const HISTORY_1139: ResolvedCall[] = [
  call('E', '1H'), call('S', '2C'), call('W', 'X'), call('N', 'P'),
  call('E', '2D'), call('S', 'P'),
]

describe('negativ-dubblarens invit-fortsättning (fix 5b)', () => {
  it('frö 20261354-läget: E (10 hp, 5-korts ruter) bjuder 3♦ över 2♠, passar inte', () => {
    const d = deal('felfarg-20261354-pos', 'W', 'ew', HANDS_1354)
    expect(decideCall(d, HISTORY_1354, 'E').bid).toBe('3D')
  })

  it('frö 20261179-läget: W (9 hp, 6-korts hjärter) rebjuder 2♥ över 2♦', () => {
    const d = deal('felfarg-20261179-pos', 'E', 'all', HANDS_1179)
    expect(decideCall(d, HISTORY_1179, 'W').bid).toBe('2H')
  })

  it('frö 20261139-läget: W (12 hp, 3-korts stöd) invit-prefererar 3♥, inte 2♠', () => {
    const d = deal('felfarg-20261139-pos', 'E', 'ew', HANDS_1139)
    expect(decideCall(d, HISTORY_1139, 'W').bid).toBe('3H')
  })

  it('jämn 10–12 med stopp och utan färg att visa → 2NT (invit)', () => {
    // Som 20261354-läget men E:s hand jämn: 11 hp, hjärterstopp, ingen 5-korts färg.
    const d = deal('negx-invit-2nt', 'W', 'ew', {
      ...HANDS_1354,
      E: 'S:64 H:KQ5 D:KJ73 C:Q432',
    })
    expect(decideCall(d, HISTORY_1354, 'E').bid).toBe('2NT')
  })

  it('svag dubblare (<9 hp) passar fortfarande öppnarens svar', () => {
    // Som 20261179-läget men W utan esset i klöver: 5 hp → pass som förr.
    const d = deal('negx-invit-svag', 'E', 'all', {
      ...HANDS_1179,
      W: 'S:83 H:QJ9532 D:JT C:J72',
    })
    expect(decideCall(d, HISTORY_1179, 'W').bid).toBe('P')
  })
})

describe('hela auktionen (Systemrevisorns frön, motorn bjuder alla fyra)', () => {
  it('frö 20261354: dubblarens 3♦ höjs av öppnaren — ruterkontrakt E/W, inte 2♠', () => {
    // Par 5♦-EW 600: öppnaren (15 hp + 4-korts ruterstöd + singel hjärter) har
    // utgångsvärden mot inviten.
    const d = deal('felfarg-20261354', 'W', 'ew', HANDS_1354)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('diamonds')
    expect(contract?.declarer).toBe('E')
    expect(contract!.level).toBeGreaterThanOrEqual(3)
  })

  it('frö 20261179: hjärtern spelas (2♥+ av W), inte 2♦ bet', () => {
    const d = deal('felfarg-20261179', 'E', 'all', HANDS_1179)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('hearts')
    expect(contract?.declarer).toBe('W')
  })

  it('frö 20261139: hjärterfiten hittas (3♥+ av E), inte 3♦', () => {
    const d = deal('felfarg-20261139', 'E', 'ew', HANDS_1139)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('hearts')
    expect(contract?.declarer).toBe('E')
    expect(contract!.level).toBeGreaterThanOrEqual(3)
  })
})
