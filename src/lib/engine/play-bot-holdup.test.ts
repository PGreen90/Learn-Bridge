// Speldiagnosen runda 7 (2026-09-30), fynd F — FÖRSVARET HÅLLER UPP ESSET MOT
// BORDETS LÅNGA FÄRG UTAN INGÅNG. FACIT FÖRE FIX. Två lås:
//
//  1. DDS-verifierat mekanismslut i sang: spelföraren leder mot träkarlens
//     ♦KQJ5 (ingen sidoingång på bordet), jag sitter bakom med ♦A72. Tar jag
//     esset direkt har spelföraren kvar en ruter att komma in på bordet med och
//     rullar hem färgen. Håller jag upp första varvet tar jag esset när han
//     spelar sin sista ruter — bordets färg dör utan ingång. Allt räknat på
//     ärlig information: bordets synliga kort, det ledda kortet och att färgen
//     spelas för första gången.
//
//  2. Själva speldiagnos-fröet 20260901 (3NT av Öst): stick 2 leder Öst ♦9 mot
//     bordets ♦KQJ654 (Väst utan annan honnör: ♠T852 ♥82 ♣5), Syd ♦8, bordet
//     ♦4 — och Nord med ♦A72 som fjärde hand tog esset "så billigt som möjligt".
//     DD-flaggan 3 stick (9→12: Öst har ♦93, esset i andra varvet dödar färgen).
//
// Repro av hela given: DUMP_SPEL=20260901 npx vitest run src/lib/engine/speldump.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { doubleDummyDeclarerRemaining } from './dds'
import { botCardReasoned } from './play-bot'
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
const kort = (s: string): Card => parse(s)[0]

describe('Fynd F — holdup mot bordets långa färg utan ingång (mekanismslutet)', () => {
  // 5-kortsslut i sang, Öst spelförare, träkarl Väst = ♦KQJ5 + en hacka, ingen
  // sidoingång. Nord sitter bakom med ♦A72 och har en exit (♠3 till partnern).
  // Öst leder ♦9 ur handen (♦93). Tar Nord esset direkt kommer Öst in på bordet
  // med ♦3 senare (K, Q, J = 3 stick); håller Nord upp tar hen esset på Östs
  // sista ruter och bordets färg dör (Öst får bara ♠A).
  const ending: PlayState = {
    contract: { declarer: 'E', strain: 'NT', level: 3 },
    trump: null,
    hands: {
      E: parse('D9 D3 SA C2 C4'),
      S: parse('SK SQ HK CA CK'),
      W: parse('DK DQ DJ D5 C3'),
      N: parse('DA D7 D2 S3 HA'),
    } as Record<Seat, Card[]>,
    leader: 'E',
    toAct: 'E',
    currentTrick: [],
    completedTricks: [],
    tricksNS: 0,
    tricksEW: 0,
  }

  /** Öst ♦9, Syd (utan ruter) sakar ♣K, bordet ♦5: Nord är fjärde hand. */
  function fjardeHand(): PlayState {
    let s = playCard(ending, kort('D9'))
    s = playCard(s, kort('CK'))
    s = playCard(s, kort('D5'))
    return s
  }

  it('DDS mekanism-lås: hålla upp ger spelföraren färre stick än att ta esset direkt', () => {
    const s = fjardeHand()
    const declTricks = (c: Card): number => {
      const t = playCard(s, c)
      return doubleDummyDeclarerRemaining(t.hands, 'NT', 'E', t.currentTrick, t.toAct, Infinity) ?? -1
    }
    expect(declTricks(kort('DA'))).toBeGreaterThan(0)
    expect(declTricks(kort('D2'))).toBeLessThan(declTricks(kort('DA')))
  })

  it('tumregeln: Nord håller upp (kryper) första varvet i stället för att ta esset', () => {
    const val = botCardReasoned(fjardeHand(), 'N')
    expect(val.card).toEqual(kort('D2'))
    expect(val.reason).toContain('håller upp')
  })

  it('men tar esset när bordet HAR en sidoingång (då dör inte färgen)', () => {
    const medIngang: PlayState = { ...ending, hands: { ...ending.hands, W: parse('DK DQ DJ D5 CA'), S: parse('SK SQ HK CK CQ') } }
    let s = playCard(medIngang, kort('D9'))
    s = playCard(s, kort('CQ'))
    s = playCard(s, kort('D5'))
    const val = botCardReasoned(s, 'N')
    expect(val.card).toEqual(kort('DA'))
  })
})

describe('Fynd F — frö 20260901, stick 2 (3NT av Öst)', () => {
  const GIV: Deal = {
    id: 'holdup-20260901', dealer: 'S', vulnerability: 'ns', board: 1,
    hands: {
      N: parseHand('S:93 H:QT64 D:A72 C:K972'),
      E: parseHand('S:AKJ H:AK9 D:93 C:AQT43'),
      S: parseHand('S:Q764 H:J753 D:T8 C:J86'),
      W: parseHand('S:T852 H:82 D:KQJ654 C:5'),
    },
  }

  it('Nord (♦A72, fjärde hand) kryper på Östs ♦9 mot bordets ♦KQJ654 utan ingång', () => {
    let s = startPlay(GIV, { declarer: 'E', strain: 'NT', level: 3 })
    for (const c of ['S6', 'S8', 'S9', 'SJ', 'D9', 'D8', 'D4']) s = playCard(s, kort(c))
    expect(s.toAct).toBe('N')
    const val = botCardReasoned(s, 'N')
    expect(val.card).toEqual(kort('D2'))
  })
})
