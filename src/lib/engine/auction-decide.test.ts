// Facit för BESLUTSTABELLEN (docs/motorbyte-plan.md etapp 3). Varje familj som
// flyttar in får sitt läge vaktat här: att raden träffar rätt läge, att den
// ger kunskapsfunktionen rätt indata ur fakta (position, sårbarhet …) och att
// den tiger utanför sitt läge (då gäller det gamla lagret tills nästa familj).
import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'
import { decideCallTraced } from './auction-live'
import { botAuction, dealFromSeed } from './revisor'

const P = (seat: Seat): ResolvedCall => ({ seat, bid: 'P' })

/** Tabellens bud för `seat` med `hand`, givet buden hittills. */
function bud(hand: string, history: ResolvedCall[], seat: Seat, vulnerable = false) {
  return decideFromTable(parseHand(hand), auctionFacts(history, seat), vulnerable)
}

describe('familj 1 – öppningen: läget "ingen har öppnat"', () => {
  it('täcker alla fyra positionerna och tiger så fort någon öppnat', () => {
    const h = 'S:AK74 H:K83 D:Q62 C:J52'
    expect(bud(h, [], 'N')?.källa).toBe('tabell:öppning')
    expect(bud(h, [P('N')], 'E')?.källa).toBe('tabell:öppning')
    expect(bud(h, [P('N'), P('E')], 'S')?.källa).toBe('tabell:öppning')
    expect(bud(h, [P('N'), P('E'), P('S')], 'W')?.källa).toBe('tabell:öppning')
    // Efter en öppning är läget inklivarens (etapp 4) resp. svararens (familj 2).
    expect(bud(h, [{ seat: 'N', bid: '1C' }], 'E')).toBeNull()
    expect(bud(h, [{ seat: 'N', bid: '1C' }, P('E')], 'S')?.källa).toBe('tabell:svar')
  })

  it('ger budet med regel och förklaring, även passet', () => {
    const öppnar = bud('S:AK74 H:K83 D:Q62 C:J52', [], 'N')!.call
    expect(öppnar).toMatchObject({ seat: 'N', bid: '1C', rule: 'minor-regeln' })
    expect(öppnar.explanation).toContain('1♣')
    const passar = bud('S:9874 H:K83 D:Q62 C:J52', [], 'N')!.call
    expect(passar).toMatchObject({ seat: 'N', bid: 'P', rule: 'pass' })
    expect(passar.explanation).toContain('pass')
  })

  it('positionen räknas ur passen: 3:e hand öppnar lätt, 1:a hand passar (samma hand)', () => {
    const h = 'S:KQJ98 H:A54 D:872 C:43' // 10 hp, ♠KQ – lättöppningens facit i openings.test.ts
    expect(bud(h, [], 'S')!.call.bid).toBe('P')
    expect(bud(h, [P('N'), P('E')], 'S')!.call).toMatchObject({ bid: '1S', rule: 'lättöppning' })
  })

  it('4:e hand: regeln om 15 ur tre pass', () => {
    const h = 'S:KJ987 H:A43 D:Q87 C:92' // 10 hp + 5 spader = 15
    expect(bud(h, [], 'W')!.call.bid).toBe('P')
    expect(bud(h, [P('N'), P('E'), P('S')], 'W')!.call).toMatchObject({ bid: '1S', rule: 'regeln om 15' })
    expect(bud('S:KJ87 H:A43 D:Q876 C:92', [P('N'), P('E'), P('S')], 'W')!.call.bid).toBe('P') // 14 → passa ut
  })

  it('sårbarheten når kunskapsfunktionen: lätt 3:e-handsöppning med 10 hp bara ej sårbar', () => {
    const h = 'S:KQJ98 H:A54 D:872 C:43'
    expect(bud(h, [P('N'), P('E')], 'S', false)!.call.bid).toBe('1S')
    expect(bud(h, [P('N'), P('E')], 'S', true)!.call.bid).toBe('P')
  })
})

describe('familj 1 – decideCall går genom tabellen för hela öppningsvarvet', () => {
  it('varje bud till och med öppningen kommer ur tabellen och är lika med botauktionens', () => {
    let öppningar = 0
    for (let seed = 20270001; seed <= 20270100; seed++) {
      const deal = dealFromSeed(seed)
      const history = botAuction(deal)
      if (!history) continue
      const första = history.findIndex((c) => c.bid !== 'P')
      const sista = första === -1 ? history.length - 1 : första
      for (let i = 0; i <= sista; i++) {
        const t = decideCallTraced(deal, history.slice(0, i), history[i].seat)
        expect(t.källa).toBe('tabell:öppning')
        expect(t.call.bid).toBe(history[i].bid)
      }
      if (första !== -1) öppningar++
    }
    expect(öppningar).toBeGreaterThan(80)
  })

  it('ser aldrig de andra händerna: samma öppning även när de tre andra är kopior av den egna', () => {
    const deal = dealFromSeed(20270003) // Öst ger och öppnar 1NT
    const kopior = { ...deal, hands: { N: deal.hands.E, E: deal.hands.E, S: deal.hands.E, W: deal.hands.E } }
    expect(decideCallTraced(deal, [], 'E').call.bid).toBe('1NT')
    expect(decideCallTraced(kopior, [], 'E').call.bid).toBe('1NT')
  })
})

