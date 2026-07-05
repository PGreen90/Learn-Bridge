// R1 Fynd #2 (flerronds-konkurrens, del C): advancern TÄVLAR upp till fiten på
// 3-läget efter motståndarnas fitvisande höjning. FACIT FÖRE FIX.
//
// Roten (bevisad i flerronds-proben, giv #263): partnern kliver in 2♥ (bra 6+ färg),
// motståndarna hittar sin spaderfit (1♠–...–2♠), och advancern med 3-korts stöd
// (= 9-korts fit) PASSAR i stället för att tävla 3♥ (lagen om totala stick). Två
// buggar: (1) fitLengthNeeded krävde 4-korts stöd för ett 2-läges inkliv; (2)
// raiseWithFit hade bjudit 4♥ (inbjudande hopp = överbud), inte det tävlande 3♥.
//
// Ägarregel: 3-korts stöd för ett 2-läges inkliv (9-korts fit) + motståndarna har
// hittat sin fit → tävla till 3 i partnerns färg (lagen); genuina utgångsvärden
// (13+ stödpoäng) → utgång; för svag hand → passa.
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

describe('Advancern tävlar upp till fiten (1♠–(2♥-inkliv)–2♠–advancern)', () => {
  // ---- Giv #263 ur proben: W:1♠ N:2♥ E:2♠ → advancern Syd, 3-korts hjärterstöd --
  const H263 = [call('W', '1S'), call('N', '2H'), call('E', '2S')]

  it('11 hp + 3-korts stöd (9-korts fit) → tävlar 3♥ (den lagade buggen, giv #263)', () => {
    const deal = dealOf('W', {
      W: 'S:AQT854 H:A2 D:94 C:JT6',   // öppnade 1♠ (6 spader)
      N: 'S:96 H:KQT963 D:QJ5 C:A2',   // 2♥-inkliv (6 hjärter)
      E: 'S:K32 H:J5 D:T873 C:Q943',   // 2♠-höjning
      S: 'S:J7 H:874 D:AK62 C:K875',   // 11 hp, 3-korts hjärter → tävla 3♥
    })
    expect(decideCall(deal, H263, 'S').bid).toBe('3H')
    expect(legalCalls(H263, 'S')).toContain('3H')
  })

  it('för svag advancer (5 hp) + 3-korts stöd → passar (tävlar inte på en bust)', () => {
    const deal = dealOf('W', {
      W: 'S:AKQ84 H:T D:AJ4 C:9532',   // öppnade 1♠
      N: 'S:6 H:AKJ982 D:Q75 C:QJ6',   // 2♥-inkliv
      E: 'S:JT97 H:753 D:K82 C:K84',   // 2♠-höjning
      S: 'S:532 H:Q64 D:T963 C:AT7',   // 6 hp, 3-korts hjärter → för svag, passa
    })
    expect(decideCall(deal, H263, 'S').bid).toBe('P')
  })
})
