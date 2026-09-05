// Facit för BESLUTSTABELLEN (docs/motorbyte-plan.md etapp 3). Varje familj som
// flyttar in får sitt läge vaktat här: att raden träffar rätt läge, att den
// ger kunskapsfunktionen rätt indata ur fakta (position, sårbarhet …) och att
// den tiger utanför sitt läge (då gäller det gamla lagret tills nästa familj).
import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideFromTable, rebidAsSeen, secondAsSeen } from './auction-decide'
import { auctionFacts } from './auction-facts'
import { decideCallTraced } from './auction-live'
import { botAuction, dealFromSeed } from './revisor'
import { slamCaptainFirstStep, slamInvestigation } from './slam-auction'
import { mulberry32 } from './deal'

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
    // Efter mitt svar är det öppnarens återbud (familj 3).
    expect(bud(h, [open1S, P('E'), { seat: 'S', bid: '3S' }, P('W')], 'N')?.källa).toBe('tabell:återbud')
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

describe('familj 3 – öppnarens återbud: läget "jag öppnade, partnern svarade ostört"', () => {
  const opener = 'S:AQ863 H:K52 D:A74 C:83' // 13 hp, 5 spader
  const hist = (svar: string): ResolvedCall[] => [{ seat: 'N', bid: '1S' }, P('E'), { seat: 'S', bid: svar }, P('W')]

  it('träffar bara öppnaren, efter öppning – pass – svar – pass', () => {
    expect(bud(opener, hist('2S'), 'N')?.källa).toBe('tabell:återbud')
    // Inkliv eller X någonstans → inte den här raden (etapp 4).
    expect(bud(opener, [{ seat: 'N', bid: '1S' }, { seat: 'E', bid: 'X' }, { seat: 'S', bid: '2S' }, P('W')], 'N')).toBeNull()
    expect(bud(opener, [{ seat: 'N', bid: '1S' }, P('E'), { seat: 'S', bid: '2S' }, { seat: 'W', bid: '3C' }], 'N')).toBeNull()
    // Svararen passade → inget återbud att ta (auktionen dör eller balanseras).
    expect(bud(opener, hist('P'), 'N')).toBeNull()
  })

  it('läser partnerns bud som öppnaren ser det: samma återbud på människans 2♠ som på botens (regel bortskalad)', () => {
    const människa = bud(opener, hist('2S'), 'N')!.call
    const bot = bud(opener, [{ seat: 'N', bid: '1S' }, P('E'), { seat: 'S', bid: '2S', rule: 'enkel höjning' }, P('W')], 'N')!.call
    expect(människa.bid).toBe(bot.bid)
    expect(människa.rule).toBe(bot.rule)
  })

  it('Jacoby 2NT från människan får systemets svar, inte pass', () => {
    const c = bud(opener, hist('2NT'), 'N')!.call
    expect(c.bid).not.toBe('P')
    expect(c.rule).toContain('Jacoby')
  })

  it('1♣–1NT från människan läses som 1NT-svaret (läsarens "NT-svar" → återbudsfunktionens "1NT"): samma återbud som på botens 1NT', () => {
    const h18 = 'S:AK3 H:KQ2 D:A54 C:KJ87' // 18 hp balanserad
    const människa = bud(h18, [{ seat: 'N', bid: '1C' }, P('E'), { seat: 'S', bid: '1NT' }, P('W')], 'N')!.call
    const bot = bud(h18, [{ seat: 'N', bid: '1C' }, P('E'), { seat: 'S', bid: '1NT', rule: '1NT' }, P('W')], 'N')!.call
    expect(människa.bid).not.toBe('P')
    expect(människa.bid).toBe(bot.bid)
  })

  it('Gerber 4♣ över 1NT besvaras med essantalet ur egen hand', () => {
    const h = 'S:AK3 H:KQ2 D:A54 C:J987' // 2 ess → 4♠
    const c = bud(h, [{ seat: 'N', bid: '1NT' }, P('E'), { seat: 'S', bid: '4C' }, P('W')], 'N')!.call
    expect(c).toMatchObject({ bid: '4S', rule: 'Gerber' })
  })

  it('svag tvåa – partnerns hoppande nya färg: återbudet ligger över svaret och stannar på utgång', () => {
    const h = 'S:KJ9653 H:A98 D:5 C:JT2' // frö 20271048:s Öst
    const c = bud(h, [{ seat: 'N', bid: '2S' }, P('E'), { seat: 'S', bid: '3H' }, P('W')], 'N')!.call
    expect(c.bid).toBe('4H')
  })

  it('ser aldrig de andra händerna: samma återbud när de tre andra är kopior av den egna', () => {
    const deal = dealFromSeed(20270006)
    // Opassad svarare (Jacoby). En PASSAD hands 2NT läser lagret som naturlig inbjudan — bok-mot-motor-fråga i planens logg.
    const h: ResolvedCall[] = [{ seat: 'W', bid: '1H' }, P('N'), { seat: 'E', bid: '2NT' }, P('S')]
    const kopior = { ...deal, hands: { N: deal.hands.W, E: deal.hands.W, S: deal.hands.W, W: deal.hands.W } }
    const a = decideCallTraced(deal, h, 'W')
    const b = decideCallTraced(kopior, h, 'W')
    expect(a.källa).toBe('tabell:återbud')
    expect(a.call.bid).not.toBe('P')
    expect(b.call.bid).toBe(a.call.bid)
  })
})

