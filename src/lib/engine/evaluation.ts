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

/**
 * Gemensam fitklassificering (FAS 3 punkt 11). EN sanningskälla för *hur bra*
 * stödet är i partnerns (oftast öppnade) färg, så att Bergen, Jacoby 2NT,
 * splinter och game try alla frågar SAMMA funktion i stället för att räkna trumf
 * ad hoc (`support >= 4`, `=== 3` …) var för sig. Klasserna följer
 * felsökningsplanens FAS 3:
 *
 *   none        0–1 trumf  – ingen spelfit
 *   two         2 trumf    – dubbelton-stöd (ingen höjning på egen hand)
 *   three       3 trumf    – platt/svagt (enkel höjnings-material)
 *   good-three  3 trumf    – MED en trumfhonnör (E/K/D) ELLER en kort sidofärg
 *                            (singel/renons = ruffvärde). En dubbelton räknas
 *                            INTE – den är för vanlig och ger knappt ruff med
 *                            bara 3 trumf. "Bra 3-stöd" får därför lyfta en
 *                            höjning där platt 3-stöd inte gör det.
 *   four        exakt 4 trumf
 *   five-plus   5+ trumf
 *
 * OBS: bara antal + kvalitet på själva fiten. Poängen (stöd-/Bergenpoäng) och
 * VILKET bud det blir hör hemma i budlagret – den här funktionen säger inget om
 * hp eller nivå.
 */
export type FitClass = 'none' | 'two' | 'three' | 'good-three' | 'four' | 'five-plus'

export interface FitEvaluation {
  /** Antal trumf (kort i partnerns/den öppnade färgen). */
  trumps: number
  /** Fitklassen enligt FAS 3 punkt 11. */
  fit: FitClass
  /** true om vi har spelfit (3+ trumf) – höjbart. */
  hasFit: boolean
  /** true för `four` och `five-plus` – 4+ trumf (Bergen/Jacoby-material). */
  hasFourPlus: boolean
}

/** Nivå 0: klassificera fiten i `trump` (partnerns färg). Se `FitClass`. */
export function classifyFit(hand: Hand, trump: Suit): FitEvaluation {
  const bySuit = ranksBySuit(hand)
  const trumpRanks = bySuit[trump]
  const trumps = trumpRanks.length
  const len = lengths(hand)

  let fit: FitClass
  if (trumps <= 1) fit = 'none'
  else if (trumps === 2) fit = 'two'
  else if (trumps === 3) {
    const trumpHonor = trumpRanks.some((r) => r === 'A' || r === 'K' || r === 'Q')
    const ruffValue = SUITS.some((s) => s !== trump && len[s] <= 1) // singel/renons
    fit = trumpHonor || ruffValue ? 'good-three' : 'three'
  } else if (trumps === 4) fit = 'four'
  else fit = 'five-plus'

  return { trumps, fit, hasFit: trumps >= 3, hasFourPlus: trumps >= 4 }
}

/**
 * Slamvärdering (FAS 4 punkt 18): *nedvärdera K och D mittemot partnerns
 * kortfärg.* När partnern visat en singel/renons i en sidofärg (splinter,
 * Jacoby-kortfärg, game try-kortfärg) sitter dina egna honnörer där mestadels
 * döda – partnern ruffar färgen, så K/D drar inte hem några stick. Esset behålls
 * (första-rondskontroll), kungen tappar ~2, damen ~2, knekten ~1.
 *
 * Returnerar POÄNGEN att DRA IFRÅN den här handens slampoäng (aldrig negativ).
 * Rent mått – budlagret bestämmer var det används (i praktiken: dra av från den
 * kombinerade slamzon-summan innan man frågar RKC).
 */
export function wastedHonorsOppositeShortness(hand: Hand, partnerShortSuit: Suit): number {
  const ranks = ranksBySuit(hand)[partnerShortSuit]
  let deduct = 0
  for (const r of ranks) {
    if (r === 'K') deduct += 2
    else if (r === 'Q') deduct += 2
    else if (r === 'J') deduct += 1
    // Ess = kontroll, behålls (0). Småkort = redan värdelösa (0).
  }
  return deduct
}

