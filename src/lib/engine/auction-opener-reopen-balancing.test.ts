// R1 Fynd #2 (flerronds-konkurrens, del B): öppnarens ÅTERÖPPNING i utpassnings-
// sitsen efter partnerns pass – inkliv passat runt (1M–(inkliv)–P–P). FACIT FÖRE FIX.
//
// Roten (bevisad i flerronds-proben, giv #56 + #552): partnern gör en rimlig
// "trap pass" (sitter med inkliparens färg bakom sig), men ÖPPNAREN säljer given
// i stället för att återöppna. Syskonet till del A: samma rond-2, MEN här passade
// RHO (auktionen dör om öppnaren passar) i stället för att konkurrera.
//
// Ägarregel: kort (singel/renons) i deras färg → återöppningsdubbling (partnern
// konverterar ofta till straff); egen 6+ färg → rebjud (tävla); 15+ hp → X;
// annars pass. Balanseringsfilosofi (partnern är markerad med värden).
import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall, legalCalls } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

describe('Öppnarens återöppning i utpassningssits (1M–(inkliv)–P–P)', () => {
  // ---- Giv #552 ur proben: 1♠–(2♥)–P–P → öppnaren (Nord), singel hjärter ----
  it('12 hp, singel i deras färg, 6 spader → återöppningsdubbling X (giv #552)', () => {
    const H552 = [call('N', '1S'), call('E', '2H'), call('S', 'P'), call('W', 'P')]
    const deal = dealOf('N', {
      N: 'S:KQJT62 H:9 D:A765 C:Q5',   // 12 hp, singel hjärter, 6 spader (öppnade 1♠)
      E: 'S:A84 H:AT5432 D:Q2 C:T7',   // 2♥-inkliv
      S: 'S:73 H:KQJ76 D:93 C:AK96',   // 13 hp, 5 hjärter bakom inkliparen → trap pass
      W: 'S:95 H:8 D:KJT84 C:J8432',
    })
    expect(decideCall(deal, H552, 'N').bid).toBe('X')
    expect(legalCalls(H552, 'N')).toContain('X')
  })

  // ---- Giv #56 ur proben: 1♠–(2♥)–P–P → öppnaren (Syd), hjärterrenons --------
  it('11 hp, renons i deras färg, 6 spader → återöppningsdubbling X (giv #56)', () => {
    const H56 = [call('S', '1S'), call('W', '2H'), call('N', 'P'), call('E', 'P')]
    const deal = dealOf('S', {
      S: 'S:KQT652 H:- D:A85 C:Q642',  // 11 hp, hjärterrenons, 6 spader (öppnade 1♠)
      W: 'S:9 H:AT9862 D:KJ9 C:KJ5',   // 2♥-inkliv
      N: 'S:A3 H:KQJ74 D:4 C:AT873',   // 14 hp, 5 hjärter bakom inkliparen → trap pass
      E: 'S:J874 H:53 D:QT7632 C:9',
    })
    expect(decideCall(deal, H56, 'S').bid).toBe('X')
  })

  // ---- Kontroll: 6+ egen färg men EJ kort i deras färg → rebjud egen färg ----
  it('13 hp, 2 kort i deras färg, 6 spader → tävlar 2♠ (ej X)', () => {
    const H = [call('S', '1S'), call('W', '2H'), call('N', 'P'), call('E', 'P')]
    const deal = dealOf('S', {
      S: 'S:AQ9863 H:K4 D:A85 C:32',   // 13 hp, 2 hjärter (ej kort), 6 spader
      W: 'S:5 H:AQJ962 D:K74 C:T96',
      N: 'S:KT2 H:83 D:QJ96 C:AJ85',
      E: 'S:J74 H:T75 D:T32 C:KQ74',
    })
    expect(decideCall(deal, H, 'S').bid).toBe('2S')
  })

  // ---- FACIT (felrapport #38): 1-LÄGES inkliv passat runt → samma återöppning.
  // Roten: buildAuction modellerade advancerns pass på ett 1-läges enkelt inkliv
  // och STÄNGDE auktionen (finish(false)) — öppnaren i utpassningssitsen fick
  // aldrig frågan, och Väst sålde given i 1♠ med 15 hp + 6-korts topp-klöver.
  it('15 hp, 6-korts klöver, deras 1♠ passat runt → tävlar 2♣ (felrapport #38)', () => {
    const H = [
      call('N', 'P'), call('E', 'P'), call('S', 'P'), call('W', '1C'),
      call('N', '1S'), call('E', 'P'), call('S', 'P'),
    ]
    const deal = dealOf('N', {
      N: 'S:AT653 H:962 D:AJ7 C:32',
      E: 'S:KJ42 H:J75 D:KQ864 C:9',   // trap-pass med KJ42 bakom inkliparen
      S: 'S:98 H:AQT3 D:T95 C:8765',
      W: 'S:Q7 H:K84 D:32 C:AKQJT4',   // 15 hp, 6-korts klöver → sälj inte given
    })
    expect(decideCall(deal, H, 'W').bid).toBe('2C')
  })

  // ---- Kontroll: jämn minimum, 3 kort i deras färg, ingen 6-färg → pass ------
  it('13 hp, jämn, 3 kort i deras färg, 5 spader → passar (faller igenom)', () => {
    const H = [call('S', '1S'), call('W', '2H'), call('N', 'P'), call('E', 'P')]
    const deal = dealOf('S', {
      S: 'S:AK932 H:Q84 D:KJ7 C:86',   // 13 hp, 3 hjärter, 5 spader, ingen 6-färg
      W: 'S:Q5 H:AJ962 D:A94 C:QT9',
      N: 'S:JT76 H:73 D:Q652 C:AK5',
      E: 'S:84 H:KT5 D:T83 C:J7432',
    })
    expect(decideCall(deal, H, 'S').bid).toBe('P')
  })
})
