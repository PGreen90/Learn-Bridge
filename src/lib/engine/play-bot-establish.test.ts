// Felrapport #32 – spelföraren etablerar lång färg (docs/bot-hjarna.md,
// "förberedelsen vid 9–13 kort"). FACIT FÖRE FIX: en DDS-verifierad position där
// spelförarsidan har en lång färg (♦KQJT9) som behöver en spärr utknackad, och
// tre sidoess som BÅDE stoppar motståndarnas honnörer OCH är entréer.
//
// Rätt spel: knäck ♦A GENAST, medan essen håller, så rutern rullar → 7 stick.
// Felet: casha ♠A/♥A/♣A först → när ♦A sen knäcks är motståndarnas ♠K/♥K/♣KQJ10
// alla goda → försvaret rullar hem → bara 3 stick. Felet sker vid 11→9 kort,
// OVANFÖR Monte-Carlo-fönstret (≤8), så MC hinner inte laga en redan förstörd
// position – det är därför tumregel-lagret måste kunna planera.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCard, botCardReasoned, botCardSmart } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { isComplete, playCard, startPlay, side, type Contract, type PlayState, type Trick } from './play'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const C = (s: Suit, r: Rank): Card => ({ suit: s, rank: r })
const key = (c: Card) => `${c.suit}${c.rank}`

function fullDeck(): Card[] {
  const out: Card[] = []
  for (const s of SUITS) for (const r of RANKS) out.push({ suit: s, rank: r })
  return out
}

/** Slutläge med `live` som återstående kort; resten fylls i som färdiga stick
 * (samma teknik som play-bot-technique.test.ts). Syd leder första fyllnadssticket
 * så signalavkodningen aldrig läser ett fabricerat "utspel" från dold plats. */
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
    const remaining = (['S', 'N', 'E', 'W'] as Seat[]).filter((s) => !cards.some((pc) => pc.seat === s))
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

