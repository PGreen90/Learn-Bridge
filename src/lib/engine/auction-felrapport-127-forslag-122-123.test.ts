// FACIT — felrapport #127 och förslagen #122 + #123 (ägarbeslut 2026-11-15).
// Hp räknade med kod (hcp/parseHand), summa 40 och 13 kort per hand.
//
// #127 (Veckans stjärntävling nr 1, giv 7, Syd giv, alla i zon): "Nord måste
//   bjuda om sin ruter när han är så stark."
//     Syd    Väst   Nord   Öst
//     pass   pass   2♣     2♠
//     pass   pass   pass ???       ← Nord ♠AQ ♥A ♦AKJT964 ♣A85 (22 hp)
//   Hålet: efter 2♣–(inkliv) fanns ingen rad alls ("pass (ingen regel)").
//   Ägarens besked: "2♣-öppnaren får inte passa i detta läget. Bjud så naturligt
//   det går, lång färg eller NT. Annars dubbel = tvingar partner att bjuda."
//
// #122 (förslag, bricka 9, Nord giv): 1♦–(P)–? med ♠987 ♥Q96 ♦— ♣AQJ8742 (9 hp).
//   Motorn svarade 1NT (spelades med renons). Ägarbeslut: 1♦–3♣ = sju+ klöver,
//   under utgångskrav, till spel. Sexkorts klöver bjuder 1NT som förut.
//
// #123 (förslag, bricka 8, Väst giv, ingen i zon):
//     Väst   Nord   Öst    Syd
//     pass   pass   1♦     1♠
//     X      2♠     3♥     pass ???   ← Syd ♠AQT98 ♥J5 ♦A4 ♣QT43 (13 hp)
//   Ägarbeslut ("båda, var på sitt skäl"): advancern med FYRA trumf tävlar alltid
//   3♠ (nio trumf); inklivaren med fem tävlar 3♠ i ozon med 13+ hp, passar i zon.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall, decideCallTraced } from './auction-live'
import { meaningOf } from './auction-meaning'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
type Zon = Deal['vulnerability']
const giv = (id: string, dealer: Seat, vulnerability: Zon, n: string, e: string, s: string, w: string): Deal =>
  ({ id, board: 1, dealer, vulnerability, hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) } })
const hpKoll = (d: Deal, facit: number[]) => {
  const hp = ORDER.map((s) => hcp(d.hands[s]))
  expect(hp).toEqual(facit)
  expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
  for (const s of ORDER) expect(d.hands[s]).toHaveLength(13)
}
const sista = (dealer: Seat, a: string) => { const h = H(dealer, a); return meaningOf(h, h.length - 1) }

