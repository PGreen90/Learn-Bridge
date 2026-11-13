// FACIT FÖRE FIX — felrapporterna #118, #119 och #121 (2026-11-12), alla tre
// avgjorda av ÄGARBESLUT 2026-11-13. Hp räknade med kod, summa 40.
//
// #118 (bricka 9, Nord giv, ÖV i zon): P – (1♣) – ? med Syd ♠QT8542 ♥A ♦KT32 ♣J5
//   (10 hp). Motorn 1♠, ägaren 2♠: "min partner har passat". Ägarbeslut: HAR
//   PARTNERN PASSAT är sexkortsfärg med 6–10 hp ett hoppinkliv (annars 1-läget
//   med 8–10 som förut).
//
// #119 (bricka 8, Väst giv, ingen i zon): (1♣) – 1♥ – (P) – 2♣ – (P) – 2♥ – (P) – ?
//   Syd ♠87654 ♥A64 ♦— ♣AKJ92 (12 hp, 18 stödpoäng) bjöd 3NT "utgångskrav".
//   Ägarens struktur: efter inklivarens minimisvar passar cue-bjudaren under 13
//   stödpoäng, bjuder 3M (inbjudan) med 13–14 och CUE:AR EN GÅNG TILL med 15+
//   ("visar styrka 15+; har partnern 10+ TP lägger hen upp den i 4♥, svagt
//   inkliv blir 3♥"). Aldrig 3NT med singel/renons när högfärgsfiten är känd.
//
// #121 (bricka 3, Syd giv, ÖV i zon): Syd ♠KQ6 ♥AJ764 ♦JT3 ♣93 (11 hp) passade.
//   Ägarbeslut: 11 hp + femkorts högfärg öppnar ALLTID 1M, oavsett zon
//   (fjärde hand följer regeln om 15 som förut).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { dummyPoints } from './evaluation'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s === '' ? [] : s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
type Zon = Deal['vulnerability']
const giv = (id: string, dealer: Seat, vulnerability: Zon, n: string, e: string, s: string, w: string): Deal =>
  ({ id, board: 1, dealer, vulnerability, hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) } })
const med = (d: Deal, seat: Seat, hand: string, extra: Partial<Deal> = {}): Deal => ({ ...d, ...extra, hands: { ...d.hands, [seat]: parseHand(hand) } })
const hpKoll = (d: Deal, facit: number[]) => {
  const hp = ORDER.map((s) => hcp(d.hands[s]))
  expect(hp).toEqual(facit)
  expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
  for (const s of ORDER) expect(d.hands[s]).toHaveLength(13)
}

describe('felrapport #118 – hoppinkliv med sexkortsfärg och 6–10 hp när partnern passat', () => {
  const D = giv('fr118', 'N', 'ew', 'S:A H:J87 D:J9864 C:Q764', 'S:J73 H:KQ94 D:Q C:AT932', 'S:QT8542 H:A D:KT32 C:J5', 'S:K96 H:T6532 D:A75 C:K8')
  it('händerna räknade med kod: 8 · 12 · 10 · 10 = 40', () => hpKoll(D, [8, 12, 10, 10]))

  it('partnern har passat: 10 hp och sex spader → 2♠ (svagt hoppinkliv)', () => {
    const c = decideCall(D, H('N', 'P 1C'), 'S')
    expect(c.bid).toBe('2S')
    expect(c.rule).toBe('hoppinkliv')
  })

  it('motvikt: partnern har INTE passat (Öst giv) → 1♠ som förut', () => {
    expect(decideCall({ ...D, dealer: 'E' }, H('E', '1C'), 'S').bid).toBe('1S')
  })

  it('motvikt: passad partner men bara FEM spader → 1♠', () => {
    expect(decideCall(med(D, 'S', 'S:QT854 H:A2 D:KT32 C:J5'), H('N', 'P 1C'), 'S').bid).toBe('1S')
  })

  it('motvikt: passad partner, sex spader men 11+ hp → 1♠ (för stark för spärr)', () => {
    const stark = med(D, 'S', 'S:KT8542 H:A D:KT32 C:J5')
    expect(hcp(stark.hands.S)).toBe(11)
    expect(decideCall(stark, H('N', 'P 1C'), 'S').bid).toBe('1S')
  })
})

