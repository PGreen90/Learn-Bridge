// STÖDSVEPETS FACIT (2026-10-08) — höjningar lovar det antal trumf systemet säger.
//
// Bakgrund: stödsvepet (`stodsvep.probe.test.ts`, STOD=1) mätte 20 000 givar och
// fann tre lögner (handen kortare än systemets löfte) samt två ägarbeslut:
//   1. Negativ-dubblaren accepterade öppnarens invit-hopp i egen 6-kortsfärg
//      till 4M på noll eller en trumf (bara poäng räknades).
//   2. Svararen accepterade 1M–1NT–3M (6+, inbjudan) till 4M på singelton.
//   3. Öppnaren höjde 5♦ på dubbelton efter 2♣–2♦–2x–3♦: det konstgjorda
//      2♦-väntebudet räknades som ett ruterbud ("bjuden två gånger = 6+").
//   A. (ägarbeslut) Upplysningsdubblaren höjer/accepterar/bjuder utgång i
//      advancerns färg bara med 4+ stöd — svaret lovar 4, tre kort riskerar 4-3.
//   B. (ägarbeslut) Samma för responsiv-dubblaren mot partnerns färgval.
// Fröna är stödsvepets; bottarna bjuder given klart och budet på den angivna
// platsen prövas. Prefixet låses så att läget är det avsedda.
import { describe, expect, it } from 'vitest'
import { dealFromSeed, botAuction } from './revisor'
import { decideCall } from './auction-live'

/** Hela botauktionen för fröet; `idx` = platsen (0-baserad) som prövas. */
function auktion(seed: number) {
  const hist = botAuction(dealFromSeed(seed))
  expect(hist).not.toBeNull()
  return hist!
}
const bids = (h: ReturnType<typeof auktion>, upto: number) => h.slice(0, upto).map((c) => c.bid)

describe('bugg 1 – negativ-dubblaren accepterar bara invit-hoppet med fit (2+ mot egen 6-kortsfärg)', () => {
  it('frö 20267446: 1♠–(2♦)–X–P–3♠–P, Nord ♠– ♥8632 ♦K85 ♣A97543 (7 hp) → pass, inte 4♠ på renons', () => {
    // Sedan experternas negativa dubbling (2026-10-08) dubblar Nord inte alls
    // med 7 hp över ett 2-lägesinkliv — läget läggs därför upp som naken historik.
    const deal = dealFromSeed(20267446)
    const hist = (['P', '1S', '2D', 'X', 'P', '3S', 'P'] as const).map((bid, i) => ({ seat: (['E', 'S', 'W', 'N'] as const)[i % 4], bid }))
    expect(decideCall(deal, hist, 'N').bid).toBe('P')
  })
})

describe('bugg 2 – 1M–1NT–3M (6+, inbjudan) accepteras bara med 2+ trumf', () => {
  it('frö 20263082: 1♠–1NT–3♠, Väst ♠Q ♥JT98764 ♦J97 ♣AT (8 hp) → pass, inte 4♠ på singelton', () => {
    const h = auktion(20263082)
    expect(bids(h, 8)).toEqual(['P', 'P', '1S', 'P', '1NT', 'P', '3S', 'P'])
    expect(h[8].seat).toBe('W')
    expect(h[8].bid).toBe('P')
  })
  it('frö 20269148: 1♠–1NT–3♠, Väst ♠K ♥J765 ♦A2 ♣J87632 (9 hp) → pass', () => {
    const h = auktion(20269148)
    expect(bids(h, 7)).toEqual(['P', '1S', 'P', '1NT', 'P', '3S', 'P'])
    expect(h[7].seat).toBe('W')
    expect(h[7].bid).toBe('P')
  })
})

describe('bugg 3 – 2♦-väntebudet är inget ruterbud: 3♦ efter 2♣–2♦–2x lovar 5+, fit kräver 3', () => {
  it('frö 20262497: 2♣–2♦–2♥–3♦, Nord ♠A6 ♥AKQ64 ♦A3 ♣AQJ3 (24 hp) → 3♥ (bra 5-korts rebjuds, förnekar 3-korts stöd, §4.4), inte 5♦ på dubbelton', () => {
    const h = auktion(20262497)
    expect(bids(h, 10)).toEqual(['P', 'P', '2C', 'P', '2D', 'P', '2H', 'P', '3D', 'P'])
    expect(h[10].seat).toBe('N')
    expect(h[10].bid).toBe('3H')
  })
  it('frö 20262908: 2♣–2♦–2♠–3♦, Nord ♠AKT54 ♥7 ♦A7 ♣AK632 (18 hp) → inte 5♦ på dubbelton', () => {
    const h = auktion(20262908)
    expect(bids(h, 8)).toEqual(['2C', 'P', '2D', 'P', '2S', 'P', '3D', 'P'])
    expect(h[8].seat).toBe('N')
    expect(h[8].bid).not.toBe('5D')
  })
})

describe('ägarbeslut A – upplysningsdubblaren höjer advancerns färg bara med 4+ stöd', () => {
  it('frö 20262689: 1♦–X–P–1♠–P, Väst ♠Q85 ♥AJ98 ♦9 ♣AKT87 (14 hp) → pass, inte 2♠ på tre kort', () => {
    const h = auktion(20262689)
    expect(bids(h, 7)).toEqual(['P', 'P', '1D', 'X', 'P', '1S', 'P'])
    expect(h[7].seat).toBe('W')
    expect(h[7].bid).toBe('P')
  })
  it('frö 20262458: 1♣–X–2♣–3♠(FRITT hoppbud = 5+)–P, Nord ♠Q63 ♥AKQJT ♦6543 ♣2 (12 hp) → 4♠ står: tre kort mot fem lovade är 8-korts fit', () => {
    const h = auktion(20262458)
    expect(bids(h, 5)).toEqual(['1C', 'X', '2C', '3S', 'P'])
    expect(h[3].rule).toBe('fritt svar på upplysningsdubbling')
    expect(h[5].seat).toBe('N')
    expect(h[5].bid).toBe('4S')
  })
  it('frö 20260825: (3♥)–P–P–X–P–3♠–4♥, Väst ♠Q87 ♥A5 ♦AT964 ♣K82 (13 hp) → pass, inte 4♠ på tre kort', () => {
    const h = auktion(20260825)
    expect(bids(h, 7)).toEqual(['3H', 'P', 'P', 'X', 'P', '3S', '4H'])
    expect(h[7].seat).toBe('W')
    expect(h[7].bid).toBe('P')
  })
})

describe('ägarbeslut B – responsiv-dubblaren höjer partnerns färgval bara med 4+ stöd', () => {
  it('frö 20262449: 1♥–X–2♥–X(responsiv)–P–2♠–P, Väst ♠Q93 ♥A87 ♦KQT2 ♣976 (11 hp) → pass, inte 3♠ på tre kort', () => {
    const h = auktion(20262449)
    expect(bids(h, 7)).toEqual(['1H', 'X', '2H', 'X', 'P', '2S', 'P'])
    expect(h[7].seat).toBe('W')
    expect(h[7].bid).toBe('P')
  })
})
