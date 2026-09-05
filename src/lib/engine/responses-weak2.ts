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
      return { call: `3${bid}`, rule: 'spärrhöjning', explanation: `0–10 hp, 3+ stöd → 3${sym} (spärrhöjning, ej inbjudan).` }
    }
    return { call: 'P', rule: 'pass', explanation: `Ingen utgångschans → pass.` }
  }

  // 11+ med fit → 2NT Ogust (fråga om min/max + färgkvalitet).
  if (support >= 3) {
    return { call: '2NT', rule: 'Ogust', explanation: `11+ med 3+ stöd, utgångsintresse → 2NT (Ogust, frågar min/max + kvalitet).` }
  }

  // 11+ utan fit: egen 5+ färg (krav) — på 2-läget från 11 hp, men på 3-LÄGET
  // krävs ~15+ (budet tvingar öppnarens 6–11 hp att bjuda vidare på 3-läget;
  // frö 20260774: 13 hp krävde 3♣ → tvingat 3♥ en bet, fast 2♥ stod).
  const side = longestSide(len, opened, 5)
  if (side) {
    const level = levelAbove(side, opened, 2)
    if (level === 2 || p >= 15) {
      return { call: `${level}${BID[side]}`, rule: 'ny färg (krav)', explanation: `Egen 5+ ${SYM[side]} → ${level}${SYM[side]} (naturlig, krav 1 rond).` }
    }
  }
  if (isBalanced(hand) && p >= 15) {
    return { call: '3NT', rule: '3NT till spel', explanation: `15+ balanserad utan fit → 3NT (till spel).` }
  }
  // 15+ utan billig färg/sang: Ogust värderar öppnarens hand. 11–14 utan fit
  // som inte kan kräva billigt PASSAR — partnerns svaga tvåa står bäst själv.
  if (p >= 15) {
    return { call: '2NT', rule: 'Ogust', explanation: `Utgångsintresse (15+) → 2NT (Ogust, värderar öppnarens färg).` }
  }
  return { call: 'P', rule: 'pass', explanation: `Utan fit och utan billig egen färg → pass (partnerns spärr står bäst själv).` }
}

// === 2. Öppnarens Ogust-svar (steg) =======================================

/** Öppnarens svar på 2NT Ogust: min/max + färgkvalitet, "1-2-1-2-3". §4.5. */
export function openerRebidAfterOgust(hand: Hand, opened: Suit): ResponseResult {
  const p = hcp(hand)
  const tops = topHonors(hand, opened)
  const max = p >= 9 // svag tvåa = 6–11; 6–8 = min, 9–11 = max

  if (!max && tops <= 1) return { call: '3C', rule: 'Ogust: min/dålig', explanation: `Min (6–8), dålig färg (≤1 topphonnör) → 3♣.` }
  if (!max) return { call: '3D', rule: 'Ogust: min/bra', explanation: `Min (6–8), bra färg (2+ topphonnörer) → 3♦.` }
  if (tops <= 1) return { call: '3H', rule: 'Ogust: max/dålig', explanation: `Max (9–11), dålig färg (≤1 topphonnör) → 3♥.` }
  if (tops === 2) return { call: '3S', rule: 'Ogust: max/bra', explanation: `Max (9–11), bra färg (2 topphonnörer) → 3♠.` }
  return { call: '3NT', rule: 'Ogust: max/utmärkt', explanation: `Max (9–11), solid färg (3 topphonnörer) → 3NT.` }
}

// === 3. Öppnarens svar på krav-ny-färg ====================================

/**
 * Öppnarens återbud efter svararens krav-ny-färg: stöd eller rebjuden färg. §4.5.
 * `responseLevel` = nivån svararen bjöd den nya färgen på (standard: billigaste
 * nivån, som boten själv bjuder; en människa kan hoppa, t.ex. 2♦–3♥, och då
 * måste återbudet ligga ÖVER svaret — motorbytet etapp 3 familj 3, 2026-09-05).
 */
