import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { buildHandModel } from './hand-model'
import type { HandModel } from './hand-model'
import { doubleDummyDeclarerRemaining } from './dds'
import { legalCards, playCard, side, type Contract, type PlayState, type Trick } from './play'
import { chooseCardMonteCarlo } from './monte-carlo'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })
const key = (c: Card) => `${c.suit}${c.rank}`

function fullDeck(): Card[] {
  const out: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) out.push({ suit, rank })
  return out
}

/**
 * Bygger ett spelläge med `live` som återstående kort (få kort per hand). De
 * övriga korten stoppas in som avslutade stick bara för att kortantalen ska gå
 * ihop (deras platser/vinnare påverkar varken sampling eller DDS här).
 */
function fabricate(live: Record<Seat, Hand>, declarer: Seat, strain: Contract['strain'], toAct: Seat): PlayState {
  const liveKeys = new Set(Object.values(live).flat().map(key))
  const played = fullDeck().filter((c) => !liveKeys.has(key(c)))
  const order: Seat[] = ['N', 'E', 'S', 'W']
  const completedTricks: Trick[] = []
  for (let i = 0; i < played.length; i += 4) {
    const cards = played.slice(i, i + 4).map((card, j) => ({ seat: order[j], card }))
    completedTricks.push({ leader: 'N', cards, winner: 'N' })
  }
  return {
    contract: { declarer, strain, level: 1 },
    trump: strain === 'NT' ? null : strain,
    hands: live,
    leader: toAct,
    toAct,
    currentTrick: [],
    completedTricks,
    tricksNS: 0,
    tricksEW: 0,
  }
}

/** Exakt DDS-poäng (banked + återstående) för ETT kort i en KÄND giv. */
function exactScore(state: PlayState, layout: Record<Seat, Hand>, card: Card): number {
  const next = playCard({ ...state, hands: layout }, card)
  const dd = doubleDummyDeclarerRemaining(next.hands, next.contract.strain, next.contract.declarer, next.currentTrick, next.toAct, Infinity)!
  const banked = side(state.contract.declarer) === 'NS' ? next.tricksNS : next.tricksEW
  return banked + dd
}

/** Kort som är optimala för `seat` i den KÄNDA given (facit att jämföra mot). */
function optimalCards(state: PlayState, seat: Seat, layout: Record<Seat, Hand>): Card[] {
  const legal = legalCards(state, seat)
  const scored = legal.map((c) => ({ c, s: exactScore(state, layout, c) }))
  const maximize = side(seat) === side(state.contract.declarer)
  const best = maximize ? Math.max(...scored.map((x) => x.s)) : Math.min(...scored.map((x) => x.s))
  return scored.filter((x) => x.s === best).map((x) => x.c)
}

/**
 * Modell som NAGLAR de dolda platserna till en unik fördelning via renonser:
 * här är Ö renons i allt utom spader → Ö måste få poolens tre spader, V resten.
 * Då blir samplingen exakt = den verkliga given (facit går att räkna för hand).
 */
function pinEastToSpades(): HandModel {
  const m = buildHandModel([])
  m.E.voids.add('hearts')
  m.E.voids.add('diamonds')
  m.E.voids.add('clubs')
  return m
}

describe('chooseCardMonteCarlo – DDS-röstning över sampeln (Steg 3b)', () => {
  // 3-korts NT-slutspel, spelförare S, träkarl N, S på lead.
  // S: ♠A ♠2 ♥A · N: ♥K ♦A ♣A · Ö: ♠KQJ · V: ♥2 ♦2 ♣2.
  // Leder S ♠2 → Ö vinner och cashar KQJ = 3 stick till motspelet (spelföraren 0).
  // Bäst för spelföraren = 2 stick (träkarlens ♦A/♣A är strandade utan ingång).
  // Röstningen ska undvika fällan ♠2 (0 stick).
  const live: Record<Seat, Hand> = {
    S: [C('spades', 'A'), C('spades', '2'), C('hearts', 'A')],
    N: [C('hearts', 'K'), C('diamonds', 'A'), C('clubs', 'A')],
    E: [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J')],
    W: [C('hearts', '2'), C('diamonds', '2'), C('clubs', '2')],
  }

  it('spelföraren undviker fällan (♠2) och väljer ett optimalt kort', () => {
    const state = fabricate(live, 'S', 'NT', 'S')
    const choice = chooseCardMonteCarlo(state, 'S', pinEastToSpades(), { samples: 8 })
    expect(choice).not.toBeNull()
    expect(key(choice!.card)).not.toBe(key(C('spades', '2'))) // inte fällan
    const optimal = optimalCards(state, 'S', live).map(key)
    expect(optimal).toContain(key(choice!.card)) // ett facit-optimalt kort
    expect(choice!.score).toBe(2) // bästa möjliga (♦A/♣A strandade); fällan gav 0
  })

  it('poängen som röstningen ger matchar den exakta DDS-poängen (pinnad giv)', () => {
    const state = fabricate(live, 'S', 'NT', 'S')
    const choice = chooseCardMonteCarlo(state, 'S', pinEastToSpades(), { samples: 6 })!
    expect(choice.score).toBe(exactScore(state, live, choice.card))
  })

  it('motspelaren minimerar spelförarens stick', () => {
    // Samma kort men nu är Ö SPELFÖRARE (träkarl V), och S är MOTSPELARE på lead.
    // Dolda för S: Ö (spelföraren) + N (partnern). Vi naglar N till spader så
    // fördelningen blir unik igen (N får poolens spader).
    const m = buildHandModel([])
    m.N.voids.add('hearts')
    m.N.voids.add('diamonds')
    m.N.voids.add('clubs')
    // Byt runt korten så given är laglig som Ö-kontrakt: låt N hålla spadren.
    const live2: Record<Seat, Hand> = {
      S: [C('hearts', 'A'), C('diamonds', '2'), C('clubs', '2')],
      W: [C('hearts', 'K'), C('diamonds', 'A'), C('clubs', 'A')],
      N: [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J')],
      E: [C('hearts', '2'), C('diamonds', '3'), C('clubs', '3')],
    }
    const state = fabricate(live2, 'E', 'NT', 'S')
    const choice = chooseCardMonteCarlo(state, 'S', m, { samples: 8 })!
    const optimal = optimalCards(state, 'S', live2).map(key)
    expect(optimal).toContain(key(choice.card))
  })

  it('omöjlig modell → null (anroparen faller tillbaka på tumregler)', () => {
    const state = fabricate(live, 'S', 'NT', 'S')
    const m = buildHandModel([])
    m.E.voids.add('spades') // men Ö MÅSTE få poolens spader → ingen sampel
    m.W.voids.add('spades')
    expect(chooseCardMonteCarlo(state, 'S', m, { samples: 5 })).toBeNull()
  })
})