/**
 * Spelstick (eng. *playing tricks*): ungefär hur många stick handen tar på EGEN
 * hand som spelförare, driven av långa starka färger – inte bara honnörspoäng.
 * Svarar på frågan "hur nära utgång är jag själv?", vilket är måttet
 * bridgespelare använder för en stark, distributionell 2♣-öppning: en hand med
 * få HP men många spelstick (t.ex. ♥E K D kn x x + ♠E K ≈ 8 spelstick).
 *
 * Metod (halvstick tillåts, exakta värden är tunbara – se docs/handvardering.md):
 * per färg räknas topphonnörer + långa kort:
 *   EKD=3 · EK=2 · ED=1½ · EknT=1½ · E=1 · KDkn=2 · KD=1 · KknT=1 · Kx(gard.)=½ ·
 *   Dkn=½, plus +1 per kort utöver det tredje i en färg som har en topphonnör
 *   (E/K/D) att etablera de långa korten med. Summan kapas till färgens längd.
 */
export function playingTricks(hand: Hand): number {
  const bySuit = ranksBySuit(hand)
  let total = 0
  for (const s of SUITS) total += suitPlayingTricks(bySuit[s])
  return total
}

/** Spelstick i en enskild färg (kort sorterade högst → lägst). */
function suitPlayingTricks(ranks: Rank[]): number {
  const len = ranks.length
  if (len === 0) return 0
  const has = (r: Rank) => ranks.includes(r)
  const A = has('A'), K = has('K'), Q = has('Q'), J = has('J'), T = has('10')

  let honors: number
  if (A && K && Q) honors = 3
  else if (A && K) honors = 2
  else if (A && Q) honors = 1.5
  else if (A && J && T) honors = 1.5 // E kn 10
  else if (A) honors = 1
  else if (K && Q && J) honors = 2 // K D kn
  else if (K && Q) honors = 1
  else if (K && J && T) honors = 1 // K kn 10
  else if (K && len >= 2) honors = 0.5 // K x (garderad kung)
  else if (Q && J) honors = 0.5
  else honors = 0

  // Långa kort (utöver det tredje) – bara om ess/kung finns att köra hem den
  // långa färgen på (en ensam dam räcker inte för att etablera de långa korten).
  const long = len > 3 && (A || K) ? len - 3 : 0
  return Math.min(len, honors + long)
}

/**
 * Kortfärgspoäng som *väntar* på en fit – endast för visning. Bergens metod
 * räknar ALDRIG korthet i startpoängen (man vet ännu inte om man har trumffit),
 * men vi vill kunna visa ägaren att singel/dubbel/renons inte är glömda, bara
 * uppskjutna. Enkel, trumf-oberoende skattning: dubbleton +1, singel +2,
 * renons +3. Räknas in först i stöd-/Bergenpoängen när fit hittats.
 */
export function deferredShortness(hand: Hand): number {
  const len = lengths(hand)
  let pts = 0
  for (const s of SUITS) {
    if (len[s] === 2) pts += 1
    else if (len[s] === 1) pts += 2
    else if (len[s] === 0) pts += 3
  }
  return pts
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

/**
 * "Nedgradera aldrig"-golvet (ägarens TP-princip, se docs/tp-arbetslista.md):
 * värdera handen till `max(hp, fit-mått)`. Form/korthet får LYFTA ett bud, men
 * aldrig sänka det under hp. Detta är single-source för A/B/C-mönstret som annars
 * var inlinat på fyra ställen (`responses.ts` stödpoäng, `rebids.ts` ×3 Bergenpoäng).
 *
 * `kind`: `'support'` = svararens stödpoäng (`dummyPoints`), `'bergen'` =
 * öppnarens Bergenpoäng (`bergenPoints`). `trump` = den färg fiten finns i.
 */
export interface FlooredPoints {
  /** Råa honnörspoäng = golvet vi aldrig går under. */
  hp: number
  /** Det råa fit-måttet (stöd-/Bergenpoäng) innan golvet. */
  measure: number
  /** `max(hp, measure)` – poängen budbeslutet ska läsa. */
  points: number
  /** true om formen lyfte handen över hp. */
  lifted: boolean
  /** Förklaringstext: `"11 hp / 14 stödp."` vid lyft, annars `"11 hp"`. */
  text: string
}

export function pointsWithFloor(
  hand: Hand,
  trump: Suit,
  kind: 'support' | 'bergen',
  opts: { notrump?: boolean } = {},
): FlooredPoints {
  const hp = hcp(hand)
  const measure =
    kind === 'support'
      ? dummyPoints(hand, trump).dummyPoints
      : bergenPoints(hand, trump, opts).bergenPoints
  const points = Math.max(hp, measure)
  const lifted = points > hp
  const label = kind === 'support' ? 'stödp.' : 'Bergenp.'
  return { hp, measure, points, lifted, text: lifted ? `${hp} hp / ${points} ${label}` : `${hp} hp` }
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
