// LIVE-PROV (2026-09-12): dubblarens CUE-höjning av advancerns advance —
// cuet är krav och FÅR ALDRIG passas. Fältfynd Bricka 9 (ÖV i zon).
//
// Ö 1♣ · S X (stark upplysning, 21 hp) · V pass · N 1♠ (advance) · Ö pass ·
// S 2♣ = cue = stark spaderhöjning (för stark för att bara höja), utgångskrav.
// Förr passade Nord 2♣ ut → kontrakt 2♣ (katastrof). Nu svarar advancern och
// visar styrka på den bekräftade fiten (ägarschema 2026-09-12):
//   4+ spader: under 8 hp → 2♠, 8+ → 3♠ ; utan 4 spader: 2NT/3NT.
// Dubblaren placerar minst utgång (4♠ över fitsvaret, 3NT över 2NT).

import { describe, expect, it } from 'vitest'
import type { Deal, Rank, Card, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: 'N' | 'E' | 'S' | 'W', bid: string): ResolvedCall => ({ seat, bid })

const dealNS = (n: string, s: string): Deal => {
  const N = parseHand(n)
  const S = parseHand(s)
  const used = new Set([...N, ...S].map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  return { id: 'facit', dealer: 'N', vulnerability: 'ew', board: 9, hands: { N, S, E: rest.filter((_, i) => i % 2 === 0), W: rest.filter((_, i) => i % 2 === 1) } }
}

// Syd = den starka dubblaren.
const SYD = 'S:AQJ9 H:Q8 D:KQ63 C:AK3'
// Auktionen fram till dubblarens cue (Syds 2♣).
const TILL_CUE: ResolvedCall[] = [
  call('N', 'P'), call('E', '1C'), call('S', 'X'), call('W', 'P'),
  call('N', '1S'), call('E', 'P'), call('S', '2C'), call('W', 'P'),
]

describe('Dubblarens cue-höjning — advancern svarar, cuet passas aldrig (Bricka 9)', () => {
  // Nord: 4 spader, 6 hp (< 8) → 2♠.
  const NORD_4SP_SVAG = 'S:KT64 H:J96 D:T85 C:Q64'

  it('Nord passar INTE dubblarens cue', () => {
    const deal = dealNS(NORD_4SP_SVAG, SYD)
    expect(decideCall(deal, TILL_CUE, 'N').bid).not.toBe('P')
  })

  it('Nord med 4 spader och < 8 hp svarar 2♠', () => {
    const deal = dealNS(NORD_4SP_SVAG, SYD)
    expect(decideCall(deal, TILL_CUE, 'N').bid).toBe('2S')
  })

  it('Dubblaren placerar 4♠ över fitsvaret 2♠', () => {
    const deal = dealNS(NORD_4SP_SVAG, SYD)
    const hist = [...TILL_CUE, call('N', '2S'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('4S')
  })

  // Nord: 4 spader, 9 hp (8+) → 3♠.
  const NORD_4SP_STARK = 'S:KT64 H:KJ6 D:T85 C:Q64'

  it('Nord med 4 spader och 8+ hp svarar 3♠', () => {
    const deal = dealNS(NORD_4SP_STARK, SYD)
    expect(decideCall(deal, TILL_CUE, 'N').bid).toBe('3S')
  })

  // Nord: bara 3 spader, 6 hp → 2NT (styr om, förnekar 4-korts fit).
  const NORD_3SP_SVAG = 'S:K64 H:J962 D:T85 C:Q64'

  it('Nord utan 4 spader och < 8 hp svarar 2NT (inte 2♠)', () => {
    const deal = dealNS(NORD_3SP_SVAG, SYD)
    expect(decideCall(deal, TILL_CUE, 'N').bid).toBe('2NT')
  })

  it('Dubblaren placerar 3NT över 2NT', () => {
    const deal = dealNS(NORD_3SP_SVAG, SYD)
    const hist = [...TILL_CUE, call('N', '2NT'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('3NT')
  })
})
