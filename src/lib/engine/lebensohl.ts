// Motståndarens NATURLIGA inkliv över ett 1NT (`naturalNTOvercall`): en stark
// enfärgshand (6+, 11–15) kliver in naturligt; svaga/tvåfärgade händer lämnas åt
// DONT (§7.6).
//
// (Filen bar till 2026-09-18 även svararens Lebensohl efter VÅRT 1NT — den
// strukturen är riven: ägarens spec efter felrapport #77 är systems on + stulet
// bud mot ALLA inkliv, se nt-systems-on.ts och systemboken §7.5.)

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/**
 * Motståndarens NATURLIGA inkliv över vårt 1NT. En stark enfärgshand (en färg med
 * 6+ kort, ingen annan färg 5+, 11–15 hp) klivar in naturligt på 2-läget. Annars
 * pass — då tar DONT vid som förut (auction.ts). 11–15-fönstret undviker krock med
 * DONT:s svagare/tvåfärgade händer och med en för stark hand (16+ dubblar/passar).
 */
export function naturalNTOvercall(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  if (p < 11 || p > 15) return { call: 'P', rule: 'pass', explanation: 'inget naturligt inkliv.' }
  // Exakt EN lång färg (6+), ingen annan 5+ (då är det en tvåfärgshand → DONT).
  const long = RANK_ORDER.find((s) => len[s] >= 6) ?? null
  if (!long) return { call: 'P', rule: 'pass', explanation: 'ingen 6-korts färg.' }
  const otherFive = RANK_ORDER.some((s) => s !== long && len[s] >= 5)
  if (otherFive) return { call: 'P', rule: 'pass', explanation: 'tvåfärgshand → DONT.' }
  return {
    call: `2${BID[long]}`,
    rule: 'naturligt inkliv (1NT)',
    explanation: `6+ ${SYM[long]}, 11–15 hp → 2${SYM[long]} (naturligt inkliv över deras 1NT).`,
  }
}