describe('familj 4a – svararens andra bud: läget "jag svarade, partnern gav återbud ostört"', () => {
  const hist = (open: string, resp: string, rebid: string): ResolvedCall[] => [
    { seat: 'N', bid: open }, P('E'), { seat: 'S', bid: resp }, P('W'), { seat: 'N', bid: rebid }, P('E'),
  ]

  it('träffar bara svararen efter öppning–svar–återbud utan störning', () => {
    const h = 'S:KQ73 H:K65 D:Q92 C:83'
    expect(bud(h, hist('1C', '1S', '2S'), 'S')?.källa).toBe('tabell:svar2')
    // X någonstans, eller motståndarnas kontraktsbud → inte den här raden.
    expect(bud(h, [{ seat: 'N', bid: '1C' }, { seat: 'E', bid: 'X' }, { seat: 'S', bid: '1S' }, P('W'), { seat: 'N', bid: '2S' }, P('E')], 'S')).toBeNull()
    expect(bud(h, [{ seat: 'N', bid: '1C' }, P('E'), { seat: 'S', bid: '1S' }, P('W'), { seat: 'N', bid: '2S' }, { seat: 'E', bid: '3C' }], 'S')).toBeNull()
    // Öppnaren passade mitt svar → auktionen är slut för min del.
    expect(bud(h, hist('1S', '2S', 'P'), 'S')).toBeNull()
  })

  it('läser partnerns återbud ur den nakna auktionen: människans 2♠ (höjning) ger samma andra bud som botens', () => {
    const h = 'S:KQ73 H:A65 D:Q92 C:83' // 11 hp, 4 spader → inbjudan (3♠) efter enkel höjning
    const människa = bud(h, hist('1C', '1S', '2S'), 'S')!.call
    const bot = bud(h, [{ seat: 'N', bid: '1C' }, P('E'), { seat: 'S', bid: '1S', rule: 'ny färg (1-läget)' }, P('W'), { seat: 'N', bid: '2S', rule: 'enkel höjning' }, P('E')], 'S')!.call
    expect(människa.bid).toBe('3S')
    expect(människa.bid).toBe(bot.bid)
  })

  it('Ogust-svaret läses och svararen placerar (min/dålig → signoff i öppnarens färg)', () => {
    const h = 'S:K4 H:A98 D:KQ53 C:JT62' // 12 hp, 2-korts spader – frågade Ogust
    const c = bud(h, hist('2S', '2NT', '3C'), 'S')!.call
    expect(c).toMatchObject({ bid: '3S', rule: 'svararens signoff' })
  })

  it('systems on efter 2♣–2♦–2NT: Stayman ur egen hand', () => {
    const h = 'S:KJ74 H:9863 D:75 C:842' // 4-4 i högfärgerna, 4 hp — mot 22–24 räcker det
    const c = bud(h, hist('2C', '2D', '2NT'), 'S')!.call
    expect(c).toMatchObject({ bid: '3C', rule: 'Stayman (2NT)' })
  })

  it('slamporten (Jacoby-fit): kaptenens första steg ur egen hand, samma bud som manusets sekvens', () => {
    const h = 'S:KQ73 H:A5 D:AKJ2 C:K83' // 19 hp + 4-korts spader → slamzon mot Jacoby-minimum 12
    const c = bud(h, hist('1S', '2NT', '4S'), 'S')!.call
    expect(c.bid).not.toBe('P')
    expect(['4NT', '5S', '5C', '5D', '5H']).toContain(c.bid) // RKC / inbjudan / cue
  })

  it('"oklart" i partnerns återbud syns inte: 1♣–1♥–1NT läses som 12–14 (frö 20270949: 20 hp + 6-korts ♥ → slaminbjudan 5♥, hp mot 12–14)', () => {
    const deal = dealFromSeed(20270949) // Nord ♠A98 ♥AKQT72 ♦AQT9 ♣–, Syds 1NT-återbud var "oklart"
    const h: ResolvedCall[] = [P('E'), { seat: 'S', bid: '1C' }, P('W'), { seat: 'N', bid: '1H' }, P('E'), { seat: 'S', bid: '1NT', rule: 'oklart' }, P('W')]
    const t = decideCallTraced(deal, h, 'N')
    expect(t.källa).toBe('tabell:svar2')
    expect(t.call).toMatchObject({ bid: '5H', rule: 'slaminbjudan' })
  })

  it('familj A räknar hp, inte stödpoäng: 15 hp med 6-korts spader mot 1NT (12–14) → NMF, ingen slaminbjudan (facit frö 20261317)', () => {
    const c = bud('S:AQ8652 H:AT62 D:KQ C:3', [{ seat: 'N', bid: '1C' }, P('E'), { seat: 'S', bid: '1S' }, P('W'), { seat: 'N', bid: '1NT' }, P('E')], 'S')!.call
    expect(c).toMatchObject({ bid: '2D', rule: 'New Minor Forcing' })
  })

  it('2/1 + öppnaren höjde min högfärg under utgång → 4M (felrapport #27), höjd lågfärg går den vanliga vägen', () => {
    const n = 'S:A H:KQT94 D:KT7 C:KQ32'
    expect(bud(n, [{ seat: 'N', bid: '1S' }, P('E'), { seat: 'S', bid: '2H' }, P('W'), { seat: 'N', bid: '3H' }, P('E')], 'S')!.call).toMatchObject({ bid: '4H', rule: '2/1 utgångskrav' })
    const m = 'S:A2 H:K3 D:KQ982 C:Q832'
    const c = bud(m, [{ seat: 'N', bid: '1S' }, P('E'), { seat: 'S', bid: '2D' }, P('W'), { seat: 'N', bid: '3D' }, P('E')], 'S')!.call
    expect(c.bid).not.toBe('5D')
    expect(c.bid).not.toBe('P')
  })

  it('ser aldrig de andra händerna: samma andra bud när de tre andra är kopior av den egna', () => {
    const deal = dealFromSeed(20270949)
    const h: ResolvedCall[] = [P('E'), { seat: 'S', bid: '1C' }, P('W'), { seat: 'N', bid: '1H' }, P('E'), { seat: 'S', bid: '1NT' }, P('W')]
    const kopior = { ...deal, hands: { N: deal.hands.N, E: deal.hands.N, S: deal.hands.N, W: deal.hands.N } }
    expect(decideCallTraced(kopior, h, 'N').call.bid).toBe(decideCallTraced(deal, h, 'N').call.bid)
  })
})

