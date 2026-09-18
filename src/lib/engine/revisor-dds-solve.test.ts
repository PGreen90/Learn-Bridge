// Låser SolveBoardPBN-adapterns konventioner (tredje-hand-riggen, NU 2026-09-18)
// — odokumenterade i bridge-dds typer, så de spikas EMPIRISKT här innan proben
// (tredjehand.probe) får bygga på dem:
//   • pågående stick encodas som currentTrickSuit/Rank i lagd ordning, `first` =
//     sticket ledare, remainCards = korten som ÄNNU ligger på händerna,
//   • score = återstående stick (inkl. det pågående) för SIDAN VID DRAGET,
//   • `equals`-masken expanderas så VARJE lagligt kort får en poäng.
// Facit: felrapport #75-läget (4♦ av Öst, Nord vid draget i stick 3) där appens
// egen lösare redan gav spelföraren 7 kvar efter ♥K och 8 efter ♥7 — dvs. Nords
// sida (11 stick kvar) tar 4 resp. 3.

import { describe, expect, it } from 'vitest'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { playCard, startPlay, type Contract } from './play'
import { getDds, solveAllCards, stateToSolvePbn } from './revisor-dds'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const parse = (s: string): Card[] => {
  const out: Card[] = []
  for (const part of s.split(' ')) {
    const suit = SUIT[part[0]]
    for (const ch of part.slice(1)) out.push({ suit, rank: (ch === 'T' ? '10' : ch) as Rank })
  }
  return out
}
const C = (suit: Suit, r: Rank): Card => ({ suit, rank: r })

const deal = {
  hands: {
    N: parse('S8 HK754 DQ72 CKJ652'),
    E: parse('SQJT4 HJ DT98654 C43'),
    S: parse('SK97632 HT32 DAJ3 C7'),
    W: parse('SA5 HAQ986 DK CAQT98'),
  } as Record<Seat, Card[]>,
}
const contract: Contract = { declarer: 'E', strain: 'diamonds', level: 4 }

/** Samma ställning som play-bot-third-hand.test.ts "Felrapport #75": Nord 3:e hand. */
function atNordThirdHand() {
  let s = startPlay(deal as any, contract)
  for (const c of ['7', '8', 'J', '3'] as Rank[]) s = playCard(s, C('clubs', c)) // stick 1
  s = playCard(s, C('clubs', '5')); s = playCard(s, C('clubs', '4'))
  s = playCard(s, C('diamonds', '3')); s = playCard(s, C('clubs', '9')) // stick 2
  s = playCard(s, C('hearts', '2')); s = playCard(s, C('hearts', '6')) // stick 3: S ♥2, V ♥6
  return s
}

describe('SolveBoardPBN-adaptern (revisor-dds-solve)', () => {
  it('stateToSolvePbn: trumf, ledare, korten på bordet i ordning, kvarvarande kort', () => {
    const pbn = stateToSolvePbn(atNordThirdHand())
    expect(pbn.trump).toBe(2) // ♦
    expect(pbn.first).toBe(2) // Syd ledde sticket
    expect(pbn.currentTrickSuit).toEqual([1, 1]) // ♥, ♥
    expect(pbn.currentTrickRank).toEqual([2, 6]) // ♥2, ♥6
    // Nords kvarvarande kort: ♠8 ♥K754 ♦Q72 ♣K62 (♣J och ♣5 är spelade).
    expect(pbn.remainCards.startsWith('N:8.K754.Q72.K62 ')).toBe(true)
  })

  it('score = sidan vid dragets återstående stick; ♥K → 4, ♥7 → 3 (#75-facit)', async () => {
    const dds = await getDds()
    const poang = solveAllCards(dds, atNordThirdHand())
    const score = (r: Rank) => poang.find((p) => p.card.suit === 'hearts' && p.card.rank === r)?.score
    // Nord måste följa hjärter: alla fyra korten ska ha en poäng (equals expanderad).
    expect(poang.map((p) => p.card.rank).sort()).toEqual(['4', '5', '7', 'K'])
    expect(score('K')).toBe(4) // spelföraren 7 av 11 kvar → Nords sida 4
    expect(score('7')).toBe(3) // spelföraren 8 av 11 kvar → Nords sida 3
    expect(score('5')).toBe(3)
    expect(score('4')).toBe(3)
  })
})
