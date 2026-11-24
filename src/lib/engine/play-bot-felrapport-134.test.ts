// FACIT FÖRE FIX — felrapport #134 (2026-11-24, Dagens MP% nr 115, giv 6,
// 3♠ av Väst): "När hjärtern är slut på bordet, ska partner inte fortsätta att
// spela den färgen. Då får träkarlen stjäla i den korta trumfen. Hade varit
// bättre att spela ruter ess och sen fortsätta i ruter."
//
//   Stick 1: N ♥8 – ♥4 – ♥A – ♥6
//   Stick 2: S ♥2 – ♥J – ♥K – ♥Q   (träkarlen Öst blev renons i hjärter)
//   Stick 3: N ♥T ???               ← bordet stjäl med ♠3 ur ♠Q83, Väst sakar ♦6
//
// Hålet: §8.13 (#117) stoppade bara färgen när BÅDA motståndarna var renons.
// Här är spelförarens renons inte bevisad (tre hjärter osedda för Nord) — men
// det behövs inte: träkarlen är renons och har KORT trumf (tre). Har spelföraren
// en hjärter kvar är den en förlorare som nu stjäls gratis på korta handen; är
// han renons blir det stöld och sak. Färgen har inget mer att ge försvaret.
// Hp räknade med kod: N 9 · E 11 · S 8 · W 12 = 40.

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
const RAPPORT: Deal = { id: 'felrapport-134', board: 6, dealer: 'E', vulnerability: 'ew', hands: {
  N: parseHand('S:4 H:KT85 D:A7532 C:QT6'), E: parseHand('S:Q83 H:Q4 D:K94 C:KJ943'),
  S: parseHand('S:AT72 H:A9732 D:8 C:852'), W: parseHand('S:KJ965 H:J6 D:QJT6 C:A7') } }
const contract: Contract = { declarer: 'W', strain: 'spades', level: 3 }
const calls = H('E', 'P P 1S 2D 3D P 3S P P P')
const spela = (d: Deal, kort: string): PlayState => { let st = startPlay(d, contract); for (const k of kort.split(' ')) st = playCard(st, c(k)); return st }
const FRON = [1, 2, 3, 5, 8]

describe('Felrapport #134 — försvaret ger inte träkarlen en stöld på KORTA trumfhanden (§8.13)', () => {
  it('hp räknade med kod, summa 40', () => {
    const hp = ORDER.map((s) => hcp(RAPPORT.hands[s]))
    expect(hp).toEqual([9, 11, 8, 12])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(RAPPORT.hands[s]).toHaveLength(13)
  })

  it('stick 3: bordet renons i hjärter med tre trumf — Nord byter färg, aldrig hjärter', () => {
    const st = spela(RAPPORT, 'H8 H4 HA H6 H2 HJ HK HQ')
    expect(st.toAct).toBe('N')
    for (const seed of FRON) {
      const val = botCardSmartReasoned(st, 'N', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card.suit, `frö ${seed}: ${val.reason}`).not.toBe('hearts')
      expect(val.reason).toMatch(/korta trumfhanden/)
    }
  })

  it('motvikt: har bordet en hjärter kvar fortsätts utspelsfärgen som förut', () => {
    // ♥3 ↔ ♣3 mellan Öst och Syd: bordet (Öst) har ♥Q43 och följer färg en gång till.
    const d: Deal = { ...RAPPORT, hands: { ...RAPPORT.hands, E: parseHand('S:Q83 H:Q43 D:K94 C:KJ94'), S: parseHand('S:AT72 H:A972 D:8 C:8532') } }
    const st = spela(d, 'H8 H4 HA H6 H2 HJ HK HQ')
    const val = botCardSmartReasoned(st, 'N', calls, { rng: mulberry32(7919) })
    expect(val.card.suit, val.reason).toBe('hearts')
  })

  it('motvikt: bordet har FYRA trumf (ingen kort trumfhand) — regeln rör inte fortsättningen', () => {
    // ♠2 ↔ ♣3 mellan Syd och Öst: bordet har ♠Q832, Syd ♠AT7.
    const d: Deal = { ...RAPPORT, hands: { ...RAPPORT.hands, E: parseHand('S:Q832 H:Q4 D:K94 C:KJ94'), S: parseHand('S:AT7 H:A9732 D:8 C:8532') } }
    const st = spela(d, 'H8 H4 HA H6 H2 HJ HK HQ')
    const val = botCardSmartReasoned(st, 'N', calls, { rng: mulberry32(7919) })
    expect(val.card.suit, val.reason).toBe('hearts')
  })
})
