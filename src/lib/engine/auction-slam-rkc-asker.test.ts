// LIVE-PROV etapp 6 (2026-09-12): RKC-FRÅGAREN placerar — trumfdamen avgör
// lillslam mot utgång, och frågaren kan vara ÖPPNAREN.
//
// Bricka 14 (ägaren provspelade, inget frö sparat → given återskapad ur Syds
// hand + auktionen). Syd öppnar 2♣, visar spader, partnern höjer till 4♠, och
// SYD (öppnaren) frågar 4NT RKC. Partnern svarar 5♦ = 0 eller 3 nyckelkort.
//
// Syd: ♠AK842 ♥AKQ73 ♦AK ♣2 — fyra nyckelkort själv (♠A ♠K ♥A ♦A). Partnerns
// 5♦ måste vara 0 (3 är omöjligt mittemot fyra) → ♣A ligger hos motståndarna,
// en SÄKER förlorare i 6♠. Då tål slammen ingen andra förlorare — och utan
// trumfdamen (8-korts fit, damen kan sitta illa) tappas ett trumfstick.
// Alltså: 5♥ är trumfdam-FRÅGAN, inte "utgång i hjärter". Visas damen → 6♠;
// nekas den → 5♠ är taket.
//
// Buggen: slammodulen modellerar KAPTENEN som svararen; när öppnaren frågar
// RKC matchar ingen slamrad → läget föll till catch-all PASS, och 5♥ lästes
// naturligt. Fixen: frågarens placering (seat-agnostiskt), med damfrågan som
// verktyg.

import { describe, expect, it } from 'vitest'
import type { Deal, Rank, Card, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: 'N' | 'E' | 'S' | 'W', bid: string): ResolvedCall => ({ seat, bid })

