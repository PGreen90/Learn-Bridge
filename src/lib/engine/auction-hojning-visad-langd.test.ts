// Pliktsvepet K3 (2026-09-02, docs/senare.md "Svep: partnerskapsplikter i
// konkurrens"): HÖJNING PÅ VISAD LÄNGD. Svepet fann 92 av 1539 störda auktioner
// där en bot passade en billig höjning trots känd fit:
//   (a) advancern med 3-korts stöd för partnerns 1-lägesinkliv (5+ lovat) —
//       `fitLengthNeeded` krävde 4, så 1♥–(1♠)–2♥–P blev regel (frö 20261314),
//   (b) svararen över ett 1NT-INKLIV hade inget svar alls (frö 20260732),
//   (c) svararen över OVANLIG 2NT / MICHAELS hade inget svar alls (frö 20262021,
//       20263327: ♠K9874 + 17 stödpoäng passade 2NT).
// Ägarbeslut 2026-09-02: (1) 3-korts stöd → enkel höjning från 6 hp, aldrig
// hopp; (2) över 1NT-inkliv: 2M med 3+ stöd (6–9), X = straff med 10+;
// (3) över tvåfärgsinkliv: 3M = TÄVLANDE höjning med svaga poäng (4+ stöd),
// 10+ stödpoäng → 4M direkt.
//
// Kör om svepet: $env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { dealFromSeed } from './revisor'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

function dealOf(dealer: Seat, vul: Deal['vulnerability'], hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: vul, board: 3,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('K3 (a) – advancern höjer partnerns 1-lägesinkliv på 3-korts stöd', () => {
  it('frö 20261314: 1♥–(1♠)–2♥: Väst (♠A75, 10 hp) höjer 2♠ — inte pass', () => {
    const deal = dealFromSeed(20261314)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '1H'), call('E', '1S'), call('S', '2H')]
    const c = decideCall(deal, hist, 'W')
    expect(c.bid).toBe('2S')
  })

  it('frö 20261952: 1♣–(1♥)–2♣: Syd (♥J75, 11 hp) höjer 2♥ — enkel höjning, aldrig hopp på 3-korts stöd', () => {
    const deal = dealFromSeed(20261952)
    const hist = [call('W', '1C'), call('N', '1H'), call('E', '2C')]
    expect(decideCall(deal, hist, 'S').bid).toBe('2H')
  })

  it('frö 20261703: 1♦–(1♥)–2♦: Öst (♥KJ8, 4 hp) är för svag → pass', () => {
    const deal = dealFromSeed(20261703)
    const hist = [call('E', 'P'), call('S', '1D'), call('W', '1H'), call('N', '2D')]
    expect(decideCall(deal, hist, 'E').bid).toBe('P')
  })

  it('frö 20261363: 1♥–(1♠)–2♥: Nord (♠T94, 8 hp) tävlar 2♠', () => {
    const deal = dealFromSeed(20261363)
    const hist = [call('N', 'P'), call('E', '1H'), call('S', '1S'), call('W', '2H')]
    expect(decideCall(deal, hist, 'N').bid).toBe('2S')
  })

  it('frö 20263212: (2♠)–P–P–3♦ balansinkliv, Nord har ♦AT954 (11 trumf, 9 hp) → höjer 4♦ (balanseringstaket får inte stoppa den enkla höjningen)', () => {
    const deal = dealFromSeed(20263212)
    const hist = [call('W', '2S'), call('N', 'P'), call('E', 'P'), call('S', '3D'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('4D')
  })

  it('pressad till 3-läget med bara 3-korts stöd (8 trumf) → pass (lagen om totala stick)', () => {
    // frö 20261314 men motståndarna hoppar till 3♥: Väst har 8 trumf, inte 9.
    const deal = dealFromSeed(20261314)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '1H'), call('E', '1S'), call('S', '3H')]
    expect(decideCall(deal, hist, 'W').bid).toBe('P')
  })
})

