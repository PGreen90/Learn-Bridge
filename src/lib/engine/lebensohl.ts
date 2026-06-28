// Punkt 24: Lebensohl, systembok §7.4.
//
// Verktyg för att skilja SVAGA händer från UTGÅNGSVILLIGA i två lägen:
//   (a) efter partnerns upplysningsdubbling av en svag tvåa, och
//   (b) efter att motståndaren stört vårt 1NT-inkliv/öppning på 2-läget.
// Samma mekanik i båda lägena, så en funktion täcker dem.
//
// Mekanik:
//   2NT = relä till 3♣ (puppet). Svag hand passar/rättar lågt på 3-läget.
//   Direkt bud på 3-läget (utan 2NT) = utgångskrav.
//   Cue i deras färg = Stayman-aktigt, krav (letar högfärgsfit).
//   "Slow shows": långsam 3NT (2NT → 3NT) visar stopp; direkt 3NT förnekar.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'
import { hasStopper } from './overcalls'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/** Längsta färg (≠ deras) med minst `min` kort; lika → högst rankad. */
function longestOther(len: Record<Suit, number>, their: Suit, min: number): Suit | null {
  let best: Suit | null = null
  for (const s of RANK_ORDER) {
    if (s === their || len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/**
 * Lebensohl-svar när deras färg ligger på 2-läget (`theirSuit`).
 * Gemensam för "efter partnerns X av svag tvåa" och "störning över vårt 1NT".
 */
export function lebensohlResponse(hand: Hand, theirSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const stop = hasStopper(hand, theirSuit)
  const longSuit = longestOther(len, theirSuit, 5)

  // Svag hand (0–7): relä 2NT för att stanna lågt (eller pass om inget att visa).
  if (p <= 7) {
    if (longSuit) {
      return { call: '2NT', rule: 'Lebensohl 2NT (svag)', explanation: `svag hand med ${len[longSuit]}-korts ${NAME[longSuit]} → 2NT (relä till 3♣, passar/rättar lågt).` }
    }
    return { call: 'P', rule: 'pass', explanation: 'svag hand utan färg att visa → pass.' }
  }

  // Utgångsvärden (8+).
  // Egen 5+ färg → direkt bud på 3-läget = krav.
  if (longSuit) {
    return { call: `3${BID[longSuit]}`, rule: 'Lebensohl direkt 3-läge (krav)', explanation: `utgångskrav med ${len[longSuit]}-korts ${NAME[longSuit]} → 3${SYM[longSuit]} (direkt = krav).` }
  }

  // 4-korts objuden högfärg utan 5-färg → cue (Stayman-aktigt, krav).
  const unbidMajor = (['hearts', 'spades'] as Suit[]).find((m) => m !== theirSuit && len[m] >= 4)
  if (unbidMajor) {
    return { call: `3${BID[theirSuit]}`, rule: 'Lebensohl cue (Stayman, krav)', explanation: `letar högfärgsfit → cue ${SYM[theirSuit]} (krav).` }
  }

  // Balanserad utan färg: 3NT-beslut via "slow shows".
  return stop
    ? { call: '2NT', rule: 'Lebensohl 2NT (slow → 3NT, visar stopp)', explanation: `utgång med stopp i ${NAME[theirSuit]} → 2NT, sedan 3NT (slow shows stopp).` }
    : { call: '3NT', rule: '3NT direkt (förnekar stopp)', explanation: `utgång utan stopp i ${NAME[theirSuit]} → direkt 3NT (ber partnern täcka).` }
}
