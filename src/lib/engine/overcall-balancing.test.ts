// R1 Fynd #2: "Låna en kung" i BALANSERINGSSITS (utpassningsläget). FACIT FÖRE FIX.
//
// Ägarbeslut 2026-07-05: i balansering (deras 1-läges färgöppning + två pass)
// sänks §7-inklivets HP-golv med EN KUNG (−3), eftersom partnern är markerad med
// värden. Flat HP-lättnad – §7-lagret behåller rå HP (TP-i-§7 = separat SENARE).
//   - enkelt inkliv 8 → 5
//   - upplysnings-X 12 → 9 (perfekt 4-korts form 10 → 7)
//   - balanserings-1NT 11–14 (direkt sits oförändrat 15–18)
// Direkt sits ska vara OFÖRÄNDRAD (samma hand → olika bud i olika sits = beviset).
import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { overcall } from './overcalls'
import { decideCall } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}

// ---- Enhetstester på overcall() direkt: golvet sänks bara i balansering ------
describe('"Låna en kung" – overcall()-golv sänks i balansering, ej direkt', () => {
  const takeout = parseHand('S:KJ85 H:QT73 D:4 C:KT73') // 9 hp, singel ruter, stöd i övriga
  it('upplysnings-X: 9 hp → X i balansering, pass i direkt sits', () => {
    expect(overcall(takeout, '1D', true).call).toBe('X')
    expect(overcall(takeout, '1D', false).call).toBe('P')
  })

  const simple = parseHand('S:KQT73 H:854 D:92 C:J43') // 6 hp, 5-korts spader
  it('enkelt inkliv: 6 hp → 1♠ i balansering, pass i direkt sits', () => {
    expect(overcall(simple, '1D', true).call).toBe('1S')
    expect(overcall(simple, '1D', false).call).toBe('P')
  })

  const nt = parseHand('S:A954 H:KJ73 D:Q82 C:Q5') // 12 hp jämn, ruterstopp Qxx
  it('balanserings-1NT: 12 hp jämn → 1NT i balansering (11–14), pass i direkt (15–18)', () => {
    expect(overcall(nt, '1D', true).call).toBe('1NT')
    expect(overcall(nt, '1D', false).call).toBe('P')
  })

  const weak = parseHand('S:J8632 H:Q87 D:T6 C:T54') // 3 hp, 5-korts spader
  it('golvet håller: 3 hp passar även i balansering (under 5)', () => {
    expect(overcall(weak, '1D', true).call).toBe('P')
  })

  const strongNt = parseHand('S:AQ4 H:KQ73 D:KJ2 C:952') // 15 hp jämn, ruterstopp
  it('direkt sits oförändrad: 15 hp jämn → 1NT-inkliv (15–18) precis som förr', () => {
    expect(overcall(strongNt, '1D', false).call).toBe('1NT')
  })
})

// ---- Integration: maybeOvercall trådar balancing=true genom decideCall -------
// W öppnar 1♦, N pass, E pass → S i balanseringssits. Bevisar att lättnaden NÅS
// live (motverkar "grunt testad, aldrig anropad"), inte bara i enhetstestet.
describe('"Låna en kung" – live via decideCall i balanseringssitsen', () => {
  const deal: Deal = {
    id: 'test', dealer: 'W', vulnerability: 'none', board: 1,
    hands: {
      W: parseHand('S:A6 H:K9 D:AKQ762 C:982'),   // 14 hp, 6-korts ruter → öppnar 1♦
      N: parseHand('S:9742 H:8652 D:T5 C:J65'),   // svag → passar
      E: parseHand('S:QT3 H:J74 D:983 C:Q743'),   // svag → passar
      S: parseHand('S:KJ85 H:QT73 D:4 C:KT73'), // 9 hp balanseringshand → X (golv 12→9)
    },
  }
  it('1♦–P–P: Syd balanserar med X på 9 hp (skulle passat i direkt sits)', () => {
    const bid = decideCall(deal, [call('W', '1D'), call('N', 'P'), call('E', 'P')], 'S')
    expect(bid.bid).toBe('X')
    expect(bid.explanation).toContain('balansering')
  })
})
