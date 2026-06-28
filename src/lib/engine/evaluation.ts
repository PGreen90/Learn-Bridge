// Handvärdering enligt Marty Bergens Adjust-3-metod (se docs/handvardering.md).
// Rena funktioner: hand in → uppdelad värdering ut. Ingen budlogik här, och
// det här lagret STYR INTE budbesluten – det visar bara totalpoängen (TP)
// bredvid honnörspoängen (Hp) så att ägaren ser *varför* en hand är värd mer
// eller mindre än de råa honnörspoängen.

import type { Hand, Rank, Suit } from '../../types/bridge'
import { hcp, lengths, shape } from './hand'

const RANK_HIGH_TO_LOW: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const TOP5: Rank[] = ['A', 'K', 'Q', 'J', '10']
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

/** Korten per färg, sorterade högst → lägst. */
function ranksBySuit(hand: Hand): Record<Suit, Rank[]> {
  const out: Record<Suit, Rank[]> = { spades: [], hearts: [], diamonds: [], clubs: [] }
  for (const c of hand) out[c.suit].push(c.rank)
  for (const s of SUITS) out[s].sort((a, b) => RANK_HIGH_TO_LOW.indexOf(a) - RANK_HIGH_TO_LOW.indexOf(b))
  return out
}

/** Nivå 1 – startpoängens delar (det öppnaren behöver för att öppna). */
export interface Evaluation {
  /** Honnörspoäng (Hp): A=4, K=3, D=2, kn=1. */
  hp: number
  /** Steg 2: justering för över/undervärderade honnörer (kan vara negativ). */
  adjust3: number
  /** Steg 3: +1 per kort i en färg över 4. */
  length: number
  /** Steg 4: −1 per tvivelaktig honnör-dubbleton/-singel (≤ 0). */
  dubiousHonors: number
  /** Steg 5: +1 per färg (4+ kort) med 3+ av topp-5 (A K D kn 10). */
  suitQuality: number
  /** Steg 6: −1 för flata former 4-3-3-3 / 5-3-3-2 / 6-3-2-2 / 7-2-2-2 (≤ 0). */
  flatness: number
  /** Summan av delarna = startpoäng = standard-TP utan känd fit. */
  startingPoints: number
}

/** Steg 2: Adjust-3. Ess+tior (undervärderade) mot damer+knektar (övervärderade). */
function adjust3Value(hand: Hand): number {
  let under = 0
  let over = 0
  for (const c of hand) {
    if (c.rank === 'A' || c.rank === '10') under++
    else if (c.rank === 'Q' || c.rank === 'J') over++
  }
  const diff = Math.abs(under - over)
  const magnitude = diff <= 2 ? 0 : diff <= 5 ? 1 : 2
  if (magnitude === 0) return 0
  return under > over ? magnitude : -magnitude // fler ess/tior → +, fler D/kn → −
}

/** Steg 3: längdpoäng = +1 per kort över 4 i varje färg. */
function lengthPoints(hand: Hand): number {
  return Object.values(lengths(hand)).reduce((sum, l) => sum + Math.max(0, l - 4), 0)
}

/** Är en dubbleton (2 kort) tvivelaktig? AK, AD, Ax, Kx undantas. */
function isDubiousDoubleton(ranks: Rank[]): boolean {
  const [top, second] = ranks
  if (top === 'A') return second === 'J' // bara AkN (AK, AD, Ax undantas)
  if (top === 'K') return second === 'Q' || second === 'J' // KD, KkN (Kx undantas)
  if (top === 'Q') return true // DkN och Dx
  if (top === 'J') return true // kNx
  return false
}

/** Steg 4: −1 per tvivelaktig honnör-dubbleton (AkN/KD/KkN/DkN/Dx/kNx) och -singel (K/D/kn). */
function dubiousHonorPoints(hand: Hand): number {
  const bySuit = ranksBySuit(hand)
  let penalty = 0
  for (const s of SUITS) {
    const ranks = bySuit[s]
    if (ranks.length === 1) {
      if (ranks[0] === 'K' || ranks[0] === 'Q' || ranks[0] === 'J') penalty -= 1
    } else if (ranks.length === 2 && isDubiousDoubleton(ranks)) {
      penalty -= 1
    }
  }
  return penalty
}

