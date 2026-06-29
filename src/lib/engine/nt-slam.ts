// Slamutredning över en naturlig 1NT-öppning (15–17): Gerber 4♣ (§6.4).
//
// Kvantitativ 4NT (16–17 hp → inbjuder 6NT) finns redan i den vanliga
// svars-/återbudskedjan. När svararen är balanserad och SLAMSÄKER (18+ hp
// mittemot 15–17 ≈ 33+) frågar hon i stället ess med Gerber 4♣ för att inte
// hamna i slam med två ess ute. Funktionen växer hela sekvensen (4♣ → ess-svar
// → placering) och returnerar null för icke-slamhänder, så den vanliga
// auktionen då fortsätter precis som förut.
//
// Avgränsning: Gerber kopplas in över 1NT-öppningen. Över 2NT används tills
// vidare kvantitativ 4NT / 6NT (befintligt). Storslam nås via kungfrågan 5♣
// först i klar storslamszon (≈37+).

import type { Hand } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { countAces, countKings, respondToGerber, respondToGerberKingAsk } from './slam'
import type { SlamTurn } from './slam-auction'

/** Gerber-slamutredning över partnerns 1NT. null = ingen slamhand (vanlig auktion). */
export function gerberInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  if (!isBalanced(responderHand)) return null
  const len = lengths(responderHand)
  // Högfärgsvägar (Stayman/transfer) och Minor Suit Stayman hanteras på annat håll.
  if (len.spades >= 4 || len.hearts >= 4) return null
  const mss = (len.clubs >= 5 && len.diamonds >= 4) || (len.diamonds >= 5 && len.clubs >= 4)
  if (mss) return null
  const p = hcp(responderHand)
  if (p < 18) return null // 16–17 stannar som kvantitativ 4NT (inbjudan)

  const turns: SlamTurn[] = []
  turns.push({ role: 'svarare', call: '4C', rule: 'Gerber', explanation: `${p} hp balanserad, slamläge → 4♣ (Gerber, frågar ess).` })

  const aceAnswer = respondToGerber(openerHand)
  turns.push({ role: 'öppnare', call: aceAnswer.call, rule: aceAnswer.rule, explanation: aceAnswer.explanation })

  // Vi har båda händerna → räkna exakt (svaret 4♦ = 0 ELLER 4 är annars tvetydigt).
  const totalAces = countAces(openerHand) + countAces(responderHand)
  const missing = 4 - totalAces
  if (missing >= 2) {
    turns.push({ role: 'svarare', call: '4NT', rule: 'Gerber: stannar', explanation: 'två ess saknas → stannar i 4NT.' })
    return turns
  }

  const combined = hcp(openerHand) + hcp(responderHand)
  if (missing === 0 && combined >= 37) {
    // Alla ess + storslamszon → kungfråga 5♣, placera sedan 6NT/7NT.
    turns.push({ role: 'svarare', call: '5C', rule: 'Gerber kungfråga', explanation: `alla ess + storslamszon (~${combined} hp) → 5♣ (frågar kungar).` })
    const kingAnswer = respondToGerberKingAsk(openerHand)
    turns.push({ role: 'öppnare', call: kingAnswer.call, rule: kingAnswer.rule, explanation: kingAnswer.explanation })
    const totalKings = countKings(openerHand) + countKings(responderHand)
    const grand = totalKings >= 3
    turns.push({
      role: 'svarare',
      call: grand ? '7NT' : '6NT',
      rule: 'slamavslut',
      explanation: grand ? `${totalKings} kungar + alla ess → storslam 7NT.` : 'alla ess men för få kungar → 6NT.',
    })
    return turns
  }

  turns.push({
    role: 'svarare',
    call: '6NT',
    rule: 'slamavslut',
    explanation: missing === 0 ? 'alla ess → 6NT.' : 'ett ess saknas → 6NT (lillslam).',
  })
  return turns
}
