// INKLIVARENS OCH ADVANCERNS FORTSÄTTNINGAR — systembok §7.1–7.2, motorbytets
// etapp 4 familj 1 (2026-09-08). Kunskapsfunktioner för beslutstabellen
// (`auction-decide.ts`): EGEN hand + auktionsläget (`AuctionFacts`, läst ur
// auktionen ensam) → ett bud. Ingen annan hand finns att läsa här.
//
// Innehållet är detektorerna som förr låg i `auction-live.ts`
// (overcallerRaiseAdvance, overcallerAnswersCueRaise,
// overcallerCompetesAfterCueRaise, advancerPrefersOvercallSuit,
// advancerCompetesToFit, answerCueBidderRebid (inklivsfallet),
// ownDoubledTwoSuiterRescue, advancerRespondsTo1NTOvercall,
// overcallerAnswersAdvance) — samma bridgekunskap, nu som rena funktioner av
// hand + fakta i stället för steg i en ordnad kö. Lägesläsarna (`…Seat`,
// `…Turn`) exporteras så tabellraderna kan uttrycka sina lägen exakt.
//
// Nytt i familjen (facit-kön `motorbyte-facit.test.ts`): tvåfärgsinklivarens
// egen fortsättning när motståndarna bjudit över och partnern passat
// (frö 20261162: 5♣ med 20 hp 6-5), och advancerns preferens även när
// motståndarna höjt sin egen färg efter tvåfärgsbudet (frö 20262021: 4♣).

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { dummyPoints, pointsWithFloor } from './evaluation'
import { hcp, lengths } from './hand'
import { penaltyDouble } from './doubles'
import { hasStopper } from './overcalls'
import { openerRebidAfter1NTResponse } from './rebids'
import type { ResponseResult } from './responses'
import { responderRebidIn1NTAuction } from './responder-rebids'
import { respondTo1NT } from './responses-nt'
import { side } from './play'

/** Ett bud ur en kunskapsfunktion: budet + regelnamnet + förklaringen. */
export interface Kunskap {
  call: string
  rule: string
  explanation: string
}

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)
const isMajorStrain = (st: string) => st === 'H' || st === 'S'

/** Motståndarnas 1-läges FÄRGöppning, eller null. */
function theirOneSuitOpening(f: AuctionFacts): { index: number; strain: string; suit: Suit } | null {
  const open = f.opening
  if (!open || f.weOpened || open.level !== 1 || open.strain === 'NT') return null
  return { index: open.index, strain: open.strain, suit: SUIT_OF_LETTER[open.strain] }
}

// ============================================================================
// Inklivssitsen (raden *inkliv*)
// ============================================================================

/**
 * Är `seat` i INKLIVSSITS över motståndarnas 1-läges färgöppning? Öppningen
 * är auktionens enda kontraktsbud, vår sida har inte sagt ett ljud, och sitsen
 * är DIREKT (öppningen var senaste budet) eller BALANSERING (öppningen följd av
 * exakt två pass — utpassningsläget, "låna en kung"). Samma två sitsar som
 * det gamla lagrets `maybeOvercall` och manusets konkurrensrond.
 */
export function overcallSeat(f: AuctionFacts): { openBid: string; balancing: boolean } | null {
  const open = theirOneSuitOpening(f)
  if (!open) return null
  if (f.contractBids.length !== 1) return null
  if (f.history.some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')) return null
  const after = f.history.slice(open.index + 1)
  const direct = after.length === 0
  const balancing = after.length === 2 && after.every((c) => c.bid === 'P')
  if (!direct && !balancing) return null
  return { openBid: f.history[open.index].bid, balancing }
}

// ============================================================================
// Advancerns första bud (raden *advance*)
// ============================================================================

/**
 * Partnern gjorde ett NATURLIGT färginkliv (ej hopp) i direkt sits över deras
 * 1-läges färgöppning, svararen passade, och det är advancerns första tur.
 * `level` = inklivets nivå (1 eller 2). Hoppinkliv (t.ex. 1♣–2♦, 1♦–3♣)
 * lämnas åt det gamla lagret (spärrhöjningen i `raiseWithFit`).
 */
export function advanceSeat(f: AuctionFacts): { partnerSuit: Suit; theirSuit: Suit; level: 1 | 2 } | null {
  const open = theirOneSuitOpening(f)
  if (!open) return null
  const h = f.history
  if (h.length !== open.index + 3) return null
  const ov = h[open.index + 1]
  if (ov.seat !== f.partner) return null
  const cb = parseContractBid(ov.bid)
  if (!cb || cb.strain === 'NT' || cb.strain === open.strain) return null
  if (h[open.index + 2].bid !== 'P') return null
  const partnerSuit = SUIT_OF_LETTER[cb.strain]
  const cheapestLevel = rankIdx(partnerSuit) > rankIdx(open.suit) ? 1 : 2
  if (cb.level !== cheapestLevel) return null // hoppinkliv
  return { partnerSuit, theirSuit: open.suit, level: cheapestLevel }
}

/**
 * Partnern gjorde ett TVÅFÄRGSINKLIV (Michaels-cue i deras färg eller ovanlig
 * 2NT) som `seat` (advancern) ännu inte svarat på. Kraven (felrapport #7 –
 * luckan lät auktionen dö i stället för preferens; #11 – Nord passade ut
 * partnerns 3♣-cue):
 *  - motståndarna öppnade 1 i färg (auktionens första kontraktsbud),
 *  - partnerns inkliv är vår sidas ENDA kontraktsbud och är en CUE i deras
 *    färg (2- eller 3-läget – höjer de sin öppning kommer cuet ett läge
 *    högre) eller 2NT,
 *  - mellan öppningen och inklivet ligger bara pass, dubblingar och
 *    motståndarnas höjning av sin EGEN färg (t.ex. 1♣ – X – 2♣ – 3♣);
 *    ett annat kontraktsbud emellan ändrar cuets mening → null,
 *  - efter inklivet: pass, X/XX och motståndarnas höjningar av sin EGEN färg
 *    (frö 20262021: 1♠–(2NT)–3♠ — preferensplikten består, budet får bara
 *    hamna ett läge högre). Ett annat kontraktsbud över tar oss till vanlig
 *    konkurrens → null.
 * `contested` = något annat än pass har hänt efter inklivet.
 */
export function twoSuiterAdvanceSeat(f: AuctionFacts): { partnerCall: string; theirSuit: Suit; contested: boolean } | null {
  const open = theirOneSuitOpening(f)
  if (!open) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== f.partner) return null
  const pc = ourBids[0]
  const pcb = parseContractBid(pc.bid)!
  const isCue = pcb.strain === open.strain && pcb.level <= 3
  if (!isCue && !isTwoSuiterBid(pc.bid, open.strain)) return null
  const h = f.history
  const pcIdx = h.indexOf(pc)
  const theirOwnRaise = (c: ResolvedCall) => {
    const cb = parseContractBid(c.bid)
    return !!cb && cb.strain === open.strain && side(c.seat) !== side(f.seat)
  }
  for (const c of h.slice(open.index + 1, pcIdx)) {
    if (c.bid === 'P' || c.bid === 'X' || c.bid === 'XX') continue
    if (theirOwnRaise(c)) continue
    return null
  }
  const after = h.slice(pcIdx + 1)
  for (const c of after) {
    if (c.bid === 'P' || c.bid === 'X' || c.bid === 'XX') continue
    if (theirOwnRaise(c)) continue
    return null
  }
  if (h.some((c) => c.seat === f.seat && c.bid !== 'P')) return null // advancern objuden
  return { partnerCall: pc.bid, theirSuit: open.suit, contested: after.some((c) => c.bid !== 'P') }
}

