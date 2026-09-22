// ADVANCERN ÖVER PARTNERNS SVAGA HOPPINKLIV — sunt förnuft-lagret hål 1
// (ägarbeslut 2026-09-22, docs/sunt-fornuft-plan.md; systemboken §7.1).
//
//   (1x) – 2y/3y [hoppinkliv: 6+ kort, 6–10 hp] – (pass) – ?
//
// Förr fanns bara spärrhöjningen (3+ stöd → en nivå upp, i `fit-raise.ts`), så
// advancern utan stöd PASSADE UTAN REGEL oavsett styrka (16–18 hp), och med stöd
// höjde hon spärrande även på 18 hp med stopp. Ägarens struktur:
//   • 3NT: 15+ hp och stopp i deras färg — går före höjningen (nio stick på
//     partnerns sexkortsfärg är närmare än elva);
//   • ny färg: EJ krav, lovar 5+ kort och 15+ hp (inklivaren höjer med 3+ stöd,
//     `overcallerRaisesAdvance`, annars pass/rättelse);
//   • 3+ stöd utan utgångsintresse → PASS (ägarbeslut: höjningen behövs inte;
//     bjuder de 3x tävlar vi 4m — raden advance2);
//   • annars pass — MED motivering, så tystnaden är ett beslut.
// Läser bara egen hand + auktionen (ärlig inferens).

import type { Bid, Hand, Suit } from '../../types/bridge'
import { parseContractBid, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { hcp, lengths } from './hand'
import type { Kunskap } from './overcall-continuations'
import { hasStopper } from './overcalls'
import { side } from './play'

/** Ägarens trösklar 2026-09-22 (hp). */
export const HOPPINKLIV_ADVANCE = { sang: 15, nyFarg: 15 } as const

/**
 * Är det advancerns första tur direkt efter partnerns svaga HOPPINKLIV i färg
 * över deras 1-läges färgöppning (svararen passade)? Hopp = partnerns färg
 * ligger en nivå över det billigaste lagliga.
 */
export function jumpOvercallAdvanceSeat(f: AuctionFacts): { partnerSuit: Suit; theirSuit: Suit; level: number } | null {
  const open = f.opening
  if (!open || f.weOpened || open.level !== 1 || open.strain === 'NT') return null
  const h = f.history
  if (h.length !== open.index + 3) return null
  const ov = h[open.index + 1]
  if (ov.seat !== f.partner || side(ov.seat) === side(open.seat)) return null
  const cb = parseContractBid(ov.bid)
  if (!cb || cb.strain === 'NT' || cb.strain === open.strain) return null
  if (h[open.index + 2].bid !== 'P') return null
  const partnerSuit = SUIT_OF_LETTER[cb.strain]
  const order = ['C', 'D', 'H', 'S']
  const cheapest = order.indexOf(cb.strain) > order.indexOf(open.strain) ? 1 : 2
  if (cb.level !== cheapest + 1) return null // enkelt inkliv (raden advance) eller högre hopp
  return { partnerSuit, theirSuit: SUIT_OF_LETTER[open.strain], level: cb.level }
}

/** Advancerns bud över hoppinklivet, eller null → spärrhöjningen / catch-all. */
export function advanceJumpOvercall(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = jumpOvercallAdvanceSeat(f)
  if (!l) return null
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(f.history, f.seat)
  const T = HOPPINKLIV_ADVANCE

  if (p >= T.sang && hasStopper(hand, l.theirSuit) && legal.includes('3NT' as Bid)) {
    return { call: '3NT', rule: 'advance hoppinkliv: 3NT', explanation: `${T.sang}+ hp och stopp i deras ${SWE_SYM[letterOfSuit(l.theirSuit)]} mot partnerns hoppinkliv (6+ kort, 6–10 hp) → 3NT (avslut).` }
  }
  if (p >= T.nyFarg) {
    const egen = (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[])
      .filter((s) => s !== l.partnerSuit && s !== l.theirSuit && len[s] >= 5)
      .sort((a, b) => len[b] - len[a])[0]
    if (egen) {
      const b = cheapestBidIn(f.history, f.seat, letterOfSuit(egen))
      const cb = b ? parseContractBid(b) : null
      if (b && cb && cb.level <= 3 && legal.includes(b)) {
        return { call: b, rule: 'advance hoppinkliv: ny färg', explanation: `${T.nyFarg}+ hp och en egen ${len[egen]}-korts ${SWE_SYM[letterOfSuit(egen)]}, utan stopp i deras färg → ${prettyBid(b)} (naturligt, ej krav — partnern höjer med 3+ stöd).` }
      }
    }
  }
  // Stöd utan utgångsintresse: ingen höjning (ägarbeslut 2026-09-22) — bjuder
  // motståndarna 3x tävlar vi till 4m i stället (raden advance2, 'tävla till fiten').
  if (len[l.partnerSuit] >= 3) return { call: 'P', rule: 'pass med fit', explanation: `Stöd i partnerns ${SWE_SYM[letterOfSuit(l.partnerSuit)]} men inget utgångsintresse → pass; bjuder motståndarna vidare tävlar vi med ${prettyBid(`${l.level + 1}${letterOfSuit(l.partnerSuit)}` as Bid)}.` }
  return { call: 'P', rule: 'pass', explanation: `Partnerns hoppinkliv är svagt (6–10 hp); utan ${T.sang}+ med stopp för 3NT och utan ${T.nyFarg}+ med egen femkortsfärg finns inget att tillägga → pass.` }
}
