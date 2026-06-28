import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { overcall, advanceOvercall, hasStopper } from './overcalls'

const o = (n: string, their: string) => overcall(parseHand(n), their).call

describe('overcall – inkliv över deras 1-läges öppning (§7.1–7.2)', () => {
  it('enkelt inkliv 1♠ över (1♦)', () => {
    expect(o('S:KQ542 H:K32 D:32 C:432', '1D')).toBe('1S') // 8 hp, 5 spader
  })
  it('enkelt inkliv på 2-läget: 2♥ över (1♠)', () => {
    expect(o('S:32 H:KQ542 D:K32 C:432', '1S')).toBe('2H') // 8 hp, 5 hjärter
  })
  it('1NT-inkliv med 15–18 balanserad och stopp', () => {
    expect(o('S:KQ4 H:KJ5 D:KQ32 C:Q42', '1H')).toBe('1NT') // 16 hp
  })
  it('Michaels (2♣) över (1♣): båda högfärgerna', () => {
    expect(o('S:KQ542 H:KJ543 D:3 C:32', '1C')).toBe('2C') // 5-5 hf
  })
  it('Michaels (2♠) över (1♠): andra högfärgen + minor', () => {
    expect(o('S:3 H:KQ542 D:KJ543 C:32', '1S')).toBe('2S') // 5 hjärter + 5 ruter
  })
  it('ovanlig 2NT över (1♠): två lägsta objudna (klöver+ruter)', () => {
    expect(o('S:3 H:32 D:KQ543 C:KJ542', '1S')).toBe('2NT') // 5-5 minorer
  })
  it('upplysningsdubbling över (1♥): kort i färgen, stöd i övriga, 12+', () => {
    expect(o('S:KQ43 H:3 D:KQ52 C:Q432', '1H')).toBe('X') // 12 hp, singel hjärter
  })
  it('pass med svag hand', () => {
    expect(o('S:432 H:432 D:5432 C:432', '1D')).toBe('P') // 0 hp
  })
  it('inget inkliv mot deras 1NT (hanteras av DONT)', () => {
    expect(o('S:KQ542 H:K32 D:32 C:432', '1NT')).toBe('P')
  })
})

describe('advanceOvercall – svar på partnerns inkliv (§7.1)', () => {
  it('cue i deras färg = limithöjning+ (bra stöd, 11+)', () => {
    expect(advanceOvercall(parseHand('S:K43 H:KQ2 D:432 C:K432'), 'spades', 'diamonds').call).toBe('2D')
  })
  it('konkurrenshöjning med stöd och under 11', () => {
    expect(advanceOvercall(parseHand('S:K43 H:Q42 D:432 C:Q432'), 'spades', 'diamonds').call).toBe('2S')
  })
  it('ny färg naturlig (egen 5-färg, ej stöd)', () => {
    expect(advanceOvercall(parseHand('S:KQ543 H:2 D:432 C:K432'), 'hearts', 'diamonds').call).toBe('2S')
  })
})

describe('hasStopper', () => {
  it('Kx är stopp', () => {
    expect(hasStopper(parseHand('S:K3 H:5432 D:5432 C:543'), 'spades')).toBe(true)
  })
  it('Qxx är stopp', () => {
    expect(hasStopper(parseHand('S:Q43 H:5432 D:543 C:543'), 'spades')).toBe(true)
  })
})
