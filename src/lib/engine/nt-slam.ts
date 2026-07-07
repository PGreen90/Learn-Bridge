// Slamutredning över en naturlig sangöppning: Gerber 4♣ (§6.4) — ÄRLIGT.
//
// ÄGARBESLUT 2026-07-07 ("ärliga slamportar"): kaptenen (svararen) beslutar på
// SIN hand + partnerns VISADE intervall, aldrig på partnerns faktiska kort.
// Gerber-/kungsvaren är ärliga (svararens egen hand); kaptenen HÄRLEDER
// partnerns ess/kungar ur svaret + sin egen hand. Tvetydigheten i 4♦/5♦
// (0 eller 4) löses med egen hand (har jag ett ess kan partnern inte ha fyra),
// annars antas det låga (pessimistiskt → stannar hellre än chansar).
//
// Portarna (redan ärliga sedan tidigare):
//  • över 1NT (15–17): egen 18+ hp → Gerber (33+ mot minimum). 16–17 = den
//    kvantitativa 4NT-inbjudan i den vanliga svarskedjan.
//  • över 2NT (20–21): egen 13+ hp → Gerber. 11–12 = kvantitativ 4NT.
//  • över 1NT-ÅTERBUDET (1m–1M–1NT, 12–14; F1 familj A): egen 21+ hp → Gerber;
//    egen 19–20 hp → NY kvantitativ 4NT-inbjudan (öppnaren accepterar 6NT med
//    13–14, passar med 12). Förr räknade porten parets FAKTISKA hp — borttaget.

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

/** Gerber-slamutredning över partnerns 1NT (visade 15–17). null = ingen slamhand. */
export function gerberInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  if (!qualifiesForGerber(responderHand)) return null
  const p = hcp(responderHand)
  if (p < 18) return null // 16–17 stannar som kvantitativ 4NT (inbjudan)
  return buildGerberSequence(openerHand, responderHand, p, 15)
}

/**
 * Gerber-slamutredning över partnerns 2NT (visade 20–21). null = ingen slamhand →
 * den vanliga 2NT-kedjan (respondTo2NT) fortsätter; 11–12 stannar som
 * kvantitativ 4NT (inbjudan) där.
 */
export function gerber2NTInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  if (!qualifiesForGerber(responderHand)) return null
  const p = hcp(responderHand)
  if (p < 13) return null
  return buildGerberSequence(openerHand, responderHand, p, 20)
}

/**
 * Slamutredning över öppnarens 1NT-ÅTERBUD (1m–1M–1NT, visade 12–14 bal; F1
 * familj A, jämn svarare). Kaptenen räknar SIN hp mot det visade intervallet:
 *  • 21+ (33 även mot minimum)  → driv: Gerber 4♣.
 *  • 19–20 (33 bara mot maximum) → kvantitativ 4NT-inbjudan; öppnaren dömer på
 *    SIN hand (13–14 → 6NT, 12 → pass).
 * null = under kanske-zonen → den vanliga kedjan (NMF / sang-stegen) står kvar.
 * Svararen måste vara jämn UTAN 5-korts färg (5-korts högfärg jagar 5-3-fit via
 * NMF; obalanserat vill åt färgkontrakt — se familyAFitTrump).
 */
export function gerberRebidInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  if (!isBalanced(responderHand)) return null
  const len = lengths(responderHand)
  if (Math.max(len.clubs, len.diamonds, len.hearts, len.spades) >= 5) return null
  const p = hcp(responderHand)
  if (p >= 21) return buildGerberSequence(openerHand, responderHand, p, 12)
  if (p >= 19) {
    // Kanske-zonen: kvantitativ 4NT — partnern med mer än minimum accepterar.
    const turns: SlamTurn[] = []
    turns.push({
      role: 'svarare',
      call: '4NT',
      rule: 'kvantitativ 4NT',
      explanation: `${p} hp jämnt mot visade 12–14 → 4NT (inbjuder 6NT; partnern går vidare med mer än minimum).`,
    })
    const op = hcp(openerHand)
    if (op >= 13) {
      turns.push({ role: 'öppnare', call: '6NT', rule: 'kvantitativ 4NT: accept', explanation: `${op} hp — mer än minimum → accepterar, 6NT.` })
    } else {
      turns.push({ role: 'öppnare', call: 'P', rule: 'kvantitativ 4NT: avböjer', explanation: `${op} hp — blott minimum → passar 4NT.` })
    }
    return turns
  }
  return null
}

/**
 * Bygger 4♣ Gerber-dialogen bud för bud. Ess-/kungsvaren är öppnarens egna;
 * kaptenen härleder antalet ur SVARET + sin egen hand (aldrig partnerns kort).
 * `partnerMin` = undre gränsen i partnerns visade intervall (storslamszonen
 * räknas alltid mot minimum — aldrig hopp om maximum).
 */
function buildGerberSequence(openerHand: Hand, responderHand: Hand, p: number, partnerMin: number): SlamTurn[] {
  const turns: SlamTurn[] = []
  turns.push({ role: 'svarare', call: '4C', rule: 'Gerber', explanation: `${p} hp balanserad, slamläge → 4♣ (Gerber, frågar ess).` })

  const aceAnswer = respondToGerber(openerHand)
  turns.push({ role: 'öppnare', call: aceAnswer.call, rule: aceAnswer.rule, explanation: aceAnswer.explanation })

  // Härled partnerns ess ur svaret + egen hand. 4♦ = 0 ELLER 4: har kaptenen
  // själv ett ess är 4 omöjligt (bara 4 finns) → 0; med 0 egna ess antas det
  // låga (pessimistiskt — hellre missa en extrem slam än chansa).
  const ownAces = countAces(responderHand)
  const partnerAces =
    aceAnswer.call === '4H' ? 1 : aceAnswer.call === '4S' ? 2 : aceAnswer.call === '4NT' ? 3 : 0
  const aceCertain = aceAnswer.call !== '4D' || ownAces >= 1
  const missing = 4 - ownAces - partnerAces

  if (missing >= 2) {
    turns.push({ role: 'svarare', call: '4NT', rule: 'Gerber: stannar', explanation: 'två ess saknas → stannar i 4NT.' })
    return turns
  }

  const floor = p + partnerMin
  if (missing === 0 && aceCertain && floor >= 37) {
    // Alla ess + storslamszon mot visat minimum → kungfråga 5♣, placera 6NT/7NT.
    turns.push({ role: 'svarare', call: '5C', rule: 'Gerber kungfråga', explanation: `alla ess + storslamszon (~${floor}+) → 5♣ (frågar kungar).` })
    const kingAnswer = respondToGerberKingAsk(openerHand)
    turns.push({ role: 'öppnare', call: kingAnswer.call, rule: kingAnswer.rule, explanation: kingAnswer.explanation })
    // Härled kungarna ur svaret + egen hand (5♦ = 0 eller 4 → egen kung avgör).
    const ownKings = countKings(responderHand)
    const partnerKings =
      kingAnswer.call === '5H' ? 1 : kingAnswer.call === '5S' ? 2 : kingAnswer.call === '5NT' ? 3 : 0
    const grand = ownKings + partnerKings >= 3
    turns.push({
      role: 'svarare',
      call: grand ? '7NT' : '6NT',
      rule: 'slamavslut',
      explanation: grand ? `${ownKings + partnerKings} kungar + alla ess → storslam 7NT.` : 'alla ess men för få kungar → 6NT.',
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
