// Punkt 18–20: slamverktyg, systembok §6.1–6.5.
//
//   §6.1  1430 RKC Blackwood   – nyckelkortsfråga (4 ess + trumfkung)
//   §6.1  Trumfdam-fråga       – efter 5♣/5♦-svaret
//   §6.2  Cue-bid (kontrollbud)– billigaste första-rondskontroll uppåt
//   §6.3  Sjöbergs 5NT         – kungfråga (visar VILKEN kung)
//   §6.4  Gerber               – ess-fråga (4♣) över NT, kungfråga (5♣)
//   §6.5  Exclusion Blackwood  – nyckelkort utom esset i renonsfärgen
//
// Dessa är ask/svar-konventioner som lever djupt i en auktion (efter att trumf
// är överenskommen). De är byggda som rena motorfunktioner med egna tester –
// budmotorns "black box"-bitar. Att låta en slumpad auktion växa ända hit kräver
// ett djupare auktionslager (öppnarens/svararens 3:e–4:e bud) som tas separat;
// tills dess anropas de direkt (och av testerna). Nivåplacering antar det vanliga
// fallet: trumf överenskommen, 4NT/cue på 4-läget.

import type { Hand, Suit } from '../../types/bridge'
import { lengths } from './hand'
import type { ResponseResult } from './responses'

const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/** Budstege på 5-läget och uppåt (för steg-svar i Exclusion). */
const LADDER = [
  '5C', '5D', '5H', '5S', '5NT',
  '6C', '6D', '6H', '6S', '6NT',
  '7C', '7D', '7H', '7S', '7NT',
]
const callNStepsAbove = (start: string, n: number): string => LADDER[LADDER.indexOf(start) + n]

// === Kortvärderings-hjälpare ===============================================

const hasRank = (hand: Hand, suit: Suit, rank: string) => hand.some((c) => c.suit === suit && c.rank === rank)
export const countAces = (hand: Hand) => hand.filter((c) => c.rank === 'A').length
export const countKings = (hand: Hand) => hand.filter((c) => c.rank === 'K').length

/** Nyckelkort för RKC: de 4 essen + trumfkungen (0–5). */
export function keycards(hand: Hand, trump: Suit): number {
  return countAces(hand) + (hasRank(hand, trump, 'K') ? 1 : 0)
}

/** Trumfdam "räknas" om man har damen ELLER 5+ trumf (längden ersätter damen). */
export function hasTrumpQueen(hand: Hand, trump: Suit): boolean {
  return hasRank(hand, trump, 'Q') || lengths(hand)[trump] >= 5
}

/** Första-rondskontroll i en färg: ess eller renons. */
export function firstRoundControl(hand: Hand, suit: Suit): boolean {
  return hasRank(hand, suit, 'A') || lengths(hand)[suit] === 0
}

// === §6.1 1430 RKC Blackwood ===============================================

/** Svar på 4NT (1430 RKC) givet överenskommen trumf. */
export function respondToRKC(hand: Hand, trump: Suit): ResponseResult {
  const kc = keycards(hand, trump)
  if (kc === 0 || kc === 3) return { call: '5D', rule: '1430 RKC', explanation: `${kc} nyckelkort → 5♦ (0 eller 3).` }
  if (kc === 1 || kc === 4) return { call: '5C', rule: '1430 RKC', explanation: `${kc} nyckelkort → 5♣ (1 eller 4).` }
  // kc === 2 || kc === 5
  return hasTrumpQueen(hand, trump)
    ? { call: '5S', rule: '1430 RKC', explanation: `${kc} nyckelkort MED trumfdam → 5♠.` }
    : { call: '5H', rule: '1430 RKC', explanation: `${kc} nyckelkort utan trumfdam → 5♥.` }
}

/** Svar på trumfdam-frågan (billigaste icke-trumf efter 5♣/5♦). §6.1. */
export function respondToQueenAsk(hand: Hand, trump: Suit): ResponseResult {
  if (!hasTrumpQueen(hand, trump)) {
    return { call: `5${LETTER[trump]}`, rule: 'trumfdam: nej', explanation: `ingen trumfdam → tillbaka till trumf (5${SYM[trump]}).` }
  }
  // Dam finns: visa billigaste sidokung, annars 5NT (dam utan sidokung).
  const kingSuit = RANK_ORDER.find((s) => s !== trump && hasRank(hand, s, 'K'))
  if (!kingSuit) return { call: '5NT', rule: 'trumfdam: ja, ingen sidokung', explanation: 'trumfdam men ingen sidokung → 5NT.' }
  const level = rankIdx(kingSuit) > rankIdx(trump) ? 5 : 6
  return { call: `${level}${LETTER[kingSuit]}`, rule: 'trumfdam: ja + kung', explanation: `trumfdam + kung i ${NAME[kingSuit]} → ${level}${SYM[kingSuit]}.` }
}

