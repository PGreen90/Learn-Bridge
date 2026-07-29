// Facit för att BOTTEN LÄGGER markeringar i motspelet (markeringar Steg 1–2).
// Skrivet FÖRE koden. Encoders + säkerhetskärnan (defensiveSignalCard) testas i
// signals*.test.ts; här testas RESOLVERN i play-bot: i vilket läge boten väljer
// attityd (partnerns färg) resp. räkning (motståndarens färg), åt vilket håll,
// och att den håller sig till spare-kort som aldrig kostar ett stick.
//
// Gardregeln (ägarbeslut 2026-07-29, "riktiga markeringar men aldrig en grov
// blunder"): i en färg med 3+ kort behålls mina TVÅ högsta som gardar, och
// markeringen väljs bland resten. Därför signalerar bottarna med fulla färger
// och dubbeltoner men lägger bara lågt (ingen markering) i korta 3-kortsfärger
// där varje kort kan vara en stoppare.

import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCardReasoned } from './play-bot'
import type { Contract, PlayedCard, PlayState, Trick } from './play'

const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })
const doneTrick = (winner: Seat = 'W'): Trick => ({ leader: winner, cards: [], winner })

/** Kortspelsläge för att testa botCardReasoned i en försvarssituation. */
function state(opts: {
  trump?: Suit | null
  hand: Hand
  seat: Seat
  trick?: PlayedCard[]
  leader?: Seat
  completedTricks?: Trick[]
  declarer?: Seat
  otherHands?: Partial<Record<Seat, Hand>>
}): PlayState {
  const trump = opts.trump === undefined ? null : opts.trump
  const contract: Contract = { declarer: opts.declarer ?? 'N', strain: trump ?? 'NT', level: 3 }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [], ...opts.otherHands }
  hands[opts.seat] = opts.hand
  return {
    contract,
    trump,
    hands,
    leader: opts.leader ?? 'W',
    toAct: opts.seat,
    currentTrick: opts.trick ?? [],
    completedTricks: opts.completedTricks ?? [],
    tricksNS: 0,
    tricksEW: 0,
  }
}

// Deklarant N → träkarl S, försvarare Ö/V. Partnern till V är Ö.
describe('Steg 1 – attityd på partnerns utspelsfärg', () => {
  it('uppmuntrar med honnör: partnern ledde ♥K, jag ♥Q842 → lägsta spare ♥2 (garderna ♥Q8 kvar)', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', 'Q'), C('hearts', '8'), C('hearts', '4'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'E', card: C('hearts', 'K') }, { seat: 'S', card: C('hearts', '3') }],
      leader: 'E',
      completedTricks: [doneTrick('E')],
    })
    const { card, reason } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '2'))
    expect(reason).toContain('uppmuntr')
  })

  it('avskräcker utan honnör (sang): partnern ledde ♥K, jag ♥8642 → högsta spare ♥4 (garderna ♥86 kvar)', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '6'), C('hearts', '4'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'E', card: C('hearts', 'K') }, { seat: 'S', card: C('hearts', '3') }],
      leader: 'E',
      completedTricks: [doneTrick('E')],
    })
    const { card, reason } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '4'))
    expect(reason).toContain('avskräck')
  })

  it('uppmuntrar via kort färg i trumfkontrakt: partnern ♥A, jag ♥84 dubbelton → lägsta ♥4', () => {
    const st = state({
      trump: 'spades',
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '4'), C('spades', '7'), C('spades', '5')],
      trick: [{ seat: 'E', card: C('hearts', 'A') }, { seat: 'S', card: C('hearts', '2') }],
      leader: 'E',
      completedTricks: [doneTrick('E')],
    })
    const { card } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '4'))
  })

  it('attityd även när MOTSTÅNDAREN vinner sticket: partnern ledde ♥5, träkarl ♥A vinner, jag ♥9732 avskräcker → ♥3', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', '9'), C('hearts', '7'), C('hearts', '3'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'E', card: C('hearts', '5') }, { seat: 'S', card: C('hearts', 'A') }],
      leader: 'E',
      completedTricks: [doneTrick('E')],
    })
    const { card } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '3'))
  })

  it('kort 3-kortsfärg: garderna äter markeringen → lågt utan signal (♥853 → ♥3)', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '5'), C('hearts', '3'), C('spades', '7')],
      trick: [{ seat: 'E', card: C('hearts', 'K') }, { seat: 'S', card: C('hearts', '2') }],
      leader: 'E',
      completedTricks: [doneTrick('E')],
    })
    const { card, reason } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '3'))
    expect(reason).not.toContain('Markering')
  })

  it('spelförarsidan markerar INTE: träkarlen (spelförarsidan) följer bara lågt → ♥2', () => {
    const st = state({
      declarer: 'E',
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '6'), C('hearts', '4'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'E', card: C('hearts', 'K') }, { seat: 'S', card: C('hearts', '3') }],
      leader: 'E',
      completedTricks: [doneTrick('E')],
    })
    const { card } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '2'))
  })
})

