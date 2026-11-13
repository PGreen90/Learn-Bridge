// FACIT FÖRE FIX — felrapport #117 (2026-11-12, Dagens IMP nr 103, giv 12,
// 2♠ XX av Nord): "När Öst–Väst vet att Nord–Syd är slut på hjärter så måste
// man byta färg. Allt annat är bättre; spela trumf är riktigt bra, alternativt
// klöver."
//
//   Stick 1: Ö ♥5 – ♥J – ♥Q – ♥A   (träkarlen Syd blev renons i hjärter)
//   Stick 2: N ♠2 – ♠A – ♠4 – ♠3
//   Stick 3: Ö ♥2 ???               ← stöld i handen, klöversak på bordet
//   Stick 4: N ♦Q – ♦3 – ♦6 – ♦K
//   Stick 5: V ♥7 ???               ← samma sak en gång till
//
// Hålet: "fortsätt motspelets utspelsfärg" (§8) såg aldrig att BÅDA
// motståndarna var renons i färgen. Dubbelrenons = spelföraren stjäl på ena
// handen och sakar en förlorare på den andra. Stick 5 är VISAD renons (Nord
// stal i stick 3). Stick 3 är renons GENOM RÄKNING: Öst har själv sex hjärter,
// partnern öppnade 1♥ (5+), bordet hade en och Nord lade ♥A = tretton.
// Hp räknade med kod: N 10 · E 4 · S 9 · W 17 = 40.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { mulberry32 } from './deal'
import { hcp } from './hand'
import { playCard, startPlay, type Contract, type PlayState } from './play'
import { botCardSmartReasoned } from './play-bot'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code[1]) as Rank })
const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const k = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return k })
}
const RAPPORT: Deal = { id: 'felrapport-117', board: 12, dealer: 'W', vulnerability: 'ns', hands: {
  N: parseHand('S:J9762 H:A D:QJ82 C:Q98'), E: parseHand('S:A H:965432 D:543 C:654'),
  S: parseHand('S:KT854 H:J D:AT96 C:JT2'), W: parseHand('S:Q3 H:KQT87 D:K7 C:AK73') } }
const contract: Contract = { declarer: 'N', strain: 'spades', level: 2, doubled: 'XX' }
const calls = H('W', '1H 1S P 2H P 2S P P X XX P P P')
const efter = (kort: string): PlayState => { let st = startPlay(RAPPORT, contract); for (const k of kort.split(' ')) st = playCard(st, c(k)); return st }
const FRON = [1, 2, 3, 5, 8]

describe('Felrapport #117 — försvaret spelar aldrig en färg till DUBBELRENONS (§8.13)', () => {
  it('hp räknade med kod, summa 40', () => {
    const hp = ORDER.map((s) => hcp(RAPPORT.hands[s]))
    expect(hp).toEqual([10, 4, 9, 17])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(RAPPORT.hands[s]).toHaveLength(13)
  })

  it('stick 5 (VISAD renons hos båda): Väst byter färg — aldrig hjärter', () => {
    const st = efter('H5 HJ HQ HA S2 SA S4 S3 H2 C2 HT S6 DQ D3 D6 DK')
    expect(st.toAct).toBe('W')
    for (const seed of FRON) {
      const val = botCardSmartReasoned(st, 'W', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card.suit, `frö ${seed}: ${val.reason}`).not.toBe('hearts')
    }
  })

  it('stick 3 (renons GENOM RÄKNING: 6 egna + partnerns 5+ + bordets 1 + ♥A): Öst byter färg', () => {
    const st = efter('H5 HJ HQ HA S2 SA S4 S3')
    expect(st.toAct).toBe('E')
    for (const seed of FRON) {
      const val = botCardSmartReasoned(st, 'E', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card.suit, `frö ${seed}: ${val.reason}`).not.toBe('hearts')
      expect(val.reason).toMatch(/renons/)
    }
  })

  it('motvikt: har bordet hjärter kvar fortsätts utspelsfärgen som förut', () => {
    // ♥4 ↔ ♠4 mellan Öst och Syd: bordet (Syd) har ♥J4 och följer färg en gång till.
    const d: Deal = { ...RAPPORT, hands: { ...RAPPORT.hands, S: parseHand('S:KT85 H:J4 D:AT96 C:JT2'), E: parseHand('S:A4 H:96532 D:543 C:654') } }
    let st = startPlay(d, contract)
    for (const k of 'H5 H4 HQ HA S2 SA S5 S3'.split(' ')) st = playCard(st, c(k))
    expect(st.toAct).toBe('E')
    const val = botCardSmartReasoned(st, 'E', calls, { rng: mulberry32(7919) })
    expect(val.card.suit, val.reason).toBe('hearts')
  })
})
