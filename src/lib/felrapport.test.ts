// Felrapporten från Spela kort: formatet är KONTRAKTET mellan appen och
// kommandot /felrapporter. Testerna låser att en giv överlever rundresan
// hand → rapporttext → parseHand, så en rapporterad giv alltid kan
// återskapas exakt som test (FACIT FÖRE FIX).

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Hand } from '../types/bridge'
import { parseHand, type ResolvedCall } from './bidding'
import type { Contract, Trick } from './engine/play'
import {
  BIDDING_REPORT_CATEGORIES,
  buildIssueBody,
  buildIssueTitle,
  byggRapport,
  FORSLAG_BUD,
  FORSLAG_SPEL,
  formatHand,
  rapportTyp,
  REPORT_CATEGORIES,
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

  // Ägarbeslut 2026-10-06: rapporten har ett eget fält "Rätt bud + varför".
  // Ifyllt = facit för /felrapporter; tomt = tydligt markerat, så kommandot
  // vet att det måste fråga ägaren i stället för att gissa.
  it('skriver "Rätt bud + varför" som egen rad när ägaren fyllt i det', () => {
    const withExpected = buildIssueBody({ ...input, expected: '1♠ – fem spader, 1NT lovar balanserad hand' })
    expect(withExpected).toContain('**Rätt bud + varför:** 1♠ – fem spader, 1NT lovar balanserad hand')
  })

  it('markerar "Rätt bud + varför" som inte angivet när fältet är tomt', () => {
    expect(body).toContain('**Rätt bud + varför:** _(inte angivet)_')
    expect(buildIssueBody({ ...input, expected: '   ' })).toContain('**Rätt bud + varför:** _(inte angivet)_')
  })

  it('utpassad giv rapporteras utan kontrakt och stick', () => {
    const passedOut = buildIssueBody({ ...input, contract: null, tricks: [] })
    expect(passedOut).toContain('kontrakt: utpassad')
    expect(passedOut).not.toContain('stick 1:')
    expect(buildIssueTitle({ ...input, contract: null, tricks: [] })).toContain('utpassad')
  })
})

// Den öppna mottagaren (2026-11-11): rapporten skickas som typ + rubrik + text.
// Typen avgörs av kategorin — fel och förslag får var sin kö hos ägaren.
describe('byggRapport', () => {
  it('ett fel blir typen felrapport med rubriken "Felrapport: …" och hela rapporten som text', () => {
    const r = byggRapport(input)
    expect(r.typ).toBe('felrapport')
    expect(r.titel).toBe(buildIssueTitle(input))
    expect(r.titel.startsWith('Felrapport: ')).toBe(true)
    expect(r.text).toBe(buildIssueBody(input))
  })

  it('förslagskategorierna blir typen forslag med rubriken "Förslag: …" — given följer med ändå', () => {
    for (const category of [FORSLAG_SPEL, FORSLAG_BUD]) {
      const r = byggRapport({ ...input, category })
      expect(r.typ).toBe('forslag')
      expect(r.titel.startsWith('Förslag: ')).toBe(true)
      expect(r.titel).not.toContain('Felrapport')
      expect(r.text).toContain('budgivning: 1NT P 3NT P P P')
    }
  })

  it('förslagen finns som val i båda kategorilistorna', () => {
    expect(REPORT_CATEGORIES).toContain(FORSLAG_SPEL)
    expect(BIDDING_REPORT_CATEGORIES).toContain(FORSLAG_BUD)
    expect(rapportTyp('Annat')).toBe('felrapport')
  })

  it('läget rapporten skrevs i står i texten', () => {
    expect(byggRapport({ ...input, lage: 'Dagens tävling' }).text).toContain('**Läge:** Dagens tävling')
    expect(byggRapport(input).text).toContain('**Läge:** okänt')
  })
})

// Felrapport #58 skickades MITT I budgivningen (sju bud, Syd vid draget) och
// rapporten skrev "given passades ut" / "kontrakt: utpassad" — vilseledande.
// En ofullbordad auktion rapporteras som pågående.
describe('rapport mitt i budgivningen', () => {
  const ongoingCalls: ResolvedCall[] = [
    { seat: 'W', bid: 'P' }, { seat: 'N', bid: '1D' }, { seat: 'E', bid: 'P' },
    { seat: 'S', bid: '2C' }, { seat: 'W', bid: 'P' }, { seat: 'N', bid: '2NT' }, { seat: 'E', bid: 'P' },
  ]
  const ongoing: FelrapportInput = { ...input, calls: ongoingCalls, contract: null, tricks: [] }

  it('märks som pågående, inte utpassad', () => {
    const body = buildIssueBody(ongoing)
    expect(body).toContain('kontrakt: pågår')
    expect(body).toContain('mitt i budgivningen')
    expect(body).not.toContain('passades ut')
    expect(buildIssueTitle(ongoing)).toContain('budgivning pågår')
    expect(buildIssueTitle(ongoing)).not.toContain('utpassad')
  })
})
