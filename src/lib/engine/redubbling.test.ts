// REDUBBLINGENS BETYDELSE (ägarstruktur 2026-11-16, förslag #128 — bricka 2 i
// Veckans stjärntävling nr 1). Tre lägen:
//   • XX på 3-läget och uppåt = styrka, "vi spelar här" → partnern PASSAR.
//   • XX när jag ville stöddubbla men de dubblade = stödredubbling (exakt tre).
//   • XX på 1- och 2-läget i övrigt = 8+ hp, säger inget om färger.
// Förr saknades regeln för 3-läget+: partnern föll till kravstegets "auktionen
// är krav" och höjde 4♠XX → 5♠ → 6♠ → 7♠ (#128).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

const TOM = 'S:- H:- D:- C:-'
const seats: Seat[] = ['N', 'E', 'S', 'W']
/** Budföljd från `dealer`, t.ex. '1H 2D P 3S'. */
function auktion(dealer: Seat, bud: string): ResolvedCall[] {
  const start = seats.indexOf(dealer)
  return bud.split(' ').map((bid, i) => ({ seat: seats[(start + i) % 4], bid } as ResolvedCall))
}
function giv(dealer: Seat, hands: Partial<Record<Seat, string>>): Deal {
  return {
    id: 't', board: 2, dealer, vulnerability: 'ns',
    hands: Object.fromEntries(seats.map((s) => [s, parseHand(hands[s] ?? TOM)])),
  } as Deal
}

describe('XX på 3-läget och uppåt = vi spelar här → partnern passar (#128)', () => {
  const NORD = 'S:Q9832 H:Q D:J942 C:AJ5'

  it('#128: (1♥)–2♦–(P)–3♠–(4♥)–4♠–(P)–P–(X)–XX–(P)–? → Nord passar (förr 5♠)', () => {
    const h = auktion('E', '1H 2D P 3S 4H 4S P P X XX P')
    expect(decideCall(giv('E', { N: NORD }), h, 'N')).toMatchObject({ bid: 'P', rule: 'pass på partnerns redubbling' })
  })

  it('3NT redubblat står: 1NT–(P)–3NT–(X)–XX–(P)–? → pass', () => {
    const h = auktion('N', '1NT P 3NT X XX P')
    expect(decideCall(giv('N', { S: 'S:K32 H:Q52 D:KJ4 C:Q932' }), h, 'S').bid).toBe('P')
  })

  it('3-läget: 1♠–(P)–3♠–(X)–XX–(P)–? → pass', () => {
    const h = auktion('N', '1S P 3S X XX P')
    expect(decideCall(giv('N', { S: 'S:K932 H:A52 D:Q74 C:J32' }), h, 'S').bid).toBe('P')
  })

  it('bjuder de vidare över XX är läget fritt (raden tiger)', () => {
    const h = auktion('E', '1H 2D P 3S 4H 4S P P X XX 5H')
    expect(decideCall(giv('E', { N: NORD }), h, 'N').rule).not.toBe('pass på partnerns redubbling')
  })
})

// Väntar på ägarens besked om FORTSÄTTNINGEN efter XX (2026-11-16): sänkningen
// till 8+ provbyggdes och gav 1♠ utpassat med 22 hp ihop (frö 20262689) —
// redubblaren och öppnaren har i dag nästan inga bud efter deras flykt.
describe('XX på 1- och 2-läget (ägarstruktur 2026-11-16) — ej byggt än', () => {
  it.todo('1♥–(X)–? med 9 hp utan stöd → XX (8+, säger inget om färger)')
  it.todo('1♦–(X)–? med 8 hp → XX')
  it.todo('fortsättningen efter XX: öppnaren och redubblaren passar inte ut deras flykt')
  it.todo('stödredubbling: 1♣–(P)–1♥–(X)–XX = exakt tre hjärter')
})
