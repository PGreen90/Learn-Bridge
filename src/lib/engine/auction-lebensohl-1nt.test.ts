import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { decideCall } from './auction-live'

// Lebensohl EFTER VÅRT 1NT — integrationsfacit (§7.5, Lager 1). Bevisar att
// verktygen NÅS i en levande auktion: motståndarens naturliga inkliv modelleras,
// svararen spelar Lebensohl (skild från DONT via rule), och öppnaren fullföljer
// reläet. Motpolen: ett DONT-inkliv (utan naturlig rule) ska INTE trigga Lebensohl.

function call(seat: Seat, bid: string, rule?: string): ResolvedCall {
  return rule ? { seat, bid, rule } : { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

// Konsistent giv: S öppnar 1NT (16, jämn), W har stark 6-korts enfärg → naturligt 2♠,
// N svag med 6 klöver → 2NT-relä.
const DEAL_RELAY = dealOf('S', {
  S: 'S:A83 H:K54 D:AQ76 C:K92',       // 16, 3-3-4-3 → 1NT
  W: 'S:KQJT97 H:Q3 D:832 C:A4',       // 6 spader, 12 hp → naturligt 2♠
  N: 'S:42 H:762 D:54 C:QJT876',       // 3 hp, 6 klöver → 2NT-relä, passar sedan 3♣
  E: 'S:65 H:AJT98 D:KJT9 C:53',
})

const NAT = 'naturligt inkliv (1NT)'
const S_1NT = 'S:A83 H:K54 D:AQ76 C:K92'
const FILL = 'S:JT9 H:JT9 D:JT9 C:JT98'

/** Svararens (N) bud efter (1NT)–(2X naturligt), med valfri N-hand. */
function respAfterNatural(nHand: string, theirBid: string): ResolvedCall {
  const deal = dealOf('S', { S: S_1NT, N: nHand, E: FILL, W: FILL })
  const hist = [call('S', '1NT'), call('W', theirBid, NAT)]
  return decideCall(deal, hist, 'N')
}

describe('Lebensohl efter 1NT – motståndarens naturliga inkliv modelleras', () => {
  it('stark enfärgshand (W) klivar naturligt 2♠ över vårt 1NT (rule = naturligt)', () => {
    const turns = buildAuction(DEAL_RELAY)!.turns
    expect(turns[0].call).toBe('1NT')
    expect(turns[1].call).toBe('2S')
    expect(turns[1].rule).toMatch(/naturligt inkliv/)
  })

  it('samma inkliv nås live via decideCall (W:s tur efter vårt 1NT)', () => {
    const bid = decideCall(DEAL_RELAY, [call('S', '1NT')], 'W')
    expect(bid).toMatchObject({ bid: '2S', rule: 'naturligt inkliv (1NT)' })
  })
})

describe('Lebensohl efter 1NT – svararen spelar konventionen (skild från DONT)', () => {
  it('svag med lång klöver → 2NT-relä, öppnaren 3♣, svararen passar', () => {
    const s1 = call('S', '1NT')
    const w = decideCall(DEAL_RELAY, [s1], 'W')          // 2♠ naturligt
    const n = decideCall(DEAL_RELAY, [s1, w], 'N')       // Lebensohl 2NT
    expect(n.bid).toBe('2NT')
    const e = call('E', 'P')
    const s2 = decideCall(DEAL_RELAY, [s1, w, n, e], 'S') // öppnaren tvingas 3♣
    expect(s2.bid).toBe('3C')
    const w2 = call('W', 'P')
    const n2 = decideCall(DEAL_RELAY, [s1, w, n, e, s2, w2], 'N') // klöver → passar
    expect(n2.bid).toBe('P')
  })

  it('utgångskrav med egen 5-färg → direkt 3-läge', () => {
    expect(respAfterNatural('S:A2 H:KQ3 D:832 C:KQT94', '2S').bid).toBe('3C')
  })

  it('jämn utgångshand → direkt 3NT', () => {
    expect(respAfterNatural('S:KQ42 H:KJ5 D:QT4 C:A32', '2H').bid).toBe('3NT')
  })

  it('svag utan färg → passar (försvarar deras inkliv)', () => {
    expect(respAfterNatural('S:842 H:973 D:9532 C:J86', '2S').bid).toBe('P')
  })

  it('DISKRIMINATOR: samma 2♠ UTAN naturlig rule (DONT) triggar INTE Lebensohl-reläet', () => {
    const deal = dealOf('S', { S: S_1NT, N: 'S:42 H:762 D:54 C:QJT876', E: FILL, W: FILL })
    const bid = decideCall(deal, [call('S', '1NT'), call('W', '2S')], 'N')
    expect(bid.bid).not.toBe('2NT') // faller till gamla DONT-vägen, ej Lebensohl
  })
})