/** Giv ur Nords och Syds händer; resten delas växelvis till Öst/Väst. */
const dealNS = (n: string, s: string): Deal => {
  const N = parseHand(n)
  const S = parseHand(s)
  const used = new Set([...N, ...S].map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  return { id: 'facit', dealer: 'S', vulnerability: 'none', board: 14, hands: { N, S, E: rest.filter((_, i) => i % 2 === 0), W: rest.filter((_, i) => i % 2 === 1) } }
}

// Syd = frågaren (öppnaren). Auktionen fram till Syds placering efter 5♦.
const SYD = 'S:AK842 H:AKQ73 D:AK C:2'
const AUKTION: ResolvedCall[] = [
  call('S', '2C'), call('W', 'P'),
  call('N', '2D'), call('E', 'P'),
  call('S', '2S'), call('W', 'P'),
  call('N', '4S'), call('E', 'P'),
  call('S', '4NT'), call('W', 'P'),
  call('N', '5D'), call('E', 'P'),
]

describe('RKC-frågaren: trumfdamen avgör (öppnaren frågar) — Bricka 14', () => {
  // Partnern saknar damen och har bara 3 spader (8-korts fit) → damen är inte
  // säkrad. Frågaren MÅSTE fråga, inte gissa 6♠.
  const NORD_UTAN_DAM = 'S:J93 H:J84 D:QT97 C:KJ5'

  it('Syd frågar trumfdam med 5♥ (inte 6♠, inte PASS) efter 4NT–5♦', () => {
    const deal = dealNS(NORD_UTAN_DAM, SYD)
    expect(decideCall(deal, AUKTION, 'S').bid).toBe('5H')
  })

  it('Partnern utan damen nekar med 5♠ på damfrågan', () => {
    const deal = dealNS(NORD_UTAN_DAM, SYD)
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('5S')
  })

  it('Syd passar 5♠ när damen nekats (utgång är taket, ♣A + trumfdam = två förlorare)', () => {
    const deal = dealNS(NORD_UTAN_DAM, SYD)
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P'), call('N', '5S'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('P')
  })

  // Motprov: partnern HAR damen → visar den → Syd bjuder lillslam.
  const NORD_MED_DAM = 'S:Q93 H:J84 D:QJT9 C:K85'

  it('Partnern med damen visar den på damfrågan (inte 5♠)', () => {
    const deal = dealNS(NORD_MED_DAM, SYD)
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).not.toBe('5S')
  })

  it('Syd bjuder 6♠ när damen visats', () => {
    const deal = dealNS(NORD_MED_DAM, SYD)
    const svar = decideCall(dealNS(NORD_MED_DAM, SYD), [...AUKTION, call('S', '5H'), call('W', 'P')], 'N').bid
    const hist = [...AUKTION, call('S', '5H'), call('W', 'P'), call('N', svar), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('6S')
  })
})

// Felrapport #95 (bricka 4, 2026-10-01): människan (Syd) frågar 4NT och ställer
// damfrågan 5♦; Nord svarar 6♣ (dam + klöverkung) — budet var rätt, förklaringen
// fel (låst i auction-interpret.test.ts). Här låses budvägen.
describe('felrapport #95 – damfrågan besvaras rätt (given ur rapporten)', () => {
  const deal: Deal = {
    id: 'felrapport-95', dealer: 'W', vulnerability: 'all', board: 4,
    hands: {
      N: parseHand('S:J7 H:KQ7543 D:64 C:KQJ'),
      E: parseHand('S:Q98 H:J92 D:987 C:AT93'),
      S: parseHand('S:AK654 H:A8 D:AKJ C:654'),
      W: parseHand('S:T32 H:T6 D:QT532 C:872'),
    },
  }
  const fram: ResolvedCall[] = [
    call('W', 'P'), call('N', '1H'), call('E', 'P'), call('S', '1S'), call('W', 'P'), call('N', '2H'), call('E', 'P'),
    call('S', '4NT'), call('W', 'P'), call('N', '5C'), call('E', 'P'), call('S', '5D'), call('W', 'P'),
  ]
  it('Nord visar trumfdam + klöverkung med 6♣', () => {
    expect(decideCall(deal, fram, 'N')).toMatchObject({ bid: '6C', rule: 'trumfdam: ja + kung' })
  })
  it('Syd bjuder 6♥ på den visade damen', () => {
    expect(decideCall(deal, [...fram, call('N', '6C'), call('E', 'P')], 'S').bid).toBe('6H')
  })
})

// Granskningen efter #95: när billigaste icke-trumf hamnar ÖVER 5-trumf (hjärter
// trumf och svaret 5♦ → 5♠) finns inget frågeutrymme — nekandet "tillbaka till
// 5♥" är olagligt. Förr frågade boten ändå, och partnern utan dam PASSADE 5♠
// (frågebudet blev slutbud). Regeln nu: damfrågan finns bara UNDER 5-trumf —
// ett 5♠ där är inte damfrågan för någon av stolarna.
describe('damfrågan utan frågeutrymme (hjärter trumf, svar 5♦)', () => {
  const SYD_HJ = 'S:AK H:AK752 D:AKQ7 C:32'
  const UTAN_DAM = 'S:J93 H:J84 D:JT9 C:KJ54'
  const AUKTION_HJ: ResolvedCall[] = [
    call('S', '2C'), call('W', 'P'), call('N', '2D'), call('E', 'P'),
    call('S', '2H'), call('W', 'P'), call('N', '4H'), call('E', 'P'),
    call('S', '4NT'), call('W', 'P'), call('N', '5D'), call('E', 'P'),
  ]

  // Ägarbeslut 2026-10-04: går damen inte att fråga efter räcker åtta KÄNDA
  // trumf (fem egna + höjningens tre) för lillslam på fyra nyckelkort.
  it('frågaren frågar inte över 5♥ — åtta kända trumf → 6♥ direkt', () => {
    expect(decideCall(dealNS(UTAN_DAM, SYD_HJ), AUKTION_HJ, 'S')).toMatchObject({ bid: '6H', rule: 'slamavslut' })
  })
  it('ett 5♠ över 5♥ läses inte som damfråga av svararen (inget damsvar)', () => {
    const hist = [...AUKTION_HJ, call('S', '5S'), call('W', 'P')]
    expect(decideCall(dealNS(UTAN_DAM, SYD_HJ), hist, 'N').rule ?? '').not.toMatch(/trumfdam/)
  })
})

// Auktionsdiffen efter #95-fixen (30 000 givar) visade tre fel till i samma
// konvention — alla låsta här med givarna ur diffen.
describe('#95-granskningen – damfrågans övriga kantfall', () => {
  const giv = (dealer: 'N' | 'E' | 'S' | 'W', n: string, e: string, s: string, w: string): Deal => ({
    id: 'granskning-95', dealer, vulnerability: 'all', board: 1,
    hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) },
  })

  // Frö 20291537: 1♣–1♥–2♥–4♥–4NT–5♣–5♦. Svararens eget 5♣-svar + öppnarens 1♣
  // "enades" om klöver → damfrågan besvarades med klöver som trumf (olagligt 5♣
  // → PASS på frågebudet 5♦). Trumfen läses nu ur läget före svaret: hjärter.
  const KLÖVERÖPPNING = giv('S', 'S:KJ96 H:KQJ4 D:K853 C:9', 'S:QT H:75 D:AJT974 C:Q73', 'S:A843 H:AT32 D:- C:AK862', 'S:752 H:986 D:Q62 C:JT54')
  const TILL_SVARET: ResolvedCall[] = [
    call('S', '1C'), call('W', 'P'), call('N', '1H'), call('E', 'P'), call('S', '2H'), call('W', 'P'),
    call('N', '4H'), call('E', 'P'), call('S', '4NT'), call('W', 'P'), call('N', '5C'), call('E', 'P'),
  ]
  it('damfrågan besvaras med HJÄRTER som trumf efter 1♣-öppning (dam + kung, inte pass/6♣)', () => {
    const d = decideCall(KLÖVERÖPPNING, [...TILL_SVARET, call('S', '5D'), call('W', 'P')], 'N')
    expect(d.rule).toBe('trumfdam: ja + kung')
    expect(d.bid).toBe('6D')
  })
  it('kungfrågan 5NT besvaras också med hjärter som trumf (7♥ med två sidokungar, inte 7♣)', () => {
    expect(decideCall(KLÖVERÖPPNING, [...TILL_SVARET, call('S', '5NT'), call('W', 'P')], 'N').bid).toBe('7H')
  })

  // Frö 20286504: 1♠–2♥–3♥–4♥–4NT–5♥ (två nyckelkort UTAN trumfdam). Ett
  // nyckelkort saknas och damen är redan nekad → utgången står. Förr "frågade"
  // Syd damen med 5♠ över 5♥ fast svaret redan nekat den.
  it('5♥-svaret har nekat damen: frågaren passar 5♥ (ett nyckelkort saknas), ingen 5♠-fråga', () => {
    const deal = giv('S', 'S:- H:AJT65 D:K62 C:AQJ74', 'S:T53 H:Q2 D:A74 C:KT965', 'S:AKQJ82 H:K973 D:T8 C:8', 'S:9764 H:84 D:QJ953 C:32')
    const hist: ResolvedCall[] = [
      call('S', '1S'), call('W', 'P'), call('N', '2H'), call('E', 'P'), call('S', '3H'), call('W', 'P'),
      call('N', '4H'), call('E', 'P'), call('S', '4NT'), call('W', 'P'), call('N', '5H'), call('E', 'P'),
    ]
    expect(decideCall(deal, hist, 'S')).toMatchObject({ bid: 'P', rule: 'RKC: stopp' })
  })

  // Ägarens slamregel (2026-10-02): "5 ess utan dam alltid slam". Förr ställdes
  // damfrågan även med alla fem nyckelkort, och ett nekande passades i 5-trumf.
  it('alla fem nyckelkort → lillslam direkt (2♣–2♦–2♠–4♠–4NT–5♣, damen osäkrad)', () => {
    const deal = dealNS('S:J93 H:J84 D:QT97 C:A65', SYD)
    const hist = [...AUKTION.slice(0, 10), call('N', '5C'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S')).toMatchObject({ bid: '6S', rule: 'slamavslut' })
  })
  // Frö 20270470: fem nyckelkort mellan händerna, 5♥-svaret nekar damen → 6♥ ändå.
  it('fem nyckelkort och damen nekad med 5♥ → 6♥ (inte pass)', () => {
    const deal = giv('E', 'S:J8754 H:QT D:854 C:932', 'S:AKQT H:K83 D:AT3 C:QT6', 'S:63 H:9752 D:KQJ62 C:J4', 'S:92 H:AJ64 D:97 C:AK875')
    const hist: ResolvedCall[] = [
      call('E', '1C'), call('S', 'P'), call('W', '1H'), call('N', 'P'), call('E', '1S'), call('S', 'P'),
      call('W', '2D'), call('N', 'P'), call('E', '2H'), call('S', 'P'), call('W', '4H'), call('N', 'P'),
      call('E', '4NT'), call('S', 'P'), call('W', '5H'), call('N', 'P'),
    ]
    expect(decideCall(deal, hist, 'E')).toMatchObject({ bid: '6H', rule: 'slamavslut' })
  })
})
