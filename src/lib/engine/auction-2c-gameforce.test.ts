import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { simulateAuction } from './contract-target'
import { contractFromCalls } from './auction-live'
import type { Contract } from './play'

// =============================================================================
// FACIT-GIVAR: 2♣-öppningen ska HÅLLA sitt utgångskrav i live-lagret (2026-07-07)
// -----------------------------------------------------------------------------
// En utforskningsprob (10 000+ givar) visade att ~64 % av alla ostörda 2♣-
// öppningar dör i DELKONTRAKT — trots att 2♣ är ovillkorligt utgångskrav. Roten:
// `auctionForce` (auction-live.ts) känner igen 2/1 (open.level===1) och rondkrav,
// men INTE den starka 2♣-öppningens game-force. `buildAuction` bygger bara 2–3
// bud av 2♣-linjen (markerar den `open` med forcing:"utgangskrav") och överlämnar
// resten till live-lagret, som passar eftersom kravet inte spåras.
//
// Enda undantaget (matchar standard 2/1): 2♣–2♦–2NT (öppnarens 22–24 balanserade
// återbud) är INBJUDANDE, inte krav → svararen får passa. Allt annat = game-krav.
//
// Facit före fix: alla dessa var röda (dog i delkontrakt) innan auctionForce fick
// 2♣-grenen. Regressionslås.
// =============================================================================

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

/** Är kontraktet minst utgång (3NT / 4H / 4S / 5C / 5D / slam)? */
function isGame(c: Contract): boolean {
  if (c.level >= 6) return true
  if (c.strain === 'NT') return c.level >= 3
  if (c.strain === 'hearts' || c.strain === 'spades') return c.level >= 4
  return c.level >= 5
}

function finalContract(deal: Deal) {
  const calls = simulateAuction(deal)
  return { calls, contract: contractFromCalls(calls) }
}

