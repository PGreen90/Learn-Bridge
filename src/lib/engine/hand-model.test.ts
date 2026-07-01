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

describe('buildHandModel – färglängder ur naturliga bud (Steg 2 del 2)', () => {
  it('högfärgsöppning 1♥ → öppnaren 5+ hjärter', () => {
    const m = buildHandModel(calls(['N', '1H']))
    expect(m.N.length.hearts.min).toBe(5)
  })

  it('minoröppning 1♣ → öppnaren 3+ klöver (inte 4)', () => {
    const m = buildHandModel(calls(['N', '1C']))
    expect(m.N.length.clubs.min).toBe(3)
  })

  it('1NT-öppning → balanserad: varje färg 2–5', () => {
    const m = buildHandModel(calls(['N', '1NT']))
    for (const s of ['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]) {
      expect(m.N.length[s].min).toBe(2)
      expect(m.N.length[s].max).toBe(5)
    }
  })

  it('svararens nya färg → 4+ i den färgen', () => {
    // N 1♣ – (P) – S 1♥ : svararens 1♥ = ny naturlig färg.
    const m = buildHandModel(calls(['N', '1C'], ['E', 'P'], ['S', '1H']))
    expect(m.S.length.hearts.min).toBe(4)
  })

  it('rebjuden egen färg → 6+', () => {
    // N 1♥ – (P) – S 1NT – (P) – N 2♥ : rebjuden hjärter.
    const m = buildHandModel(calls(['N', '1H'], ['E', 'P'], ['S', '1NT'], ['W', 'P'], ['N', '2H']))
    expect(m.N.length.hearts.min).toBe(6)
  })

  it('höjning av partnerns färg → INGEN egen längd-inferens (kan vara 3-stöd)', () => {
    // N 1♥ – (P) – S 2♥ : S höjer, vi vet inte S:s egen hjärterlängd säkert.
    const m = buildHandModel(calls(['N', '1H'], ['E', 'P'], ['S', '2H']))
    expect(m.S.length.hearts.min).toBe(0)
  })

  it('känd renons slår budinferensen → längd exakt 0', () => {
    // Ö "visade" spader men en renons är känd från spelet → 0 vinner.
    const voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(['spades']), S: new Set(), W: new Set() }
    const m = buildHandModel(calls(['N', 'P'], ['E', '1S']), { voids })
    expect(m.E.length.spades.max).toBe(0)
    expect(m.E.length.spades.min).toBe(0)
  })
})

describe('buildHandModel – svaga öppningar + svararens golv (Steg 2 del 3)', () => {
  it('svag tvåöppning 2♥ → 4–11 hp, 6+ hjärter', () => {
    const m = buildHandModel(calls(['N', '2H']))
    expect(m.N.hcpMin).toBe(4)
    expect(m.N.hcpMax).toBe(11)
    expect(m.N.length.hearts.min).toBe(6)
  })

  it('spärröppning 3♠ → högst 11 hp, 6+ spader', () => {
    const m = buildHandModel(calls(['N', '3S']))
    expect(m.N.hcpMax).toBe(11)
    expect(m.N.length.spades.min).toBe(6)
  })

  it('stark 2♣ → inget säkert HP-golv (artificiellt)', () => {
    const m = buildHandModel(calls(['N', '2C']))
    expect(m.N.hcpMin).toBe(0)
    expect(m.N.hcpMax).toBe(37)
  })

  it('1-lägessvar i ny färg (ostört, opassat) → 6+ hp', () => {
    // 1♣ – (P) – 1♥
    const m = buildHandModel(calls(['N', '1C'], ['E', 'P'], ['S', '1H']))
    expect(m.S.hcpMin).toBe(6)
  })

  it('2/1 (ny färg på 2-läget lägre än öppningen) → utgångskrav 12+', () => {
    // 1♠ – (P) – 2♣ = 2/1 GF
    const m = buildHandModel(calls(['N', '1S'], ['E', 'P'], ['S', '2C']))
    expect(m.S.hcpMin).toBe(12)
  })

  it('inkliv mellan öppning och svar → svararens 12-golv gäller INTE (kan konkurrera)', () => {
    // 1♠ – (2♥ inkliv) – 3♣ : störd, 2/1-golvet ska inte sättas.
    const m = buildHandModel(calls(['N', '1S'], ['E', '2H'], ['S', '3C']))
    expect(m.S.hcpMin).toBe(0)
  })

  it('passad hand som svarar 2/1 → inget 12-golv (passad = ≤11)', () => {
    // S passar först, sen N öppnar 1♠, S "2/1" 2♣ → passad, ska kapas till ≤11.
    const m = buildHandModel(calls(['S', 'P'], ['W', 'P'], ['N', '1S'], ['E', 'P'], ['S', '2C']))
    expect(m.S.hcpMax).toBe(11)
    expect(m.S.hcpMin).toBeLessThanOrEqual(11)
  })
})
