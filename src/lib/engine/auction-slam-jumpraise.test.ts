import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { simulateAuction } from './contract-target'
import { contractFromCalls } from './auction-live'

// =============================================================================
// FACIT: slam-utforskning efter öppnarens HOPPHÖJNING av svararens högfärg
// (1x–1M–3M, 16–18 med 4-korts stöd). F1 (bredda slam-utforskningen), familj C.
//
// En probe (300 000 givar, DD-lösta) visade att paret ofta stannade i 4M trots
// slamvärden: efter öppnarens hopphöjning (som visar 16–18 + fit) var slam-
// arsenalen inte inkopplad i den formen. Trumfen (svararens högfärg) är redan
// överenskommen, så svararen (kaptenen) driver slam via cue-rond + 1430 RKC –
// samma maskineri som Jacoby 2NT-fiten.
//
// Fix: `buildAuction` kopplar in `slamInvestigation` (svararens högfärg trumf)
// efter hopphöjningen. Slamzon-porten (≥33 stödpoäng) + nyckelkortsporten (≥4/5)
// + kontroll-gaten (`pairControlsSideSuits`) hindrar överbud på icke-slamhänder.
// Båda givarna är DD-verifierade (13 stick i 6♠, dvs slammen är kall).
// =============================================================================

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'all', board: 13,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('FACIT: slam efter hopphöjning av svararens högfärg (F1 familj C)', () => {
  it('1♥–1♠–3♠: paret hittar slammen (6♠), inte 4♠ — ihop 34 hp', () => {
    // W öppnar 1♥ (5-4 ♥-♠, 18 hp), E svarar 1♠ (4 spader, 16 hp), W hopphöjer 3♠
    // (16–18, 4 stöd). 9-korts spaderfit + slamvärden. DD 13 (6♠ kall). Förr 4♠.
    const deal = dealOf('W', {
      N: 'S:T84 H:T7 D:Q8532 C:Q96',
      E: 'S:AK76 H:A9 D:AJ64 C:T74',
      S: 'S:J5 H:8654 D:97 C:J8532',
      W: 'S:Q932 H:KQJ32 D:KT C:AK',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam, inte 4♠
    expect(contract!.strain).toBe('spades') // 6♠ (spaderfit)
  })

  it('1♣–1♠–3♠: paret hittar slammen (6♠), inte 4♠ — ihop 36 hp', () => {
    // E öppnar 1♣ (balanserad 18), W svarar 1♠ (4 spader, 17 hp med 5 klöver),
    // E hopphöjer 3♠ (16–18, 4 stöd). Slamvärden. DD 13 (6♠ kall). Förr 4♠.
    const deal = dealOf('E', {
      N: 'S:T H:J9832 D:T8643 C:72',
      E: 'S:K743 H:AK75 D:K7 C:AJ6',
      S: 'S:9852 H:Q4 D:J952 C:854',
      W: 'S:AQJ6 H:T6 D:AQ C:KQT93',
    })
    const calls = simulateAuction(deal)
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(6) // slam, inte 4♠
    expect(contract!.strain).toBe('spades') // 6♠ (spaderfit)
  })
})
