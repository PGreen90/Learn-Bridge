// R1 Fynd #2, delbit 6: öppnarens ROND-2-beslut i det inklämda konkurrensläget
// efter partnerns enkla högfärgshöjning. FACIT FÖRE FIX.
//
// Sekvens: VÅR 1-högfärgsöppning, ett inkliv, partnern höjer 2M (6–9), och
// motståndarna konkurrerar så att det är ÖPPNAREN igen och cue-budet skulle hamna
// ÖVER 3M (inget avböjnings-utrymme). Då gäller MAXIMAL DUBBLING:
//   pass = minimum · 3M = konkurrens (6:e trumf) · X = game try (15–17) · 4M = utgång
// och partnern svarar X:et med 4M (accept, max) / 3M (avböj, min).
//
// Testar via decideCall (integration) → bevisar också att verktyget NÅS live
// (motverkar R1 Fynd #4:s "grunt testade, aldrig anropade").
import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall, legalCalls } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test',
    dealer,
    vulnerability: 'none',
    board: 1,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

// ---- Hjärteröppning: 1♥ – (1♠) – 2♥ – (2♠) → Syd (öppnaren) igen -------------
const H_HISTORY = [call('S', '1H'), call('W', '1S'), call('N', '2H'), call('E', '2S')]
// Kontext: Nord höjde (3-korts hjärterstöd, 6–9), V/Ö äger spader.
const H_CTX = {
  N: 'S:842 H:K76 D:9532 C:J84', // 7 hp, 3-korts hjärterstöd
  W: 'S:AQ976 H:T4 D:K84 C:Q53', // 11 hp, 5-korts spader (1♠-inkliv)
  E: 'S:KJ5 H:J83 D:AQ76 C:T92', // 9 hp, 3-korts spader (2♠)
}

describe('Delbit 6 – öppnarens rond-2 i inklämt konkurrensläge (1♥–(1♠)–2♥–(2♠))', () => {
  it('dött minimum → pass (försvarar deras 2♠)', () => {
    const deal = dealOf('S', { ...H_CTX, S: 'S:Q4 H:AQ976 D:KJ5 C:832' }) // 12 hp, 5-3-3-2
    expect(decideCall(deal, H_HISTORY, 'S').bid).toBe('P')
  })

  it('minimum men 6:e trumfen → 3♥ (lagen om totala stick)', () => {
    const deal = dealOf('S', { ...H_CTX, S: 'S:82 H:KQ9762 D:854 C:K3' }) // 8 hp, 6 hjärter, platt form (ej game-try)
    expect(decideCall(deal, H_HISTORY, 'S').bid).toBe('3H')
    expect(legalCalls(H_HISTORY, 'S')).toContain('3H')
  })

  it('utgångsintresse (~16, jämn) → X (maximal dubbling = game try)', () => {
    const deal = dealOf('S', { ...H_CTX, S: 'S:K4 H:AKQ76 D:KJ5 C:832' }) // 16 hp, 5-3-3-2
    expect(decideCall(deal, H_HISTORY, 'S').bid).toBe('X')
    expect(legalCalls(H_HISTORY, 'S')).toContain('X')
  })

  it('utgångshand (18+) → 4♥', () => {
    const deal = dealOf('S', { ...H_CTX, S: 'S:AK4 H:AKQ76 D:KJ5 C:83' }) // 20 hp
    expect(decideCall(deal, H_HISTORY, 'S').bid).toBe('4H')
  })
})

// ---- Partnern svarar öppnarens maximal-dubbling (game try) -------------------
const H_TRY = [
  call('S', '1H'), call('W', '1S'), call('N', '2H'), call('E', '2S'),
  call('S', 'X'), call('W', 'P'), // Syds X = game try, Väst passar → Nord dömer
]
const H_TRY_CTX = {
  S: 'S:K4 H:AKQ76 D:KJ5 C:832', // öppnarens game-try-hand
  W: 'S:AQ976 H:T4 D:K84 C:Q53',
  E: 'S:KJ5 H:J83 D:AQ76 C:T92',
}

describe('Delbit 6 – partnern svarar maximal-dubblingen', () => {
  it('maximum av höjningen (8–9 stöd) → accepterar 4♥', () => {
    const deal = dealOf('S', { ...H_TRY_CTX, N: 'S:842 H:KQ6 D:9532 C:A84' }) // 9 hp
    expect(decideCall(deal, H_TRY, 'N').bid).toBe('4H')
  })

  it('minimum av höjningen (6–7 stöd) → avböjer 3♥', () => {
    const deal = dealOf('S', { ...H_TRY_CTX, N: 'S:8642 H:K76 D:Q532 C:J8' }) // 6 hp
    expect(decideCall(deal, H_TRY, 'N').bid).toBe('3H')
    expect(legalCalls(H_TRY, 'N')).toContain('3H')
  })
})

// ---- Spaderöppning: samma inklämda mönster (1♠–(2♥)–2♠–(3♥)) -----------------
// Bevisar att den generella "inklämda"-triggern (cue > 3M) gäller även spader,
// inte bara den hjärter-specifika 2♠-auktionen.
const S_HISTORY = [call('S', '1S'), call('W', '2H'), call('N', '2S'), call('E', '3H')]
const S_CTX = {
  N: 'S:K83 H:762 D:9532 C:J8', // 3-korts spaderstöd
  W: 'S:4 H:AQ9762 D:A84 C:Q5', // 5-korts hjärter (2♥-inkliv)
  E: 'S:J5 H:KJ3 D:Q76 C:AT964',
}

describe('Delbit 6 – spaderöppning, inklämt (1♠–(2♥)–2♠–(3♥))', () => {
  it('utgångsintresse → X (game try; cue 4♥ skulle ligga över utgång)', () => {
    const deal = dealOf('S', { ...S_CTX, S: 'S:AKQ76 H:K4 D:KJ5 C:832' }) // 16 hp
    expect(decideCall(deal, S_HISTORY, 'S').bid).toBe('X')
    expect(legalCalls(S_HISTORY, 'S')).toContain('X')
  })
})
