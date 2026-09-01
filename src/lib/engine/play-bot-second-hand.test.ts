// Speldiagnosen 2026-09-01, fynd 2 — ANDRA HAND ÄR INTE BLIND FÖR BORDET.
// FACIT FÖRE FIX. Två lås:
//
//  1. DDS-verifierat mekanismslut: spelföraren leder lågt i trumf, andra hand
//     (försvaret) håller K9, träkarlen (som spelar EFTER mig, synlig) har bara
//     ♥T och partnern har VISAT renons i trumfen (show-out i ett tidigare
//     stick). Kryper jag ("andra hand lågt") vinner bordets ♥T gratis och min
//     kung dör senare under esset. Går jag upp med kungen vinner han sticket
//     GARANTERAT — allt räknat på ärlig information: det ledda kortet, bordets
//     synliga kort och partnerns visade renons.
//
//  2. Själva speldiagnos-fröet 20260826 (2♥X av Öst): stick 4 leder Öst ♥2,
//     Syd sitter med ♥K9, bordets ensamma ♥T ligger synligt och Nord visade
//     hjärterrenons i stick 3. Före fixen kröp Syd med ♥9 ("andra hand lågt")
//     och lät ♥T vinna — DD-flaggan 2 stick. Efter fixen går Syd upp med ♥K.
//
// Repro av hela given: DUMP_SPEL=20260826 npx vitest run src/lib/engine/speldump.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { botCardReasoned } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type PlayState } from './play'

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
const kort = (s: string): Card => parse(s)[0]

describe('Fynd 2 — andra hand ser bordet (mekanismslutet)', () => {
  // 3-kortsslut, hjärter trumf, Öst spelförare (träkarl Väst). Nord har visat
  // hjärterrenons i det avslutade sticket (la ♣2 på hjärterledning).
  const ending: PlayState = {
    contract: { declarer: 'E', strain: 'hearts', level: 2 },
    trump: 'hearts',
    hands: {
      E: parse('H2 HA D4'), // spelförare: leder ♥2, esset kvar
      S: parse('HK H9 D8'), // andra hand: K9 — kungen vinner sticket garanterat
      W: parse('HT D2 D3'), // träkarl (spelar efter mig): bara ♥T i trumfen
      N: parse('DA DK DQ'), // partnern: VISAT renons i trumf (sticket nedan)
    } as Record<Seat, Card[]>,
    leader: 'E',
    toAct: 'E',
    currentTrick: [],
    completedTricks: [
      {
        leader: 'E',
        cards: [
          { seat: 'E', card: H('Q') },
          { seat: 'S', card: H('5') },
          { seat: 'W', card: H('4') },
          { seat: 'N', card: kort('C2') }, // show-out: Nord renons i trumf
        ],
        winner: 'E',
      },
    ],
    tricksNS: 0,
    tricksEW: 1,
  }

  /** Läget efter Östs ♥2 — Syd är andra hand. */
  function atSecondHand(): PlayState {
    return playCard(ending, H('2'))
  }

  it('DDS mekanism-lås: kungen upp håller spelföraren till 1, krypa släpper 2', () => {
    const s = atSecondHand()
    const declTricks = (c: Card) => {
      const t = playCard(s, c)
      return doubleDummyDeclarerRemaining(t.hands, 'hearts', 'E', t.currentTrick, t.toAct, Infinity)
    }
    expect(declTricks(H('K'))).toBe(1) // upp med kungen: bara essruffen kvar
    expect(declTricks(H('9'))).toBe(2) // krypa: ♥T vinner OCH esset fångar kungen
  })

  it('andra hand går upp med kungen när bordet annars vinner och partnern är renons', () => {
    const s = atSecondHand()
    expect(botCardReasoned(s, 'S').card).toEqual(H('K'))
  })
})

describe('Fynd 2 — speldiagnos-fröet 20260826 (2♥X av Öst, stick 4)', () => {
  const deal = {
    hands: {
      N: parse('SQ SJ ST S8 S6 S5 H3 DA DT D6 CA CT C4'),
      E: parse('SA S2 HA HQ HJ H6 H2 DK D5 D4 D3 CQ C9'),
      S: parse('SK S9 HK H9 H8 H5 DJ D7 CK CJ C6 C3 C2'),
      W: parse('S7 S4 S3 HT H7 H4 DQ D9 D8 D2 C8 C7 C5'),
    } as Record<Seat, Card[]>,
  }

  function framTillStick4(): PlayState {
    let s = startPlay(deal as never, { declarer: 'E', strain: 'hearts', level: 2, doubled: 'X' })
    // Stick 1–3 exakt som i speldumpen.
    for (const c of ['SK', 'S3', 'S5', 'SA', 'HA', 'H5', 'H4', 'H3', 'HQ', 'H8', 'H7', 'C4']) {
      s = playCard(s, kort(c))
    }
    // Stick 4: Öst leder ♥2 — Syd (♥K9 kvar) är andra hand, bordets ♥T synlig,
    // Nord visade hjärterrenons i stick 3.
    return playCard(s, H('2'))
  }

  it('Syd går upp med ♥K i stället för att krypa med ♥9', () => {
    const s = framTillStick4()
    expect(s.toAct).toBe('S')
    expect(botCardReasoned(s, 'S').card).toEqual(H('K'))
  })
})
