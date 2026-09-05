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

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { countAces, countKings, respondToGerber, respondToGerberKingAsk } from './slam'
import type { SlamBid, SlamRole, SlamTurn } from './slam-auction'

const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

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

/**
 * Svararens FÖRSTA bud över partnerns naturliga 1NT/2NT när handen är en
 * Gerber-hand: 4♣. Bara svararens egen hand + det visade intervallet (över
 * 1NT 15–17: egen 18+; över 2NT 20–21: egen 13+). null = ingen slamhand → den
 * vanliga svarskedjan (respondTo1NT/respondTo2NT). Beslutstabellens rad för
 * svaret (auction-decide.ts) läser den här; manusets sekvenser nedan börjar
 * med samma bud, så tabell och manus kan aldrig glida isär.
 */
export function gerberAsk(responderHand: Hand, over: '1NT' | '2NT'): SlamTurn | null {
  if (!qualifiesForGerber(responderHand)) return null
  if (hcp(responderHand) < (over === '1NT' ? 18 : 13)) return null // därunder: kvantitativ 4NT i svarskedjan
  return { role: 'svarare', call: '4C', rule: 'Gerber', explanation: `Balanserad, slamläge → 4♣ (Gerber, frågar ess).` }
}

/** Gerber-slamutredning över partnerns 1NT (visade 15–17). null = ingen slamhand. */
export function gerberInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  const ask = gerberAsk(responderHand, '1NT')
  if (!ask) return null
  return playGerber(openerHand, responderHand, 15)
}

/**
 * Gerber-slamutredning över partnerns 2NT (visade 20–21). null = ingen slamhand →
 * den vanliga 2NT-kedjan (respondTo2NT) fortsätter; 11–12 stannar som
 * kvantitativ 4NT (inbjudan) där.
 */
export function gerber2NTInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  const ask = gerberAsk(responderHand, '2NT')
  if (!ask) return null
  return playGerber(openerHand, responderHand, 20)
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
/**
 * Svararens FÖRSTA slambud över öppnarens 1NT-återbud (12–14) ur EGEN hand:
 * jämn utan 5-korts färg, 21+ → Gerber 4♣; 19–20 → kvantitativ 4NT; annars null.
 * `gerberRebidInvestigation` börjar med samma bud (beslutstabellen läser den här).
 */
export function gerberRebidFirstStep(responderHand: Hand): SlamTurn | null {
  if (!isBalanced(responderHand)) return null
  const len = lengths(responderHand)
  if (Math.max(len.clubs, len.diamonds, len.hearts, len.spades) >= 5) return null
  const p = hcp(responderHand)
  if (p >= 21) return { role: 'svarare', call: '4C', rule: 'Gerber', explanation: `Balanserad, slamläge → 4♣ (Gerber, frågar ess).` }
  if (p >= 19) {
    return {
      role: 'svarare',
      call: '4NT',
      rule: 'kvantitativ 4NT',
      explanation: `Jämn slaminbjudan mot visade 12–14 → 4NT (inbjuder 6NT; partnern går vidare med mer än minimum).`,
    }
  }
  return null
}

export function gerberRebidInvestigation(openerHand: Hand, responderHand: Hand): SlamTurn[] | null {
  const first = gerberRebidFirstStep(responderHand)
  if (!first) return null
  if (first.rule === 'Gerber') return playGerber(openerHand, responderHand, 12)
  // Kanske-zonen: kvantitativ 4NT — partnern med mer än minimum accepterar.
  return [first, quantitativeAnswer(openerHand, 12)]
}

/**
 * Partnern dömer kaptenens kvantitativa 4NT över 1NT-återbudet på SIN hand mot
 * sitt eget visade intervall (`shownMin` = 12): mer än minimum → 6NT, annars pass.
 */
export function quantitativeAnswer(hand: Hand, shownMin: number): SlamTurn {
  return hcp(hand) >= shownMin + 1
    ? { role: 'öppnare', call: '6NT', rule: 'kvantitativ 4NT: accept', explanation: `Mer än minimum → accepterar, 6NT.` }
    : { role: 'öppnare', call: 'P', rule: 'kvantitativ 4NT: avböjer', explanation: `Blott minimum → passar 4NT.` }
}

const GERBER_ASK: SlamTurn = { role: 'svarare', call: '4C', rule: 'Gerber', explanation: `Balanserad, slamläge → 4♣ (Gerber, frågar ess).` }

/** Spelar Gerber-dialogen till slut med två händer, tur för tur ur EN hand — bara facit-testernas förare sedan familj 6 (motorn går genom raden *slam*). */
function playGerber(openerHand: Hand, responderHand: Hand, partnerMin: number): SlamTurn[] {
  const turns: SlamTurn[] = [GERBER_ASK]
  let role: SlamRole = 'öppnare'
  for (let guard = 0; guard < 6; guard++) {
    const t = gerberTurn(role, role === 'svarare' ? responderHand : openerHand, partnerMin, turns)
    if (!t || t.call === 'P') break // partnerns pass på placeringen är underförstått i manuset
    turns.push(t)
    role = role === 'svarare' ? 'öppnare' : 'svarare'
  }
  return turns
}

