// FACIT FÖRE FIX — felrapport #91 (2026-09-28, bricka 11): svararen PASSADE
// öppnarens svar på New Minor Forcing. Syd giv, ingen i zon:
//
//   Syd    Väst   Nord   Öst
//   1♦     pass   1♠     pass
//   1NT    pass   2♣     pass
//   3♣     pass   pass          → 3♣ i en konstgjord färg.
//
// Nord ♠AQT865 ♥KJ98 ♦J ♣97 (11 hp, sex spader, två klöver). NMF var 11+
// (inbjudan eller bättre), så 11-handen "placerade" med pass när öppnaren inte
// visade fit — i en färg hon aldrig lovat.
//
// ÄGARENS STRUKTUR 2026-09-29 (svar på direkta frågor):
//   • NMF = UTGÅNGSKRAV, 13+ rena hp (femkorts högfärg).
//   • 11–12 hp med femkorts högfärg → 2NT (inbjudan).
//   • 11–12 hp med sexkorts högfärg → 4M direkt.
//   • Öppnaren på 2NT-inbjudan: minimum (12) pass, maximum (13–14) 3NT —
//     oavsett stöd i partnerns högfärg.
//   • PASSAD hand: nya lågfärgen är NATURLIG (5-4, 8+ hp, ej krav) — partnern
//     väljer och stannar lågt; under 8 hp pass (vi spelar 1NT).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const TOM = 'S:- H:- D:- C:-'
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const giv = (dealer: Seat, hands: Partial<Record<Seat, string>>): Deal =>
  ({ id: 't', board: 11, dealer, vulnerability: 'none',
    hands: { N: parseHand(hands.N ?? TOM), E: parseHand(TOM), S: parseHand(hands.S ?? TOM), W: parseHand(TOM) } } as Deal)

/** Bjuder auktionen som vid bordet: vår sidas bud bär motorns regel (och måste stämma med `bud`). */
function bjud(dealer: Seat, bud: string, hands: Partial<Record<Seat, string>>): { deal: Deal; hist: ResolvedCall[] } {
  const deal = giv(dealer, hands)
  const hist: ResolvedCall[] = []
  let seat = dealer
  for (const b of bud.split(' ')) {
    if (hands[seat]) {
      const c = decideCall(deal, hist, seat)
      expect(seat + ' ' + c.bid).toBe(seat + ' ' + b)
      hist.push(c)
    } else hist.push({ seat, bid: b } as ResolvedCall)
    seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]
  }
  return { deal, hist }
}
const nord = (N: string, bud = '1D P 1S P 1NT P', dealer: Seat = 'S') => decideCall(giv(dealer, { N }), H(dealer, bud), 'N')
const syd = (S: string, bud: string, dealer: Seat = 'S') => decideCall(giv(dealer, { S }), H(dealer, bud), 'S')

describe('felrapport #91 – svararens väg efter 1m–1M–1NT (NMF = utgångskrav)', () => {
  it('rapportens Nord (11 hp, sex spader) → 4♠ direkt, aldrig NMF + pass i 3♣', () => {
    expect(nord('S:AQT865 H:KJ98 D:J C:97')).toMatchObject({ bid: '4S', rule: 'utgång' })
  })
  it('11 hp, sex spader 6-3-2-2 → 4♠ direkt', () => {
    expect(nord('S:KQJ865 H:K98 D:Q4 C:97')).toMatchObject({ bid: '4S' })
  })
  it('11 hp, fem spader → 2NT inbjudan (inte NMF)', () => {
    expect(nord('S:KQ865 H:K98 D:J4 C:Q97')).toMatchObject({ bid: '2NT', rule: 'inbjudan' })
    expect(nord('S:KJ865 H:AQ98 D:4 C:J97')).toMatchObject({ bid: '2NT', rule: 'inbjudan' })
  })
  it('13 hp, fem spader → NMF (utgångskrav)', () => {
    expect(nord('S:AQ865 H:K98 D:J4 C:K97')).toMatchObject({ bid: '2C', rule: 'New Minor Forcing' })
  })
  it('14 hp, sex spader → NMF (utgångskrav)', () => {
    expect(nord('S:AQJ865 H:K98 D:J4 C:K9')).toMatchObject({ bid: '2C', rule: 'New Minor Forcing' })
  })
  it('NMF läses som utgångskrav av betydelselagret (även utan regeletikett)', () => {
    expect(meaningOf(H('S', '1D P 1S P 1NT P 2C'), 6)).toMatchObject({ rule: 'New Minor Forcing', forcing: 'utgangskrav' })
  })
})

