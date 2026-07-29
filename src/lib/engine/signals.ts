// §8 Markeringar & utspel – rena, testade encoders av försvarets signaler.
// Härlett ur systemboken §8. Vi spelar:
//   • Omvänd markering (UDCA): attityd lågt=gillar/högt=ogillar; räkning
//     lågt-högt=jämnt / högt-lågt=udda (§8.1).
//   • Lavinthal-sak: första saket visar färgpreferens – högt=högre övriga
//     färgen, lågt=lägre (§8.2).
//   • Utspel: honnörsutspel = topp av sekvens (AK→A, KQ→K, QJ→Q, JT→J),
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

/**
 * §8.3 Honnörsutspel – högsta kortet i en sammanhängande topp-sekvens på minst
 * två kort med toppkort knekt eller högre (AK→A, KQ→K, QJ→Q, JT→J, AK
 * dubbelton→A). Returnerar kortet att spela ut, eller `null` om färgen saknar
 * en sådan topp-sekvens.
 */
export function honorLead(suitCards: Card[]): Card | null {
  if (suitCards.length < 2) return null
  const sorted = highToLow(suitCards)
  let run = 1
  while (run < sorted.length && rankVal(sorted[run - 1].rank) - rankVal(sorted[run].rank) === 1) {
    run++
  }
  const top = sorted[0]
  return run >= 2 && rankVal(top.rank) >= rankVal('J') ? top : null
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
 * §8.1 Attityd (UDCA, omvänd): lågt kort = uppmuntrar, högt kort = avskräcker.
 * `spare` = de kort du kan avvara i färgen. Returnerar kortet att lägga.
 */
export function attitudeCard(spare: Card[], encourage: boolean): Card {
  return encourage ? lowest(spare) : highest(spare)
}

/**
 * §8.1 Räkning (UDCA, omvänd): första kortet är lågt vid JÄMNT antal
 * (lågt-högt) och högt vid UDDA antal (högt-lågt).
 */
export function countCard(spare: Card[], evenLength: boolean): Card {
  return evenLength ? lowest(spare) : highest(spare)
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
// markering kan lägga ett HÖGRE spotkort (avskräck/udda/Lavinthal-hög). Därför
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
): Card {
  if (candidatesInSuit.length === 1) return candidatesInSuit[0]
  const spare = spareCards(candidatesInSuit, played)
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
