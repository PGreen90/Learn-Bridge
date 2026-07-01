import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { buildHandModel } from './hand-model'
import type { Contract, PlayState, Trick } from './play'
import { applyOpeningLeadSignal } from './signal-decode'
import { sampleLayouts } from './monte-carlo'

const C = (rank: Rank, suit: Suit): Card => ({ suit, rank })
const H = (suit: Suit, ...ranks: Rank[]): Hand => ranks.map((r) => C(r, suit))
const hasCard = (hand: Hand, c: Card) => hand.some((x) => x.suit === c.suit && x.rank === c.rank)

/**
 * Minimalt spelläge med ETT avslutat stick (öppningsutspelet). Bara de fält
 * `applyOpeningLeadSignal` läser behöver vara meningsfulla: contract (→ träkarl),
 * completedTricks[0] och de synliga platsernas händer.
 */
function stateWithLead(
  leader: Seat,
  leadCard: Card,
  opts: { declarer?: Seat; hands?: Partial<Record<Seat, Hand>> } = {},
): PlayState {
  const declarer = opts.declarer ?? 'N'
  const order: Seat[] = ['N', 'E', 'S', 'W']
  const after = [...order.slice(order.indexOf(leader) + 1), ...order.slice(0, order.indexOf(leader))]
  const filler = ['2', '3', '4'] as Rank[]
  const trick: Trick = {
    leader,
    cards: [
      { seat: leader, card: leadCard },
      ...after.map((s, i) => ({ seat: s, card: C(filler[i], 'clubs') })),
    ],
    winner: leader,
  }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
  for (const s of order) hands[s] = opts.hands?.[s] ?? []
  const contract: Contract = { declarer, strain: 'NT', level: 3 }
  return {
    contract, trump: null, hands, leader, toAct: leader,
    currentTrick: [], completedTricks: [trick], tricksNS: 0, tricksEW: 0,
  }
}

describe('signalavkodning – öppningsutspelets LÄNGD (§8.3, bot leder ur längsta)', () => {
  it('spotutspel → utspelsfärgen har ≥4 kort, ingen honnörsslutsats', () => {
    const state = stateWithLead('E', C('5', 'spades'))
    const model = applyOpeningLeadSignal(buildHandModel([]), state, 'W')
    expect(model.E.length.spades.min).toBe(4)
    expect(model.E.suitHcp.spades.min).toBe(0)
  })
})

describe('signalavkodning – HONNÖR bara när entydig (utspelaren bevisligen högst)', () => {
  it('K utspel + A synlig hos träkarlen → utspelaren håller D (färg-HP ≥ 5)', () => {
    // Aktören V ser V + träkarl (S, träkarl till spelförare N). A♥ hos S.
    const state = stateWithLead('E', C('K', 'hearts'), { declarer: 'N', hands: { S: H('hearts', 'A') } })
    const model = applyOpeningLeadSignal(buildHandModel([]), state, 'W')
    expect(model.E.suitHcp.hearts.min).toBe(5)
    expect(model.E.length.hearts.min).toBe(4)
  })

  it('A utspel → A-K (alltid entydig; inget kort är högre) → färg-HP ≥ 7', () => {
    const state = stateWithLead('E', C('A', 'spades'))
    const model = applyOpeningLeadSignal(buildHandModel([]), state, 'W')
    expect(model.E.suitHcp.spades.min).toBe(7)
  })

  it('D utspel men K/A dolda (inte synliga) → INGEN honnörsslutsats (kan vara 3:e bästa)', () => {
    // Varken K♦ eller A♦ syns för aktören → D kan vara ett spotutspel (A-D-kn).
    const state = stateWithLead('E', C('Q', 'diamonds'))
    const model = applyOpeningLeadSignal(buildHandModel([]), state, 'W')
    expect(model.E.suitHcp.diamonds.min).toBe(0)
    expect(model.E.length.diamonds.min).toBe(4) // längden gäller ändå
  })
})

describe('signalavkodning – människans (Syd) markering avkodas ALDRIG (ingen tjuvkik)', () => {
  it('Syd leder K♥ → modellen orörd', () => {
    const state = stateWithLead('S', C('K', 'hearts'), { declarer: 'E', hands: { N: H('hearts', 'A') } })
    const model = applyOpeningLeadSignal(buildHandModel([]), state, 'N')
    expect(model.S.length.hearts.min).toBe(0)
    expect(model.S.suitHcp.hearts.min).toBe(0)
  })
})

// End-to-end: en balanserad giv där Öst korrekt spelar ut K♥ ur sin längsta färg
// (♥K Q 5 4), A♥ hos träkarlen (S). Samplaren MÅSTE då ge Öst D♥ (enda sättet att
// nå färg-HP ≥ 5 när K redan är spelad och A/kn är synliga någon annanstans).
describe('signalavkodning – e2e: samplaren placerar den avkodade honnören', () => {
  const orig: Record<Seat, Hand> = {
    N: [...H('spades', 'A', 'K', 'Q', 'J', '10'), ...H('hearts', '10', '9'), ...H('diamonds', 'A', 'K'), ...H('clubs', 'A', 'K', 'Q', 'J')],
    E: [...H('spades', '9', '8', '7'), ...H('hearts', 'K', 'Q', '5', '4'), ...H('diamonds', 'Q', 'J', '10'), ...H('clubs', '4', '3', '2')],
    S: [...H('spades', '6', '5', '4'), ...H('hearts', 'A', 'J', '3'), ...H('diamonds', '9', '8', '7', '6'), ...H('clubs', '10', '9', '8')],
    W: [...H('spades', '3', '2'), ...H('hearts', '8', '7', '6', '2'), ...H('diamonds', '5', '4', '3', '2'), ...H('clubs', '7', '6', '5')],
  }
  // Trick 1: Öst leder K♥, alla följer hjärter, Öst vinner.
  const trick: Trick = {
    leader: 'E',
    cards: [
      { seat: 'E', card: C('K', 'hearts') }, { seat: 'S', card: C('3', 'hearts') },
      { seat: 'W', card: C('2', 'hearts') }, { seat: 'N', card: C('9', 'hearts') },
    ],
    winner: 'E',
  }
  const remove = (hand: Hand, c: Card) => hand.filter((x) => !(x.suit === c.suit && x.rank === c.rank))
  const hands: Record<Seat, Hand> = {
    N: remove(orig.N, C('9', 'hearts')), E: remove(orig.E, C('K', 'hearts')),
    S: remove(orig.S, C('3', 'hearts')), W: remove(orig.W, C('2', 'hearts')),
  }
  const state: PlayState = {
    contract: { declarer: 'N', strain: 'NT', level: 3 }, trump: null, hands,
    leader: 'E', toAct: 'E', currentTrick: [], completedTricks: [trick], tricksNS: 0, tricksEW: 0,
  }

  it('varje sampel ger Öst D♥ (den touchérande honnören) + ≥3 hjärter kvar', () => {
    // Aktör V (Östs partner) ser V + träkarl S; A♥ hos S ⇒ K-utspelet är entydigt.
    const model = applyOpeningLeadSignal(buildHandModel([]), state, 'W')
    expect(model.E.suitHcp.hearts.min).toBe(5)
    const layouts = sampleLayouts(state, 'W', model, 12)
    expect(layouts.length).toBeGreaterThan(0)
    for (const L of layouts) {
      expect(hasCard(L.E, C('Q', 'hearts'))).toBe(true)
      expect(L.E.filter((c) => c.suit === 'hearts').length).toBeGreaterThanOrEqual(3)
    }
  })
})
