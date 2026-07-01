import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { respondTo1NT } from './responses-nt'

function r1nt(notation: string): string {
  return respondTo1NT(parseHand(notation)).call
}

describe('respondTo1NT', () => {
  it('pass med svag hand utan högfärg', () => {
    expect(r1nt('S:J83 H:Q72 D:Q642 C:953')).toBe('P') // 5 hp
  })

  it('Stayman med 4-korts högfärg och inbjudningsstyrka', () => {
    expect(r1nt('S:KQ85 H:972 D:K42 C:J53')).toBe('2C') // 9 hp, 4 spader
  })

  it('Stayman med 4-korts högfärg och GF', () => {
    expect(r1nt('S:AQ85 H:K72 D:Q42 C:K53')).toBe('2C') // 14 hp
  })

  it('Stayman (Smolen-route) med 5-4 i högfärgerna, GF', () => {
    expect(r1nt('S:AQ85 H:KJ872 D:42 C:53')).toBe('2C') // 10 hp, 4-5 hf
  })

  it('5-5 i högfärgerna, svag → 2♣ (garbage-route)', () => {
    expect(r1nt('S:Q8765 H:K8765 D:32 C:4')).toBe('2C') // 5 hp, 5-5
  })

  it('5-5 i högfärgerna, inbjudan (8–9) → 2♦ (transfer ♥, styrka kodad)', () => {
    expect(r1nt('S:KQ876 H:KJ765 D:3 C:42')).toBe('2D') // 9 hp, 5-5
  })

  it('5-5 i högfärgerna, GF (10+) → 2♥ (transfer ♠, styrka kodad)', () => {
    expect(r1nt('S:AQ876 H:KJ765 D:3 C:42')).toBe('2H') // 10 hp, 5-5
  })

  it('garbage Stayman: svag 4-4-4-1 kort i klöver → 2♣', () => {
    expect(r1nt('S:Q652 H:K843 D:J642 C:5')).toBe('2C') // 6 hp, 4-4-4-1
  })

  it('garbage Stayman: svag 4-4-5-0 (renons klöver) → 2♣', () => {
    expect(r1nt('S:Q652 H:K843 D:J6425 C:-')).toBe('2C') // 4-4-5-0
  })

  it('svag 4-3-3-3 utan 4-4 i högfärg → pass (inte garbage Stayman)', () => {
    expect(r1nt('S:8632 H:Q72 D:K93 C:J54')).toBe('P') // 5 hp, bara 4 spader
  })

  it('Jacoby-transfer till hjärter (2♦) med 5 hjärter', () => {
    expect(r1nt('S:73 H:KQ862 D:Q42 C:953')).toBe('2D') // 7 hp
  })

  it('Jacoby-transfer till spader (2♥) med 5 spader', () => {
    expect(r1nt('S:KQ862 H:73 D:Q42 C:953')).toBe('2H') // 7 hp
  })

  it('Jacoby-transfer som svag signoff med 6-korts högfärg, svag', () => {
    expect(r1nt('S:8 H:J86432 D:9742 C:53')).toBe('2D') // 1 hp, 6 hjärter
  })

  it('Texas till spader (4♥) med 6 spader, utgång utan slam', () => {
    expect(r1nt('S:KQ8642 H:73 D:Q42 C:K3')).toBe('4H') // 10 hp
  })

  it('Texas till hjärter (4♦) med 6 hjärter, utgång utan slam', () => {
    expect(r1nt('S:73 H:KQ8642 D:Q42 C:K3')).toBe('4D') // 10 hp
  })

  it('Minor Suit Stayman (2♠) med 5-4 i minorerna, GF', () => {
    expect(r1nt('S:A3 H:72 D:AQ842 C:KJ85')).toBe('2S') // 14 hp
  })

  it('2NT inbjudan med 8–9 balanserad utan högfärg', () => {
    expect(r1nt('S:K83 H:Q72 D:KJ2 C:9532')).toBe('2NT') // 9 hp
  })

  it('3NT till spel med 10–15 balanserad utan högfärg', () => {
    expect(r1nt('S:K83 H:Q72 D:KJ2 C:KJ53')).toBe('3NT') // 13 hp
  })

  it('4NT kvantitativ med 16–17 utan högfärg', () => {
    expect(r1nt('S:KQ3 H:KJ2 D:KJ2 C:KJ43')).toBe('4NT') // 17 hp
  })
})
