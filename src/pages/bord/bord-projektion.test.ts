// Facit för klientens bordprojektion (etapp 4B): händelser → spelläge, och den
// visuella vridningen (du sitter alltid Syd). Projektionen litar på serverns
// logg (domaren) — här verifieras att den läser loggen rätt och vrider
// konsekvent, inte spelregler (de vaktas av bord-motor.test.ts server-side).

import { describe, test, expect } from 'vitest'
import type { Card, Seat } from '../../types/bridge'
import type { BordHandelse } from '../../lib/backend/bord'
import {
  byggVisuelltSpel,
  projiceraBord,
  visuellAuktion,
  vridStol,
  vridTillbaka,
  vridZon,
} from './bord-projektion'

const START = { ns: 0, ew: 0 }
const kort = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

let seqRaknare = 0
function h(typ: string, seat: Seat | null, data: unknown, giv = 1): BordHandelse {
  return { seq: ++seqRaknare, giv: typ === 'bord-klar' ? 0 : giv, typ, seat, data: data as Record<string, unknown> }
}

/** Given N öppnar 1♠, alla passar → 1♠ av Nord, Öst spelar ut. */
function grundEvents(): BordHandelse[] {
  seqRaknare = 0
  return [
    h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'ns' }),
    h('bud', 'N', { bid: '1S' }),
    h('bud', 'E', { bid: 'P' }),
    h('bud', 'S', { bid: 'P' }),
    h('bud', 'W', { bid: 'P' }),
  ]
}

describe('vridningen', () => {
  test('minStol hamnar i Syd och vridTillbaka är inversen', () => {
    for (const min of ['N', 'E', 'S', 'W'] as Seat[]) {
      const v = vridStol(min)
      const tillbaka = vridTillbaka(min)
      expect(v(min)).toBe('S')
      for (const s of ['N', 'E', 'S', 'W'] as Seat[]) expect(tillbaka(v(s))).toBe(s)
    }
  })

  test('grannskap bevaras (rotationen är cyklisk, ingen spegling)', () => {
    const v = vridStol('E')
    expect(v('E')).toBe('S')
    expect(v('S')).toBe('W') // spelaren till vänster om mig förblir till vänster
    expect(v('W')).toBe('N')
    expect(v('N')).toBe('E')
  })

  test('zonen följer partnerskapen: udda rotation byter ns↔ew', () => {
    expect(vridZon('S', 'ns')).toBe('ns') // ingen rotation
    expect(vridZon('N', 'ns')).toBe('ns') // 180° — partnerskapen kvar
    expect(vridZon('E', 'ns')).toBe('ew') // 90° — jag är ÖV-spelare, min sida i zon
    expect(vridZon('E', 'all')).toBe('all')
    expect(vridZon('W', 'none')).toBe('none')
  })
})

describe('projiceraBord', () => {
  test('null före första given', () => {
    expect(projiceraBord([], START)).toBeNull()
  })

  test('budfas: historik + giv-metadata ur händelserna', () => {
    seqRaknare = 0
    const lage = projiceraBord(
      [h('giv-start', null, { board: 7, dealer: 'E', vulnerability: 'all' }), h('bud', 'E', { bid: 'P' })],
      START,
    )!
    expect(lage.fas).toBe('bud')
    expect(lage.board).toBe(7)
    expect(lage.dealer).toBe('E')
    expect(lage.history).toEqual([{ seat: 'E', bid: 'P' }])
  })

  test('avslutad auktion → spel med kontraktet; giv-klar → klar med ställningen', () => {
    const lage = projiceraBord(grundEvents(), START)!
    expect(lage.fas).toBe('spel')
    expect(lage.contract).toMatchObject({ declarer: 'N', level: 1 })

    const events = [
      ...grundEvents(),
      h('giv-klar', null, {
        hands: {},
        contract: lage.contract,
        passadUt: false,
        declarerTricks: 8,
        nsScore: 110,
        stallning: { ns: 110, ew: 0 },
      }),
    ]
    const klar = projiceraBord(events, START)!
    expect(klar.fas).toBe('klar')
    expect(klar.stallning).toEqual({ ns: 110, ew: 0 })
  })

  test('bara SENASTE givens händelser räknas + bord-klar fångas', () => {
    seqRaknare = 0
    const events = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }, 1),
      h('bud', 'N', { bid: '1S' }, 1),
      h('giv-start', null, { board: 2, dealer: 'E', vulnerability: 'ns' }, 2),
      h('bud', 'E', { bid: 'P' }, 2),
      h('bord-klar', null, { stallning: { ns: 400, ew: 100 } }),
    ]
    const lage = projiceraBord(events, START)!
    expect(lage.giv).toBe(2)
    expect(lage.history).toEqual([{ seat: 'E', bid: 'P' }])
    expect(lage.bordKlar).toEqual({ stallning: { ns: 400, ew: 100 } })
  })
})

