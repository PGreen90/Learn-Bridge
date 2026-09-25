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


describe('chooseCardMonteCarlo – DDS-röstning över sampeln (Steg 3b)', () => {
  // 3-korts NT-slutspel, spelförare S, träkarl N, S på lead. BLOCKERINGSFÄLLA:
  // S: ♠A ♠2 ♥K · N (träkarl): ♥A ♦2 ♣2 · Ö: ♠K ♠Q ♥Q · V: ♦3 ♣3 ♣4.
  // En spader först = 2 stick (spadersticket + ♥A, eller ♥A + bordets sista
  // kort när alla är renons). Leder S ♥K tvingas ♥A upp i SAMMA stick, bordet
  // måste sedan leda en hacka till V och ♠A cashas aldrig = 1 stick.
  // Röstningen ska undvika fällan ♥K (♠A och ♠2 är DD-lika; sedan felrapport
  // #78/#79 vinner det lägsta av dem).
  // (Det gamla exemplet — ♠A ♠2 ♥A mot ♠KQJ — var ingen fälla: ♠2 och ♠A gav
  // båda 2 stick, och testet passerade bara för att ♠A stod först i listan.)
  const live: Record<Seat, Hand> = {
    S: [C('spades', 'A'), C('spades', '2'), C('hearts', 'K')],
    N: [C('hearts', 'A'), C('diamonds', '2'), C('clubs', '2')],
    E: [C('spades', 'K'), C('spades', 'Q'), C('hearts', 'Q')],
    W: [C('diamonds', '3'), C('clubs', '3'), C('clubs', '4')],
  }
  /** Naglar V till ruter+klöver (renons i spader/hjärter) → Ö får ♠K ♠Q ♥Q exakt. */
  function pinWestToMinors(): HandModel {
    const m = buildHandModel([])
    m.W.voids.add('spades')
    m.W.voids.add('hearts')
    return m
  }

  it('spelföraren undviker fällan (♥K) och väljer ett optimalt kort', () => {
    const state = fabricate(live, 'S', 'NT', 'S')
    const choice = chooseCardMonteCarlo(state, 'S', pinWestToMinors(), { samples: 8 })
    expect(choice).not.toBeNull()
    expect(key(choice!.card)).not.toBe(key(C('hearts', 'K'))) // inte fällan
    const optimal = optimalCards(state, 'S', live).map(key)
    expect(optimal).toContain(key(choice!.card)) // ett facit-optimalt kort (♠A eller ♠2)
    expect(choice!.score).toBe(2) // fällan ♥K gav 1
  })

  it('vid LIKA poäng vinner det lägsta kortet (felrapport #78/#79: saka aldrig honnören i onödan)', () => {
    // Motspelaren Ö ska saka på S:s ♥A (Ö renons i hjärter): ♠K och ♠2 är DD-lika
    // (spelföraren har resten) → det billigaste kortet, ♠2, inte kungen.
    const live3: Record<Seat, Hand> = {
      S: [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q')],
      N: [C('clubs', 'A'), C('clubs', 'K'), C('clubs', 'Q')],
      E: [C('spades', 'K'), C('spades', '2'), C('diamonds', '5')],
      W: [C('diamonds', '2'), C('diamonds', '3'), C('diamonds', '4')],
    }
    let state: PlayState = fabricate(live3, 'S', 'NT', 'S')
    state = playCard(state, C('hearts', 'A')) // S leder
    state = playCard(state, C('diamonds', '2')) // V sakar
    state = playCard(state, C('clubs', 'Q')) // N (träkarlen) sakar
    expect(state.toAct).toBe('E')
    const m = buildHandModel([])
    m.W.voids.add('spades')
    m.W.voids.add('hearts')
    m.W.voids.add('clubs')
    const choice = chooseCardMonteCarlo(state, 'E', m, { samples: 6 })!
    expect(key(choice.card)).toBe(key(C('spades', '2')))
  })

  it('poängen som röstningen ger matchar den exakta DDS-poängen (pinnad giv)', () => {
    const state = fabricate(live, 'S', 'NT', 'S')
    const choice = chooseCardMonteCarlo(state, 'S', pinWestToMinors(), { samples: 6 })!
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
