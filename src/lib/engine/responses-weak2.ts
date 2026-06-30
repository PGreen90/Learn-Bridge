// Budmotorns svar på partnerns svaga tvåöppning 2♦/2♥/2♠ (6-korts färg, 6–11 hp).
// Härlett ur systemboken §4.5. Fyra delar i en ostörd auktion:
//   1. respondToWeakTwo            – svararens första bud (spärrhöjning, ny färg,
//                                    2NT Ogust, 3NT, pass)
//   2. openerRebidAfterOgust       – öppnarens Ogust-svar i steg (min/max + kvalitet)
//   3. openerRebidAfterNewSuit     – öppnarens svar på krav-ny-färg (stöd/rebjud)
//   4. responderPlaceAfterOgust    – svararen placerar kontraktet efter Ogust-svaret
//
// Ogust (minnesregel "Minors are Minimum, 1-2-1-2-3"): topphonnörer = A/K/Q i
// trumffärgen. Minorfärgens placering efter Ogust är svårplacerad (utgång på
// 5-läget) och flaggas som förenkling.

import type { Hand, Rank, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'] // stigande budrang
const rankOf = (s: Suit) => RANK.indexOf(s)
const isMajor = (s: Suit) => s === 'hearts' || s === 'spades'

export function suitOfWeakTwo(call: string): Suit | null {
  return call === '2D' ? 'diamonds' : call === '2H' ? 'hearts' : call === '2S' ? 'spades' : null
}

/** Antal topphonnörer (A/K/Q) i en färg. */
function topHonors(hand: Hand, suit: Suit): number {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  return (['A', 'K', 'Q'] as Rank[]).filter((r) => ranks.includes(r)).length
}

/** Längsta sidofärgen (≠ trumf) med minst `min` kort; lika → högst rankad. */
function longestSide(len: Record<Suit, number>, opened: Suit, min: number): Suit | null {
  let best: Suit | null = null
  for (const s of RANK) {
    if (s === opened || len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankOf(s) > rankOf(best))) best = s
  }
  return best
}

/** Lägsta lagliga nivån för `suit` ovanför ett färgbud på `refLevel` i `refSuit`. */
function levelAbove(suit: Suit, refSuit: Suit, refLevel: number): number {
  return rankOf(suit) > rankOf(refSuit) ? refLevel : refLevel + 1
}

// === 1. Svararens första svar på en svag tvåa =============================

