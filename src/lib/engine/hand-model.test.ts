import { describe, expect, it } from 'vitest'
import type { Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { buildHandModel } from './hand-model'
import { startingPoints } from './evaluation'
import { hcp } from './hand'
import { botAuction, dealFromSeed } from './revisor'

/** Kort hjälp: bygg en budföljd ur [seat, bid]-par. */
const calls = (...pairs: [Seat, string][]): ResolvedCall[] => pairs.map(([seat, bid]) => ({ seat, bid }))

describe('buildHandModel – HP-liggaren ur auktionen (Steg 2 del 1)', () => {
  it('1NT-öppning → öppnaren 15–17 hp', () => {
    const m = buildHandModel(calls(['N', '1NT'], ['E', 'P'], ['S', 'P'], ['W', 'P']))
    expect(m.N.hcpMin).toBe(15)
    expect(m.N.hcpMax).toBe(17)
  })

  it('2NT-öppning → öppnaren 20–21 hp', () => {
    const m = buildHandModel(calls(['N', '2NT'], ['E', 'P'], ['S', 'P'], ['W', 'P']))
    expect(m.N.hcpMin).toBe(20)
    expect(m.N.hcpMax).toBe(21)
  })

  it('1-i-färg-öppning → tak 21 hp men löftet i POÄNG (max(hp, startpoäng) ≥ 12), inte rått hp-golv', () => {
    // MC-urfallet fix 1 (2026-08-13): systemet öppnar på `hp ≥ 12 ELLER startpoäng
    // ≥ 12` (openings.ts) — en bra 11:a och t.o.m. 7 hp / 12 TP öppnar. Ett rått
    // hp-golv 12 uteslöt de sanna händerna och slog ut Monte-Carlo-samplern.
    const m = buildHandModel(calls(['N', '1S']))
    expect(m.N.hcpMin).toBe(0)
    expect(m.N.hcpMax).toBe(21)
    expect(m.N.minPoints).toBe(12)
  })

  it('passad hand (pass före något kontraktsbud) → högst 11 hp', () => {
    // Given N (dealer) passar, Ö passar, S öppnar 1♥. N och Ö är passade händer.
    const m = buildHandModel(calls(['N', 'P'], ['E', 'P'], ['S', '1H']))
    expect(m.N.hcpMax).toBe(11)
    expect(m.E.hcpMax).toBe(11)
    expect(m.S.minPoints).toBe(10) // öppnaren i 3:e hand — lättöppning (10–11 hp) möjlig
  })

  it('pass EFTER en öppning kapar inte (kan vara trap/svag utan att förneka)', () => {
    // N öppnar 1♠, Ö passar → Ö:s pass säger inget säkert HP-tak.
    const m = buildHandModel(calls(['N', '1S'], ['E', 'P']))
    expect(m.E.hcpMax).toBe(37)
  })

  it('kända renonser från spelet vävs in', () => {
    const voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(['hearts']), S: new Set(), W: new Set() }
    const m = buildHandModel(calls(['N', '1S']), { voids })
    expect(m.E.voids.has('hearts')).toBe(true)
  })

  it('inget kontraktsbud alls (passat runt) → alla spann orörda utom passade tak', () => {
    const m = buildHandModel(calls(['N', 'P'], ['E', 'P'], ['S', 'P'], ['W', 'P']))
    for (const seat of ['N', 'E', 'S', 'W'] as Seat[]) expect(m[seat].hcpMax).toBe(11)
  })
})

