import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { isSureWinner, playedCards, shownVoids, unseenTrumpCount } from './card-counting'
import type { Contract, PlayedCard, PlayState, Trick } from './play'

const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })

function mkState(opts: {
  trump?: Suit | null
  declarer?: Seat
  hands?: Partial<Record<Seat, Hand>>
  currentTrick?: PlayedCard[]
  completedTricks?: Trick[]
  leader?: Seat
  toAct?: Seat
}): PlayState {
  const trump = opts.trump === undefined ? null : opts.trump
  const contract: Contract = { declarer: opts.declarer ?? 'N', strain: trump ?? 'NT', level: 3 }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [], ...opts.hands }
  return {
    contract,
    trump,
    hands,
    leader: opts.leader ?? 'W',
    toAct: opts.toAct ?? 'W',
    currentTrick: opts.currentTrick ?? [],
    completedTricks: opts.completedTricks ?? [],
    tricksNS: 0,
    tricksEW: 0,
  }
}

describe('playedCards – allt som fallit', () => {
  it('räknar avslutade stick + pågående stick', () => {
    const t1: Trick = {
      leader: 'W',
      winner: 'W',
      cards: [
        { seat: 'W', card: C('hearts', 'A') },
        { seat: 'N', card: C('hearts', '2') },
        { seat: 'E', card: C('hearts', '3') },
        { seat: 'S', card: C('hearts', '4') },
      ],
    }
    const cur: PlayedCard[] = [{ seat: 'W', card: C('spades', 'K') }]
    expect(playedCards(mkState({ completedTricks: [t1], currentTrick: cur }))).toHaveLength(5)
  })
})

describe('shownVoids – kända renonser via show-out', () => {
  it('den som inte följer utspelsfärgen är renons i den färgen', () => {
    // V leder hjärter; Ö saknar hjärter (lägger spader) → Ö renons i hjärter.
    const t: Trick = {
      leader: 'W',
      winner: 'W',
      cards: [
        { seat: 'W', card: C('hearts', 'A') },
        { seat: 'N', card: C('hearts', '2') },
        { seat: 'E', card: C('spades', '5') },
        { seat: 'S', card: C('hearts', '4') },
      ],
    }
    const voids = shownVoids(mkState({ completedTricks: [t] }))
    expect(voids.E.has('hearts')).toBe(true)
    expect(voids.N.has('hearts')).toBe(false)
    expect(voids.S.has('hearts')).toBe(false)
  })
})

describe('isSureWinner – inget högre kort ute', () => {
  const played: Card[] = []
  it('A är alltid säker', () => {
    expect(isSureWinner(C('hearts', 'A'), [C('hearts', 'A')], played)).toBe(true)
  })
  it('K är säker om A är på egen hand', () => {
    expect(isSureWinner(C('hearts', 'K'), [C('hearts', 'A'), C('hearts', 'K')], played)).toBe(true)
  })
  it('K är INTE säker om A fortfarande är ute', () => {
    expect(isSureWinner(C('hearts', 'K'), [C('hearts', 'K')], played)).toBe(false)
  })
  it('K blir säker när A redan har spelats', () => {
    expect(isSureWinner(C('hearts', 'K'), [C('hearts', 'K')], [C('hearts', 'A')])).toBe(true)
  })
})

describe('unseenTrumpCount – dolda trumf', () => {
  it('sang → 0 (ingen trumf finns)', () => {
    expect(unseenTrumpCount(mkState({ trump: null, toAct: 'S' }), 'S')).toBe(0)
  })

  it('alla trumf syns i spelförarsidans händer → 0 (ingen kan ruffa)', () => {
    // Spelförare S, träkarl N håller tillsammans alla 13 spader.
    const declHand: Hand = (['A', 'K', 'Q', 'J', '10', '9', '8'] as Rank[]).map((r) => C('spades', r))
    const dummyHand: Hand = (['7', '6', '5', '4', '3', '2'] as Rank[]).map((r) => C('spades', r))
    const s = mkState({ trump: 'spades', declarer: 'S', hands: { S: declHand, N: dummyHand }, toAct: 'S' })
    expect(unseenTrumpCount(s, 'S')).toBe(0)
  })

  it('trumf saknas i de synliga händerna → osedda finns kvar', () => {
    // S ser bara sina egna 2 spader + träkarlens 1 → 3 av 13 sedda, 10 osedda.
    const s = mkState({
      trump: 'spades',
      declarer: 'S',
      hands: { S: [C('spades', '2'), C('spades', '3')], N: [C('spades', '4')] },
      toAct: 'S',
    })
    expect(unseenTrumpCount(s, 'S')).toBe(10)
  })
})