/** Deterministisk PRNG (mulberry32) – samma stabilisering som teknik-testerna. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function playOut(start: PlayState, pick: (s: PlayState) => Card): number {
  let s = start
  while (!isComplete(s)) s = playCard(s, pick(s))
  return side(start.contract.declarer) === 'NS' ? s.tricksNS : s.tricksEW
}

describe('Felrapport #32 – spelföraren etablerar lång färg före cashandet', () => {
  afterEach(() => vi.restoreAllMocks())

  // 11-korts NT-slutspel, Syd spelförare & på lead.
  const live: Record<Seat, Hand> = {
    S: [C('diamonds','K'),C('diamonds','Q'),C('diamonds','J'),C('diamonds','10'),C('diamonds','9'),C('spades','A'),C('spades','2'),C('hearts','A'),C('hearts','4'),C('clubs','A'),C('clubs','4')],
    N: [C('diamonds','2'),C('diamonds','3'),C('spades','3'),C('spades','4'),C('spades','5'),C('hearts','2'),C('hearts','3'),C('hearts','5'),C('clubs','2'),C('clubs','3'),C('clubs','5')],
    W: [C('diamonds','A'),C('clubs','K'),C('clubs','Q'),C('clubs','J'),C('clubs','10'),C('spades','K'),C('spades','Q'),C('spades','6'),C('hearts','K'),C('hearts','Q'),C('hearts','6')],
    E: [C('spades','J'),C('spades','10'),C('spades','9'),C('hearts','J'),C('hearts','10'),C('hearts','9'),C('diamonds','8'),C('diamonds','7'),C('diamonds','6'),C('clubs','9'),C('clubs','6')],
  }

  it('sanity: de fyra levande händerna är 44 unika kort', () => {
    const all = Object.values(live).flat()
    expect(all.length).toBe(44)
    expect(new Set(all.map(key)).size).toBe(44)
  })

  it('DDS-facit: positionen ger 7 av 11 med perfekt spel', () => {
    const start = fabricate(live, 'S', 'NT', 'S')
    expect(doubleDummyDeclarerRemaining(start.hands, 'NT', 'S', [], 'S', Infinity)).toBe(7)
  })

  it('mekanism-lås: att casha sidoess FÖRE rutern bränner stick (7 → 6 → 4)', () => {
    const ddsAfter = (moves: Card[]): number | null => {
      let s = fabricate(live, 'S', 'NT', 'S')
      for (const m of moves) s = playCard(s, m)
      return doubleDummyDeclarerRemaining(s.hands, 'NT', 'S', s.currentTrick, s.toAct, Infinity)
    }
    // Attackera rutern direkt: facit står kvar.
    expect(ddsAfter([C('diamonds', 'K')])).toBe(7)
    // Casha ett ess först: −1. Casha två ess först: −3. (Väst/Nord/Öst följer lågt.)
    expect(ddsAfter([C('spades','A'),C('spades','6'),C('spades','3'),C('spades','9')])).toBe(6)
    expect(ddsAfter([C('spades','A'),C('spades','6'),C('spades','3'),C('spades','9'),C('hearts','A'),C('hearts','6'),C('hearts','2'),C('hearts','9')])).toBe(4)
  })

  it('tumregeln etablerar rutern och tar minst 6 (var 3 före fixen)', () => {
    const start = fabricate(live, 'S', 'NT', 'S')
    expect(playOut(start, (s) => botCard(s, s.toAct))).toBeGreaterThanOrEqual(6)
  })

  it('SKARPA boten (som appen kör) etablerar rutern och tar minst 6 (var 3 före fixen)', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    const start = fabricate(live, 'S', 'NT', 'S')
    expect(playOut(start, (s) => botCardSmart(s, s.toAct, [], { samples: 60 }))).toBeGreaterThanOrEqual(6)
  }, 60_000)
})

// Felrapport #49 (github.com/PGreen90/Learn-Bridge/issues/49): 2NT av Väst. Väst
// knäckte klöver-A-spärren med ♣K (stick 4) men ÖVERGAV sedan färgen och ledde
// ♠8 rakt in i Nords ♠AQ (stick 5) – i stället för att fortsätta den nyss
// etablerade klöversekvensen ♣QJT. `establishLongSuit`-grinden avstod (spader
// ostoppad) och reservutspelet föll tillbaka på öppningsleddoktrinen "längsta
// färgen" (spader 4 > klöver 3). Facit: spelföraren utvecklar sin SOLIDA
// honnörssekvens (leder ♣Q) i stället för att öppningsleda in i motståndarna.
const P: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const parseHand49 = (s: string): Card[] => {
  const out: Card[] = []
  for (const part of s.split(' ')) {
    const su = P[part[0]]
    for (const ch of part.slice(1)) out.push({ suit: su, rank: (ch === 'T' ? '10' : ch) as Rank })
  }
  return out
}
const K = (r: string, su: string): Card => ({ suit: P[su], rank: (r === 'T' ? '10' : r) as Rank })

describe('Felrapport #49 – spelföraren fortsätter sin klöversekvens (ej ♠ in i AQ)', () => {
  const deal = {
    hands: {
      N: parseHand49('SAQ32 H- DAKT9764 C64'),
      E: parseHand49('ST6 HA7652 D85 C9873'),
      S: parseHand49('SJ54 HQJ9843 D3 CA52'),
      W: parseHand49('SK987 HKT DQJ2 CKQJT'),
    } as Record<Seat, Card[]>,
  }
  const contract: Contract = { declarer: 'W', strain: 'NT', level: 2 }
  // Stick 1–4 exakt som rapporten (spelad ordning per stick).
  const recorded: Card[] = [
    K('A', 'D'), K('5', 'D'), K('3', 'D'), K('2', 'D'),
    K('K', 'D'), K('8', 'D'), K('3', 'H'), K('J', 'D'),
    K('4', 'D'), K('7', 'H'), K('4', 'H'), K('Q', 'D'),
    K('K', 'C'), K('4', 'C'), K('3', 'C'), K('2', 'C'),
  ]

  function atTrick5(): PlayState {
    let s = startPlay(deal as any, contract)
    for (const c of recorded) s = playCard(s, c)
    return s
  }

  it('Väst är inne på stick 5 med ♠K987 ♥KT ♣QJT', () => {
    const s = atTrick5()
    expect(s.toAct).toBe('W')
    expect(s.currentTrick.length).toBe(0)
  })

  it('tumregeln leder en klöver (fortsätter sekvensen), INTE en spader', () => {
    const pick = botCardReasoned(atTrick5(), 'W').card
    expect(pick.suit).toBe('clubs')
    expect(pick.rank).toBe('Q') // toppen av sekvensen QJT
  })

  it('SKARPA boten (appen) leder också klöver vid 9 kort', () => {
    const pick = botCardSmart(atTrick5(), 'W', [])
    expect(pick.suit).toBe('clubs')
  })
})
