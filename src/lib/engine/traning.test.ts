// Facit för den motordrivna budträningen: varje tema ska HITTA givar, läget
// ska vara det temat lovar, och facit ska vara exakt motorns eget bud — så
// träningen aldrig kan lära ut något annat än det bottarna spelar.

import { describe, expect, it } from 'vitest'
import { decideCall, decideCallTraced, legalCalls } from './auction-live'
import { mulberry32 } from './deal'
import { TRANINGSTEMAN, traningsgiv, traningstema } from './traning'

const GIVAR_PER_TEMA = 6

describe('träningsteman', () => {
  it('har unika id:n och fullständiga texter', () => {
    const ids = TRANINGSTEMAN.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TRANINGSTEMAN) {
      expect(t.titel.length).toBeGreaterThan(3)
      expect(t.beskrivning.length).toBeGreaterThan(10)
      expect(t.intro.length).toBeGreaterThan(40)
      expect(t.paragraf).toMatch(/^§/)
    }
    expect(traningstema('finns-inte')).toBeUndefined()
    expect(traningsgiv('finns-inte')).toBeNull()
  })

  describe.each(TRANINGSTEMAN.map((t) => [t.id, t] as const))('%s', (id, tema) => {
    // Fast frö → samma givar varje körning (deterministiskt test).
    const rng = mulberry32(20261111 + id.length * 7919)
    const givar = Array.from({ length: GIVAR_PER_TEMA }, () => traningsgiv(id, rng))

    it('hittar givar inom budgeten', () => {
      expect(givar.every((g) => g !== null)).toBe(true)
    })

    it('det är Syds tur, och facit är exakt motorns lagliga tabellbud', () => {
      for (const g of givar) {
        if (!g) continue
        // Syd är vid draget efter historiken.
        const fore = g.history.length
        const spar = decideCallTraced(g.deal, g.history, 'S')
        expect(g.facit.seat).toBe('S')
        expect(spar.källa.startsWith('tabell:')).toBe(true)
        expect(g.facit.bid).toBe(decideCall(g.deal, g.history, 'S').bid)
        expect(legalCalls(g.history, 'S')).toContain(g.facit.bid)
        expect(g.history.length).toBe(fore) // historiken muteras inte
        // Varje bud i historiken är motorns eget för den platsen (ingen hand lånas).
        g.history.forEach((c, i) => {
          expect(decideCall(g.deal, g.history.slice(0, i), c.seat).bid).toBe(c.bid)
        })
      }
    })

    it('facit har en förklaring att visa', () => {
      for (const g of givar) {
        if (!g) continue
        expect((g.facit.explanation ?? '').length, `${tema.titel}: ${g.facit.bid} saknar förklaring`).toBeGreaterThan(0)
      }
    })
  })
})

describe('temanas lägen är de som utlovas', () => {
  const rng = mulberry32(4711)
  const hamta = (id: string) => {
    const g = traningsgiv(id, rng)
    if (!g) throw new Error(`ingen giv för ${id}`)
    return { ...g, bud: g.history.filter((c) => c.bid !== 'P') }
  }

  it('öppning: ingen har bjudit före Syd', () => {
    for (let i = 0; i < 5; i++) expect(hamta('oppning').bud).toEqual([])
  })

  it('svar på högfärg: bara partnerns 1♥/1♠ ligger på bordet', () => {
    for (let i = 0; i < 5; i++) {
      const { bud } = hamta('svar-hogfarg')
      expect(bud).toHaveLength(1)
      expect(bud[0].seat).toBe('N')
      expect(['1H', '1S']).toContain(bud[0].bid)
    }
  })

  it('inkliv: en motståndare har öppnat på ettläget, ingen annan har bjudit', () => {
    for (let i = 0; i < 5; i++) {
      const { bud } = hamta('inkliv')
      expect(bud).toHaveLength(1)
      expect(['E', 'W']).toContain(bud[0].seat)
      expect(bud[0].bid).toMatch(/^1[CDHS]$/)
    }
  })

  it('återbud: Syd öppnade, partnern svarade, motståndarna tysta', () => {
    for (let i = 0; i < 5; i++) {
      const { bud } = hamta('aterbud')
      expect(bud.map((c) => c.seat)).toEqual(['S', 'N'])
    }
  })

  it('slam: läget rör essfrågan', () => {
    for (let i = 0; i < 3; i++) {
      const { bud, facit } = hamta('slam')
      const har4NT = facit.bid === '4NT' || bud.some((c) => c.bid === '4NT' && (c.seat === 'N' || c.seat === 'S'))
      expect(har4NT).toBe(true)
    }
  })
})
