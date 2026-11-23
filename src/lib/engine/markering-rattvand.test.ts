// FACIT FÖRE FIX — markeringarna är RÄTTVÄNDA (ägarbeslut 2026-11-23).
//
// Boken (§8.1) och bottarna spelade omvänd markering sedan 2026-06-26. Ägaren:
// "detta har varit helt fel — vi skall lägga högt för att uppmuntra och lågt för
// att avskräcka." Samma dag:
//   • ATTITYD: högt = uppmuntrar, lågt = avskräcker (sang och trumf).
//   • RÄKNING: högt-lågt = jämnt antal, lågt-högt = udda.
//   • Lavinthal-saken är orörd (högt = den högre färgen).
//   • I sang uppmuntrar man på partnerns honnörsutspel även med LÄNGD (fyra kort
//     eller fler) — ♣kn-6-4-3-2 mot partnerns ♣A lägger sexan (frö 20260828).
//   • Med honnör (dam+) i en färg på tre–fyra kort bär kortet närmast under
//     honnörerna uppmuntran: åttan ur D-8-2. Gardregeln sparade förr de två
//     högsta, och då blev tvåan ("jag avskräcker") enda fria kortet.
//   • Utspel: tian från 10-9-8 och från 10-9-x (topp av sekvens).

import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCardReasoned } from './play-bot'
import type { Contract, PlayedCard, PlayState, Trick } from './play'
import { attitudeCard, countCard, honorLead, leadFromSuit } from './signals'

const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })
const farg = (suit: Suit, ranker: string): Card[] => ranker.split(' ').map((r) => C(suit, r as Rank))
const doneTrick = (winner: Seat = 'W'): Trick => ({ leader: winner, cards: [], winner })

function state(opts: { trump?: Suit | null; hand: Hand; seat: Seat; trick: PlayedCard[]; leader: Seat }): PlayState {
  const trump = opts.trump === undefined ? null : opts.trump
  const contract: Contract = { declarer: 'N', strain: trump ?? 'NT', level: 3 }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
  hands[opts.seat] = opts.hand
  return {
    contract,
    trump,
    hands,
    leader: opts.leader,
    toAct: opts.seat,
    currentTrick: opts.trick,
    completedTricks: [doneTrick(opts.leader)],
    tricksNS: 0,
    tricksEW: 0,
  }
}

/** Väst följer färg på partnern Östs utspel (spelförare Nord, träkarl Syd). */
function pa(utspel: Card, ranker: string, trump: Suit | null = null, sydsKort: Rank = '5') {
  const hand = [...farg(utspel.suit, ranker), C('spades', '7'), C('spades', '4')]
  const st = state({
    trump,
    seat: 'W',
    hand: utspel.suit === 'spades' ? farg('spades', ranker) : hand,
    trick: [{ seat: 'E', card: utspel }, { seat: 'S', card: C(utspel.suit, sydsKort) }],
    leader: 'E',
  })
  return botCardReasoned(st, 'W')
}

describe('kodarna: högt uppmuntrar, högt-lågt visar jämnt', () => {
  it('attityd: uppmuntran = det högsta fria kortet, avskräckning = det lägsta', () => {
    expect(attitudeCard(farg('hearts', '8 4 2'), true).rank).toBe('8')
    expect(attitudeCard(farg('hearts', '8 4 2'), false).rank).toBe('2')
  })
  it('räkning: jämnt antal börjar högt, udda börjar lågt', () => {
    expect(countCard(farg('hearts', '8 4'), true).rank).toBe('8')
    expect(countCard(farg('hearts', '9 5 2'), false).rank).toBe('2')
  })
})

