// RÄTTVÄNT sedan 2026-11-23 (ägarbeslut: högt uppmuntrar, lågt avskräcker): nu
// är det spelarens LÄGSTA kort som avskräcker, och bara när det bevisligen är
// det lägsta. Åttan ur D-8 läses numera som det den är — uppmuntrande. Texten
// nedan beskriver felet som det såg ut under den omvända markeringen.
//
// FACIT FÖRE FIX — markeringsinventeringen 2026-11-22, fel 3: ETT TVINGAT KORT
// ÄR INGEN MARKERING. Bottarna läste varje 8, 9 eller 10 i partnerns färg som
// "avskräcker = ingen dam eller högre". Men ur D-8 dubbelton finns inget lägre
// kort att lägga: åttan är tvingad, och botten som lade den uppmuntrade till och
// med ("jag lägger lågt"). Läsaren satte ändå ett tak som förnekade damen.
//
// Regeln (så läser en människa vid bordet): ett kort är "högt" bara om spelaren
// kan ha haft ett lägre. Syns alla lägre kort i färgen redan — i egen hand, på
// bordet eller spelade — är kortet spelarens lägsta och säger ingenting.
//
//   3NT av Syd. Väst spelar ut ♥A från A-K-7-5-2, bordet lägger ♥3, Öst har ♥D-8.
//   Nord ♠AKQ ♥643 ♦AKQ ♣AKQJ · Öst ♠9876 ♥Q8 ♦9872 ♣432
//   Syd ♠JT5 ♥JT9 ♦JT43 ♣T65 · Väst ♠432 ♥AK752 ♦65 ♣987

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import type { Markeringslasning } from './hand-model'
import { buildHandModel } from './hand-model'
import { botCardReasoned } from './play-bot'
import { playCard, startPlay, type PlayState } from './play'
import { applySignalReads, markeringStammer } from './signal-decode'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (t: string): Card => ({ suit: SUIT[t[0]], rank: (t.slice(1) === 'T' ? '10' : t.slice(1)) as Rank })
const deal = (N: string, E: string, S: string, W: string): Deal =>
  ({ id: 't', board: 1, dealer: 'S', vulnerability: 'none', hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) } }) as Deal
const spela = (d: Deal, kort: string): PlayState =>
  kort.split(' ').reduce((s, k) => playCard(s, card(k)), startPlay(d, { level: 3, strain: 'NT', declarer: 'S' }))

/** Östs lästa markering efter stick 1, ur Västs synvinkel. */
const ostsMarkering = (efter: PlayState): Markeringslasning => {
  const m = applySignalReads(buildHandModel([]), efter, 'W').E.markeringar ?? []
  expect(m.length).toBe(1)
  return m[0]
}
const hj = (...ranks: string[]): Card[] => ranks.map((r) => card('H' + r))

const DAM_ATTA = deal('S:AKQ H:643 D:AKQ C:AKQJ', 'S:9876 H:Q8 D:9872 C:432', 'S:JT5 H:JT9 D:JT43 C:T65', 'S:432 H:AK752 D:65 C:987')

describe('avkodningen: ett tvingat kort är ingen markering', () => {
  it('läget finns: Öst med ♥D-8 lägger åttan på partnerns ess', () => {
    expect(botCardReasoned(spela(DAM_ATTA, 'HA H3'), 'E').card).toEqual(card('H8'))
  })

  it('åttan ur ♥D-8 är uppmuntran → handen med damen står kvar', () => {
    const m = ostsMarkering(spela(DAM_ATTA, 'HA H3 H8 H9'))
    expect(markeringStammer(m, hj('Q', '8'))).toBe(true)
  })

  // Väst ♥A-K-J-10-7, bordet ♥6-4, Öst ♥9-5-3-2, Syd ♥D-8.
  const NIA = deal('S:AKQ H:64 D:AKQ4 C:AKQJ', 'S:9876 H:9532 D:98 C:432', 'S:JT5 H:Q8 D:JT73 C:T965', 'S:432 H:AKJT7 D:652 C:87')

  it('tvåan avskräcker: dam tredje stryks — men dam-2 dubbelton (tvingat kort) står kvar', () => {
    const m = ostsMarkering(spela(NIA, 'HA H4 H2 H8'))
    expect(markeringStammer(m, hj('Q', '5', '2'))).toBe(false)
    expect(markeringStammer(m, hj('Q', '2'))).toBe(true)
    expect(markeringStammer(m, hj('5', '3', '2'))).toBe(true)
  })

  it('trean kan vara ett mellankort (5-3-2) → den handen stryks inte', () => {
    const m = ostsMarkering(spela(NIA, 'HA H4 H3 H8'))
    expect(markeringStammer(m, hj('5', '3', '2'))).toBe(true)
  })

  it('nian uppmuntrar (här: fyra kort mot partnerns ess i sang) → längden stämmer, tre hackor gör det inte', () => {
    expect(botCardReasoned(spela(NIA, 'HA H4'), 'E').card).toEqual(card('H9'))
    const m = ostsMarkering(spela(NIA, 'HA H4 H9 H8'))
    expect(markeringStammer(m, hj('9', '5', '3', '2'))).toBe(true)
    expect(markeringStammer(m, hj('9', '5', '3'))).toBe(false)
  })
})