/** Michaels-cue (2 i deras färg) eller ovanlig 2NT? */
export function isTwoSuiterBid(bid: string, openStrain: string): boolean {
  return bid === `2${openStrain}` || bid === '2NT'
}

/**
 * Gjorde vår sida ett rent, naturligt 1NT-INKLIV? Sant när auktionens öppning är
 * motståndarnas 1-läges FÄRGöppning och vår sidas FÖRSTA kontraktsbud är 1NT utan
 * en egen dubbling före (då vore 1NT en stark X-1NT, inte inklivet). Returnerar
 * inklivarens plats, annars null. (Ovanlig 2NT är 2NT, inte 1NT → faller utanför.)
 */
export function our1NTOvercall(f: AuctionFacts): { overcaller: Seat } | null {
  const open = theirOneSuitOpening(f)
  if (!open) return null
  const ourContracts = f.ourContractBids
  if (ourContracts.length === 0 || ourContracts[0].bid !== '1NT') return null
  const firstIdx = f.history.indexOf(ourContracts[0])
  if (f.history.slice(0, firstIdx).some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')) return null
  return { overcaller: ourContracts[0].seat }
}

/**
 * PARTNERN klev in 1NT och det är advancerns (`seat`) tur att svara första gången,
 * ostört (RHO passade) → sangsystemet (`respondTo1NT`, §4.3 systems on): Stayman/
 * transfer/Texas/MSS. Uppföljning felrapport #53.
 */
export function advancerRespondsTo1NTOvercall(hand: Hand, f: AuctionFacts): Kunskap | null {
  const oc = our1NTOvercall(f)
  if (!oc || oc.overcaller !== f.partner) return null
  if (f.ourContractBids.length !== 1) return null
  if (f.history.some((c) => c.seat === f.seat && c.bid !== 'P')) return null
  const last = f.lastNonPass
  if (!last || last.seat !== oc.overcaller || last.bid !== '1NT') return null
  const res = respondTo1NT(hand)
  return { call: res.call, rule: res.rule, explanation: res.explanation }
}

/**
 * Betydelsen av partnerns svar på VÅR 1NT/2NT, läst ur BUDET (aldrig ur
 * partnerns kort): `ResponseResult.rule`-strängen som
 * `openerRebidAfter1NTResponse`/`openerRebidAfter2NTResponse` dispatchar på,
 * eller null när budet inte är ett systemsvar.
 */
export function ntResponseRule(openLevel: number, bid: string): string | null {
  if (openLevel === 1) {
    switch (bid) {
      case '2C': return 'Stayman'
      case '2D': case '2H': return 'Jacoby-transfer'
      case '2S': return 'Minor Suit Stayman'
      case '2NT': return '2NT inbjudan'
      case '3NT': return '3NT till spel'
      case '4D': case '4H': return 'Texas'
      case '4NT': return '4NT kvantitativ'
      default: return null
    }
  }
  switch (bid) {
    case '3C': return 'Stayman (2NT)'
    case '3D': case '3H': return 'transfer (2NT)'
    case '3S': return 'minorfråga (2NT)'
    case '4D': case '4H': return 'Texas (2NT)'
    case '4NT': return '4NT kvantitativ'
    case '6NT': return '6NT till spel'
    default: return null
  }
}

/**
 * JAG klev in 1NT, advancern svarade med ett systemsvar, ostört (RHO passade) →
 * fullfölj (Stayman-svar, transfer, Texas, MSS) via samma dispatch som över en
 * 1NT-öppning.
 */
export function overcallerAnswersAdvance(hand: Hand, f: AuctionFacts): Kunskap | null {
  const oc = our1NTOvercall(f)
  if (!oc || oc.overcaller !== f.seat) return null
  const ourContracts = f.ourContractBids
  if (ourContracts.length !== 2 || ourContracts[1].seat !== f.partner) return null
  if (!f.lastNonPass || f.lastNonPass !== ourContracts[1]) return null
  const rule = ntResponseRule(1, ourContracts[1].bid)
  if (!rule) return null
  const res = openerRebidAfter1NTResponse({ call: ourContracts[1].bid, rule, explanation: '' }, hand)
  if (!res) return null
  return { call: res.call, rule: res.rule, explanation: res.explanation }
}

/**
 * Advancerns ANDRA bud efter partnerns 1NT-inkliv (systems on, live-prov
 * 2026-09-12): jag svarade partnerns inkliv med ett systemsvar (Stayman/
 * transfer), partnern fullföljde, nu bjuder jag om — **Smolen** (GF 5-4 → hopp
 * i den kortare högfärgen), **garbage** (svag 5-5/5-4 → 2-läget, pass-eller-
 * rätta), inbjudan m.m. Delegeras till SAMMA maskineri som över en 1NT-öppning
 * (`responderRebidIn1NTAuction`), som redan bär Smolen/garbage. Förr saknades
 * lagret → motorn passade svararens 5-5. null → gamla lagret.
 */
export function advancerRebidsAfter1NTOvercall(hand: Hand, f: AuctionFacts): Kunskap | null {
  const oc = our1NTOvercall(f)
  if (!oc || oc.overcaller !== f.partner) return null
  const ours = f.ourContractBids
  if (ours.length !== 3) return null
  if (ours[0].bid !== '1NT' || ours[0].seat !== f.partner) return null // partnerns inkliv
  if (ours[1].seat !== f.seat) return null // mitt systemsvar
  if (ours[2].seat !== f.partner) return null // partnerns fullföljning
  if (!f.lastNonPass || f.lastNonPass !== ours[2]) return null // ostört (partnerns svar senast)
  const responseRule = ntResponseRule(1, ours[1].bid)
  // Avgränsat till STAYMAN-vägen (live-provsfyndet: garbage 5-5 / Smolen 5-4).
  // Transfer-fortsättningarna över inklivet sköts av det gamla lagret som förut
  // — att fånga dem här ändrade fungerande auktioner (utgång → dellek).
  if (responseRule !== 'Stayman') return null
  const response: ResponseResult = { call: ours[1].bid, rule: responseRule, explanation: '' }
  // responderRebidIn1NTAuction dispatchar på response.rule + rebid.call.
  const rebid: ResponseResult = { call: ours[2].bid, rule: 'Stayman-svar', explanation: '' }
  const res = responderRebidIn1NTAuction(response, rebid, hand)
  if (!res) return null
  // Bara de DEFINITIVA buden tas här: svag garbage-signoff (5-5 → 2M), Smolen
  // (GF 5-4), 3NT och utgång. En INBJUDAN (2NT/3M) hänger — inklivaren har ingen
  // rad som accepterar den ännu, så utgång skulle missas; den lämnas åt det gamla
  // lagret som förut (som hoppar till utgång med fit). Live-prov 2026-09-12.
  if (res.rule === 'inbjudan') return null
  if (res.call !== 'P' && !legalCalls(f.history, f.seat).includes(res.call)) return null // olagligt → gamla lagret
  return { call: res.call, rule: res.rule, explanation: res.explanation }
}

// ============================================================================
// Inklivarens andra tur (raden *inkliv2*)
// ============================================================================

/**
 * Mitt NATURLIGA färginkliv (ej cue, ej NT, mitt första icke-pass) + partnerns
 * svar = vår sidas exakt två kontraktsbud över deras 1-läges färgöppning.
 * Returnerar de två buden, annars null.
 */
export function overcallerSecondTurn(f: AuctionFacts): { mine: ResolvedCall; adv: ResolvedCall } | null {
  const open = theirOneSuitOpening(f)
  if (!open) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  const [mine, adv] = ourBids
  if (mine.seat !== f.seat || adv.seat !== f.partner) return null
  const mineCb = parseContractBid(mine.bid)!
  if (mineCb.strain === 'NT' || f.theirStrains.has(mineCb.strain)) return null
  const mineIdx = f.history.indexOf(mine)
  if (f.history.slice(0, mineIdx).some((c) => c.seat === f.seat && c.bid !== 'P')) return null // X först = annan hand
  return { mine, adv }
}

/**
 * Har PARTNERN (advancern) avancerat MITT inkliv med en NY färg, så att jag
 * (inklivaren) ska visa stöd i stället för att passa (felrapport #15)? En ny
 * färg från advancern på 2-läget lovar en verklig 5+ färg, så mina 3-korts stöd
 * = 8-korts fit. Med stöd + lite extra (dummyPoints ≥ 10) höjer jag ETT steg –
 * enkel stödhöjning, ej krav (advancern är redan begränsad till ~8–11, så ett
 * hopp vore fel; ägarbeslut felrapport #15). Ett dött minimuminkliv passar
 * (null → det gamla lagret, som förut).
 */
export function overcallerRaisesAdvance(hand: Hand, f: AuctionFacts): Kunskap | null {
  const t = overcallerSecondTurn(f)
  if (!t) return null
  const mineCb = parseContractBid(t.mine.bid)!
  const advCb = parseContractBid(t.adv.bid)!
  if (advCb.strain === 'NT' || advCb.strain === mineCb.strain || f.theirStrains.has(advCb.strain)) return null
  if (advCb.level < 2) return null
  const advIdx = f.history.indexOf(t.adv)
  if (f.history.slice(advIdx + 1).some((c) => parseContractBid(c.bid))) return null
  const suit = SUIT_OF_LETTER[advCb.strain]
  if (lengths(hand)[suit] < 3) return null
  if (dummyPoints(hand, suit).dummyPoints < 10) return null
  const bid = `${advCb.level + 1}${advCb.strain}`
  if (!legalCalls(f.history, f.seat).includes(bid as Bid)) return null
  return {
    call: bid, rule: 'stöd åt advancern',
    explanation: `Partnern avancerade mitt inkliv med en ny färg (${SWE_SYM[advCb.strain]}, lovar 5+) och jag har 3+ stöd → enkel höjning som bekräftar fiten (ej krav).`,
  }
}

/** Partnerns svar på mitt inkliv var en CUE i en av deras färger (= höjning av min färg)? */
function advanceWasCue(f: AuctionFacts, t: { mine: ResolvedCall; adv: ResolvedCall }): boolean {
  const mineCb = parseContractBid(t.mine.bid)!
  const cueCb = parseContractBid(t.adv.bid)!
  return cueCb.strain !== 'NT' && cueCb.strain !== mineCb.strain && f.theirStrains.has(cueCb.strain)
}

/**
 * Pliktsvepet K1 (2026-09-02): INKLIVAREN svarar advancerns CUE-HÖJNING när
 * motståndarna ligger tysta. Cuet (§7.1) lovar limithöjning eller bättre (11+
 * stödpoäng, 3+ stöd) och är krav — passar inklivaren spelas cuet i
 * motståndarnas färg. Svaret läser totalpoäng (`max(hp, startpoäng)`): 14+ =
 * extra → utgång i högfärgen (14 + 11 = 25), i lågfärg 3NT med stopp i deras
 * färg; annars billigaste återgång i egen färg (minimum, ej krav — cue-
 * bjudaren går vidare med 13+ stödpoäng, `cueBidderContinues`). Tvingar cuet
 * upp återgången till utgångsnivån bjuds utgången ändå — cuet är krav.
 */
export function overcallerAnswersCue(hand: Hand, f: AuctionFacts): Kunskap | null {
  const t = overcallerSecondTurn(f)
  if (!t || !advanceWasCue(f, t)) return null
  const cueCb = parseContractBid(t.adv.bid)!
  if (f.history.slice(f.history.indexOf(t.adv) + 1).some((c) => c.bid !== 'P')) return null // tysta: annars tävlingsfallet

  const strain = parseContractBid(t.mine.bid)!.strain
  const isMajor = isMajorStrain(strain)
  const gameLevel = isMajor ? 4 : 5
  const legal = legalCalls(f.history, f.seat)
  const tp = pointsWithFloor(hand, null, 'starting')
  const cueText = `Partnerns cue i ${SWE_SYM[cueCb.strain]} lovar minst limithöjning i ${SWE_SYM[strain]} (11+ med fördelning) och är krav`
  if (tp.points >= 14) {
    const game = `${gameLevel}${strain}` as Bid
    if (isMajor && legal.includes(game)) return {
      call: game, rule: 'inklivaren svarar cue-höjning (utgång)',
      explanation: `${cueText}; jag har extra (${tp.text}) → utgång ${prettyBid(game)}.`,
    }
    if (!isMajor && hasStopper(hand, SUIT_OF_LETTER[cueCb.strain]) && legal.includes('3NT' as Bid)) return {
      call: '3NT', rule: 'inklivaren svarar cue-höjning (utgång)',
      explanation: `${cueText}; jag har extra (${tp.text}) och stopp i deras ${SWE_SYM[cueCb.strain]} → 3NT (rätt utgång före 5${SWE_SYM[strain]}).`,
    }
  }
  const cheapest = cheapestBidIn(f.history, f.seat, strain)
  if (!cheapest) return null
  const cb = parseContractBid(cheapest)!
  if (bidValue(cb.level, cb.strain) > bidValue(gameLevel, strain)) return null // förbi utgång – inget att återgå till
  if (cb.level >= gameLevel) return {
    call: cheapest, rule: 'inklivaren svarar cue-höjning (utgång)',
    explanation: `${cueText}; billigaste återgången i ${SWE_SYM[strain]} är redan utgångsnivån → ${prettyBid(cheapest)}.`,
  }
  return {
    call: cheapest, rule: 'inklivaren svarar cue-höjning (minimum)',
    explanation: `${cueText}; med ett minimum (${tp.text}) återgår jag billigast i min färg → ${prettyBid(cheapest)} (ej krav – partnern går vidare med utgångsvärden).`,
  }
}

/**
 * Överklivaren tävlar efter partnerns cue-höjning när motståndarna bjudit VIDARE
 * över cuet innan jag hann svara (felrapport #47). Cue-höjningen lovar minst en
 * limithöjning i min färg → vår fit bär oss till minst 3-läget i färgen; jag
 * säljer aldrig ut under den. Med EXTRA (6+ egen svit eller 14+ hp) sätter jag
 * utgång i högfärg, annars tävlar jag billigast i vår färg (men klättrar inte
 * till 4-läget utan utgångsvärden).
 */
export function overcallerCompetesAfterCue(hand: Hand, f: AuctionFacts): Kunskap | null {
  const t = overcallerSecondTurn(f)
  if (!t || !advanceWasCue(f, t)) return null
  const afterCue = f.history.slice(f.history.indexOf(t.adv) + 1)
  if (!afterCue.some((c) => side(c.seat) !== side(f.seat) && parseContractBid(c.bid))) return null
  if (afterCue.some((c) => side(c.seat) === side(f.seat) && parseContractBid(c.bid))) return null

  const strain = parseContractBid(t.mine.bid)!.strain
  const suit = SUIT_OF_LETTER[strain]
  const isMajor = isMajorStrain(strain)
  const legal = legalCalls(f.history, f.seat)
  const cheapest = cheapestBidIn(f.history, f.seat, strain)
  if (!cheapest || !legal.includes(cheapest)) return null
  const cheapestLvl = parseContractBid(cheapest)!.level
  const gameLvl = isMajor ? 4 : 5
  const gameBid = `${gameLvl}${strain}` as Bid
  const extra = lengths(hand)[suit] >= 6 || hcp(hand) >= 14
  if (extra && cheapestLvl <= gameLvl && legal.includes(gameBid)) {
    return {
      call: gameBid, rule: 'överklivaren tävlar (cue-höjning)',
      explanation: `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; med en stark lång svit sätter jag utgång ${gameBid} i stället för att sälja given.`,
    }
  }
  if (cheapestLvl <= 3) {
    return {
      call: cheapest, rule: 'överklivaren tävlar (cue-höjning)',
      explanation: `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; jag tävlar ${cheapest} i vår fit i stället för att sälja given till motståndarna.`,
    }
  }
  return null
}

/**
 * Partnern svarade mitt naturliga inkliv med en FIT-JUMP (§7.1: hopp i en ny
 * färg = 4+ stöd i min färg + egen 5+ sidofärg, 10+ stödpoäng, inbjudande+)
 * och motståndarna passade. Förr saknades regeln: det gamla lagret läste
 * sidofärgen som partnerns "färg" och höjde den (frö 20270356: 4♦ → 5♦ i
 * stället för 4♥) eller passade. Nu: med extra (12+ totalpoäng, eller 6+ egen
 * färg med 10+) utgång i min färg — i lågfärg 3NT med stopp i deras färg om
 * det ryms, annars 5m; utan extra billigaste återgång i min färg (blir den
 * återgången utgångsnivån bjuds den ändå — fit-jumpen är inbjudande+).
 */
export function overcallerAnswersFitJump(hand: Hand, f: AuctionFacts): Kunskap | null {
  const t = overcallerSecondTurn(f)
  if (!t) return null
  const mineCb = parseContractBid(t.mine.bid)!
  const advCb = parseContractBid(t.adv.bid)!
  if (advCb.strain === 'NT' || advCb.strain === mineCb.strain || f.theirStrains.has(advCb.strain)) return null
  if (!isJump(f.history, t.adv)) return null
  if (f.history.slice(f.history.indexOf(t.adv) + 1).some((c) => c.bid !== 'P')) return null

  const strain = mineCb.strain
  const suit = SUIT_OF_LETTER[strain]
  const isMajor = isMajorStrain(strain)
  const gameLevel = isMajor ? 4 : 5
  const legal = legalCalls(f.history, f.seat)
  const tp = pointsWithFloor(hand, null, 'starting')
  const extra = tp.points >= 12 || (lengths(hand)[suit] >= 6 && tp.points >= 10)
  const text = `Partnerns hopp i ${SWE_SYM[advCb.strain]} är en fit-jump: 4+ stöd i ${SWE_SYM[strain]} + egen sidofärg, inbjudande+`
  const cheapest = cheapestBidIn(f.history, f.seat, strain)
  if (extra) {
    if (!isMajor && hasStopper(hand, SUIT_OF_LETTER[f.opening!.strain]) && legal.includes('3NT' as Bid)) {
      return { call: '3NT', rule: 'inklivaren svarar fit-jump (utgång)', explanation: `${text}; jag har extra (${tp.text}) och stopp i deras färg → 3NT.` }
    }
    const game = `${gameLevel}${strain}` as Bid
    if (legal.includes(game)) return { call: game, rule: 'inklivaren svarar fit-jump (utgång)', explanation: `${text}; jag har extra (${tp.text}) → utgång ${prettyBid(game)}.` }
    return null
  }
  if (!cheapest) return null
  const cb = parseContractBid(cheapest)!
  if (bidValue(cb.level, cb.strain) > bidValue(gameLevel, strain)) return null
  return {
    call: cheapest, rule: 'inklivaren svarar fit-jump (minimum)',
    explanation: `${text}; med ett minimum (${tp.text}) återgår jag billigast i min färg → ${prettyBid(cheapest)}${cb.level >= gameLevel ? ' (redan utgångsnivån)' : ' (ej krav)'}.`,
  }
}

/** Var budet `c` ett HOPP — minst en nivå över det billigaste lagliga budet i färgen just då? */
function isJump(history: ResolvedCall[], c: ResolvedCall): boolean {
  const idx = history.indexOf(c)
  const cb = parseContractBid(c.bid)
  if (!cb) return false
  let prev = 0
  for (const x of history.slice(0, idx)) {
    const xb = parseContractBid(x.bid)
    if (xb) prev = bidValue(xb.level, xb.strain)
  }
  let minLevel = 1
  while (bidValue(minLevel, cb.strain) <= prev) minLevel++
  return cb.level > minLevel
}

/**
 * Mitt MICHAELS över deras högfärg (andra högfärgen + en okänd lågfärg) fick
 * partnerns pass-eller-rätta i klöver (§7.2) och motståndarna passade: passa
 * med klöver som min lågfärg, rätta till ruter annars. Förr saknades regeln
 * (det gamla lagret "höjde" klövern, frö 20272323: 4♣ → 5♣ med ♣J9854).
 */
export function twoSuiterAnswersPassOrCorrect(hand: Hand, f: AuctionFacts): Kunskap | null {
  const open = theirOneSuitOpening(f)
  if (!open || (open.suit !== 'hearts' && open.suit !== 'spades')) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids[0].seat !== f.seat || ourBids[1].seat !== f.partner) return null
  if (ourBids[0].bid !== `2${open.strain}`) return null // mitt Michaels-cue
  const pc = parseContractBid(ourBids[1].bid)!
  if (pc.strain !== 'C') return null // partnerns pass-eller-rätta = klöver
  if (f.history.slice(f.history.indexOf(ourBids[1]) + 1).some((c) => c.bid !== 'P')) return null
  const len = lengths(hand)
  if (len.clubs >= len.diamonds) {
    return { call: 'P', rule: 'tvåfärgsinkliv: passar pass-eller-rätta', explanation: `Partnerns ${prettyBid(ourBids[1].bid)} var pass-eller-rätta; min lågfärg är klöver → pass.` }
  }
  const bid = cheapestBidIn(f.history, f.seat, 'D')
  if (!bid) return null
  return { call: bid, rule: 'tvåfärgsinkliv: rättar till ruter', explanation: `Partnerns ${prettyBid(ourBids[1].bid)} var pass-eller-rätta; min lågfärg är ruter → ${prettyBid(bid)}.` }
}

