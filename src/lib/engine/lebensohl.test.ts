import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { lebensohlAfter1NT, lebensohlAfter1NTRebid, naturalNTOvercall } from './lebensohl'

// Lebensohl EFTER VÅRT 1NT (systembok §7.5, bridgebum "Lebensohl after 1NT").
// Lager 1: svararens kärna efter partnerns 1NT + motståndarens NATURLIGA inkliv.
// theirSuit = motståndarens naturliga inklivsfärg på 2-läget.

const R = (n: string, their: 'clubs' | 'diamonds' | 'hearts' | 'spades') =>
  lebensohlAfter1NT(parseHand(n), their).call
const RB = (n: string, their: 'clubs' | 'diamonds' | 'hearts' | 'spades') =>
  lebensohlAfter1NTRebid(parseHand(n), their).call
const OV = (n: string) => naturalNTOvercall(parseHand(n)).call

describe('naturalNTOvercall – motståndarens naturliga inkliv över vårt 1NT', () => {
  it('stark 6-korts enfärgshand (12 hp) → naturligt 2-lägesbud', () => {
    expect(OV('S:KQJT97 H:Q3 D:832 C:A4')).toBe('2S') // 6 spader, 12 hp
    expect(OV('S:Q3 H:AKJ976 D:K82 C:54')).toBe('2H') // 6 hjärter, 13 hp
    expect(OV('S:82 H:K4 D:A3 C:KQJ9764')).toBe('2C') // 7 klöver, 12 hp
  })

  it('svag enfärgshand (under 11 hp) → pass (lämnas åt DONT-X)', () => {
    expect(OV('S:KQJ975 H:32 D:842 C:54')).toBe('P') // 6 spader men bara 8 hp
  })

  it('tvåfärgshand (5-5) → pass (lämnas åt DONT)', () => {
    expect(OV('S:KQJ97 H:AJ982 D:8 C:54')).toBe('P') // 5-5 major, ej enfärg
  })

  it('för stark (16+) eller jämn utan långfärg → pass', () => {
    expect(OV('S:AKQ76 H:K4 D:AQ3 C:K92')).toBe('P') // 18 hp, bara 5-korts
    expect(OV('S:KJ83 H:Q42 D:KJ3 C:A94')).toBe('P') // jämn 13, ingen 6-färg
  })
})

describe('lebensohlAfter1NT – svararens första bud efter (1NT)–(2X naturligt)', () => {
  it('svag hand, högre högfärg biddbar på 2-läget → naturligt 2-läge (utspel)', () => {
    // Över (2♥): 5 spader, svag → 2♠ naturligt konkurrensbud (ej relä).
    expect(R('S:KJ973 H:82 D:653 C:842', 'hearts')).toBe('2S') // 4 hp, 5 spader
  })

  it('svag hand med lång minor (färg kräver 3-läget) → 2NT-relä', () => {
    // Över (2♠): 7 klöver, svag → 2NT (relä till 3♣, passar sedan).
    expect(R('S:2 H:973 D:53 C:KJT9642', 'spades')).toBe('2NT') // 5 hp, 7 klöver
  })

  it('svag hand utan färg → pass (försvarar deras inkliv – lagligt här)', () => {
    expect(R('S:842 H:973 D:9532 C:J86', 'spades')).toBe('P') // ~1 hp
  })

  it('utgångskrav med egen 5+ färg → direkt 3-läge', () => {
    // Över (2♠): 5 klöver + 14 hp → 3♣ direkt (krav).
    expect(R('S:A2 H:KQ3 D:832 C:KQT94', 'spades')).toBe('3C') // 14 hp, 5 klöver
  })

  it('utgångsvärden, jämn hand med stopp → direkt 3NT', () => {
    // Över (2♥): jämn 15 hp med hjärterstopp, ingen 5-färg → 3NT.
    expect(R('S:KQ42 H:KJ5 D:QT4 C:A32', 'hearts')).toBe('3NT') // stopp KJ5
  })
})

describe('lebensohlAfter1NTRebid – svararens rättelse efter öppnarens tvungna 3♣', () => {
  it('svag med klöver → passar 3♣', () => {
    expect(RB('S:2 H:973 D:53 C:KJT9642', 'spades')).toBe('P') // klöver = min färg
  })

  it('svag med annan lång minor → rättar till sin färg på 3-läget', () => {
    // 6 ruter → 3♦ (partnern lägger upp).
    expect(RB('S:2 H:973 D:KJ9642 C:J86', 'spades')).toBe('3D')
  })

  it('svag med lång hjärter under deras spader → rättar 3♥', () => {
    expect(RB('S:2 H:KJ9764 D:952 C:J8', 'spades')).toBe('3H')
  })
})
