// 2♣-öppnarens färgåterbud efter 2♦-väntebudet ska LOVA 5+ (live-prov 2026-09-12).
// Förr bjöd koden längsta färgen och föll tillbaka på en 4-korts färg för en
// 4-4-4-1-jätte → "krav-färg" på 4 kort. Nu: bara 5+ som naturlig krav-färg;
// den treifärgade jätten utan 5-färg bjuder 2NT. FACIT FÖRE FIX.

import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { openerRebidAfter2C, respondTo2C } from './responses-2c'

describe('2♣-återbudets färg lovar 5+', () => {
  // Svararen har en svag hand → 2♦ väntebud.
  const waiting = respondTo2C(parseHand('S:8432 H:762 D:8542 C:83'))

  it('jätte med 6 hjärter → 2♥, förklaringen säger 5+ (inte 4+)', () => {
    const r = openerRebidAfter2C(parseHand('S:K2 H:AKQJ43 D:AK2 C:A2'), waiting)
    expect(r.call).toBe('2H')
    expect(r.explanation).toContain('5+')
    expect(r.explanation).not.toContain('4+')
  })

  it('obalanserad jätte med 5 spader (5-3-4-1) → 2♠, 5+', () => {
    const r = openerRebidAfter2C(parseHand('S:AKQJ4 H:AK2 D:AK32 C:2'), waiting)
    expect(r.call).toBe('2S')
    expect(r.explanation).toContain('5+')
  })

  it('4-4-4-1-jätte utan 5-korts färg → 2NT, aldrig en 4-korts krav-färg', () => {
    const r = openerRebidAfter2C(parseHand('S:AKJ2 H:AKJ2 D:AQJ2 C:2'), waiting)
    expect(r.call).toBe('2NT')
  })
})