/** Steg 5: +1 per kvalitetsfärg = 4+ kort med minst 3 av topp-5 (A K D kn 10). */
function suitQualityPoints(hand: Hand): number {
  const bySuit = ranksBySuit(hand)
  let bonus = 0
  for (const s of SUITS) {
    const ranks = bySuit[s]
    if (ranks.length >= 4 && ranks.filter((r) => TOP5.includes(r)).length >= 3) bonus += 1
  }
  return bonus
}

/** Steg 6: −1 för flata former i färgkontrakt. */
function flatnessPoints(hand: Hand): number {
  const s = shape(hand).join('')
  return s === '4333' || s === '5332' || s === '6322' || s === '7222' ? -1 : 0
}

/** Nivå 1: startpoäng (TP utan känd fit). Returnerar hela uträkningen. */
export function startingPoints(hand: Hand): Evaluation {
  const hp = hcp(hand)
  const adjust3 = adjust3Value(hand)
  const length = lengthPoints(hand)
  const dubiousHonors = dubiousHonorPoints(hand)
  const suitQuality = suitQualityPoints(hand)
  const flatness = flatnessPoints(hand)
  return {
    hp,
    adjust3,
    length,
    dubiousHonors,
    suitQuality,
    flatness,
    startingPoints: hp + adjust3 + length + dubiousHonors + suitQuality + flatness,
  }
}

/** Nivå 2 – svararens stödpoäng vid fit i en (oftast hög-)färg. */
export interface DummyEvaluation extends Evaluation {
  /** Kortfärgspoäng: dubbleton +1 (var), singel +2 (+3 m. 4+ trumf), renons = antal trumf. */
  shortness: number
  /** startpoäng + kortfärgspoäng. */
  dummyPoints: number
}

/** Nivå 2: stödpoäng. `trump` = den färg ni hittat fit i. */
export function dummyPoints(hand: Hand, trump: Suit): DummyEvaluation {
  const base = startingPoints(hand)
  const len = lengths(hand)
  const trumps = len[trump]
  let shortness = 0
  for (const s of SUITS) {
    if (s === trump) continue
    const l = len[s]
    if (l === 2) shortness += 1
    else if (l === 1) shortness += trumps >= 4 ? 3 : 2
    else if (l === 0) shortness += trumps // renons = antal trumf
  }
  return { ...base, shortness, dummyPoints: base.startingPoints + shortness }
}

/** Nivå 3 – öppnarens Bergenpoäng efter att fit hittats. */
export interface BergenEvaluation extends Evaluation {
  /** Extra trumflängd: +1 per trumf efter den femte. */
  extraTrump: number
  /** Sidofärger: +1 per 4- eller 5-korts sidofärg. */
  sideSuits: number
  /** Kortfärg (endast färgkontrakt): +1 för 2–3 dubbletonger totalt, singel +2, renons +4. */
  shortSuit: number
  /** startpoäng + extra trumf + sidofärger + kortfärg. */
  bergenPoints: number
}

/** Nivå 3: Bergenpoäng. `notrump` = true i sangkontrakt (ingen kortfärg räknas). */
export function bergenPoints(hand: Hand, trump: Suit, opts: { notrump?: boolean } = {}): BergenEvaluation {
  const base = startingPoints(hand)
  const len = lengths(hand)
  const trumps = len[trump]
  const extraTrump = trumps >= 6 ? trumps - 5 : 0
  let sideSuits = 0
  let doubletons = 0
  let shortSuit = 0
  for (const s of SUITS) {
    if (s === trump) continue
    const l = len[s]
    if (l === 4 || l === 5) sideSuits += 1
    if (!opts.notrump) {
      if (l === 2) doubletons += 1
      else if (l === 1) shortSuit += 2
      else if (l === 0) shortSuit += 4
    }
  }
  if (!opts.notrump && doubletons >= 2) shortSuit += 1 // +1 för 2 eller 3 dubbletonger (inte var)
  return {
    ...base,
    extraTrump,
    sideSuits,
    shortSuit,
    bergenPoints: base.startingPoints + extraTrump + sideSuits + shortSuit,
  }
}
