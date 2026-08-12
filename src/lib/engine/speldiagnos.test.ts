// Facit för speldiagnos-aggregatorn (steg 4). Oraklet och spelaren FEJKAS
// (inget WASM, inget Monte-Carlo) — testet låser aggregeringens kontrakt:
// domar per giv, tapp per roll, värsta-exempel, intern konsistens och den
// läsbara rapporten. Millisekunder — går i npm test.

import { describe, expect, it } from 'vitest'
import type { Card, Seat } from '../../types/bridge'
import { NEXT_SEAT, type Contract, type Trick } from './play'
import { formatSpeldiagnos, korSpeldiagnos, type SpeldiagnosRapport } from './speldiagnos'

const KORT: Card = { suit: 'spades', rank: '2' }

/** Ett fejkat stick från utspelaren och medurs (kortidentiteten är likgiltig). */
function ettStick(contract: Contract): Trick[] {
  const leader = NEXT_SEAT[contract.declarer]
  const seats: Seat[] = [leader, NEXT_SEAT[leader], NEXT_SEAT[NEXT_SEAT[leader]], contract.declarer]
  return [{ leader, cards: seats.map((seat) => ({ seat, card: KORT })), winner: leader }]
}

/**
 * Fejkat facit-spår för det fejkade sticket: kort 1 (utspelet, försvaret)
 * släpper 1 stick, kort 4 (spelföraren) skänker 1 → varje spelad giv får
 * utspelstapp 1 + spelförartapp 1, dd 8 → actual 8.
 */
const TRACE = [8, 9, 9, 9, 8]

function korFejkad(deals: number): SpeldiagnosRapport {
  return korSpeldiagnos({
    deals,
    baseSeed: 20260721,
    // Fejkat orakel: alla (spelförare, strain) tar 8 stick DD.
    oracle: () => ({ solve: () => 8, analyse: () => TRACE }),
    spela: (_deal, contract) => ({ tricks: ettStick(contract) }),
    examplesPerGrupp: 2,
  })
}

describe('korSpeldiagnos (fejkat orakel + fejkad spelare)', () => {
  const rapport = korFejkad(3)
  const spelade = rapport.domar.filter((d) => d.kontrakt !== 'utpassad')

  it('bedömer alla givar och lämnar en dom per giv', () => {
    expect(rapport.judged).toBe(3)
    expect(rapport.domar).toHaveLength(3)
    expect(rapport.domar.map((d) => d.seed)).toEqual([20260721, 20260722, 20260723])
  })

  it('tapp per roll: utspel 1 + spelförare 1 per spelad giv, försvar 0', () => {
    const perRoll = Object.fromEntries(rapport.spel.perRoll.map((r) => [r.roll, r]))
    expect(perRoll.utspel.stick).toBe(spelade.length)
    expect(perRoll.spelforare.stick).toBe(spelade.length)
    expect(perRoll.forsvar.stick).toBe(0)
    expect(rapport.spel.rentSpelade).toBe(0)
    expect(rapport.spel.spelade).toBe(spelade.length)
  })

  it('värsta-exempel begränsas av examplesPerGrupp och bär frö + kontrakt', () => {
    const utspel = rapport.spel.perRoll.find((r) => r.roll === 'utspel')!
    expect(utspel.varsta.length).toBeLessThanOrEqual(2)
    for (const v of utspel.varsta) {
      expect(v.seed).toBeGreaterThanOrEqual(20260721)
      expect(v.kontrakt).toBeTruthy()
      expect(v.stick).toBe(1)
    }
  })

  it('intern konsistens: budkategoriernas antal == givar med budtapp > 0', () => {
    const medTapp = rapport.domar.filter((d) => d.budtapp > 0).length
    const summaKategorier = rapport.bud.kategorier.reduce((s, k) => s + k.count, 0)
    expect(summaKategorier).toBe(medTapp)
    expect(rapport.bud.rattShare).toBeGreaterThanOrEqual(0)
    expect(rapport.bud.rattShare).toBeLessThanOrEqual(1)
  })

  it('domarna bär spel-attributionen (utspel + spelförare, dd 8 → actual 8)', () => {
    for (const d of spelade) {
      expect(d.ddTricks).toBe(8)
      expect(d.actualTricks).toBe(8)
      expect(d.fel.map((f) => f.roll).sort()).toEqual(['spelforare', 'utspel'])
      expect(d.spelforartapp).toBe(1)
      expect(d.forsvarstapp).toBe(1) // utspelet räknas till försvarets tapp
    }
  })

  it('formatSpeldiagnos: läsbar svensk rapport med larmklocke-förbehållet', () => {
    const text = formatSpeldiagnos(rapport)
    expect(text).toContain('=== SPELDIAGNOSEN ===')
    expect(text).toContain('larmklocka')
    expect(text).toContain('Utspelet')
    expect(text).toContain('DUMP_SPEL=')
  })
})