describe('felrapport #127 – 2♣-öppnaren passar aldrig ut deras inkliv', () => {
  const D = giv('fr127', 'S', 'all', 'S:AQ H:A D:AKJT964 C:A85', 'S:KJT86 H:K53 D:- C:KJ632', 'S:532 H:T74 D:872 C:Q974', 'S:974 H:QJ9862 D:Q53 C:T')
  const medNord = (n: string): Deal => ({ ...D, hands: { ...D.hands, N: parseHand(n) } })
  it('händerna räknade med kod: 22 · 11 · 2 · 5 = 40', () => hpKoll(D, [22, 11, 2, 5]))

  it('Nord öppnar 2♣ som i rapporten', () => {
    expect(decideCall(D, H('S', 'P P'), 'N').bid).toBe('2C')
  })

  it('Nord efter 2♣–(2♠)–P–P: 3♦ (sju ruter, naturligt) — aldrig pass', () => {
    const t = decideCallTraced(D, H('S', 'P P 2C 2S P P'), 'N')
    expect(t.källa).toBe('tabell:stört-2♣-öppnaren')
    expect(t.call).toMatchObject({ bid: '3D', rule: 'stört 2♣: egen färg' })
  })

  it('även efter deras höjning (2♣–(2♠)–P–(3♠)): 4♦', () => {
    expect(decideCall(D, H('S', 'P P 2C 2S P 3S'), 'N').bid).toBe('4D')
  })

  it('jämn hand med spaderstopp → 2NT; 25+ → 3NT', () => {
    const jamn = medNord('S:KQ4 H:AK5 D:AQJ4 C:KJ5')
    expect(hcp(jamn.hands.N)).toBe(23)
    expect(decideCall(jamn, H('S', 'P P 2C 2S P P'), 'N')).toMatchObject({ bid: '2NT', rule: 'stört 2♣: sang' })
    const stark = medNord('S:AQ4 H:AK5 D:AQJ4 C:KQ5')
    expect(hcp(stark.hands.N)).toBe(25)
    expect(decideCall(stark, H('S', 'P P 2C 2S P P'), 'N').bid).toBe('3NT')
  })

  it('ingen lång färg, inget stopp → X som tvingar partnern', () => {
    const utan = medNord('S:742 H:AKQ5 D:AKQ4 C:AK')
    expect(hcp(utan.hands.N)).toBe(25)
    expect(decideCall(utan, H('S', 'P P 2C 2S P P'), 'N')).toMatchObject({ bid: 'X', rule: 'stört 2♣: dubbling' })
  })

  it('Syd (2 hp) bjuder ALLTID på den dubblingen: längsta färgen → 3♣', () => {
    const t = decideCallTraced(D, H('S', 'P P 2C 2S P P X P'), 'S')
    expect(t.källa).toBe('tabell:stört-2♣-x-svar')
    expect(t.call).toMatchObject({ bid: '3C', rule: 'svar på 2♣-öppnarens dubbling' })
  })

  it('budförklaringarna ur auktionen (människans bud)', () => {
    expect(sista('S', 'P P 2C 2S P P 3D')).toMatchObject({ rule: 'stört 2♣: egen färg' })
    expect(sista('S', 'P P 2C 2S P P 3D').text).toMatch(/5\+ ruter/)
    expect(sista('S', 'P P 2C 2S P P X').text).toMatch(/Tvingar partnern/)
    expect(sista('S', 'P P 2C 2S P P 2NT').text).toMatch(/22\+/)
    expect(sista('S', 'P P 2C 2S P P X P 3C').text).toMatch(/lovar ingenting/)
  })

  it('motvikt: en vanlig 1-öppnares återöppningsdubbling läses som förut', () => {
    expect(sista('S', 'P P 1D 2S P P X').rule).toBe('öppnarens återöppningsdubbling (partnern passade)')
  })
})

describe('förslag #122 – 1♦–3♣ = sju eller fler klöver, under utgångskrav', () => {
  const D = giv('fs122', 'N', 'ew', 'S:KQT H:A3 D:QJT982 C:K5', 'S:J53 H:KT72 D:K3 C:T963', 'S:987 H:Q96 D:- C:AQJ8742', 'S:A642 H:J854 D:A7654 C:-')
  const medSyd = (s: string): Deal => ({ ...D, hands: { ...D.hands, S: parseHand(s) } })
  it('händerna räknade med kod: 15 · 7 · 9 · 9 = 40', () => hpKoll(D, [15, 7, 9, 9]))

  it('Syd svarar 3♣ (förr 1NT)', () => {
    expect(decideCall(D, H('N', '1D P'), 'S')).toMatchObject({ bid: '3C', rule: 'svagt hopp: 7+ klöver' })
  })

  it('Nord passar 3♣ — budet är till spel', () => {
    expect(decideCall(D, H('N', '1D P 3C P'), 'N').bid).toBe('P')
  })

  it('budförklaringen: sju klöver, till spel', () => {
    const m = sista('N', '1D P 3C')
    expect(m.rule).toBe('svagt hopp: 7+ klöver')
    expect(m.text).toMatch(/sju eller fler klöver/)
  })

  it('motvikt: SEXKORTS klöver svarar 1NT som förut (ägarbeslut 2026-07-06)', () => {
    expect(decideCall(medSyd('S:987 H:Q96 D:4 C:AQJ874'), H('N', '1D P'), 'S').bid).toBe('1NT')
  })

  it('motvikt: 12+ med sju klöver är utgångskrav → 2♣', () => {
    const stark = medSyd('S:A87 H:Q9 D:4 C:AQJ8742')
    expect(hcp(stark.hands.S)).toBe(13)
    expect(decideCall(stark, H('N', '1D P'), 'S')).toMatchObject({ bid: '2C', rule: '2-över-1 GF' })
  })

  it('motvikt: 4-korts högfärg går före (1♠)', () => {
    expect(decideCall(medSyd('S:9873 H:Q9 D:- C:AQJ8742'), H('N', '1D P'), 'S').bid).toBe('1S')
  })

  it('motvikt: över 1♣ finns inget 3♣-hopp i egen färg (höjning som förut)', () => {
    expect(decideCall(D, H('N', '1C P'), 'S').rule).not.toBe('svagt hopp: 7+ klöver')
  })
})

