// Resonemangslagrets pass-spärr (urvalsprovet 2026-09-23, docs/sunt-fornuft-plan.md):
// ett bud väljs bara när det slår pass SÄKERT — skillnaden mot pass, parad hand för
// hand, ska vara större än PASS_MARGINAL standardfel. Annars är ledningen brus och
// tystnaden står kvar (1NT −63 mot pass −70 på 11 händer ska bli pass).
import { describe, expect, it } from 'vitest'
import type { Bid } from '../../types/bridge'
import { PASS_MARGINAL, valjMotPass, type Kandidat } from './resonemang'

const k = (bud: string, snitt: number, motPass?: { diff: number; se: number }): Kandidat =>
  ({ bud: bud as Bid, n: 20, snitt, se: 10, motPass })

describe('valjMotPass — ett bud måste slå pass säkert', () => {
  it('ledning inom bruset → pass', () => {
    const r = valjMotPass([k('1NT', -63, { diff: 7, se: 20 }), k('P', -70), k('X', -143, { diff: -73, se: 30 })])
    expect(r.val).toBe('P')
    expect(r.spärrad).toBe('1NT')
  })

  it('säker ledning → budet', () => {
    const r = valjMotPass([k('3NT', 378, { diff: 215, se: 40 }), k('P', 163)])
    expect(r.val).toBe('3NT')
    expect(r.spärrad).toBeUndefined()
  })

  it('gränsen är exakt PASS_MARGINAL standardfel', () => {
    const se = 10
    expect(valjMotPass([k('2S', 0, { diff: PASS_MARGINAL * se + 0.1, se }), k('P', 0)]).val).toBe('2S')
    expect(valjMotPass([k('2S', 0, { diff: PASS_MARGINAL * se, se }), k('P', 0)]).val).toBe('P')
  })

  it('bästa budet spärrat → det bästa budet som SÄKERT slår pass', () => {
    // X leder i snitt men ledningen mot pass är brus; 2H slår pass säkert.
    const r = valjMotPass([k('X', 50, { diff: 5, se: 30 }), k('2H', 45, { diff: 60, se: 10 }), k('P', -15)])
    expect(r.val).toBe('2H')
  })

  it('pass är bäst → pass', () => {
    expect(valjMotPass([k('P', 10), k('X', 5, { diff: -5, se: 3 })]).val).toBe('P')
  })

  it('tom lista → pass', () => {
    expect(valjMotPass([]).val).toBe('P')
  })
})
