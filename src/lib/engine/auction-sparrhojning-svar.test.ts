// FACIT-TEST för etapp 6 hål 4 (billig offring, docs/systemrevisorn.md
// "Etapp 6 FÖRSKANNAD", 2026-07-25): DERAS SPÄRRBUD STÄNGER AUKTIONEN.
//
// Rot: `maybeOvercall` (auction-live.ts) kräver 1-lägesöppning + exakt ETT
// kontraktsbud i historiken, och §7.6-försvaret modelleras bara direkt över
// själva öppningen. Så fort motståndarna hann bjuda öppning + höjning
// (2♠–P–3♠ eller 1♣–P–3♣) fanns ingen väg in alls — en 21-poängare (frö
// 20261477) och en 18-poängare (frö 20261449) passade ut deras spärrhöjning.
//
// Ägarbeslut 2026-07-28 (+ justeringar efter Mätning #18):
//  - över deras höjda spärr gäller spärrfönstren (defendPreempt): X 14+,
//    färg 13–16, plus "sälj aldrig given"-X:et med 17+ (som hål 3 gav
//    defendWeakTwo). 3NT till spel kräver 19 direkt / 16 i balansering —
//    samma som mot en svag tvåa (M18: 16 direkt stod på Kx och gick djupt
//    bet, frö 20261045 — X:et tar över där och landar på par),
//  - balanseringssitsen lånar en kung på X (11+) och färg (10+), off-shape-X
//    ok — men BARA på 3-läget (M18: rabatten mot en 4-lägesöppning köpte en
//    dyr uppoffring, frö 20261533),
//  - tvingas advancern svara på 3-läget+ väljs den HONNÖRSSTARKARE färgen på
//    lika längd (M18: 4♥ på J982 gick två bet när 4♣ på A832 stod, frö
//    20261680),
//  - tunna fördelningsutgångar (6♣ på 19 hp, frö 20260858) JAGAS INTE —
//    hellre systemriktig miss än gambling; golven lämnar dem medvetet tysta.
//
// Målkontrakten är DD-verifierade (dd-tabell-proben, revisor-output/dd-tabell.txt):
// 20261449 ♣ 11 stick ÖV · 20261477 ♣ 10 stick ÖV · 20260729 ♥ 10 stick NS ·
// 20261680 ♣ 11 stick NS · 20261045 ♠ 9 stick NS (= par).

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
  return { contract: contractFromCalls(history!), history: history! }
}

