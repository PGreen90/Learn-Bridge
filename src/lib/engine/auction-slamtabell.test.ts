// ÄGARBESLUT 2026-10-02 (efter felrapport #95), systembok §6.1 — byggda fullt ut:
//
//  1. "4NT syftar alltid till senast ÄKTA bjudna färg (konventioner, kontroller
//     osv är inte i frågan)" — för den som frågar OCH den som svarar. Kaptenen
//     räknar svaret i den färg partnern läste frågan i, och placerar kontraktet
//     i sin egen färg bara när den bär sig själv.
//  2. "Fråga efter dam när man kan. 5 ess med dam → sök storslam · 5 utan dam →
//     alltid slam · 4 med dam → alltid slam · 4 utan dam → sök slam, inget
//     måste": damfrågan när den finns (svaret avgör); går den inte att ställa
//     räcker 8 KÄNDA trumf för lillslam (ägarbeslut 2026-10-04); har svaret
//     redan nekat damen stannar kaptenen. Tio kända trumf räknas som trumfdam.
//
// Givarna är hämtade ur trumfsonden (rkc-trumf.probe) och auktionsdiffen.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { decideCall } from './auction-live'
import { botAuction } from './revisor'
import { queenAskBid, slamValEfterSvar } from './slam'

const giv = (dealer: Seat, n: string, e: string, s: string, w: string): Deal => ({
  id: 'slamtabell', dealer, vulnerability: 'none', board: 1,
  hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) },
})
const bud = (d: Deal): string[] => botAuction(d)!.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)

describe('ägarens slamtabell (§6.1): vad kaptenen gör efter nyckelkortssvaret', () => {
  it('5 nyckelkort: med dam söks storslam, utan dam alltid lillslam', () => {
    expect(slamValEfterSvar(5, true, 8, false)).toBe('sök-storslam')
    expect(slamValEfterSvar(5, false, 7, false)).toBe('lillslam')
    expect(slamValEfterSvar(5, false, 7, true)).toBe('lillslam')
  })
  it('4 nyckelkort med dam: alltid lillslam', () => {
    expect(slamValEfterSvar(4, true, 8, true)).toBe('lillslam')
  })
  it('4 nyckelkort utan säkrad dam: fråga när det går (svaret avgör)', () => {
    expect(slamValEfterSvar(4, false, 9, true)).toBe('fråga-dam')
    expect(slamValEfterSvar(4, false, 7, true)).toBe('fråga-dam')
  })
  it('… går det inte att fråga: lillslam med 8+ kända trumf, annars stanna', () => {
    expect(slamValEfterSvar(4, false, 8, false)).toBe('lillslam')
    expect(slamValEfterSvar(4, false, 7, false)).toBe('stanna')
  })
  it('… och har svaret (5♥) redan nekat damen: stanna, hur många trumf som än är kända', () => {
    expect(slamValEfterSvar(4, false, 9, false, true)).toBe('stanna')
  })
  it('färre än fyra nyckelkort: stanna', () => {
    expect(slamValEfterSvar(3, true, 10, true)).toBe('stanna')
  })
})

describe('damfrågan finns bara när den ryms under 5 i trumf', () => {
  it('spader: 5♦ över 5♣, 5♥ över 5♦', () => {
    expect(queenAskBid('spades', '5C')).toBe('5D')
    expect(queenAskBid('spades', '5D')).toBe('5H')
  })
  it('hjärter: 5♦ över 5♣ — men ingen fråga över 5♦ (5♠ ligger över 5♥)', () => {
    expect(queenAskBid('hearts', '5C')).toBe('5D')
    expect(queenAskBid('hearts', '5D')).toBeNull()
  })
  it('lågfärg: aldrig någon fråga', () => {
    expect(queenAskBid('clubs', '5C')).toBeNull()
    expect(queenAskBid('diamonds', '5C')).toBeNull()
  })
  it('efter 5♥/5♠-svaret finns ingen fråga (damen redan nekad/visad)', () => {
    expect(queenAskBid('spades', '5H')).toBeNull()
    expect(queenAskBid('hearts', '5S')).toBeNull()
  })
})