describe('familj 4a – adaptern rebidAsSeen ger motorns egna namn på öppnarens återbud (3000 botauktioner)', () => {
  // Avsiktliga skillnader: partnerns egen osäkerhet ('oklart') är osynlig; ett
  // slutbud efter slaminbjudan läses som "till spel" (svararen passar ändå).
  const TILLÅTNA = new Set(['oklart', 'accepterar slaminbjudan'])
  it('samma regelnamn som boten satte, utom de tillåtna', () => {
    const avvikelser: string[] = []
    let n = 0
    for (let seed = 20270001; seed <= 20273000; seed++) {
      const deal = dealFromSeed(seed)
      const h = botAuction(deal)
      if (!h) continue
      const o = h.findIndex((c) => c.bid !== 'P')
      if (o === -1 || o + 4 >= h.length) continue
      if (h[o + 1].bid !== 'P' || h[o + 3].bid !== 'P' || h[o + 2].bid === 'P' || h[o + 4].bid === 'P') continue
      const r = h[o + 4]
      if (TILLÅTNA.has(r.rule ?? '')) continue
      n++
      const seen = rebidAsSeen(auctionFacts(h.slice(0, o + 6), h[o + 2].seat), o + 4)
      if (seen?.rule !== r.rule) avvikelser.push(`frö ${seed} ${h[o].bid}–${h[o + 2].bid}–${r.bid}: motor [${r.rule}] adapter [${seen?.rule ?? '—'}]`)
    }
    expect(n).toBeGreaterThan(900)
    expect(avvikelser, avvikelser.slice(0, 10).join('\n')).toEqual([])
  })
})