export function openerRebidAfterNewSuit(hand: Hand, opened: Suit, newSuit: Suit, responseLevel = levelAbove(newSuit, opened, 2)): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const max = p >= 9

  // Stöd (3+) i svararens nya färg → höj: min = ett steg, max = hopp — men
  // aldrig förbi utgången (2♠–3♥ med max → 4♥, inte 5♥; facit frö 20271048).
  if (len[newSuit] >= 3) {
    const game = isMajor(newSuit) ? 4 : 5
    const level = max ? Math.max(responseLevel + 1, Math.min(responseLevel + 2, game)) : responseLevel + 1
    return { call: `${level}${BID[newSuit]}`, rule: 'rebid: stöd', explanation: `3+ stöd i ${SYM[newSuit]} → ${level}${SYM[newSuit]}${max ? ' (max, hopp)' : ' (min)'}.` }
  }
  // Annars rebjuda egen 6-korts färg (minimum) billigast över svaret.
  const own = levelAbove(opened, newSuit, responseLevel)
  return { call: `${own}${BID[opened]}`, rule: 'rebid: egen färg', explanation: `6 ${SYM[opened]} utan stöd → ${own}${SYM[opened]} (minimum).` }
}

// === 4. Svararens placering efter Ogust-svaret ============================

/** Svararen placerar kontraktet efter öppnarens Ogust-svar. §4.5. */
export function responderPlaceAfterOgust(hand: Hand, opened: Suit, ogust: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const bid = BID[opened]
  const sym = SYM[opened]
  const max = ogust.rule === 'Ogust: max/dålig' || ogust.rule === 'Ogust: max/bra' || ogust.rule === 'Ogust: max/utmärkt'

  if (isMajor(opened)) {
    if (ogust.rule === 'Ogust: max/utmärkt') return { call: `4${bid}`, rule: 'till spel', explanation: `Mittemot max + solid färg → 4${sym}.` }
    if (max) return { call: `4${bid}`, rule: 'till spel', explanation: `Mittemot maximum → 4${sym} (utgång).` }
    // Svararens EGEN styrka kan bära utgång även mittemot en MINIMUM svag tvåa:
    // ~19+ hp + partnerns 6-korts färg ≈ utgång oavsett öppnarens tier (felrapport
    // #22: Öst hade 22 hp och stack i 3♠). Med trumfstöd (3+) → utgång i färgen;
    // utan fit (kort trumf) → 3NT och låt partnerns långfärg ge sticken.
    if (p >= 19) {
      return len[opened] >= 3
        ? { call: `4${bid}`, rule: 'till spel', explanation: `Stark hand (19+) + trumfstöd → 4${sym} (utgång, även mittemot minimum).` }
        : { call: '3NT', rule: 'till spel (3NT)', explanation: `Stark hand (19+) men kort trumf → 3NT (partnerns långfärg ger stick).` }
    }
    return { call: `3${bid}`, rule: 'svararens signoff', explanation: `Mittemot minimum → 3${sym} (stannar, öppnaren passar).` }
  }

  // Minoröppning (2♦): öppnarens Ogust-svar ligger REDAN på 3-läget (3♣–3NT),
  // så svararens placering måste vara LAGLIG (högre än svaret) – annars pass.
  // Förenkling kring exakt slutkontrakt kvarstår (flaggas).
  if (max) {
    // Sikta utgång (3NT). Är svaret redan 3NT (max/utmärkt) → passa det.
    return ogust.call === '3NT'
      ? { call: 'P', rule: 'svararens pass', explanation: `Mittemot max – 3NT redan nått → pass.`, uncertain: true }
      : { call: '3NT', rule: 'till spel', explanation: `Mittemot max → 3NT.`, uncertain: true }
  }
  // Minimum: stanna i trumf. Är svaret redan 3♦ (min/bra) → passa; annars rätta till 3♦.
  return ogust.call === `3${bid}`
    ? { call: 'P', rule: 'svararens pass', explanation: `Mittemot minimum – 3${sym} redan nått → pass.`, uncertain: true }
    : { call: `3${bid}`, rule: 'svararens signoff', explanation: `Mittemot minimum → 3${sym} (delkontrakt).`, uncertain: true }
}
