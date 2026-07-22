// FACIT-TEST för fel färg-spåret FIX 4 (docs/systemrevisorn.md, buggfamilj 4):
// tre konkurrens-fortsättningar som blåste bet fast facit fanns i annan strain.
//
// Systemrevisorns frön (baslinjen, frö 20260721):
//  - 20260733: partnern cue-bjöd 3♦ över deras svaga 2♦ (= stark 5-5 i två
//    sidofärger). Advancern med 3-3 i klöver/hjärter valde 4♣ på tre hackor
//    (längsta-färgen-regeln bröt lika åt klöver) fast 3♥ fanns EN NIVÅ lägre —
//    4♣ tre bet, 5♥ var hemma. Fix: lika långa färger → billigaste nivån vinner.
//  - 20260763: efter 1♦–(2♣)–X (negativ dubbling) svarade öppnaren 2NT på
//    11 hp minimum bara för att klöverstoppet fanns — två bet. Fix: sang på
//    2-läget+ kräver extra (~15+); minimum rebjuder sin 5-korts öppningsfärg
//    när det går utan nivåhöjning, sang är sista utvägen.
//  - 20260774: 13 hp utan fit svarade 3♣ (krav) på partnerns svaga 2♥ →
//    öppnaren tvingades till 3♥, en bet — fast 2♥ stod. Fix: ny färg som krav
//    på 3-LÄGET kräver ~15+; 11–14 utan fit och utan billig egen färg passar.
//    (Ny färg på 2-läget är kvar från 11 hp — låst av responses-weak2.test.ts.)

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'
import { decideCall } from './auction-live'
import { openerAnswerNegativeDouble } from './doubles'
import { respondToWeakTwo } from './responses-weak2'

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

// Frö 20260733: S öppnar svag 2♦, W cue-bjuder 3♦ (5-5 spader+hjärter, 15 hp),
// E (advancern) ska välja sidofärg: 3-3 i klöver/hjärter, 2 spader.
const HANDS_733 = {
  N: 'S:K964 H:83 D:64 C:AJ984',
  E: 'S:QT H:A65 D:AJ983 C:762',
  S: 'S:87 H:JT2 D:KQT752 C:T5',
  W: 'S:AJ532 H:KQ974 D:- C:KQ3',
}
const HISTORY_733: ResolvedCall[] = [
  call('N', 'P'), call('E', 'P'), call('S', '2D'), call('W', '3D'), call('N', 'P'),
]

// Frö 20260763: W öppnar 1♦ (11 hp, 5 ruter), N kliver in 2♣, E negativ-dubblar.
const HANDS_763 = {
  N: 'S:JT H:A73 D:T64 C:KJ742',
  E: 'S:KQ985 H:K52 D:85 C:965',
  S: 'S:A742 H:JT986 D:A32 C:Q',
  W: 'S:63 H:Q4 D:KQJ97 C:AT83',
}
const HISTORY_763: ResolvedCall[] = [
  call('S', 'P'), call('W', '1D'), call('N', '2C'), call('E', 'X'), call('S', 'P'),
]

// Frö 20260774: S öppnar svag 2♥, N har 13 hp med 6-5 i minor men ingen fit.
const HANDS_774 = {
  N: 'S:- H:95 D:AK863 C:AQ7543',
  E: 'S:JT984 H:AQ73 D:2 C:KT9',
  S: 'S:Q732 H:KJT642 D:J97 C:-',
  W: 'S:AK65 H:8 D:QT54 C:J862',
}
const HISTORY_774: ResolvedCall[] = [
  call('E', 'P'), call('S', '2H'), call('W', 'P'),
]

describe('advancerns svar på tvåfärgs-cue: lika långa färger → billigaste nivån', () => {
  it('frö 20260733-läget: E (3-3 klöver/hjärter) svarar 3♥, inte 4♣', () => {
    const d = deal('felfarg-20260733-pos', 'N', 'ns', HANDS_733)
    expect(decideCall(d, HISTORY_733, 'E').bid).toBe('3H')
  })

  it('längre färg vinner fortfarande: 4 klöver mot 3 hjärter → klövern', () => {
    // Samma läge men E:s hand omgjord: 4 klöver, 3 hjärter (längd slår nivå).
    const d = deal('wtcue-langd-vinner', 'N', 'ns', {
      ...HANDS_733,
      E: 'S:QT H:A65 D:AJ98 C:7632',
    })
    expect(decideCall(d, HISTORY_733, 'E').bid).toBe('4C')
  })
})

describe('öppnarens svar på negativ dubbling: minimum lyfter inte till sang', () => {
  it('frö 20260763-läget: W (11 hp, 5 ruter) rebjuder 2♦, inte 2NT', () => {
    const d = deal('felfarg-20260763-pos', 'S', 'none', HANDS_763)
    expect(decideCall(d, HISTORY_763, 'W').bid).toBe('2D')
  })

  it('enhet: 11 hp minimum med stopp men billigt 5-korts återbud → färgen', () => {
    const r = openerAnswerNegativeDouble(parseHand('S:63 H:Q4 D:KQJ97 C:AT83'), 'diamonds', '2C')
    expect(r.call).toBe('2D')
  })

  it('enhet: 15+ med stopp bjuder fortfarande sang', () => {
    const r = openerAnswerNegativeDouble(parseHand('S:A3 H:Q4 D:KQJ97 C:AQ83'), 'diamonds', '2C')
    expect(r.call).toBe('2NT')
  })

  it('enhet: sang på 1-LÄGET kräver inget extra (1♦–(1♠)–X utan högfärg)', () => {
    // 13 hp, inget 4-korts hjärter, spaderstopp → 1NT som förr.
    const r = openerAnswerNegativeDouble(parseHand('S:KJ3 H:Q42 D:AQ432 C:432'), 'diamonds', '1S')
    expect(r.call).toBe('1NT')
  })
})

