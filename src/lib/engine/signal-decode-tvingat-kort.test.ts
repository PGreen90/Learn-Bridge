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
import { buildHandModel } from './hand-model'
import { botCardReasoned } from './play-bot'
import { playCard, startPlay, type PlayState } from './play'
import { applySignalReads } from './signal-decode'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (t: string): Card => ({ suit: SUIT[t[0]], rank: (t.slice(1) === 'T' ? '10' : t.slice(1)) as Rank })
const deal = (N: string, E: string, S: string, W: string): Deal =>
  ({ id: 't', board: 1, dealer: 'S', vulnerability: 'none', hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) } }) as Deal
const spela = (d: Deal, kort: string): PlayState =>
  kort.split(' ').reduce((s, k) => playCard(s, card(k)), startPlay(d, { level: 3, strain: 'NT', declarer: 'S' }))

const DAM_ATTA = deal('S:AKQ H:643 D:AKQ C:AKQJ', 'S:9876 H:Q8 D:9872 C:432', 'S:JT5 H:JT9 D:JT43 C:T65', 'S:432 H:AK752 D:65 C:987')

describe('avkodningen: ett tvingat kort är ingen markering', () => {
  it('läget finns: Öst med ♥D-8 lägger åttan på partnerns ess', () => {
    expect(botCardReasoned(spela(DAM_ATTA, 'HA H3'), 'E').card).toEqual(card('H8'))
  })

  it('Väst ser alla lägre hjärter (egna 7-5-2, bordets 6-4-3) → åttan förnekar INTE damen', () => {
    const efter = spela(DAM_ATTA, 'HA H3 H8 H9')
    expect(applySignalReads(buildHandModel([]), efter, 'W').E.suitHcp.hearts.max).toBeGreaterThanOrEqual(2)
  })

  it('finns lägre hjärter osedda är en nia fortfarande avskräckande (regeln i §8.5 står kvar)', () => {
    // Väst ♥A-K-J-10-7, bordet ♥6-4, Öst ♥9-5-3-2: tre lägre hjärter är osedda för Väst.
    const d = deal('S:AKQ H:64 D:AKQ4 C:AKQJ', 'S:9876 H:9532 D:98 C:432', 'S:JT5 H:Q8 D:JT73 C:T965', 'S:432 H:AKJT7 D:652 C:87')
    const efter = spela(d, 'HA H4 H9 H8')
    expect(applySignalReads(buildHandModel([]), efter, 'W').E.suitHcp.hearts.max).toBe(1)
  })
})
