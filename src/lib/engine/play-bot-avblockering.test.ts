// FACIT FÖRE FIX — AVBLOCKERING (ägaren 2026-10-10, Dagens tävling MP% bricka 7,
// giv Syd, alla i zon): "Här måste syd veta att det är rätt att göra en unblock.
// Räkna spader som är kvar, man vet att partner har 5 st från början, rätt spel
// är att slänga spader kneckt så partners kort blir stora."
//
// 1NT av Öst efter 1♣ (V) – 1♠ (N, enkelt inkliv 5+) – 1NT (Ö). Syd spelar ut
// ♠6: Nord ♠K, ♠A (Syd ♠5), sedan ♠4 till Östs ♠Q — och Syd la ♠8 och behöll
// ♠J. Räkningen är ärlig: Nord har 5+ spader (inklivet), träkarlen hade en, Syd
// fyra → Öst har högst tre och är slut när damen faller. Kvar: Nord ♠T9, Syd ♠J8.
// Behåller Syd kneckten vinner den andra spaderronden och Nords nia blir hängande;
// slängs kneckten på damen löper Nords ♠T9 så fort Nord kommer in (♦A). Vid
// bordet släppte Öst in Nord på ♦A i stick 5 → 1NT+3 i stället för +1.
// Hp räknade med kod: N 12 · Ö 9 · S 3 · V 16 = 40.
// Given återskapas ur dagens frönyckel (DUMP_TAVLING=2026-10-10:7, speldump-proben).

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code.slice(1)) as Rank })
const kod = (k: Card) => `${k.suit[0].toUpperCase()}${k.rank === '10' ? 'T' : k.rank}`

const bricka7: Deal = {
  id: 'tavling-2026-10-10-7', board: 7, dealer: 'S', vulnerability: 'all',
  hands: {
    N: parseHand('S:AKT94 H:872 D:A4 C:JT2'),
    E: parseHand('S:Q72 H:Q43 D:K8732 C:Q8'),
    S: parseHand('S:J865 H:T96 D:QT5 C:653'),
    W: parseHand('S:3 H:AKJ5 D:J96 C:AK974'),
  },
}
const auktion: ResolvedCall[] = [
  { seat: 'S', bid: 'P', rule: 'pass' },
  { seat: 'W', bid: '1C', rule: 'minor-regeln' },
  { seat: 'N', bid: '1S', rule: 'enkelt inkliv' },
  { seat: 'E', bid: '1NT', rule: 'NT med stopp' },
  { seat: 'S', bid: 'P', rule: 'pass med fit' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
] as ResolvedCall[]
const kontrakt: Contract = { declarer: 'E', strain: 'NT', level: 1 }

function spela(deal: Deal, contract: Contract, kort: string[]): PlayState {
  let st = startPlay(deal, contract)
  for (const k of kort) st = playCard(st, c(k))
  return st
}

describe('Avblockering — bricka 7 (2026-10-10): Syd slänger ♠J så Nords spader blir stora', () => {
  it('hp räknade med kod, summa 40', () => {
    const hp = (['N', 'E', 'S', 'W'] as Seat[]).map((s) => hcp(bricka7.hands[s]))
    expect(hp).toEqual([12, 9, 3, 16])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
  })

  it('stick 3: Östs ♠Q vinner — Syd lägger ♠J, inte ♠8', () => {
    const st = spela(bricka7, kontrakt, ['S6', 'S3', 'SK', 'S2', 'SA', 'S7', 'S5', 'H5', 'S4', 'SQ'])
    expect(st.toAct).toBe('S')
    for (const seed of [1, 2, 5]) {
      const val = botCardSmartReasoned(st, 'S', auktion, { rng: mulberry32(seed * 7919) })
      expect(kod(val.card), `frö ${seed}: ${val.reason}`).toBe('SJ')
    }
  })

  it('hela vägen: när stick 3 är slut har Syd blivit av med ♠J (i stick 2 eller 3)', () => {
    let st = spela(bricka7, kontrakt, ['S6', 'S3', 'SK', 'S2', 'SA', 'S7'])
    const sydsSpader: string[] = []
    let guard = 0
    while (st.completedTricks.length < 3 && guard++ < 20) {
      const val = botCardSmartReasoned(st, st.toAct, auktion, { rng: mulberry32(7919) })
      if (st.toAct === 'S') sydsSpader.push(kod(val.card))
      st = playCard(st, val.card)
    }
    expect(sydsSpader).toContain('SJ')
  })

  it('utan inklivet (Nords längd okänd) avblockerar Syd INTE — Öst kan sitta med ♠T', () => {
    // Samma kort, men Nord har inte bjudit spader: Nord kan ha fyra (♠AK94) och
    // Öst ♠QT72 — då är Syds ♠J ett stopp. Räkningen räcker inte → ♠8.
    const tyst: ResolvedCall[] = [
      { seat: 'S', bid: 'P', rule: 'pass' },
      { seat: 'W', bid: '1C', rule: 'minor-regeln' },
      { seat: 'N', bid: 'P', rule: 'pass' },
      { seat: 'E', bid: '1NT', rule: 'NT' },
      { seat: 'S', bid: 'P' },
      { seat: 'W', bid: 'P' },
      { seat: 'N', bid: 'P' },
    ] as ResolvedCall[]
    const st = spela(bricka7, kontrakt, ['S6', 'S3', 'SK', 'S2', 'SA', 'S7', 'S5', 'H5', 'S4', 'SQ'])
    const val = botCardSmartReasoned(st, 'S', tyst, { rng: mulberry32(7919) })
    expect(kod(val.card)).toBe('S8')
  })
})

describe('Avblockering på spelförarsidan — esset under bordets kung', () => {
  // 3NT av Syd. Bordet (Nord) har ♠KQJT9 och ♥A som ENDA ingång; Syd ♠A2.
  // Väst spelar ut ♥, bordet tar ♥A och leder ♠K. Lägger Syd ♠2 måste esset
  // vinna andra ronden och bordets ♠JT9 blir hängande — Syd ska kasta ♠A under
  // kungen, så löper bordets spader (5 stick i stället för 2).
  const deal: Deal = {
    id: 'avblock-spelforare', board: 1, dealer: 'S', vulnerability: 'none',
    hands: {
      N: parseHand('S:KQJT9 H:A43 D:432 C:32'),
      E: parseHand('S:876 H:JT98 D:T98 C:J98'),
      S: parseHand('S:A2 H:K72 D:AKQJ C:AKQ4'),
      W: parseHand('S:543 H:Q65 D:765 C:T765'),
    },
  }
  const contract: Contract = { declarer: 'S', strain: 'NT', level: 3 }

  it('given är hel: 13 kort per hand, 40 hp', () => {
    for (const s of ['N', 'E', 'S', 'W'] as Seat[]) expect(deal.hands[s]).toHaveLength(13)
    expect((['N', 'E', 'S', 'W'] as Seat[]).reduce((a, s) => a + hcp(deal.hands[s]), 0)).toBe(40)
  })

  it('bordet leder ♠K — Syd kastar ♠A', () => {
    const st = spela(deal, contract, ['H5', 'HA', 'H8', 'H2', 'SK', 'S6'])
    expect(st.toAct).toBe('S')
    const val = botCardSmartReasoned(st, 'S', [], { rng: mulberry32(7919) })
    expect(kod(val.card), val.reason).toBe('SA')
  })
})