describe('kaptenen (svararen) frågar efter damen i stället för att bjuda 6 direkt', () => {
  // Frö 20302894: 2♣–2NT–3♠–4♣–4♦–4NT–5♦. Öst har fyra nyckelkort i paret
  // (uteslutningsmetoden: 5♦ = 3), ingen spaderdam och bara åtta kända trumf
  // (tre egna + öppnarens fem) → damfrågan 5♥. Förr 6♠ direkt.
  it('fyra nyckelkort, åtta kända trumf, damen osäkrad → 5♥ frågar; damen visas → 6♠', () => {
    const d = giv('E', 'S:JT92 H:A85 D:Q6 C:K962', 'S:754 H:KQT6 D:832 C:AQ8', 'S:- H:J9742 D:JT94 C:JT75', 'S:AKQ863 H:3 D:AK75 C:43')
    expect(bud(d)).toEqual(['W:2C', 'E:2NT', 'W:3S', 'E:4C', 'W:4D', 'E:4H', 'W:4S', 'E:4NT', 'W:5D', 'E:5H', 'W:6D', 'E:6S'])
  })
})

describe('4NT gäller den senast äkta bjudna färgen — frågare och svarare räknar samma', () => {
  // Frö 20437408: Nord frågade förr i EGEN spader medan Syd svarade i en annan
  // färg → 7♠ på ♠AJT743 mot singel, ♠KQ ute. Nu gäller frågan den senast äkta
  // bjudna färgen (klöver, hoppskiftet) för båda, och spadern bär sig inte
  // själv → kontraktet läggs i partnerns färg: 6♣ (♣QJ mot ♣AK843).
  it('egen färg som inte bär sig själv → kontraktet läggs i partnerns färg (6♣, inte 7♠)', () => {
    const d = giv('S', 'S:AJT743 H:A3 D:AJT C:QJ', 'S:KQ5 H:7652 D:Q653 C:T2', 'S:6 H:KQJ84 D:K2 C:AK843', 'S:982 H:T9 D:9874 C:9765')
    const h = botAuction(d)!
    expect(contractFromCalls(h)).toMatchObject({ level: 6, strain: 'clubs' })
    const ask = h.find((c) => c.bid === '4NT')!
    expect(ask.explanation).toMatch(/♣ som trumf/)
  })
  // Frö 20279551: samma budväg, men Nords spader är ♠AKQJ53 — bär sig själv.
  // Svaret räknas i hjärter (alla fem nyckelkort) och kontraktet läggs i spader.
  it('egen självgående färg → räknar i partnerns färg, placerar i sin egen (6♠)', () => {
    const d = giv('E', 'S:AKQJ53 H:QT D:A7 C:832', 'S:9876 H:87 D:QJ86 C:J97', 'S:2 H:AK643 D:KT C:AQT54', 'S:T4 H:J952 D:95432 C:K6')
    expect(contractFromCalls(botAuction(d)!)).toMatchObject({ level: 6, strain: 'spades' })
  })
})

describe('konkurrens-slam: placeringen läser trumfen ur läget FÖRE essfrågan', () => {
  // Frö 20316913: 1♥–(2♦)–3♦–3♠–4♣–4♦–4NT–5♦. Stoppet lades förr i 5♠ —
  // öppnarens kontrollbud 3♠ lästes som "partnerns senaste högfärg".
  it('stoppet läggs i hjärter (trumfen), inte i kontrollbudets färg', () => {
    const d = giv('N', 'S:982 H:96 D:T743 C:QJT9', 'S:AT74 H:KQT54 D:A C:753', 'S:65 H:J32 D:KJ965 C:K62', 'S:KQJ3 H:A87 D:Q82 C:A84')
    expect(contractFromCalls(botAuction(d)!)).toMatchObject({ level: 5, strain: 'hearts' })
  })
})

