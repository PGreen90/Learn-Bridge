// Facit för startsidans "vann vecka N" (ägarbeslut 2026-11-22): veckans stjärna
// vann FÖRRA veckans stjärntävling och bär titeln hela veckan. Raden under namnet
// säger vilken kalendervecka (ISO) segern gällde, räknat ur tävlingens löpnummer.

import { describe, expect, it } from 'vitest'
import { guldNummer, guldVecka } from './daily'

describe('guldVecka — kalenderveckan för en stjärntävling', () => {
  it('premiärveckan (måndag 9 nov 2026) är vecka 46', () => {
    expect(guldVecka(1)).toBe(46)
  })

  it('veckan 16 nov 2026 är vecka 47, veckan 23 nov är vecka 48', () => {
    expect(guldVecka(guldNummer('2026-11-16'))).toBe(47)
    expect(guldVecka(guldNummer('2026-11-23'))).toBe(48)
  })

  it('årsskiftet: 2026 har 53 veckor, sedan börjar det om på 1', () => {
    expect(guldVecka(guldNummer('2026-12-28'))).toBe(53)
    expect(guldVecka(guldNummer('2027-01-04'))).toBe(1)
  })
})
