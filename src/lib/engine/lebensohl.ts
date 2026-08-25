// Lebensohl EFTER VÅRT 1NT — systembok §7.5 (bridgebum "Lebensohl after 1NT").
//
// Läge: partnern har öppnat 1NT (15–17) och HÖGERHAND har klivit in NATURELLT på
// 2-läget (t.ex. 2♠ = spader). Svararen skiljer svaga tävlingshänder från
// utgångsvilliga med 2NT-reläet.
//
// Mekanik (Lager 1 — kärnan; slow-shows/cue-Stayman/artificiella inkliv = senare):
//   - Svag hand med en HÖGRE högfärg (5+) som ryms på 2-läget → bjud den naturligt.
//   - Svag hand med en lång färg som kräver 3-läget → 2NT (relä till 3♣, passa/rätta).
//   - Utgångskrav med egen 5+ färg → direkt bud på 3-läget (krav).
//   - Utgångsvärden, jämn hand → direkt 3NT.
//   - Svag utan färg → pass (vi FÖRSVARAR deras inkliv – lagligt, det är MOTPARTENS bud).
//
// Motståndarens naturliga inkliv modelleras av `naturalNTOvercall` (annars använder
// motståndaren DONT som förut — se auction.ts). En stark enfärgshand (6+, 11–15)
// klivar naturligt; svaga/tvåfärgade händer lämnas åt DONT.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, lengths } from './hand'
import type { ResponseResult } from './responses'
import { hasStopper } from './overcalls'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)

/** Längsta färg (≠ `avoid`) med minst `min` kort; lika längd → högst rankad. */
function longestOther(len: Record<Suit, number>, avoid: Suit, min: number): Suit | null {
  let best: Suit | null = null
  for (const s of RANK_ORDER) {
    if (s === avoid || len[s] < min) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/**
 * Motståndarens NATURLIGA inkliv över vårt 1NT. En stark enfärgshand (en färg med
 * 6+ kort, ingen annan färg 5+, 11–15 hp) klivar in naturligt på 2-läget. Annars
 * pass — då tar DONT vid som förut (auction.ts). 11–15-fönstret undviker krock med
 * DONT:s svagare/tvåfärgade händer och med en för stark hand (16+ dubblar/passar).
 */
export function naturalNTOvercall(hand: Hand): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  if (p < 11 || p > 15) return { call: 'P', rule: 'pass', explanation: 'inget naturligt inkliv.' }
  // Exakt EN lång färg (6+), ingen annan 5+ (då är det en tvåfärgshand → DONT).
  const long = RANK_ORDER.find((s) => len[s] >= 6) ?? null
  if (!long) return { call: 'P', rule: 'pass', explanation: 'ingen 6-korts färg.' }
  const otherFive = RANK_ORDER.some((s) => s !== long && len[s] >= 5)
  if (otherFive) return { call: 'P', rule: 'pass', explanation: 'tvåfärgshand → DONT.' }
  return {
    call: `2${BID[long]}`,
    rule: 'naturligt inkliv (1NT)',
    explanation: `6+ ${SYM[long]}, 11–15 hp → 2${SYM[long]} (naturligt inkliv över deras 1NT).`,
  }
}

/**
 * Svararens FÖRSTA bud efter (1NT)–(2X naturligt). `theirSuit` = deras inklivsfärg.
 */
export function lebensohlAfter1NT(hand: Hand, theirSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const ourLong = longestOther(len, theirSuit, 5)

  if (p <= 7) {
    // Svag: en HÖGRE högfärg (5+) som ryms på 2-läget bjuds naturligt (utspel).
    const hiMajor = (['hearts', 'spades'] as Suit[]).find(
      (m) => m !== theirSuit && len[m] >= 5 && rankIdx(m) > rankIdx(theirSuit),
    )
    if (hiMajor) {
      return {
        call: `2${BID[hiMajor]}`,
        rule: 'Lebensohl naturligt 2-läge',
        explanation: `svag hand med 5+ ${SYM[hiMajor]} → 2${SYM[hiMajor]} (naturligt, konkurrerar).`,
      }
    }
    // Svag med en lång färg som kräver 3-läget → relä för att stanna lågt.
    if (ourLong) {
      return {
        call: '2NT',
        rule: 'Lebensohl 2NT (svag)',
        explanation: `svag hand med 5+ ${SYM[ourLong]} → 2NT (relä till 3♣, passar/rättar lågt).`,
      }
    }
    return { call: 'P', rule: 'pass', explanation: 'svag hand utan färg → pass (försvarar deras inkliv).' }
  }

  // Utgångsvärden (8+). Egen 5+ färg → direkt 3-läge = krav.
  if (ourLong) {
    return {
      call: `3${BID[ourLong]}`,
      rule: 'Lebensohl direkt 3-läge (krav)',
      explanation: `utgångskrav med 5+ ${SYM[ourLong]} → 3${SYM[ourLong]} (direkt = krav).`,
    }
  }

  // Jämn utgångshand utan egen 5-färg → direkt 3NT (öppnaren har 15–17 med stopp).
  const stop = hasStopper(hand, theirSuit)
  return {
    call: '3NT',
    rule: 'Lebensohl 3NT (utgång)',
    explanation: stop
      ? `utgång med stopp i ${SYM[theirSuit]} → 3NT.`
      : `utgång, jämn hand → 3NT (öppnaren väntas ha stopp i ${SYM[theirSuit]}).`,
  }
}

/**
 * Svararens rättelse efter öppnarens TVUNGNA 3♣-svar på 2NT-reläet (svag hand):
 * passa 3♣ om min långfärg är klöver, annars rätta till min färg på 3-läget.
 */
export function lebensohlAfter1NTRebid(hand: Hand, theirSuit: Suit): ResponseResult {
  const len = lengths(hand)
  const ourLong = longestOther(len, theirSuit, 5)
  if (!ourLong || ourLong === 'clubs') {
    return { call: 'P', rule: 'Lebensohl 3♣ (svag, stannar)', explanation: 'min långfärg är ♣ → passar 3♣.' }
  }
  return {
    call: `3${BID[ourLong]}`,
    rule: 'Lebensohl 3-läge (svag, rättar)',
    explanation: `rättar partnerns 3♣ till min ${SYM[ourLong]} → 3${SYM[ourLong]} (partnern lägger upp).`,
  }
}
