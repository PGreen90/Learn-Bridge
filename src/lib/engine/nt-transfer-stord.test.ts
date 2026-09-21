// STÖRD ÖVERFÖRING EFTER VÅRT 1NT — fjärde hand kliver in efter svararens
// överföring (ägarens live-fynd 2026-09-20, tävlingsbricka 5; ägarens regler
// samma dag). Förr passade öppnaren utan regel — även med fyrkorts stöd.
//
// Ägarens regler: öppnaren med 3–4 korts stöd i den överförda färgen låter
// POÄNGEN styra, räknade med fördelning och med oskyddade honnörer i deras
// färg nedvärderade: under 16 → tävlar på 3-läget, 16+ → utgång. Svararen:
// skräpöverföring → tyst; 8+ hp eller 10+ med fördelning → utgång. Dubblar
// fjärde hand överföringsbudet gäller systems on (fullföljd som vanligt).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid } as ResolvedCall)
const TOM = 'S:- H:- D:- C:-'
const giv = (N: string, S: string): Deal =>
  ({ id: 't', board: 1, dealer: 'N', vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(TOM), S: parseHand(S), W: parseHand(TOM) } } as Deal)

const SYD = 'S:Q8764 H:J732 D:QT52 C:-' // brickans Syd: 5 hp, renons i deras färg
const oppnaren = (N: string, h: ResolvedCall[]) => decideCall(giv(N, SYD), h, 'N')

describe('öppnaren efter överföring + fjärde hands färgbud', () => {
  const STORT = [call('N', '1NT'), call('E', '2C'), call('S', '2H'), call('W', '3C')]
  const OSTORT = [call('N', '1NT'), call('E', 'P'), call('S', '2H'), call('W', '3C')]

  it('bricka 5: fyrkorts stöd, 16 hp men ♣Q oskyddad i deras färg → bjuder spader (aldrig pass)', () => {
    // 18 med fördelning − 2 för ♣Q i deras färg = 16 → utgång.
    expect(oppnaren('S:AKT9 H:K8 D:KJ87 C:Q63', STORT)).toMatchObject({ bid: '4S', rule: 'störd överföring: utgång' })
  })
  it('minimum med fyrkorts stöd → tävlar 3♠', () => {
    expect(oppnaren('S:AKT9 H:K82 D:K87 C:Q63', STORT)).toMatchObject({ bid: '3S', rule: 'störd överföring: tävlar' })
  })
  it('minimum med trekorts stöd → tävlar 3♠ · maximum med trekorts stöd → 4♠', () => {
    expect(oppnaren('S:AK9 H:K82 D:K872 C:Q63', STORT).bid).toBe('3S')
    expect(oppnaren('S:AQ9 H:K82 D:KJ87 C:A63', STORT).bid).toBe('4S')
  })
  it('två spader → pass (ingen plikt utan stöd) — inte 4♥ på partnerns överföringsbud', () => {
    expect(oppnaren('S:A9 H:KQ82 D:KJ87 C:A63', STORT).bid).toBe('P')
  })
  it('två spader men säkra trumfstick i deras färg → straffdubblingen står kvar', () => {
    expect(oppnaren('S:A9 H:K82 D:KJ87 C:KQ63', STORT).bid).toBe('X')
  })
  it('samma regler när 1NT var ostört och bara fjärde hand kliver in', () => {
    expect(oppnaren('S:AKT9 H:K82 D:K87 C:Q63', OSTORT).bid).toBe('3S')
    expect(oppnaren('S:AQ9 H:K82 D:KJ87 C:A63', OSTORT).bid).toBe('4S')
  })
  it('hjärteröverföring, de bjuder 2♠ → tävlar 3♥ med stöd', () => {
    const h = [call('N', '1NT'), call('E', 'P'), call('S', '2D'), call('W', '2S')]
    expect(oppnaren('S:Q63 H:AK9 D:K872 C:K82', h).bid).toBe('3H')
  })
  it('deras bud tar 3-läget (3♠ över hjärteröverföringen): minimum passar, 16+ bjuder 4♥', () => {
    const h = [call('N', '1NT'), call('E', 'P'), call('S', '2D'), call('W', '3S')]
    expect(oppnaren('S:Q63 H:AKT9 D:K87 C:K82', h).bid).toBe('P')
    expect(oppnaren('S:A63 H:AQ9 D:KJ87 C:K82', h).bid).toBe('4H')
  })
})

