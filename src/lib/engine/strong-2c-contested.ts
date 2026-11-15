// STÖRD STARK 2♣ — öppnaren passar aldrig ut inklivet (felrapport #127,
// ägarbeslut 2026-11-15; docs/budsystem.md §7.9).
//
//     Syd    Väst   Nord   Öst
//     pass   pass   2♣     2♠
//     pass   pass   ???            ← Nord ♠AQ ♥A ♦AKJT964 ♣A85 passade ut 2♠
//
// Hålet: efter 2♣–(inkliv) fanns ingen rad alls — både svararen och öppnaren
// föll till "pass (ingen regel)". Ägarens besked: "2♣-öppnaren får inte passa i
// detta läget. Bjud så naturligt det går, lång färg eller NT. Annars dubbel =
// tvingar partner att bjuda."
//
// Två kunskapsfunktioner, båda ur EN hand + auktionen (ärlig inferens):
//  · `strong2cOpenerActs`  — öppnarens andra tur: färg / sang / X, aldrig pass.
//  · `answerStrong2cDouble` — svararen på den dubblingen: bjuder alltid.
// Svararens FÖRSTA tur över inklivet (pass/X/ny färg) är inte beslutad än och
// lämnas orörd.

import type { Bid, Hand, Suit } from '../../types/bridge'
import { parseContractBid, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/** Deras senaste kontraktsbud som FÄRG (inte sang) på högst 4-läget — annars null. */
function theirSuitBid(f: AuctionFacts): { suit: Suit; level: number; bid: string } | null {
  const last = f.lastContract
  if (!last || side(last.seat) === side(f.seat)) return null
  const cb = parseContractBid(last.bid)
  if (!cb || cb.strain === 'NT' || cb.level > 4) return null
  return { suit: SUIT_OF_LETTER[cb.strain], level: cb.level, bid: last.bid }
}

/**
 * Öppnarens stol: jag öppnade 2♣ (vår sidas ENDA kontraktsbud), motståndarna
 * har klivit in i en färg (ev. höjt den), partnern har bara passat, ingen av
 * oss har dubblat, och bara pass ligger på deras senaste bud.
 */
export function strong2cOpenerContestedSeat(f: AuctionFacts): { suit: Suit; level: number; bid: string } | null {
  const open = f.opening
  if (!open || open.seat !== f.seat || open.level !== 2 || open.strain !== 'C') return null
  if (f.ourContractBids.length !== 1 || f.theirContractBids.length === 0) return null
  if (!f.quietSinceLastContract) return null
  if (f.history.some((c) => side(c.seat) === side(f.seat) && (c.bid === 'X' || c.bid === 'XX'))) return null
  if (f.history.filter((c) => c.seat === f.seat).length !== 1) return null // bara min andra tur
  return theirSuitBid(f)
}

/** Öppnarens andra bud över inklivet: lång färg, sang med stopp, annars X — aldrig pass. */
export function strong2cOpenerActs(hand: Hand, f: AuctionFacts): Kunskap | null {
  const their = strong2cOpenerContestedSeat(f)
  if (!their) return null
  const len = lengths(hand)
  const legal = legalCalls(f.history, f.seat)
  const dSym = SWE_SYM[letterOfSuit(their.suit)]
  const p = hcp(hand)

  // Längsta egna färg (inte deras); vid lika längd den högre.
  const egen = [...RANK_ORDER].reverse().filter((s) => s !== their.suit).sort((a, b) => len[b] - len[a])[0]
  const färgbud = (minLen: number): Kunskap | null => {
    if (len[egen] < minLen) return null
    const bud = cheapestBidIn(f.history, f.seat, letterOfSuit(egen))
    if (!bud) return null
    const nivå = Number(bud[0])
    // Fem kort bjuds högst på 4-läget, sex eller fler även på 5-läget.
    if (nivå > (len[egen] >= 6 ? 5 : 4)) return null
    return {
      call: bud,
      rule: 'stört 2♣: egen färg',
      explanation: `2♣-öppnaren passar aldrig ut deras ${prettyBid(their.bid)}: ${len[egen]} ${SWE_SYM[letterOfSuit(egen)]} → ${prettyBid(bud)} (naturligt).`,
    }
  }
  const sang = (): Kunskap | null => {
    if (!isBalanced(hand) || !hasStopper(hand, their.suit)) return null
    const bud = (p >= 25 ? ['3NT'] : ['2NT', '3NT']).find((b) => legal.includes(b as Bid))
    if (!bud) return null
    return {
      call: bud,
      rule: 'stört 2♣: sang',
      explanation: `2♣-öppnaren passar aldrig ut deras ${prettyBid(their.bid)}: jämn hand med stopp i ${dSym} → ${bud} (naturligt).`,
    }
  }

  // "Så naturligt det går, lång färg eller NT": den ojämna handen (eller sex+
  // kort) visar färgen; den jämna med stopp bjuder sang; femkortsfärgen utan
  // stopp bjuds; annars dubbling som tvingar partnern att bjuda.
  const k = (!isBalanced(hand) || len[egen] >= 6 ? färgbud(5) : null) ?? sang() ?? färgbud(5)
  if (k) return k
  if (!legal.includes('X')) return null
  return {
    call: 'X',
    rule: 'stört 2♣: dubbling',
    explanation: `2♣-öppnaren passar aldrig ut deras ${prettyBid(their.bid)}: ingen lång färg och ingen sang att bjuda → X (tvingar partnern att bjuda).`,
  }
}

/**
 * Svararens stol efter öppnarens dubbling: partnern öppnade 2♣, jag har bara
 * passat, partnerns senaste icke-pass är X på deras färgbud och bara pass har följt.
 */
export function strong2cDoubleToAnswer(f: AuctionFacts): { suit: Suit; level: number; bid: string } | null {
  const open = f.opening
  if (!open || open.seat !== f.partner || open.level !== 2 || open.strain !== 'C') return null
  if (f.ourContractBids.length !== 1) return null
  const last = f.lastNonPass
  if (!last || last.seat !== f.partner || last.bid !== 'X') return null
  if (f.history.some((c) => c.seat === f.seat && c.bid !== 'P')) return null
  return theirSuitBid(f)
}

/** Svaret på 2♣-öppnarens dubbling: längsta färgen billigast — aldrig pass. */
export function answerStrong2cDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const their = strong2cDoubleToAnswer(f)
  if (!their) return null
  const len = lengths(hand)
  // Längsta färg utanför deras; vid lika längd den som bjuds billigast.
  const kandidater = RANK_ORDER.filter((s) => s !== their.suit)
    .map((s) => ({ s, bud: cheapestBidIn(f.history, f.seat, letterOfSuit(s)) }))
    .filter((x): x is { s: Suit; bud: Bid } => x.bud !== null)
    .sort((a, b) => len[b.s] - len[a.s] || legalCalls(f.history, f.seat).indexOf(a.bud) - legalCalls(f.history, f.seat).indexOf(b.bud))
  const val = kandidater[0]
  if (!val) return null
  return {
    call: val.bud,
    rule: 'svar på 2♣-öppnarens dubbling',
    explanation: `Partnerns dubbling efter 2♣ tvingar mig att bjuda: längsta färgen (${len[val.s]} ${SWE_SYM[letterOfSuit(val.s)]}) → ${prettyBid(val.bud)}. Lovar ingenting.`,
  }
}
