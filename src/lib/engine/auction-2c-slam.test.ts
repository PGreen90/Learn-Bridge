// FACIT-TEST för ETAPP 4 (F1 familj B) FIX 1, se docs/systemrevisorn.md:
// **slamutredning saknas helt efter stark 2♣ + positivt svar.**
//
// Efter 2♣ och ett positivt svar (8+) fanns ingen on-book-fortsättning när en
// trumf hittats: linjen tog slut och live-lagret höjde bara till utgång (eller
// blastade 5m). Kaptensmatten (ärliga slamportar) nådde aldrig 2♣-auktionerna
// fast öppningen VISAT ~22+ (stark balanserad 22+ hp eller ~9+ spelstick, §4.4)
// och det positiva svaret visat 8+.
//
// Systemrevisorns frön (frö 20260721-serien, mätning #11):
//  - 20261101: `2♣–2♥–3♥–4♥–P` — öppnaren E 24 hp, svararen W 11 hp med
//    hjärterfit satt → visat 33+, men ingen RKC. 6♥ fanns (tapp 790).
//  - 20261050: `2♣–3♣–4♣–5♣` — S 21 hp, N 10 hp + singel med klöverfit →
//    blast till 5♣ utan utredning. 6♣ fanns (tapp 590).
//  - 20261469: `2♣–2♠–3♦–5♦` — svararen N med 4-korts ruterstöd blastade 5♦
//    förbi både höjning och RKC. 6♦ = exakt par (tapp 500).
//  - 20260830: `2♣–2♥–3♦–5♦` — samma blast från W med AJT7 i ruter. 6♦ fanns
//    (7♦ på DD, men storslam kräver visshet — 6♦ är det ärliga målet).
//
// Facit: svararen (kaptenen) räknar SIN hand mot 2♣-öppningens visade minimum
// (22): driv 33+ → 4NT RKC; 31–32 → slaminbjudan (öppnaren dömer på egna
// Bergenpoäng — spelstick-händernas längd räknas ärligt); annars utgång (GF).

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

// ---- Frö 20261101: 2♣–2♥–3♥ och kaptenen W har 11 hp med satt hjärtertrumf --

const HANDS_1101 = {
  N: 'S:T62 H:T9832 D:Q4 C:T96',
  E: 'S:AQ54 H:AJ7 D:AKT C:KQJ',
  S: 'S:K973 H:- D:97632 C:8732',
  W: 'S:J8 H:KQ654 D:J85 C:A54',
}
const HISTORY_1101: ResolvedCall[] = [
  call('E', '2C'), call('S', 'P'), call('W', '2H'), call('N', 'P'),
  call('E', '3H'), call('S', 'P'),
]

// ---- Frö 20261050: 2♣–3♣–4♣ och kaptenen N har 10 hp + singel med klöverfit -

const HANDS_1050 = {
  N: 'S:Q83 H:KQ76 D:4 C:K8642',
  E: 'S:742 H:43 D:KJ83 C:QT97',
  S: 'S:AKJ H:AJT985 D:A C:A53',
  W: 'S:T965 H:2 D:QT97652 C:J',
}
const HISTORY_1050: ResolvedCall[] = [
  call('E', 'P'), call('S', '2C'), call('W', 'P'), call('N', '3C'),
  call('E', 'P'), call('S', '4C'), call('W', 'P'),
]

// ---- Frö 20261469: 2♣–2♠–3♦ och kaptenen N har 4-korts ruterstöd ------------

const HANDS_1469 = {
  N: 'S:AQ832 H:KT4 D:T982 C:2',
  E: 'S:KT54 H:QJ752 D:6 C:Q53',
  S: 'S:6 H:A D:AQJ743 C:AKJ98',
  W: 'S:J97 H:9863 D:K5 C:T764',
}
const HISTORY_1469: ResolvedCall[] = [
  call('S', '2C'), call('W', 'P'), call('N', '2S'), call('E', 'P'),
  call('S', '3D'), call('W', 'P'),
]

// ---- Frö 20260830: 2♣–2♥–3♦ och kaptenen W har AJT7 i ruter -----------------

const HANDS_830 = {
  N: 'S:QJT92 H:QT85 D:- C:9632',
  E: 'S:A873 H:- D:KQ986 C:AKQT',
  S: 'S:K6 H:A964 D:5432 C:J84',
  W: 'S:54 H:KJ732 D:AJT7 C:75',
}
const HISTORY_830: ResolvedCall[] = [
  call('W', 'P'), call('N', 'P'), call('E', '2C'), call('S', 'P'),
  call('W', '2H'), call('N', 'P'), call('E', '3D'), call('S', 'P'),
]

