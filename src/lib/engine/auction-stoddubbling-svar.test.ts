// FACIT-TEST för etapp 6 hål 1 (billig offring, docs/systemrevisorn.md
// "Etapp 6 FÖRSKANNAD", 2026-07-25): STÖDDUBBLINGEN BESVARAS ALDRIG.
//
// Rot: `takeoutDoubleToAnswer` i auction-live.ts stängde av svarstvånget så
// fort vår sida bjudit ett kontraktsbud — och stöddubblingen (öppnarens X =
// exakt 3 stöd efter 1x–(P)–1M–(inkliv)) hade ingen egen svarsväg. Följd:
// svararen passade ut partnerns upplysande dubbling och motståndarna fick
// spela 2-läget dubblat, fast vår sida ägde utgång.
//
// Givarna är Systemrevisorns fem frön ur posten (baslinjefrö 20260721):
// 20260884, 20261005, 20261274, 20261433, 20261658. Målkontrakten är
// DD-verifierade (revisor-output/dd-tabell.txt, dd-tabell-proben) OCH
// systemriktiga — svararen bjuder på egen hand + partnerns visade exakt
// 3-stöd, aldrig på facit.
//
// Sedan motorbytets etapp 4 familj 3 (2026-09-08) är stöddubblingen, svaret
// och stöddubblarens fortsättning tabellrader (*stöd-x*, *stöd-x-svar*,
// *stöd-x-öppnaren*), och manusets kik-rond är riven: RHO:s inkliv över
// svaret läggs inte i botauktionen förrän familj 4. Testet ger därför
// auktionen fram till inklivet som budföljd och låter bottarna bjuda klart
// därifrån (samma `decideCall` som vid bordet).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCallTraced } from './auction-live'
import { auctionComplete, seatToAct } from './auction-rules'
import { contractFromCalls } from './auction-contract'