/**
 * Gerber-dialogen (§6.4) en tur i taget ur EN hand, efter kaptenens 4♣ (`sofar[0]`):
 * öppnarens ess-svar, kaptenens placering (4NT stopp / 5♣ kungfråga / 6NT),
 * öppnarens kungsvar, kaptenens 6NT/7NT. Ess-/kungsvaren är öppnarens egna;
 * kaptenen härleder antalet ur SVARET + sin egen hand (aldrig partnerns kort).
 * `partnerMin` = undre gränsen i partnerns visade intervall (storslamszonen
 * räknas alltid mot minimum — aldrig hopp om maximum). null = ingen tur.
 */
export function gerberTurn(role: SlamRole, hand: Hand, partnerMin: number, sofar: SlamBid[], placeSuit?: Suit): SlamTurn | null {
  if (sofar.length === 0 || sofar[0].role !== 'svarare' || sofar[0].call !== '4C') return null
  if (sofar[sofar.length - 1].role === role) return null
  const after = sofar.slice(1)
  if (after.length === 0) {
    const a = respondToGerber(hand)
    return { role: 'öppnare', call: a.call, rule: a.rule, explanation: a.explanation }
  }
  // Kaptenen placerar i sang — eller, när hon frågade för en egen självbärande
  // färg över partnerns sang-återbud (§5.7), i den färgen: stoppet blir 5 i
  // färgen, slammen 6/7 i färgen. Partnern behöver inte veta vilket: han svarar
  // ess/kungar och passar placeringen.
  const place = (level: 4 | 5 | 6 | 7): string => (placeSuit ? `${level === 4 ? 5 : level}${LETTER[placeSuit]}` : `${level}NT`)
  const namn = (call: string): string => (placeSuit ? `${call[0]}${SYM[placeSuit]}` : call)
  const aceCall = after[0].call
  if (after.length === 1) {
    // Härled partnerns ess ur svaret + egen hand. 4♦ = 0 ELLER 4: har kaptenen
    // själv ett ess är 4 omöjligt (bara 4 finns) → 0; med 0 egna ess antas det
    // låga (pessimistiskt — hellre missa en extrem slam än chansa).
    const ownAces = countAces(hand)
    const partnerAces = aceCall === '4H' ? 1 : aceCall === '4S' ? 2 : aceCall === '4NT' ? 3 : 0
    const aceCertain = aceCall !== '4D' || ownAces >= 1
    const missing = 4 - ownAces - partnerAces
    if (missing >= 2) return { role: 'svarare', call: place(4), rule: 'Gerber: stannar', explanation: `två ess saknas → stannar i ${namn(place(4))}.` }
    const floor = hcp(hand) + partnerMin
    if (missing === 0 && aceCertain && floor >= 37) {
      // Alla ess + storslamszon mot visat minimum → kungfråga 5♣, placera 6/7.
      return { role: 'svarare', call: '5C', rule: 'Gerber kungfråga', explanation: `alla ess + storslamszon → 5♣ (frågar kungar).` }
    }
    return { role: 'svarare', call: place(6), rule: 'slamavslut', explanation: missing === 0 ? `alla ess → ${namn(place(6))}.` : `ett ess saknas → ${namn(place(6))} (lillslam).` }
  }
  if (after[1].call !== '5C') {
    // Kaptenen placerade (4NT stannar / 6NT / 7NT) → partnern passar. Sägs
    // uttryckligen så att 4NT-stoppet aldrig läses som en essfråga.
    return after.length === 2 ? { role: 'öppnare', call: 'P', rule: 'pass', explanation: `partnern placerade i ${after[1].call} → pass.` } : null
  }
  if (after.length === 2) {
    const k = respondToGerberKingAsk(hand)
    return { role: 'öppnare', call: k.call, rule: k.rule, explanation: k.explanation }
  }
  if (after.length === 3) {
    // Härled kungarna ur svaret + egen hand (5♦ = 0 eller 4 → egen kung avgör).
    const kingCall = after[2].call
    const ownKings = countKings(hand)
    const partnerKings = kingCall === '5H' ? 1 : kingCall === '5S' ? 2 : kingCall === '5NT' ? 3 : 0
    const grand = ownKings + partnerKings >= 3
    return { role: 'svarare', call: grand ? place(7) : place(6), rule: 'slamavslut', explanation: grand ? `alla ess + kungarna räcker → storslam ${namn(place(7))}.` : `alla ess men för få kungar → ${namn(place(6))}.` }
  }
  return null
}