describe('FACIT: 2♣-öppningens utgångskrav får aldrig dö i delkontrakt', () => {
  // Ex. 3 ur diagnostiken: Syd har en 6-5 spader/klöver-jätte (18 hp), Nord 12 hp
  // med ♥AKT87. 30 hp ihop. Live dog i 2NT (2♣–2♥–2♠–2NT–pass). Ska nå utgång.
  it('Syd öppnar 2♣ med 6-5-jätte (30 hp ihop) → utgång, inte 2NT', () => {
    const deal = dealOf('S', {
      N: 'S:786 H:KAT87 D:Q9J C:Q3',
      E: 'S:95 H:65Q2 D:75368 C:84',
      S: 'S:Q4JKA3 H:43 D:- C:75JKA',
      W: 'S:2T H:9J D:42ATK C:6T92',
    })
    const { calls, contract } = finalContract(deal)
    expect(calls[0].bid).toBe('2C') // sanity: given öppnar 2♣
    expect(contract).not.toBeNull()
    expect(isGame(contract!)).toBe(true)
  })

  // Ex. 4 ur diagnostiken: Syd 22 hp (6-korts ruter ♦AQJ852 + tre ess), Nord 11 hp
  // med 5-korts klöver. 33 hp ihop. Live dog i 3♦ (2♣–3♣–3♦–pass). Ska nå utgång.
  it('Syd öppnar 2♣ (33 hp ihop) efter positivt 3♣ → utgång, inte 3♦', () => {
    const deal = dealOf('W', {
      N: 'S:8K5 H:J6 D:K3T C:36JK4',
      E: 'S:Q74 H:95437 D:46 C:258',
      S: 'S:3TA H:K2A D:52JA8Q C:A',
      W: 'S:96J2 H:T8Q D:79 C:T97Q',
    })
    const { calls, contract } = finalContract(deal)
    expect(calls.find((c) => c.bid !== 'P')?.bid).toBe('2C')
    expect(contract).not.toBeNull()
    expect(isGame(contract!)).toBe(true)
  })

  // Ex. 5 ur diagnostiken: Syd 20 hp (~9½ spelstick, 5-korts spader), Nord 9 hp
  // balanserad (positivt 2NT). 29 hp ihop. Live dog i 3♠ (2♣–2NT–3♠–pass).
  it('Syd öppnar 2♣ (29 hp ihop) efter positivt 2NT → utgång, inte 3♠', () => {
    const deal = dealOf('W', {
      N: 'S:47T H:T85Q D:3KT8 C:JK',
      E: 'S:68J9 H:3K4 D:2 C:45T27',
      S: 'S:KA2Q5 H:A6 D:A4J9Q C:6',
      W: 'S:3 H:7J29 D:576 C:8QA39',
    })
    const { calls, contract } = finalContract(deal)
    expect(calls.find((c) => c.bid !== 'P')?.bid).toBe('2C')
    expect(contract).not.toBeNull()
    expect(isGame(contract!)).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// Residualen: 2♣–2♦–2NT (öppnarens 22–24 balanserade återbud). Undantaget låter
// svararen passa 2NT — men BARA med en bust (0–2). Enkel matte (ägarbeslut
// 2026-07-07): 22–24 mittemot 3+ hp = utgång (22+3 = 25) → svararen bjuder 3NT,
// passar aldrig bort utgångsvärden. (Full systems-on med Stayman/transfer över
// 2NT-återbudet är medvetet uppskjutet — här räcker "nå utgång".)
describe('FACIT: 2♣–2♦–2NT – svararen med 3+ hp når utgång, passar inte 2NT', () => {
  it('svarare 3 hp mittemot 22 → 3NT (kombinerat 25)', () => {
    const deal = dealOf('W', {
      N: 'S:A6 H:A9Q D:TKA C:6TQ7K',
      E: 'S:5T7J9 H:85K3 D:2 C:J43',
      S: 'S:32 H:T62J D:4Q78 C:285',
      W: 'S:8KQ4 H:74 D:6J395 C:9A',
    })
    const { calls, contract } = finalContract(deal)
    expect(calls.find((c) => c.bid !== 'P')?.bid).toBe('2C')
    expect(contract).not.toBeNull()
    expect(isGame(contract!)).toBe(true)
  })

  it('svarare 3 hp mittemot 23 → 3NT (kombinerat 26)', () => {
    const deal = dealOf('W', {
      N: 'S:2976 H:87K4 D:Q2K9 C:4',
      E: 'S:38J H:2Q9T D:543 C:8T7',
      S: 'S:54Q H:J3 D:87J C:Q3269',
      W: 'S:TAK H:A56 D:6TA C:KA5J',
    })
    const { calls, contract } = finalContract(deal)
    expect(calls.find((c) => c.bid !== 'P')?.bid).toBe('2C')
    expect(contract).not.toBeNull()
    expect(isGame(contract!)).toBe(true)
  })

  it('svarare 5 hp mittemot 23 → 3NT (kombinerat 28)', () => {
    const deal = dealOf('S', {
      N: 'S:2Q6 H:27T9K D:K4 C:459',
      E: 'S:AKT H:6JA D:2TA6 C:A3K',
      S: 'S:547 H:384 D:835Q C:72Q',
      W: 'S:839J H:5Q D:97J C:8JT6',
    })
    const { calls, contract } = finalContract(deal)
    expect(calls.find((c) => c.bid !== 'P')?.bid).toBe('2C')
    expect(contract).not.toBeNull()
    expect(isGame(contract!)).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// SYSTEMS-ON över 2♣–2♦–2NT (2026-07-07): svararen använder samma konventioner
// som mot en naturlig 2NT-öppning (Stayman/transfer), fast med 22–24 mittemot.
// Svararen bjöd 2♦ = 0–7 hp, så poänggränserna sänks 2 steg (utgång från 3 hp).
// Mål: hitta 4-4- och 5-3-högfärgsfit i stället för att blint blåsa 3NT.
function isMajorGame(c: Contract): boolean {
  return c.level === 4 && (c.strain === 'hearts' || c.strain === 'spades')
}
describe('FACIT: systems-on över 2♣–2♦–2NT hittar högfärgsfit', () => {
  // 4-4 hjärterfit: öppnaren ♥KJ72 (22), svararen ♥A543 (7) → Stayman → 4♥.
  it('4-4 hjärterfit via Stayman → 4♥, inte 3NT', () => {
    const deal = dealOf('S', {
      W: 'S:J2A H:7J2K D:83A C:QKA',
      E: 'S:T H:5A34 D:K6 C:586479',
      N: 'S:57KQ6 H:6TQ D:5TJ C:3T',
      S: 'S:4839 H:89 D:2Q974 C:J2',
    })
    const { contract } = finalContract(deal)
    expect(contract).not.toBeNull()
    expect(isMajorGame(contract!)).toBe(true)
  })

  // Svararen 5-4 i högfärgerna (♠QT982 ♥Q543, 4 hp) mittemot 24 balanserad med
  // 4-4 i högfärgerna → Stayman hittar en 4+-korts högfärgsfit → 4-läges högfärg.
  it('svararens 5-4 högfärger mittemot 24 → högfärgsutgång, inte 3NT', () => {
    const deal = dealOf('W', {
      W: 'S:7KAJ H:76JA D:AT C:KA6',
      E: 'S:Q9T82 H:43Q5 D:2765 C:-',
      N: 'S:35 H:89 D:K9J8 C:79J2Q',
      S: 'S:64 H:2KT D:Q34 C:8534T',
    })
    const { contract } = finalContract(deal)
    expect(contract).not.toBeNull()
    expect(isMajorGame(contract!)).toBe(true)
  })
})
