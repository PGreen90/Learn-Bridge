// FACIT FÖRE FIX — felrapport #96 (2026-10-04, bricka 11): BOTTEN LÄSER
// PARTNERNS LAVINTHAL-SAK. 2NT av Väst, Syd (människan) sakade ♥7 på Nords
// ruterutspel i stick 1 = högt kort = "spela den högsta av de andra färgerna"
// (spader). Nord vann stick 4 på ♣K — och fortsatte ruter (D6), fast partnern
// visat renons där och bett om spader. Ägaren: "Om jag visat spader så skall
// botten dra spader ess för att sedan spela ett spader till."
//
// Ägarbeslut 2026-10-06: bottarna LÄSER människans markeringar (antagandet:
// människan spelar appens §8-system, UDCA + Lavinthal) — förr avkodades aldrig
// Syds kort, och Lavinthal avkodades inte alls (bara avskräckande attityd).
//
//   Nord ♠A98 ♥Q5 ♦T8643 ♣K64 · Öst ♠Q32 ♥J94 ♦A952 ♣Q87
//   Syd ♠KJ754 ♥K8732 ♦— ♣JT2 · Väst ♠T6 ♥AT6 ♦KQJ7 ♣A953

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botCardReasoned } from './play-bot'
import { playCard, startPlay, type PlayState } from './play'
import { partnerLavinthalRequest } from './signal-decode'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (t: string): Card => ({ suit: SUIT[t[0]], rank: (t.slice(1) === 'T' ? '10' : t.slice(1)) as Rank })
const DEAL: Deal = { id: 't', board: 11, dealer: 'S', vulnerability: 'none', hands: {
  N: parseHand('S:A98 H:Q5 D:T8643 C:K64'), E: parseHand('S:Q32 H:J94 D:A952 C:Q87'),
  S: parseHand('S:KJ754 H:K8732 D:- C:JT2'), W: parseHand('S:T6 H:AT6 D:KQJ7 C:A953') } } as Deal

function efterStick(tricks: string[]): PlayState {
  let st = startPlay(DEAL, { level: 2, strain: 'NT', declarer: 'W' })
  for (const t of tricks) for (const c of t.split(' ')) st = playCard(st, card(c))
  return st
}
const RAPPORT = ['D3 D5 H7 D7', 'DK D4 D2 S4', 'C3 C4 C7 CT', 'C2 C5 CK C8']

describe('felrapport #96 – boten läser partnerns Lavinthal-sak', () => {
  it('avkodningen: Syds ♥7 (högt) på stick 1 ber om spader (högsta av de andra färgerna i sang)', () => {
    expect(partnerLavinthalRequest(efterStick(RAPPORT), 'N')).toBe('spades')
  })
  it('Nord inne på ♣K i stick 5 → spelar ♠A (partnerns önskade färg, esset först), inte ruter', () => {
    const st = efterStick(RAPPORT)
    expect(st.toAct).toBe('N')
    const c = botCardReasoned(st, 'N')
    expect(c.card).toEqual(card('SA'))
    expect(c.reason).toMatch(/Lavinthal|partnerns markering/i)
  })
  it('…och fortsätter spader när hen är inne igen (esset cashat, ♠9 kvar)', () => {
    const st = efterStick([...RAPPORT, 'SA S2 S5 S6'])
    expect(st.toAct).toBe('N')
    expect(botCardReasoned(st, 'N').card.suit).toBe('spades')
  })
  it('lågt sak (♥2) hade bett om klöver — den lägsta av de andra färgerna', () => {
    expect(partnerLavinthalRequest(efterStick(['D3 D5 H2 D7', 'DK D4 D2 S4', 'C3 C4 C7 CT', 'C2 C5 CK C8']), 'N')).toBe('clubs')
  })
  it('bara partnerns FÖRSTA sak räknas, och bara motspelarens — spelföraren läser inget', () => {
    expect(partnerLavinthalRequest(efterStick(RAPPORT), 'W')).toBeNull()
    expect(partnerLavinthalRequest(efterStick(RAPPORT), 'E')).toBeNull()
  })
  it('utan sak (Syd följer färg) finns ingen begäran', () => {
    expect(partnerLavinthalRequest(efterStick(['C4 C7 CT C3']), 'N')).toBeNull()
  })
})