describe('Steg 2 – räkning på motståndarens färg', () => {
  it('andra hand, UDDA antal ♥97532 → högt kort ♥5 (högt-lågt, garderna ♥97 kvar)', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', '9'), C('hearts', '7'), C('hearts', '5'), C('hearts', '3'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'S', card: C('hearts', '4') }],
      leader: 'S',
      completedTricks: [doneTrick('S')],
    })
    const { card, reason } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '5'))
    expect(reason).toContain('UDDA')
  })

  it('andra hand, JÄMNT antal ♥8642 → lågt kort ♥2 (lågt-högt)', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '6'), C('hearts', '4'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'S', card: C('hearts', '5') }],
      leader: 'S',
      completedTricks: [doneTrick('S')],
    })
    const { card, reason } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '2'))
    expect(reason).toContain('JÄMNT')
  })

  it('dubbelton visar JÄMNT (räkning): motståndaren ledde ♥, jag ♥83 → lågt ♥3', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '3'), C('spades', '7'), C('spades', '6')],
      trick: [{ seat: 'S', card: C('hearts', '5') }],
      leader: 'S',
      completedTricks: [doneTrick('S')],
    })
    const { card, reason } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '3'))
    expect(reason).toContain('JÄMNT')
  })

  it('räkning respekterar gardern: ♥K642 jämnt → lägsta spare ♥2 (♥K8… honnör + topp skyddade)', () => {
    const st = state({
      seat: 'W',
      hand: [C('hearts', 'K'), C('hearts', '6'), C('hearts', '4'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'S', card: C('hearts', '5') }],
      leader: 'S',
      completedTricks: [doneTrick('S')],
    })
    const { card } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '2'))
  })

  it('spelförarsidan ger inte räkning: träkarlen andra hand → lägsta ♥2', () => {
    const st = state({
      declarer: 'E',
      seat: 'W',
      hand: [C('hearts', '8'), C('hearts', '6'), C('hearts', '4'), C('hearts', '2'), C('spades', '7')],
      trick: [{ seat: 'N', card: C('hearts', '5') }],
      leader: 'N',
      completedTricks: [doneTrick('N')],
    })
    const { card } = botCardReasoned(st, 'W')
    expect(card).toEqual(C('hearts', '2'))
  })
})

describe('Steg 3 – Lavinthal på första saket', () => {
  // Trumf spader; Öst försvarar och kan inte följa utspelet → sakar klöver.
  // Övriga färger (ej saken klöver, ej trumf spader) = ruter & hjärter.
  it('högt sak ber om den HÖGRE färgen: styrka i hjärter → högsta spare-klöver ♣5 (♣97 gard)', () => {
    const st = state({
      trump: 'spades',
      seat: 'E',
      hand: [
        C('clubs', '9'), C('clubs', '7'), C('clubs', '5'), C('clubs', '3'), C('clubs', '2'),
        C('hearts', 'A'), C('hearts', 'K'), C('spades', '3'),
      ],
      trick: [{ seat: 'N', card: C('diamonds', 'K') }],
      leader: 'N',
      completedTricks: [doneTrick('N')],
    })
    const { card, reason } = botCardReasoned(st, 'E')
    expect(card).toEqual(C('clubs', '5'))
    expect(reason).toContain('högre')
  })

  it('lågt sak ber om den LÄGRE färgen: styrka i ruter → lägsta klöver ♣2', () => {
    const st = state({
      trump: 'spades',
      seat: 'E',
      hand: [
        C('clubs', '9'), C('clubs', '7'), C('clubs', '5'), C('clubs', '3'), C('clubs', '2'),
        C('diamonds', 'A'), C('diamonds', 'K'), C('spades', '3'),
      ],
      trick: [{ seat: 'N', card: C('hearts', 'K') }],
      leader: 'N',
      completedTricks: [doneTrick('N')],
    })
    const { card, reason } = botCardReasoned(st, 'E')
    expect(card).toEqual(C('clubs', '2'))
    expect(reason).toContain('lägre')
  })

  it('bara FÖRSTA saket: har jag redan sakat i given → ingen Lavinthal (lågt)', () => {
    const st = state({
      trump: 'spades',
      seat: 'E',
      hand: [
        C('clubs', '8'), C('clubs', '6'), C('clubs', '3'), C('clubs', '2'),
        C('hearts', 'A'), C('hearts', 'K'), C('hearts', '5'), C('spades', '3'),
      ],
      trick: [{ seat: 'N', card: C('diamonds', 'K') }],
      leader: 'N',
      // Öst har redan sakat en klöver på ett tidigare rutersticke.
      completedTricks: [
        { leader: 'N', cards: [{ seat: 'N', card: C('diamonds', '4') }, { seat: 'E', card: C('clubs', '4') }], winner: 'N' },
      ],
    })
    const { reason } = botCardReasoned(st, 'E')
    expect(reason).not.toContain('§8.2')
  })

  it('spelförarsidan ger inte Lavinthal: träkarlen sakar → ingen §8.2-markering', () => {
    const st = state({
      trump: 'spades',
      declarer: 'E',
      seat: 'W',
      hand: [
        C('clubs', '8'), C('clubs', '6'), C('clubs', '3'), C('clubs', '2'),
        C('hearts', 'A'), C('hearts', 'K'), C('hearts', '5'), C('spades', '3'),
      ],
      trick: [{ seat: 'N', card: C('diamonds', 'K') }],
      leader: 'N',
      completedTricks: [doneTrick('N')],
    })
    const { reason } = botCardReasoned(st, 'W')
    expect(reason).not.toContain('§8.2')
  })
})
