import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { chooseCardMonteCarlo } from './monte-carlo'
import { mulberry32 } from './deal'
import { buildHandModel } from './hand-model'
import { type Contract, type PlayState, type Trick } from './play'

// Determinismbeviset för Beslut B etapp 0: med en INTRÅDD slumpkälla (`rng`) ska
// Monte-Carlo-kortvalet bli exakt reproducerbart. Utan seedning drar samplingen
// ur Math.random och kan variera. Fixturen (fabricate) är lyft ur
// play-bot-smart.test.ts — samma 6-korts NT-slutspel där MC faktiskt körs.

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const C = (s: Suit, r: Rank): Card => ({ suit: s, rank: r })
const key = (c: Card) => `${c.suit}${c.rank}`

function fullDeck(): Card[] {
  const out: Card[] = []
  for (const s of SUITS) for (const r of RANKS) out.push({ suit: s, rank: r })
  return out
}

/** Slutspel med `live` som återstående kort; övriga stoppas in som fyllnadsstick.
 *  (Identisk med hjälparen i play-bot-smart.test.ts — se den för renons-resonemanget.) */
function fabricate(live: Record<Seat, Hand>, declarer: Seat, strain: Contract['strain'], leader: Seat): PlayState {
  const liveKeys = new Set(Object.values(live).flat().map(key))
  const filler = fullDeck().filter((c) => !liveKeys.has(key(c)))
  filler.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))
  const completedTricks: Trick[] = []
  for (let i = 0; i < filler.length; i += 4) {
    const chunk = filler.slice(i, i + 4)
    const counts = new Map<Suit, number>()
    for (const c of chunk) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1)
    let led = chunk[0].suit
    for (const [s, n] of counts) if (n > (counts.get(led) ?? 0)) led = s
    const off = chunk.filter((c) => c.suit !== led)
    const cards: { seat: Seat; card: Card }[] = []
    off.forEach((card, idx) => cards.push({ seat: (['N', 'S'] as Seat[])[idx], card }))
    const remaining = (['E', 'W', 'N', 'S'] as Seat[]).filter((s) => !cards.some((pc) => pc.seat === s))
    chunk.filter((c) => c.suit === led).forEach((card, idx) => cards.push({ seat: remaining[idx], card }))
    cards.sort((a, b) => (a.card.suit === led ? 0 : 1) - (b.card.suit === led ? 0 : 1))
    completedTricks.push({ leader: 'N', cards, winner: 'N' })
  }
  return {
    contract: { declarer, strain, level: 1 },
    trump: strain === 'NT' ? null : strain,
    hands: live, leader, toAct: leader, currentTrick: [], completedTricks, tricksNS: 0, tricksEW: 0,
  }
}

/** 6-korts NT-slutspel, S ska agera (spelförarsidan). Samma giv som i det
 *  befintliga Steg 3c-testet, där MC bevisligen körs. */
function endgame(): { state: PlayState; seat: Seat } {
  const live: Record<Seat, Hand> = {
    N: [C('spades', '8'), C('hearts', 'Q'), C('hearts', '6'), C('diamonds', 'Q'), C('diamonds', '5'), C('clubs', 'K')],
    E: [C('spades', '6'), C('hearts', '8'), C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', '10'), C('clubs', '2')],
    S: [C('hearts', 'K'), C('hearts', '10'), C('hearts', '2'), C('diamonds', '9'), C('diamonds', '7'), C('clubs', '5')],
    W: [C('spades', '10'), C('spades', '3'), C('spades', '2'), C('hearts', '5'), C('clubs', '8'), C('clubs', '3')],
  }
  // Ge S turen att spela ut (leader = S) så chooseCardMonteCarlo har >1 lagligt kort.
  return { state: fabricate(live, 'S', 'NT', 'S'), seat: 'S' }
}

describe('chooseCardMonteCarlo – seedad rng ger deterministiskt kortval', () => {
  it('samma frö ⇒ exakt samma kort', () => {
    const { state, seat } = endgame()
    const model = buildHandModel([], {})
    const a = chooseCardMonteCarlo(state, seat, model, { samples: 30, rng: mulberry32(20260810) })
    const b = chooseCardMonteCarlo(state, seat, model, { samples: 30, rng: mulberry32(20260810) })
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.card).toEqual(b!.card)
    // Samma frö → identisk ström → identisk röstning hela vägen (även score/samples).
    expect(a!.score).toBe(b!.score)
    expect(a!.samples).toBe(b!.samples)
  })

  it('samma frö är stabilt över flera oberoende körningar', () => {
    const { state, seat } = endgame()
    const model = buildHandModel([], {})
    const runs = [0, 1, 2, 3].map(
      () => chooseCardMonteCarlo(state, seat, model, { samples: 24, rng: mulberry32(42) }),
    )
    for (const r of runs) expect(r).not.toBeNull()
    const first = runs[0]!.card
    for (const r of runs) expect(r!.card).toEqual(first)
  })
})
