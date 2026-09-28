// SVAGT HOPPSKIFT 1♥–2♠ + SVARARENS 2♠-ÅTERBUD EFTER 1♥–1♠–2♥ (ägarens
// struktur 2026-09-28, omvärderingsfrågan läge 2; docs/handvardering.md
// principrutan + budsystem.md §4.1/§5.2).
//
// Ägarbeslutet 2026-07-06 (felrapport #31, "inget svagt hoppskift") RIVS för
// exakt EN följd: 1♥–2♠. Ägaren 2026-09-28: "en svag hand med 5–8 hp bjuder
// spärr med 6+ korts hand, detta säger även att man är kort i partnerns färg,
// max 0–2 kort" — spärren stänger både partnern (som bara går vidare med
// 18+ TP) och Väst (ingen balanserande inkliv på 1-läget). Över 1♣/1♦ gäller
// julibeslutet fortfarande (1♥/1♠ billigast).
//
// Efter 1♥–1♠–2♥ (öppnaren rebjöd 6+ hjärter, 12–15): svararens 2♠ är
// SEMI-FORCING och lovar 5+ spader och 10+ hp (i dag: läsaren sa "6+ kort,
// högst ~10, öppnaren får passa" och motorn bjöd 2NT på en singel-hjärter-hand).
// 5-korts 6–9 passar ("vi har visat våra händer till bästa förmåga"). 2NT =
// 11–12 balanserad, FÖRNEKAR 3-korts stöd, inbjuder 3NT — därför går 3-korts
// hjärterstöd till 3♥ (inbjudan) / 4♥ (13+).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid } as ResolvedCall)
const TOM = 'S:- H:- D:- C:-'
const giv = (hands: Partial<Record<Seat, string>>): Deal =>
  ({ id: 't', board: 1, dealer: 'N', vulnerability: 'none',
    hands: { N: parseHand(hands.N ?? TOM), E: parseHand(hands.E ?? TOM), S: parseHand(hands.S ?? TOM), W: parseHand(hands.W ?? TOM) } } as Deal)
const H = (s: string) => s.split(' ').map((x) => { const [seat, bid] = x.split(':'); return call(seat as Seat, bid) })
const mening = (hist: string) => { const h = H(hist); return meaningOf(h, h.length - 1) }

describe('svagt hoppskift 1♥–2♠ (svararen, Syd)', () => {
  const syd = (hand: string) => decideCall(giv({ S: hand }), H('N:1H E:P'), 'S')
  it('6+ spader, 5–8 hp, högst två hjärter → 2♠ (spärr)', () => {
    expect(syd('S:KQ9742 H:3 D:Q842 C:53')).toMatchObject({ bid: '2S', rule: 'svagt hoppskift' }) // 7 hp (förr 1♠, responses.test.ts)
    expect(syd('S:QJ98742 H:- D:K842 C:53')).toMatchObject({ bid: '2S', rule: 'svagt hoppskift' }) // 6 hp, 7 spader, renons
    expect(syd('S:KJT982 H:74 D:Q3 C:852')).toMatchObject({ bid: '2S', rule: 'svagt hoppskift' }) // 6 hp, två hjärter
    expect(syd('S:QJT982 H:73 D:Q42 C:52')).toMatchObject({ bid: '2S', rule: 'svagt hoppskift' }) // 5 hp — golvet
  })
  it('9+ hp, tre hjärter eller under 5 hp → INTE 2♠', () => {
    expect(syd('S:KQ9742 H:3 D:Q842 C:K3')).toMatchObject({ bid: '1S' }) // 9 hp: för starkt för spärren
    expect(syd('S:KQ9742 H:J53 D:Q8 C:53')).toMatchObject({ bid: '2H', rule: 'enkel höjning' }) // 7 hp men tre hjärter → höjer
    expect(syd('S:JT9742 H:3 D:J842 C:53')).toMatchObject({ bid: 'P' }) // 2 hp: pass
  })
  it('över 1♣/1♦ gäller julibeslutet: 6-korts högfärg svarar billigast', () => {
    expect(decideCall(giv({ S: 'S:KQ9742 H:3 D:863 C:K95' }), H('N:1D E:P'), 'S')).toMatchObject({ bid: '1S' })
    expect(decideCall(giv({ S: 'S:73 H:KQ9742 D:K63 C:95' }), H('N:1C E:P'), 'S')).toMatchObject({ bid: '1H' })
  })
  it('läsaren: 2♠ över 1♥ = svagt hoppskift, spärr, ej krav', () => {
    const m = mening('N:1H E:P S:2S')
    expect(m.rule).toBe('svagt hoppskift')
    expect(m.forcing).toBe('avslut')
    expect(m.text).toContain('6+')
    expect(m.text).toContain('5–8')
  })
})

describe('öppnaren efter 1♥–2♠ (Nord)', () => {
  const nord = (hand: string) => decideCall(giv({ N: hand }), H('N:1H E:P S:2S W:P'), 'N')
  it('minimum → pass (spärren står)', () => {
    expect(nord('S:73 H:AKJ85 D:K842 C:Q5')).toMatchObject({ bid: 'P' }) // 13 hp, två spader
    expect(nord('S:K73 H:AQJ85 D:K84 C:Q5')).toMatchObject({ bid: 'P' }) // 15 hp, tre spader — under 16
  })
  it('3+ spader och 16+ → 4♠', () => {
    expect(nord('S:K73 H:AQJ85 D:AK4 C:Q5')).toMatchObject({ bid: '4S' }) // 18 hp
  })
  it('två spader och 18+ startpoäng → 4♠ (ägarens "18+ TP med 2 spader")', () => {
    expect(nord('S:A3 H:AKJ852 D:AK4 C:Q5')).toMatchObject({ bid: '4S' }) // 20 hp, 6 hjärter
  })
})

