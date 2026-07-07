import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { simulateAuction } from './contract-target'
import { contractFromCalls } from './auction-live'

// =============================================================================
// FACIT: slam-utforskning efter öppnarens 1NT-ÅTERBUD (1m–1M–1NT).
// F1 (bredda slam-utforskningen), familj A. En utforskningsprob (40 000 givar,
// DD-lösta) visade att en svarare med slamvärden mittemot öppnarens 12–14 1NT-
// återbud bara blåste 3NT – slam-arsenalen var inte inkopplad i den formen.
//
// Balanserad delmängd: svararen är jämn (ingen 5-korts färg) → NT-slam via Gerber
// 4♣ (§6.4: 4♣ = Gerber även över ett NT-ÅTERBUD). Paret räknar faktiska ess och
// landar 6NT i stället för 3NT när slamzonen (≥33 hp ihop) nås.
// =============================================================================

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'all', board: 13,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('FACIT: slam efter 1NT-återbud (F1 familj A)', () => {
  it('1♣–1♥–1NT: jämn svarare med slamvärden når 6NT (Gerber), inte 3NT', () => {
    // N 13 hp balanserad (öppnar 1♣, rebjuder 1NT); S 20 hp balanserad med ALLA
    // fyra ess (4 hjärter → svarar 1♥). Ihop 33 hp = slamzon; 6NT är kall.
    const deal = dealOf('N', {
      N: 'S:KQ5 H:Q64 D:KJ2 C:Q943',
      E: 'S:JT98 H:JT9 D:QT9 C:K87',
      S: 'S:A32 H:AK75 D:A64 C:AJ2',
      W: 'S:764 H:832 D:8753 C:T65',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam, inte 3NT
    expect(contract!.strain).toBe('NT') // 6NT (balanserat par, ingen färgfit)
    // DD-verifierat separat i denna session: 6NT tar 12 stick (går hem). Själva
    // DD-lösningen av en full sang-giv är för tung för sviten (känd gräns), så vi
    // låser här bara att paret NÅR slammen – att den håller är bekräftat.
  })

  it('1♣–1♥–1NT: OBALANSERAD svarare med klöverfit når 6♣ (RKC), inte 3NT', () => {
    // Probe-givan (F1 familj A, obalanserad): S är 4-4-4-1 (singel spader) med 18 hp
    // och en 9-korts klöverfit mot öppnaren. Balanserad-vägen (Gerber → 6NT) gäller
    // inte; paret ska hitta FÄRGSLAM 6♣ via 4NT RKC. DD 13 (kall). Boten stannade
    // förr i 3NT. E/V passiva (8 hp, ingen 5-korts färg med värden) → ostört.
    const deal = dealOf('N', {
      N: 'S:T98 H:Q9 D:AJ9 C:AKT96',
      E: 'S:KQ54 H:8765 D:765 C:73',
      S: 'S:A H:AKJT D:KQT8 C:J854',
      W: 'S:J7632 H:432 D:432 C:Q2',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam, inte 3NT
    expect(contract!.strain).toBe('clubs') // 6♣ (9-korts klöverfit)
  })
})
