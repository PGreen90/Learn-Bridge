import { describe, expect, it } from 'vitest'
import type { Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { buildHandModel } from './hand-model'

/** Kort hjälp: bygg en budföljd ur [seat, bid]-par. */
const calls = (...pairs: [Seat, string][]): ResolvedCall[] => pairs.map(([seat, bid]) => ({ seat, bid }))

describe('buildHandModel – HP-liggaren ur auktionen (Steg 2 del 1)', () => {
  it('1NT-öppning → öppnaren 15–17 hp', () => {
    const m = buildHandModel(calls(['N', '1NT'], ['E', 'P'], ['S', 'P'], ['W', 'P']))
    expect(m.N.hcpMin).toBe(15)
    expect(m.N.hcpMax).toBe(17)
  })

  it('2NT-öppning → öppnaren 20–21 hp', () => {
    const m = buildHandModel(calls(['N', '2NT'], ['E', 'P'], ['S', 'P'], ['W', 'P']))
    expect(m.N.hcpMin).toBe(20)
    expect(m.N.hcpMax).toBe(21)
  })

  it('1-i-färg-öppning → öppnaren 12–21 hp', () => {
    const m = buildHandModel(calls(['N', '1S']))
    expect(m.N.hcpMin).toBe(12)
    expect(m.N.hcpMax).toBe(21)
  })

  it('passad hand (pass före något kontraktsbud) → högst 11 hp', () => {
    // Given N (dealer) passar, Ö passar, S öppnar 1♥. N och Ö är passade händer.
    const m = buildHandModel(calls(['N', 'P'], ['E', 'P'], ['S', '1H']))
    expect(m.N.hcpMax).toBe(11)
    expect(m.E.hcpMax).toBe(11)
    expect(m.S.hcpMin).toBe(12) // öppnaren, inte passad
  })

  it('pass EFTER en öppning kapar inte (kan vara trap/svag utan att förneka)', () => {
    // N öppnar 1♠, Ö passar → Ö:s pass säger inget säkert HP-tak.
    const m = buildHandModel(calls(['N', '1S'], ['E', 'P']))
    expect(m.E.hcpMax).toBe(37)
  })

  it('kända renonser från spelet vävs in', () => {
    const voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(['hearts']), S: new Set(), W: new Set() }
    const m = buildHandModel(calls(['N', '1S']), { voids })
    expect(m.E.voids.has('hearts')).toBe(true)
  })

  it('inget kontraktsbud alls (passat runt) → alla spann orörda utom passade tak', () => {
    const m = buildHandModel(calls(['N', 'P'], ['E', 'P'], ['S', 'P'], ['W', 'P']))
    for (const seat of ['N', 'E', 'S', 'W'] as Seat[]) expect(m[seat].hcpMax).toBe(11)
  })
})