describe('buildHandModel – öppningslöftet i poäng (MC-urfallet fix 1, 2026-08-13)', () => {
  it('1:a/2:a hand: minPoints 12 · 3:e hand: 10 (lättöppning) · 4:e hand: 9 (regeln om 15)', () => {
    expect(buildHandModel(calls(['N', '1H'])).N.minPoints).toBe(12)
    expect(buildHandModel(calls(['N', 'P'], ['E', '1H'])).E.minPoints).toBe(12)
    expect(buildHandModel(calls(['N', 'P'], ['E', 'P'], ['S', '1H'])).S.minPoints).toBe(10)
    expect(buildHandModel(calls(['N', 'P'], ['E', 'P'], ['S', 'P'], ['W', '1H'])).W.minPoints).toBe(9)
  })

  it('NT-öppningar är hp-definierade → inget minPoints-löfte', () => {
    const m = buildHandModel(calls(['N', '1NT']))
    expect(m.N.minPoints).toBeUndefined()
    expect(m.N.hcpMin).toBe(15)
  })

  it('facit frö 20260772: modellen ur den verkliga auktionen släpper in öppnarens sanna 7 hp-hand', () => {
    // Syd öppnade 1♣ med 7 hp / 12 TP (S:5 H:Q86 D:4 C:AJT97654) — systemriktigt.
    // Det gamla hp-golvet 12 uteslöt handen → sampleLayouts 0 lägen → MC-urfall.
    const deal = dealFromSeed(20260772)
    const history = botAuction(deal)!
    const m = buildHandModel(history)
    expect(hcp(deal.hands.S)).toBe(7)
    expect(m.S.hcpMin).toBeLessThanOrEqual(7) // sanna handen får inte uteslutas på hp
    expect(m.S.minPoints).toBe(12) // men löftet "öppningshand" står kvar — i poäng
    expect(Math.max(hcp(deal.hands.S), startingPoints(deal.hands.S).startingPoints)).toBeGreaterThanOrEqual(12)
  })

  it('den sanna bra 11:an (frö 20260731, N 1♠ på 11 hp / 13 TP) uppfyller poänglöftet', () => {
    const hand = parseHand('S:AKJ76 H:74 D:K5 C:T853')
    expect(hcp(hand)).toBe(11)
    expect(Math.max(hcp(hand), startingPoints(hand).startingPoints)).toBeGreaterThanOrEqual(12)
  })
})

describe('buildHandModel – tvingade återbud lovar ingen sjätte kort (MC-urfallet fix 4)', () => {
  it('svar på negativ dubbling: 1♠…2♠ är billigast möjliga (5+), inte 6+ (frö 20260731)', () => {
    const seq: ResolvedCall[] = [
      { seat: 'N', bid: '1S' },
      { seat: 'E', bid: '2D' },
      { seat: 'S', bid: 'X', rule: 'negativ dubbling' },
      { seat: 'W', bid: 'P' },
      { seat: 'N', bid: '2S', rule: 'svar på negativ dubbling' },
    ]
    const m = buildHandModel(seq)
    expect(m.N.length.spades.min).toBe(5) // öppningens 5+ står — återbudet lägger inget till
  })

  it('cue-tvångets lägsta återbud (20260772-formen: X → 2♥ på cue → 3♥) lovar 4, inte 6', () => {
    const seq: ResolvedCall[] = [
      { seat: 'S', bid: '1C' },
      { seat: 'W', bid: 'X', rule: 'upplysningsdubbling' },
      { seat: 'N', bid: 'P' },
      { seat: 'E', bid: '2C', rule: 'cue (krav)' },
      { seat: 'S', bid: 'P' },
      { seat: 'W', bid: '2H', rule: 'dubblarens svar på cue' },
      { seat: 'N', bid: 'P' },
      { seat: 'E', bid: '2S', rule: 'tvångssvar (utan stöd)' },
      { seat: 'S', bid: 'P' },
      { seat: 'W', bid: '3H', rule: 'starkt återbud (lägsta)' },
    ]
    const m = buildHandModel(seq)
    expect(m.W.length.hearts.min).toBe(4) // cue-svarets 4-kortsfärg, ombjuden av tvång
  })

  it('facit frö 20260731: modellen ur den verkliga auktionen släpper in Nords 5-korts spader', () => {
    // N: S:AKJ76 — öppnade 1♠ och tvingades rebjuda 2♠ på negativ X. Det gamla
    // 6+-golvet uteslöt sanna handen → Västs sampler fick 0 lägen → MC-urfall.
    const deal = dealFromSeed(20260731)
    const history = botAuction(deal)!
    const m = buildHandModel(history)
    expect(deal.hands.N.filter((c) => c.suit === 'spades').length).toBe(5)
    expect(m.N.length.spades.min).toBe(5)
  })
})

