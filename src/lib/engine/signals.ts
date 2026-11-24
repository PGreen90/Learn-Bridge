// §8 Markeringar & utspel – rena, testade encoders av försvarets signaler.
// Härlett ur systemboken §8. Vi spelar:
//   • RÄTTVÄND markering (ägarbeslut 2026-11-23 — boken sa förr "omvänd", det
//     var fel): attityd högt=gillar/lågt=ogillar; räkning högt-lågt=jämnt /
//     lågt-högt=udda (§8.1).
//   • Lavinthal-sak: första saket visar färgpreferens – högt=högre övriga
//     färgen, lågt=lägre (§8.2).
//   • Utspel: honnörsutspel = topp av sekvens (AK→A, KQ→K, QJ→Q, JT→J, T9→T),
//     annars spotkort 3:e bästa (jämn längd) / 5:e=lägsta (udda längd) (§8.3).
//
// Det här är encoders: de väljer VILKET kort som bär en viss signal.
// `defensiveSignalCard` längst ned kapslar encoders + en konservativ SPARE-
// beräkning (säkerhet) så bottarna kan lägga markeringar utan att en signal
// någonsin kostar ett stick. Att LÄSA motpartens signaler (decode) hör ihop med
// DDS (punkt 28, signal-decode.ts).

import type { Card, Rank } from '../../types/bridge'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)

function highToLow(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => rankVal(b.rank) - rankVal(a.rank))
}
function lowest(cards: Card[]): Card {
  return cards.reduce((lo, c) => (rankVal(c.rank) < rankVal(lo.rank) ? c : lo))
}
function highest(cards: Card[]): Card {
  return cards.reduce((hi, c) => (rankVal(c.rank) > rankVal(hi.rank) ? c : hi))
}

/** Längden på den sammanhängande löpan (kort i följd) som startar på index `i`. */
function runLengthFrom(sorted: Card[], i: number): number {
  let run = 1
  while (i + run < sorted.length && rankVal(sorted[i + run - 1].rank) - rankVal(sorted[i + run].rank) === 1) {
    run++
  }
  return run
}

/**
 * §8.3 Honnörsutspel. Returnerar kortet att spela ut, eller `null` om färgen
 * saknar en ledbar sekvens (då tar spotkortsutspelet över).
 *
 * Två fall (hål B, docs/utspel-teori.md §3a):
 *  1. **Topp-sekvens** – sammanhängande löpa på ≥2 kort från högsta kortet, med
 *     toppen TIA eller högre → led toppen (AK→A, KQ→K, QJ→Q, JT→J, KQJ→K, och
 *     sedan ägarbeslut 2026-11-23 även tian från 10-9-8 och 10-9-x).
 *  2. **Inre/bruten sekvens** – en hög honnör (J+) med ett glapp ner till en
 *     sammanhängande löpa på ≥2 kort vars topp är en honnör (10+) → led toppen av
 *     den INRE löpan (KJ10→J, K109→10, Q109→10, AJ10→J, AQJ10→Q, AQJ→Q). Detta
 *     är den klassiska inre-sekvens-doktrinen: den höga honnören ligger kvar och
 *     fångar/finessar senare medan den inre löpan pressar fram motståndarnas kort.
 */
export function honorLead(suitCards: Card[]): Card | null {
  if (suitCards.length < 2) return null
  const sorted = highToLow(suitCards)
  // 1. Topp-sekvens.
  if (runLengthFrom(sorted, 0) >= 2 && rankVal(sorted[0].rank) >= rankVal('10')) return sorted[0]
  // 2. Inre sekvens: kräver en hög honnör överst och en honnörsledd inre löpa.
  if (rankVal(sorted[0].rank) < rankVal('J')) return null
  for (let i = 1; i < sorted.length; ) {
    const run = runLengthFrom(sorted, i)
    if (run >= 2 && rankVal(sorted[i].rank) >= rankVal('10')) return sorted[i]
    i += run
  }
  return null
}

/**
 * §8.3 Spotkortsutspel – 3:e bästa från jämn längd, 5:e bästa (= lägsta) från
 * udda längd. Dubbelton (jämn men < 3 kort) → högsta (topp av dubbelton).
 * Singelton → kortet självt.
 */
