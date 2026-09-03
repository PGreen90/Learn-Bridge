// Pliktsvepet K2 (2026-09-02, docs/senare.md "Svep: partnerskapsplikter i
// konkurrens"): den NEGATIVA DUBBLAREN gav ingen preferens till öppningsfärgen
// när partnerns tvingade svar landade i en färg med sämre stöd — svepet fann
// 8 av 1539 störda auktioner (t.ex. frö 20262871: 1♦–(1♠)–X–P–2♣–P–P med
// ♦K752 ♣73; 2♦ kostar inget). `negativeDoublerContinues` täckte bara
// invitzonen (9–12 hp). Nu gäller advancer-preferensens kriterier (#56) även
// här: gratis → lika lång eller längre öppningsfärg (minst 3 kort); kostar
// den en nivå → 2+ korts skillnad; aldrig förbi utgång.
//
// Kör om svepet: $env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed } from './revisor'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('pliktsvep K2 – negativ-dubblarens preferens till öppningsfärgen', () => {
  it('frö 20262871: 1♦–(1♠)–X–P–2♣–P: Öst (♦K752 ♣73, 7 hp) ger preferens 2♦', () => {
    const deal = dealFromSeed(20262871)
    const hist = [call('W', '1D'), call('N', '1S'), call('E', 'X'), call('S', 'P'), call('W', '2C'), call('N', 'P')]
    const c = decideCall(deal, hist, 'E')
    expect(c.bid).toBe('2D')
    expect(c.rule).toBe('negativ-dubblarens preferens')
  })

  it('frö 20263219: 3-3 i öppnings- och svarsfärgen, samma nivå → preferens 2♦ (öppningsfärgen är längst hos partnern)', () => {
    const deal = dealFromSeed(20263219)
    const hist = [call('W', 'P'), call('N', '1D'), call('E', '1S'), call('S', 'X'), call('W', 'P'), call('N', '2C'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('2D')
  })

  it('frö 20263504: 1♥–(2♣)–X–P–2♦–P: Öst (♥Q85 ♦752) ger preferens 2♥ till högfärgen', () => {
    const deal = dealFromSeed(20263504)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', '1H'), call('N', '2C'), call('E', 'X'), call('S', 'P'), call('W', '2D'), call('N', 'P')]
    expect(decideCall(deal, hist, 'E').bid).toBe('2H')
  })

  it('frö 20263360: kostar preferensen en nivå krävs klar skillnad — 4-2 → 3♦', () => {
    const deal = dealFromSeed(20263360)
    const hist = [call('W', 'P'), call('N', 'P'), call('E', '1D'), call('S', '2C'), call('W', 'X'), call('N', 'P'), call('E', '2H'), call('S', 'P')]
    expect(decideCall(deal, hist, 'W').bid).toBe('3D')
  })

  it('frö 20263524: bara två kort i öppningsfärgen → ingen preferens (pass som förr)', () => {
    const deal = dealFromSeed(20263524)
    const hist = [call('N', 'P'), call('E', 'P'), call('S', '1S'), call('W', '2C'), call('N', 'X'), call('E', 'P'), call('S', '2D'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('P')
  })
})
