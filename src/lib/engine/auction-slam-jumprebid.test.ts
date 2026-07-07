import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { simulateAuction } from './contract-target'
import { contractFromCalls } from './auction-live'

// =============================================================================
// FACIT: slam-utforskning efter öppnarens HOPP-ÅTERBUD i egen minor (1m–1M–3m).
// Felrapport #29: "Det finns slam i korten för N/S, hur skall vi hitta den?"
// N ♣AQJT94 (19) öppnar 1♣, S svarar 1♠, N hoppar 3♣ (16–18, 6+ klöver). S har
// klöverfit + slamvärden (♠AK ♦KQ, 13 hp). Boten stannade i 3NT; slammen 6♣/6NT
// är KALL (13 stick DD). Nu driver paret via 4NT RKC → 6♣.
//
// Fix: `buildAuction` kopplar in `slamInvestigation` (klöver trumf, skipCueRound)
// efter hopp-återbudet när svararen har 3+ stöd; slamzon-porten (≥33 stödpoäng)
// + nyckelkortsporten (≥4/5) hindrar överbud på icke-slamhänder.
// =============================================================================

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'all', board: 13,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('FACIT: slam efter hopp-återbud i minor (felrapport #29)', () => {
  it('#29-given: 1♣–1♠–3♣ → paret hittar slammen (6-läget), inte 3NT', () => {
    const deal = dealOf('N', {
      N: 'S:73 H:AQ3 D:AJ C:AQJT94',
      E: 'S:J96 H:KT76 D:964 C:K82',
      S: 'S:AK42 H:J2 D:KQ85 C:653',
      W: 'S:QT85 H:9854 D:JT3 C:7',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam, inte 3NT
    expect(contract!.strain).toBe('clubs') // 6♣ (klöverfit)
  })
})
