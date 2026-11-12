// Facit för nyhetsrutan "Uppdatering vX.Y.Z" (ägarbeslut 2026-11-12): varje
// uppdatering som är värd att berätta om får ett versionsnummer och några korta
// rader. Rutan visas EN gång per användare och version.

import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import { NYHETER, nyareAn, olastNyhet } from './nyheter'

describe('nyhetslistan', () => {
  it('senaste posten bär appens versionsnummer (package.json) — EN sanning', () => {
    expect(NYHETER[0].version).toBe(pkg.version)
  })

  it('nyast först, inga dubbletter', () => {
    for (let i = 1; i < NYHETER.length; i++) {
      expect(nyareAn(NYHETER[i - 1].version, NYHETER[i].version), NYHETER[i].version).toBe(true)
    }
  })

  it('korta texter: högst fyra punkter, rubrik ≤ 30 tecken, text ≤ 90', () => {
    for (const n of NYHETER) {
      expect(n.punkter.length, n.version).toBeGreaterThan(0)
      expect(n.punkter.length, n.version).toBeLessThanOrEqual(4)
      for (const p of n.punkter) {
        expect(p.rubrik.length, p.rubrik).toBeLessThanOrEqual(30)
        expect(p.text.length, p.text).toBeLessThanOrEqual(90)
      }
    }
  })
})

describe('nyareAn', () => {
  it('jämför siffra för siffra, inte som text', () => {
    expect(nyareAn('1.0.10', '1.0.9')).toBe(true)
    expect(nyareAn('1.1.0', '1.0.9')).toBe(true)
    expect(nyareAn('1.0.1', '1.0.1')).toBe(false)
    expect(nyareAn('1.0.0', '1.0.1')).toBe(false)
  })
})

describe('olastNyhet', () => {
  const senaste = NYHETER[0]

  it('den som sett en äldre version får senaste nyheten', () => {
    expect(olastNyhet('1.0.0', true)).toBe(senaste)
  })

  it('den som redan sett senaste får ingenting', () => {
    expect(olastNyhet(senaste.version, true)).toBeNull()
  })

  it('befintlig användare utan sparad version (före nyhetsrutan fanns) får nyheten', () => {
    expect(olastNyhet(null, true)).toBe(senaste)
  })

  it('helt ny besökare får INGEN nyhetsruta — allt är nytt för dem', () => {
    expect(olastNyhet(null, false)).toBeNull()
  })

  it('trasigt sparat värde behandlas som osett', () => {
    expect(olastNyhet('skräp', true)).toBe(senaste)
  })
})
