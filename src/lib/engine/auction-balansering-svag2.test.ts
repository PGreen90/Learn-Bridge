// FACIT-TEST för fel färg-spåret FIX 5a (docs/systemrevisorn.md, buggfamilj 4,
// exponerad lucka #1): BALANSERING ÖVER DERAS SVAGA TVÅOR saknades — 2♥–P–P–P
// såldes billigt fast vår sida ägde given.
//
// Systemrevisorns frön (baslinjen, frö 20260721):
//  - 20260770: E öppnar svag 2♥, S/W passar — N (8 hp, 5-korts spader) satt i
//    UTPASSNINGSLÄGET men §7.6-balanseringen hade bara takeout-X (golv 10) och
//    naturligt inkliv från 10 hp → pass, given såld (2♥ hem, par 3♠-NS 140).
//    Fix: "låna en kung" även här — naturligt 2-lägesinkliv från 7 hp i
//    balansering. OCH: advancern (S, 14 stödpoäng) får inte blåsa 4♠ mot en
//    balansering som redan lånat kungen → rabatt −3 + tak på 3-läget.
//  - 20261342: E öppnar svag 2♥ — N (10 hp, jämn med 3 hackor i hjärter) hade
//    formen för takeout så när som på 3:e hjärtern (kravet var max 2) → pass,
//    given såld (par 2NT-NS 120). Fix: i balansering räcker ≤3 kort i deras
//    färg (offshape-X i utpassningsläget är standard).
//  - 20261248 (REGRESSIONSVAKT): E med 8 hp och takeout-form ska INTE
//    balansera (golvet 10 hp står kvar) — N/S:s 4♥-utgång är DD-smickrad
//    (max-svag-tvåa + markerade honnörer) och jagas inte.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'
import { defendWeakTwo } from './defense-conventional'

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

// Frö 20260770: E öppnar 2♥, N balanserar med 5-korts spader på 8 hp.
const HANDS_770 = {
  N: 'S:QT865 H:Q D:QT97 C:Q65',
  E: 'S:43 H:965432 D:KJ C:K84',
  S: 'S:AK72 H:AT87 D:6543 C:2',
  W: 'S:J9 H:KJ D:A82 C:AJT973',
}

// Frö 20261342: E öppnar 2♥, N balanserar med offshape-X (10 hp, 3 hjärter).
const HANDS_1342 = {
  N: 'S:A632 H:943 D:AQ7 C:642',
  E: 'S:T8 H:KJT865 D:32 C:QT3',
  S: 'S:QJ94 H:A72 D:K54 C:J97',
  W: 'S:K75 H:Q D:JT986 C:AK85',
}

// Frö 20261248: S öppnar 2♥ — E (8 hp) ska INTE balansera (golv 10 står kvar).
const HANDS_1248 = {
  N: 'S:T65 H:53 D:AQJ6 C:A983',
  E: 'S:AKJ8 H:86 D:T85 C:7654',
  S: 'S:92 H:AKJT74 D:732 C:JT',
  W: 'S:Q743 H:Q92 D:K94 C:KQ2',
}

describe('defendWeakTwo i balansering — "låna en kung" (fix 5a)', () => {
  it('naturligt 2-lägesinkliv från 7 hp i balansering (frö 20260770-handen)', () => {
    const hand = parseHand(HANDS_770.N) // 8 hp, 5-korts spader
    expect(defendWeakTwo(hand, 'hearts', 10, true).call).toBe('2S')
    // Direkt sits: oförändrat golv 10 → pass.
    expect(defendWeakTwo(hand, 'hearts', 12, false).call).toBe('P')
  })

  it('takeout-X i balansering tillåter 3 kort i deras färg (frö 20261342-handen)', () => {
    const hand = parseHand(HANDS_1342.N) // 10 hp, 4-3-3-3 med tre hackor i hjärter
    expect(defendWeakTwo(hand, 'hearts', 10, true).call).toBe('X')
    // Direkt sits: formkravet max 2 står kvar → pass.
    expect(defendWeakTwo(hand, 'hearts', 12, false).call).toBe('P')
  })

  it('takeout-golvet 10 hp står kvar i balansering (frö 20261248-handen)', () => {
    const hand = parseHand(HANDS_1248.E) // 8 hp med perfekt form
    expect(defendWeakTwo(hand, 'hearts', 10, true).call).toBe('P')
  })

  it('2NT i balansering = 12–15 med stopp (lånad kung från 15–18)', () => {
    const hand = parseHand('S:KQ4 H:KJ9 D:QT32 C:Q32') // 13 hp, jämn, hjärterstopp
    expect(defendWeakTwo(hand, 'hearts', 10, true).call).toBe('2NT')
    // Direkt sits: 13 < 15 → ingen sang (och ingen annan aktion) → pass.
    expect(defendWeakTwo(hand, 'hearts', 12, false).call).toBe('P')
  })
})

describe('hela auktionen (Systemrevisorns frön, motorn bjuder alla fyra)', () => {
  it('frö 20260770: N balanserar 2♠ och S höjer med rabatt — spaderkontrakt på max 3-läget', () => {
    // Par = 3♠-NS 140 (9 stick). Utan rabatten hade S (14 stödpoäng) blåst 4♠ bet;
    // mot en balansering som lånat kungen kapas höjningen vid 3-läget.
    const d = deal('felfarg-20260770', 'E', 'ew', HANDS_770)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('spades')
    expect(contract?.declarer).toBe('N')
    expect(contract!.level).toBeLessThanOrEqual(3)
  })

  it('frö 20261342: N balanserar X, S svarar i spader — given säljs inte till 2♥', () => {
    const d = deal('felfarg-20261342', 'E', 'ew', HANDS_1342)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('spades')
    expect(['N', 'S']).toContain(contract?.declarer)
  })

  it('frö 20261248 (regressionsvakt): E med 8 hp balanserar INTE — 2♥ står', () => {
    const d = deal('felfarg-20261248-vakt', 'S', 'ns', HANDS_1248)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 2, strain: 'hearts', declarer: 'S' })
  })
})
