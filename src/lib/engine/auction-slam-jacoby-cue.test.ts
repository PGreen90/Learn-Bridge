import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { simulateAuction } from './contract-target'
import { contractFromCalls } from './auction-live'

// =============================================================================
// FACIT: Jacoby 2NT-slam med "hängande cue" (F1 familj D).
// Probe-given: 1♥–2NT–4♥ … paret har ALLA fem nyckelkort + trumfdam (7♥ kall,
// DD 13). buildAuction räknade rätt (7♥) men lade en HÄNGANDE cue: svararen
// cue-bjöd 4♠ utan att öppnaren kunde cue:a tillbaka (ingen kontroll ovanför
// spader) → två svararbud i rad = olaglig auktion → live-lagret föll av linjen
// och passade 4♠ (den kända slam-quirken).
//
// Fix: cue-ronden i slamInvestigation läggs bara som ett KOMPLETT par
// (svarare + öppnare); saknas öppnarens cue-svar hoppas cue-ronden över och
// paret går direkt på 4NT RKC. Nyckelkortsporten (≥4) skyddar ändå.
// =============================================================================

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'all', board: 13,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('FACIT: Jacoby 2NT-slam utan hängande cue (F1 familj D)', () => {
  it('1♥–2NT: paret når hjärtslam, inte hängande 4♠', () => {
    const deal = dealOf('N', {
      N: 'S:KQJ2 H:KQT53 D:K4 C:J5',
      E: 'S:965 H:J97 D:QJT C:QT98',
      S: 'S:AT87 H:A864 D:A6 C:AK7',
      W: 'S:43 H:2 D:987532 C:6432',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam, inte 4♠
    expect(contract!.strain).toBe('hearts') // hjärtfit via Jacoby 2NT
  })
})