describe('familj 4a – slamsekvensens första bud är kaptenens första steg (samma port)', () => {
  it('slamInvestigation börjar alltid med slamCaptainFirstStep, för slumpade händer och trumfar', () => {
    const rng = mulberry32(4711)
    let jämförda = 0
    for (let seed = 20270001; seed <= 20270400; seed++) {
      const deal = dealFromSeed(seed)
      const trumps = ['clubs', 'diamonds', 'hearts', 'spades'] as const
      const trump = trumps[Math.floor(rng() * 4)]
      const ctx = { partnerMin: 12 + Math.floor(rng() * 8), inviteCall: trump === 'hearts' || trump === 'spades' ? `5${trump[0].toUpperCase()}` : `4${trump[0].toUpperCase()}`, gameForcing: rng() < 0.5 }
      const first = slamCaptainFirstStep(deal.hands.S, trump, '2NT', ctx)
      const seq = slamInvestigation(deal.hands.N, deal.hands.S, trump, '2NT', ctx)
      expect(seq === null).toBe(first === null)
      if (seq && first) {
        jämförda++
        expect(seq[0]).toEqual(first)
      }
    }
    expect(jämförda).toBeGreaterThan(20)
  })
})

describe('familj 4b – öppnarens tredje bud: läget "jag öppnade, partnern svarade, jag gav återbud, partnern bjöd igen — ostört"', () => {
  const hist = (open: string, resp: string, rebid: string, second: string): ResolvedCall[] => [
    { seat: 'N', bid: open }, P('E'), { seat: 'S', bid: resp }, P('W'), { seat: 'N', bid: rebid }, P('E'), { seat: 'S', bid: second }, P('W'),
  ]

  it('träffar bara öppnaren efter fyra ostörda kontraktsbud', () => {
    const h = 'S:K73 H:A2 D:AQ864 C:J93'
    expect(bud(h, hist('1D', '1S', '1NT', '2C'), 'N')?.källa).toBe('tabell:tredje')
    // X någonstans, eller motståndarnas kontraktsbud → inte den här raden.
    expect(bud(h, [{ seat: 'N', bid: '1D' }, { seat: 'E', bid: 'X' }, { seat: 'S', bid: '1S' }, P('W'), { seat: 'N', bid: '1NT' }, P('E'), { seat: 'S', bid: '2C' }, P('W')], 'N')).toBeNull()
    expect(bud(h, [{ seat: 'N', bid: '1D' }, P('E'), { seat: 'S', bid: '1S' }, P('W'), { seat: 'N', bid: '1NT' }, P('E'), { seat: 'S', bid: '2C' }, { seat: 'W', bid: '2H' }], 'N')).toBeNull()
    // Partnern passade mitt återbud → auktionen är slut för min del.
    expect(bud(h, hist('1D', '1S', '1NT', 'P'), 'N')).toBeNull()
    // Svararens tur (svararens tredje bud) är inte den här raden.
    expect(bud(h, [...hist('1D', '1S', '1NT', '2C'), { seat: 'N', bid: '2S' }, P('E')], 'S')).toBeNull()
  })

  it('New Minor Forcing besvaras ur egen hand, lika för människans och botens 2♣', () => {
    const h = 'S:K73 H:A2 D:AQ864 C:T93' // 13 hp, 3-korts spaderstöd, minimum → 2♠
    const människa = bud(h, hist('1D', '1S', '1NT', '2C'), 'N')!.call
    expect(människa).toMatchObject({ bid: '2S', rule: 'svar på New Minor Forcing' })
    const bot = bud(h, [{ seat: 'N', bid: '1D' }, P('E'), { seat: 'S', bid: '1S', rule: 'ny färg (1-läget)' }, P('W'), { seat: 'N', bid: '1NT', rule: '1NT (12–14)' }, P('E'), { seat: 'S', bid: '2C', rule: 'New Minor Forcing' }, P('W')], 'N')!.call
    expect(bot.bid).toBe(människa.bid)
  })

  it('fjärde färg besvaras i bokens mönster (tre 1-lägesbud); 2/1-formen lämnas åt det gamla lagret', () => {
    const h = 'S:KQ73 H:A72 D:8 C:AQ863'
    expect(bud(h, hist('1C', '1H', '1S', '2D'), 'N')!.call).toMatchObject({ bid: '2H', rule: 'svar på fjärde färg' })
    expect(bud(h, hist('1S', '2C', '2D', '2H'), 'N')).toBeNull()
  })

  it('egen enkel höjning + partnerns 3M-inbjudan: öppnaren dömer', () => {
    expect(bud('S:A4 H:KQ73 D:K852 C:A62', hist('1C', '1H', '2H', '3H'), 'N')!.call).toMatchObject({ bid: '4H', rule: 'inbjudan antagen' })
    expect(bud('S:J4 H:KQ73 D:K852 C:Q62', hist('1C', '1H', '2H', '3H'), 'N')!.call).toMatchObject({ bid: 'P', rule: 'inbjudan avböjd' })
  })

  it('semi-forcing 1NT: 3M-limithöjningen döms (läsarens "inbjudan (limithöjning)" = motorns "inbjudan"), egen färg efter 1NT passas', () => {
    expect(bud('S:AKJ863 H:K5 D:A74 C:83', hist('1S', '1NT', '2S', '3S'), 'N')!.call).toMatchObject({ bid: '4S', rule: 'accepterar inbjudan' })
    expect(bud('S:AQJ863 H:Q5 D:K74 C:83', hist('1S', '1NT', '2D', '2H'), 'N')!.call).toMatchObject({ bid: 'P', rule: 'pass' })
  })

  it('reverse + preferens tillbaka: 17 passar, 19 med håll driver 3NT', () => {
    expect(bud('S:A3 H:K2 D:AQ75 C:KJ864', hist('1C', '1H', '2D', '3C'), 'N')!.call).toMatchObject({ bid: 'P', rule: 'reverse: minimum' })
    expect(bud('S:A3 H:K2 D:AQJ5 C:AKQ84', hist('1C', '1H', '2D', '3C'), 'N')!.call).toMatchObject({ bid: '3NT', rule: 'reverse: 3NT' })
  })

  it('inverterad broms: minimum passar, 15+ med alla sidofärger täckta bjuder 3NT', () => {
    expect(bud('S:K72 H:Q3 D:AJ5 C:KJ864', hist('1C', '2C', '2D', '3C'), 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' })
    expect(bud('S:KQ2 H:KJ3 D:AJ5 C:KQ86', hist('1C', '2C', '2D', '3C'), 'N')!.call).toMatchObject({ bid: '3NT', rule: '3NT till spel' })
  })

  it('2/1 med försenat stöd: öppnaren beskriver på 3m; ett hopp till 4m är inte det läget (lämnas åt det gamla lagret, aldrig ett olagligt bud)', () => {
    const h = 'S:K72 H:Q3 D:AQJ54 C:K86'
    const t = bud(h, hist('1D', '2C', '2NT', '3D'), 'N')!.call
    expect(['3NT', '4D']).toContain(t.bid)
    expect(bud(h, hist('1D', '2C', '2NT', '4D'), 'N')).toBeNull()
  })

  it('1NT-auktionens inbjudan efter Stayman: maximum accepterar, minimum passar', () => {
    expect(bud('S:A4 H:KQ73 D:KJ52 C:A62', hist('1NT', '2C', '2H', '3H'), 'N')!.call).toMatchObject({ bid: '4H', rule: 'accepterar inbjudan' })
    expect(bud('S:A4 H:KQ73 D:KJ52 C:Q62', hist('1NT', '2C', '2H', '3H'), 'N')!.call).toMatchObject({ bid: 'P', rule: 'pass' })
  })

  it('ser aldrig de andra händerna: samma tredje bud när de tre andra är kopior av den egna', () => {
    const deal = dealFromSeed(20270166) // 1♠–1NT–2♠–3♠ (inbjudan) i botauktionen
    const h = botAuction(deal)!
    const o = h.findIndex((c) => c.bid !== 'P')
    const hist7 = h.slice(0, o + 7).map((c) => ({ seat: c.seat, bid: c.bid }) as ResolvedCall)
    const opener = h[o].seat
    const a = decideCallTraced(deal, hist7, opener)
    expect(a.källa).toBe('tabell:tredje')
    const kopior = { ...deal, hands: { N: deal.hands[opener], E: deal.hands[opener], S: deal.hands[opener], W: deal.hands[opener] } }
    expect(decideCallTraced(kopior, hist7, opener).call.bid).toBe(a.call.bid)
  })
})

describe('familj 4b – adaptern secondAsSeen ger motorns namn på svararens andra bud där tredje budet dispatchar (3000 botauktioner)', () => {
  // Namnen öppnarens tredje bud beror på. Terminala namn (till spel/utgång …)
  // får skilja sig mellan läsaren och motorn — de avgör inget tredje bud.
  const DISPATCH = new Set([
    '2/1: försenat stöd', 'New Minor Forcing', 'fjärde färg krav', 'inbjudan', 'inbjudan (limithöjning)',
    'ny färg efter 1NT', 'inverterad: broms', 'preferens', '2NT-checkback', '2NT-återbud (5-3-jakt)',
  ])
  it('samma regelnamn som boten satte, så fort någon av sidorna nämner ett dispatch-namn', () => {
    const avvikelser: string[] = []
    let n = 0
    for (let seed = 20270001; seed <= 20273000; seed++) {
      const deal = dealFromSeed(seed)
      const h = botAuction(deal)
      if (!h) continue
      const o = h.findIndex((c) => c.bid !== 'P')
      if (o === -1 || o + 6 >= h.length) continue
      if (h[o + 1].bid !== 'P' || h[o + 3].bid !== 'P' || h[o + 5].bid !== 'P') continue
      if (h[o + 2].bid === 'P' || h[o + 4].bid === 'P' || h[o + 6].bid === 'P') continue
      const s = h[o + 6]
      if (!s.rule) continue // det gamla lagrets bud utan regel (kravvakten m.fl.)
      n++
      const seen = secondAsSeen(auctionFacts(h.slice(0, o + 8), h[o].seat), o + 6)
      if (!DISPATCH.has(s.rule) && !DISPATCH.has(seen?.rule ?? '')) continue
      if (seen?.rule !== s.rule) avvikelser.push(`frö ${seed} ${h[o].bid}–${h[o + 2].bid}–${h[o + 4].bid}–${s.bid}: motor [${s.rule}] adapter [${seen?.rule ?? '—'}]`)
    }
    expect(n).toBeGreaterThan(600)
    expect(avvikelser, avvikelser.slice(0, 10).join('\n')).toEqual([])
  })
})
