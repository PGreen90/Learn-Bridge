import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { openerRebidAfterJordan2NT } from './rebids'
import { jordanRaiseAfterSignoff } from './responder-rebids'
import { botAuction, dealFromSeed } from './revisor'

// =============================================================================
// JORDAN 2NT — ÖPPNARENS FORTSÄTTNING (systemfel-kandidat #4, facit FÖRE fix).
//
// 1M–(X)–2NT är Jordan/Truscott: limithöjning eller bättre (10+, 4+ stöd).
// Motorn bjöd Jordan men ÖPPNAREN SAKNADE fortsättning helt → frö 20260739:
// S öppnar 1♥ (♠A73 ♥KQ542 ♦J72 ♣A7, 14 hp), W dubblar, N bjuder 2NT (14 hp,
// 4 stöd) — och S PASSAR med 9-korts fit och 28 hp ihop.
//
// Schema (källa bridgebum jordan_2nt.php, ägarbeslut 2026-08-07 "bara 3M/4M"):
//   3M = minimum, avslut (Jordan-bjudaren passar med 10–12, höjer med 13+)
//   4M = utgångsvärden
// Tröskeln räknas i STÖDPOÄNG mot den kända 9-korts fiten (pointsWithFloor,
// aldrig under hp): ≤14 → 3M, 15+ → 4M. Ny-färg-utgångsförsöket (bridgebums
// mellansteg) byggs INTE nu (ägarbeslut: minsta ärliga fixen).
// Boken §7.3 + §9.
// =============================================================================

describe('öppnarens återbud efter Jordan 2NT (1M–X–2NT)', () => {
  it('frö 20260739:s öppnare: 14 hp → 15 stödpoäng (dubbelton) → 4♥', () => {
    const r = openerRebidAfterJordan2NT(parseHand('S:A73 H:KQ542 D:J72 C:A7'), 'hearts')
    expect(r.call).toBe('4H')
  })

  it('minimum (13 stödpoäng) → 3♥ (avslut)', () => {
    const r = openerRebidAfterJordan2NT(parseHand('S:A73 H:KQ542 D:K72 C:87'), 'hearts')
    expect(r.call).toBe('3H')
  })
})

describe('Jordan-bjudarens fortsättning efter öppnarens 3M-avslut', () => {
  it('utgångsstyrka (13+) höjer till 4M — 3M får aldrig dö med utgång på handen', () => {
    // Frö 20260739:s Jordan-bjudare (14 hp): hade öppnaren avslutat 3♥ ska hen vidare.
    const r = jordanRaiseAfterSignoff(parseHand('S:K95 H:J763 D:AK8 C:K64'), 'hearts')
    expect(r.call).toBe('4H')
  })

  it('ren limithöjning (10–12) respekterar avslutet: pass', () => {
    const r = jordanRaiseAfterSignoff(parseHand('S:K95 H:J763 D:KQ8 C:Q64'), 'hearts')
    expect(r.call).toBe('P')
  })
})

describe('frö 20260739 – hela bordet', () => {
  it('öppnaren passar inte Jordan: slutkontraktet är 4♥', () => {
    const calls = botAuction(dealFromSeed(20260739))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBe(4)
    expect(contract!.strain).toBe('hearts')
  })
})