describe('buildHandModel – färglängder ur naturliga bud (Steg 2 del 2)', () => {
  it('högfärgsöppning 1♥ → öppnaren 5+ hjärter', () => {
    const m = buildHandModel(calls(['N', '1H']))
    expect(m.N.length.hearts.min).toBe(5)
  })

  it('minoröppning 1♣ → öppnaren 3+ klöver (inte 4)', () => {
    const m = buildHandModel(calls(['N', '1C']))
    expect(m.N.length.clubs.min).toBe(3)
  })

  it('1NT-öppning → balanserad: varje färg 2–5', () => {
    const m = buildHandModel(calls(['N', '1NT']))
    for (const s of ['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]) {
      expect(m.N.length[s].min).toBe(2)
      expect(m.N.length[s].max).toBe(5)
    }
  })

  it('svararens nya färg → 4+ i den färgen', () => {
    // N 1♣ – (P) – S 1♥ : svararens 1♥ = ny naturlig färg.
    const m = buildHandModel(calls(['N', '1C'], ['E', 'P'], ['S', '1H']))
    expect(m.S.length.hearts.min).toBe(4)
  })

  it('rebjuden egen färg → 6+', () => {
    // N 1♥ – (P) – S 1NT – (P) – N 2♥ : rebjuden hjärter.
    const m = buildHandModel(calls(['N', '1H'], ['E', 'P'], ['S', '1NT'], ['W', 'P'], ['N', '2H']))
    expect(m.N.length.hearts.min).toBe(6)
  })

  it('höjning av partnerns färg → INGEN egen längd-inferens (kan vara 3-stöd)', () => {
    // N 1♥ – (P) – S 2♥ : S höjer, vi vet inte S:s egen hjärterlängd säkert.
    const m = buildHandModel(calls(['N', '1H'], ['E', 'P'], ['S', '2H']))
    expect(m.S.length.hearts.min).toBe(0)
  })

  it('känd renons slår budinferensen → längd exakt 0', () => {
    // Ö "visade" spader men en renons är känd från spelet → 0 vinner.
    const voids: Record<Seat, Set<Suit>> = { N: new Set(), E: new Set(['spades']), S: new Set(), W: new Set() }
    const m = buildHandModel(calls(['N', 'P'], ['E', '1S']), { voids })
    expect(m.E.length.spades.max).toBe(0)
    expect(m.E.length.spades.min).toBe(0)
  })
})

describe('buildHandModel – svaga öppningar + svararens golv (Steg 2 del 3)', () => {
  it('svag tvåöppning 2♥ → 4–11 hp, 6+ hjärter', () => {
    const m = buildHandModel(calls(['N', '2H']))
    expect(m.N.hcpMin).toBe(4)
    expect(m.N.hcpMax).toBe(11)
    expect(m.N.length.hearts.min).toBe(6)
  })

  it('spärröppning 3♠ → högst 11 hp, 6+ spader', () => {
    const m = buildHandModel(calls(['N', '3S']))
    expect(m.N.hcpMax).toBe(11)
    expect(m.N.length.spades.min).toBe(6)
  })

  it('stark 2♣ → inget säkert HP-golv (artificiellt)', () => {
    const m = buildHandModel(calls(['N', '2C']))
    expect(m.N.hcpMin).toBe(0)
    expect(m.N.hcpMax).toBe(37)
  })

  it('1-lägessvar i ny färg (ostört, opassat) → 6+ hp', () => {
    // 1♣ – (P) – 1♥
    const m = buildHandModel(calls(['N', '1C'], ['E', 'P'], ['S', '1H']))
    expect(m.S.hcpMin).toBe(6)
  })

  it('2/1 (ny färg på 2-läget lägre än öppningen) → utgångskrav 12+', () => {
    // 1♠ – (P) – 2♣ = 2/1 GF
    const m = buildHandModel(calls(['N', '1S'], ['E', 'P'], ['S', '2C']))
    expect(m.S.hcpMin).toBe(12)
  })

  it('inkliv mellan öppning och svar → svararens 12-golv gäller INTE (kan konkurrera)', () => {
    // 1♠ – (2♥ inkliv) – 3♣ : störd, 2/1-golvet ska inte sättas.
    const m = buildHandModel(calls(['N', '1S'], ['E', '2H'], ['S', '3C']))
    expect(m.S.hcpMin).toBe(0)
  })

  it('passad hand som svarar 2/1 → inget 12-golv (passad = ≤11)', () => {
    // S passar först, sen N öppnar 1♠, S "2/1" 2♣ → passad, ska kapas till ≤11.
    const m = buildHandModel(calls(['S', 'P'], ['W', 'P'], ['N', '1S'], ['E', 'P'], ['S', '2C']))
    expect(m.S.hcpMax).toBe(11)
    expect(m.S.hcpMin).toBeLessThanOrEqual(11)
  })
})
