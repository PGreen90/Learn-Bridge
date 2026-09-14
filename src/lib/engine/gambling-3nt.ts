// GAMBLING 3NT — öppningen, svaren, öppnarens rättelse och försvaret mot deras.
// Ägarbeslut 2026-09-14 (budsystem §3.1 + §4.4, ändringsloggen §9). Ersätter
// den gamla 3NT-öppningen "25–27 balanserad", som flyttade in i 2♣-linjen.
//
// Stilen är den AGGRESSIVA (ägarens val av de tre på bridgebum): en solid 7+
// lågfärg med A, K och Q i topp, inget ess eller kung vid sidan om, ingen renons
// och ingen 4-korts sidofärg. Partnern räknar då exakt 7 (eller 8) stick hos
// öppnaren och passar bara med håll i de tre andra färgerna — annars 4♣ (pass
// eller rätta till 4♦), 5♣ (samma sak med utgångsvärden) eller en egen bra 6+
// högfärg på 4-läget.
//
// Kunskapsfunktioner för beslutstabellen (`auction-decide.ts`) och för
// `classifyOpening`/`openerRebid`: EGEN hand + auktionsläget → ett bud. Ingen
// annan hand finns att läsa här (kikvakten). Samma betydelse i alla fyra sitsar
// (ägarbeslut punkt 5).
//
// Medvetet utanför v1 (SENARE, docs/senare.md): slamfrågan 4♦ (singelton-fråga),
// öppnarens svar på kvantitativ 4NT, Klingers 4♣/4♦-takeout och straff-X mot
// deras Gambling 3NT.

import type { Bid, Hand, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import type { AuctionFacts } from './auction-facts'
import { quickTricks } from './evaluation'
import { hcp, lengths } from './hand'
import type { OpeningResult } from './openings'
import type { ResponseResult } from './responses'
import { side } from './play'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }

function ranksIn(hand: Hand, suit: Suit): Rank[] {
  return hand.filter((c) => c.suit === suit).map((c) => c.rank)
}

/** Grov stopp-koll för sang (samma mått som `overcalls.hasStopper`): A, Kx, Qxx eller JTxx. */
function stopper(hand: Hand, suit: Suit): boolean {
  const r = ranksIn(hand, suit)
  const has = (x: Rank) => r.includes(x)
  if (has('A')) return true
  if (has('K') && r.length >= 2) return true
  if (has('Q') && r.length >= 3) return true
  if (has('J') && has('10') && r.length >= 4) return true
  return false
}

// ============================================================================
// Öppningen
// ============================================================================

/**
 * Är handen en Gambling 3NT-öppning? Returnerar den solida lågfärgen, annars
 * null. Krav (aggressiv stil): 7+ kort med A, K och Q i EN lågfärg · inget ess
 * eller kung i någon annan färg · ingen renons · ingen 4+ sidofärg.
 */
export function isGambling3NTHand(hand: Hand): Suit | null {
  const len = lengths(hand)
  for (const minor of ['clubs', 'diamonds'] as Suit[]) {
    if (len[minor] < 7) continue
    const r = ranksIn(hand, minor)
    if (!(r.includes('A') && r.includes('K') && r.includes('Q'))) continue
    const sides = SUITS.filter((s) => s !== minor)
    if (sides.some((s) => len[s] === 0 || len[s] >= 4)) return null
    if (sides.some((s) => ranksIn(hand, s).some((x) => x === 'A' || x === 'K'))) return null
    return minor
  }
  return null
}

/** Öppningsbudet 3NT (Gambling), eller null när handen inte är en sådan. */
export function gambling3NTOpening(hand: Hand): OpeningResult | null {
  if (!isGambling3NTHand(hand)) return null
  return {
    call: '3NT',
    rule: 'Gambling 3NT',
    // LÖFTET, inte handen: vilken lågfärg det är avslöjas inte.
    explanation: `Solid 7+ lågfärg (AKQ i topp), inget ess eller kung vid sidan om, ingen renons → 3NT (Gambling). Partnern passar med håll i sidofärgerna, annars 4♣ = pass eller rätta.`,
  }
}

// ============================================================================
// Svaren (svararen vet inte VILKEN lågfärg partnern har)
// ============================================================================

/** ≥ 2 av A/K/Q i färgen — "bra" färg i samma mått som Regel 2-3-4. */
function goodSuit(hand: Hand, suit: Suit): boolean {
  const r = ranksIn(hand, suit)
  return (['A', 'K', 'Q'] as Rank[]).filter((x) => r.includes(x)).length >= 2
}

/**
 * Svararens första bud över partnerns Gambling 3NT, ur egen hand:
 *  · pass — håll i båda högfärgerna och i en lågfärg; den andra lågfärgen är
 *    antingen också stoppad eller kort (≤ 3 kort: då är det nästan säkert
 *    partnerns färg — 7+ hos partnern + våra ≤ 3 lämnar motståndarna ≤ 3).
 *  · 4♥/4♠ — bra 6+ högfärg (≥ 2 av A/K/Q), till spel.
 *  · 5♣ — utgångsvärden utan håll: 3+ kort i båda lågfärgerna och ≥ 3
 *    spelfasta stick (öppnarens 7 + våra ≈ 11). Pass eller rätta till 5♦.
 *  · 4♣ — annars: saknar håll, ut ur 3NT. Pass eller rätta till 4♦.
 */
