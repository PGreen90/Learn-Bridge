import { describe, expect, it } from 'vitest'
import type { Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { openerRebidAfter1LevelResponse } from './rebids'

function reb(notation: string, opened: Suit, responder: Suit): string {
  return openerRebidAfter1LevelResponse(parseHand(notation), opened, responder).call
}

describe('openerRebidAfter1LevelResponse', () => {
  it('enkel höjning av svararens högfärg (minimum)', () => {
    expect(reb('S:K3 H:Q742 D:A52 C:K642', 'clubs', 'hearts')).toBe('2H') // 12 hp, 4 stöd
  })

  it('hopphöjning med 16–18', () => {
    expect(reb('S:K3 H:Q742 D:AQ2 C:KQ42', 'clubs', 'hearts')).toBe('3H') // 16 hp, 4 stöd
  })

  it('visar ny 4-korts högfärg billigt på 1-läget', () => {
    expect(reb('S:73 H:KJ85 D:Q2 C:AQ842', 'clubs', 'diamonds')).toBe('1H') // 4 hjärter
  })

  it('billig högfärg up the line – hjärter före spader', () => {
    expect(reb('S:KJ85 H:KQ85 D:2 C:A842', 'clubs', 'diamonds')).toBe('1H') // 4-4 hf
  })

  it('reverse med 16+ och längre första färg', () => {
    expect(reb('S:3 H:AQ85 D:AKJ85 C:K42', 'diamonds', 'spades')).toBe('2H') // 17 hp, 5-4
  })

  it('1NT (12–14) balanserad utan högfärg/stöd', () => {
    expect(reb('S:KJ3 H:A2 D:Q852 C:K642', 'clubs', 'hearts')).toBe('1NT') // 13 hp
  })

  it('2NT (18–19) balanserad', () => {
    expect(reb('S:KJ3 H:A2 D:KQ52 C:AQ42', 'clubs', 'hearts')).toBe('2NT') // 19 hp
  })

  it('rebjuder egen 6-korts färg (minimum)', () => {
    expect(reb('S:3 H:AQ8742 D:K52 C:K42', 'hearts', 'spades')).toBe('2H') // 12 hp, 6 hjärter
  })

  it('hopp i egen färg (16–18, inbjudan)', () => {
    expect(reb('S:A3 H:AQJ742 D:KQ2 C:42', 'hearts', 'spades')).toBe('3H') // 16 hp, 6 hjärter
  })

  it('ny lägre färg på 2-läget (naturlig, minimum)', () => {
    expect(reb('S:3 H:AQ842 D:K2 C:KQ85', 'hearts', 'spades')).toBe('2C') // 5-5, minimum
  })

  it('höjning av svararens minor (reservfall)', () => {
    expect(reb('S:32 H:K2 D:KJ85 C:AQ854', 'clubs', 'diamonds')).toBe('2D') // 13 hp, 4 stöd
  })
})
