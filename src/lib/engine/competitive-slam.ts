// KONKURRENS-SLAM — etapp 7 hål D (systembok §6.10): den kontroll-kompletta
// starka kaptenen frågar 4NT (1430 RKC) när en högfärgsfit hittats i
// konkurrens, och placerar sedan lillslam/stopp på svaret. Flyttat ordagrant
// från `auction-live.ts` (`competitiveSlamTry`/`competitiveRKCPlace`) till
// en tabellrad i motorbytets etapp 4 familj 1 (2026-09-08): steget låg FÖRE
// konkurrensdetektorerna i det gamla lagret, och när inklivsfamiljen flyttade
// in i tabellen (som frågas först) måste slamsteget också ligga i tabellen —
// före familjens rader — för att behålla sin företrädesrätt. Egen hand +
// fakta, aldrig någon annan hand. Familj 8 (konkurrens-slam) bygger vidare här.

import type { Bid, Hand, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, STRAINS, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { startingPoints } from './evaluation'
import { lengths } from './hand'
import { side } from './play'
import { firstRoundControl, keycards } from './slam'
import type { Kunskap } from './overcall-continuations'

/** Antal kontroller (A = 2, K = 1) — grovt mått på "extra på riktigt". */
function controlCount(hand: Hand): number {
  return hand.reduce((n, c) => n + (c.rank === 'A' ? 2 : c.rank === 'K' ? 1 : 0), 0)
}

/**
 * Högfärgsfit i konkurrens: överenskommen trumf om det är en högfärg, annars
 * partnerns senaste högfärgsbud (ej deras färg) som jag har 3+ stöd i.
 */
function competitiveMajorFit(f: AuctionFacts, hand: Hand): Suit | null {
  const { history, seat } = f
  const agreed = f.agreedTrump
  if (agreed === 'hearts' || agreed === 'spades') return agreed
  for (let i = history.length - 1; i >= 0; i--) {
    const c = history[i]
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    const s = SUIT_OF_LETTER[cb.strain]
    if ((s === 'hearts' || s === 'spades') && lengths(hand)[s] >= 3 && !f.theirStrains.has(cb.strain)) {
      return s
    }
  }
  return null
}

/**
 * Har PARTNERN någon gång HOPPAT (bjudit en färg högre än billigaste lagliga
 * nivån vid den punkten)? Ett hopp visar extra värden på egen kraft (t.ex. en
 * inbjudande hoppadvance 3♠), till skillnad från ett minimalt billigaste svar.
 * Det skiljer den ärliga slamsidan (partnern har extra) från kaptenen som ensam
 * är stark mittemot ett minimumsvar — den senare ledde till överbud (för högt).
 */
function partnerShowedJump(history: ResolvedCall[], seat: string): boolean {
  const partner = PARTNER[seat as keyof typeof PARTNER]
  const rankOf = (bid: string): number => {
    const cb = parseContractBid(bid)
    return cb ? (cb.level - 1) * 5 + STRAINS.indexOf(cb.strain as (typeof STRAINS)[number]) : -1
  }
  for (let i = 0; i < history.length; i++) {
    const c = history[i]
    if (c.seat !== partner) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    let prevRank = -1
    for (let j = 0; j < i; j++) prevRank = Math.max(prevRank, rankOf(history[j].bid))
    const strainIdx = STRAINS.indexOf(cb.strain as (typeof STRAINS)[number])
    let minLevel = 7
    for (let lvl = 1; lvl <= 7; lvl++) {
      if ((lvl - 1) * 5 + strainIdx > prevRank) { minLevel = lvl; break }
    }
    if (cb.level > minLevel) return true // partnern hoppade
  }
  return false
}

/** Har kaptenen första-rondskontroll (ess/renons) i ALLA sidofärger (≠ trumf)? */
function controlComplete(hand: Hand, trump: Suit): boolean {
  return (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[])
    .filter((s) => s !== trump)
    .every((s) => firstRoundControl(hand, s))
}

/**
 * TRIGGERN (steg 1): den KONTROLL-KOMPLETTA starka kaptenen frågar 4NT (1430 RKC)
 * i stället för att stanna i utgång, när en högfärgsfit hittats i konkurrens.
 */
export function competitiveSlamTry(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  if (!f.opponentsHaveBid) return null // ingen konkurrens
  if (!legalCalls(history, seat).includes('4NT')) return null
  if (history.some((c) => side(c.seat) === side(seat) && (c.bid === '4NT' || (parseContractBid(c.bid)?.level ?? 0) >= 5))) {
    return null // vår sida redan i slamzonen på annan väg
  }
  const fit = competitiveMajorFit(f, hand)
  if (!fit) return null
  const sp = startingPoints(hand).startingPoints
  const honestExtra = sp >= 17 || (sp >= 16 && controlCount(hand) >= 3)
  if (!honestExtra) return null
  if (!controlComplete(hand, fit)) return null // steg 1: bara kontroll-komplett
  if (!partnerShowedJump(history, seat)) return null // partnern måste ha visat extra (hopp)

  return {
    call: '4NT',
    rule: 'konkurrens-slaminvit (RKC)',
    explanation:
      `Slamvärden + agreed ${SWE_SYM[letterOfSuit(fit)]} + första-rondskontroll i alla sidofärger → 4NT ` +
      `(1430 RKC). Jag har kontrollerna själv, så jag frågar nyckelkort direkt i stället för att cue:a och läcka dem.`,
  }
}

/**
 * PLACERINGEN: jag frågade 4NT, partnern har svarat (5-steg). Räkna nyckelkort
 * (egen hand + svarets härledda antal) och placera lillslam bara när summan är
 * ENTYDIG och ≥4; annars stanna i 5 i trumf. Storslam bjuds aldrig här.
 */
export function competitiveRKCPlace(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const askIdx = history.findIndex((c) => c.seat === seat && c.bid === '4NT' && c.rule === 'konkurrens-slaminvit (RKC)')
  if (askIdx < 0) return null // placerar bara efter VÅR egen konkurrens-slaminvit
  const after = history.slice(askIdx + 1)
  if (after.some((c) => c.seat === seat && parseContractBid(c.bid))) return null // redan placerat
  const answer = after.find((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (!answer) return null

  const trump = competitiveMajorFit(f, hand) ?? f.agreedTrump
  if (!trump) return null

  const own = keycards(hand, trump)
  const opts: Record<string, number[]> = { '5C': [1, 4], '5D': [0, 3], '5H': [2, 5], '5S': [2, 5] }
  const possible = (opts[answer.bid] ?? []).filter((o) => own + o <= 5)
  if (possible.length === 0) return null
  const legal = legalCalls(history, seat)
  const slam = `6${letterOfSuit(trump)}` as Bid
  const stop = `5${letterOfSuit(trump)}` as Bid

  if (possible.length === 1 && own + possible[0] >= 4 && legal.includes(slam)) {
    return {
      call: slam, rule: 'konkurrens-slam: placering',
      explanation: `essvaret ${prettyBid(answer.bid)} + min hand = ${own + possible[0]} av 5 nyckelkort (högst ett saknas) → ${prettyBid(slam)} (lillslam).`,
    }
  }
  if (legal.includes(stop)) {
    return {
      call: stop, rule: 'konkurrens-slam: stopp',
      explanation: `essvaret ${answer.bid} lämnar nyckelkortsläget osäkert → stannar i ${stop} (utgång).`,
    }
  }
  return null
}