// === §6.2 Cue-bid (kontrollbud) ============================================

/**
 * Billigaste första-rondskontroll att cue-budda (uppåt), över ev. redan visad
 * färg. Antar att trumf är överenskommen och att cue-rundan ligger på 4-läget.
 * null = ingen (ny) kontroll att visa → man avstår (passar/avslutar/4NT).
 */
export function cheapestCueBid(hand: Hand, trump: Suit, aboveSuit: Suit | null = null): ResponseResult | null {
  for (const s of RANK_ORDER) {
    if (s === trump) continue
    if (aboveSuit && rankIdx(s) <= rankIdx(aboveSuit)) continue
    if (firstRoundControl(hand, s)) {
      const why = lengths(hand)[s] === 0 ? 'renons' : 'ess'
      return { call: `4${LETTER[s]}`, rule: 'cue-bid', explanation: `första-rondskontroll (${why}) i ${NAME[s]} → 4${SYM[s]}.` }
    }
  }
  return null
}

// === §6.3 Sjöbergs 5NT (kungfråga) =========================================

/** Svar på Sjöbergs 5NT-kungfråga: visar VILKEN kung (billigaste först). §6.3. */
export function respondToKingAsk(hand: Hand, trump: Suit): ResponseResult {
  const kingSuits = RANK_ORDER.filter((s) => s !== trump && hasRank(hand, s, 'K'))
  if (kingSuits.length === 0) return { call: `6${LETTER[trump]}`, rule: 'Sjöberg 5NT', explanation: `ingen sidokung → 6 i trumf (6${SYM[trump]}).` }
  if (kingSuits.length >= 2) return { call: `7${LETTER[trump]}`, rule: 'Sjöberg 5NT', explanation: `två+ användbara kungar → 7 i trumf (7${SYM[trump]}).` }
  const s = kingSuits[0]
  return { call: `6${LETTER[s]}`, rule: 'Sjöberg 5NT', explanation: `kungen i ${NAME[s]} → 6${SYM[s]}.` }
}

// === §6.4 Gerber (ess-/kungfråga över NT) ==================================

/** Svar på Gerber 4♣ (ess-fråga över naturlig NT). §6.4. */
export function respondToGerber(hand: Hand): ResponseResult {
  const a = countAces(hand)
  if (a === 0 || a === 4) return { call: '4D', rule: 'Gerber', explanation: `${a} ess → 4♦ (0 eller 4).` }
  if (a === 1) return { call: '4H', rule: 'Gerber', explanation: '1 ess → 4♥.' }
  if (a === 2) return { call: '4S', rule: 'Gerber', explanation: '2 ess → 4♠.' }
  return { call: '4NT', rule: 'Gerber', explanation: '3 ess → 4NT.' }
}

/** Svar på Gerber-kungfrågan 5♣ (efter ess-svaret). §6.4. */
export function respondToGerberKingAsk(hand: Hand): ResponseResult {
  const k = countKings(hand)
  if (k === 0 || k === 4) return { call: '5D', rule: 'Gerber kungfråga', explanation: `${k} kungar → 5♦ (0 eller 4).` }
  if (k === 1) return { call: '5H', rule: 'Gerber kungfråga', explanation: '1 kung → 5♥.' }
  if (k === 2) return { call: '5S', rule: 'Gerber kungfråga', explanation: '2 kungar → 5♠.' }
  return { call: '5NT', rule: 'Gerber kungfråga', explanation: '3 kungar → 5NT.' }
}

// === §6.5 Exclusion Blackwood (voidwood) ===================================

/** Nyckelkort för Exclusion: ess (utom renonsfärgens) + trumfkung. */
export function exclusionKeycards(hand: Hand, trump: Suit, voidSuit: Suit): number {
  const aces = hand.filter((c) => c.rank === 'A' && c.suit !== voidSuit).length
  return aces + (hasRank(hand, trump, 'K') ? 1 : 0)
}

/**
 * Svar på Exclusion (hopp till 5-läget i renonsfärgen). Steg-svar (1430-steg)
 * räknat över själva exclusion-budet 5{renonsfärg}. §6.5.
 */
export function respondToExclusion(hand: Hand, trump: Suit, voidSuit: Suit): ResponseResult {
  const kc = exclusionKeycards(hand, trump, voidSuit)
  const q = hasTrumpQueen(hand, trump)
  // Steg: 1=(1/4), 2=(0/3), 3=(2 utan dam), 4=(2 med dam).
  const step = kc === 1 || kc === 4 ? 1 : kc === 0 || kc === 3 ? 2 : q ? 4 : 3
  const call = callNStepsAbove(`5${LETTER[voidSuit]}`, step)
  return { call, rule: 'Exclusion', explanation: `${kc} nyckelkort (esset i ${NAME[voidSuit]} borträknat)${q ? ' med trumfdam' : ''} → steg ${step} (${call}).` }
}
