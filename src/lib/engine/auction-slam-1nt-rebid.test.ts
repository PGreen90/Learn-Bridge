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

  it('1♣–1♥–1NT: 4-korts klöverfit går inte att VETA → ÄRLIG MISS, paret stannar i utgång', () => {
    // Ärliga slamportar (ägarbeslut 2026-07-07): S har bara 4 klöver — öppningen
    // 1♣ lovar 3+, så en 8-korts fit är INTE säker på egen hand. Förr hittade
    // motorn 9-korts fiten (6♣, DD 13) genom att läsa N:s hand — det var kik.
    // Nu följer paret systemet och stannar i utgång. Medveten, dokumenterad miss.
    const deal = dealOf('N', {
      N: 'S:T98 H:Q9 D:AJ9 C:AKT96',
      E: 'S:KQ54 H:8765 D:765 C:73',
      S: 'S:A H:AKJT D:KQT8 C:J854',
      W: 'S:J7632 H:432 D:432 C:Q2',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeLessThan(6) // utgång, ingen slamblast på kik
  })

  it('1♣–1♠–1NT: OBALANSERAD svarare med EGEN 6-korts spader + slamvärden → 6♠ (RKC)', () => {
    // Ärlig färgslam-väg: S:s egen 6-korts spader är en säker trumf på egen hand
    // (ingen kik behövs). 21 hp + form mot visade 12–14 → driv: 4NT RKC; N:s svar
    // 5♥ (2 utan trumfdam) är entydigt (S har 2 själv, 5 omöjligt) → 4 av 5 → 6♠.
    const deal = dealOf('N', {
      N: 'S:32 H:A54 D:A65 C:KJT94', // 12 hp balanserad → 1♣, 1NT-återbud
      E: 'S:8654 H:8763 D:872 C:76',
      S: 'S:AKQJ97 H:KQ D:KQJ C:32', // 21 hp, 6 spader → driv färgslam
      W: 'S:T H:JT92 D:T943 C:AQ85',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam
    expect(contract!.strain).toBe('spades')
  })
})
