// FACIT FÖRE FIX — felrapport #104 (ägarens skärmbild 2026-10-10, Dagens tävling
// bricka 2, giv Öst, NS i zon): "Denna typ av lågmask ser jag datorn göra ofta.
// Blir sällan bra för dem."
//
// 3NT av Väst. Stick 1: Nord ♣4 (partnerns färg), bordet ♣5, Syd ♣K, Väst ♣A.
// Stick 2: Väst ♦2 mot bordets ♦A74, Nord ♦6 — och bordet (Öst) la ♦7 med
// motiveringen "jag vinner sticket så billigt som möjligt". Men Syd sitter BAKOM
// med ♦85: ♦8 vann, Syd fick in sig och körde klövern (3NT −3 i stället för +1).
// "Billigast" i tredje hand med en dold försvarare bakom måste vara ett SÄKERT
// stick mot de osedda korten; finns inget sådant går man upp med sitt högsta.
// Double-dummy (doubleDummyDeclarerRemaining, 11 kort kvar): ♦A → 7 stick för
// spelförarsidan, ♦7/♦4 → 6. Hp räknade med kod: N 8 · E 11 · S 8 · W 13 = 40.
// Given återskapas ur dagens frönyckel (DUMP_TAVLING=2026-10-10:2, speldump-proben).

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code[1]) as Rank })

const deal: Deal = {
  id: 'felrapport-104', board: 2, dealer: 'E', vulnerability: 'ns',
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

/** Läget när bordet (Öst) ska spela i stick 2: ♣4 ♣5 ♣K ♣A · ♦2 ♦6. */
function stickTva(): PlayState {
  let st = startPlay(deal, contract)
  for (const k of ['C4', 'C5', 'CK', 'CA', 'D2', 'D6']) st = playCard(st, c(k))
  return st
}

describe('Felrapport #104 — spelförarsidans tredje hand med en dold försvarare bakom', () => {
  it('hp räknade med kod, summa 40', () => {
    expect((['N', 'E', 'S', 'W'] as Seat[]).map((s) => hcp(deal.hands[s]))).toEqual([8, 11, 8, 13])
  })

  it('läget är återskapat: bordet på tur efter ♦2 ♦6, ÖV 1 stick', () => {
    const st = stickTva()
    expect(st.toAct).toBe('E')
    expect(st.tricksEW).toBe(1)
    expect(st.currentTrick.map((p) => `${p.card.suit[0]}${p.card.rank}`)).toEqual(['d2', 'd6'])
  })

  it('bordet går upp med ♦A — aldrig "lågmasken" ♦7 mot en dold hand bakom', () => {
    const st = stickTva()
    for (const seed of [1, 2, 5, 6]) {
      const val = botCardSmartReasoned(st, 'E', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card, `frö ${seed}: ${val.reason}`).toEqual(c('DA'))
      expect(val.reason).toMatch(/försvarare/)
    }
  })

  // Elva kort kvar är tungt för den egna TS-lösaren (~40 s per kort) — därav tiden.
  it('DD-lås: ♦A håller 7 stick, ♦7 släpper till 6', { timeout: 300_000 }, () => {
    const st = stickTva()
    const efter = (card: Card) => {
      const hands = { ...st.hands, E: st.hands.E.filter((x) => !(x.suit === card.suit && x.rank === card.rank)) } as Record<Seat, Card[]>
      const n = doubleDummyDeclarerRemaining(hands, 'NT', 'W', [...st.currentTrick, { seat: 'E', card }], 'S', 80_000_000)
      return n === null ? null : n + st.tricksEW
    }
    expect(efter(c('DA'))).toBe(7)
    expect(efter(c('D7'))).toBe(6)
  })

  // Den ÄKTA masken får stå kvar (speldiagnosens frö 20260767, hittad när första
  // regelversionen gick upp med esset och tappade tre stick): 3NT av Väst, Väst
  // leder ♥3 mot bordets ♥AJ87, Nord lägger ♥10 — bara ♥K är osedd över knekten,
  // så bordet masar med ♥J. En lågmask är ett kort som FLERA osedda kort slår.
  it('äkta mask mot ett saknat kort: bordet masar ♥J ur AJ87 när bara ♥K är ute (frö 20260767)', () => {
    const d: Deal = { id: 'frö-20260767', board: 1, dealer: 'N', vulnerability: 'none', hands: {
      N: parseHand('S:Q H:KT9 D:976543 C:J53'), E: parseHand('S:972 H:AJ876 D:8 C:K964'),
      S: parseHand('S:JT843 H:52 D:T2 C:AT87'), W: parseHand('S:AK65 H:Q43 D:AKQJ C:Q2') } }
    expect((['N', 'E', 'S', 'W'] as Seat[]).reduce((a, s) => a + hcp(d.hands[s]), 0)).toBe(40)
    let st = startPlay(d, contract)
    for (const k of ['D6', 'D8', 'DT', 'DJ', 'HQ', 'H9', 'H6', 'H2', 'H3', 'HT']) st = playCard(st, c(k))
    expect(st.toAct).toBe('E')
    for (const seed of [1, 2, 5]) {
      const val = botCardSmartReasoned(st, 'E', [], { rng: mulberry32(seed * 7919) })
      expect(val.card, `frö ${seed}: ${val.reason}`).toEqual(c('HJ'))
      expect(val.reason).toMatch(/äkta mask/)
    }
  })

  // Samma giv, stick 1 (Västs ♣A på Syds ♣K): spelförarens hold-up i sang — byggd samma
  // dag, facit i play-bot-spelforarens-holdup.test.ts (§8.9).
})
