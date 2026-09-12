// LIVE-PROV etapp 6 (2026-09-12): RKC-FRÅGAREN placerar — trumfdamen avgör
// lillslam mot utgång, och frågaren kan vara ÖPPNAREN.
//
// Bricka 14 (ägaren provspelade, inget frö sparat → given återskapad ur Syds
// hand + auktionen). Syd öppnar 2♣, visar spader, partnern höjer till 4♠, och
// SYD (öppnaren) frågar 4NT RKC. Partnern svarar 5♦ = 0 eller 3 nyckelkort.
//
// Syd: ♠AK842 ♥AKQ73 ♦AK ♣2 — fyra nyckelkort själv (♠A ♠K ♥A ♦A). Partnerns
// 5♦ måste vara 0 (3 är omöjligt mittemot fyra) → ♣A ligger hos motståndarna,
// en SÄKER förlorare i 6♠. Då tål slammen ingen andra förlorare — och utan
// trumfdamen (8-korts fit, damen kan sitta illa) tappas ett trumfstick.
// Alltså: 5♥ är trumfdam-FRÅGAN, inte "utgång i hjärter". Visas damen → 6♠;
// nekas den → 5♠ är taket.
//
// Buggen: slammodulen modellerar KAPTENEN som svararen; när öppnaren frågar
// RKC matchar ingen slamrad → läget föll till catch-all PASS, och 5♥ lästes
// naturligt. Fixen: frågarens placering (seat-agnostiskt), med damfrågan som
// verktyg.

import { describe, expect, it } from 'vitest'
import type { Deal, Rank, Card, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: 'N' | 'E' | 'S' | 'W', bid: string): ResolvedCall => ({ seat, bid })

/** Giv ur Nords och Syds händer; resten delas växelvis till Öst/Väst. */
const dealNS = (n: string, s: string): Deal => {
  const N = parseHand(n)
  const S = parseHand(s)
  const used = new Set([...N, ...S].map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  return { id: 'facit', dealer: 'S', vulnerability: 'none', board: 14, hands: { N, S, E: rest.filter((_, i) => i % 2 === 0), W: rest.filter((_, i) => i % 2 === 1) } }
}

// Syd = frågaren (öppnaren). Auktionen fram till Syds placering efter 5♦.
const SYD = 'S:AK842 H:AKQ73 D:AK C:2'
const AUKTION: ResolvedCall[] = [
  call('S', '2C'), call('W', 'P'),
  call('N', '2D'), call('E', 'P'),
  call('S', '2S'), call('W', 'P'),
  call('N', '4S'), call('E', 'P'),
  call('S', '4NT'), call('W', 'P'),
  call('N', '5D'), call('E', 'P'),
]

describe('RKC-frågaren: trumfdamen avgör (öppnaren frågar) — Bricka 14', () => {
  // Partnern saknar damen och har bara 3 spader (8-korts fit) → damen är inte
  // säkrad. Frågaren MÅSTE fråga, inte gissa 6♠.
  const NORD_UTAN_DAM = 'S:J93 H:J84 D:QT97 C:KJ5'

  it('Syd frågar trumfdam med 5♥ (inte 6♠, inte PASS) efter 4NT–5♦', () => {
    const deal = dealNS(NORD_UTAN_DAM, SYD)
    expect(decideCall(deal, AUKTION, 'S').bid).toBe('5H')
  })

  it('Partnern utan damen nekar med 5♠ på damfrågan', () => {
    const deal = dealNS(NORD_UTAN_DAM, SYD)
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('5S')
  })

  it('Syd passar 5♠ när damen nekats (utgång är taket, ♣A + trumfdam = två förlorare)', () => {
    const deal = dealNS(NORD_UTAN_DAM, SYD)
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P'), call('N', '5S'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('P')
  })

  // Motprov: partnern HAR damen → visar den → Syd bjuder lillslam.
  const NORD_MED_DAM = 'S:Q93 H:J84 D:QJT9 C:K85'

  it('Partnern med damen visar den på damfrågan (inte 5♠)', () => {
    const deal = dealNS(NORD_MED_DAM, SYD)
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).not.toBe('5S')
  })

  it('Syd bjuder 6♠ när damen visats', () => {
    const deal = dealNS(NORD_MED_DAM, SYD)
    const svar = decideCall(dealNS(NORD_MED_DAM, SYD), [...AUKTION, call('S', '5H'), call('W', 'P')], 'N').bid
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P'), call('N', svar), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('6S')
  })
})