describe('försvaret mot deras höjda spärr (etapp 6 hål 4)', () => {
  it('frö 20261449: 2♥–P–3♥ → 18 hp med kort hjärter dubblar (upplysning) och ÖV når klöverutgången', () => {
    const d = deal('offring-20261449', 'S', 'ns', {
      N: 'S:62 H:QJ7 D:AT642 C:765',
      E: 'S:AQT54 H:K D:K98 C:AQT4',
      S: 'S:J83 H:A95432 D:Q75 C:J',
      W: 'S:K97 H:T86 D:J3 C:K9832',
    })
    const { contract, history } = finalOf(d)
    expect(history.map((c) => c.bid)).toContain('X')
    // X → W:s tvingade 4♣ → E höjer till 5♣ (18 hp + AQT4-stöd, 23 stödpoäng).
    // DD: 11 klöverstick ÖV → 5♣ jämnt hem (400 ≈ par 450).
    expect(contract).toMatchObject({ level: 5, strain: 'clubs' })
    expect(['E', 'W']).toContain(contract!.declarer)
  })

  it('frö 20261477: 2♦–P–3♦ → 21-poängaren tiger inte (X, "sälj aldrig given")', () => {
    const d = deal('offring-20261477', 'N', 'none', {
      N: 'S:J932 H:Q8 D:KJ9642 C:K',
      E: 'S:T7654 H:754 D:Q7 C:876',
      S: 'S:Q8 H:JT63 D:A83 C:9543',
      W: 'S:AK H:AK92 D:T5 C:AQJT2',
    })
    const { history } = finalOf(d)
    // Väst har 21 hp (2-4-2-5): för stark för naturligt inkliv (tak 16),
    // fel form för takeout — 17+-utloppet dubblar hellre än säljer given.
    expect(history.filter((c) => c.seat === 'W').map((c) => c.bid)).toContain('X')
  })

  it('frö 20261680: 2♠–P–3♠ → 16 hp med singelspader dubblar (upplysning), NS tar över', () => {
    const d = deal('offring-20261680', 'W', 'all', {
      N: 'S:J9 H:J982 D:T93 C:A832',
      E: 'S:QT72 H:KT54 D:Q4 C:T64',
      S: 'S:4 H:A73 D:AKJ82 C:KJ75',
      W: 'S:AK8653 H:Q6 D:765 C:Q9',
    })
    const { contract, history } = finalOf(d)
    expect(history.filter((c) => c.seat === 'S').map((c) => c.bid)).toContain('X')
    // Nords tvingade svar väljer honnörsstarkare 4♣ (A832) före 4♥ (J982) på
    // 4-4 — DD: 11 klöverstick NS mot 8 hjärterstick.
    expect(contract).toMatchObject({ strain: 'clubs' })
    expect(['N', 'S']).toContain(contract!.declarer)
  })

  it('frö 20261045: 2♥–P–3♥ → 16 hp balanserad med Kx-håll dubblar (inte 3NT) och NS landar i 3♠ = par', () => {
    const d = deal('offring-20261045', 'E', 'all', {
      N: 'S:KT84 H:K9 D:AK82 C:K85',
      E: 'S:52 H:AQJ875 D:63 C:976',
      S: 'S:A763 H:T6 D:QT74 C:QT4',
      W: 'S:QJ9 H:432 D:J95 C:AJ32',
    })
    const { contract, history } = finalOf(d)
    expect(history.filter((c) => c.seat === 'N').map((c) => c.bid)).toContain('X')
    expect(history.map((c) => c.bid)).not.toContain('3NT')
    expect(contract).toMatchObject({ level: 3, strain: 'spades' })
  })

  it('frö 20260729: 1♣–P–3♣ (spärrhöjning) → 13 hp 5-5 kliver in naturligt och NS spelar hjärter', () => {
    const d = deal('offring-20260729', 'E', 'none', {
      N: 'S:QJT H:AQ983 D:AT973 C:-',
      E: 'S:A983 H:K2 D:Q54 C:A874',
      S: 'S:K542 H:T65 D:K8 C:QT95',
      W: 'S:76 H:J74 D:J62 C:KJ632',
    })
    const { contract, history } = finalOf(d)
    expect(history.filter((c) => c.seat === 'N').map((c) => c.bid)).toContain('3H')
    expect(contract).toMatchObject({ strain: 'hearts', declarer: 'N' })
  })

  // GRÄNSVAKT: 3NT-fönstret lånar INTE kungen — även över den höjda spärren
  // kräver 3NT till spel 19 direkt / 16 i balansering (som mot svaga tvåor).
  // Nords 14 hp här GJORDE 9 NT-stick på DD (Mätning #18) — men 3NT på 14 med
  // QJ torrt i hjärter är en gamble, inte systemriktig bridge, och X:et är
  // fel form (tvåkorts hjärter). Handen ska tiga.
  it('frö 20260796: 2♠–P–3♠–P–P → 14 hp balanserad i balansering förblir tyst (3NT-golvet är 16)', () => {
    const d = deal('offring-20260796', 'W', 'none', {
      N: 'S:KJT H:QJ D:JT63 C:AQ76',
      E: 'S:Q97 H:A96 D:A874 C:952',
      S: 'S:4 H:KT852 D:KQ52 C:J43',
      W: 'S:A86532 H:743 D:9 C:KT8',
    })
    const { history } = finalOf(d)
    const ourCalls = history.filter((c) => c.seat === 'N' || c.seat === 'S').map((c) => c.bid)
    expect(ourCalls.every((b) => b === 'P')).toBe(true)
  })

  // GRÄNSVAKT (ägarbeslut 2026-07-28): tunna fördelningsutgångar jagas inte.
  // NS äger 6♣ (920) på 19 hp — men ingen hand når något fönster (10/9 hp),
  // och så ska det förbli: hellre systemriktig miss än gambling.
  it('frö 20260858: 2♠–P–3♠ → 10 hp + 9 hp förblir medvetet tysta (6♣ på 19 hp jagas inte)', () => {
    const d = deal('offring-20260858', 'E', 'none', {
      N: 'S:86 H:87 D:AQ85 C:KJ983',
      E: 'S:K97542 H:AQJ D:J3 C:52',
      S: 'S:- H:KT963 D:9642 C:AQ76',
      W: 'S:AQJT3 H:542 D:KT7 C:T4',
    })
    const { history } = finalOf(d)
    const ourCalls = history.filter((c) => c.seat === 'N' || c.seat === 'S').map((c) => c.bid)
    expect(ourCalls.every((b) => b === 'P')).toBe(true)
  })
})