/** Vad svarar man på partnerns svaga 2♦/2♥/2♠? Systembok §4.5. */
export function respondToWeakTwo(hand: Hand, opened: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const sym = SYM[opened]
  const bid = BID[opened]

  // Svaga händer: höj spärren eller passa.
  if (p <= 10) {
    if (support >= 3) {
      return { call: `3${bid}`, rule: 'spärrhöjning', explanation: `${p} hp, ${support} stöd → 3${sym} (spärrhöjning, höjer trycket, ej inbjudan).` }
    }
    return { call: 'P', rule: 'pass', explanation: `${p} hp, ingen utgångschans → pass.` }
  }

  // 11+ med fit → 2NT Ogust (fråga om min/max + färgkvalitet).
  if (support >= 3) {
    return { call: '2NT', rule: 'Ogust', explanation: `${p} hp, ${support} stöd – utgångsintresse → 2NT (Ogust, frågar min/max + kvalitet).` }
  }

  // 11+ utan fit: egen 5+ färg (krav), annars 3NT eller Ogust.
  const side = longestSide(len, opened, 5)
  if (side) {
    const level = levelAbove(side, opened, 2)
    return { call: `${level}${BID[side]}`, rule: 'ny färg (krav)', explanation: `${p} hp med ${len[side]}-korts ${NAME[side]} → ${level}${SYM[side]} (naturlig, krav 1 rond).` }
  }
  if (isBalanced(hand) && p >= 15) {
    return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp balanserad utan fit → 3NT (till spel).` }
  }
  return { call: '2NT', rule: 'Ogust', explanation: `${p} hp – utgångsintresse → 2NT (Ogust, värderar öppnarens färg).` }
}

// === 2. Öppnarens Ogust-svar (steg) =======================================

/** Öppnarens svar på 2NT Ogust: min/max + färgkvalitet, "1-2-1-2-3". §4.5. */
export function openerRebidAfterOgust(hand: Hand, opened: Suit): ResponseResult {
  const p = hcp(hand)
  const tops = topHonors(hand, opened)
  const max = p >= 9 // svag tvåa = 6–11; 6–8 = min, 9–11 = max

  if (!max && tops <= 1) return { call: '3C', rule: 'Ogust: min/dålig', explanation: `${p} hp (min 6–8), ${tops} topphonnör → 3♣.` }
  if (!max) return { call: '3D', rule: 'Ogust: min/bra', explanation: `${p} hp (min 6–8), ${tops} topphonnörer → 3♦.` }
  if (tops <= 1) return { call: '3H', rule: 'Ogust: max/dålig', explanation: `${p} hp (max 9–11), ${tops} topphonnör → 3♥.` }
  if (tops === 2) return { call: '3S', rule: 'Ogust: max/bra', explanation: `${p} hp (max 9–11), 2 topphonnörer → 3♠.` }
  return { call: '3NT', rule: 'Ogust: max/utmärkt', explanation: `${p} hp (max 9–11), alla 3 topphonnörer → 3NT.` }
}

// === 3. Öppnarens svar på krav-ny-färg ====================================

/** Öppnarens återbud efter svararens krav-ny-färg: stöd eller rebjuden färg. §4.5. */
export function openerRebidAfterNewSuit(hand: Hand, opened: Suit, newSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const max = p >= 9

  // Stöd (3+) i svararens nya färg → höj (min = ett steg, max = hopp till utgång).
  if (len[newSuit] >= 3) {
    const responderLevel = levelAbove(newSuit, opened, 2) // nivån svararen bjöd färgen på
    const level = responderLevel + (max ? 2 : 1)
    return { call: `${level}${BID[newSuit]}`, rule: 'rebid: stöd', explanation: `${p} hp, ${len[newSuit]} stöd i ${NAME[newSuit]} → ${level}${SYM[newSuit]}${max ? ' (max, hopp)' : ' (min)'}.` }
  }
  // Annars rebjuda egen 6-korts färg (minimum).
  return { call: `3${BID[opened]}`, rule: 'rebid: egen färg', explanation: `${p} hp, 6 ${NAME[opened]} utan stöd → 3${SYM[opened]} (minimum).` }
}

// === 4. Svararens placering efter Ogust-svaret ============================

/** Svararen placerar kontraktet efter öppnarens Ogust-svar. §4.5. */
export function responderPlaceAfterOgust(hand: Hand, opened: Suit, ogust: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const bid = BID[opened]
  const sym = SYM[opened]
  const max = ogust.rule === 'Ogust: max/dålig' || ogust.rule === 'Ogust: max/bra' || ogust.rule === 'Ogust: max/utmärkt'

  if (isMajor(opened)) {
    if (ogust.rule === 'Ogust: max/utmärkt') return { call: `4${bid}`, rule: 'till spel', explanation: `${p} hp mittemot max + solid färg → 4${sym}.` }
    if (max) return { call: `4${bid}`, rule: 'till spel', explanation: `${p} hp mittemot maximum → 4${sym} (utgång).` }
    return { call: `3${bid}`, rule: 'svararens signoff', explanation: `${p} hp mittemot minimum → 3${sym} (stannar, öppnaren passar).` }
  }

  // Minoröppning (2♦): öppnarens Ogust-svar ligger REDAN på 3-läget (3♣–3NT),
  // så svararens placering måste vara LAGLIG (högre än svaret) – annars pass.
  // Förenkling kring exakt slutkontrakt kvarstår (flaggas).
  if (max) {
    // Sikta utgång (3NT). Är svaret redan 3NT (max/utmärkt) → passa det.
    return ogust.call === '3NT'
      ? { call: 'P', rule: 'svararens pass', explanation: `${p} hp mittemot max – 3NT redan nått → pass.`, uncertain: true }
      : { call: '3NT', rule: 'till spel', explanation: `${p} hp mittemot max → 3NT.`, uncertain: true }
  }
  // Minimum: stanna i trumf. Är svaret redan 3♦ (min/bra) → passa; annars rätta till 3♦.
  return ogust.call === `3${bid}`
    ? { call: 'P', rule: 'svararens pass', explanation: `${p} hp mittemot minimum – 3${sym} redan nått → pass.`, uncertain: true }
    : { call: `3${bid}`, rule: 'svararens signoff', explanation: `${p} hp mittemot minimum → 3${sym} (delkontrakt).`, uncertain: true }
}
