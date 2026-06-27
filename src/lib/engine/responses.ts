// Budmotorns andra del: svararens första bud efter att partnern öppnat 1♥/1♠.
// Härlett ur systemboken §4.1. Prioriteringsordningen är det viktiga: vi testar
// fit-svaren först (splinter → Jacoby → Bergen), sedan färgsvar och NT.

import type { Bid, Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'

export type Major = 'hearts' | 'spades'

export interface ResponseResult {
  call: Bid
  rule: string
  explanation: string
  uncertain?: boolean
}

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }

function otherMajor(m: Major): Major {
  return m === 'hearts' ? 'spades' : 'hearts'
}

/** Vad svarar man på partnerns 1♥/1♠ (ostörd, ohöjd hand)? */
export function respondToMajor(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const other = otherMajor(opened)
  const sideSuits = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).filter((s) => s !== opened)
  const shortness = sideSuits.some((s) => len[s] <= 1)
  const M = BID[opened]
  const MSYM = opened === 'hearts' ? '♥' : '♠'

  if (p < 6) return { call: 'P', rule: 'pass', explanation: `${p} hp – för svagt för att svara → pass.` }

  // ---- Fit: 4+ stöd ----
  if (support >= 4) {
    if (p >= 12 && shortness) {
      const call = opened === 'hearts' ? '3S' : '3H'
      const sym = opened === 'hearts' ? '3♠' : '3♥'
      return { call, rule: 'tvetydig splinter', explanation: `${p} hp, ${support} stöd + kortfärg → ${sym} (tvetydig splinter, GF).` }
    }
    if (p >= 13) {
      return { call: '2NT', rule: 'Jacoby 2NT', explanation: `${p} hp, ${support} stöd, ingen kortfärg → 2NT (Jacoby, GF).` }
    }
    if (support === 4) {
      if (p >= 10) return { call: '3D', rule: 'Bergen limit', explanation: `${p} hp, 4 stöd → 3♦ (Bergen, limithöjning).` }
      if (p >= 7) return { call: '3C', rule: 'Bergen konstruktiv', explanation: `${p} hp, 4 stöd → 3♣ (Bergen, konstruktiv).` }
      return { call: `3${M}`, rule: 'Bergen spärr', explanation: `${p} hp, 4 stöd → 3${MSYM} (Bergen, spärrhöjning).` }
    }
    // 5+ stöd, ej GF
    if (p <= 9) return { call: `4${M}`, rule: 'spärr till utgång', explanation: `${p} hp, ${support} stöd – spärr → 4${MSYM}.` }
    return { call: '3D', rule: 'Bergen limit', explanation: `${p} hp, ${support} stöd → 3♦ (limithöjning).`, uncertain: true }
  }

  // ---- 3-korts stöd ----
  if (support === 3) {
    if (p <= 9) return { call: `2${M}`, rule: 'enkel höjning', explanation: `${p} hp, 3 stöd → 2${MSYM} (enkel höjning).` }
    if (p <= 12) return { call: '1NT', rule: 'semi-forcing 1NT', explanation: `${p} hp, 3-korts limithöjning → 1NT (semi-forcing), höjer sedan.` }
    // 13+ med 3 stöd → faller vidare till 2/1.
  }

  // ---- Ny färg på 1-läget: bara spader över 1♥ ----
  if (opened === 'hearts') {
    if (len.spades >= 6 && p <= 10) return { call: '2S', rule: 'svagt hoppskift', explanation: `${p} hp, 6-korts spader → 2♠ (svagt hoppskift).` }
    if (len.spades >= 4) return { call: '1S', rule: 'ny färg (1-läget)', explanation: `${p} hp, 4+ spader → 1♠ (krav 1 rond).` }
  }

  // ---- 2-över-1 GF med en 5+ färg ----
  if (p >= 12) {
    const s5 = bestSuit(len, opened, 5)
    if (s5) return { call: `2${BID[s5]}`, rule: '2-över-1 GF', explanation: `${p} hp med ${len[s5]}-korts ${NAME[s5]} → 2${BID[s5]} (2-över-1, GF).` }
  }

  // ---- 3NT: 13–15 balanserad, exakt 2 i öppningsfärgen, ingen 4-korts annan högfärg ----
  if (isBalanced(hand) && p >= 13 && p <= 15 && support <= 2 && len[other] < 4) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp balanserad utan fit → 3NT (till spel).` }
  }

  // ---- 2-över-1 med en 4-korts färg (tunnare – flaggas) ----
  if (p >= 12) {
    const s4 = bestSuit(len, opened, 4)
    if (s4) return { call: `2${BID[s4]}`, rule: '2-över-1 GF', explanation: `${p} hp med 4-korts ${NAME[s4]} → 2${BID[s4]} (2-över-1, GF).`, uncertain: true }
  }

  // ---- Semi-forcing 1NT (6–11, inget bättre) ----
  if (p <= 11) return { call: '1NT', rule: 'semi-forcing 1NT', explanation: `${p} hp utan fit eller 2/1 → 1NT (semi-forcing).` }

  // ---- Kvar: 12+ utan tydlig fortsättning → flaggas ----
  return { call: '1NT', rule: 'oklart', explanation: `${p} hp – motorn hittar inget tydligt svar (förenkling).`, uncertain: true }
}

/** Längsta biudbara 2/1-färgen (under öppningsfärgen) med minst `min` kort. */
function bestSuit(len: Record<Suit, number>, opened: Major, min: number): Suit | null {
  const candidates: Suit[] = opened === 'spades' ? ['hearts', 'diamonds', 'clubs'] : ['diamonds', 'clubs']
  let best: Suit | null = null
  for (const s of candidates) {
    if (len[s] >= min && (best === null || len[s] > len[best])) best = s
  }
  return best
}
