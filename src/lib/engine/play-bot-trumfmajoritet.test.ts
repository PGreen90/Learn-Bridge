// Speldiagnosen runda 7 (2026-09-30), fynd A — DRA INTE TRUMF UTAN TRUMFMAJORITET.
// FACIT FÖRE FIX.
//
// Frö 20260786 (2♠ av Nord efter en DONT-rättelse: Nord ♠AT4, träkarlen Syd
// ♠K53 = SEX trumf mot motståndarnas sju). Stick 1: Öst ledde ♠2, Väst ♠Q, Nord
// ♠A. Stick 2 ledde Nord ♠T "jag drar trumf: vår samlade trumf vinner
// styrkeprovet" — DD-flaggan 4 stick (7→3). Styrkeprovet i `shouldDrawTrumps`
// jämförde bara RANGERNA (K,T,5,4 mot J,9,8,7,6 = 2 vinster, 2 förluster →
// "vinner") och glömde LÄNGDEN: med färre trumf än motståndarna kan man aldrig
// dra ut deras — den långa trumfen är deras, och varje varv kostar ett eget
// trumfstick. Regeln: trumf dras bara med fler trumf än de osedda.
//
// Repro av hela given: DUMP_SPEL=20260786 npx vitest run src/lib/engine/speldump.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botCardReasoned } from './play-bot'
import { playCard, startPlay, type PlayState } from './play'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const kort = (s: string): Card => ({ suit: SUIT[s[0]], rank: (s.slice(1) === 'T' ? '10' : s.slice(1)) as Rank })

function dealOf(hands: Record<Seat, string>): Deal {
  return { id: 'trumfmajoritet', dealer: 'W', vulnerability: 'all', board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}

describe('Fynd A — trumf dras bara med trumfmajoritet (frö 20260786)', () => {
  const GIV = dealOf({
    N: 'S:AT4 H:A2 D:43 C:KQJ753',
    E: 'S:J2 H:63 D:AT98652 C:62',
    S: 'S:K53 H:QT9874 D:J7 C:84',
    W: 'S:Q9876 H:KJ5 D:KQ C:AT9',
  })

  /** Läget efter stick 1 (♠2, ♠3, ♠Q, ♠A) — Nord är inne med ♠T4 mot bordets ♠K5, fem trumf osedda. */
  function efterStickEtt(): PlayState {
    let s = startPlay(GIV, { declarer: 'N', strain: 'spades', level: 2 })
    for (const c of ['S2', 'S3', 'SQ', 'SA']) s = playCard(s, kort(c))
    return s
  }

  it('Nord (4 trumf kvar mot 5 osedda) leder INTE trumf i stick 2', () => {
    const s = efterStickEtt()
    expect(s.toAct).toBe('N')
    const val = botCardReasoned(s, 'N')
    expect(val.card.suit).not.toBe('spades')
    expect(val.reason).not.toContain('drar trumf')
  })

  it('kontroll: med trumfmajoritet drar spelföraren fortfarande trumf', () => {
    // Samma giv men Nord–Syd har åtta trumf (♠AT4 + ♠KJ53) mot fem: styrkeprovet
    // OCH längden är på vår sida → dra trumf som förut.
    const giv = dealOf({
      N: 'S:AT4 H:A2 D:43 C:KQJ753',
      E: 'S:2 H:63 D:AT98652 C:J62',
      S: 'S:KJ53 H:QT987 D:J7 C:84',
      W: 'S:Q9876 H:KJ54 D:KQ C:AT9',
    })
    let s = startPlay(giv, { declarer: 'N', strain: 'spades', level: 2 })
    for (const c of ['S2', 'S3', 'SQ', 'SA']) s = playCard(s, kort(c))
    const val = botCardReasoned(s, 'N')
    expect(val.card.suit).toBe('spades')
    expect(val.reason).toContain('drar trumf')
  })
})