describe('familj 2 – svaret: läget "partnern öppnade ostört, jag har inte bjudit"', () => {
  const h = 'S:KJ74 H:A83 D:Q62 C:J52' // 10 hp, 4-korts spaderstöd
  const open1S: ResolvedCall = { seat: 'N', bid: '1S' }

  it('träffar bara svararen, direkt efter öppning + pass', () => {
    expect(bud(h, [open1S, P('E')], 'S')?.källa).toBe('tabell:svar')
    // Motståndaren till öppnaren är inte svarare (etapp 4).
    expect(bud(h, [open1S], 'E')).toBeNull()
    // Störning (inkliv eller X) mellan öppningen och mig → inte den här raden.
    expect(bud(h, [open1S, { seat: 'E', bid: '2C' }], 'S')).toBeNull()
    expect(bud(h, [open1S, { seat: 'E', bid: 'X' }], 'S')).toBeNull()
    // Efter mitt eget svar är läget öppnarens/svararens andra bud (familj 3–4).
    expect(bud(h, [open1S, P('E'), { seat: 'S', bid: '3S' }, P('W')], 'N')).toBeNull()
    // Öppningar utan svarsregler lämnas åt det gamla lagret.
    expect(bud(h, [{ seat: 'N', bid: '4NT' }, P('E')], 'S')).toBeNull()
  })

  it('ger systemsvaret ur egen hand: Bergen 3♦ (limithöjning, 4-korts stöd) på 1♠ med 10 hp', () => {
    const c = bud(h, [open1S, P('E')], 'S')!.call
    expect(c).toMatchObject({ seat: 'S', bid: '3D' })
    expect(c.rule).toBeTruthy()
    expect(c.explanation).toBeTruthy()
  })

  it('passad hand läses ur fakta: Drury över 1♠ i 3:e hand, limithöjning i 1:a', () => {
    const drury = 'S:KJ7 H:A83 D:Q962 C:J52' // 10 hp, 3-korts stöd
    expect(bud(drury, [P('S'), P('W'), open1S, P('E')], 'S')!.call).toMatchObject({ bid: '2C', rule: 'Drury' })
    expect(bud(drury, [open1S, P('E')], 'S')!.call.rule).not.toBe('Drury')
  })

  it('Gerber-handen frågar 4♣ över 1NT ur egen hand (18+ balanserad utan 4-korts högfärg)', () => {
    const gerber = 'S:AQ3 H:KJ2 D:KQ5 C:AJ92' // 20 hp
    expect(bud(gerber, [{ seat: 'N', bid: '1NT' }, P('E')], 'S')!.call).toMatchObject({ bid: '4C', rule: 'Gerber' })
    const invit = 'S:Q73 H:KJ2 D:KQ5 C:AJ92' // 16 hp → kvantitativ 4NT, inte Gerber
    expect(bud(invit, [{ seat: 'N', bid: '1NT' }, P('E')], 'S')!.call.bid).toBe('4NT')
  })

  it('svarar på det bud som FAKTISKT bjöds, även när motorn själv inte hade öppnat handen', () => {
    // Bifyndet från familj 1: Syd öppnar 1♠ med 11 hp; motorn hade passat och
    // manuset fanns inte ("ingen öppning") → Nord passade. Nu: semi-forcing 1NT.
    const deal = dealFromSeed(20271606)
    const t = decideCallTraced(deal, [{ seat: 'S', bid: '1S' }, P('W')], 'N')
    expect(t.källa).toBe('tabell:svar')
    expect(t.call).toMatchObject({ bid: '1NT', rule: 'semi-forcing 1NT' })
  })

  it('ser aldrig de andra händerna: samma svar när de tre andra är kopior av den egna', () => {
    const deal = dealFromSeed(20270003) // Öst öppnar 1NT, Väst svarar
    const kopior = { ...deal, hands: { N: deal.hands.W, E: deal.hands.W, S: deal.hands.W, W: deal.hands.W } }
    const hist: ResolvedCall[] = [{ seat: 'E', bid: '1NT' }, P('S')]
    const a = decideCallTraced(deal, hist, 'W')
    const b = decideCallTraced(kopior, hist, 'W')
    expect(a.källa).toBe('tabell:svar')
    expect(b.call.bid).toBe(a.call.bid)
  })
})
