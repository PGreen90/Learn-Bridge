import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

// =============================================================================
// FACIT (ägarbeslut 2026-09-24): partnern PLACERAR utgången i en färg vi båda
// bjudit (1♦–1♠–2♣–2♦–2♥–4♥ — inget kontrollbud, partnern har troligen ca 12
// hp). Med en stark hand som inte kunnat visas är detta chansen: egen hand
// (fin fördelning räknas) + partnerns ca 12 ≥ 31 → 4NT essfråga, och frågaren
// bestämmer utifrån svaren — ingen slaminbjudan ("4 ess och trumfdam är alltid
// slam"); annars pass. Förr passade öppnaren ALLTID ("pass (ingen
// regel)"), även med 21 hp.
// =============================================================================

const A = (s: string) => s.split(' ').map((c) => ({ seat: c[0], bid: c.slice(2) })) as ResolvedCall[]
const giv = (n: string, s: string): Deal => ({
  id: 'placering', dealer: 'N', vulnerability: 'none', board: 1,
  hands: { N: parseHand(n), E: parseHand('S:KQT4 H:J3 D:Q85 C:T742'), S: parseHand(s), W: parseHand('S:J832 H:97 D:32 C:J862') },
})
const H1112 = A('N:1D E:P S:1S W:P N:2C E:P S:2D W:P N:2H E:P S:4H W:P')

const H4S = A('N:1H E:P S:1S W:P N:2S E:P S:4S W:P')
const giv4S = (s: string): Deal => ({
  id: 'placering-4s', dealer: 'N', vulnerability: 'none', board: 1,
  hands: { N: parseHand('S:AQ83 H:AKJ5 D:K4 C:J32'), E: parseHand('S:T4 H:QT2 D:JT85 C:QT74'), S: parseHand(s), W: parseHand('S:J2 H:983 D:9876 C:9876') },
})

describe('FACIT: 31–32 mot partnerns placering → 4NT, inte slaminbjudan', () => {
  it('19 hp jämn (31–32-zonen): 4NT (förr 5♠-inbjudan)', () => {
    expect(decideCall(giv4S('S:9765 H:64 D:A932 C:AK5'), H4S, 'N').bid).toBe('4NT')
  })

  it('fyra ess + trumfdam i paret → lillslam', () => {
    const d = giv4S('S:9765 H:64 D:A932 C:AK5') // Syd: ♦A ♣A; Nord: ♠A ♥A ♠D
    const h = [...H4S, { seat: 'N', bid: '4NT' }, { seat: 'E', bid: 'P' }] as ResolvedCall[]
    const svar = decideCall(d, h, 'S').bid
    const plac = decideCall(d, [...h, { seat: 'S', bid: svar }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
    expect(plac).toBe('6S')
  })

  it('två nyckelkort saknas → stannar i 5♠', () => {
    const d = giv4S('S:9765 H:64 D:K932 C:KQ5') // Syd: inga ess, ingen ♠K
    const h = [...H4S, { seat: 'N', bid: '4NT' }, { seat: 'E', bid: 'P' }] as ResolvedCall[]
    const svar = decideCall(d, h, 'S').bid
    const plac = decideCall(d, [...h, { seat: 'S', bid: svar }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
    expect(plac).toBe('5S')
  })
})

describe('FACIT: stark hand över partnerns placerade utgång frågar 4NT', () => {
  it('19 hp med renons: 4NT (förr pass)', () => {
    expect(decideCall(giv('S:- H:AQT8 D:AKJ64 C:KQ93', 'S:A9765 H:6542 D:T7 C:A5'), H1112, 'N').bid).toBe('4NT')
  })

  it('minimum (13 hp) passar — partnerns placering står', () => {
    expect(decideCall(giv('S:- H:AQT8 D:J9764 C:KQ93', 'S:A9765 H:6542 D:KT C:A5'), H1112, 'N').bid).toBe('P')
  })

  it('1♥–1♠–2♠–4♠ med 21 hp: 4NT', () => {
    const d = giv('S:AQ83 H:AKJ75 D:K4 C:A2', 'S:9765 H:64 D:KT32 C:KJ5')
    expect(decideCall(d, A('N:1H E:P S:1S W:P N:2S E:P S:4S W:P'), 'N').bid).toBe('4NT')
  })

  it('partnern svarar på essfrågan (1430) och frågaren placerar', () => {
    const d = giv('S:- H:AQT8 D:AKJ64 C:KQ93', 'S:A9765 H:K542 D:T7 C:A5')
    const h = [...H1112, { seat: 'N', bid: '4NT' }, { seat: 'E', bid: 'P' }] as ResolvedCall[]
    const svar = decideCall(d, h, 'S').bid
    expect(['5C', '5D', '5H', '5S']).toContain(svar) // Syd: ♠A ♥K ♣A = 3 nyckelkort → 5♦ (0/3)
    const plac = decideCall(d, [...h, { seat: 'S', bid: svar }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
    expect(plac).not.toBe('P')
  })
})
