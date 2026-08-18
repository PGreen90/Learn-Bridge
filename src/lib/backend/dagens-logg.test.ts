// @vitest-environment jsdom
// Facit för kontospegelns sammanslagning (Beslut B etapp 3): servern vinner
// vid krock (raden var först någonstans), lokala rader som saknas på servern
// rapporteras för uppskick, och late-flaggan överlever åt båda hållen.

import { describe, test, expect } from 'vitest'
import { slaIhopDagensLogg } from './dagens-logg'

describe('slaIhopDagensLogg', () => {
  test('servern vinner vid krock; lokala luckor fylls; uppskicket = lokalt unika', () => {
    const lokal = { 3: { myTricks: 9 }, 5: { myTricks: 7, late: true }, 6: { myTricks: 8 } }
    const server = [
      { nummer: 3, myTricks: 10 }, // krock → serverns rad visas
      { nummer: 4, myTricks: 11, late: true }, // fanns bara på kontot
    ]
    const { sammanslagen, saknasPaServern } = slaIhopDagensLogg(lokal, server)
    expect(sammanslagen).toEqual({
      3: { myTricks: 10 },
      4: { myTricks: 11, late: true },
      5: { myTricks: 7, late: true },
      6: { myTricks: 8 },
    })
    expect(saknasPaServern).toEqual([
      { nummer: 5, myTricks: 7, late: true },
      { nummer: 6, myTricks: 8 },
    ])
  })

  test('tomma källor är ofarliga', () => {
    expect(slaIhopDagensLogg({}, [])).toEqual({ sammanslagen: {}, saknasPaServern: [] })
    const { sammanslagen } = slaIhopDagensLogg({}, [{ nummer: 1, myTricks: 6 }])
    expect(sammanslagen).toEqual({ 1: { myTricks: 6 } })
  })
})
