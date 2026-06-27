// Budmotorns fjärde del: öppnarens återbud efter ett 1-läges färgsvar (1x–1y),
// t.ex. 1♣–1♥, 1♦–1♠, 1♥–1♠. Härlett ur systemboken §5.2. Öppnaren beskriver
// styrka och form så att svararen kan placera kontraktet.
//
// Avgränsning: bara fallet då svararen visat en NY FÄRG på 1-läget. Återbud
// efter höjningar, NT-svar, 2/1 och transfers tas i ett senare steg – då stannar
// auktionen vid två bud tills vidare.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'] // stigande budrang
const rankOf = (s: Suit) => RANK.indexOf(s)

/** Öppnarens återbud efter 1x–1y (svararen visade 4+ ny färg, 6+ hp). §5.2. */
export function openerRebidAfter1LevelResponse(hand: Hand, opened: Suit, responderSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const rIsMajor = responderSuit === 'hearts' || responderSuit === 'spades'

  // 1. Stöd i svararens högfärg (4+) → höjning efter styrka.
  if (rIsMajor && len[responderSuit] >= 4) {
    if (p >= 19) return raise(responderSuit, 4, 'höjning till utgång', p, len[responderSuit])
    if (p >= 16) return raise(responderSuit, 3, 'hopphöjning (inbjudan)', p, len[responderSuit])
    return raise(responderSuit, 2, 'enkel höjning', p, len[responderSuit])
  }

  // 2. Visa en 4-korts högfärg billigt på 1-läget (1♣–1♦–1♥, 1♣–1♥–1♠ …).
  for (const s of ['hearts', 'spades'] as Suit[]) {
    if (s !== opened && s !== responderSuit && len[s] >= 4 && rankOf(s) > rankOf(responderSuit)) {
      return { call: `1${BID[s]}`, rule: 'ny färg (1-läget)', explanation: `${p} hp, 4+ ${NAME[s]} → 1${SYM[s]} (ny färg, krav 1 rond).` }
    }
  }

  // 3. Reverse: 16+, en högre ny färg (4+) med längre första färg → 2 i den högre.
  if (p >= 16) {
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) > rankOf(opened) && len[z] >= 4 && len[opened] > len[z]) {
        return { call: `2${BID[z]}`, rule: 'reverse', explanation: `${p} hp, längre ${NAME[opened]} + 4+ ${NAME[z]} → 2${SYM[z]} (reverse, 16+, krav).` }
      }
    }
  }

  // 4. Balanserad utan högfärg att visa: NT-stegen (15–17 hade öppnat 1NT).
  if (bal) {
    if (p >= 18 && p <= 19) return { call: '2NT', rule: '2NT (18–19)', explanation: `${p} hp balanserad → 2NT (18–19, inbjuder 3NT).` }
    return { call: '1NT', rule: '1NT (12–14)', explanation: `${p} hp balanserad → 1NT (12–14).` }
  }

  // 5. Rebjuda egen 6-korts färg.
  if (len[opened] >= 6) {
    if (p >= 16 && p <= 18) return { call: `3${BID[opened]}`, rule: 'hopp i egen färg (inbjudan)', explanation: `${p} hp med 6+ ${NAME[opened]} → 3${SYM[opened]} (16–18, inbjudan).` }
    return { call: `2${BID[opened]}`, rule: 'rebjuden färg', explanation: `${p} hp med 6+ ${NAME[opened]} → 2${SYM[opened]} (minimum 12–15).` }
  }

  // 6. Ny lägre färg på 2-läget (naturlig, minimum, ej reverse): längst först.
  {
    let best: Suit | null = null
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) < rankOf(opened) && len[z] >= 4) {
        if (best === null || len[z] > len[best]) best = z
      }
    }
    if (best) return { call: `2${BID[best]}`, rule: 'ny färg (2-läget)', explanation: `${p} hp, naturlig 4+ ${NAME[best]} → 2${SYM[best]} (minimum, ej krav).` }
  }

  // 7. Reservfall: stöd i svararens minor, annars 1NT (flaggas som förenkling).
  if (!rIsMajor && len[responderSuit] >= 4) {
    const lvl = p >= 16 ? 3 : 2
    return { call: `${lvl}${BID[responderSuit]}`, rule: 'höjning av minor', explanation: `${p} hp, ${len[responderSuit]} stöd → ${lvl}${SYM[responderSuit]} (höjning).` }
  }
  return { call: '1NT', rule: 'oklart', explanation: `${p} hp – motorn hittar inget tydligt återbud (förenkling).`, uncertain: true }
}

function raise(suit: Suit, level: number, rule: string, p: number, support: number): ResponseResult {
  return { call: `${level}${BID[suit]}`, rule, explanation: `${p} hp, ${support} stöd → ${level}${SYM[suit]} (${rule}).` }
}
