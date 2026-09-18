import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { naturalNTOvercall } from './lebensohl'

// Motståndarens NATURLIGA inkliv över ett 1NT. (Svararens Lebensohl efter vårt
// 1NT revs 2026-09-18 — systems on + stulet bud, se nt-systems-on.test.ts.)

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
