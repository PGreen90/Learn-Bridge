// Poängräkning (tävlingspoäng/duplikat) — ägarens poängguide 2026-07-04.
// Ren logik utan UI: kontrakt + antal stick + zon → poäng och vem som fick dem.
//
// Reglerna (standard tävlingsbridge, exakt som ägarens tabell):
//   Trickpoäng  ♣/♦ 20 per stick, ♥/♠ 30, NT 40 första + 30 följande.
//               Dubblat ×2, redubblat ×4.
//   Bonus       trickpoäng ≥ 100 → utgång (300 ozon / 500 zon), annars
//               delkontrakt +50. Lillslam +500/750, storslam +1000/1500
//               (ovanpå utgångsbonusen). Hemspelat dubblat kontrakt +50
//               ("for the insult"), redubblat +100.
//   Övertrick   odubblat = trickvärdet (20/30); dubblat 100 ozon / 200 zon
//               per stick; redubblat 200/400.
//   Straffar    odubblat 50 (ozon) / 100 (zon) per stick.
//               Dubblat ozon: 100, sedan 200+200, sedan 300 per stick
//               (1→100, 2→300, 3→500, varje extra +300).
//               Dubblat zon: 200, sedan 300 per stick (1→200, 2→500, 3→800,
//               varje extra +300). Redubblat = dubbla dubblade värdena.

import type { Vulnerability } from '../../types/bridge'
import { side, type Contract } from './play'

/** Trickpoängen för ETT stick i färgen (NT:s extra 10 hanteras separat). */
const TRICK_VALUE: Record<string, number> = {
  clubs: 20,
  diamonds: 20,
  hearts: 30,
  spades: 30,
  NT: 30,
}

/** Är kontraktssidan i zon på den här brickan? */
export function sideVulnerable(declarer: Contract['declarer'], vulnerability: Vulnerability): boolean {
  if (vulnerability === 'all') return true
  if (vulnerability === 'none') return false
  return (vulnerability === 'ns') === (side(declarer) === 'NS')
}

/**
 * Poängen för ett färdigspelat kontrakt, sett från SPELFÖRARSIDAN:
 * positivt när kontraktet går hem, negativt vid straff (motståndarna får dem).
 */
export function duplicateScore(contract: Contract, declarerTricks: number, vulnerable: boolean): number {
  const needed = 6 + contract.level
  const dblFactor = contract.doubled === 'XX' ? 4 : contract.doubled === 'X' ? 2 : 1

  if (declarerTricks < needed) {
    return -undertrickPenalty(needed - declarerTricks, vulnerable, contract.doubled)
  }

  // Trickpoäng för de BJUDNA sticken (NT: 40 för första, 30 för resten) ×2/×4.
  const ntExtra = contract.strain === 'NT' ? 10 : 0
  const trickScore = (contract.level * TRICK_VALUE[contract.strain] + ntExtra) * dblFactor

  // Utgångs-/delkontraktsbonus avgörs av de dubblade trickpoängen
  // (2♥ dubblat = 120 → utgång, precis som i riktig bridge).
  let score = trickScore
  score += trickScore >= 100 ? (vulnerable ? 500 : 300) : 50

  // Slambonusar ovanpå utgången.
  if (contract.level === 6) score += vulnerable ? 750 : 500
  if (contract.level === 7) score += vulnerable ? 1500 : 1000

  // "For the insult": hemspelat dubblat kontrakt ger 50, redubblat 100.
  if (contract.doubled === 'X') score += 50
  if (contract.doubled === 'XX') score += 100

  // Övertrick.
  const over = declarerTricks - needed
  if (over > 0) {
    const perOver =
      contract.doubled === 'XX'
        ? vulnerable ? 400 : 200
        : contract.doubled === 'X'
          ? vulnerable ? 200 : 100
          : TRICK_VALUE[contract.strain]
    score += over * perOver
  }

  return score
}

/** Straffpoängen (positivt tal) för `down` bet. */
function undertrickPenalty(down: number, vulnerable: boolean, doubled?: 'X' | 'XX'): number {
  if (!doubled) return down * (vulnerable ? 100 : 50)

  // Dubblade straffar: 1:a / 2:a–3:e / 4:e+ har olika värden.
  let total = 0
  for (let i = 1; i <= down; i++) {
    if (vulnerable) total += i === 1 ? 200 : 300
    else total += i === 1 ? 100 : i <= 3 ? 200 : 300
  }
  return doubled === 'XX' ? total * 2 : total
}

export interface ScoreLine {
  /** Sidan som fick pluspoängen. */
  side: 'NS' | 'EW'
  /** Poängen (alltid positiv — sidan ovan fick dem). */
  points: number
  /** Färdig text för resultatrutan, t.ex. "Ö/V +420". */
  label: string
}

const SIDE_LABEL: Record<'NS' | 'EW', string> = { NS: 'N/S', EW: 'Ö/V' }

/** Vem som fick poängen och hur många — för resultatdialogen. */
export function scoreLine(
  contract: Contract,
  declarerTricks: number,
  vulnerability: Vulnerability,
): ScoreLine {
  const vulnerable = sideVulnerable(contract.declarer, vulnerability)
  const score = duplicateScore(contract, declarerTricks, vulnerable)
  const declSide = side(contract.declarer)
  const winner: 'NS' | 'EW' = score >= 0 ? declSide : declSide === 'NS' ? 'EW' : 'NS'
  const points = Math.abs(score)
  return { side: winner, points, label: `${SIDE_LABEL[winner]} +${points}` }
}