describe('attityd på partnerns utspel', () => {
  it('ägarens kort: ♣kn-6-4-3-2 mot partnerns ♣A i sang → sexan (uppmuntrar med längd)', () => {
    const { card, reason } = pa(C('clubs', 'A'), 'J 6 4 3 2')
    expect(card).toEqual(C('clubs', '6'))
    expect(reason).toContain('uppmuntr')
  })

  it('samma kort i TRUMF: längden blir bara stulen → avskräcker med tvåan', () => {
    const { card } = pa(C('clubs', 'A'), 'J 6 4 3 2', 'hearts')
    expect(card).toEqual(C('clubs', '2'))
  })

  it('fyra hackor mot partnerns HONNÖR i sang uppmuntrar: ♥9-7-3-2 mot ♥K → nian', () => {
    const { card, reason } = pa(C('hearts', 'K'), '9 7 3 2')
    expect(card).toEqual(C('hearts', '9'))
    expect(reason).toContain('uppmuntr')
  })

  it('partnern spelade ut en HACKA: längden uppmuntrar inte → ♥9-7-3-2 lägger tvåan', () => {
    const { card, reason } = pa(C('hearts', '5'), '9 7 3 2', null, 'A')
    expect(card).toEqual(C('hearts', '2'))
    expect(reason).toContain('avskräck')
  })

  it.each([
    ['Q 8 2', '8'],
    ['K 8 2', '8'],
    ['Q 8 4 2', '8'],
    ['K Q 7 3', '7'],
  ])('honnör i kort färg: ♥%s mot partnerns ♥A → %s bär uppmuntran', (ranker, vantat) => {
    const { card, reason } = pa(C('hearts', 'A'), ranker)
    expect(card).toEqual(C('hearts', vantat as Rank))
    expect(reason).toContain('uppmuntr')
  })

  it('tian offras aldrig för en markering: ♥D-10-2 → tvåan', () => {
    expect(pa(C('hearts', 'A'), 'Q 10 2').card).toEqual(C('hearts', '2'))
  })

  it.each([
    ['J 8 2', '2'],
    ['10 8 2', '2'],
    ['8 5 3', '3'],
  ])('utan dam eller högre i tre kort: ♥%s avskräcker med %s (garden ligger kvar)', (ranker, vantat) => {
    expect(pa(C('hearts', 'A'), ranker).card).toEqual(C('hearts', vantat as Rank))
  })

  it('dubbelton i trumfkontrakt: ♥8-4 mot partnerns ♥A → åttan (högt-lågt, vill stjäla)', () => {
    const { card, reason } = pa(C('hearts', 'A'), '8 4', 'spades', '2')
    expect(card).toEqual(C('hearts', '8'))
    expect(reason).toContain('uppmuntr')
  })
})

describe('räkning på motståndarens färg', () => {
  // Spelföraren Nord spelar ut, Öst och Syd har lagt, Väst följer.
  const pa2 = (ranker: string) =>
    botCardReasoned(
      state({
        seat: 'W',
        hand: [...farg('diamonds', ranker), C('spades', '7'), C('spades', '4')],
        trick: [
          { seat: 'N', card: C('diamonds', 'K') },
          { seat: 'E', card: C('diamonds', '3') },
          { seat: 'S', card: C('diamonds', '6') },
        ],
        leader: 'N',
      }),
      'W',
    )

  it('jämnt antal börjar HÖGT: ♦8-4 → åttan', () => {
    const { card, reason } = pa2('8 4')
    expect(card).toEqual(C('diamonds', '8'))
    expect(reason).toContain('JÄMNT')
  })

  it('udda antal börjar LÅGT: ♦9-5-2 → tvåan', () => {
    const { card, reason } = pa2('9 5 2')
    expect(card).toEqual(C('diamonds', '2'))
    expect(reason).toContain('UDDA')
  })
})

describe('utspel: tian är topp av sekvens', () => {
  it('10-9-8 → tian', () => {
    expect(honorLead(farg('spades', '10 9 8'))?.rank).toBe('10')
  })
  it('10-9-x → tian, även med fyra kort', () => {
    expect(leadFromSuit(farg('spades', '10 9 4')).rank).toBe('10')
    expect(leadFromSuit(farg('spades', '10 9 4 2')).rank).toBe('10')
  })
  it('10-8-7 är ingen sekvens: hackutspel som förut (lägsta från udda längd)', () => {
    expect(honorLead(farg('spades', '10 8 7'))).toBeNull()
    expect(leadFromSuit(farg('spades', '10 8 7')).rank).toBe('7')
  })
})
