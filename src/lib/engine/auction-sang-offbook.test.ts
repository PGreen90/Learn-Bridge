// FACIT-TEST för felrapport #41 (bricka 11): SANGSYSTEMET GÄLLDE INTE OFF-BOOK.
//
// Ägaren bjöd 1NT själv i budlådan (ett bud den kanoniska linjen inte valt) och
// auktionen dog på fläcken: 1NT–P–P–P. Partnern satt med ♠3 ♥T98 ♦AJ63 ♣AKQJ7
// (15 hp, 5-4 i minorerna, solid klöverfärg) och passade.
//
// Roten: `respondTo1NT`/`respondTo2NT` (§4.3) är BARA inkopplade i den kanoniska
// linjen (`auction.ts`). I off-book-lagret gick svaret till `offBookResponse`,
// som kräver att partnern visat en FÄRG — en sangöppning visar ingen färg, så
// den returnerade null och given passades ut. Samma hål på andra sidan bordet:
// öppnaren hade ingen väg att besvara Stayman/transfer/MSS off-book.
//
// Ägarbeslut (rapportens fritext): "med partners hand så bör den forska i slam i
// lågfärger här" → Minor Suit Stayman (2♠), sangsystemet på precis som on-book.
// Svarets BETYDELSE läses ur budet, aldrig ur partnerns kort (ärliga slamportar).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'

const call = (seat: Seat, bid: string): ResolvedCall =>
  ({ seat, bid, rule: '', explanation: '' }) as ResolvedCall

const deal: Deal = {
  id: 'felrapport-41',
  board: 11,
  dealer: 'S',
  vulnerability: 'none',
  hands: {
    N: parseHand('S:3 H:T98 D:AJ63 C:AKQJ7'),   // 15 hp, 5-4 minorer, ingen högfärg
    E: parseHand('S:KT8752 H:KQ32 D:- C:953'),
    S: parseHand('S:AQ H:AJ75 D:KQT82 C:86'),   // 16 hp – ägaren bjöd 1NT för hand
    W: parseHand('S:J964 H:64 D:9754 C:T42'),
  },
}

describe('Felrapport #41 – sangsystemet gäller även när 1NT bjudits off-book', () => {
  it('svararen bjuder Minor Suit Stayman (2♠) i stället för att passa 1NT', () => {
    const n = decideCall(deal, [call('S', '1NT'), call('W', 'P')], 'N')
    expect(n.bid).toBe('2S')
    expect(n.rule).toBe('Minor Suit Stayman')
  })

  it('öppnaren besvarar MSS med 3♦ (4+ ruter, förnekar 4-korts klöver)', () => {
    const s = decideCall(
      deal,
      [call('S', '1NT'), call('W', 'P'), call('N', '2S'), call('E', 'P')],
      'S',
    )
    expect(s.bid).toBe('3D')
    expect(s.rule).toBe('MSS-svar')
  })

  it('given dör inte i 1NT – slutkontraktet blir minst utgång', () => {
    const order: Seat[] = ['S', 'W', 'N', 'E']
    let h: ResolvedCall[] = [call('S', '1NT')]
    let idx = order.indexOf('W')
    let passes = 0
    while (passes < 3 && h.length < 24) {
      const seat = order[idx % 4]
      const c = decideCall(deal, h, seat)
      h = [...h, call(seat, c.bid)]
      passes = c.bid === 'P' ? passes + 1 : 0
      idx++
    }
    const contractBids = h.filter((c) => /^[1-7](C|D|H|S|NT)$/.test(c.bid))
    const last = contractBids[contractBids.length - 1]
    expect(last.bid).not.toBe('1NT')
    expect(Number(last.bid[0])).toBeGreaterThanOrEqual(3)
  })
})

// Systerfallet åt andra hållet: Stayman och transfer måste också besvaras när
// 1NT bjudits off-book (samma detektor, betydelsen läst ur budet).
describe('Felrapport #41 – öppnaren besvarar övriga sangsvar off-book', () => {
  const staymanDeal: Deal = {
    ...deal,
    id: 'felrapport-41-stayman',
    hands: { ...deal.hands, S: parseHand('S:AQ92 H:AJ75 D:KQT C:86') },
  }

  it('Stayman (2♣) → 2♥ med 4-korts hjärter', () => {
    const s = decideCall(
      staymanDeal,
      [call('S', '1NT'), call('W', 'P'), call('N', '2C'), call('E', 'P')],
      'S',
    )
    expect(s.bid).toBe('2H')
    expect(s.rule).toBe('Stayman-svar')
  })

  it('Jacoby-transfer (2♦) → 2♥ (fullföljd transfer)', () => {
    const s = decideCall(
      staymanDeal,
      [call('S', '1NT'), call('W', 'P'), call('N', '2D'), call('E', 'P')],
      'S',
    )
    expect(s.bid).toBe('2H')
    expect(s.rule).toBe('fullföljd transfer')
  })

  it('motståndarna stör → detektorn håller sig borta (ntInterference äger läget)', () => {
    const s = decideCall(
      staymanDeal,
      [call('S', '1NT'), call('W', '2H'), call('N', 'P'), call('E', 'P')],
      'S',
    )
    expect(s.rule).not.toBe('Stayman-svar')
  })
})