describe('svararen när budet kommer tillbaka', () => {
  const N = 'S:AKT9 H:K82 D:K87 C:Q63'
  const efter = (S: string, oppnarensBud: string) =>
    decideCall(giv(N, S), [call('N', '1NT'), call('E', '2C'), call('S', '2H'), call('W', '3C'), call('N', oppnarensBud), call('E', 'P')], 'S')

  it('öppnaren tävlade 3♠: 10+ med fördelning → 4♠ (brickans Syd: 5 hp + renons)', () => {
    expect(efter(SYD, '3S')).toMatchObject({ bid: '4S', rule: 'störd överföring: till utgång' })
  })
  it('öppnaren tävlade 3♠: 8+ hp → 4♠', () => {
    expect(efter('S:QJ764 H:K73 D:Q52 C:82', '3S').bid).toBe('4S')
  })
  it('öppnaren tävlade 3♠: skräpöverföring → pass', () => {
    expect(efter('S:Q8764 H:J73 D:QT5 C:82', '3S').bid).toBe('P')
  })
  it('öppnaren bjöd 4♠ → pass', () => {
    expect(efter(SYD, '4S').bid).toBe('P')
  })
  it('öppnaren passade (inget stöd): skräpöverföring är tyst; sexkorts färg med 8+ hp → 4♠', () => {
    expect(efter('S:Q8764 H:J73 D:QT5 C:82', 'P').bid).toBe('P')
    expect(efter('S:KJ8764 H:K73 D:Q5 C:82', 'P').bid).toBe('4S')
  })
  it('öppnaren passade: FEMkorts färg med utgångsvärden → 3NT (ägarbeslut 2026-09-21)', () => {
    expect(efter('S:KJ764 H:K73 D:Q52 C:82', 'P')).toMatchObject({ bid: '3NT', rule: 'störd överföring: till utgång' })
  })
})

describe('fjärde hand dubblar överföringsbudet → systems on', () => {
  it('öppnaren fullföljer som vanligt, även i det störda läget (med regelnamn)', () => {
    const h = [call('N', '1NT'), call('E', '2C'), call('S', '2H'), call('W', 'X')]
    expect(oppnaren('S:AKT9 H:K82 D:K87 C:Q63', h)).toMatchObject({ bid: '2S', rule: 'fullföljd transfer' })
  })
})

describe('hela brickan (tävlingsbricka 5, 2026-09-20)', () => {
  it('N/S når 4♠ i stället för att sälja ut till 3♣', () => {
    const deal = { id: 't', board: 5, dealer: 'N', vulnerability: 'ns', hands: {
      N: parseHand('S:AKT9 H:K8 D:KJ87 C:Q63'), E: parseHand('S:J53 H:A96 D:- C:AKJT742'),
      S: parseHand(SYD), W: parseHand('S:2 H:QT54 D:A9643 C:985') } } as Deal
    const bud = buildAuction(deal)!.turns.map((t) => `${t.seat}:${t.call}`)
    expect(bud.slice(0, 5)).toEqual(['N:1NT', 'E:2C', 'S:2H', 'W:3C', 'N:4S'])
  })
})

describe('budförklaringen läser läget (inte "ny färg" / "kort i partnerns hjärter")', () => {
  const H = [call('N', '1NT'), call('E', '2C'), call('S', '2H'), call('W', '3C')]
  it('öppnarens 3♠ = tävlar med stöd · 4♠ = utgång med stöd', () => {
    expect(meaningOf([...H, call('N', '3S')], 4)).toMatchObject({ rule: 'störd överföring: tävlar' })
    expect(meaningOf([...H, call('N', '3S')], 4).text).toMatch(/3–4 korts stöd i partnerns spader/)
    expect(meaningOf([...H, call('N', '4S')], 4)).toMatchObject({ rule: 'störd överföring: utgång' })
  })
  it('svararens 4♠ över 3♠ = till utgång · pass = överföringen var till spel', () => {
    const h = [...H, call('N', '3S'), call('E', 'P')]
    expect(meaningOf([...h, call('S', '4S')], 6)).toMatchObject({ rule: 'störd överföring: till utgång' })
    expect(meaningOf([...h, call('S', 'P')], 6).text).toMatch(/till spel/)
  })
  it('svararens 3NT efter öppnarens pass = fem kort och utgångsvärden', () => {
    const h = [...H, call('N', 'P'), call('E', 'P'), call('S', '3NT')]
    expect(meaningOf(h, 6)).toMatchObject({ rule: 'störd överföring: till utgång' })
    expect(meaningOf(h, 6).text).toMatch(/fem/)
  })
})