describe('visuellAuktion', () => {
  test('stolarna vrids och egna bud får en systemisk förklaring', () => {
    const lage = projiceraBord(grundEvents(), START)!
    const a = visuellAuktion(lage, 'N') // jag är Nord → mina bud visas på Syd
    expect(a.dealer).toBe('S')
    expect(a.calls[0]).toMatchObject({ seat: 'S', bid: '1S' })
    expect(a.calls[0].explanation).toBeTruthy() // tolkningslagret fyller i
    expect(a.calls[1].seat).toBe('W') // verkliga Öst = min vänstra motståndare
    expect(a.vulnerability).toBe('ns') // 180°-rotation behåller partnerskapen
  })
})

describe('byggVisuelltSpel', () => {
  // 1♠ av Nord; Öst spelar ut. Ett helt hjärterstick: E h2, S h5, W hK, N hA
  // → Nord vinner (ingen trumf lagd).
  const stick = [
    h('kort', 'E', { card: kort('hearts', '2') }),
    h('kort', 'S', { card: kort('hearts', '5') }),
    h('kort', 'W', { card: kort('hearts', 'K') }),
    h('kort', 'N', { card: kort('hearts', 'A') }),
  ]

  test('utan rotation (jag är Syd): stick, vinnare och tur stämmer', () => {
    const lage = projiceraBord([...grundEvents(), ...stick], START)!
    const minHand = [kort('hearts', '5'), kort('spades', 'Q')]
    const spel = byggVisuelltSpel(lage, minHand, 'S')!
    expect(spel.state.completedTricks).toHaveLength(1)
    expect(spel.state.completedTricks[0].winner).toBe('N')
    expect(spel.state.tricksNS).toBe(1)
    expect(spel.state.toAct).toBe('N') // vinnaren spelar ut
    expect(spel.state.hands.S).toEqual([kort('spades', 'Q')]) // h5 borta
    expect(spel.kvar).toEqual({ N: 12, E: 12, S: 12, W: 12 })
  })

  test('med rotation (jag är Öst): allt uttrycks i min synvinkel', () => {
    const lage = projiceraBord([...grundEvents(), ...stick], START)!
    const minHand = [kort('hearts', '2'), kort('clubs', '3')]
    const spel = byggVisuelltSpel(lage, minHand, 'E')!
    // Verkliga Nord (vinnaren, min motståndare) sitter visuellt i Öst.
    expect(spel.state.contract.declarer).toBe('E')
    expect(spel.state.completedTricks[0].winner).toBe('E')
    expect(spel.state.tricksEW).toBe(1) // "De" tog sticket
    expect(spel.state.toAct).toBe('E')
    expect(spel.state.hands.S).toEqual([kort('clubs', '3')]) // mitt utspel borta
  })

  test('träkarlen läggs i rätt visuell stol och krymper med spelet', () => {
    seqRaknare = 0
    const events = [
      ...grundEvents(),
      h('kort', 'E', { card: kort('hearts', '2') }),
      h('trakarl', 'S', { hand: [kort('hearts', '5'), kort('diamonds', 'J')] }),
      h('kort', 'S', { card: kort('hearts', '5') }),
    ]
    const lage = projiceraBord(events, START)!
    // Jag är Väst → träkarlen (verkliga Syd, spelförarens partner) syns hos
    // motståndaren till höger... verifiera via vridningen i stället för på känn:
    const spel = byggVisuelltSpel(lage, [kort('clubs', '2')], 'W')!
    const dummyVisuellt = vridStol('W')('S')
    expect(spel.dummy).toBe(dummyVisuellt)
    expect(spel.state.hands[dummyVisuellt]).toEqual([kort('diamonds', 'J')])
    expect(spel.state.currentTrick).toHaveLength(2)
  })

  test('null i budfasen', () => {
    seqRaknare = 0
    const lage = projiceraBord(
      [h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' })],
      START,
    )!
    expect(byggVisuelltSpel(lage, [], 'S')).toBeNull()
  })
})