export function spotLead(suitCards: Card[]): Card {
  const sorted = highToLow(suitCards)
  const n = sorted.length
  if (n === 1) return sorted[0]
  if (n % 2 === 0) return n >= 4 ? sorted[2] : sorted[0] // 3:e bästa; dubbelton → högsta
  return sorted[n - 1] // udda → lägsta (5:e bästa)
}

/** §8.3 Utspel ur EN färg: honnörsutspel om sekvens finns, annars spotkort. */
export function leadFromSuit(suitCards: Card[]): Card {
  return honorLead(suitCards) ?? spotLead(suitCards)
}

/**
 * §8.1 Attityd (rättvänd): HÖGT kort = uppmuntrar, lågt kort = avskräcker.
 * `spare` = de kort du kan avvara i färgen. Returnerar kortet att lägga.
 */
export function attitudeCard(spare: Card[], encourage: boolean): Card {
  return encourage ? highest(spare) : lowest(spare)
}

/**
 * §8.1 Räkning (rättvänd): första kortet är HÖGT vid JÄMNT antal (högt-lågt)
 * och lågt vid UDDA antal (lågt-högt).
 */
export function countCard(spare: Card[], evenLength: boolean): Card {
  return evenLength ? highest(spare) : lowest(spare)
}

/**
 * §8.2 Lavinthal-sak: första saket visar färgpreferens. Högt kort = vill ha den
 * HÖGRE av de övriga färgerna, lågt kort = den LÄGRE. `discardSuitCards` = de
 * kort du sakar i (en färg du inte vill ha).
 */
export function lavinthalDiscard(discardSuitCards: Card[], wantHigher: boolean): Card {
  return wantHigher ? highest(discardSuitCards) : lowest(discardSuitCards)
}

// --- Säkerhetskärnan: spare-beräkning + encoder-val (markeringar Steg 0) ------
//
// En markering får ALDRIG kosta ett stick. Idag lägger botten lägsta kortet; en
// markering kan lägga ett HÖGRE spotkort (uppmuntra/jämnt/Lavinthal-hög). Därför
// väljer encodern bara bland SPARE – kort jag ärligt kan avvara, som bevisligen
// aldrig kan bli/kosta ett stick. Säkerhet och signal är ortogonala: den anropande
// koden (play-bot) har redan valt en SÄKER färg; här väljs kortet inom den.

/** Honnörsgräns för skyddssyfte: knekt eller högre (J+) skyddas alltid. */
const HONOR = rankVal('J')

/** Alla ranker i färgen strikt högre än `rank`. */
function higherRanks(rank: Rank): Rank[] {
  return RANK_LOW_TO_HIGH.slice(rankVal(rank) + 1)
}

/**
 * Säker vinnare i färgen (ärlig räkning): inget HÖGRE kort är ospelat och utanför
 * min egen hand. `mine` = mina kort i färgen, `played` = alla spelade kort.
 */
function sureWinnerInSuit(card: Card, mine: Card[], played: Card[]): boolean {
  for (const r of higherRanks(card.rank)) {
    const seen =
      played.some((c) => c.suit === card.suit && c.rank === r) || mine.some((c) => c.rank === r)
    if (!seen) return false
  }
  return true
}

/**
 * Spare = kort jag kan avvara utan att riskera ett stick. Ett kort SKYDDAS (är
 * inte spare) om det är: en honnör (J+), en säker vinnare, eller ingår i den
 * sammanhängande topp-sekvensen ledd av en honnör (J-10-9 kan promoveras). Allt
 * annat (rena små spotkort) är spare. Konservativt med flit – hellre färre
 * signaler än ett tappat stick.
 */
