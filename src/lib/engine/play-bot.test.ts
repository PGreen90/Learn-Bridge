import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCard } from './play-bot'
import type { Contract, PlayedCard, PlayState } from './play'

const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })

/** Bygger ett kortspelsläge för att testa botCard i en viss situation. */
function state(opts: {
  trump?: Suit | null
  hand: Hand // den agerande platsens kort
  seat?: Seat // den agerande platsen (default S)
  trick?: PlayedCard[] // redan lagda kort i sticket
  leader?: Seat
}): PlayState {
  const seat = opts.seat ?? 'S'
  const trump = opts.trump === undefined ? null : opts.trump
  const contract: Contract = { declarer: 'N', strain: trump ?? 'NT', level: 3 }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
  hands[seat] = opts.hand
  return {
    contract,
    trump,
    hands,
    leader: opts.leader ?? 'W',
    toAct: seat,
    currentTrick: opts.trick ?? [],
    completedTricks: [],
    tricksNS: 0,
    tricksEW: 0,
  }
}

describe('utspel – topp av sekvens, annars lågt från längsta', () => {
  it('KQJ i längsta färgen → spelar ut K (topp av sekvens)', () => {
    const hand: Hand = [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '5'), C('spades', '2'), C('hearts', 'A'), C('hearts', '8')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('spades', 'K'))
  })

  it('QJ10 → spelar ut Q (cheapest topp-sekvens med honnör)', () => {
    const hand: Hand = [C('diamonds', 'Q'), C('diamonds', 'J'), C('diamonds', '10'), C('diamonds', '3'), C('clubs', 'A')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('diamonds', 'Q'))
  })

  it('längsta färgen utan sekvens → lågt (4th-best-ish, ej honnör)', () => {
    const hand: Hand = [C('hearts', 'A'), C('hearts', '8'), C('hearts', '7'), C('hearts', '6'), C('hearts', '5'), C('spades', 'K'), C('spades', 'Q')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('hearts', '5'))
  })

  it('jämn 4-korts utan honnör (7654) → 3:e bästa (§8.3), ej honnörssekvens', () => {
    const hand: Hand = [C('clubs', '7'), C('clubs', '6'), C('clubs', '5'), C('clubs', '4'), C('diamonds', 'A')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('clubs', '5'))
  })
})

describe('andra hand lågt', () => {
  it('motståndaren leder, bot näst på tur med Kx → lägger lågt, inte K', () => {
    // V leder hjärter 5; N (andra hand, motståndare till V) följer.
    const s = state({
      seat: 'N',
      leader: 'W',
      trick: [{ seat: 'W', card: C('hearts', '5') }],
      hand: [C('hearts', 'K'), C('hearts', '3')],
    })
    expect(botCard(s, 'N')).toEqual(C('hearts', '3'))
  })
})

describe('tredje hand – vinn billigast', () => {
  it('partnern leder, motståndaren övertar, 3:e hand vinner med billigaste vinnaren', () => {
    // S leder H4 (partner till N), V lägger H9 (övertar), N (3:e hand) på tur.
    const s = state({
      seat: 'N',
      leader: 'S',
      trick: [
        { seat: 'S', card: C('hearts', '4') },
        { seat: 'W', card: C('hearts', '9') },
      ],
      hand: [C('hearts', 'K'), C('hearts', 'Q'), C('hearts', '2')],
    })
    expect(botCard(s, 'N')).toEqual(C('hearts', 'Q')) // billigaste kortet som slår 9
  })
})

describe('aldrig ruffa partnerns vinnande stick', () => {
  it('partnern leder ess och vinner; renons → kastar lågt sidokort, ruffar inte', () => {
    // Trumf = spader. S spelar HA (vinner), V lägger H2. N renons i hjärter med
    // trumf S2 + klöver C3 → ska kasta C3, inte trumfa partnerns vinnare.
    const s = state({
      seat: 'N',
      trump: 'spades',
      leader: 'S',
      trick: [
        { seat: 'S', card: C('hearts', 'A') },
        { seat: 'W', card: C('hearts', '2') },
      ],
      hand: [C('spades', '2'), C('clubs', '3')],
    })
    expect(botCard(s, 'N')).toEqual(C('clubs', '3'))
  })
})
