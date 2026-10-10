// FACIT FÖRE FIX — 5♥/5♠ ÄR ALDRIG EN SLAMINBJUDAN (ägarbeslut 2026-10-10):
// "5 hjärter/spader är ett bud som inte skall användas som invit. Om man har
// tillräckligt med poäng så ska man essfråga."
//
// Förr: kaptenen i kanske-zonen (31–32 mot partnerns visade minimum) bjöd 5M
// som inbjudan och partnern accepterade rakt till 6M utan esskontroll — i alla
// lägen med högfärgstrumf (Jacoby minimum/sidofärg/slamintresse, stark 2♣,
// Puppet, splinter-relä, hopphöjning, NMF-fit …). Skannat 300 000 frön
// (20276001–20576000, samma skanner som slaminbjudan-4m.probe men för 5M):
// 422 auktioner, alla med accept rakt till 6M.
// Nu: 31+ mot visat minimum → 4NT (1430 RKC), placering på svaret; under 31 står
// utgången. Hp räknade med kod (hcp/parseHand, dealFromSeed), summa 40 per giv.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import { hcp } from './hand'

const bud = (d: Deal) => botAuction(d)!.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)
const summa40 = (d: Deal) => expect((['N', 'E', 'S', 'W'] as const).reduce((a, s) => a + hcp(d.hands[s]), 0)).toBe(40)
/** Ingen 5M-inbjudan, och slam bara efter 4NT. */
const ingenInbjudan = (seed: number) => {
  const d = dealFromSeed(seed)
  summa40(d)
  const calls = botAuction(d)!
  expect(calls.map((c) => c.rule), bud(d).join(' ')).not.toContain('slaminbjudan')
  const slut = contractFromCalls(calls)
  if (slut && slut.level >= 6) expect(bud(d).some((x) => x.endsWith(':4NT')), `slam utan essfråga: ${bud(d).join(' ')}`).toBe(true)
  return bud(d)
}

describe('5M är aldrig en slaminbjudan — kaptenen frågar 4NT från 31 mot visat minimum', () => {
  // Frö 20280063 (giv N, ÖV i zon): Öst öppnar 1♥, Väst Jacoby 2NT, Öst 4♥ = minimum.
  // Väst 31–32 bjöd förr 5♥ (inbjudan) och Öst accepterade 6♥. Nu frågar Väst 4NT.
  it('Jacoby minimum (1♥–2NT–4♥): 4NT, inte 5♥', () => {
    const b = ingenInbjudan(20280063)
    expect(b.slice(0, 4)).toEqual(['E:1H', 'W:2NT', 'E:4H', 'W:4NT'])
  })
  it('Jacoby sidofärg (1♠–2NT–4♥): 4NT, inte 5♠', () => {
    const b = ingenInbjudan(20283677)
    expect(b.slice(0, 4)).toEqual(['N:1S', 'S:2NT', 'N:4H', 'S:4NT'])
  })
  it('Jacoby slamintresse (1♥–2NT–3♥): ingen 5♥', () => {
    ingenInbjudan(20348859)
  })
  it('stark 2♣ + 2NT-positivt + öppnarens högfärg (2♣–2NT–3♥): ingen 5♥', () => {
    ingenInbjudan(20276236)
  })
  it('stark 2♣ + färgpositivt + stöd (2♣–2♥–3♥): ingen 5♥', () => {
    ingenInbjudan(20284369)
  })
  it('Puppet Stayman: öppnarens 4M-placering → ingen 5M', () => {
    ingenInbjudan(20299336)
  })
  it('tvetydig splinter + relä: ingen 5M', () => {
    ingenInbjudan(20278716)
  })
  it('hopphöjning (1♣–1♠–3♠): ingen 5♠', () => {
    ingenInbjudan(20348801)
  })
  it('NMF-fit (1♦–1♥–1NT–2♣–3♣–3♥–4♥): ingen 5♥', () => {
    ingenInbjudan(20281745)
  })
  it('transfer över 2NT: ingen 5M', () => {
    ingenInbjudan(20475912)
  })
})
