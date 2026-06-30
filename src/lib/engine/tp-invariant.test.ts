// TP-grundprincipen "NEDGRADERA ALDRIG" (ägarens beslut 2026-06-30, se
// docs/tp-arbetslista.md): en hand värderas till max(HP, fit-mått) – form/korthet
// får LYFTA ett bud, men aldrig sänka det under HP. Alla TP-budbeslut (Steg B:
// svararens högfärgshöjningar; Steg C-1: öppnarens högfärgs-accepter) läser sedan
// städningen denna princip via EN hjälpare: pointsWithFloor (evaluation.ts).
//
// Det här testet låser principen GLOBALT i stället för per steg: ett deterministiskt
// (seedat) svep över hela handrymden bevisar att hjälparen aldrig kan ge poäng
// under HP – för alla händer, alla trumffärger och båda måtten (stöd + Bergen).
// Faller detta har någon brutit golvet och ett budbeslut kan nedgradera en hand.

import { describe, expect, it } from 'vitest'
import { dealRandom } from './deal'
import { hcp } from './hand'
import { pointsWithFloor } from './evaluation'
import type { Seat, Suit } from '../../types/bridge'

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

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

describe('TP-princip: nedgradera aldrig (pointsWithFloor ≥ HP, globalt svep)', () => {
  it('3000 seedade givar × 4 händer × 4 trumf × stöd/Bergen: golvet håller', () => {
    const rng = mulberry32(20260701)
    let liftedCount = 0
    for (let i = 0; i < 3000; i++) {
      const deal = dealRandom(rng)
      for (const seat of SEATS) {
        const hand = deal.hands[seat]
        const hp = hcp(hand)
        const handStr = hand.map((c) => c.suit[0] + c.rank).join(',')
        for (const trump of SUITS) {
          for (const kind of ['support', 'bergen'] as const) {
            const r = pointsWithFloor(hand, trump, kind)
            const ctx = `giv ${i} ${seat}=${handStr} trump=${trump} kind=${kind} → ${JSON.stringify(r)}`
            // KÄRNAN: poängen budbeslutet läser får aldrig understiga HP.
            expect(r.points, ctx).toBeGreaterThanOrEqual(hp)
            // points = max(HP, mått); hp-fältet är råa HP.
            expect(r.hp, ctx).toBe(hp)
            expect(r.points, ctx).toBe(Math.max(hp, r.measure))
            // lifted ⇔ formen lyfte handen STRIKT över HP (förklaringstexten beror på det).
            expect(r.lifted, ctx).toBe(r.points > hp)
            expect(r.text, ctx).toBe(r.lifted ? `${hp} hp / ${r.points} ${kind === 'support' ? 'stödp.' : 'Bergenp.'}` : `${hp} hp`)
            if (r.lifted) liftedCount++
          }
          // Bergen i sang (ingen kortfärg) får inte heller bryta golvet.
          const nt = pointsWithFloor(hand, trump, 'bergen', { notrump: true })
          expect(nt.points, `giv ${i} ${seat}=${handStr} trump=${trump} bergenNT`).toBeGreaterThanOrEqual(hp)
        }
      }
    }
    // Inte vakuöst: formen MÅSTE ha lyft minst en hand över HP i svepet, annars
    // bevisar golvtestet ingenting (mått === HP överallt vore en regression).
    expect(liftedCount).toBeGreaterThan(0)
  }, 30000)
})