export function respondToGambling3NT(hand: Hand): ResponseResult {
  const len = lengths(hand)
  const stop = (s: Suit) => stopper(hand, s)
  const majorsStopped = stop('hearts') && stop('spades')
  const clubsOk = stop('clubs') || (len.clubs <= 3 && stop('diamonds'))
  const diamondsOk = stop('diamonds') || (len.diamonds <= 3 && stop('clubs'))
  if (majorsStopped && clubsOk && diamondsOk) {
    return { call: 'P', rule: 'pass', explanation: `Håll i sidofärgerna → pass, 3NT står (partnerns 7+ stick i lågfärgen + våra håll).` }
  }
  for (const major of ['spades', 'hearts'] as Suit[]) {
    if (len[major] >= 6 && goodSuit(hand, major)) {
      return { call: `4${LETTER[major]}` as Bid, rule: 'Gambling: 4M till spel', explanation: `Bra 6+ ${SYM[major]} utan håll för 3NT → 4${SYM[major]} (naturligt, till spel).` }
    }
  }
  if (len.clubs >= 3 && len.diamonds >= 3 && quickTricks(hand) >= 3) {
    return { call: '5C', rule: 'Gambling: 5♣ pass eller rätta', explanation: `Utgångsvärden men hål för 3NT, 3+ kort i båda lågfärgerna → 5♣: pass eller rätta till 5♦.` }
  }
  return { call: '4C', rule: 'Gambling: 4♣ pass eller rätta', explanation: `Saknar håll för 3NT → 4♣: pass eller rätta till 4♦ (spelar partnerns lågfärg).` }
}

/**
 * Öppnarens andra bud över partnerns svar: rättelsen 4♣→4♦ / 5♣→5♦ med
 * ruter, pass med klöver; partnerns 4M till spel passas. null när svaret inte
 * är ett av schemats (människobud) — då får catch-allen ta det.
 */
export function openerRebidAfterGambling3NT(response: ResponseResult, hand: Hand): ResponseResult | null {
  const minor = isGambling3NTHand(hand)
  switch (response.rule) {
    case 'Gambling: 4♣ pass eller rätta':
    case 'Gambling: 5♣ pass eller rätta': {
      const level = response.call[0]
      if (minor === 'diamonds') {
        return { call: `${level}D` as Bid, rule: 'Gambling: rättelse', explanation: `Partnerns ${level}♣ (pass eller rätta) — lågfärgen är ruter → ${level}♦.` }
      }
      return { call: 'P', rule: 'rebid: pass', explanation: `Partnerns ${level}♣ (pass eller rätta) — lågfärgen är klöver → pass.` }
    }
    case 'Gambling: 4M till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: `Partnerns 4 i högfärg är till spel → pass.` }
    case '4NT kvantitativ':
      // Svaret på kvantitativ 4NT över Gambling 3NT byggs senare (docs/senare.md) —
      // tills dess passar öppnaren.
      return { call: 'P', rule: 'rebid: pass', explanation: `Kvantitativ 4NT över Gambling 3NT — öppnaren passar (svarsschemat byggs senare).` }
    default:
      return null
  }
}

// ============================================================================
// Försvaret mot DERAS Gambling 3NT (raden *försvar-gambling-3nt*)
// ============================================================================

/**
 * Deras 3NT-ÖPPNING och vår sidas FÖRSTA försvarsaktion (direkt sits eller
 * balansering), vår sida annars tyst. Analogt med `defendTheirNTSeat`.
 */
export function defendTheirGambling3NTSeat(f: AuctionFacts): { balancing: boolean } | null {
  const open = f.opening
  if (!open || f.weOpened || open.strain !== 'NT' || open.level !== 3) return null
  if (f.contractBids.length !== 1) return null // bara deras 3NT hittills
  if (f.history.some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')) return null
  const after = f.history.slice(open.index + 1)
  const direct = after.length === 0
  const balancing = after.length === 2 && after.every((c) => c.bid === 'P')
  if (!direct && !balancing) return null
  return { balancing }
}

/**
 * Vårt försvar mot deras Gambling 3NT, v1: naturlig 4♥/4♠ med bra 6+ färg
 * (≥ 2 av A/K/Q) och öppningsstyrka (12+ hp), annars pass. Straff-X och
 * Klingers 4♣/4♦-takeout för högfärgerna är SENARE.
 */
export function defendTheirGambling3NT(hand: Hand, f: AuctionFacts): ResolvedCall {
  const seat: Seat = f.seat
  const len = lengths(hand)
  if (hcp(hand) >= 12) {
    const major = (['spades', 'hearts'] as Suit[]).find((m) => len[m] >= 6 && goodSuit(hand, m))
    if (major) {
      return { seat, bid: `4${LETTER[major]}` as Bid, rule: 'inkliv över Gambling 3NT', explanation: `Öppningsstyrka med bra 6+ ${SYM[major]} mot deras Gambling 3NT → 4${SYM[major]} (naturligt, till spel).` }
    }
  }
  return { seat, bid: 'P', rule: 'pass', explanation: `Ingen bra 6+ högfärg med öppningsstyrka mot deras Gambling 3NT → pass.` }
}