describe('förslag #123 – tävla 3♠ över deras 3♥: advancern med fyra trumf, inklivaren i ozon med 13+', () => {
  const D = giv('fs123', 'W', 'none', 'S:K742 H:K74 D:QT65 C:87', 'S:53 H:Q832 D:KJ8732 C:A', 'S:AQT98 H:J5 D:A4 C:QT43', 'S:J6 H:AT96 D:9 C:KJ9652')
  const FORE = 'P P 1D 1S X 2S 3H'
  it('händerna räknade med kod: 8 · 10 · 13 · 9 = 40', () => hpKoll(D, [8, 10, 13, 9]))

  it('motorn bjuder som i rapporten fram till 3♥', () => {
    expect(decideCall(D, H('W', 'P P'), 'E').bid).toBe('1D')
    expect(decideCall(D, H('W', 'P P 1D'), 'S').bid).toBe('1S')
    expect(decideCall(D, H('W', 'P P 1D 1S'), 'W').bid).toBe('X')
    expect(decideCall(D, H('W', 'P P 1D 1S X'), 'N').bid).toBe('2S')
    expect(decideCall(D, H('W', 'P P 1D 1S X 2S'), 'E').bid).toBe('3H')
  })

  it('Syd (13 hp, fem spader) i OZON: 3♠', () => {
    expect(decideCall(D, H('W', FORE), 'S')).toMatchObject({ bid: '3S', rule: 'inklivaren tävlar i ozon (13+)' })
  })

  it('Nord passar partnerns 3♠ (tävlingsbud, ingen inbjudan)', () => {
    expect(decideCall(D, H('W', FORE + ' 3S P'), 'N')).toMatchObject({ bid: 'P', rule: 'advancern passar tävlingsbudet' })
  })

  it('samma hand I ZON: Syd passar …', () => {
    const zon: Deal = { ...D, vulnerability: 'all' }
    expect(decideCall(zon, H('W', FORE), 'S')).toMatchObject({ bid: 'P', rule: 'inklivaren passar höjningen' })
  })

  it('… och Nord med FYRA trumf tävlar 3♠ (nio trumf), oavsett zon', () => {
    for (const v of ['none', 'all'] as Zon[]) {
      const d: Deal = { ...D, vulnerability: v }
      expect(decideCall(d, H('W', FORE + ' P P'), 'N')).toMatchObject({ bid: '3S', rule: 'advancern tävlar med fjärde trumfen (lagen om totala stick)' })
    }
  })

  it('Syd passar Nords 3♠', () => {
    const zon: Deal = { ...D, vulnerability: 'all' }
    expect(decideCall(zon, H('W', FORE + ' P P 3S P'), 'S').bid).toBe('P')
  })

  it('motvikt: Syd med under 13 hp passar även i ozon', () => {
    const svag: Deal = { ...D, hands: { ...D.hands, S: parseHand('S:AQT98 H:J5 D:74 C:QT43') } }
    expect(hcp(svag.hands.S)).toBe(9)
    expect(decideCall(svag, H('W', FORE), 'S').bid).toBe('P')
  })

  it('motvikt: Nord med bara TRE trumf tävlar inte på den här regeln', () => {
    const tre: Deal = { ...D, vulnerability: 'all', hands: { ...D.hands, N: parseHand('S:K74 H:K742 D:QT65 C:87') } }
    expect(decideCall(tre, H('W', FORE + ' P P'), 'N').rule).not.toBe('advancern tävlar med fjärde trumfen (lagen om totala stick)')
  })
})
