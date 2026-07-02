// Felrapporten från Spela kort: formatet är KONTRAKTET mellan appen och
// kommandot /felrapporter. Testerna låser att en giv överlever rundresan
// hand → rapporttext → parseHand, så en rapporterad giv alltid kan
// återskapas exakt som test (FACIT FÖRE FIX).

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Hand } from '../types/bridge'
import { parseHand, type ResolvedCall } from './bidding'
import type { Contract, Trick } from './engine/play'
import {
  buildIssueBody,
  buildIssueTitle,
  felrapportUrl,
  formatHand,
  type FelrapportInput,
} from './felrapport'

const HAND_TEXT = {
  N: 'S:AKQ4 H:32 D:QJ2 C:T987',
  E: 'S:JT9 H:QJT9 D:T98 C:654',
  S: 'S:8765 H:AK54 D:AK7 C:AK',
  W: 'S:32 H:876 D:6543 C:QJ32',
} as const

const deal: Deal = {
  id: 'test-giv',
  board: 5,
  dealer: 'N',
  vulnerability: 'ns',
  hands: {
    N: parseHand(HAND_TEXT.N),
    E: parseHand(HAND_TEXT.E),
    S: parseHand(HAND_TEXT.S),
    W: parseHand(HAND_TEXT.W),
  },
}

const calls: ResolvedCall[] = [
  { seat: 'N', bid: '1NT' },
  { seat: 'E', bid: 'P' },
  { seat: 'S', bid: '3NT' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: 'P' },
]

const contract: Contract = { declarer: 'N', strain: 'NT', level: 3 }

const trick: Trick = {
  leader: 'E',
  cards: [
    { seat: 'E', card: { suit: 'hearts', rank: 'Q' } },
    { seat: 'S', card: { suit: 'hearts', rank: 'K' } },
    { seat: 'W', card: { suit: 'hearts', rank: '6' } },
    { seat: 'N', card: { suit: 'hearts', rank: '2' } },
  ],
  winner: 'S',
}

const input: FelrapportInput = {
  deal,
  calls,
  contract,
  tricks: [trick],
  category: 'Felaktig budgivning',
  description: 'Nord borde inte öppnat 1NT.',
}

function sortedCards(hand: Hand): string[] {
  return hand.map((c: Card) => `${c.suit}-${c.rank}`).sort()
}

describe('formatHand', () => {
  it('gör rundresan text → kort → text oförändrad (T för tia, - för renons)', () => {
    for (const text of Object.values(HAND_TEXT)) {
      expect(formatHand(parseHand(text))).toBe(text)
    }
    expect(formatHand(parseHand('S:AKQJT98765432 H:- D:- C:-'))).toBe('S:AKQJT98765432 H:- D:- C:-')
  })

  it('sorterar korten högst först oavsett inordning', () => {
    expect(formatHand(parseHand('S:4QAK H:23 D:2JQ C:789T'))).toBe(HAND_TEXT.N)
  })
})

describe('buildIssueBody', () => {
  const body = buildIssueBody(input)

  it('innehåller alla fyra händerna maskinläsbart, och de överlever rundresan', () => {
    for (const [seat, text] of Object.entries(HAND_TEXT)) {
      expect(body).toContain(`hand ${seat}: ${text}`)
      const line = body.split('\n').find((l) => l.startsWith(`hand ${seat}: `))!
      const roundTripped = parseHand(line.slice(`hand ${seat}: `.length))
      expect(sortedCards(roundTripped)).toEqual(sortedCards(deal.hands[seat as keyof typeof HAND_TEXT]))
    }
  })

  it('innehåller giv-fakta, budgivningen, kontraktet och sticken', () => {
    expect(body).toContain('bricka: 5')
    expect(body).toContain('giv: N')
    expect(body).toContain('zon: ns')
    expect(body).toContain('budgivning: 1NT P 3NT P P P')
    expect(body).toContain('kontrakt: 3NT N')
    expect(body).toContain('stick 1: E HQ HK H6 H2 (S)')
  })

  it('innehåller kategori + fritext för människan', () => {
    expect(body).toContain('**Kategori:** Felaktig budgivning')
    expect(body).toContain('Nord borde inte öppnat 1NT.')
  })

  it('utpassad giv rapporteras utan kontrakt och stick', () => {
    const passedOut = buildIssueBody({ ...input, contract: null, tricks: [] })
    expect(passedOut).toContain('kontrakt: utpassad')
    expect(passedOut).not.toContain('stick 1:')
    expect(buildIssueTitle({ ...input, contract: null, tricks: [] })).toContain('utpassad')
  })
})

describe('felrapportUrl', () => {
  it('pekar på rätt repo med etiketten felrapport och hela rapporten i adressen', () => {
    const url = felrapportUrl(input)
    expect(url.startsWith('https://github.com/PGreen90/Learn-Bridge/issues/new?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('labels')).toBe('felrapport')
    expect(params.get('title')).toBe(buildIssueTitle(input))
    expect(params.get('body')).toBe(buildIssueBody(input))
  })
})
