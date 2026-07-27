// FACIT-TEST för etapp 6 hål 2 (billig offring, docs/systemrevisorn.md
// "Etapp 6 FÖRSKANNAD", 2026-07-25): SVARET PÅ UPPLYSNINGSDUBBLINGEN
// FÖRSVINNER NÄR MOTSTÅNDAREN BJUDER ÖVER.
//
// Rot: `takeoutDoubleToAnswer` (auction-live.ts) kräver att partnerns X är
// auktionens SENASTE icke-pass. Höjer motståndaren (1♣–X–2♣) eller redubblar
// (2♠–X–XX) försvinner svarsplikten — och det fanns ingen FRI svarsväg, så
// advancern teg med allt från 7 till 14 hp och motståndarna köpte kontraktet
// billigt.
//
// Givarna är Systemrevisorns frön ur posten (baslinjefrö 20260721):
// 20260759, 20260811, 20260934, 20261519, 20261521. Målkontrakten är
// DD-verifierade (dd-tabell-proben) OCH systemriktiga — advancern bjuder på
// egen hand + partnerns visade upplysningsdubbling, aldrig på facit.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'

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

function finalOf(d: Deal) {
  const history = botAuction(d)
  expect(history).not.toBeNull()
  return { contract: contractFromCalls(history!), bids: history!.map((c) => c.bid) }
}

describe('advancern svarar när de bjuder över upplysningsdubblingen (etapp 6 hål 2)', () => {
  it('frö 20261519: (1♣)–X–(2♣) → advancern (15 hp) cue-bjuder 3♣; dubblaren visar högfärgen och utgången nås', () => {
    const d = deal('offring-20261519', 'S', 'ew', {
      N: 'S:T8 H:Q74 D:K9652 C:T63',
      E: 'S:K52 H:A65 D:AQJ74 C:J8',
      S: 'S:Q764 H:KT8 D:- C:KQ9542',
      W: 'S:AJ93 H:J932 D:T83 C:A7',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3C')
    expect(bids).toContain('3H')
    // 4♥ går en DD-bet — ärligt bjuden utgång på 25 hp ihop; par-3NT:n kräver
    // stopp-kunskap som ärlig budgivning inte når (högfärgen först, felrapport #11).
    expect(contract).toMatchObject({ level: 4, strain: 'hearts' })
  })

  it('frö 20261521: (1♣)–X–(2♣) → advancern (7 hp, 5 hjärter) bjuder 2♥ fritt — hjärterdelkontrakt för Ö/V', () => {
    const d = deal('offring-20261521', 'S', 'ns', {
      N: 'S:K43 H:4 D:T954 C:K8732',
      E: 'S:52 H:A9753 D:QJ62 C:J6',
      S: 'S:AJ76 H:J82 D:87 C:AQ94',
      W: 'S:QT98 H:KQT6 D:AK3 C:T5',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('2H')
    expect(contract?.strain).toBe('hearts')
    expect([2, 3]).toContain(contract?.level)
  })

  it('frö 20260759: (1♣)–X–(2♣) → advancern (9 hp, 5 spader) hoppar 3♠ (inbjudan) — spaderdelkontrakt för Ö/V', () => {
    const d = deal('offring-20260759', 'E', 'ew', {
      N: 'S:Q8 H:A984 D:7652 C:T63',
      E: 'S:J9743 H:K76 D:T3 C:AJ9',
      S: 'S:AT H:T3 D:QJ98 C:KQ872',
      W: 'S:K652 H:QJ52 D:AK4 C:54',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3S')
    expect(contract?.strain).toBe('spades')
    expect(contract?.level).toBe(3)
  })

  it('frö 20260811: (2♦)–X–(3♦) → advancern med 6-5 i högfärgerna bjuder 3♠ på formen, dubblaren (19 hp) lyfter till 4♠', () => {
    const d = deal('offring-20260811', 'N', 'ns', {
      N: 'S:T98762 H:KT854 D:8 C:3',
      E: 'S:Q4 H:J3 D:A97532 C:Q92',
      S: 'S:AKJ H:A762 D:K6 C:AJ75',
      W: 'S:53 H:Q9 D:QJT4 C:KT864',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3S')
    expect(contract).toMatchObject({ level: 4, strain: 'spades' })
  })

  it('frö 20260934: (2♠)–X–(XX) → advancern flyr ALLTID redubblingen (3♥); flykten lovar inga poäng, så när de pressar 3♠ försvarar vi', () => {
    const d = deal('offring-20260934', 'E', 'all', {
      N: 'S:73 H:JT53 D:764 C:AK82',
      E: 'S:KJT854 H:Q74 D:85 C:T5',
      S: 'S:62 H:K96 D:AKQJ2 C:J76',
      W: 'S:AQ9 H:A82 D:T93 C:Q943',
    })
    const { contract, bids } = finalOf(d)
    expect(bids).toContain('3H')
    // Deras 3♠ (spärrhöjning) får stå — DD säger två bet; att blasta 4♥ på en
    // flykt som lovar 0 hp vore kik, inte bridge.
    expect(contract).toMatchObject({ level: 3, strain: 'spades' })
  })
})
