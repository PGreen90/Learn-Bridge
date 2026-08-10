// Facit för serverns tävlingsgiv-generering (Beslut B etapp 2): fröet ska vara
// oförberäkneligt men reproducerbart, och de 12 givarna kompletta och unika.

import { describe, test, expect } from 'vitest'
import { seedForBoard } from './seed'
import { genereraGivar } from './generera'

describe('seedForBoard — hemligt frö', () => {
  test('samma (hemlighet, datum, bricka) ⇒ samma frö', () => {
    expect(seedForBoard('hemlis', '2026-08-11', 3)).toBe(seedForBoard('hemlis', '2026-08-11', 3))
  })

  test('byte av hemlighet, datum eller bricka ⇒ annat frö', () => {
    const base = seedForBoard('hemlis', '2026-08-11', 3)
    expect(seedForBoard('annan', '2026-08-11', 3)).not.toBe(base)
    expect(seedForBoard('hemlis', '2026-08-12', 3)).not.toBe(base)
    expect(seedForBoard('hemlis', '2026-08-11', 4)).not.toBe(base)
  })

  test('fröet är ett osignerat 32-bitars heltal', () => {
    const s = seedForBoard('hemlis', '2026-08-11', 1)
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(0xffffffff)
  })
})

describe('genereraGivar — dagens 12 tävlingsgivar', () => {
  test('ger size givar, bricka 1..size, alla kompletta', () => {
    const deals = genereraGivar('hemlis', '2026-08-11', 12)
    expect(deals).toHaveLength(12)
    deals.forEach((d, i) => {
      expect(d.board).toBe(i + 1)
      for (const s of ['N', 'E', 'S', 'W'] as const) expect(d.hands[s]).toHaveLength(13)
    })
  })

  test('reproducerbar: samma hemlighet + datum ⇒ identiska givar', () => {
    expect(genereraGivar('hemlis', '2026-08-11', 12)).toEqual(
      genereraGivar('hemlis', '2026-08-11', 12),
    )
  })

  test('de 12 givarna skiljer sig åt inbördes', () => {
    const deals = genereraGivar('hemlis', '2026-08-11', 12)
    const fingerprints = new Set(deals.map((d) => JSON.stringify(d.hands)))
    expect(fingerprints.size).toBe(12)
  })
})
