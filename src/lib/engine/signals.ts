// §8 Markeringar & utspel – rena, testade encoders av försvarets signaler.
// Härlett ur systemboken §8. Vi spelar:
//   • Omvänd markering (UDCA): attityd lågt=gillar/högt=ogillar; räkning
//     lågt-högt=jämnt / högt-lågt=udda (§8.1).
//   • Lavinthal-sak: första saket visar färgpreferens – högt=högre övriga
//     färgen, lågt=lägre (§8.2).
//   • Utspel: honnörsutspel = topp av sekvens (AK→A, KQ→K, QJ→Q, JT→J),
//     annars spotkort 3:e bästa (jämn längd) / 5:e=lägsta (udda längd) (§8.3).
//
// Det här är encoders: de väljer VILKET kort som bär en viss signal. Att läsa
// motpartens signaler (full försvarsstrategi) hör ihop med DDS (punkt 28) och
// tas separat – bottarna använder tills vidare honnörs-/spotutspelet nedan.

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