describe('etapp 4 familj B fix 1: kaptensmatte + RKC efter positivt svar på 2♣', () => {
  it('frö 20261101-läget: W (11 hp, hjärtertrumf satt) frågar 4NT, höjer inte bara 4♥', () => {
    const d = deal('2cslam-20261101-pos', 'E', 'ew', HANDS_1101)
    expect(decideCall(d, HISTORY_1101, 'W').bid).toBe('4NT')
  })

  it('frö 20261101 hela auktionen: lillslam 6♥ nås', () => {
    const d = deal('2cslam-20261101', 'E', 'ew', HANDS_1101)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'hearts' })
  })

  it('frö 20261050-läget: N (10 hp + singel, klöverfit) frågar 4NT, blastar inte 5♣', () => {
    const d = deal('2cslam-20261050-pos', 'E', 'ew', HANDS_1050)
    expect(decideCall(d, HISTORY_1050, 'N').bid).toBe('4NT')
  })

  it('frö 20261050 hela auktionen: lillslam 6♣ nås', () => {
    const d = deal('2cslam-20261050', 'E', 'ew', HANDS_1050)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'clubs' })
  })

  it('frö 20261469-läget: N (4-korts ruterstöd) frågar 4NT, blastar inte 5♦', () => {
    const d = deal('2cslam-20261469-pos', 'S', 'none', HANDS_1469)
    expect(decideCall(d, HISTORY_1469, 'N').bid).toBe('4NT')
  })

  it('frö 20261469 hela auktionen: lillslam 6♦ nås (exakt par)', () => {
    const d = deal('2cslam-20261469', 'S', 'none', HANDS_1469)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'diamonds' })
  })

  it('frö 20260830-läget: W (ruterfit) frågar 4NT, blastar inte 5♦', () => {
    const d = deal('2cslam-20260830-pos', 'W', 'all', HANDS_830)
    expect(decideCall(d, HISTORY_830, 'W').bid).toBe('4NT')
  })

  it('frö 20260830 hela auktionen: 6♦ nås (storslam kräver visshet → inte 7♦)', () => {
    const d = deal('2cslam-20260830', 'W', 'all', HANDS_830)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'diamonds' })
  })
})

// ---- FIX 2: slamzon UTAN trumf (frö 20261372 + syntetiska vakter) -----------

// Frö 20261372: `2♣–3♣–3♥–4♣–4♥–P` — svararen W (14 hp, AKQJT3 i klöver) har
// ingen hjärterfit men står i slamzon (14 + visade 22 = 36) med en egen
// SJÄLVBÄRANDE färg. Live-lagret rebjöd bara 4♣ och auktionen dog i 4♥.
// Facit: RKC med egen färg som trumf → 6♣ (DD-verifierat 12 stick av W;
// 6NT står också men 6♣ är den ärliga trumfen).
const HANDS_1372 = {
  N: 'S:63 H:73 D:J762 C:97654',
  E: 'S:K8 H:AKJT64 D:KQ943 C:-',
  S: 'S:AJT9742 H:Q95 D:8 C:82',
  W: 'S:Q5 H:82 D:AT5 C:AKQJT3',
}
const HISTORY_1372: ResolvedCall[] = [
  call('E', '2C'), call('S', 'P'), call('W', '3C'), call('N', 'P'),
  call('E', '3H'), call('S', 'P'),
]

// Syntetisk: svararen 11 hp (2♥-positivt), öppnaren BALANSERAD 24 utan fit →
// 3NT-återbud → 33 ihop utan trumf → 6NT (spelas från den starka handen).
const HANDS_NOFIT_NT = {
  N: 'S:T98 H:AJT9 D:T87 C:T53',
  E: 'S:AK4 H:87 D:AKQJ C:AK98',
  S: 'S:7652 H:32 D:9643 C:762',
  W: 'S:QJ3 H:KQ654 D:52 C:QJ4',
}
const HISTORY_NOFIT: ResolvedCall[] = [
  call('E', '2C'), call('S', 'P'), call('W', '2H'), call('N', 'P'),
  call('E', '3NT'), call('S', 'P'),
]

// Samma läge men svararen 9 hp → 31 ihop = under driv-zonen utan trumf
// (avgränsning: ingen kvantitativ inbjudan här) → ingen slam blåses.
const HANDS_NOFIT_LOW = {
  N: 'S:T98 H:AJT9 D:T87 C:T53',
  E: 'S:AK4 H:87 D:AKQJ C:AK98',
  S: 'S:Q762 H:32 D:9643 C:762',
  W: 'S:J53 H:KQ654 D:52 C:QJ4',
}

