// Felrapport #34 – försvaret spelar TREDJE HAND HÖGT (§8.6, docs/bot-hjarna.md).
// FACIT FÖRE FIX. Två lås:
//
//  1. En DDS-verifierad klassisk finessställning: träkarlen lågt, spelföraren
//     håller knekten (finess-kortet), försvarets K/D delade. Spelar 3:e hand
//     LÅGT stjäl spelförarens knekt ett stick (fri finess) → spelföraren 2;
//     spelar 3:e hand HÖGT (kungen) dör knekten under damen → spelföraren 1.
//     Tumregeln före fixen la det billigaste vinnande spotkortet (♥7) och skänkte
//     bort sticket – precis buggen i #34 (Nord la ♥5 under partnerns utspel).
//
//  2. Själva felrapportens giv: 1NT av Öst, Syd spelar ut ♥3, träkarlen (Väst)
//     ♥4 – Nord satt med ♥KJ1065 och la ♥5 i stället för en honnör. Efter fixen
//     lägger Nord kungen (tredje hand högt), aldrig ett lågt spotkort.

import { describe, expect, it } from 'vitest'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { botCardReasoned, botCardSmart } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const parse = (s: string): Card[] => {
  const out: Card[] = []
  for (const part of s.split(' ')) {
    const suit = SUIT[part[0]]
    for (const ch of part.slice(1)) out.push({ suit, rank: (ch === 'T' ? '10' : ch) as Rank })
  }
  return out
}
const H = (r: Rank): Card => ({ suit: 'hearts', rank: r })

describe('Felrapport #34 – tredje hand högt (§8.6)', () => {
  // 3-korts hjärterslutspel, Syd spelförare i sang, Väst (partnern) på utspel.
  const ending: PlayState = {
    contract: { declarer: 'S', strain: 'NT', level: 1 },
    trump: null,
    hands: {
      W: parse('HQ62'), // partnern (utspelare)
      N: parse('H543'), // träkarl – bara hackor
      E: parse('HK97'), // 3:e hand: kungen bakom knekten
      S: parse('HAJ8'), // spelförare (dold), håller finess-knekten
    } as Record<Seat, Card[]>,
    leader: 'W',
    toAct: 'W',
    currentTrick: [],
    completedTricks: [],
    tricksNS: 0,
    tricksEW: 0,
  }

  /** Läget efter Väst ♥2 (lågt utspel) och Nord ♥4 (träkarl lågt) – Öst 3:e hand. */
  function atThirdHand(): PlayState {
    let s = ending
    s = playCard(s, H('2')) // Väst leder lågt
    s = playCard(s, H('4')) // träkarlen lägger lågt (slår ♥2 → motståndaren vinner just nu)
    return s
  }

  it('DDS mekanism-lås: 3:e hand HÖGT håller spelföraren till 1, LÅGT släpper 2', () => {
    const s = atThirdHand()
    const declTricks = (c: Card) => {
      const t = playCard(s, c)
      return doubleDummyDeclarerRemaining(t.hands, 'NT', 'S', t.currentTrick, t.toAct, Infinity)
    }
    expect(declTricks(H('K'))).toBe(1) // tredje hand högt: knekten dör → 1 stick
    expect(declTricks(H('9'))).toBe(2) // tredje hand lågt: fri finess → 2 stick
    expect(declTricks(H('7'))).toBe(2) // (det gamla tumregel-valet – billigaste vinnaren)
  })

  it('tumregeln spelar tredje hand HÖGT (kungen), inte ett lågt spotkort', () => {
    const s = atThirdHand()
    expect(botCardReasoned(s, 'E').card).toEqual(H('K'))
  })

  // Själva felrapporten: 1NT av Öst, given nedan.
  const deal = {
    hands: {
      N: parse('SK3 HKJT65 DAQ9 CT52'),
      E: parse('SAJ52 HA9 DK765 CKJ7'),
      S: parse('SQ6 H8732 DT842 CQ94'),
      W: parse('ST9874 HQ4 DJ3 CA863'),
    } as Record<Seat, Card[]>,
  }
  const contract: Contract = { declarer: 'E', strain: 'NT', level: 1 }

  /** Trick 1 i felrapporten: Syd ♥3, Väst (träkarl) ♥4 – Nord 3:e hand. */
  function reportThirdHand(): PlayState {
    let s = startPlay(deal as any, contract)
    s = playCard(s, H('3')) // Syd (partnern) leder ♥3
    s = playCard(s, H('4')) // Väst (träkarl) lägger ♥4 – slår ♥3
    return s
  }

  it('felrapportens giv: Nord lägger en honnör (tredje hand högt), inte ♥5', () => {
    const s = reportThirdHand()
    const pick = botCardReasoned(s, 'N').card
    expect(pick.suit).toBe('hearts')
    expect(['K', 'J', '10']).toContain(pick.rank) // en honnör – aldrig lågt (♥5 var buggen)
  })

  it('SKARPA boten (som appen kör) lägger också en honnör vid 13 kort', () => {
    // 13 kort ligger över Monte-Carlo-fönstret (≤8) → samma tumregel-lager.
    const s = reportThirdHand()
    const pick = botCardSmart(s, 'N', [])
    expect(pick.suit).toBe('hearts')
    expect(['K', 'J', '10']).toContain(pick.rank)
  })
})
