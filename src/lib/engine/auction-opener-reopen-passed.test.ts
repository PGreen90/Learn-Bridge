// R1 Fynd #2 (flerronds-konkurrens, del A): öppnarens ROND-2 när partnern PASSAT
// inklivet och motståndarna konkurrerat. FACIT FÖRE FIX.
//
// Roten (bevisad i flerronds-proben, giv #159): öppnaren öppnar 1 i färg, LHO
// kliver in, partnern passar, RHO konkurrerar (höjer/ny färg) → öppnaren säljer
// given ÄVEN med extra/lång färg. openerRondTwoInCompetition hanterar bara när
// partnern BJÖD (ny färg/1NT/höjning); partnerns PASS var ohanterat.
//
// Ägarregel (speglar syskonen §5.8 / delbit 6, men försiktigare eftersom partnern
// PASSAT ett inkliv = sannolikt svag): egen 6+ färg → tävla (rebjud färgen);
// 15+ hp + kort i deras färg → återöppningsdubbling (takeout); annars pass.
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

// ---- Giv #159 ur proben: 1♣–(1♠)–P–(2♠) → öppnaren (Nord) -----------------
// Dealer W. Nord öppnade 1♣ (16 hp, 7-korts klöver), Öst 1♠, Syd pass, Väst 2♠.
const H159 = [call('W', 'P'), call('N', '1C'), call('E', '1S'), call('S', 'P'), call('W', '2S')]

describe('Öppnarens rond-2 när partnern PASSAT inklivet (1-färg–(inkliv)–P–(konkurrens))', () => {
  it('16 hp + 7-korts egen färg → tävlar 3♣ (den lagade buggen, giv #159)', () => {
    const deal = dealOf('W', {
      N: 'S:Q4 H:T3 D:AK C:AQJ7543',   // 16 hp, 7-korts klöver (öppnade 1♣)
      E: 'S:AKJT8 H:J862 D:72 C:98',   // 1♠-inkliv
      S: 'S:962 H:K97 D:QT965 C:62',   // 5 hp → passade inklivet
      W: 'S:753 H:AQ54 D:J843 C:KT',   // 2♠-höjning
    })
    expect(decideCall(deal, H159, 'N').bid).toBe('3C')
    expect(legalCalls(H159, 'N')).toContain('3C')
  })

  // ---- 1♦–(1♠)–P–(2♠): 15+ hp, kort i deras färg, ingen 6-färg → X ---------
  const HDX = [call('S', '1D'), call('W', '1S'), call('N', 'P'), call('E', '2S')]

  it('16 hp, singel i deras färg, stöd i övriga → återöppningsdubbling X', () => {
    // 16 hp, 5-korts ruter (öppnade 1♦), singel spader, 4-korts hjärter + 3 klöver
    const deal = dealOf('S', {
      S: 'S:3 H:AK94 D:AQ842 C:K95',
      W: 'S:AQJ86 H:Q7 D:76 C:JT84',
      N: 'S:K942 H:JT65 D:K3 C:762',
      E: 'S:T75 H:832 D:JT95 C:AQ3',
    })
    expect(decideCall(deal, HDX, 'S').bid).toBe('X')
    expect(legalCalls(HDX, 'S')).toContain('X')
  })

  it('minimum, jämn, ingen 6-färg, ej kort i deras färg → passar (faller igenom)', () => {
    // 13 hp, 5-korts ruter, 3-korts spader (ej kort i deras färg), inga 6-färger
    const deal = dealOf('S', {
      S: 'S:KQ4 H:A85 D:KJ842 C:93',
      W: 'S:AJ976 H:Q7 D:76 C:JT84',
      N: 'S:T52 H:JT63 D:AQ3 C:762',
      E: 'S:83 H:K942 D:T95 C:AKQ5',
    })
    expect(decideCall(deal, HDX, 'S').bid).toBe('P')
  })
})