// Frö 20261107 — VAKTEN mot 6NT-blasten: öppnaren E har bara 13 hp
// (spelstick-2♣, 6-5) och rebjuder 2♠. Svararen W (12 hp, ingen spaderfit,
// ingen egen solid färg) får INTE räkna "12 + 22 = 34 → 6NT" — spelstickens
// längd ger inga sangstick utan fit (6NT = åtta stick på DD). Auktionen ska
// vidare naturligt och stanna under slam.
const HANDS_1107 = {
  N: 'S:A95 H:J8 D:J98 C:AT764',
  E: 'S:KJT872 H:9 D:AKQ64 C:5',
  S: 'S:Q6 H:Q7632 D:T C:J9832',
  W: 'S:43 H:AKT54 D:7532 C:KQ',
}
const HISTORY_1107: ResolvedCall[] = [
  call('E', '2C'), call('S', 'P'), call('W', '2H'), call('N', 'P'),
  call('E', '2S'), call('S', 'P'),
]

describe('etapp 4 familj B fix 2: slamzon utan trumf', () => {
  it('frö 20261372-läget: W (14 hp, AKQJT3) frågar 4NT med egen färg som trumf', () => {
    const d = deal('2cslam-20261372-pos', 'E', 'ns', HANDS_1372)
    expect(decideCall(d, HISTORY_1372, 'W').bid).toBe('4NT')
  })

  it('frö 20261372 hela auktionen: lillslam 6♣ nås', () => {
    const d = deal('2cslam-20261372', 'E', 'ns', HANDS_1372)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'clubs' })
  })

  it('utan fit mot BALANSERAT 3NT-återbud: 33 ihop → 6NT', () => {
    const d = deal('2cslam-nofit-nt-pos', 'E', 'none', HANDS_NOFIT_NT)
    expect(decideCall(d, HISTORY_NOFIT, 'W').bid).toBe('6NT')
  })

  it('utan fit, 6NT-vägen, hela auktionen: 6NT nås', () => {
    const d = deal('2cslam-nofit-nt', 'E', 'none', HANDS_NOFIT_NT)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'NT' })
  })

  it('under driv-zonen utan trumf (31 ihop): ingen slam blåses', () => {
    const d = deal('2cslam-nofit-low', 'E', 'none', HANDS_NOFIT_LOW)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeLessThan(6)
  })

  it('frö 20261107-läget: efter öppnarens FÄRG-återbud utan fit blåses inte 6NT', () => {
    const d = deal('2cslam-20261107-pos', 'E', 'none', HANDS_1107)
    expect(decideCall(d, HISTORY_1107, 'W').bid).not.toBe('6NT')
  })

  it('frö 20261107 hela auktionen: stannar under slam', () => {
    const d = deal('2cslam-20261107', 'E', 'none', HANDS_1107)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeLessThan(6)
  })
})

// ---- Vakter: inbjudningszonen (31–32) och accepten på egna Bergenpoäng ------

// Konstruerad giv: öppnaren 23 hp balanserad (2♣ → stöd), svararen 8 hp med
// 5-korts hjärter → kapten ~9 + visade 22 = 31 → INBJUDAN 5♥, och öppnaren
// med 23 (> blott 22) accepterar → 6♥.
const HANDS_INVIT_ACCEPT = {
  N: 'S:T974 H:T93 D:962 C:T63',
  E: 'S:AQ5 H:A87 D:AKT C:KQJ4',
  S: 'S:K63 H:52 D:Q743 C:A872',
  W: 'S:J82 H:KQJ64 D:J85 C:95',
}
const HISTORY_INVIT: ResolvedCall[] = [
  call('E', '2C'), call('S', 'P'), call('W', '2H'), call('N', 'P'),
  call('E', '3H'), call('S', 'P'),
]

// Samma läge men öppnaren EXAKT 22 platt → accepten uteblir (blott minimum).
const HANDS_INVIT_DECLINE = {
  N: 'S:T974 H:T93 D:962 C:T64',
  E: 'S:AQ5 H:A87 D:AKT C:KQ32',
  S: 'S:K63 H:52 D:Q743 C:AJ87',
  W: 'S:J82 H:KQJ64 D:J85 C:95',
}

describe('etapp 4 familj B fix 1: inbjudningszonen 31–32', () => {
  it('kaptenen med ~31 ihop bjuder in med 5♥ (inte RKC, inte bara 4♥)', () => {
    const d = deal('2cslam-invit-pos', 'E', 'none', HANDS_INVIT_ACCEPT)
    expect(decideCall(d, HISTORY_INVIT, 'W').bid).toBe('5H')
  })

  it('öppnaren med 23 (mer än blott minimum) accepterar → 6♥', () => {
    const d = deal('2cslam-invit-accept', 'E', 'none', HANDS_INVIT_ACCEPT)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'hearts' })
  })

  it('öppnaren med blott 22 avböjer → 5♥ står', () => {
    const d = deal('2cslam-invit-decline', 'E', 'none', HANDS_INVIT_DECLINE)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 5, strain: 'hearts' })
  })
})
