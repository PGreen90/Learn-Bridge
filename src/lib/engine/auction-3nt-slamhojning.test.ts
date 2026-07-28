// FACIT-TEST för felrapport #42 (bricka 7): MISSAD LILLSLAM — 3NT PASSADES UT.
//
// Auktionen 1♣–1♥–1♠–2♦–2♥–3♦–3NT slutade där, trots att Nord satt med 21 hp
// (♠K ♥AQ93 ♦AKT74 ♣KQ7) mittemot en partner som ÖPPNAT, alltså visat 12+.
// 21 + 12 = 33 = slamzonen. Given gav 12 stick i 3NT (+3).
//
// Roten: systemets slamportar var inkopplade bara i den kanoniska linjens
// NAMNGIVNA mönster (Jacoby 2NT, inverterad minor, 1NT-återbudet, MSS …). När
// partnern placerar kontraktet i ett naturligt 3NT i en vanlig färgauktion fanns
// ingen kvantitativ höjning alls — kaptenen hade inget bud och passade.
//
// Ägarbeslut (rapportens fritext): "nord bör hoppa till 6nt efter syds 3nt bud".
// Regeln är systemets egen kaptensregel (CLAUDE.md / budsystem.md §5.2): egen
// hand + partnerns VISADE minimum ≥ 33 → driv. Partnern har ÖPPNAT, så det
// visade minimet är 12 → tröskeln blir 21 hp. Ingen kontrollkoll (ägarbeslut),
// och storslam kräver visshet → taket är 6NT.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'

const call = (seat: Seat, bid: string): ResolvedCall =>
  ({ seat, bid, rule: '', explanation: '' }) as ResolvedCall

const deal: Deal = {
  id: 'felrapport-42',
  board: 7,
  dealer: 'S',
  vulnerability: 'all',
  hands: {
    N: parseHand('S:K H:AQ93 D:AKT74 C:KQ7'),   // 21 hp – kaptenen
    E: parseHand('S:Q7643 H:754 D:J92 C:62'),
    S: parseHand('S:AJ98 H:KJT D:53 C:AT43'),   // 13 hp – öppnade 1♣ (visat 12+)
    W: parseHand('S:T52 H:862 D:Q86 C:J985'),
  },
}

// Rapportens auktion fram till Nords tur efter Syds 3NT.
const upTo3NT: ResolvedCall[] = [
  call('S', '1C'), call('W', 'P'), call('N', '1H'), call('E', 'P'),
  call('S', '1S'), call('W', 'P'), call('N', '2D'), call('E', 'P'),
  call('S', '2H'), call('W', 'P'), call('N', '3D'), call('E', 'P'),
  call('S', '3NT'), call('W', 'P'),
]

describe('Felrapport #42 – kvantitativ höjning av partnerns naturliga 3NT', () => {
  it('Nord höjer 3NT till 6NT (21 hp mot partnerns visade 12+ = 33)', () => {
    const n = decideCall(deal, upTo3NT, 'N')
    expect(n.bid).toBe('6NT')
    expect(n.rule).toBe('slamhöjning av 3NT')
  })

  it('hela bot-auktionen landar i slam i stället för 3NT', () => {
    const history = botAuction(deal)
    expect(history).not.toBeNull()
    const contract = contractFromCalls(history!)
    expect(contract).toMatchObject({ level: 6, strain: 'NT' })
  })

  // Tröskeln låses åt andra hållet: 20 hp = 32 mot visat minimum → under
  // drivzonen, kaptenen passar 3NT (hellre systemriktig miss än gambling).
  it('20 hp (32 mot visat minimum) passar 3NT – tröskeln 21 står', () => {
    const svagare: Deal = {
      ...deal,
      id: 'felrapport-42-under',
      hands: { ...deal.hands, N: parseHand('S:K H:AQ93 D:AKT74 C:KJ7') }, // 20 hp
    }
    expect(decideCall(svagare, upTo3NT, 'N').bid).toBe('P')
  })

  // Partnern måste ha ÖPPNAT för att 12-golvet ska vara ärligt. Har hen bara
  // svarat (t.ex. tvingat efter vår egen öppning) vet vi ingenting säkert.
  it('rör inte partnerns 3NT när partnern inte är öppnaren', () => {
    const egenOppning: ResolvedCall[] = [
      call('N', '1D'), call('E', 'P'), call('S', '3NT'), call('W', 'P'),
    ]
    expect(decideCall(deal, egenOppning, 'N').rule).not.toBe('slamhöjning av 3NT')
  })

  // Vild fördelning hör inte hemma i 6NT – kaptenen har renons och lämnar läget.
  it('renons i handen → ingen 6NT-höjning', () => {
    const vild: Deal = {
      ...deal,
      id: 'felrapport-42-renons',
      hands: { ...deal.hands, N: parseHand('S:- H:AQ93 D:AKT742 C:KQ76') },
    }
    expect(decideCall(vild, upTo3NT, 'N').rule).not.toBe('slamhöjning av 3NT')
  })
})
