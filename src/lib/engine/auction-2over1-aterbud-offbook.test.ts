// Felrapport #58 (2026-09-03, bricka 4): 1♦–P–2♣ (Syd, människan) –P– 2NT (Nord).
// Motorns egen linje hade valt 2♦ (inverterad minor) för Syds hand, så Syds
// 2♣ blev "off-book" och Nords återbud byggdes av det generella off-book-svaret
// (`respondWithoutFit`): "2 sang – balanserad hand (11–12 hp), inget stöd för
// partnern" — ett SVARAR-bud, utan regel och med inbjudningsprägel. Ägaren:
// "2 klöver är 2 över 1, dvs game forcing. Buden framåt måste indikera det."
//
// Två lagningar:
//  (1) Budlådan: efter ett äkta 2-över-1 (ostört, opassad svarare, ny lägre
//      färg på 2-läget) gör öppnaren sitt vanliga §5.3-återbud via samma
//      on-book-funktion (`openerRebidAfter2over1`) även när partnerns 2/1
//      avvek från linjen — 2NT = balanserad utan extra form (12–15), stöd =
//      fit — med regel och kravnivå.
//  (2) Ägarbeslut 2026-09-03: "att sätta game force är viktigare än att
//      kommunicera träff i färg." Med 12+ och egen 5-kortsfärg går 2/1 FÖRE
//      den inverterade höjningen; stödet visas i nästa rond (3♦ = trumf satt
//      med slamintresse, annars 3NT), sedan tar slamutredningen vid.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall, seatToAct } from './auction-live'
import { interpretCall } from './auction-interpret'
import { ruleInfo } from './rules'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, vul: Deal['vulnerability'], hands: Record<Seat, string>): Deal {
  return {
    id: 't', dealer, vulnerability: vul, board: 4,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

/** Låter motorn bjuda alla fyra platserna tills auktionen är slut; kontraktsbuden i ordning. */
function engineAuction(deal: Deal): ResolvedCall[] {
  const history: ResolvedCall[] = []
  for (let i = 0; i < 40; i++) {
    const seat = seatToAct(deal.dealer, history.length)
    history.push(decideCall(deal, history, seat))
    if (history.length >= 4 && history.slice(-3).every((c) => c.bid === 'P')) break
  }
  return history.filter((c) => c.bid !== 'P')
}

// Bricka 4 ur felrapport #58.
const deal58 = dealOf('W', 'all', {
  N: 'S:54 H:AQ7 D:K9652 C:QJ6',
  E: 'S:T987 H:K842 D:T7 C:K42',
  S: 'S:AKJ H:- D:AJ84 C:AT8753',
  W: 'S:Q632 H:JT9653 D:Q3 C:9',
})

describe('felrapport #58 (1) – öppnarens återbud efter partnerns off-book 2-över-1', () => {
  // Syd har 13 balanserade med 4-korts klöver: motorns linje bjuder 3NT, men
  // en människa får bjuda 2♣ (2/1 lovar 4+, "oftast 5+"). Då är Nord off-book.
  const offBook = dealOf('W', 'all', {
    N: 'S:54 H:AQ7 D:K9652 C:QJ6',
    E: 'S:T987 H:K842 D:T7 C:T92',
    S: 'S:KJ3 H:J83 D:Q84 C:AK84',
    W: 'S:AQ62 H:T9654 D:AJ3 C:5',
  })
  const hist = [call('W', 'P'), call('N', '1D'), call('E', 'P'), call('S', '2C'), call('W', 'P')]

  it('Nord (12 hp balanserad) bjuder 2NT som §5.3-återbud med regel + utgångskrav', () => {
    const c = decideCall(offBook, hist, 'N')
    expect(c.bid).toBe('2NT')
    expect(c.rule).toBe('rebid: 2NT (GF)')
    expect(ruleInfo(c.rule).forcing).toBe('utgangskrav')
    expect(c.explanation).toMatch(/utgångskrav/i)
    expect(c.explanation).not.toMatch(/11–12|inget stöd för partnern/)
  })

  it('… och med 4-korts stöd i klöver höjer öppnaren (fit, GF) i stället för sang', () => {
    const deal = dealOf('W', 'all', {
      N: 'S:54 H:A87 D:K965 C:QJ62',
      E: 'S:T987 H:KQ42 D:T7 C:T9',
      S: 'S:KJ3 H:J93 D:Q84 C:AK84',
      W: 'S:AQ62 H:T65 D:AJ32 C:75',
    })
    const c = decideCall(deal, hist, 'N')
    expect(c.bid).toBe('3C')
    expect(c.rule).toBe('rebid: stöd (GF)')
  })

  it('en PASSAD hand som bjuder 2♣ är inget 2/1 → regeln fyrar inte (off-book-svaret som förut)', () => {
    // Syd passade först (giv Syd), Nord öppnade i tredje hand.
    const hist2 = [call('S', 'P'), call('W', 'P'), call('N', '1D'), call('E', 'P'), call('S', '2C'), call('W', 'P')]
    const c = decideCall(offBook, hist2, 'N')
    expect(c.rule).not.toBe('rebid: 2NT (GF)')
  })

  it('tolkningslagret utan regel (dolda händer) läser Nords 2NT som GF-återbud, inte 18–19 inbjudan', () => {
    const stripped = [...hist, call('N', '2NT')]
    const r = interpretCall(stripped, stripped.length - 1)
    expect(r.text).toMatch(/2-över-1/i)
    expect(r.text).toMatch(/12–15/)
    expect(r.text).not.toMatch(/18–19|inbjuder/)
    expect(r.forcing).toBe('utgangskrav')
  })
})

describe('felrapport #58 (2) – 2/1 före inverterad höjning, stödet i nästa rond (ägarbeslut 2026-09-03)', () => {
  it('bricka 4: 1♦–2♣–2NT–3♦ (försenat stöd, slamintresse) –4♦–4NT–5♠–6♦', () => {
    const bids = engineAuction(deal58).map((c) => `${c.seat}:${c.bid}`)
    expect(bids).toEqual(['N:1D', 'S:2C', 'N:2NT', 'S:3D', 'N:4D', 'S:4NT', 'N:5S', 'S:6D'])
  })

  it('… och Syds 3♦ bär regeln "2/1: försenat stöd" (utgångskrav)', () => {
    const hist = [call('W', 'P'), call('N', '1D'), call('E', 'P'), call('S', '2C'), call('W', 'P'), call('N', '2NT'), call('E', 'P')]
    const c = decideCall(deal58, hist, 'S')
    expect(c.bid).toBe('3D')
    expect(c.rule).toBe('2/1: försenat stöd')
    expect(ruleInfo(c.rule).forcing).toBe('utgangskrav')
  })

  it('utan slamintresse (13 hp, 4♦ + 5♣) fullföljs kravet med 3NT som förr', () => {
    const deal = dealOf('N', 'none', {
      N: 'S:54 H:AQ7 D:K9652 C:QJ6',
      E: 'S:AQJT H:J542 D:T3 C:532',
      S: 'S:K3 H:83 D:QJ84 C:AKT84',
      W: 'S:98762 H:KT96 D:A7 C:97',
    })
    const bids = engineAuction(deal).map((c) => `${c.seat}:${c.bid}`)
    expect(bids).toEqual(['N:1D', 'S:2C', 'N:2NT', 'S:3NT'])
  })
})
