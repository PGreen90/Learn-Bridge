import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { dealRandom } from './deal'
import { botCard } from './play-bot'
import {
  contractResult,
  currentWinner,
  isComplete,
  legalCards,
  playCard,
  startPlay,
  type Contract,
  type PlayedCard,
} from './play'

const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })

/** En komplett, laglig 52-kortsgiv (samma som slamtestet). */
function makeDeal(): Deal {
  return {
    id: 'play-test',
    dealer: 'N',
    vulnerability: 'none',
    board: 1,
    hands: {
      N: parseHand('S:AKQ85 H:A432 D:K2 C:32'),
      E: parseHand('S:T943 H:876 D:T43 C:765'),
      S: parseHand('S:J762 H:KQ5 D:AQ6 C:K84'),
      W: parseHand('S:- H:JT9 D:J9875 C:AQJT9'),
    },
  }
}

/** Liten deterministisk slumpgenerator för reproducerbara utspelningar. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('startPlay', () => {
  it('utspelaren är spelförarens vänstra motståndare; trumf sätts', () => {
    const s = startPlay(makeDeal(), { declarer: 'N', strain: 'spades', level: 4 })
    expect(s.leader).toBe('E')
    expect(s.toAct).toBe('E')
    expect(s.trump).toBe('spades')
  })
  it('sang ger ingen trumf', () => {
    expect(startPlay(makeDeal(), { declarer: 'S', strain: 'NT', level: 3 }).trump).toBeNull()
  })
})

describe('legalCards – följa färg', () => {
  it('måste följa utspelsfärgen om man kan', () => {
    let s = startPlay(makeDeal(), { declarer: 'N', strain: 'spades', level: 4 })
    s = playCard(s, C('spades', '10')) // Öst spelar ut spader
    expect(s.toAct).toBe('S')
    expect(new Set(legalCards(s, 'S').map((c) => c.suit))).toEqual(new Set(['spades']))
  })
  it('renons i utspelsfärgen → fritt val', () => {
    let s = startPlay(makeDeal(), { declarer: 'N', strain: 'spades', level: 4 })
    s = playCard(s, C('spades', '10')) // Öst
    s = playCard(s, C('spades', 'J')) // Syd följer
    expect(s.toAct).toBe('W') // Väst är renons i spader
    expect(new Set(legalCards(s, 'W').map((c) => c.suit)).size).toBeGreaterThan(1)
  })
})

describe('currentWinner – stickvinnare', () => {
  it('trumf slår högre icke-trumf (ruff)', () => {
    const trick: PlayedCard[] = [
      { seat: 'E', card: C('clubs', 'A') },
      { seat: 'S', card: C('clubs', '2') },
      { seat: 'W', card: C('hearts', '3') }, // ruffar med trumf
      { seat: 'N', card: C('clubs', 'K') },
    ]
    expect(currentWinner(trick, 'hearts')).toBe('W')
  })
  it('utan trumf vinner högsta kortet i utspelsfärgen', () => {
    const trick: PlayedCard[] = [
      { seat: 'E', card: C('clubs', '5') },
      { seat: 'S', card: C('clubs', '4') },
      { seat: 'W', card: C('hearts', 'A') }, // saka – kan inte vinna
      { seat: 'N', card: C('clubs', 'K') },
    ]
    expect(currentWinner(trick, null)).toBe('N')
  })
})

describe('playCard', () => {
  it('avgör vinnaren, räknar sticket och låter vinnaren spela ut', () => {
    let s = startPlay(makeDeal(), { declarer: 'N', strain: 'spades', level: 4 })
    s = playCard(s, C('spades', '10')) // Ö
    s = playCard(s, C('spades', 'J')) // S
    s = playCard(s, C('clubs', 'A')) // V saka (renons spader)
    s = playCard(s, C('spades', 'K')) // N
    expect(s.completedTricks).toHaveLength(1)
    expect(s.completedTricks[0].winner).toBe('N') // högsta spadern
    expect(s.tricksNS).toBe(1)
    expect(s.leader).toBe('N') // vinnaren spelar ut nästa
  })
  it('kastar om kortet inte är lagligt', () => {
    let s = startPlay(makeDeal(), { declarer: 'N', strain: 'spades', level: 4 })
    s = playCard(s, C('spades', '10')) // Ö spelar ut spader
    // Syd har spader men försöker saka klöver → olagligt
    expect(() => playCard(s, C('clubs', '4'))).toThrow()
  })
})

describe('bottar – hel utspelning', () => {
  it('en bot-mot-bot-giv ger 13 giltiga stick (följa färg hela vägen)', () => {
    const deal = dealRandom(mulberry32(42))
    const contract: Contract = { declarer: 'N', strain: 'hearts', level: 4 }
    let s = startPlay(deal, contract)
    let guard = 0
    while (!isComplete(s)) {
      s = playCard(s, botCard(s, s.toAct)) // playCard kastar om botten fuskar
      if (++guard > 60) throw new Error('fastnade')
    }
    expect(s.completedTricks).toHaveLength(13)
    expect(s.tricksNS + s.tricksEW).toBe(13)
    expect(Object.values(s.hands).every((h) => h.length === 0)).toBe(true)
    const r = contractResult(s)
    expect(r.diff).toBe(r.declarerTricks - 10)
    expect(r.made).toBe(r.declarerTricks >= 10)
  })

  it('fungerar likadant i sang (ingen trumf)', () => {
    const deal = dealRandom(mulberry32(7))
    let s = startPlay(deal, { declarer: 'S', strain: 'NT', level: 3 })
    while (!isComplete(s)) s = playCard(s, botCard(s, s.toAct))
    expect(s.completedTricks).toHaveLength(13)
    expect(s.tricksNS + s.tricksEW).toBe(13)
  })
})
