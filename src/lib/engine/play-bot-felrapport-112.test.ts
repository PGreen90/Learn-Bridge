// FACIT FÖRE FIX — felrapport #112 (2026-11-10, bricka 10, Öst giv, alla i zon):
// "Helt onödigt av väst att maska spadern. Hen har många trumf med ess kung dam.
// Spela en eller två trumf från toppen och motståndets spader faller under
// honnörerna."
//
// 3♠ av Väst. Stick 1–3: Nord ♥A, ♥K, ♥2 — Syd stjäl tredje hjärtern med ♠6.
// Stick 4: Syd ♣4 till Västs ♣Q. Stick 5: Väst ♠T, Nord ♠5 — och bordet (Öst,
// ♠AQ42) la ♠2 med motiveringen "partnern vinner redan sticket". Men Syd sitter
// BAKOM med den enda utestående trumfen ♠J: tian förlorade ett stick som aldrig
// kunde förloras (spelförarsidan äger ♠AKQ + alla hackor utom knekten).
// Hålet: `winOverBeatablePartner` (felrapport #48) avstod så fort andra hand
// FÖLJT färg ("slagkortet kan ligga hos den som redan spelat") — rätt försiktighet
// när överstickningen kan kosta, men här är den GRATIS: efter ♠Q har sidan fler
// säkra toppkort (♠A, ♠K) än det finns utestående kort i färgen (♠J).
// Hp räknade med kod: N 11 · E 18 · S 5 · W 6 = 40.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code[1]) as Rank })
const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const k = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return k })
}

const deal: Deal = {
  id: 'felrapport-112', board: 10, dealer: 'E', vulnerability: 'all',
  hands: {
    N: parseHand('S:5 H:AK542 D:QJT C:J963'),
    E: parseHand('S:AQ42 H:QT8 D:K5 C:AK75'),
    S: parseHand('S:J6 H:76 D:A9864 C:T842'),
    W: parseHand('S:KT9873 H:J93 D:732 C:Q'),
  },
}
const calls = H('E', '1C P 1S P 3S P P P')
const contract: Contract = { declarer: 'W', strain: 'spades', level: 3 }
const FYRA_STICK = ['HA', 'H8', 'H7', 'H3', 'HK', 'HT', 'H6', 'H9', 'H2', 'HQ', 'S6', 'HJ', 'C4', 'CQ', 'C6', 'C5']

function efter(kort: string[], d: Deal = deal): PlayState {
  let st = startPlay(d, contract)
  for (const k of kort) st = playCard(st, c(k))
  return st
}

describe('Felrapport #112 — bordet släpper inte partnerns tia till den enda utestående trumfen', () => {
  it('hp räknade med kod, summa 40', () => {
    const hp = ORDER.map((s) => hcp(deal.hands[s]))
    expect(hp).toEqual([11, 18, 5, 6])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
  })

  it('läget är återskapat: Väst på tur efter fyra stick, NS 3 – ÖV 1', () => {
    const st = efter(FYRA_STICK)
    expect(st.toAct).toBe('W')
    expect([st.tricksNS, st.tricksEW]).toEqual([3, 1])
  })

  it('trumfen dras utan att knekten får ett stick: efter Västs trumf och Nords ♠5 går bordet upp', () => {
    for (const seed of [1, 2, 5, 6]) {
      let st = efter(FYRA_STICK)
      const vast = botCardSmartReasoned(st, 'W', calls, { rng: mulberry32(seed * 7919) })
      expect(vast.card.suit, `frö ${seed}: ${vast.reason}`).toBe('spades')
      st = playCard(st, vast.card)
      st = playCard(st, c('S5'))
      if (st.toAct !== 'E') continue
      const bord = botCardSmartReasoned(st, 'E', calls, { rng: mulberry32(seed * 7919) })
      st = playCard(st, bord.card)
      st = playCard(st, c('SJ'))
      // Sticket ska vinnas av spelförarsidan — ♠J får aldrig ta det.
      expect(st.tricksNS, `frö ${seed}: Väst ${vast.card.rank}, bordet ${bord.card.rank} (${bord.reason})`).toBe(3)
    }
  })

  it('exakt rapportens läge (♠T, ♠5): bordet lägger ♠Q — billigaste säkra vinnaren, inte ♠2', () => {
    const st = efter([...FYRA_STICK, 'ST', 'S5'])
    expect(st.toAct).toBe('E')
    const val = botCardSmartReasoned(st, 'E', calls, { rng: mulberry32(7919) })
    expect(val.card, val.reason).toEqual(c('SQ'))
  })

  it('motvikt: den ÄKTA masken står kvar — ♠Q mot bordets ♠A42 med ♠K ute läggs lågt', () => {
    // Samma giv men ♠K hos Syd och ♠Q/♠J hos Väst: Väst spelar ♠Q, Nord ♠5 →
    // bordet får INTE gå upp med esset (masken mot kungen är hela poängen).
    const d: Deal = { ...deal, hands: {
      N: parseHand('S:5 H:AK542 D:QJT C:J963'),
      E: parseHand('S:A842 H:QT8 D:K5 C:AK75'),
      S: parseHand('S:K6 H:76 D:A9864 C:T842'),
      W: parseHand('S:QJT973 H:J93 D:732 C:Q'),
    } }
    const st = efter([...FYRA_STICK, 'SQ', 'S5'], d)
    expect(st.toAct).toBe('E')
    const val = botCardSmartReasoned(st, 'E', calls, { rng: mulberry32(7919) })
    expect(val.card.rank, val.reason).not.toBe('A')
  })
})