describe('svar på svag tvåa: ny färg på 3-läget kräver 15+, annars pass utan fit', () => {
  it('frö 20260774-läget: N (13 hp, ingen fit, klövern kräver 3-läget) passar', () => {
    const d = deal('felfarg-20260774-pos', 'E', 'none', HANDS_774)
    expect(decideCall(d, HISTORY_774, 'N').bid).toBe('P')
  })

  it('enhet: 16 hp med 6-korts klöver får fortfarande kräva med 3♣', () => {
    expect(respondToWeakTwo(parseHand('S:2 H:95 D:AK86 C:AKQ543'), 'hearts').call).toBe('3C')
  })

  it('enhet: ny färg på 2-LÄGET kvar från 11 hp (2♥–2♠, låst beteende)', () => {
    expect(respondToWeakTwo(parseHand('S:AKQ84 H:2 D:KJ32 C:742'), 'hearts').call).toBe('2S')
  })
})

describe('hela auktionen (Systemrevisorns frön, motorn bjuder alla fyra)', () => {
  it('frö 20260733: cue-svaret hamnar i högfärgen, inte i 4♣ bet', () => {
    const d = deal('felfarg-20260733', 'N', 'ns', HANDS_733)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract?.strain).toBe('hearts')
  })

  it('frö 20260763: öppnarens billiga 2♦ står — advancern höjer INTE på dubbelton', () => {
    // Kräver även dubbelton-vakten i fitLengthNeeded: Västs 2♦ var ett TVINGAT
    // svar på Östs negativa dubbling (lovar bara 5) — utan vakten höjde Öst till
    // 3♦ på ♦85 ("rebjuden färg = 6+"). 2♦ en bet (−50) är praktiskt optimum;
    // par 1♠ blev onåbart i och med Nords 2♣-inkliv.
    const d = deal('felfarg-20260763', 'S', 'none', HANDS_763)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 2, strain: 'diamonds', declarer: 'W' })
  })

  it('frö 20261621 (regressionsvakt): tvingat 2♥-ombud efter 1♥-ÖPPNING höjs på dubbelton', () => {
    // Öppningen 1♥ lovade redan 5+ → dubbelton = 7-korts fit; dubbelton-vaktens
    // undantag för tvingade ombud får INTE stoppa den här höjningen (4♥ hemma).
    const d = deal('felfarg-20261621-vakt', 'E', 'none', {
      N: 'S:J972 H:983 D:JT875 C:9',
      E: 'S:K63 H:AQT742 D:AQ C:75',
      S: 'S:Q H:J5 D:9632 C:AKQ632',
      W: 'S:AT854 H:K6 D:K4 C:JT84',
    })
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 4, strain: 'hearts', declarer: 'E' })
  })

  it('frö 20260771 (regressionsvakt): tvingat ombud som gick UPP en nivå = 6+ → höjs på dubbelton', () => {
    // 1♣–(1♦)–X–P–2♣: ombudet fick gå upp en nivå = 6+-steget → K9 dubbelton är fit.
    const d = deal('felfarg-20260771-vakt', 'W', 'ew', {
      N: 'S:J7 H:J5 D:AK8543 C:T75',
      E: 'S:AK8543 H:K6 D:J97 C:K9',
      S: 'S:T92 H:QT987432 D:T6 C:-',
      W: 'S:Q6 H:A D:Q2 C:AQJ86432',
    })
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ strain: 'clubs', declarer: 'W' })
  })

  it('frö 20261351 (regressionsvakt): öppnaren visar sin ANDRA färg före ett billigt rebud', () => {
    // 5♥+4♦ efter 1♥–(2♣)–X: 2♦ (objuden färg, samma nivå) före 2♥ — 4-5-ruterfiten hittas.
    const d = deal('felfarg-20261351-vakt', 'W', 'ns', {
      N: 'S:T54 H:QJ7 D:JT9 C:QT87',
      E: 'S:A86 H:AT632 D:A873 C:4',
      S: 'S:J9 H:9854 D:K C:AKJ532',
      W: 'S:KQ732 H:K D:Q6542 C:96',
    })
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ strain: 'diamonds', declarer: 'E' })
  })

  it('frö 20260774: N passar 2♥ — Ö/V balanserar till spader och stannar lågt', () => {
    // Efter N:s pass balanserar Öst 2♠ (utpassningsläget). Före fix 5a höjde
    // Väst till 4♠ (två bet, −100 = par); med advancer-rabatten (kungen är
    // redan lånad av balanseraren) stannar höjningen på 3♠ (en bet, −50) —
    // en BILLIGARE offring än par. Fortfarande bättre än gamla 3♥ bet av N/S.
    const d = deal('felfarg-20260774', 'E', 'none', HANDS_774)
    const history = botAuction(d)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 3, strain: 'spades', declarer: 'E' })
  })
})
