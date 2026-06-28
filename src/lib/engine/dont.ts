// Punkt 25: DONT mot motståndarnas 1NT, systembok §7.5.
//
// DONT (Disturb Opponents' NoTrump): visa en- och tvåfärgshänder på 2-läget och
// kunna stanna lågt.
//
//   X  = enfärgshand (oftast 6+); relä till 2♣
//   2♣ = ♣ + en högre färg (5-4+)
//   2♦ = ♦ + en högre färg (5-4+)
//   2♥ = ♥ + ♠ (5-4+)
//   2♠ = enbart ♠ (6+), svagare än X följt av 2♠

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'

const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)
const DONT_BID: Record<Suit, string> = { clubs: '2C', diamonds: '2D', hearts: '2H', spades: '2S' }

/** Vårt DONT-bud över motståndarnas 1NT-öppning. §7.5. */
export function dontOvercall(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const byLength = [...RANK_ORDER].sort((a, b) => len[b] - len[a])
  const [s1, s2] = byLength

  // Tvåfärgshand (5-4+): bjud den LÄGRE av de två färgerna (visar lägre + högre).
  if (len[s1] >= 5 && len[s2] >= 4) {
    const lower = rankIdx(s1) < rankIdx(s2) ? s1 : s2
    const higher = lower === s1 ? s2 : s1
    return { call: DONT_BID[lower], rule: 'DONT tvåfärg', explanation: `${len[lower]}-${len[higher]} i ${NAME[lower]}+${NAME[higher]} → ${SYM[lower]} (DONT, lägre färgen).` }
  }

  // Enfärgshand 6+.
  const single = RANK_ORDER.find((s) => len[s] >= 6)
  if (single) {
    // Svag spader-enfärgare → 2♠ (svagare än X följt av 2♠).
    if (single === 'spades' && p <= 10) {
      return { call: '2S', rule: 'DONT 2♠ (spader)', explanation: `svag enfärgshand i spader (6+) → 2♠.` }
    }
    return { call: 'X', rule: 'DONT X (enfärg)', explanation: `enfärgshand i ${NAME[single]} (6+) → X (relä till 2♣, rättar sedan).` }
  }

  return { call: 'P', rule: 'pass', explanation: 'ingen en-/tvåfärgshand → pass.' }
}

/** Advancers svar på partnerns DONT-bud (förenklad). §7.5. */
export function advanceDONT(_hand: Hand, partnerCall: string): ResponseResult {
  // Efter X: påtvingad relä 2♣ (partnern passar/rättar till sin riktiga färg).
  if (partnerCall === 'X') {
    return { call: '2C', rule: 'DONT relä', explanation: 'svar på X → 2♣ (pass-eller-rätta åt partnern).' }
  }
  // Efter ett tvåfärgsbud: passa med stöd (förenkling – stöd antas vanligt).
  return { call: 'P', rule: 'pass', explanation: 'stöd i partnerns visade färg → pass.' }
}