describe('felrapport #119 – cue-bjudaren efter inklivarens minimisvar: pass / 3M inbjudan / 4M', () => {
  const D = giv('fr119', 'W', 'none', 'S:QJT H:KQ873 D:972 C:86', 'S:A92 H:T92 D:QJ6543 C:Q', 'S:87654 H:A64 D:- C:AKJ92', 'S:K3 H:J5 D:AKT8 C:T7543')
  const TILL_SYD = '1C 1H P 2C P 2H P'
  it('händerna räknade med kod: 8 · 9 · 12 · 11 = 40', () => hpKoll(D, [8, 9, 12, 11]))

  it('motorn bjuder som i rapporten fram till felet: cue 2♣ och minimisvaret 2♥', () => {
    expect(decideCall(D, H('W', '1C 1H P'), 'S').bid).toBe('2C')
    expect(decideCall(D, H('W', '1C 1H P 2C P'), 'N').bid).toBe('2H')
  })

  it('rapportens Syd (18 stödpoäng): cue en gång till, 3♣ — aldrig 3NT med renons', () => {
    expect(dummyPoints(D.hands.S, 'hearts').dummyPoints).toBe(18)
    const c = decideCall(D, H('W', TILL_SYD), 'S')
    expect(c.bid).toBe('3C')
    expect(c.rule).toBe('cue-höjningens fortsättning (andra cuen)')
  })

  it('Nord med svagt inkliv (8 hp) svarar 3♥ på andra cuen — och Syd passar', () => {
    const n = decideCall(D, H('W', TILL_SYD + ' 3C P'), 'N')
    expect(n.bid).toBe('3H')
    expect(n.rule).toBe('inklivaren svarar andra cuen (minimum)')
    const s = decideCall(D, H('W', TILL_SYD + ' 3C P 3H P'), 'S')
    expect(s.bid).toBe('P')
    expect(s.rule).toBe('andra cuen: inklivaren var svag')
  })

  const N12 = 'S:QJT H:KQ873 D:A72 C:86'
  it('Nord med 10+ (12 hp) lägger upp 4♥ på andra cuen', () => {
    const n = med(D, 'N', N12)
    expect(hcp(n.hands.N)).toBe(12)
    expect(decideCall(n, H('W', '1C 1H P 2C P'), 'N').bid).toBe('2H') // under 14 → minimisvaret
    const c = decideCall(n, H('W', TILL_SYD + ' 3C P'), 'N')
    expect(c.bid).toBe('4H')
    expect(c.rule).toBe('inklivaren svarar andra cuen (utgång)')
  })

  const S13 = 'S:K765 H:A64 D:32 C:AJ92'
  it('Syd med 13–14 stödpoäng: 3♥ (inbjudan); Nord passar med 8 hp, höjer med 12', () => {
    const s = med(D, 'S', S13)
    expect(dummyPoints(s.hands.S, 'hearts').dummyPoints).toBe(13)
    const c = decideCall(s, H('W', TILL_SYD), 'S')
    expect(c.bid).toBe('3H')
    expect(c.rule).toBe('cue-höjningens fortsättning (inbjudan)')
    expect(decideCall(s, H('W', TILL_SYD + ' 3H P'), 'N').bid).toBe('P')
    const hoj = decideCall(med(s, 'N', N12), H('W', TILL_SYD + ' 3H P'), 'N')
    expect(hoj.bid).toBe('4H')
    expect(hoj.rule).toBe('inklivaren antar cue-inbjudan')
  })

  it('Syd med 19+ stödpoäng: 4♥ direkt (inte 3NT trots klöverstopp, renons i ruter)', () => {
    const s = med(D, 'S', 'S:A7654 H:A64 D:- C:AKJ92')
    expect(hcp(s.hands.S)).toBe(16)
    expect(dummyPoints(s.hands.S, 'hearts').dummyPoints).toBe(22)
    expect(decideCall(s, H('W', TILL_SYD), 'S').bid).toBe('4H')
  })

  it('Syd med ren limithöjning (under 13 stödpoäng): pass som förut', () => {
    const s = med(D, 'S', 'S:8765 H:A64 D:32 C:AJ92')
    const c = decideCall(s, H('W', TILL_SYD), 'S')
    expect(c.bid).toBe('P')
    expect(c.rule).toBe('cue-höjningens fortsättning (limit stannar)')
  })
})

describe('felrapport #121 – 11 hp med femkorts högfärg öppnar alltid 1M (hand 1–3, oavsett zon)', () => {
  const D = giv('fr121', 'S', 'ew', 'S:JT92 H:Q D:6 C:AKQJT54', 'S:A743 H:KT52 D:KQ54 C:2', 'S:KQ6 H:AJ764 D:JT3 C:93', 'S:85 H:983 D:A9872 C:876')
  it('händerna räknade med kod: 13 · 12 · 11 · 4 = 40', () => hpKoll(D, [13, 12, 11, 4]))

  it('rapportens hand öppnar 1♥ i första hand', () => {
    const c = decideCall(D, [], 'S')
    expect(c.bid).toBe('1H')
    expect(c.rule).toBe('5-korts högfärg')
  })

  const EXEMPEL: [string, string][] = [
    ['S:KQ6 H:AJ764 D:JT3 C:93', '1H'], ['S:AK872 H:A53 D:862 C:74', '1S'],
    ['S:J5 H:AQT96 D:K742 C:J3', '1H'], ['S:K9 H:Q8643 D:AJ5 C:J72', '1H'],
  ]
  for (const [hand, bud] of EXEMPEL) {
    it(`${hand} (11 hp) → ${bud} i ozon och i zon, första och andra hand`, () => {
      expect(hcp(parseHand(hand))).toBe(11)
      for (const zon of ['none', 'all'] as Zon[]) {
        expect(decideCall(med(D, 'S', hand, { vulnerability: zon }), [], 'S').bid).toBe(bud)
        expect(decideCall(med(D, 'S', hand, { vulnerability: zon, dealer: 'E' }), H('E', 'P'), 'S').bid).toBe(bud)
      }
    })
  }

  it('motvikt: 11 hp UTAN femkorts högfärg (platt) passar som förut', () => {
    const platt = 'S:KQ6 H:AJ76 D:JT3 C:932'
    expect(hcp(parseHand(platt))).toBe(11)
    expect(decideCall(med(D, 'S', platt), [], 'S').bid).toBe('P')
  })

  it('motvikt: 10 hp med femkorts högfärg passar i första hand', () => {
    const tio = 'S:KQ6 H:KJ764 D:JT3 C:93'
    expect(hcp(parseHand(tio))).toBe(10)
    expect(decideCall(med(D, 'S', tio), [], 'S').bid).toBe('P')
  })

  it('motvikt: fjärde hand följer regeln om 15 (11 hp + tre spader = 14 → pass)', () => {
    expect(decideCall(med(D, 'S', 'S:KQ6 H:AJ764 D:JT3 C:93', { dealer: 'W' }), H('W', 'P P P'), 'S').bid).toBe('P')
  })
})