function spareCards(mine: Card[], played: Card[]): Card[] {
  const desc = highToLow(mine)
  const protectedRanks = new Set<Rank>()
  // Honnörsledd topp-sekvens (kan promoveras till stick): skydda hela löpan.
  if (desc.length > 0 && rankVal(desc[0].rank) >= HONOR) {
    protectedRanks.add(desc[0].rank)
    for (let i = 1; i < desc.length; i++) {
      if (rankVal(desc[i - 1].rank) - rankVal(desc[i].rank) === 1) protectedRanks.add(desc[i].rank)
      else break
    }
  }
  return mine.filter((c) => {
    if (rankVal(c.rank) >= HONOR) return false // honnör skyddas
    if (protectedRanks.has(c.rank)) return false // honnörsledd sekvens skyddas
    if (sureWinnerInSuit(c, mine, played)) return false // säker vinnare skyddas
    return true
  })
}

/**
 * GARDREGELN (ägarbeslut 2026-07-29, skärpt 2026-11-22): vilka kort i en färg
 * får bära en markering?
 *  - **Fem kort eller fler:** honnörerna och tian är gardar och offras aldrig
 *    ("man offrar inte en oskyddad gard — har jag 10-8-6-5-4 väljer jag 8").
 *    Hackorna därunder är fria: i en lång färg är det längden som ger stick,
 *    så en nia eller åtta kostar inget.
 *  - **Tre eller fyra kort:** de två högsta korten sparas (♣10 ur 10-8-2 släpper
 *    garden; ♦8 ur ♦J82 släpper längden bakom knekten). Saknar färgen både
 *    honnör och tia finns inget att garda — då är alla hackor fria.
 *  - **Kortare:** orört.
 */
export function friaHackor(cards: Card[]): Card[] {
  if (cards.length < 3) return cards
  if (cards.length >= 5) return cards.filter((c) => rankVal(c.rank) < rankVal('10'))
  const desc = highToLow(cards)
  // Ingen honnör och ingen tia = ingenting att garda: alla hackor är fria
  // (ägarbeslut 2026-11-23, "slaskkortet" — ♣8 ur 8-7-5).
  if (rankVal(desc[0].rank) < rankVal('10')) return cards
  const gardar = new Set([desc[0].rank, desc[1].rank])
  return cards.filter((c) => !gardar.has(c.rank))
}

/** En försvarssignal att bära: attityd, räkning eller Lavinthal-färgpreferens. */
export type DefensiveSignal =
  | { kind: 'attitude'; encourage: boolean }
  | { kind: 'count'; even: boolean }
  | { kind: 'lavinthal'; wantHigher: boolean }

/**
 * Väljer vilket kort i EN (redan säkert vald) färg som ska bära `signal`.
 * Encodern får bara röra spare-kort (se `spareCards`), så valet är bevisbart
 * stickneutralt. Har spare 0 kort finns ingen frihet → lägsta (ingen signal); 1
 * kort → det kortet (tvingat). `played` = alla spelade kort (skärper spare).
 */
export function defensiveSignalCard(
  candidatesInSuit: Card[],
  played: Card[],
  signal: DefensiveSignal,
  opts: { langFarg?: boolean } = {},
): Card {
  if (candidatesInSuit.length === 1) return candidatesInSuit[0]
  // Lång färg (5+): gardregeln har redan sorterat bort honnörer och tian, och
  // hackorna därunder är fria även när de hänger ihop med en honnör (9-8 under
  // kn-10). Bara säkra vinnare skyddas då.
  const spare = opts.langFarg
    ? candidatesInSuit.filter((c) => !sureWinnerInSuit(c, candidatesInSuit, played))
    : spareCards(candidatesInSuit, played)
  if (spare.length === 0) return lowest(candidatesInSuit)
  if (spare.length === 1) return spare[0]
  switch (signal.kind) {
    case 'attitude':
      return attitudeCard(spare, signal.encourage)
    case 'count':
      return countCard(spare, signal.even)
    case 'lavinthal':
      return lavinthalDiscard(spare, signal.wantHigher)
  }
}

// --- Följemarkeringen: EN regel för den som markerar och den som läser --------
//
// `foljBetydelse` säger vad en hand VILL visa när den följer färg (attityd på
// partnerns utspel, räkning på motståndarens), `foljKort` vilket kort som bär
// det. play-bot lägger kortet; signal-decode kör samma två funktioner på varje
// tänkt hand för att läsa det ("skulle partnern ha lagt det där kortet från den
// där handen?"). Samma kod åt båda håll = sändare och läsare kan inte glida isär.