describe('svararens andra bud efter 1♥–1♠–2♥ (Syd)', () => {
  const hist = 'N:1H E:P S:1S W:P N:2H E:P'
  const syd = (hand: string) => decideCall(giv({ S: hand }), H(hist), 'S')
  it('5+ spader och 10–12 hp → 2♠ (semi-forcing) — förr 2NT', () => {
    expect(syd('S:KQ953 H:4 D:KJ72 C:Q84')).toMatchObject({ bid: '2S', rule: 'rebjuden färg (semi-forcing)' }) // 11 hp, singel hjärter (läge 2)
    expect(syd('S:KQ9853 H:4 D:KJ7 C:Q84')).toMatchObject({ bid: '2S', rule: 'rebjuden färg (semi-forcing)' }) // 11 hp, sex spader
    expect(syd('S:KQ953 H:4 D:QJ72 C:Q84')).toMatchObject({ bid: '2S', rule: 'rebjuden färg (semi-forcing)' }) // 10 hp — golvet
  })
  it('5 spader och 6–9 hp → pass (händerna är visade)', () => {
    expect(syd('S:KQ953 H:4 D:J872 C:Q84')).toMatchObject({ bid: 'P' }) // 8 hp
  })
  it('2NT förnekar 3-korts stöd: med tre hjärter höjs hjärtern i stället', () => {
    expect(syd('S:KQ95 H:J43 D:KJ7 C:Q84')).toMatchObject({ bid: '3H' }) // 12 hp, tre hjärter → inbjudan
    expect(syd('S:KQ95 H:J43 D:KJ7 C:A84')).toMatchObject({ bid: '4H' }) // 14 hp, tre hjärter → utgång
  })
  it('11–12 balanserad utan fem spader och utan tre hjärter → 2NT (inbjudan)', () => {
    expect(syd('S:KQ95 H:4 D:KJ72 C:Q984')).toMatchObject({ bid: '2NT' }) // 11 hp, fyra spader
  })
  it('läsaren: 2♠ = 5+ spader, 10+ hp, semi-forcing', () => {
    const m = mening(`${hist} S:2S`)
    expect(m.rule).toBe('rebjuden färg (semi-forcing)')
    expect(m.forcing).toBe('semi-krav')
    expect(m.text).toContain('5+')
    expect(m.text).toContain('10+')
  })
})

describe('öppnarens tredje bud efter 1♥–1♠–2♥–2♠ (Nord)', () => {
  const hist = 'N:1H E:P S:1S W:P N:2H E:P S:2S W:P'
  const nord = (hand: string) => decideCall(giv({ N: hand }), H(hist), 'N')
  it('högst två spader och 12–13 → pass', () => {
    expect(nord('S:73 H:AKJ852 D:K84 C:Q5')).toMatchObject({ bid: 'P' }) // 13 hp
  })
  it('högst två spader och 14–15 → 3♥ (extra styrka, 6+ hjärter)', () => {
    expect(nord('S:Q3 H:AKJ852 D:K84 C:Q5')).toMatchObject({ bid: '3H' }) // 15 hp
  })
  it('tre spader: 12–13 → 3♠, 14–15 → 4♠', () => {
    expect(nord('S:Q73 H:AKJ852 D:842 C:Q5')).toMatchObject({ bid: '3S' }) // 12 hp
    expect(nord('S:Q73 H:AKJ852 D:K84 C:Q5')).toMatchObject({ bid: '4S' }) // 15 hp
  })
  it('läsaren namnger öppnarens tredje bud', () => {
    expect(mening(`${hist} N:3S`).rule).toBe('rebid: stöd')
    expect(mening(`${hist} N:3H`).forcing).toBe('inbjudan')
  })
})

describe('svararens placering efter öppnarens 3♥/3♠ (Syd)', () => {
  const hist = 'N:1H E:P S:1S W:P N:2H E:P S:2S W:P'
  const syd = (hand: string, third: string) => decideCall(giv({ S: hand }), H(`${hist} N:${third} E:P`), 'S')
  it('efter 3♠ (tre spader, minimum): 10–11 pass, 12 → 4♠', () => {
    expect(syd('S:KQ953 H:4 D:QJ72 C:Q84', '3S')).toMatchObject({ bid: 'P' }) // 10 hp
    expect(syd('S:KQ953 H:4 D:KJ72 C:K84', '3S')).toMatchObject({ bid: '4S' }) // 12 hp
  })
  it('efter 3♥ (två spader, 14–15): 10–11 pass, 12 → 4♥ med två hjärter, annars 3NT', () => {
    expect(syd('S:KQ953 H:4 D:QJ72 C:Q84', '3H')).toMatchObject({ bid: 'P' }) // 10 hp
    expect(syd('S:KQ953 H:43 D:KJ7 C:K84', '3H')).toMatchObject({ bid: '4H' }) // 12 hp, två hjärter (6-2)
    expect(syd('S:KQ953 H:4 D:KJ72 C:K84', '3H')).toMatchObject({ bid: '3NT' }) // 12 hp, singel hjärter
  })
})
