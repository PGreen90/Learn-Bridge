// Felrapport #113 (2026-11-11, bricka 2, 3NT av Väst) — LÅS, ingen fix behövdes.
// Rapporten: "Nord skall gå upp med ruter dam i det tredje ruterspelet (avblockering)."
// Vid bordet hade Nord ♦Q7 mot Syds ♦J62 (ÖV utan ruter). Där är ♦Q och ♦7
// LIKVÄRDIGA: efter ♦Q och ♦7 tillbaka vinner sjuan över Syds ♦6/♦2 och färgen är
// lika blockerad. Det som kostade sticket var utspelet ♦J (låg ruter → en bet).
// Ägarens följdfråga: med ♦Q5 i stället — avblockerar boten då? Ja; låst här.
// Hp räknade med kod: N 9 · E 12 · S 7 · W 12 = 40.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { mulberry32 } from './deal'
import { doubleDummyDeclarerRemaining } from './dds'
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
const giv = (n: string, w: string): Deal => ({ id: 'felrapport-113', board: 2, dealer: 'E', vulnerability: 'ns', hands: {
  N: parseHand(n), E: parseHand('S:KQ652 H:AKT97 D:84 C:T'),
  S: parseHand('S:AT4 H:Q2 D:JT962 C:864'), W: parseHand(w) } })
const RAPPORT = giv('S:873 H:J4 D:KQ73 C:QJ92', 'S:J9 H:8653 D:A5 C:AK753')
const Q5 = giv('S:873 H:J4 D:KQ53 C:QJ92', 'S:J9 H:8653 D:A7 C:AK753') // ♦7 och ♦5 bytta
const contract: Contract = { declarer: 'W', strain: 'NT', level: 3 }
const calls = H('E', '1S P 2C P 2H P 3NT P P P')
const fem = (v: string) => `DK D4 D9 ${v} D3 D8 DT DA H3 H4 HK H2 HA HQ H5 HJ SK SA S9 S3`.split(' ')
const efter = (d: Deal, kort: string[]): PlayState => { let st = startPlay(d, contract); for (const k of kort) st = playCard(st, c(k)); return st }
const ovTotalt = (st: PlayState) => st.tricksEW + doubleDummyDeclarerRemaining(st.hands, 'NT', 'W', st.currentTrick, st.toAct, 50_000_000)!

describe('Felrapport #113 — avblockering i partnerns långfärg (♦Q över ♦J)', () => {
  it('hp räknade med kod, summa 40 (båda givarna)', () => {
    for (const d of [RAPPORT, Q5]) {
      const hp = ORDER.map((s) => hcp(d.hands[s]))
      expect(hp).toEqual([9, 12, 7, 12])
      expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    }
  })

  it('rapportens läge (Nord ♦Q7): damen och sjuan är likvärdiga — felet var utspelet ♦J', () => {
    const f = fem('D5')
    expect(ovTotalt(efter(RAPPORT, [...f, 'DJ', 'C3', 'DQ']))).toBe(9)
    expect(ovTotalt(efter(RAPPORT, [...f, 'DJ', 'C3', 'D7']))).toBe(9)
    expect(ovTotalt(efter(RAPPORT, [...f, 'D6']))).toBe(8) // låg ruter → en bet
  })

  it('med ♦Q5 är avblockeringen ett stick värd — och boten lägger damen', () => {
    const f = fem('D7')
    expect(ovTotalt(efter(Q5, [...f, 'DJ', 'C3', 'DQ']))).toBe(8)
    expect(ovTotalt(efter(Q5, [...f, 'DJ', 'C3', 'D5']))).toBe(9)
    const st = efter(Q5, [...f, 'DJ', 'C3'])
    expect(st.toAct).toBe('N')
    for (const seed of [1, 2, 3, 5, 8]) {
      const val = botCardSmartReasoned(st, 'N', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card, `frö ${seed}: ${val.reason}`).toEqual(c('DQ'))
    }
  })
})
