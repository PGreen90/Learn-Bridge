// FACIT FÖRE FIX — felrapport #89 (2026-09-28): Nord GÅR ÖVER partnerns redan
// vinnande ♦Q som FJÄRDE hand (bricka 10, 1NT av Öst, stick 6: Öst ♦2, Syd ♦Q,
// bordet ♦J — Nord lade ♦K ur K65 och skänkte spelföraren ett stick: ♦T98 hos
// Öst blev alla goda).
//
// Tumreglerna (`botCardReasoned`) säger "partnern vinner sticket, kasta lågt".
// Men med 8 kort kvar går valet till Monte-Carlo-lagret, och det valde ♦K ungefär
// en gång på tio. Orsak (`chooseCardMonteCarlo`): varje korts medel räknades
// över de lägen där lösaren HANN inom nodbudgeten — olika mängder per kort.
// ♦K förenklar ställningen och "hann" oftare, ♦6 föll bort på just de tunga
// lägen där den var bättre. Fix: alla kort jämförs på SAMMA lägen (bara lägen
// där alla kort löstes). Frön 74, 196 och 200 gav ♦K före fixen (sökta med
// mulberry32 över 41–260); 74 och 196 räddades av den fixen, men 200 inte: där
// gav samplingen Öst för få ruter, och på ett läge där Syd har längden är ♦K
// faktiskt rätt (avblockering — Nords ♦K6 fastnar annars under Syds nia). Men
// längden är SPELFÖRARENS: Öst ledde ♦A och sedan ♦2 ur handen, Syd har inte
// visat ruter. Därför en människoregel FÖRE Monte-Carlo (`botCardSmartReasoned`):
// fjärde hand i försvaret med partnern vinnande kryper alltid — avblockering
// (över partnerns vinnare) bara när partnern visat längd i färgen med sitt
// öppningsutspel i sang. Nu lägger Nord alltid ♦6.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { mulberry32 } from './deal'
import { botCardReasoned, botCardSmartReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (code: string): Card => ({ suit: SU[code[0]], rank: (code.slice(1) === 'T' ? '10' : code.slice(1)) as Rank })
const NEXT: Record<Seat, Seat> = { N: 'E', E: 'S', S: 'W', W: 'N' }
function callsOf(dealer: Seat, bids: string[]): ResolvedCall[] {
  let seat = dealer
  return bids.map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = NEXT[seat]; return c })
}
function after(deal: Deal, contract: Contract, played: string[], n: number): PlayState {
  let s = startPlay(deal, contract)
  for (const c of played.slice(0, n)) s = playCard(s, card(c))
  return s
}

describe('felrapport #89 – Nord går inte över partnerns vinnande ♦Q som fjärde hand (1NT av Öst)', () => {
  const deal: Deal = {
    id: 't', dealer: 'E', vulnerability: 'all', board: 10,
    hands: {
      N: parseHand('S:965 H:KT2 D:K65 C:KQ92'),
      E: parseHand('S:KT8 H:Q95 D:AT982 C:64'),
      S: parseHand('S:A73 H:J764 D:Q74 C:T75'),
      W: parseHand('S:QJ42 H:A83 D:J3 C:AJ83'),
    },
  }
  const contract: Contract = { declarer: 'E', strain: 'NT', level: 1 }
  const calls = callsOf('E', ['P', 'P', '1C', 'P', '1NT', 'P', 'P', 'P'])
  const played = [
    'H6', 'H3', 'HK', 'H5', 'HT', 'H9', 'H4', 'HA', 'SQ', 'S5', 'S8', 'SA', 'HJ', 'H8', 'H2', 'HQ',
    'DA', 'D4', 'D3', 'D5', 'D2', 'DQ', 'DJ', /* Nord: */ 'DK',
  ]
  const s = after(deal, contract, played, 23)

  it('läget: Nord är fjärde hand, partnerns ♦Q vinner över bordets ♦J', () => {
    expect(s.toAct).toBe('N')
    expect(s.currentTrick.map((pc) => pc.seat)).toEqual(['E', 'S', 'W'])
  })

  it('tumregeln: partnern vinner redan → hacka', () => {
    expect(botCardReasoned(s, 'N').card).not.toEqual(card('DK'))
  })

  it('Monte-Carlo (8 kort kvar) på frön som förr gav ♦K → hacka', () => {
    for (const seed of [74, 196, 200]) {
      const c = botCardSmartReasoned(s, 'N', calls, { rng: mulberry32(seed) }).card
      expect(c, `frö ${seed}`).not.toEqual(card('DK'))
      expect(c.suit).toBe('diamonds')
    }
  })
})