/** Läget när en motspelare följer färg, sett ur den egna handen + det spelade. */
export interface FoljLage {
  /** Hela innehavet i den ledda färgen (gardregeln räknas på hela längden). */
  iFargen: Card[]
  /** Korten som får läggas: innehavet, minus allt som går ÖVER partnerns vinnande kort. */
  kandidater: Card[]
  /** Alla kort som spelats före det här kortet. */
  spelade: Card[]
  partnerLedde: boolean
  /** Sant i ett trumfkontrakt (kort färg uppmuntrar bara där, längd bara i sang). */
  trumfkontrakt: boolean
  /** Sant när den ledda färgen ÄR trumffärgen. */
  trumfFargen: boolean
  /** Kortet som spelades ut i sticket. */
  utspel: Rank
}

export interface FoljBetydelse {
  kind: 'attitude' | 'count'
  /** Attityd: uppmuntrar. Räkning: jämnt antal. Sant = det HÖGA kortet. */
  hogt: boolean
  /** Attityd: dam eller högre i färgen. */
  hasQ: boolean
  /** Attityd: uppmuntrar på längd i sang (fyra kort eller fler mot honnörsutspel). */
  langd: boolean
}

/** Vad handen vill visa. Null = ingen markering i det här läget (räkning i trumffärgen). */
export function foljBetydelse(l: FoljLage): FoljBetydelse | null {
  const n = l.iFargen.length
  if (l.partnerLedde) {
    // ATTITYD: uppmuntra med styrka (Q+), med kort färg (stöldvärde i
    // trumfkontrakt) eller — i sang mot partnerns honnörs-/sekvensutspel — med
    // längd: fyra kort eller fler (♣kn-6-4-3-2 mot ♣A, ägarbeslut 2026-11-23).
    const hasQ = l.iFargen.some((c) => rankVal(c.rank) >= rankVal('Q'))
    const kortFarg = l.trumfkontrakt && !l.trumfFargen && n <= 2
    const langd = !l.trumfkontrakt && n >= 4 && rankVal(l.utspel) >= rankVal('10')
    return { kind: 'attitude', hogt: hasQ || kortFarg || langd, hasQ, langd }
  }
  // Ingen räkning i TRUMFFÄRGEN (ägarbeslut 2026-11-23).
  if (l.trumfFargen) return null
  // RÄKNING: jämnt antal = högt (högt-lågt), udda = lågt (lågt-högt).
  return { kind: 'count', hogt: n % 2 === 0, hasQ: false, langd: false }
}

/**
 * Kortet som bär betydelsen `hogt` (för attityd: uppmuntrar, för räkning: jämnt).
 * Null = handen har ingen frihet att markera (färre än två fria kort).
 */
export function foljKort(l: FoljLage, kind: 'attitude' | 'count', hogt: boolean): Card | null {
  if (l.kandidater.length < 2) return null
  const n = l.iFargen.length
  const hasQ = l.iFargen.some((c) => rankVal(c.rank) >= rankVal('Q'))
  // Med dam eller högre i en färg på tre–fyra kort bär kortet närmast under
  // honnörerna uppmuntran (åttan ur D-8-2, ägarbeslut 2026-11-23): gardregeln
  // sparar annars de två högsta, och då blir tvåan — "jag avskräcker" — enda
  // fria kortet. Tian och honnörerna offras fortfarande aldrig.
  const fria =
    kind === 'attitude' && hogt && hasQ && n >= 3 && n <= 4
      ? l.iFargen.filter((c) => rankVal(c.rank) < rankVal('10'))
      : friaHackor(l.iFargen)
  const kandidater = l.kandidater.filter((c) => fria.some((f) => f.rank === c.rank))
  if (kandidater.length < 2) return null
  const signal: DefensiveSignal = kind === 'attitude' ? { kind, encourage: hogt } : { kind, even: hogt }
  return defensiveSignalCard(kandidater, l.spelade, signal, { langFarg: n >= 5 })
}