describe('K3 (b) – svararen över ett 1NT-inkliv', () => {
  it('frö 20260732: 1♥–(1NT): Nord (♥9752, 7 hp) höjer 2♥ (konkurrenshöjning)', () => {
    const deal = dealFromSeed(20260732)
    const c = decideCall(deal, [call('S', '1H'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('2H')
    expect(c.rule).toBe('konkurrenshöjning')
  })

  it('frö 20261612: 1♠–(1NT): Nord (♠J965, 8 hp) höjer 2♠', () => {
    const deal = dealFromSeed(20261612)
    const c = decideCall(deal, [call('N', 'P'), call('E', 'P'), call('S', '1S'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('2S')
  })

  it('frö 20260732 med 10+ hp hos svararen: X = straff', () => {
    // Syd öppnar 1♥, Väst 1NT; ge Nord en 11-poängare utan att röra övriga.
    const base = dealFromSeed(20260732)
    const deal = { ...base, hands: { ...base.hands } }
    // ♠AK5 ♥9752 ♦T85 ♣T53 → byt ♣T53 mot ♣KQ3 (klöverkorten tas från Östs hand är
    // ovidkommande för Nords beslut – decideCall läser bara Nords hand här).
    deal.hands.N = deal.hands.N.map((c) =>
      c.suit === 'clubs' && c.rank === '10' ? { suit: 'clubs', rank: 'K' } :
      c.suit === 'clubs' && c.rank === '5' ? { suit: 'clubs', rank: 'Q' } : c,
    )
    const c = decideCall(deal, [call('S', '1H'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('X')
    expect(c.rule).toBe('straffdubbling')
  })

  // Felrapport #97 (2026-10-04, bricka 10): 1♦–(1NT) med ♦J83 och 8 hp höjdes
  // till 2♦. Ägaren: "för att partner skall få bjuda stöd i lågfärgsöppning så
  // krävs minst 4 korts stöd" — samma golv som ostört (1m–2m = 4+). Gäller alla
  // svararens höjningar i konkurrens: över 1NT, över färginkliv (höjning OCH
  // cue = limithöjning+) och över deras X.
  const R97 = dealOf('E', 'all', { N: 'S:T74 H:K62 D:J83 C:A752', E: 'S:98632 H:T854 D:T6 C:KT', S: 'S:AJ H:J93 D:A972 C:Q984', W: 'S:KQ5 H:AQ7 D:KQ54 C:J63' })
  it('felrapport #97: 1♦–(1NT) med trekorts ruterstöd (8 hp) → pass, inte 2♦', () => {
    const c = decideCall(R97, [call('E', 'P'), call('S', '1D'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('P')
  })
  it('samma hand med fyra ruter (♦J83 → ♦J832, ♣A75) → 2♦ som förr', () => {
    const d = dealOf('E', 'all', { N: 'S:T74 H:K62 D:J832 C:A75', E: 'S:98632 H:T854 D:T6 C:KT', S: 'S:AJ H:J93 D:A97 C:Q9842', W: 'S:KQ5 H:AQ7 D:KQ54 C:J63' })
    const c = decideCall(d, [call('E', 'P'), call('S', '1D'), call('W', '1NT')], 'N')
    expect(c.bid).toBe('2D')
    expect(c.rule).toBe('konkurrenshöjning')
  })
  it('1♦–(1♠) med trekorts ruter och 8 hp → ingen konkurrenshöjning (negativ X på 4 hjärter går före — här utan: pass/1NT)', () => {
    // ♠T74 ♥K62 ♦J83 ♣A752: utan 4-korts högfärg och utan stopp blir det pass.
    const c = decideCall(R97, [call('E', 'P'), call('S', '1D'), call('W', '1S')], 'N')
    expect(c.bid).not.toBe('2D')
  })
  it("1♦–(1♠) med trekorts ruter och 11 hp → cuen (limithöjning+) får fortfarande bjudas på tre kort — svararens enda väg med 10+ utan annat bud", () => {
    const d = dealOf('E', 'all', { N: 'S:T74 H:K62 D:J83 C:AK52', E: 'S:98632 H:T854 D:T6 C:7', S: 'S:AJ H:J93 D:A972 C:Q984', W: 'S:KQ5 H:AQ7 D:KQ54 C:JT63' })
    const c = decideCall(d, [call('E', 'P'), call('S', '1D'), call('W', '1S')], 'N')
    expect(c.bid).toBe("2S")
  })
  it('1♦–(X) med trekorts ruter och 7 hp → pass, inte 2♦', () => {
    const d = dealOf('E', 'all', { N: 'S:T74 H:Q62 D:J83 C:A752', E: 'S:98632 H:T854 D:T6 C:KT', S: 'S:AJ H:KJ9 D:A972 C:Q984', W: 'S:KQ5 H:A73 D:KQ54 C:J63' })
    const c = decideCall(d, [call('E', 'P'), call('S', '1D'), call('W', 'X')], 'N')
    expect(c.bid).toBe('P')
  })
})

describe('K3 (c) – svararen över ovanlig 2NT / Michaels', () => {
  it('frö 20262021: 1♠–(2NT): Nord (♠QJ76, 6 hp) tävlar 3♠', () => {
    const deal = dealFromSeed(20262021)
    const c = decideCall(deal, [call('S', '1S'), call('W', '2NT')], 'N')
    expect(c.bid).toBe('3S')
    expect(c.rule).toBe('konkurrenshöjning')
  })

  it('frö 20263327: 1♠–(2NT): Nord (♠K9874, 17 stödpoäng) bjuder 4♠ direkt', () => {
    const deal = dealFromSeed(20263327)
    const c = decideCall(deal, [call('S', '1S'), call('W', '2NT')], 'N')
    expect(c.bid).toBe('4S')
  })

  it('frö 20262025: 1♥–(2NT): Nord (♠7 ♥K753, 9 hp = 13 stödpoäng) bjuder 4♥', () => {
    const deal = dealFromSeed(20262025)
    const c = decideCall(deal, [call('N', 'P'), call('E', 'P'), call('S', '1H'), call('W', '2NT')], 'N')
    expect(c.bid).toBe('4H')
  })

  it('frö 20261162: 1♥–(2NT): Öst (♥8764, 14 stödpoäng) bjuder 4♥', () => {
    const deal = dealFromSeed(20261162)
    const c = decideCall(deal, [call('W', '1H'), call('N', '2NT')], 'E')
    expect(c.bid).toBe('4H')
  })

  // Felrapport #61 (bricka 3): 1♥–(2♥ Michaels = spader + minor). Nord har
  // ♠Q9832 ♥AJ74 ♦T2 ♣Q9 = 9 hp, som med två dubbletonger räknades till 11
  // stödpoäng → 4♥ direkt. Men ♠Q sitter i VÄSTS visade spaderfärg (under AK)
  // och är död; efter avdrag för honnören i deras färg är Nord under 10 →
  // tävlande 3♥, inte utgång (ägarbeslut 2026-09-16).
  it('frö felrapport #61: 1♥–(2♥ Michaels): Nord (♠Q9832 ♥AJ74, ♠Q i deras färg) tävlar 3♥, inte 4♥', () => {
    const deal = dealOf('S', 'ew', {
      N: 'S:Q9832 H:AJ74 D:T2 C:Q9',
      E: 'S:J H:852 D:543 C:T87643',
      S: 'S:T7 H:KQT96 D:Q96 C:KJ5',
      W: 'S:AK654 H:3 D:AKJ87 C:A2',
    })
    const c = decideCall(deal, [call('S', '1H'), call('W', '2H')], 'N')
    expect(c.bid).toBe('3H')
    expect(c.rule).toBe('konkurrenshöjning')
  })

  // Felrapport #99 (2026-10-06, bricka 1): 1♠–(2NT ovanlig) med ♠732 ♥KJ3 ♦AQJT
  // ♣A84 (15 hp) fick bara 3♠ (tävlande, ej krav) — 3-korts stöd nådde aldrig
  // utgång. Ägarbeslut 2026-10-06 ("enkla vägen"): 3-korts stöd med utgångs-
  // värden (13+ stödpoäng) → 4M direkt, som 4-korts stöd med 10+ redan gör.
  const R99 = dealOf('N', 'none', { N: 'S:KQJ854 H:A62 D:42 C:Q3', E: 'S:- H:QT7 D:K8653 C:KT652', S: 'S:732 H:KJ3 D:AQJT C:A84', W: 'S:AT96 H:9854 D:97 C:J97' })
  it('felrapport #99: 1♠–(2NT) med trekorts stöd och 15 hp → 4♠ direkt', () => {
    const c = decideCall(R99, [call('N', '1S'), call('E', '2NT')], 'S')
    expect(c.bid).toBe('4S')
  })
  it('samma läge med 11 hp (♦AQJT → ♦QJT9, ♣A84 → ♣K84) → 3♠ tävlande som förr', () => {
    const d = dealOf('N', 'none', { N: 'S:KQJ854 H:A62 D:42 C:Q3', E: 'S:- H:QT7 D:K8653 C:AT652', S: 'S:732 H:KJ3 D:QJT9 C:K84', W: 'S:AT96 H:9854 D:A7 C:J97' })
    const c = decideCall(d, [call('N', '1S'), call('E', '2NT')], 'S')
    expect(c.bid).toBe('3S')
  })
})

// Felrapport #98 (2026-10-06, bricka 2): 1♥–(X)–XX–(1♠)–P–(P)–? Väst ♠AKJ86
// ♥765 ♦642 ♣A2 (12 hp, 14 stödpoäng) bjöd 2♥ med skälet "partnern har passat
// (minimum)". Men öppnarens pass efter vår XX är inget minimum — det säger
// "inget eget att säga, du bestämmer". Ägarbeslut 2026-10-06: redubblarens
// andra bud med stöd i öppningshögfärgen = 13+ stödpoäng → 4M, 10–12 → 3M
// (invit); utan stöd men 4+ bra kort i färgen de flydde till → X (straff).
describe('felrapport #98 – redubblarens andra bud efter 1M–(X)–XX–(deras färg)–P–(P)', () => {
  const R98 = dealOf('E', 'ns', { N: 'S:7543 H:QJ2 D:Q83 C:Q76', E: 'S:2 H:KT984 D:AJ7 C:KT93', S: 'S:QT9 H:A3 D:KT95 C:J854', W: 'S:AKJ86 H:765 D:642 C:A2' })
  const HIST = [call('E', '1H'), call('S', 'X'), call('W', 'XX'), call('N', '1S'), call('E', 'P'), call('S', 'P')]
  it('rapportens Väst (14 stödpoäng, tre hjärter) → 4♥, inte 2♥', () => {
    const c = decideCall(R98, HIST, 'W')
    expect(c.bid).toBe('4H')
  })
  it('hela auktionen slutar i 4♥ av Öst', () => {
    const h = [...HIST]
    let guard = 0
    while (!auctionComplete(h) && guard++ < 30) h.push(decideCall(R98, h, seatToAct(R98.dealer, h.length)))
    const k = contractFromCalls(h)!
    expect(k.strain).toBe('hearts')
    expect(k.level).toBe(4)
    expect(k.declarer).toBe('E')
  })
  it('10–12 stödpoäng med stöd (♠KQJ86 ♥765 ♦642 ♣A2 = 10 hp, 12 stödpoäng) → 3♥ invit', () => {
    const d = dealOf('E', 'ns', { N: 'S:7543 H:QJ2 D:Q83 C:Q76', E: 'S:2 H:KT984 D:AJ7 C:KT93', S: 'S:AT9 H:A3 D:KT95 C:J854', W: 'S:KQJ86 H:765 D:642 C:A2' })
    const c = decideCall(d, HIST, 'W')
    expect(c.bid).toBe('3H')
  })
  it('utan stöd men ♠AKJ86 i färgen de flydde till → X (straff)', () => {
    const d = dealOf('E', 'ns', { N: 'S:7543 H:QJ2 D:Q83 C:Q76', E: 'S:2 H:KT984 D:AJ7 C:KT93', S: 'S:QT9 H:A73 D:KT95 C:J85', W: 'S:AKJ86 H:65 D:642 C:A42' })
    const c = decideCall(d, HIST, 'W')
    expect(c.bid).toBe('X')
    // Öppnaren läser X:et som STRAFF (förr 'svar på negativ dubbling' → 2♣) → pass.
    const o = decideCall(d, [...HIST, c, call('N', 'P')], 'E')
    expect(o.bid).toBe('P')
  })
  it('öppnaren efter 3♥-inviten: 15 Bergenpoäng (5-4-3-1, 11 hp) → 4♥; 12 hp jämn → pass', () => {
    const d = dealOf('E', 'ns', { N: 'S:7543 H:QJ2 D:Q83 C:Q76', E: 'S:2 H:KT984 D:AJ7 C:KT93', S: 'S:AT9 H:A3 D:KT95 C:J854', W: 'S:KQJ86 H:765 D:642 C:A2' })
    const h = [...HIST, call('W', '3H'), call('N', 'P')]
    expect(decideCall(d, h, 'E').bid).toBe('4H')
    const flat = dealOf('E', 'ns', { N: 'S:7543 H:QJ2 D:Q83 C:Q76', E: 'S:92 H:KT984 D:AJ7 C:KT3', S: 'S:AT H:A3 D:KT95 C:J9854', W: 'S:KQJ86 H:765 D:642 C:A2' })
    expect(decideCall(flat, h, 'E').bid).toBe('P')
  })
})