describe('felrapport #91 – efter NMF passas aldrig under utgång', () => {
  it('öppnaren höjer NMF-färgen (rapportens Syd) → svararen 3NT, inte pass', () => {
    const { deal, hist } = bjud('S', '1D P 1S P 1NT P 2C P 3C P', { N: 'S:AQ865 H:K98 D:J4 C:K97', S: 'S:97 H:754 D:AQ83 C:AK82' })
    expect(decideCall(deal, hist, 'N')).toMatchObject({ bid: '3NT' })
  })
  it('öppnaren visar minimum med stöd (2♠) → 4♠, inte pass', () => {
    const { deal, hist } = bjud('S', '1D P 1S P 1NT P 2C P 2S P', { N: 'S:AQ865 H:K98 D:J4 C:K97', S: 'S:J97 H:Q54 D:AQ83 C:K82' })
    expect(decideCall(deal, hist, 'N')).toMatchObject({ bid: '4S' })
  })
  it('öppnaren visar minimum i sang (2NT) → 3NT, inte pass', () => {
    const { deal, hist } = bjud('S', '1D P 1S P 1NT P 2C P 2NT P', { N: 'S:AQ865 H:K98 D:J4 C:K97', S: 'S:97 H:KJ4 D:AQ83 C:Q982' })
    expect(decideCall(deal, hist, 'N')).toMatchObject({ bid: '3NT' })
  })
})

describe('felrapport #91 – öppnaren på 2NT-inbjudan (bara pass / 3NT)', () => {
  const BUD = '1D P 1S P 1NT P 2NT P'
  it('minimum 12 med tre spader → pass', () => {
    expect(syd('S:J97 H:Q54 D:AQ83 C:K82', BUD)).toMatchObject({ bid: 'P' })
  })
  it('maximum 13 med tre spader → 3NT (spadern glöms)', () => {
    expect(syd('S:J97 H:K54 D:AQ83 C:K82', BUD)).toMatchObject({ bid: '3NT' })
  })
  it('maximum 13 utan stöd → 3NT', () => {
    expect(syd('S:97 H:K54 D:AQ83 C:KJ82', BUD)).toMatchObject({ bid: '3NT' })
  })
  it('hela vägen vid bordet: 1♦–1♠–1NT–2NT–pass med 11 mot 12', () => {
    const { deal, hist } = bjud('S', '1D P 1S P 1NT P 2NT P', { N: 'S:KQ865 H:K98 D:J4 C:Q97', S: 'S:J97 H:Q54 D:AQ83 C:K82' })
    expect(decideCall(deal, hist, 'S')).toMatchObject({ bid: 'P' })
  })
  it('öppnaren passar partnerns 4♠', () => {
    expect(syd('S:97 H:K54 D:AQ83 C:KJ82', '1D P 1S P 1NT P 4S P')).toMatchObject({ bid: 'P' })
  })
})

describe('felrapport #91 – passad hand: nya lågfärgen är naturlig', () => {
  const BUD = 'P P 1D P 1S P 1NT P'
  it('8 hp, fem spader + fem klöver → 2♣ naturligt, ej krav', () => {
    expect(nord('S:KQ865 H:98 D:4 C:QJ972', BUD, 'N')).toMatchObject({ bid: '2C', rule: 'ny lågfärg (passad hand)' })
  })
  it('9 hp, fem spader + fyra klöver → 2♣ naturligt', () => {
    expect(nord('S:KJ865 H:98 D:J4 C:KJ97', BUD, 'N')).toMatchObject({ bid: '2C', rule: 'ny lågfärg (passad hand)' })
  })
  it('under 8 hp → pass (vi spelar 1NT)', () => {
    expect(nord('S:Q9865 H:98 D:J4 C:QJ97', BUD, 'N')).toMatchObject({ bid: 'P' })
  })
  it('11 hp jämn med fem spader → 2NT (ingen lågfärg att visa)', () => {
    expect(nord('S:KQ865 H:K98 D:J4 C:Q97', BUD, 'N')).toMatchObject({ bid: '2NT', rule: 'inbjudan' })
  })
  it('betydelselagret: passad hands 2♣ är naturlig och ej krav', () => {
    expect(meaningOf(H('N', 'P P 1D P 1S P 1NT P 2C'), 8)).toMatchObject({ rule: 'ny lågfärg (passad hand)', forcing: 'ej-krav' })
  })
  it('öppnaren väljer: tre spader → 2♠', () => {
    const { deal, hist } = bjud('N', 'P P 1D P 1S P 1NT P 2C P', { N: 'S:KJ865 H:98 D:J4 C:KJ97', S: 'S:J97 H:K54 D:AQ83 C:K82' })
    expect(decideCall(deal, hist, 'S')).toMatchObject({ bid: '2S', rule: 'preferens (passad hands lågfärg)' })
  })
  it('öppnaren väljer: två spader → pass i klövern', () => {
    const { deal, hist } = bjud('N', 'P P 1D P 1S P 1NT P 2C P', { N: 'S:KJ865 H:98 D:J4 C:KJ97', S: 'S:97 H:K54 D:AQ83 C:KJ82' })
    expect(decideCall(deal, hist, 'S')).toMatchObject({ bid: 'P', rule: 'preferens (passad hands lågfärg)' })
  })
  it('svararen passar öppnarens val', () => {
    const { deal, hist } = bjud('N', 'P P 1D P 1S P 1NT P 2C P 2S P', { N: 'S:KJ865 H:98 D:J4 C:KJ97', S: 'S:J97 H:K54 D:AQ83 C:K82' })
    expect(decideCall(deal, hist, 'N')).toMatchObject({ bid: 'P' })
  })
})
