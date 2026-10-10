// FACIT FÖRE FIX — felrapport #104, stick 1 (ägarbeslut 2026-10-10): "man skall
// ducka första sticket och hålla på esset ett varv, detta är standard för att
// störa kommunikationen mellan motparter i ett NT-kontrakt."
//
// Dagens tävling 2026-10-10 bricka 2, 3NT av Väst (giv Öst, NS i zon). Nord ♣4,
// bordet ♣5, Syd ♣K — och Väst tog ♣A direkt ("vinner billigast"). Syd har sju
// klöver och Nord två: håller Väst upp esset ett varv är Nord renons när Syd
// fortsätter, och Syds klöver är död så länge Syd saknar ingång. Speldumpen
// (DUMP_TAVLING=2026-10-10:2) flaggade ♣A som −3 (DD 10 → 7). DD per kort här
// räknas med bridge-dds (AnalysePlayPBN) på stick 1 båda vägarna.
// Hp räknade med kod: N 8 · E 11 · S 8 · W 13 = 40.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { analyseSpel, getDds } from './revisor-dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code[1]) as Rank })

const deal: Deal = {
  id: 'felrapport-104-holdup', board: 2, dealer: 'E', vulnerability: 'ns',
  hands: {
    N: parseHand('S:KJ832 H:J64 D:QJ6 C:42'),
    E: parseHand('S:AT65 H:K983 D:A74 C:95'),
    S: parseHand('S:7 H:Q75 D:85 C:KQJT873'),
    W: parseHand('S:Q94 H:AT2 D:KT932 C:A6'),
  },
}
const calls: ResolvedCall[] = [['E', '1D'], ['S', '2C'], ['W', '3C'], ['N', 'P'], ['E', '3D'], ['S', 'P'], ['W', '3NT'], ['N', 'P'], ['E', 'P'], ['S', 'P']]
  .map(([seat, bid]) => ({ seat, bid }) as ResolvedCall)
const contract: Contract = { declarer: 'W', strain: 'NT', level: 3 }

const stickEtt = (sydsKort: string): PlayState => {
  let st = startPlay(deal, contract)
  for (const k of ['C4', 'C5', sydsKort]) st = playCard(st, c(k))
  return st
}

describe('Felrapport #104, stick 1 — spelförarens hold-up i sang', () => {
  it('hp räknade med kod, summa 40', () => {
    expect((['N', 'E', 'S', 'W'] as Seat[]).map((s) => hcp(deal.hands[s]))).toEqual([8, 11, 8, 13])
  })

  it('Väst håller upp ♣A ett varv på Syds ♣K (ägarens giv) och på Syds ♣7 (speldumpen)', () => {
    for (const syd of ['CK', 'C7']) {
      const st = stickEtt(syd)
      expect(st.toAct).toBe('W')
      for (const seed of [1, 2, 5]) {
        const val = botCardSmartReasoned(st, 'W', calls, { rng: mulberry32(seed * 7919) })
        expect(val.card, `${syd} frö ${seed}: ${val.reason}`).toEqual(c('C6'))
        expect(val.reason).toMatch(/håller upp/)
      }
    }
  })

  it('men aldrig när ducken är betsticket: med fyra försvarsstick tagna tar Väst esset', () => {
    const st: PlayState = { ...stickEtt('CK'), tricksNS: 4 }
    const val = botCardSmartReasoned(st, 'W', calls, { rng: mulberry32(7919) })
    expect(val.card, val.reason).toEqual(c('CA'))
  })

  it('DD-lås (bridge-dds): ♣6 håller spelföraren på 10 stick, ♣A släpper till 7', async () => {
    const dds = await getDds()
    const efter = (vastsKort: string) => {
      const st = playCard(stickEtt('CK'), c(vastsKort))
      const trace = analyseSpel(dds, deal, contract, st.completedTricks)
      return trace[trace.length - 1]
    }
    expect(efter('C6')).toBe(10)
    expect(efter('CA')).toBe(7)
  })
})
