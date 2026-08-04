import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

// Öppnarens fortsättning efter partnerns VÄRDE-DUBBEL över vårt störda 1NT
// (§7.8, felrapport #43). Läge: vi öppnade 1NT (15–17), motståndaren störde med
// ett tvåfärgsinkliv (DONT), partnern (svararen) dubblade = straff/värden (8+).
// Tidigare hade ÖPPNAREN ingen logik alls här → off-book-reservbud (bar pass) →
// missad utgång. Ägarbeslut 2026-08-04: 2NT-relä där öppnaren VISAR en 5-korts
// färg om den finns (2NT förnekar 5-kort); svararen placerar (pass 8–10 / 3NT 11+).

function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'ns', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}
function c(seat: Seat, bid: string): ResolvedCall { return { seat, bid } }
// Motståndarens DONT-inkliv bär sin regel i den levande auktionen (boten bjöd det).
function dont(seat: Seat, bid: string): ResolvedCall { return { seat, bid, rule: 'DONT tvåfärg' } }

describe('1NT störd + partnerns värde-X → öppnarens 2NT-relä (felrapport #43)', () => {
  // Exakt given ur felrapport #43 (bricka 15).
  const DEAL = dealOf('S', {
    N: 'S:A76 H:5 D:KQ74 C:KJ863',
    E: 'S:JT854 H:T64 D:9 C:QT42',
    S: 'S:Q93 H:KJ9 D:AJ86 C:A95', // 15, 3-3-4-3 → 1NT, ingen 5-korts färg
    W: 'S:K2 H:AQ8732 D:T532 C:7',
  })

  it('öppnaren (Syd) bjuder 2NT i stället för att passa', () => {
    const hist = [c('S', '1NT'), dont('W', '2D'), c('N', 'X'), c('E', 'P')]
    const s2 = decideCall(DEAL, hist, 'S')
    expect(s2.bid).toBe('2NT')
  })

  it('svararen (Nord, 13 hp) höjer 2NT till 3NT', () => {
    const hist = [c('S', '1NT'), dont('W', '2D'), c('N', 'X'), c('E', 'P'), c('S', '2NT'), c('W', 'P')]
    const n2 = decideCall(DEAL, hist, 'N')
    expect(n2.bid).toBe('3NT')
  })
})

describe('öppnarens 5-korts färg visas (2NT förnekar 5-kort)', () => {
  // Öppnaren 15–17 MED en 5-korts spader → visar spadern, inte 2NT.
  const DEAL5 = dealOf('S', {
    N: 'S:32 H:KQ4 D:KJ96 C:KQ54', // svararen: värden, dubblar deras 2♦
    E: 'S:764 H:T92 D:T8 C:JT982',
    S: 'S:AQJ85 H:A76 D:A5 C:A63', // 17, 5-korts spader
    W: 'S:KT9 H:J853 D:KQ7432 C:-',
  })
  it('öppnaren med 5-korts spader bjuder 2♠, inte 2NT', () => {
    const hist = [c('S', '1NT'), dont('W', '2D'), c('N', 'X'), c('E', 'P')]
    const s2 = decideCall(DEAL5, hist, 'S')
    expect(s2.bid).toBe('2S')
  })
})

describe('svararen med bara 8–10 passar öppnarens 2NT', () => {
  const DEALW = dealOf('S', {
    N: 'S:A76 H:432 D:Q874 C:J83', // ~8 hp → passar 2NT
    E: 'S:JT854 H:T6 D:K9 C:QT42',
    S: 'S:KQ3 H:KJ9 D:AJ86 C:A95', // 16 balanserad, ingen 5-korts
    W: 'S:92 H:AQ875 D:T532 C:K7',
  })
  it('svararen passar 2NT med minimum', () => {
    const hist = [c('S', '1NT'), dont('W', '2D'), c('N', 'X'), c('E', 'P'), c('S', '2NT'), c('W', 'P')]
    const n2 = decideCall(DEALW, hist, 'N')
    expect(n2.bid).toBe('P')
  })
})

describe('DISKRIMINATOR: naturligt inkliv firar INTE 2NT-reläet (felrapport #39 skyddad)', () => {
  // Samma form men Västs inkliv är NATURELLT (ingen DONT-regel). Då ska öppnaren
  // INTE tvingas till 2NT – försvaret/passen mot ett naturligt inkliv står kvar.
  const DEAL = dealOf('S', {
    N: 'S:A76 H:5 D:KQ74 C:KJ863',
    E: 'S:JT854 H:T64 D:9 C:QT42',
    S: 'S:Q93 H:KJ9 D:AJ86 C:A95',
    W: 'S:K2 H:AQ8732 D:T532 C:7',
  })
  it('öppnaren bjuder inte 2NT när inklivet saknar DONT-regel', () => {
    const hist = [c('S', '1NT'), c('W', '2D'), c('N', 'X'), c('E', 'P')] // 2D UTAN DONT-regel
    const s2 = decideCall(DEAL, hist, 'S')
    expect(s2.bid).not.toBe('2NT')
  })
})
