import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { lebensohlResponse } from './lebensohl'

const l = (n: string, their: 'hearts' | 'spades' | 'diamonds') =>
  lebensohlResponse(parseHand(n), their).call

describe('lebensohlResponse (§7.4)', () => {
  it('svag hand med lång färg → 2NT (relä, stannar lågt)', () => {
    expect(l('S:32 H:J8765 D:432 C:432', 'spades')).toBe('2NT') // 1 hp, 5 hjärter
  })

  it('utgångskrav med egen 5-färg → direkt 3-läge', () => {
    expect(l('S:KQ542 H:32 D:K32 C:432', 'hearts')).toBe('3S') // 8 hp, 5 spader
  })

  it('utgångsvärden + 4-korts högfärg → cue (Stayman)', () => {
    expect(l('S:KQ42 H:32 D:K432 C:Q32', 'hearts')).toBe('3H') // 10 hp, 4 spader
  })

  it('utgång med stopp → 2NT (slow shows, planerar 3NT)', () => {
    expect(l('S:Q43 H:KJ4 D:K432 C:Q32', 'hearts')).toBe('2NT') // 11 hp, stopp i hjärter
  })

  it('utgång utan stopp → direkt 3NT (förnekar stopp)', () => {
    expect(l('S:KQ4 H:32 D:KQ32 C:KQ2', 'hearts')).toBe('3NT') // ingen hjärterstopp
  })

  it('svag hand utan färg → pass', () => {
    expect(l('S:432 H:32 D:5432 C:5432', 'spades')).toBe('P') // 0 hp
  })
})
