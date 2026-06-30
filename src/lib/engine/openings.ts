// Budmotorns första del: öppningsbudet. Härlett direkt ur systemboken §3
// (öppningsbud + minor-regeln). Funktionen är ren: hand in → bud + förklaring ut.

import type { Bid, Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { startingPoints } from './evaluation'

export interface OpeningResult {
  /** Budet, t.ex. "1S", "1NT", "2C", "P". */
  call: Bid
  /** Kort regelnamn (för statistik/hålfinnare). */
  rule: string
  /** Mening på svenska med hp + form. */
  explanation: string
  /** Sant när motorn är osäker (t.ex. möjligt distributionellt 2♣). */
  uncertain?: boolean
}

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }

/** Räknar ut vad en hand öppnar med i 1:a hand utan störning. */
export function classifyOpening(hand: Hand): OpeningResult {
  const p = hcp(hand)
  const tp = startingPoints(hand).startingPoints
  const len = lengths(hand)
  const bal = isBalanced(hand)

  // Balanserade händer: NT-stegen + stark 2♣.
  if (bal) {
    if (p >= 15 && p <= 17) return { call: '1NT', rule: '1NT', explanation: `Balanserad ${p} hp (15–17) → 1NT.` }
    if (p >= 20 && p <= 21) return { call: '2NT', rule: '2NT', explanation: `Balanserad ${p} hp (20–21) → 2NT.` }
    if (p >= 25 && p <= 27) return { call: '3NT', rule: '3NT', explanation: `Balanserad ${p} hp (25–27) → 3NT.` }
    if (p >= 22) return { call: '2C', rule: 'stark 2♣', explanation: `Balanserad ${p} hp (22+) → 2♣ (konstgjord, krav).` }
    // 12–14 och 18–19 balanserade öppnar i färg → faller vidare nedan.
  }

  // Stark 2♣ (obalanserad 22+).
  if (p >= 22) return { call: '2C', rule: 'stark 2♣', explanation: `${p} hp (stark) → 2♣ (konstgjord, krav).` }

  // Öppning på 1-läget. Två vägar in (ägarens beslut 2026-06-30):
  //  • 12+ HP öppnar ALLTID – en människa nedgraderar i princip aldrig en
  //    öppningshand, så TP får aldrig sänka en 12-hp-hand under tröskeln.
  //  • 11 HP med fördelning (Bergens grundregel: 12+ STARTPOÄNG/TP) öppnar också
  //    – ess/tior/längd lyfter en bra 11:a till öppning.
  // En platt 11-hp-hand (TP < 12) avstår fortfarande. NT-stegen ovan är hp-def.
  if (p >= 12 || tp >= 12) {
    const pts = tp > p ? `${p} hp / ${tp} TP` : `${p} hp`
    // Möjligt missat distributionellt 2♣ (stark obalanserad med lång färg) – flaggas.
    const uncertain = p >= 19 && !bal && Object.values(len).some((l) => l >= 6)
    if (len.spades >= 5 || len.hearts >= 5) {
      const suit: Suit = len.spades >= len.hearts ? 'spades' : 'hearts' // lika längd → spader (högre)
      return {
        call: `1${BID[suit]}`,
        rule: '5-korts högfärg',
        explanation: `${pts} med ${len[suit]}-korts ${NAME[suit]} → 1${BID[suit]}.`,
        uncertain,
      }
    }
    const m = openMinor(len)
    return {
      call: `1${BID[m]}`,
      rule: 'minor-regeln',
      explanation: `${pts}, ingen 5-korts högfärg → 1${BID[m]} (minor-regeln).`,
      uncertain,
    }
  }

  // Spärröppning (7+ korts färg, svag) – kollas före svag tvåa.
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
    if (len[suit] >= 7) {
      const level = len[suit] >= 8 ? 4 : 3
      return {
        call: `${level}${BID[suit]}`,
        rule: 'spärr',
        explanation: `${p} hp med ${len[suit]}-korts ${NAME[suit]} → ${level}${BID[suit]} (spärröppning).`,
      }
    }
  }

  // Svag tvåöppning (6-korts ♦/♥/♠, 6–11 hp). Ingen svag 2♣.
  if (p >= 6 && p <= 11) {
    for (const suit of ['spades', 'hearts', 'diamonds'] as Suit[]) {
      if (len[suit] === 6) {
        return {
          call: `2${BID[suit]}`,
          rule: 'svag tvåa',
          explanation: `${p} hp med 6-korts ${NAME[suit]} → 2${BID[suit]} (svag tvåöppning).`,
        }
      }
    }
  }

  // Annars pass.
  return { call: 'P', rule: 'pass', explanation: `${p} hp, ingen öppning → pass.` }
}

/** Minor-regeln: längsta minorn; vid lika 4-4/5-5 → ruter, 3-3 → klöver. */
function openMinor(len: Record<Suit, number>): Suit {
  if (len.diamonds > len.clubs) return 'diamonds'
  if (len.clubs > len.diamonds) return 'clubs'
  return len.diamonds >= 4 ? 'diamonds' : 'clubs'
}
