import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// Punkt 27: motståndaren (LHO) kliver in på riktigt och svararen reagerar.

describe('buildAuction – störd budgivning (punkt 27)', () => {
  it('1♦ – (1♠) – X (negativ dubbling med 4 hjärter)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K2 H:432 D:KQ543 C:A32'), // 12 hp, 5 ruter → öppnar 1♦
        E: parseHand('S:AQ876 H:K5 D:32 C:K432'), // 12 hp, 5 spader → kliver in 1♠
        S: parseHand('S:32 H:KQ43 D:K32 C:5432'), // 8 hp, 4 hjärter → negativ X
        W: parseHand('S:JT9 H:JT9 D:T9 C:QJ98'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['1D', '1S', 'X'])
    expect(a?.turns[1].role).toBe('motståndare')
  })

  it('1♥ – (1♠) – 2♥ (konkurrenshöjning med stöd, ingen objuden högfärg)', () => {
    const deal: Deal = {
      id: 'test',
      board: 2,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K2 H:AKJ43 D:K32 C:432'), // 14 hp, 5 hjärter → öppnar 1♥
        E: parseHand('S:AQ876 H:K5 D:K432 C:32'), // 12 hp, 5 spader → kliver in 1♠
        S: parseHand('S:Q43 H:K987 D:K32 C:432'), // 8 hp, 4 stöd → 2♥ konkurrens
        W: parseHand('S:JT9 H:Q2 D:QT9 C:KQJ98'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['1H', '1S', '2H'])
  })

  it('ostört (LHO passar) → vanligt svar, ingen motståndarrad', () => {
    const deal: Deal = {
      id: 'test',
      board: 3,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:K2 H:AKJ43 D:K32 C:432'), // öppnar 1♥
        E: parseHand('S:QJ9 H:Q2 D:QT98 C:QJ95'), // 10 hp, ingen 5-färg → passar
        S: parseHand('S:Q43 H:K987 D:K32 C:432'), //  4 stöd
        W: parseHand('S:T87 H:65 D:A765 C:T765'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.every((t) => t.role !== 'motståndare')).toBe(true)
  })
})
