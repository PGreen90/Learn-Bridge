// MOTORBYTETS FACIT-KÖ (docs/motorbyte-plan.md, grind 0 2026-09-04).
//
// Under motorbytet lappas inte manuset/detektorkedjan. Ett fel som hittas
// under tiden får sitt facit HÄR som `it.todo` — med frö, budföljd och det bud
// boken kräver — och lagas i det NYA lagret när familjen kommer (etapp 3/4).
// När familjen landar byts `it.todo` mot `it` och testet ska gå grönt.
//
// Facit-buden nedan är Claudes förslag ur boken; ägaren bekräftar dem vid
// familjens grind (mänsklig input i konkreta budsituationer hör dit).
//
// Återskapa en giv: $env:DUMP='<frö>'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed } from './revisor'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

// Pliktsvepets två rester (pausat 2026-09-04, docs/bevaka.md 2026-09-02).

describe('etapp 4 familj 1 – inkliv och advance: tvåfärgsinklivarens fortsättning', () => {
  it.todo('frö 20261162: 1♥–(2NT)–4♥–P–P: Nord (♠A ♥K ♦A8643 ♣AKT732, 20 hp, 6-5) bjuder 5♣ — inte pass', () => {
    const deal = dealFromSeed(20261162)
    const hist = [call('W', '1H'), call('N', '2NT'), call('E', '4H'), call('S', 'P'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('5C')
  })

  it.todo('frö 20262021: 1♠–(2NT)–3♠: Öst (♠T832 ♥J2 ♦KQJ ♣AQT3, 12 hp, stöd i båda lågfärgerna) bjuder 4♣ — inte pass', () => {
    const deal = dealFromSeed(20262021)
    const hist = [call('S', '1S'), call('W', '2NT'), call('N', '3S')]
    expect(decideCall(deal, hist, 'E').bid).toBe('4C')
  })
})

// Motorfynd ur betydelsesvepet (etapp 1, 2026-09-04): motorn bjuder ett bud vars
// systembetydelse (läst ur auktionen) är en annan än den hand motorn har.

describe('etapp 3 familj 2 – svaret: stark 2♣ (§4.4)', () => {
  it.todo('frö 20271509: 2♣–2♦–2♠: Syd (♠63 ♥654 ♦876 ♣A9543, 5 hp) får inte bjuda 3♣ som naturlig klöver — 3♣ ÄR andra negativa (0–3 hp); med 4+ hp och 5 klöver bjuds något annat (t.ex. 3♠-stöd/2NT enligt boken)', () => {
    const deal = dealFromSeed(20271509)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '2C'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    const c = decideCall(deal, hist, 'S')
    expect(c.bid === '3C' && c.rule !== 'andra negativa').toBe(false)
  })
})

describe('etapp 3 familj 2/5 – stark 2♣: en auktionsform, en betydelse', () => {
  it.todo('frö 20271084: 2♣–3♦–3♥–4♦ måste betyda samma sak som 2♣–3♦–3♠–4♦ (frö 20271411, manuset: cue-bid) — idag naturlig rebud via kravsteget', () => {
    const deal = dealFromSeed(20271084)
    const hist = [call('W', 'P'), call('N', '2C'), call('E', 'P'), call('S', '3D'), call('W', 'P'), call('N', '3H'), call('E', 'P')]
    const c = decideCall(deal, hist, 'S')
    // En namngiven regel ur tabellen — aldrig kravstegets "auktionen är krav"-fallback.
    expect(c.rule?.startsWith('krav – ')).toBe(false)
  })
})

describe('etapp 3 familj 2 – svaret: svaga tvåor (§4.5)', () => {
  it.todo('frö 20271048: 2♠–3♥ (krav): Öst (♠KJ9653 ♥A98 ♦5 ♣JT2) höjer till 4♥, inte 5♥ — utgången är 4♥ och 5♥ är ingen slaminbjudan med svag tvåa', () => {
    const deal = dealFromSeed(20271048)
    const hist = [call('N', 'P'), call('E', '2S'), call('S', 'P'), call('W', '3H'), call('N', 'P')]
    expect(decideCall(deal, hist, 'E').bid).toBe('4H')
  })
})

describe('etapp 4 familj 4 – svararens fortsättning i konkurrens', () => {
  it.todo('frö 20262632: 1♦–(1♠)–2♥–P–3♦–P: Nord (♠A ♥AKJ87542 ♦T97 ♣7) bjuder 4♥ — den egna 8-korts färgen vinner över 3-korts ♦-fit (inte 5♦)', () => {
    const deal = dealFromSeed(20262632)
    const hist = [call('E', 'P'), call('S', '1D'), call('W', '1S'), call('N', '2H'), call('E', 'P'), call('S', '3D'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('4H')
  })
})