// ---- Det egna tvåfärgsinklivets fortsättning ------------------------------

/**
 * Mitt TVÅFÄRGSINKLIV (Michaels-cue / ovanlig 2NT) är vår sidas enda
 * kontraktsbud över deras 1-läges färgöppning, med bara pass före det på vår
 * sida. Returnerar de färger inklivet VISADE (ur egen hand för den okända
 * minorn) och vad som hänt efter det.
 */
export function ownTwoSuiterSeat(hand: Hand, f: AuctionFacts): { shown: Suit[]; after: ResolvedCall[] } | null {
  const open = theirOneSuitOpening(f)
  if (!open) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== f.seat) return null
  const mine = ourBids[0]
  if (!isTwoSuiterBid(mine.bid, open.strain)) return null
  const mineIdx = f.history.indexOf(mine)
  if (!f.history.slice(open.index + 1, mineIdx).every((c) => c.bid === 'P')) return null
  const len = lengths(hand)
  const unbid = SUIT_STRAINS.filter((st) => st !== open.strain).map((st) => SUIT_OF_LETTER[st])
  let shown: Suit[]
  if (mine.bid === '2NT') {
    shown = unbid.slice(0, 2) // ovanlig 2NT = de två lägsta objudna
  } else if (open.suit === 'clubs' || open.suit === 'diamonds') {
    shown = ['hearts', 'spades'] // Michaels över minor = båda högfärgerna
  } else {
    const otherMajor: Suit = open.suit === 'hearts' ? 'spades' : 'hearts'
    shown = [otherMajor, len.clubs >= len.diamonds ? 'clubs' : 'diamonds']
  }
  return { shown, after: f.history.slice(mineIdx + 1) }
}

