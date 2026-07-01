// Slamutredning över en naturlig sangöppning: Gerber 4♣ (§6.4).
//
// Över 1NT (15–17): kvantitativ 4NT (16–17 hp → inbjuder 6NT) finns redan i den
// vanliga svars-/återbudskedjan. När svararen är balanserad och SLAMSÄKER (18+
// hp mittemot 15–17 ≈ 33+) frågar hon i stället ess med Gerber 4♣ för att inte
// hamna i slam med två ess ute.
//
// Över 2NT (20–21): kvantitativ 4NT (11–12 hp → inbjuder 6NT) finns i
// `respondTo2NT`. Är svararen balanserad och SLAMSÄKER (13+ hp mittemot 20–21 ≈
// 33+) frågar hon ess med Gerber 4♣ i stället för att blint blåsa 6NT.
//
// Båda funktionerna växer hela sekvensen (4♣ → ess-svar → placering, ev. 5♣
// kungfråga i storslamszon ≈37+) och returnerar null för icke-slamhänder, så
// den vanliga auktionen då fortsätter precis som förut. Den delade
// `buildGerberSequence` bygger själva bud-för-bud-dialogen (samma över 1NT/2NT).

import type { Hand } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { countAces, countKings, respondToGerber, respondToGerberKingAsk } from './slam'
import type { SlamTurn } from './slam-auction'

/**
 * Kvalificerar svararens hand för Gerber (gemensamt för 1NT/2NT): balanserad,
 * ingen biudbar 4-korts högfärg (Stayman/transfer sköter dem) och inte 5-4+ i
 * minorerna (Minor Suit Stayman / minorfråga). Poänggränsen skiljer sig åt och
 * kollas av respektive wrapper.
 */
function qualifiesForGerber(responderHand: Hand): boolean {
  if (!isBalanced(responderHand)) return false
  const len = lengths(responderHand)
  if (len.spades >= 4 || len.hearts >= 4) return false
  const mss = (len.clubs >= 5 && len.diamonds >= 4) || (len.diamonds >= 5 && len.clubs >= 4)
  if (mss) return false
  return true
}

/** Gerber-slamutredning över partnerns 1NT. null = ingen slamhand (vanlig auktion). */
export function gerberInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  if (!qualifiesForGerber(responderHand)) return null
  const p = hcp(responderHand)
  if (p < 18) return null // 16–17 stannar som kvantitativ 4NT (inbjudan)
  return buildGerberSequence(openerHand, responderHand, p)
}

/**
 * Gerber-slamutredning över partnerns 2NT (20–21). null = ingen slamhand → den
 * vanliga 2NT-kedjan (respondTo2NT) fortsätter. 13+ hp ger slamzon (≈33+); under
 * det stannar 11–12 som kvantitativ 4NT (inbjudan) i respondTo2NT.
 */
export function gerber2NTInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  if (!qualifiesForGerber(responderHand)) return null
  const p = hcp(responderHand)
  if (p < 13) return null
  return buildGerberSequence(openerHand, responderHand, p)
}

/** Bygger 4♣ Gerber-dialogen bud för bud (ess-svar → ev. kungfråga → placering). */
function buildGerberSequence(openerHand: Hand, responderHand: Hand, p: number): SlamTurn[] {
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
