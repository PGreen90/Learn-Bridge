// FACIT FÖRE FIX — speldiagnosens fynd D (frö 20260907), ägarbeslut 2026-10-06
// ur bevaka-översynen: den som vinner första sticket i partnerns utspelsfärg
// FORTSÄTTER INTE färgen när spelföraren visat stopp och längd i den via
// budgivningen och partnerns utspelskort är en hög hacka utan positivt sak.
// Försvaret letar i stället efter motståndarnas svaghet (ägarens ord:
// "ALLA skall ta hänsyn till budgivningen … rör inte hjärter, detta kan vara
// motståndarnas långa färg").
//
// Given: Öst öppnade 1♥, Syd dubblade starkt och bjöd 2NT "med stopp i deras
// färg" (20–21). Väst spelade ut ♥9 (singel, partnerns färg), Öst tog ♥A bakom
// träkarlens ♥72. I stick 2 fortsatte Öst med ♥6 in i Syds ♥KQT43 — det kostade
// ett stick. Double-dummy efter stick 1 (doubleDummyDeclarerRemaining, kommandot
// i it.todo nedan): hjärter lågt ger Syd 9 stick, ♠K/♠Q/klöver håller Syd på 8.
// Ägarens linje: ♠K sedan ♠Q (Syd duckar första gången, esset faller andra),
// Västs ♠JT9xx blir fria och ♣K är ingången.
//
// Hp räknade med kod (hcp/parseHand): N 3 · E 14 · S 19 · W 4 = 40.
//
// Testet är `it.todo` tills regeln byggs (speldiagnosens nästa runda, med
// DD-mätning per alternativ enligt S6-metoden) — byt till `it` när den landar.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botCardSmartReasoned } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const H = (r: Rank): Card => ({ suit: 'hearts', rank: r })

const deal: Deal = {
  id: 'fynd-d-20260907',
  board: 16,
  dealer: 'W',
  vulnerability: 'ew',
  hands: {
    N: parseHand('S:8764 H:72 D:JT852 C:Q8'),
    E: parseHand('S:KQ H:AJ865 D:A97 C:T96'),
    S: parseHand('S:A3 H:KQT43 D:KQ6 C:AJ2'),
    W: parseHand('S:JT952 H:9 D:43 C:K7543'),
  },
}

const calls: ResolvedCall[] = [
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: '1H' },
  { seat: 'S', bid: 'X' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: '2D' },
  { seat: 'E', bid: 'P' },
  { seat: 'S', bid: '2NT' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: 'P' },
]

const contract: Contract = { declarer: 'S', strain: 'NT', level: 2 }

/** Läget efter stick 1 som det spelades: W ♥9, N ♥2, E ♥A, S ♥3 — Öst på lead. */
function efterStickEtt(): PlayState {
  let s = startPlay(deal, contract)
  for (const r of ['9', '2', 'A', '3'] as Rank[]) s = playCard(s, H(r))
  return s
}

describe('Fynd D (frö 20260907) — byt färg när spelföraren visat längd i utspelsfärgen', () => {
  it.todo('Öst fortsätter INTE hjärter i stick 2 efter ♥A — väljer ♠K (motståndarnas svaghet)', () => {
    const s = efterStickEtt()
    expect(s.toAct).toBe('E')
    const val = botCardSmartReasoned(s, 'E', calls)
    expect(val.card.suit).not.toBe('hearts')
    expect(val.card).toEqual({ suit: 'spades', rank: 'K' } satisfies Card)
  })

  it.todo('DD-lås: hjärter lågt i stick 2 ger Syd 9 stick, ♠K håller Syd på 8', () => {
    // Kör: npx vitest run src/lib/engine/play-bot-byt-farg.test.ts (cirka en minut per kort).
    const s = efterStickEtt()
    const stick = (card: Card) => {
      const hands = { ...s.hands, E: s.hands.E.filter((c) => c !== card && !(c.suit === card.suit && c.rank === card.rank)) } as Record<Seat, Card[]>
      return doubleDummyDeclarerRemaining(hands, 'NT', 'S', [{ seat: 'E', card }], 'S', 50_000_000)
    }
    expect(stick(H('6'))).toBe(9)
    expect(stick({ suit: 'spades' as Suit, rank: 'K' })).toBe(8)
  })
})