/** Längsta av de visade färgerna (lika längd → högre rankad, samma regel som advancerns preferens). */
function longestShown(hand: Hand, shown: Suit[]): Suit {
  const len = lengths(hand)
  let best = shown[0]
  for (const s of shown) {
    if (len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/**
 * Tvåfärgsinklivarens fortsättning, två lägen:
 *  (a) FLYKT (felrapport #7): budet står DUBBLAT (bara pass och minst en X av
 *      dem efter det) utan att partnern visat preferens. Budet är konstgjort
 *      (lovar 5-5 i två ANDRA färger) och får ALDRIG spelas → längsta visade
 *      färgen.
 *  (b) BJUDER VIDARE (facit frö 20261162, familj 1): motståndarna har bjudit
 *      över, partnern har passat (ingen preferens hördes), och jag har den
 *      STARKA zonen (§7.2: 15+ hp, eller 13+ med 6-5) → längsta visade färgen
 *      billigast, aldrig förbi utgång. Svag zon → uttryckligt pass (partnern
 *      har inget sagt, det är inte mitt bud).
 */
export function twoSuiterContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  const t = ownTwoSuiterSeat(hand, f)
  if (!t) return null
  const best = longestShown(hand, t.shown)
  const strain = letterOfSuit(best)
  const theyBidOver = t.after.some((c) => side(c.seat) !== side(f.seat) && parseContractBid(c.bid))
  const partnerBid = t.after.some((c) => c.seat === f.partner && c.bid !== 'P')
  if (partnerBid) return null

  if (!theyBidOver) {
    // (a) Dubblat och opreferat → flykt.
    if (t.after.some((c) => c.bid !== 'P' && c.bid !== 'X')) return null
    if (!t.after.some((c) => c.bid === 'X' && side(c.seat) !== side(f.seat))) return null
    const bid = cheapestBidIn(f.history, f.seat, strain)
    if (!bid) return null
    return {
      call: bid, rule: 'tvåfärgsinkliv: flykt',
      explanation:
        `Mitt tvåfärgsinkliv är konstgjort (5-5 i två andra färger) och står dubblat – ` +
        `partnern visade ingen preferens, så jag flyr till min längsta visade färg: ${SWE_SYM[strain]}.`,
    }
  }

  // (b) De bjöd över, partnern passade → bara den starka zonen bjuder vidare.
  if (!t.after.some((c) => c.seat === f.partner)) return null // partnern har inte haft sin tur än
  const len = lengths(hand)
  const p = hcp(hand)
  const sixFive = t.shown.some((s) => len[s] >= 6) && t.shown.every((s) => len[s] >= 5)
  const strong = p >= 15 || (p >= 13 && sixFive)
  const bid = cheapestBidIn(f.history, f.seat, strain)
  const gameLevel = isMajorStrain(strain) ? 4 : 5
  if (strong && bid && parseContractBid(bid)!.level <= gameLevel) {
    return {
      call: bid, rule: 'tvåfärgsinkliv: bjuder vidare (stark)',
      explanation: `Mitt tvåfärgsinkliv fick inget svar och motståndarna bjöd över; med den starka zonen (${p} hp${sixFive ? ', 6-5' : ''}) bjuder jag själv min längsta visade färg → ${prettyBid(bid)}.`,
    }
  }
  return {
    call: 'P', rule: 'pass',
    explanation: `Mitt tvåfärgsinkliv fick inget svar; utan den starka zonen (15+, eller 13+ med 6-5) bjuder jag inte vidare på egen hand → pass.`,
  }
}

// ============================================================================
// Advancerns senare bud (raden *advance2*)
// ============================================================================

/**
 * Felrapport #56: partnern klev in och visade sedan en ANDRA färg — advancern
 * (som bara passat) ger preferens till inklivsfärgen med bättre stöd, oavsett
 * poäng. Kostar preferensen ingen nivå räcker lika lång inklivsfärg; kostar
 * den en nivå krävs klar skillnad (2+ kort). Aldrig förbi utgång.
 */
export function advancerPrefersOvercallSuit(hand: Hand, f: AuctionFacts): Kunskap | null {
  const open = f.opening
  if (!open || f.weOpened) return null
  if (f.history.some((c) => c.seat === f.seat && c.bid !== 'P')) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids.some((c) => c.seat !== f.partner)) return null
  const first = parseContractBid(ourBids[0].bid)!
  const second = parseContractBid(ourBids[1].bid)!
  if (first.strain === 'NT' || second.strain === 'NT' || first.strain === second.strain) return null
  if (f.theirStrains.has(first.strain) || f.theirStrains.has(second.strain)) return null
  if (f.lastContract !== ourBids[1]) return null

  const len = lengths(hand)
  const a = SUIT_OF_LETTER[first.strain]
  const b = SUIT_OF_LETTER[second.strain]
  const bid = cheapestBidIn(f.history, f.seat, first.strain)
  if (!bid) return null
  const level = parseContractBid(bid)!.level
  const gameLevel = isMajorStrain(first.strain) ? 4 : 5
  if (level > gameLevel) return null
  const costsLevel = level > second.level
  const clearlyBetter = costsLevel ? len[a] >= len[b] + 2 : len[a] >= len[b]
  if (!clearlyBetter) return null
  return {
    call: bid, rule: 'preferens till inklivsfärgen',
    explanation: `Partnern visade ${SWE_SYM[first.strain]} och ${SWE_SYM[second.strain]} och bad mig välja — bättre stöd i ${SWE_SYM[first.strain]} → ${prettyBid(bid)} (preferens, ej krav).`,
  }
}

/**
 * Lagen om totala stick (2026-07-05): partnern klev in på 2-LÄGET (icke-hopp
 * lovar en bra 6+ färg → 3-korts stöd = 9-korts fit) och motståndarna har
 * konkurrerat (öppnat + bjudit igen = hittat sin fit). Advancern säljer inte
 * given: 3 i partnerns färg (tävlar), 4M med 13+ stödpoäng, annars null
 * (för svag, eller budet redan pressat till 4-läget utan utgångsvärden).
 * Räckvidden är det gamla lagrets (oförändrad vid flytten): motståndarnas
 * öppning på vilken nivå som helst, vilken roll som helst på vår sida (även
 * inklivaren som höjer advancerns färg i konkurrens). Har någon på vår sida
 * DUBBLAT hör läget till dubblingsfamiljen (familj 2): tabellraderna tiger
 * då, och det gamla lagret kör den här funktionen EFTER dubblarens vakter
 * (`doublerRaisesAdvance`, `ownStrongDoubleRebid`, `advanceStrongDoubleRebid`)
 * precis som förut.
 */
export function advancerCompetesToFit(hand: Hand, f: AuctionFacts): Kunskap | null {
  const open = f.opening
  if (!open || f.weOpened) return null
  if (f.theirContractBids.length < 2) return null
  const partnerSuit = f.partnerLastSuit
  if (!partnerSuit || partnerSuit.level < 2) return null
  if (f.history.some((c) => c.seat === f.seat && parseContractBid(c.bid)?.strain === partnerSuit.strain)) return null

  const suit = SUIT_OF_LETTER[partnerSuit.strain]
  if (lengths(hand)[suit] < 3) return null
  const sp = dummyPoints(hand, suit).dummyPoints
  if (sp < 8) return null

  const legal = legalCalls(f.history, f.seat)
  const cheapest = cheapestBidIn(f.history, f.seat, partnerSuit.strain)
  if (!cheapest) return null
  const level = parseContractBid(cheapest)!.level
  if (sp >= 13 && isMajorStrain(partnerSuit.strain)) {
    const game = `4${partnerSuit.strain}` as Bid
    if (legal.includes(game)) return {
      call: game, rule: 'advancern bjuder utgång med fit (konkurrens)',
      explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]} + utgångsvärden → utgång ${game}.`,
    }
  }
  if (level <= 3) return {
    call: cheapest, rule: 'advancern tävlar till fiten (lagen om totala stick)',
    explanation: `Med trumfstöd → ${prettyBid(cheapest)} (tävlar på lagen om totala stick; ej krav).`,
  }
  return null
}

/**
 * Cue-bjudarens läge: partnern bjöd den överenskomna färgen (vår öppning när
 * `who` = 'öppnare', partnerns inkliv när `who` = 'inklivare'), JAG cue-bjöd i
 * en färg motståndarna bjudit, partnern svarade — och svaret är senaste
 * kontraktsbudet, under utgång. Returnerar färgerna, annars null.
 */
export function cueBidderTurn(f: AuctionFacts, who: 'öppnare' | 'inklivare'): { agreedStrain: string; theirStrain: string } | null {
  const open = f.opening
  if (!open || open.strain === 'NT') return null
  if (who === 'öppnare' ? !f.weOpened : f.weOpened) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 3) return null
  const [agreedC, cueC, answerC] = ourBids
  if (agreedC.seat !== f.partner || cueC.seat !== f.seat || answerC.seat !== f.partner) return null
  const agreed = parseContractBid(agreedC.bid)!
  if (agreed.strain === 'NT' || f.theirStrains.has(agreed.strain)) return null
  const cb = parseContractBid(cueC.bid)!
  if (cb.strain === 'NT' || !f.theirStrains.has(cb.strain)) return null
  if (f.lastContract !== answerC) return null
  const ans = parseContractBid(answerC.bid)!
  const gameLevel = isMajorStrain(agreed.strain) ? 4 : 5
  if (ans.strain === 'NT' && ans.level >= 3) return null
  if (bidValue(ans.level, ans.strain) >= bidValue(gameLevel, agreed.strain)) return null
  return { agreedStrain: agreed.strain, theirStrain: cb.strain }
}

/**
 * Cue-bjudaren fullföljer efter partnerns svar (felrapport #26 + fix 6 mönster
 * 4): återgick partnern BILLIGAST (minimum) och jag bara har limit-värden
 * (<13 stödpoäng) stannar vi (uttryckligt pass); annars 3NT med stopp i deras
 * färg, annars utgång i den överenskomna färgen. Får aldrig passas bort.
 */
export function cueBidderContinues(hand: Hand, f: AuctionFacts, who: 'öppnare' | 'inklivare'): Kunskap | null {
  const info = cueBidderTurn(f, who)
  if (!info) return null
  const legal = legalCalls(f.history, f.seat)
  const theirSuit = SUIT_OF_LETTER[info.theirStrain]
  if (parseContractBid(f.lastContract!.bid)!.strain === info.agreedStrain) {
    const sp = dummyPoints(hand, SUIT_OF_LETTER[info.agreedStrain]).dummyPoints
    if (sp < 13) return {
      call: 'P', rule: 'cue-höjningens fortsättning (limit stannar)',
      explanation: `Min cue lovade limithöjning eller bättre; partnern återgick billigast (minimum) och jag har bara limit-värden → pass.`,
    }
  }
  if (hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) {
    return {
      call: '3NT', rule: 'cue-höjningens fortsättning',
      explanation: `Min cue-höjning var utgångskrav; jag stoppar deras ${SWE_SYM[info.theirStrain]} → 3NT (pass förbjudet).`,
    }
  }
  const bid = `${isMajorStrain(info.agreedStrain) ? 4 : 5}${info.agreedStrain}` as Bid
  if (!legal.includes(bid)) return null
  return {
    call: bid, rule: 'cue-höjningens fortsättning',
    explanation: `Min cue-höjning var utgångskrav – utan säkert stopp i deras ${SWE_SYM[info.theirStrain]} sätter jag utgång i vår ${SWE_SYM[info.agreedStrain]} (${prettyBid(bid)}); pass förbjudet.`,
  }
}

/** Har någon på VÅR sida dubblat? Då är läget dubblingsfamiljens (familj 2), inte inklivets. */
export function ourSideDoubled(f: AuctionFacts): boolean {
  return f.history.some((c) => (c.seat === f.seat || c.seat === f.partner) && c.bid === 'X')
}

/**
 * STRAFFDUBBLINGEN går före (företrädet ur det gamla lagret, där
 * `maybePenaltyDouble` låg FÖRE inklivarens och advancerns fortsättningar
 * men EFTER öppnarens svar i konkurrens): deras senaste bud är ett färgbud på
 * 3-läget eller högre, vår sida har minst två kontraktsbud, X är lagligt och
 * handen dubblar på straff (`penaltyDouble`). Raderna inkliv2 och advance2
 * prövar den först; för alla andra lägen ligger detektorn kvar.
 */
export function penaltyDoubleFirst(hand: Hand, f: AuctionFacts): Kunskap | null {
  const last = f.lastNonPass
  if (!last || side(last.seat) === side(f.seat)) return null
  const cb = parseContractBid(last.bid)
  if (!cb || cb.strain === 'NT' || cb.level < 3) return null
  if (f.ourContractBids.length < 2) return null
  if (!legalCalls(f.history, f.seat).includes('X')) return null
  const ans = penaltyDouble(hand, SUIT_OF_LETTER[cb.strain])
  if (!ans) return null
  return { call: 'X', rule: ans.rule, explanation: ans.explanation }
}

/** Kunskap → ett beslutat bud för stolen (tabellradernas form). */
export function asCall(seat: Seat, k: Kunskap): ResolvedCall {
  return { seat, bid: k.call as Bid, rule: k.rule, explanation: k.explanation }
}

