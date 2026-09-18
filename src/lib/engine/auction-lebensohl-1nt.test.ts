import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { decideCall } from './auction-live'

// Naturligt inkliv över vårt 1NT — integrationsfacit (§7.5). Motståndarens
// naturliga inkliv modelleras; svararen spelar ägarens struktur 2026-09-18
// (systems on + stulet bud) — Lebensohl-kärnan är riven.

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

// Ägarens spec 2026-09-18 (felrapport #77): Lebensohl efter vårt 1NT är RIVEN —
// EN struktur mot alla inkliv (systems on + stulet bud), oavsett om inklivet är
// naturligt eller DONT. Samma händer som Lebensohl-faciten, nya svar.
describe('efter 1NT – (naturligt 2x): systems on, ingen Lebensohl', () => {
  it('svag med lång klöver → pass (2NT-reläet finns inte längre); öppnaren passar ut', () => {
    const s1 = call('S', '1NT')
    const w = decideCall(DEAL_RELAY, [s1], 'W') // 2♠ naturligt
    const n = decideCall(DEAL_RELAY, [s1, w], 'N')
    expect(n.bid).toBe('P')
    const s2 = decideCall(DEAL_RELAY, [s1, w, n, call('E', 'P')], 'S') // återöppning: ingen 5+ högfärg
    expect(s2.bid).toBe('P')
  })

  it('utgångsvärden, jämn med spaderstopp → 3NT (jämna vägen)', () => {
    expect(respAfterNatural('S:A2 H:KQ3 D:832 C:KQT94', '2S').bid).toBe('3NT')
  })

  it('värden med fyrkorts spader över deras 2♥ → X (8+ med fyrkorts högfärg)', () => {
    expect(respAfterNatural('S:KQ42 H:KJ5 D:QT4 C:A32', '2H')).toMatchObject({ bid: 'X', rule: 'värde-X med högfärg (stört 1NT)' })
  })

  it('svag utan färg → passar', () => {
    expect(respAfterNatural('S:842 H:973 D:9532 C:J86', '2S').bid).toBe('P')
  })

  it('EN struktur: samma 2♠ med eller utan naturlig rule ger samma svar', () => {
    const deal = dealOf('S', { S: S_1NT, N: 'S:42 H:762 D:54 C:QJT876', E: FILL, W: FILL })
    const dont = decideCall(deal, [call('S', '1NT'), call('W', '2S')], 'N').bid
    const nat = decideCall(deal, [call('S', '1NT'), call('W', '2S', NAT)], 'N').bid
    expect(dont).toBe(nat)
  })
})
