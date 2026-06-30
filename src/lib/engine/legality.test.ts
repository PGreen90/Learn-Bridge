// FAS 1 punkt 3 – laglighetskontroll. Budlådans bot-hjärna (decideCall) får
// ALDRIG producera ett olagligt bud, och varje auktion måste bli klar. Testet
// är DETERMINISTISKT (seedad rng via dealRandom) så ett fel alltid kan
// återskapas – till skillnad från det äldre slump-fuzztestet i auction-live.

import { describe, expect, it } from 'vitest'
import { dealRandom } from './deal'
import { auctionComplete, decideCall, legalCalls, seatToAct } from './auction-live'
import type { ResolvedCall } from '../bidding'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function handsStr(deal: ReturnType<typeof dealRandom>): string {
  return (['N', 'E', 'S', 'W'] as const)
    .map((s) => `${s}=${deal.hands[s].map((c) => c.suit[0] + c.rank).join(',')}`)
    .join(' | ')
}

describe('FAS 1 punkt 3 – decideCall ger bara lagliga bud (deterministiskt)', () => {
  it('4000 seedade givar: varje bud lagligt + auktionen blir klar', () => {
    const rng = mulberry32(20260630)
    for (let i = 0; i < 4000; i++) {
      const deal = dealRandom(rng)
      const history: ResolvedCall[] = []
      for (let step = 0; step < 40 && !auctionComplete(history); step++) {
        const seat = seatToAct(deal.dealer, history.length)
        const c = decideCall(deal, history, seat)
        const ctx = `giv ${i} dealer=${deal.dealer} ${handsStr(deal)} | historik=${history.map((h) => h.seat + h.bid).join(' ')} | bud=${c.seat}${c.bid}`
        expect(c.seat, ctx).toBe(seat)
        expect(legalCalls(history, seat), ctx).toContain(c.bid)
        history.push(c)
      }
      expect(auctionComplete(history), `giv ${i} blev aldrig klar: ${handsStr(deal)}`).toBe(true)
    }
  }, 30000) // tungt deterministiskt svep (4000 givar) – behöver mer än default 5 s under parallell last
})