function deal(
  id: string,
  dealer: Deal['dealer'],
  vulnerability: Deal['vulnerability'],
  hands: Record<'N' | 'E' | 'S' | 'W', string>,
): Deal {
  return {
    id,
    board: 1,
    dealer,
    vulnerability,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

/** Bottarna bjuder klart från `prefix` (buden i tur och ordning från given); ger slutkontrakt + hela budlistan + källorna. */
function finalOf(d: Deal, prefix: string[]) {
  const history: ResolvedCall[] = prefix.map((bid, i) => ({ seat: seatToAct(d.dealer, i), bid: bid as ResolvedCall['bid'] }))
  const källor: string[] = []
  while (!auctionComplete(history) && history.length < 40) {
    const seat: Seat = seatToAct(d.dealer, history.length)
    const t = decideCallTraced(d, history, seat)
    history.push(t.call)
    källor.push(`${seat}:${t.call.bid}<${t.källa}>`)
  }
  return { contract: contractFromCalls(history), bids: history.map((c) => c.bid), källor }
}

describe('stöddubblingen besvaras (etapp 6 hål 1)', () => {
  it('frö 20260884: 1♦–(P)–1♠–(2♥)–X → svararen invithöjer 3♦, öppnaren (16 hp, 6 ruter) lyfter till 5♦', () => {
    const d = deal('offring-20260884', 'N', 'ns', {
      N: 'S:T9 H:874 D:A53 C:QT843',
      E: 'S:A854 H:932 D:KT8 C:K72',
      S: 'S:J762 H:QJT65 D:6 C:A96',
      W: 'S:KQ3 H:AK D:QJ9742 C:J5',
    })
    const { contract, bids, källor } = finalOf(d, ['P', 'P', 'P', '1D', 'P', '1S', '2H'])
    expect(källor[0]).toBe('W:X<tabell:stöd-x>')
    expect(källor[2]).toBe('E:3D<tabell:stöd-x-svar>')
    expect(källor[4]).toBe('W:5D<tabell:stöd-x-öppnaren>')
    expect(bids).toContain('3D')
    expect(contract).toMatchObject({ level: 5, strain: 'diamonds' })
  })

  it('frö 20261005: 1♣–(P)–1♥–(2♦)–X → svararen (15 hp, dubbelhåll i ruter) bjuder 3NT', () => {
    const d = deal('offring-20261005', 'N', 'ns', {
      N: 'S:JT4 H:K74 D:93 C:AKT87',
      E: 'S:KQ973 H:J5 D:87 C:9532',
      S: 'S:A65 H:8632 D:AKJT C:QJ',
      W: 'S:82 H:AQT9 D:Q6542 C:64',
    })
    const { contract, bids, källor } = finalOf(d, ['1C', 'P', '1H', '2D'])
    expect(källor[0]).toBe('N:X<tabell:stöd-x>')
    expect(källor[2]).toBe('S:3NT<tabell:stöd-x-svar>')
    expect(bids).toContain('3NT')
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
  })

  // OMRIKTAD 2026-08-06: den gamla given här (frö 20261274) hade Syd
  // ♠KJ73 ♥A83 ♦8 ♣KQJ52 — 14 hp med 5-korts klöver som med den nya 2/1-regeln
  // (§4.2) bjuder 2♣ över 1♦, inte 1♠. Då uppstår stöddubblingsauktionen aldrig.
  // Dessutom var det gamla 4♠ (4-3 Moisian) resultat-smicker: 3NT är systemriktigt
  // på en 4-3-fit utan tvingande korthet (bekräftat: motorn väljer 3NT med enbart
  // dubbelton). Testet visar samma FUNKTION — stöddubblingen besvaras och paret når
  // högfärgsutgången — men nu på en giv där Syd verkligen ska bjuda 1♠ (5-korts
  // spader, ingen 5-korts GF-klöver) och fiten är en ren 5-3.
  it('stöddubbling → 8-korts spaderfit: 1♦–(P)–1♠–(2♥)–X → svararen (14 hp, 5 spader, singel ruter) → 4♠', () => {
    const d = deal('stoddubbel-5-3-fit', 'W', 'all', {
      N: 'S:AQ9 H:2 D:AQ6432 C:963',
      E: 'S:32 H:QJ54 D:T75 C:T842',
      S: 'S:KJT75 H:A83 D:8 C:KQJ5',
      W: 'S:864 H:KT976 D:KJ9 C:A7',
    })
    const { contract, bids, källor } = finalOf(d, ['P', '1D', 'P', '1S', '2H'])
    expect(källor[0]).toBe('N:X<tabell:stöd-x>')
    expect(källor[2]).toBe('S:4S<tabell:stöd-x-svar>')
    expect(bids).toContain('4S')
    expect(contract).toMatchObject({ level: 4, strain: 'spades' })
  })

  it('frö 20261433: 1♣–(P)–1♥–(2♦)–X → svararen (12 hp + singel = utgångsvärden, 5 hjärter) bjuder 4♥', () => {
    const d = deal('offring-20261433', 'S', 'none', {
      N: 'S:KT86 H:J74 D:98 C:AT52',
      E: 'S:QJ9 H:AQ985 D:KT32 C:8',
      S: 'S:754 H:62 D:AJ765 C:K43',
      W: 'S:A32 H:KT3 D:Q4 C:QJ976',
    })
    const { contract, bids, källor } = finalOf(d, ['P', '1C', 'P', '1H', '2D'])
    expect(källor[0]).toBe('W:X<tabell:stöd-x>')
    expect(källor[2]).toBe('E:4H<tabell:stöd-x-svar>')
    expect(bids).toContain('4H')
    expect(contract).toMatchObject({ level: 4, strain: 'hearts' })
  })

  it('frö 20261658: 1♦–(P)–1♠–(2♥)–X → svararen visar 6-korts klöver (3♣), öppnaren (15 hp, 4 klöver) lyfter till 5♣', () => {
    const d = deal('offring-20261658', 'S', 'all', {
      N: 'S:T965 H:QJ9 D:T876 C:K6',
      E: 'S:AQ74 H:K6 D:J C:T98752',
      S: 'S:83 H:AT87532 D:K54 C:Q',
      W: 'S:KJ2 H:4 D:AQ932 C:AJ43',
    })
    const { contract, bids, källor } = finalOf(d, ['P', '1D', 'P', '1S', '2H'])
    expect(källor[0]).toBe('W:X<tabell:stöd-x>')
    expect(källor[2]).toBe('E:3C<tabell:stöd-x-svar>')
    expect(källor[4]).toBe('W:5C<tabell:stöd-x-öppnaren>')
    expect(bids).toContain('3C')
    expect(contract).toMatchObject({ level: 5, strain: 'clubs' })
  })
})
