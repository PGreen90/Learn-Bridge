import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { simulateAuction } from './contract-target'
import { contractFromCalls } from './auction-live'

// =============================================================================
// FACIT: slam-utforskning efter öppnarens HOPP-ÅTERBUD i egen minor (1m–1M–3m).
// Felrapport #29 + ÄRLIGA SLAMPORTAR (ägarbeslut 2026-07-07): svararen (kaptenen)
// räknar SIN hand mot återbudets visade 16–18 — aldrig öppnarens faktiska kort.
// Driv från 17 stödpoäng (17+16=33), inbjudan 4m från 15 (31–32); under det
// följer paret systemet och stannar i utgång ÄVEN om slammen råkar sitta.
// =============================================================================

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'all', board: 13,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('FACIT: slam efter hopp-återbud i minor (felrapport #29, ärliga portar)', () => {
  it('#29-originalgiven: S har bara 13 hp mot visade 16–18 → ÄRLIG MISS, paret stannar i 3NT', () => {
    // Slammen är kall (13 stick DD) men bara tack vare N:s exakta maximum +
    // frilägen — ingen människa som följer systemet driver på 13 mot 16–18
    // (golv 29, under inbjudningszonen 31). Förr hittades den för att motorn
    // KIKADE i bägge händerna; ägarbeslutet 2026-07-07 avskaffade det. Detta
    // test låser den ärliga missen medvetet.
    const deal = dealOf('N', {
      N: 'S:73 H:AQ3 D:AJ C:AQJT94',
      E: 'S:J96 H:KT76 D:964 C:K82',
      S: 'S:AK42 H:J2 D:KQ85 C:653',
      W: 'S:QT85 H:9854 D:JT3 C:7',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBe(3)
    expect(contract!.strain).toBe('NT') // ärlig utgång, ingen slamblast på kik
  })

  it('med riktiga slamvärden (15 hp + fit = inbjudningszon): 1♣–1♠–3♣–4♣ → öppnaren accepterar → 6♣', () => {
    // Samma giv men S har ♥K i stället för ♥J (15 hp → golv 31–32 mot visade
    // 16–18) → S bjuder in med 4♣; N (18 hp + 6:e klövern, klart över minimum)
    // accepterar 6♣. Ärligt: båda dömer på EGEN hand + partnerns visade bud.
    const deal = dealOf('N', {
      N: 'S:73 H:AQ3 D:AJ C:AQJT94',
      E: 'S:J96 H:JT76 D:964 C:K82',
      S: 'S:AK42 H:K2 D:KQ85 C:653',
      W: 'S:QT85 H:9854 D:JT3 C:7',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam via inbjudan + accept
    expect(contract!.strain).toBe('clubs')
  })
})