// Ägarens exempel 2026-10-04: "med 10 kända trumf räknas det som att man har
// trumfdam — jag öppnar 1M, partnern svarar 2NT Jacoby (hen har fem trumf), jag
// frågar senare efter damen; partnern har den inte men svarar ändå som att hen
// har den: vi har tio trumf ihop."
describe('tio kända trumf räknas som trumfdam (Jacoby med fem trumf mot 1♠-öppningen)', () => {
  const TOM = 'S:- H:- D:- C:-'
  const nord = (n: string): Deal => giv('S', n, TOM, TOM, TOM)
  const c = (seat: Seat, b: string): ResolvedCall => ({ seat, bid: b }) as ResolvedCall
  const TILL_FRÅGAN = [c('S', '1S'), c('W', 'P'), c('N', '2NT'), c('E', 'P'), c('S', '4NT'), c('W', 'P')]

  it('essvaret: två nyckelkort, ingen spaderdam men fem trumf → 5♠ ("med dam")', () => {
    expect(decideCall(nord('S:K9752 H:A4 D:983 C:Q72'), TILL_FRÅGAN, 'N').bid).toBe('5S')
  })
  it('damfrågan: ett nyckelkort (5♣), Syd frågar 5♦ → Nord visar "dam" + ruterkung (6♦), inte 5♠', () => {
    const d = nord('S:J9752 H:A4 D:K83 C:Q72')
    expect(decideCall(d, TILL_FRÅGAN, 'N').bid).toBe('5C')
    const svar = decideCall(d, [...TILL_FRÅGAN, c('N', '5C'), c('E', 'P'), c('S', '5D'), c('W', 'P')], 'N')
    expect(svar).toMatchObject({ bid: '6D', rule: 'trumfdam: ja + kung' })
  })
  it('motprov: bara FYRA trumf (nio ihop) och ingen dam → nekar med 5♠', () => {
    const d = nord('S:J975 H:A42 D:K83 C:Q72')
    const svar = decideCall(d, [...TILL_FRÅGAN, c('N', '5C'), c('E', 'P'), c('S', '5D'), c('W', 'P')], 'N')
    expect(svar).toMatchObject({ bid: '5S', rule: 'trumfdam: nej' })
  })
})

// Ägarbeslut 2026-10-04: "Fråga alltid så mycket som budgivningen tillåter och
// gärna kontrollbud före det." Med 4-korts stöd i öppnarens lågfärg efter stark
// 2♣ sätter svararen trumfen först (4m) i stället för 4NT direkt.
describe('kontrollbud före essfrågan: trumfen sätts först i lågfärg (stark 2♣)', () => {
  // Frö 20270088: 2♣–2♠–3♣. Nord har ♣JT95 och slamvärden mot visade 22+.
  const d88 = giv('E', 'S:AQJ32 H:Q8 D:J8 C:JT95', 'S:K976 H:A543 D:QT6 C:82', 'S:54 H:K9 D:AK93 C:AKQ63', 'S:T8 H:JT762 D:7542 C:74')
  it('4-korts stöd → 4♣ sätter trumfen; öppnaren visar sin billigaste kontroll', () => {
    const b = bud(d88)
    expect(b.slice(0, 5)).toEqual(['S:2C', 'N:2S', 'S:3C', 'N:4C', 'S:4D'])
  })
  // Ägaren 2026-10-04: "man behöver inte ha alla kontroller för att bjuda 4NT".
  // Hjärtern är okontrollerad hos båda (K9 mot Q8), men Nord frågar ändå — och i
  // stället för kontrollbudet 4♠, som inte lämnar plats för essfrågan i lågfärg.
  it('kaptenen frågar 4NT i stället för ett kontrollbud som stänger ute frågan → 6♣', () => {
    expect(bud(d88)).toEqual(['S:2C', 'N:2S', 'S:3C', 'N:4C', 'S:4D', 'N:4NT', 'S:5D', 'N:6C'])
  })
  // Frö 20271697: 2♣–3♣–3♦–4♦–4♥–4♠–5♣: kontrollbuden passerar 4NT, alla
  // sidofärger är kontrollerade → lillslammen bjuds på kontrollerna.
  it('kontrollbuden går förbi 4NT med allt kontrollerat → 6♦', () => {
    const d = giv('E', 'S:- H:K64 D:9753 C:KQT876', 'S:KT763 H:Q93 D:8 C:A942', 'S:AJ H:AJ82 D:AKQJ62 C:J', 'S:Q98542 H:T75 D:T4 C:53')
    expect(contractFromCalls(botAuction(d)!)).toMatchObject({ level: 6, strain: 'diamonds' })
  })
})
