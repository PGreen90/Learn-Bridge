// Logiklagret bakom budlådan i "Spela kort": en LEVANDE budgivning som växer ett
// bud i taget runt bordet, i stället för en färdiggenererad auktion.
//
// Fyra rena, testbara delar:
//   - legalCalls       – vilka bud som är tillåtna just nu (bridge-reglerna)
//   - auctionComplete  – är budgivningen slut (tre pass efter ett bud / passat ut)?
//   - contractFromCalls – slutkontraktet ur en färdig budföljd (spelförare m.m.)
//   - decideCall       – "bot-hjärnan": vad bjuder datorn på en plats just nu?
//
// `decideCall` återanvänder hela den befintliga (testade) budmotorn via
// `buildAuction`: den bygger parets kanoniska systemlinje och spelar upp den
// bud för bud. Datorn (Väst/Nord/Öst) följer linjen; Syd bjuder själv. Så länge
// alla följer systemet stämmer historiken med linjen. (Udda Syd-bud "off-book"
// hanteras senare – tills dess passar datorn för att stänga rond.)

import type { Bid, Deal, Hand, Seat, Suit } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { turnsToCalls } from './auction-contract'
import { advancerFreeBidAfterDouble, answerSupportDouble, answerTakeoutDouble, doublerAnswersCue, openerAnswerNegativeDouble, penaltyDouble, supportDoublerRebid } from './doubles'
import { advanceDONT } from './dont'
import { answerNTInterference, answerPreemptInterference } from './contested-openings'
import { lebensohlAfter1NT, lebensohlAfter1NTRebid } from './lebensohl'
import { defendPreempt } from './defense-conventional'
import { openerAnswerFourthSuit, openerAnswerNMF, openerRebidAfter1NTResponse, openerRebidAfterJordan2NT, openerThirdBidAfterOwnRaise } from './rebids'
import { respondTo1NT } from './responses-nt'
import { openerRebidAfter2NTResponse, respondTo2NT } from './responses-2nt'
import { jordanRaiseAfterSignoff, responderPlaceAfterNMF } from './responder-rebids'
import type { Major } from './responses'
import { dummyPoints, pointsWithFloor, startingPoints } from './evaluation'
import { hcp, isBalanced, lengths, suitHcp } from './hand'
import { advanceTwoSuiter, hasStopper, openingSuit, overcall, takeoutOfResponse } from './overcalls'
import { side, NEXT_SEAT } from './play'
import { firstRoundControl, keycards, respondToKingAsk, respondToRKC } from './slam'

// ---- Bud-tolkning ----------------------------------------------------------

const STRAINS = ['C', 'D', 'H', 'S', 'NT'] as const
const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/

/** Ett kontraktsbud (nivå + färg) tolkat, eller null för P/X/XX. */
function parseContractBid(bid: Bid): { level: number; strain: string } | null {
  const m = CONTRACT_BID.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}

/** Rangvärde så två kontraktsbud kan jämföras: högre tal = högre bud. */
function bidValue(level: number, strain: string): number {
  return level * 5 + STRAINS.indexOf(strain as (typeof STRAINS)[number])
}

/** Alla 35 kontraktsbud i stigande ordning (1♣ … 7NT). */
function allContractBids(): Bid[] {
  const bids: Bid[] = []
  for (let level = 1; level <= 7; level++) {
    for (const s of STRAINS) bids.push(`${level}${s}`)
  }
  return bids
}

// ---- Vems tur är det? ------------------------------------------------------

/** Platsen som ska bjuda näst, räknat medurs från given. */
export function seatToAct(dealer: Seat, historyLength: number): Seat {
  return seatAt(dealer, historyLength)
}

// ---- Tillåtna bud (bridge-reglerna) ---------------------------------------

/**
 * Vilka bud `seat` lagligt får göra givet budgivningen så här långt.
 *  - Pass: alltid.
 *  - Färgbud/NT: alla som ligger HÖGRE än det senaste kontraktsbudet.
 *  - X (dubbelt): bara om motståndarsidans senaste icke-pass var ett kontraktsbud.
 *  - XX (redubbelt): bara om motståndarsidans senaste icke-pass var ett X.
 */
export function legalCalls(history: ResolvedCall[], seat: Seat): Bid[] {
  const calls: Bid[] = ['P']

  // Senaste kontraktsbudet sätter golvet för nya bud.
  let lastValue = 0
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb) lastValue = bidValue(cb.level, cb.strain)
  }
  for (const bid of allContractBids()) {
    const cb = parseContractBid(bid)!
    if (bidValue(cb.level, cb.strain) > lastValue) calls.push(bid)
  }

  // Senaste icke-pass-budet avgör om X/XX är tillåtet.
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (lastNonPass && side(lastNonPass.seat) !== side(seat)) {
    if (parseContractBid(lastNonPass.bid)) calls.push('X')
    else if (lastNonPass.bid === 'X') calls.push('XX')
  }

  return calls
}

// ---- Är budgivningen slut? -------------------------------------------------

/**
 * Slut när tre pass i rad följer på ett kontraktsbud, eller fyra inledande pass
 * (passat ut). Annars öppen.
 */
export function auctionComplete(history: ResolvedCall[]): boolean {
  if (history.length < 4) return false
  const anyBid = history.some((c) => c.bid !== 'P' && c.bid !== 'X' && c.bid !== 'XX')
  let trailingPasses = 0
  for (let i = history.length - 1; i >= 0 && history[i].bid === 'P'; i--) trailingPasses++
  if (!anyBid) return trailingPasses >= 4 // alla passade ut
  return trailingPasses >= 3
}

// ---- Slutkontraktet ur en färdig budföljd ---------------------------------

// EN sanningskälla: härledningen bor i auction-contract.ts (delas med
// `finalContract`). Re-exporteras här så budlådans användare (Play.tsx m.fl.)
// hittar den bland de övriga auktionsverktygen.
export { contractFromCalls } from './auction-contract'

// ---- Svar på partnerns upplysningsdubbling ---------------------------------

const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/**
 * Är `seat` TVUNGEN att svara på partnerns upplysningsdubbling? Mönstret är:
 *   (motst. öppnar färg) – X (partner = upplysning) – pass (din RHO) – seat
 * En upplysningsdubbling ber partnern bjuda sin längsta objudna färg; passar
 * RHO är partnern skyldig att svara (även med 0 hp). Kraven:
 *  - partnerns senaste icke-pass-bud är ett X (och bara pass har följt sedan),
 *  - vår sida har inte själv bjudit ett kontraktsbud (så X:et är take-out),
 *  - motståndarna har öppnat i en färg (den dubblade färgen).
 * Returnerar deras (dubblade) färg, annars null (= ingen påtvingad svarsplikt).
 */
function takeoutDoubleToAnswer(history: ResolvedCall[], seat: Seat): { suit: Suit; level: number; bidSuits: Suit[]; balancing: boolean } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  // Senaste icke-pass måste vara PARTNERNS dubbling (annars: RHO bjöd → ej tvång).
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null
  // Har vår sida redan bjudit ett kontraktsbud är X:et inte en ren take-out.
  if (history.some((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))) return null
  // Deras dubblade färg = SENASTE motståndarfärgen; nivån = HÖGSTA (så svaret blir
  // lagligt även när en svag tvåa dubblats, R1-fynd #5). `bidSuits` = ALLA färger
  // de bjudit, så advancern aldrig svarar i en av dem (t.ex. öppnarens ruter efter
  // 1♦–1♥–X). Ett NT-bud är ingen take-out-färg → hoppas över.
  let their: Suit | null = null
  let level = 1
  const bidSuits: Suit[] = []
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) {
      const suit = SUIT_OF_LETTER[cb.strain]
      if (suit) {
        their = suit
        level = Math.max(level, cb.level)
        if (!bidSuits.includes(suit)) bidSuits.push(suit)
      }
    }
  }
  if (!their) return null
  // STRAFF, inte upplysning (felrapport #50): en dubbling av motståndarnas
  // game-nivå (4+ i färg) är straffdubbling – partnern passar och försvarar, den
  // pullar aldrig till en egen (kanske singel-) färg. Upplysningsdubblingar –
  // inklusive av en spärröppning på 3-läget, som besvaras på 4-läget – ligger
  // kvar (level ≤ 3). (Nord drog Syds straff-X av 4♠ till 5♦ på en singel ♦Q.)
  if (level >= 4) return null
  // Var X:et en BALANSERING (deras öppning, två pass, partnerns X i utpassnings-
  // läget)? Då är golvet sänkt ~3 hp (§7.6 "låna en kung") och advancern ska
  // räkna av den lånade kungen i sitt svar (F3/C12, 2026-08-07).
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  const balancing =
    history[openIdx + 1]?.bid === 'P' &&
    history[openIdx + 2]?.bid === 'P' &&
    history[openIdx + 3]?.seat === PARTNER[seat] &&
    history[openIdx + 3]?.bid === 'X'
  return { suit: their, level, bidSuits, balancing }
}

/**
 * Har motståndarna BJUDIT ÖVER partnerns upplysningsdubbling (etapp 6 hål 2)?
 * Mönstret: de öppnar i färg (1–2-läget) – partnern X (upplysning) – RHO
 * höjer/bjuder nytt/redubblar – `seat`. `takeoutDoubleToAnswer` kräver att X:et
 * är senaste icke-pass, så här försvann svaret helt förr. Läget är FRITT (utom
 * över XX = tvångsflykt) — advancern talar värde-/formstyrt via
 * `advancerFreeBidAfterDouble`. Kraven:
 *  - vår sida har inga kontraktsbud; vårt enda icke-pass är partnerns X,
 *  - efter X:et har de gjort EXAKT en aktion (bud eller XX) = senaste icke-pass,
 *  - deras öppning är i färg på 1–2-läget (3+ = spärr, hål 4 — rörs inte här).
 */
function takeoutDoubleOverbidToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { doubledSuit: Suit; openLevel: number; theirSuits: Suit[]; lastBid: string } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  if (lastNonPass.bid !== 'XX' && !parseContractBid(lastNonPass.bid)) return null

  // Vår sida: exakt ETT icke-pass, och det är partnerns X (inga egna kontraktsbud).
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length !== 1 || ourNonPass[0].bid !== 'X' || ourNonPass[0].seat !== PARTNER[seat]) return null
  const xIdx = history.indexOf(ourNonPass[0])

  // Efter X:et: exakt EN motståndaraktion (den senaste icke-passen).
  const afterX = history.slice(xIdx + 1).filter((c) => c.bid !== 'P')
  if (afterX.length !== 1 || afterX[0] !== lastNonPass) return null

  // Deras öppning: auktionens första kontraktsbud, i färg, 1–2-läget.
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length === 0 || side(bids[0].seat) === side(seat)) return null
  const openCb = parseContractBid(bids[0].bid)!
  const doubledSuit = SUIT_OF_LETTER[openCb.strain]
  if (!doubledSuit || openCb.level > 2) return null

  const theirSuits: Suit[] = []
  let openLevel = openCb.level
  for (const c of bids) {
    if (side(c.seat) === side(seat)) return null // (paranoia: inga egna kontraktsbud)
    const cb = parseContractBid(c.bid)!
    const s = SUIT_OF_LETTER[cb.strain]
    if (s && !theirSuits.includes(s)) theirSuits.push(s)
    if (c !== lastNonPass) openLevel = Math.max(openLevel, cb.level)
  }
  return { doubledSuit, openLevel, theirSuits, lastBid: lastNonPass.bid }
}

/**
 * Har advancern CUE-BJUDIT deras färg efter `seat`s egen upplysningsdubbling?
 * Cuet är utgångskrav och får aldrig passas — `doublerAnswersCue` svarar (3NT
 * med stopp, annars billigaste högfärg). Kraven: deras 1-lägesöppning i färg
 * (svaga tvåor har egen cue-väg, `partnerWeakTwoCueToAnswer`), mitt X är vårt
 * enda icke-pass före partnerns cue, partnerns ENDA kontraktsbud = cuet i en av
 * deras färger = auktionens senaste icke-pass.
 */
function advancerCueToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { theirSuits: Suit[]; cueBid: string } | null {
  // Min sida: mitt X + partnerns cue är våra enda icke-pass. Efter cuet får
  // bara pass och motståndarnas straff-X förekomma (deras X tar ingen budyta
  // och friar mig inte från kravet).
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length !== 2) return null
  if (ourNonPass[0].seat !== seat || ourNonPass[0].bid !== 'X') return null
  const cueCall = ourNonPass[1]
  if (cueCall.seat !== PARTNER[seat] || !parseContractBid(cueCall.bid)) return null
  const cueIdx = history.indexOf(cueCall)
  if (history.slice(cueIdx + 1).some((c) => c.bid !== 'P' && !(c.bid === 'X' && side(c.seat) !== side(seat)))) return null

  // Deras öppning: första kontraktsbudet, i färg, 1-läget.
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length === 0 || side(bids[0].seat) === side(seat)) return null
  const openCb = parseContractBid(bids[0].bid)!
  if (openCb.level !== 1 || !SUIT_OF_LETTER[openCb.strain]) return null

  const theirSuits: Suit[] = []
  for (const c of bids) {
    if (side(c.seat) === side(seat)) continue
    const s = SUIT_OF_LETTER[parseContractBid(c.bid)!.strain]
    if (s && !theirSuits.includes(s)) theirSuits.push(s)
  }
  // Partnerns bud måste vara ett CUE (i en av deras färger).
  const cueSuit = SUIT_OF_LETTER[parseContractBid(cueCall.bid)!.strain]
  if (!cueSuit || !theirSuits.includes(cueSuit)) return null

  return { theirSuits, cueBid: cueCall.bid }
}

/**
 * DUBBLAREN väger höjningen av advancerns färgsvar (etapp 6 hål 2, del 2).
 * Utan den här vakten läste `advancerCompetesToFit` partnerns svar på min
 * upplysningsdubbling som ett tvåläges-INKLIV ("bra 6+ färg") och blastade
 * utgång på 13+ stödpoäng — men svaret lovar bara ~6–9 (fritt icke-hopp),
 * 9–11 (hoppet) eller 0+ (tvångsflykt över deras XX). Skalan:
 *  - flykt över XX → höj aldrig (svaret lovar inga poäng),
 *  - partnerns HOPP (9–11): utgång i högfärg med 15+ stödpoäng, annars pass,
 *  - fritt icke-hopp (~6–9): utgång med 19+ (högfärg) / 21+ (lågfärg),
 *    enkel höjning (inbjudan) med 16–18, annars pass,
 *  - 17+ hp släpps vidare till det starka X-flödet (`ownStrongDoubleRebid`).
 * Explicit pass (inte null) när vakten avböjer — annars tar blastern över.
 */
function doublerRaisesAdvance(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  // Vår sida: exakt två icke-pass — mitt X (först) och partnerns färgbud.
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length !== 2) return null
  if (ourNonPass[0].seat !== seat || ourNonPass[0].bid !== 'X') return null
  const advCall = ourNonPass[1]
  if (advCall.seat !== PARTNER[seat] || !parseContractBid(advCall.bid)) return null

  // Turen: senaste icke-pass är partnerns svar, eller deras bud EFTER svaret.
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass) return null
  const advIdx = history.indexOf(advCall)
  if (lastNonPass !== advCall && !(side(lastNonPass.seat) !== side(seat) && history.indexOf(lastNonPass) > advIdx)) return null

  // Deras färgöppning på 1–2-läget (3+ = spärr, hål 4 — rörs inte här).
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (side(bids[0].seat) === side(seat)) return null
  const openCb = parseContractBid(bids[0].bid)!
  if (!SUIT_OF_LETTER[openCb.strain] || openCb.level > 2) return null

  // Partnerns färg måste vara OBJUDEN av dem (cue har egen väg).
  const theirSuits = new Set<Suit>()
  for (const c of bids) {
    if (side(c.seat) === side(seat)) continue
    const s = SUIT_OF_LETTER[parseContractBid(c.bid)!.strain]
    if (s) theirSuits.add(s)
  }
  const advSuit = SUIT_OF_LETTER[parseContractBid(advCall.bid)!.strain]
  if (!advSuit || theirSuits.has(advSuit)) return null

  const hand = deal.hands[seat]
  if (hcp(hand) >= 17) return null // starka X-flödet tar över

  const decline = (why: string): ResolvedCall => ({ seat, bid: 'P', rule: 'dubblaren nöjer sig', explanation: why })

  // Flykt över deras XX lovar INGA poäng → höj aldrig.
  const xxEscape = history.some((c, i) => i < advIdx && c.bid === 'XX' && side(c.seat) !== side(seat))
  if (xxEscape) return decline('Partnerns flykt över redubblingen var tvingad (lovar inga poäng) – pass.')

  const support = lengths(hand)[advSuit]
  if (support < 3) return decline(`Utan stöd i partnerns ${SWE_SYM[letterOfSuit(advSuit)]} – pass.`)

  // Hopp eller ej: partnerns svar mot billigaste möjliga nivån vid den punkten.
  let prevLevel = 0
  let prevRank = -1
  for (let i = 0; i < advIdx; i++) {
    const cb = parseContractBid(history[i].bid)
    if (!cb) continue
    prevLevel = cb.level
    prevRank = SUIT_STRAINS.indexOf(cb.strain as (typeof SUIT_STRAINS)[number])
  }
  const advCb = parseContractBid(advCall.bid)!
  const advRank = SUIT_STRAINS.indexOf(advCb.strain as (typeof SUIT_STRAINS)[number])
  const minLevel = advRank > prevRank ? Math.max(prevLevel, 1) : prevLevel + 1
  const wasJump = advCb.level > minLevel

  const sp = dummyPoints(hand, advSuit).dummyPoints
  const isMajor = advSuit === 'hearts' || advSuit === 'spades'
  const legal = legalCalls(history, seat)
  const gameBid = `${isMajor ? 4 : 5}${letterOfSuit(advSuit)}` as Bid

  if (wasJump) {
    // Partnerns hopp = 9–11 (inbjudan): acceptera i högfärg med 15+.
    if (sp >= 15 && isMajor && legal.includes(gameBid)) {
      return { seat, bid: gameBid, rule: 'dubblaren accepterar inbjudan', explanation: `Utgångsvärden mot partnerns hoppbud (9–11) → utgång ${gameBid}.` }
    }
    return decline(`Minimum – avböjer partnerns inbjudan (accept kräver 15+).`)
  }

  // Fritt icke-hopp = ~6–9.
  if (sp >= (isMajor ? 19 : 21) && legal.includes(gameBid)) {
    return { seat, bid: gameBid, rule: 'dubblaren bjuder utgång', explanation: `Utgångsvärden mot partnerns fria svar (~6–9) → utgång ${gameBid}.` }
  }
  if (sp >= 16) {
    const raise = cheapestBidIn(history, seat, letterOfSuit(advSuit))
    if (raise && parseContractBid(raise)!.level < (isMajor ? 4 : 5) && legal.includes(raise)) {
      return { seat, bid: raise, rule: 'dubblaren höjer (inbjudan)', explanation: `Inbjudan med 3+ stöd → ${prettyBid(raise)} (mot partnerns fria svar).` }
    }
  }
  return decline(`Minimum – partnerns fria svar lovar ~6–9, utgång kräver mer.`)
}

/**
 * Har partnern (öppnaren) just STÖDDUBBLAT som `seat` (svararen) måste svara på?
 * Mönstret (§7.3): partnerns 1-läges färgöppning – (pass) – vårt 1M-svar –
 * (RHO:s färginkliv) – partnerns X – (pass) – vi. X:et visar exakt 3 stöd och är
 * upplysande — svararen får aldrig lämnas att passa bort det (etapp 6 hål 1:
 * `takeoutDoubleToAnswer` stänger av tvånget så fort vår sida bjudit, så
 * stöddubblingen behöver en egen väg). Kraven:
 *  - partnerns senaste icke-pass är ett X (bjuder RHO över är läget fritt),
 *  - kontraktsbuden är exakt tre: partnerns 1-i-färg, vårt 1♥/1♠, deras inkliv
 *    (i en annan färg än öppningens, efter vårt svar),
 *  - "2 i vår högfärg" gick fortfarande att bjuda (annars betyder X något annat
 *    — samma fönster som `supportDouble` i doubles.ts).
 */
function supportDoubleToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { myMajor: Suit; openerSuit: Suit; theirBid: string } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null

  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 3) return null
  const [open, resp, over] = bids

  const openCb = parseContractBid(open.bid)!
  if (open.seat !== PARTNER[seat] || openCb.level !== 1) return null
  const openerSuit = SUIT_OF_LETTER[openCb.strain]
  if (!openerSuit) return null // 1NT-öppning → X är något annat

  const respCb = parseContractBid(resp.bid)!
  if (resp.seat !== seat || respCb.level !== 1) return null
  const myMajor = SUIT_OF_LETTER[respCb.strain]
  if (myMajor !== 'hearts' && myMajor !== 'spades') return null

  const overCb = parseContractBid(over.bid)!
  if (side(over.seat) === side(seat)) return null
  const theirSuit = SUIT_OF_LETTER[overCb.strain]
  if (!theirSuit || theirSuit === openerSuit) return null
  // X:et måste ligga efter inklivet (öppnarens andra tur).
  if (history.indexOf(lastNonPass) < history.indexOf(over)) return null
  // Stöd-X-fönstret: 2M måste ha varit bjudbart över inklivet.
  const RANKS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
  const twoMajorAvailable =
    overCb.level < 2 || (overCb.level === 2 && RANKS.indexOf(myMajor) > RANKS.indexOf(theirSuit))
  if (!twoMajorAvailable) return null

  return { myMajor, openerSuit, theirBid: over.bid }
}

/**
 * Har `seat` (öppnaren) själv STÖDDUBBLAT och fått partnerns svar som nu ska
 * vägas (acceptera inbjudan med 15+, annars pass)? Kraven speglar
 * `supportDoubleToAnswer` — plus: vårt eget X ligger mellan inklivet och
 * partnerns svar, svaret är auktionens senaste icke-pass (stör motståndarna
 * efter svaret är läget fritt → generell konkurrenslogik).
 */
function supportDoubleFollowUpToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { myOpenedSuit: Suit; partnerMajor: Suit; theirSuit: Suit; partnerAnswer: string } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  if (!parseContractBid(lastNonPass.bid)) return null

  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 4) return null
  const [open, resp, over, answer] = bids
  if (answer !== lastNonPass) return null

  const openCb = parseContractBid(open.bid)!
  if (open.seat !== seat || openCb.level !== 1) return null
  const myOpenedSuit = SUIT_OF_LETTER[openCb.strain]
  if (!myOpenedSuit) return null

  const respCb = parseContractBid(resp.bid)!
  if (resp.seat !== PARTNER[seat] || respCb.level !== 1) return null
  const partnerMajor = SUIT_OF_LETTER[respCb.strain]
  if (partnerMajor !== 'hearts' && partnerMajor !== 'spades') return null

  const overCb = parseContractBid(over.bid)!
  if (side(over.seat) === side(seat)) return null
  const theirSuit = SUIT_OF_LETTER[overCb.strain]
  if (!theirSuit || theirSuit === myOpenedSuit) return null

  // Mitt X = stöddubblingen, mellan deras inkliv och partnerns svar.
  const myX = history.find(
    (c) =>
      c.seat === seat &&
      c.bid === 'X' &&
      history.indexOf(c) > history.indexOf(over) &&
      history.indexOf(c) < history.indexOf(answer),
  )
  if (!myX) return null

  return { myOpenedSuit, partnerMajor, theirSuit, partnerAnswer: answer.bid }
}

/**
 * Är `seat` (öppnaren) TVUNGEN att svara på partnerns NEGATIVA dubbling?
 * Mönstret (§7.3): vi öppnade 1 i färg – motståndaren klev in i färg – partnern
 * dubblade (negativt = upplysning, rondkrav) – och bara pass har följt sedan.
 * Öppnaren får då aldrig passa (felrapport #2: auktionen dog på öppnarens pass).
 * Kraven:
 *  - partnerns senaste icke-pass-bud är ett X (inget har bjudits över det),
 *  - auktionens FÖRSTA kontraktsbud är `seat`s egen 1-läges färgöppning,
 *  - vår sida har inte bjudit något annat kontraktsbud (X:et är svararens första
 *    besked, inte straff i en utvecklad auktion),
 *  - motståndarna har klivit in i EN FÄRG (det X:et dubblar).
 * Returnerar {ourOpen, theirCall}, annars null.
 */
function negativeDoubleToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { ourOpen: Suit; theirCall: string } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null

  const open = openingBid(history)
  if (!open || open.seat !== seat || open.level !== 1) return null
  const ourOpen = SUIT_OF_LETTER[open.strain]
  if (!ourOpen) return null // 1NT-öppning → X:et är något annat än negativt

  // Vår sida får bara ha öppningen som kontraktsbud (annars är X:et inte negativt).
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null

  // Deras inkliv = senaste kontraktsbudet i historiken, från motståndarsidan, i färg.
  let theirCall: string | null = null
  for (const c of history) {
    if (!parseContractBid(c.bid)) continue
    theirCall = side(c.seat) !== side(seat) && SUIT_OF_LETTER[parseContractBid(c.bid)!.strain] ? c.bid : null
  }
  if (!theirCall) return null
  return { ourOpen, theirCall }
}

/**
 * Har partnern just bjudit FJÄRDE FÄRG (§6.6, utgångskrav) som `seat` (öppnaren)
 * måste svara på? Mönstret (ostört): vår 1-läges färgöppning – partnerns
 * 1-läges färgsvar – vårt 1-läges färgåterbud (ny färg) – partnerns bud i den
 * FJÄRDE färgen på 2-läget. Kravet får aldrig passas (felrapport #3).
 * Undantag ur systemboken: motståndarna stör (kontraktsbud), passad hand, och
 * "alla fyra färger på 1-läget" (fjärde färgen kunde bjudits på 1-läget → den
 * är naturlig, inte konstgjord). Returnerar färgerna, annars null.
 */
function fourthSuitToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { opened: Suit; second: Suit; responderSuit: Suit; fourth: Suit } | null {
  if (opponentsHaveBid(history, seat)) return null // stört → fjärde färg gäller inte
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null

  // Kontraktsbuden ska vara exakt: vår öppning, partnerns svar, vårt återbud,
  // partnerns fjärde färg – alla i färg, de tre första på 1-läget.
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 4 || bids[3] !== lastNonPass) return null
  if (bids[0].seat !== seat || bids[1].seat !== PARTNER[seat] || bids[2].seat !== seat) return null
  const cbs = bids.map((c) => parseContractBid(c.bid)!)
  if (cbs.some((cb) => cb.strain === 'NT')) return null
  const strains = cbs.map((cb) => cb.strain)
  if (new Set(strains).size !== 4) return null // fjärde färg = fyra OLIKA färger
  if (!cbs.slice(0, 3).every((cb) => cb.level === 1) || cbs[3].level !== 2) return null
  // Kunde fjärde färgen bjudits redan på 1-läget (rankar över vårt återbud) är
  // den naturlig (systembokens undantag) – och ett HOPP till 2-läget är inget
  // fjärde färg-krav.
  if (STRAINS.indexOf(strains[3] as (typeof STRAINS)[number]) > STRAINS.indexOf(strains[2] as (typeof STRAINS)[number])) return null
  // Passad hand: passade partnern innan sitt första bud gäller fjärde färg inte.
  const firstPartnerBid = history.findIndex((c) => c.seat === PARTNER[seat] && c.bid !== 'P')
  if (history.slice(0, firstPartnerBid).some((c) => c.seat === PARTNER[seat])) return null

  return {
    opened: SUIT_OF_LETTER[strains[0]],
    second: SUIT_OF_LETTER[strains[2]],
    responderSuit: SUIT_OF_LETTER[strains[1]],
    fourth: SUIT_OF_LETTER[strains[3]],
  }
}

/**
 * Har partnern just bjudit NEW MINOR FORCING (§5.7) som `seat` (öppnaren) måste
 * svara på? Mönstret (ostört): vår 1-läges färgöppning – partnerns 1-läges
 * HÖGfärgssvar – vårt 1NT-återbud – partnerns 2-läges LÅGfärg som INTE är
 * öppningsfärgen (den oanvända lågfärgen = konstgjort, tvingande). Kravet får
 * aldrig passas. Returnerar färgerna (inkl. den objudna färgen för stopp-koll),
 * annars null.
 */
function nmfToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { opened: Suit; responderMajor: Suit; nmfMinor: Suit; unbidSuit: Suit } | null {
  if (opponentsHaveBid(history, seat)) return null // stört → NMF gäller inte
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null

  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 4 || bids[3] !== lastNonPass) return null
  if (bids[0].seat !== seat || bids[1].seat !== PARTNER[seat] || bids[2].seat !== seat || bids[3].seat !== PARTNER[seat]) return null
  const cbs = bids.map((c) => parseContractBid(c.bid)!)
  if (cbs[0].level !== 1 || cbs[0].strain === 'NT') return null // vår öppning: 1-läges färg
  if (cbs[1].level !== 1 || (cbs[1].strain !== 'H' && cbs[1].strain !== 'S')) return null // 1-läges HÖGfärgssvar
  if (cbs[2].level !== 1 || cbs[2].strain !== 'NT') return null // vårt återbud: exakt 1NT
  if (cbs[3].level !== 2 || (cbs[3].strain !== 'C' && cbs[3].strain !== 'D')) return null // 2-läges lågfärg
  if (cbs[3].strain === cbs[0].strain) return null // 2 i ÖPPNAD lågfärg = naturligt, ej NMF

  // Passad hand: passade partnern innan sitt första bud gäller NMF inte.
  const firstPartnerBid = history.findIndex((c) => c.seat === PARTNER[seat] && c.bid !== 'P')
  if (history.slice(0, firstPartnerBid).some((c) => c.seat === PARTNER[seat])) return null

  const opened = SUIT_OF_LETTER[cbs[0].strain]
  const responderMajor = SUIT_OF_LETTER[cbs[1].strain]
  const nmfMinor = SUIT_OF_LETTER[cbs[3].strain]
  const unbidSuit = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[])
    .find((s) => s !== opened && s !== responderMajor && s !== nmfMinor)!
  return { opened, responderMajor, nmfMinor, unbidSuit }
}

/**
 * Har öppnaren just SVARAT på vår NMF (§5.7, steg 3) så att `seat` (svararen, som
 * bjöd NMF) ska placera kontraktet? Mönstret (ostört): 1m–1M–1NT–2m(NMF)–[öppnarens
 * svar], bara pass efter svaret, och `seat` är NMF-bjudaren. Returnerar färgerna +
 * öppnarens svar (nivå/färg → min/max) för `responderPlaceAfterNMF`, annars null.
 */
function nmfPlacementToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { opened: Suit; responderMajor: Suit; otherMajor: Suit; nmfMinor: Suit; unbidSuit: Suit; answer: { level: number; strain: string } } | null {
  if (opponentsHaveBid(history, seat)) return null
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 5) return null // öppning, svar, 1NT, NMF, öppnarens svar
  const opener = bids[0].seat
  if (seat !== PARTNER[opener]) return null // vi är svararen (NMF-bjudaren)
  if (bids[1].seat !== seat || bids[2].seat !== opener || bids[3].seat !== seat || bids[4].seat !== opener) return null
  const cbs = bids.map((c) => parseContractBid(c.bid)!)
  if (cbs[0].level !== 1 || cbs[0].strain === 'NT') return null
  if (cbs[1].level !== 1 || (cbs[1].strain !== 'H' && cbs[1].strain !== 'S')) return null
  if (cbs[2].level !== 1 || cbs[2].strain !== 'NT') return null
  if (cbs[3].level !== 2 || (cbs[3].strain !== 'C' && cbs[3].strain !== 'D')) return null
  if (cbs[3].strain === cbs[0].strain) return null
  // Bara pass efter öppnarens svar (senaste kontraktsbudet).
  if (history.slice(history.indexOf(bids[4]) + 1).some((c) => c.bid !== 'P')) return null
  // Passad hand-undantag.
  const firstOurBid = history.findIndex((c) => c.seat === seat && c.bid !== 'P')
  if (history.slice(0, firstOurBid).some((c) => c.seat === seat)) return null

  const opened = SUIT_OF_LETTER[cbs[0].strain]
  const responderMajor = SUIT_OF_LETTER[cbs[1].strain]
  const nmfMinor = SUIT_OF_LETTER[cbs[3].strain]
  const otherMajor: Suit = responderMajor === 'hearts' ? 'spades' : 'hearts'
  const unbidSuit = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[])
    .find((s) => s !== opened && s !== responderMajor && s !== nmfMinor)!
  return { opened, responderMajor, otherMajor, nmfMinor, unbidSuit, answer: { level: cbs[4].level, strain: cbs[4].strain } }
}

// ---- Tvåfärgsinkliv (Michaels / ovanlig 2NT, §7.2) i den levande auktionen --

/**
 * Är `bid` ett TVÅFÄRGSINKLIV över motståndarnas 1-lägesöppning i `openStrain`?
 * Michaels-cue = 2 i DERAS färg; ovanlig 2NT = 2NT. Båda är konstgjorda och
 * lovar 5-5 i två ANDRA färger.
 */
function isTwoSuiterBid(bid: Bid, openStrain: string): boolean {
  return bid === (`2${openStrain}` as Bid) || bid === '2NT'
}

/**
 * Har partnern gjort ett TVÅFÄRGSINKLIV som `seat` (advancern) ännu inte svarat
 * på? Kraven (felrapport #7 – luckan lät auktionen dö i stället för preferens;
 * #11 – Nord passade ut partnerns 3♣-cue):
 *  - motståndarna öppnade 1 i färg (auktionens första kontraktsbud),
 *  - partnerns inkliv är vår sidas ENDA kontraktsbud (advancern har inte
 *    svarat än) och är en CUE i deras färg (2- eller 3-läget – höjer de sin
 *    öppning kommer cuet ett läge högre) eller 2NT,
 *  - mellan öppningen och inklivet ligger bara pass, dubblingar och
 *    motståndarnas höjning av sin EGEN färg (t.ex. 1♣ – X – 2♣ – 3♣);
 *    ett annat kontraktsbud emellan ändrar cuets mening → null,
 *  - inget kontraktsbud har kommit efter inklivet (X/pass ändrar inte läget –
 *    preferensplikten består; ett bud över tar oss till vanlig konkurrens).
 * Returnerar argumenten till `advanceTwoSuiter`, annars null.
 */
function partnerTwoSuiterToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { partnerCall: string; theirSuit: Suit; contested: boolean } | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat) || open.level !== 1) return null
  const theirSuit = SUIT_OF_LETTER[open.strain]
  if (!theirSuit) return null

  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1 || ourBids[0].seat !== PARTNER[seat]) return null
  const pc = ourBids[0]
  const pcb = parseContractBid(pc.bid)!
  const isCue = pcb.strain === open.strain && pcb.level <= 3
  if (!isCue && !isTwoSuiterBid(pc.bid, open.strain)) return null

  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  const pcIdx = history.indexOf(pc)
  for (const c of history.slice(openIdx + 1, pcIdx)) {
    if (c.bid === 'P' || c.bid === 'X' || c.bid === 'XX') continue
    const cb = parseContractBid(c.bid)
    if (cb && cb.strain === open.strain && side(c.seat) !== side(seat)) continue // deras egen höjning
    return null // annat kontraktsbud emellan → inte ett rent tvåfärgsläge
  }
  const after = history.slice(pcIdx + 1)
  if (after.some((c) => parseContractBid(c.bid))) return null // någon bjöd över → vanlig konkurrens
  const contested = after.some((c) => c.bid !== 'P')
  return { partnerCall: pc.bid, theirSuit, contested }
}

/**
 * Står `seat`s EGET tvåfärgsinkliv DUBBLAT som senaste kontraktsbud utan att
 * partnern visat preferens? Budet är konstgjort (lovar 5-5 i två ANDRA färger)
 * och får ALDRIG spelas (felrapport #7: 2♣X av Väst med EN klöver → 4 bet).
 * Flykten: den längsta av de visade färgerna (lika längd → högre rankad, samma
 * regel som advancerns preferens).
 */
function ownDoubledTwoSuiterRescue(
  deal: Deal,
  history: ResolvedCall[],
  seat: Seat,
): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat) || open.level !== 1) return null
  const theirSuit = SUIT_OF_LETTER[open.strain]
  if (!theirSuit) return null

  // Vår sidas enda kontraktsbud är MITT tvåfärgsinkliv i direkt/balanserings-sits.
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null
  const mine = ourBids[0]
  if (!isTwoSuiterBid(mine.bid, open.strain)) return null
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  const mineIdx = history.indexOf(mine)
  if (!history.slice(openIdx + 1, mineIdx).every((c) => c.bid === 'P')) return null

  // Efter inklivet: bara pass och (minst en) dubbling – budet står dubblat.
  const after = history.slice(mineIdx + 1)
  if (after.some((c) => c.bid !== 'P' && c.bid !== 'X')) return null
  if (!after.some((c) => c.bid === 'X' && side(c.seat) !== side(seat))) return null

  // Vilka färger visade inklivet? (Samma schema som `overcall`/`advanceTwoSuiter`.)
  const len = lengths(deal.hands[seat])
  const unbid = SUIT_STRAINS.filter((st) => st !== open.strain).map((st) => SUIT_OF_LETTER[st])
  let shown: Suit[]
  if (mine.bid === '2NT') {
    shown = unbid.slice(0, 2) // ovanlig 2NT = de två lägsta objudna
  } else if (theirSuit === 'clubs' || theirSuit === 'diamonds') {
    shown = ['hearts', 'spades'] // Michaels över minor = båda högfärgerna
  } else {
    const otherMajor: Suit = theirSuit === 'hearts' ? 'spades' : 'hearts'
    shown = [otherMajor, len.clubs >= len.diamonds ? 'clubs' : 'diamonds']
  }
  let best = shown[0]
  for (const s of shown) {
    if (len[s] > len[best] || (len[s] === len[best] && SUIT_STRAINS.indexOf(letterOfSuit(s)) > SUIT_STRAINS.indexOf(letterOfSuit(best)))) best = s
  }
  const bid = cheapestBidIn(history, seat, letterOfSuit(best))
  if (!bid) return null
  return {
    seat,
    bid,
    explanation:
      `Mitt tvåfärgsinkliv är konstgjort (5-5 i två andra färger) och står dubblat – ` +
      `partnern visade ingen preferens, så jag flyr till min längsta visade färg: ${SWE_SYM[letterOfSuit(best)]}.`,
  }
}

/**
 * Står `seat`s egen 17+ UPPLYSNINGSDUBBLING och väntar på det starka återbudet?
 * Mönstret (ägarregel, felrapport #23): motståndaren öppnade 1 i färg, VÅR X är
 * mitt enda egna bud hittills (jag har ännu inte visat färg), och nu är det min
 * tur igen. Med 17+ hp och en lång egen färg "överröstar" jag partnern och bjuder
 * min färg – det är signalen för den starka enfärgshanden som var för stark för
 * ett enkelt inkliv. Jag visar färgen BILLIGAST (rondkrav) och hoppar aldrig rakt
 * till utgång: partnerns svar var framtvingat och kan vara 0 hp (ägarbeslut
 * 2026-07-05). Game/delkontrakt avgörs på nästa varv utifrån partnerns svar.
 */
function ownStrongDoubleRebid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat) || open.level !== 1) return null
  // Mitt enda egna icke-pass-bud hittills = X (upplysningsdubblingen).
  const myActions = history.filter((c) => c.seat === seat && c.bid !== 'P')
  if (myActions.length !== 1 || myActions[0].bid !== 'X') return null

  // ALLA färger motståndarna bjudit (öppning + ev. svarsfärg) – vår färg måste
  // vara en OBJUDEN (annars "återbjuder" den starka handen deras egen färg, t.ex.
  // hjärter efter 1♦–1♥–X).
  const theirSuits = new Set<Suit>()
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) {
      const s = SUIT_OF_LETTER[cb.strain]
      if (s) theirSuits.add(s)
    }
  }

  const hand = deal.hands[seat]
  if (hcp(hand) < 17) return null
  const len = lengths(hand)
  // Min längsta egna 5+ OBJUDNA färg; lika längd → högre rankad.
  let suit: Suit | null = null
  for (const st of SUIT_STRAINS) {
    const s = SUIT_OF_LETTER[st]
    if (theirSuits.has(s) || len[s] < 5) continue
    if (!suit || len[s] > len[suit] || (len[s] === len[suit] && st > letterOfSuit(suit))) suit = s
  }
  if (!suit) return null

  const letter = letterOfSuit(suit)
  const legal = legalCalls(history, seat)

  // Visa färgen BILLIGAST (rondkrav; jag "överröstar" partnern). Ägarbeslut
  // 2026-07-05: hoppa ALDRIG rakt till utgång här – partnerns svar var
  // framtvingat och kan vara 0 hp, så ett game-hopp kan bli katastrof. Grunden i
  // systemet är att ta det långsamt: X + egen färg är redan rondkrav och visar
  // den starka handen; game/delkontrakt avgörs på nästa varv utifrån partnerns svar.
  const bid = cheapestBidIn(history, seat, letter)
  if (!bid || !legal.includes(bid)) return null
  return {
    seat, bid, rule: 'starkt återbud',
    explanation: `17+ hp – jag bjuder min egna ${SWE_SYM[letter]} över dubblingen (för stark för ett enkelt inkliv, rondkrav – game avgörs nästa varv).`,
  }
}

/** Färgbokstaven ('C'/'D'/'H'/'S') för en Suit (omvänd SUIT_OF_LETTER). */
function letterOfSuit(suit: Suit): (typeof SUIT_STRAINS)[number] {
  return SUIT_STRAINS.find((st) => SUIT_OF_LETTER[st] === suit)!
}

// ---- Den starka upplysningsdubblingens fortsättning (flerronds, ägarbeslut
//      2026-07-05) ----------------------------------------------------------
// Efter (1x)–X–(P)–svar–(P)–egen färg (det starka återbudet, se
// `ownStrongDoubleRebid`) fortsätter auktionen KONTROLLERAT i stället för att dö:
//   • partnern (advancern) MÅSTE svara på återbudet (stöd-stege eller, utan stöd,
//     eget/näst längsta objudna – tvång, lovar inga poäng),
//   • den starka handen dömer på nästa varv (5-korts / <22 TP = lägsta nivå;
//     6+ & 22+ TP = hopp till 3-läget = utgångskrav),
//   • advancern svarar 3-hoppet (3NT nekar / 4M med 1–2 korts stöd).
// TP = startpoäng (`startingPoints`). Rena, historiedrivna detektorer.

interface StrongDoubleCtx {
  role: 'doubler' | 'advancer'
  doubler: Seat
  advancer: Seat
  openStrain: string
  theirSuits: Set<Suit>
  /** Det starka återbudets färg (dubblarens första egna färg efter X). */
  doublerSuit: Suit
  /** Dubblarens kontraktsbud EFTER X, i ordning (återbud, ev. andra återbud). */
  doublerBids: { level: number; strain: string }[]
  /** Advancerns kontraktsbud, i ordning (tvångssvar, ev. svar på återbudet). */
  advancerBids: { level: number; strain: string }[]
}

/**
 * Läser en "stark upplysningsdubbling"-auktion sett från `seat`: motståndarna
 * öppnade 1 i färg, vår sida dubblade (takeout) och dubblaren har sedan
 * "överröstat" partnern med en EGEN objuden färg (det starka återbudet). Returnerar
 * rollerna + budhistoriken, eller null om mönstret inte gäller ännu.
 */
function strongDoubleContext(history: ResolvedCall[], seat: Seat): StrongDoubleCtx | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat) || open.level !== 1) return null

  // Vem på vår sida dubblade? Dubblarens FÖRSTA icke-pass-bud måste vara X.
  // Har BÅDA i paret X som första bud (upplysnings-X följd av partnerns
  // RESPONSIVA X, felrapport #35) är det den FÖRSTA dubblingen i tid som är
  // upplysningsdubblingen — den senare är responsiv och får inte utse en
  // "stark dubblare" vars fitvisande höjning sedan läses som starkt återbud.
  let doubler: Seat | null = null
  let doublerIdx = Number.POSITIVE_INFINITY
  for (const s of [seat, PARTNER[seat]] as Seat[]) {
    const idx = history.findIndex((c) => c.seat === s && c.bid !== 'P')
    if (idx !== -1 && history[idx].bid === 'X' && idx < doublerIdx) {
      doubler = s
      doublerIdx = idx
    }
  }
  if (!doubler) return null
  const advancer = PARTNER[doubler]

  // Motståndarnas färger + dubblarens/advancerns kontraktsbud i ordning.
  const theirSuits = new Set<Suit>()
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) {
      const s = SUIT_OF_LETTER[cb.strain]
      if (s) theirSuits.add(s)
    }
  }
  const contractBidsOf = (s: Seat) =>
    history.filter((c) => c.seat === s).map((c) => parseContractBid(c.bid)).filter((b): b is { level: number; strain: string } => b !== null)
  const doublerBids = contractBidsOf(doubler)
  const advancerBids = contractBidsOf(advancer)

  // Dubblaren måste ha gjort sitt starka återbud (bjudit en egen OBJUDEN färg).
  if (doublerBids.length < 1) return null
  const doublerSuit = SUIT_OF_LETTER[doublerBids[0].strain]
  if (!doublerSuit || theirSuits.has(doublerSuit)) return null
  // … och en HÖJNING av en färg advancern själv bjudit FÖRE dubblarens bud är
  // inget starkt återbud (etapp 6 hål 2: dubblarens invithöjning av det fria
  // svaret lästes som "X + egen färg" → advancern blastade utgång på 8 hp).
  const doublerFirstIdx = history.findIndex((c) => c.seat === doubler && parseContractBid(c.bid))
  const advancerBidItFirst = history.some(
    (c, i) => i < doublerFirstIdx && c.seat === advancer && parseContractBid(c.bid)?.strain === doublerBids[0].strain,
  )
  if (advancerBidItFirst) return null

  return {
    role: seat === doubler ? 'doubler' : 'advancer',
    doubler, advancer, openStrain: open.strain, theirSuits, doublerSuit, doublerBids, advancerBids,
  }
}

/**
 * ADVANCERN svarar på det starka återbudet (tvång – får aldrig passa). Med 3-korts
 * stöd en stödstege graderad efter hp (0–3 = enkel höjning, 4–6 = hopphöjning,
 * 7–9 = utgång, 10+ = cue m. slamintresse); utan stöd bjuder advancern om sin egen
 * färg (5+) eller näst längsta objudna färg – lovar då INGA poäng. Ägarbeslut
 * 2026-07-05. Kör bara på advancerns FÖRSTA svar på återbudet (Part 2).
 */
function advanceStrongDoubleRebid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = strongDoubleContext(history, seat)
  if (!ctx || ctx.role !== 'advancer') return null
  // Part 2: dubblaren har gjort ETT återbud, advancern har svarat X:et EN gång
  // (tvångssvaret) och ska nu svara själva återbudet.
  if (ctx.doublerBids.length !== 1 || ctx.advancerBids.length !== 1) return null

  const hand = deal.hands[seat]
  const p = hcp(hand)
  const len = lengths(hand)
  const suit = ctx.doublerSuit
  const letter = letterOfSuit(suit)
  const support = len[suit]
  const legal = legalCalls(history, seat)
  const shownLevel = ctx.doublerBids[0].level
  const isMajor = suit === 'hearts' || suit === 'spades'
  const gameLevel = isMajor ? 4 : 5

  // Partnerns återbud nådde redan utgång → tvånget är uppfyllt. Höj ALDRIG
  // förbi utgång på stödstege/tvångssvar (samma princip som felrapport #33);
  // slamutredning hör inte hemma i det här tvångsläget.
  if (shownLevel >= gameLevel) return null

  const bidAt = (level: number): Bid | null => {
    const b = `${level}${letter}` as Bid
    return legal.includes(b) ? b : null
  }

  if (support >= 3) {
    // Stödstege (hp): 0–3 enkel höjning, 4–6 hopphöjning, 7–9 utgång, 10+ cue.
    if (p >= 10) {
      const cue = cheapestBidIn(history, seat, ctx.openStrain)
      if (cue && legal.includes(cue)) {
        return { seat, bid: cue, rule: 'stöd-cue (slamintresse)', explanation: `Utgångsvärden + 3+ stöd i ${SWE_SYM[letter]} → cue i deras färg = utgång + slamintresse.` }
      }
    }
    const target = p >= 7 ? gameLevel : p >= 4 ? Math.min(shownLevel + 2, gameLevel) : Math.min(shownLevel + 1, gameLevel)
    const bid = bidAt(target) ?? bidAt(shownLevel + 1)
    if (bid) {
      const label = target >= gameLevel ? 'utgång' : p >= 4 ? 'hopphöjning (inbjudan)' : 'enkel höjning (minimum)'
      return { seat, bid, rule: `stödhöjning – ${label}`, explanation: `3+ stöd → ${prettyBid(bid)} (${label}; tvunget svar på det starka återbudet).` }
    }
  }

  // Utan 3-korts stöd: bjud om egen färg (5+), annars näst längsta OBJUDNA färg.
  // Tvång – lovar inga poäng. (Fri-bud senare = värden, hanteras av andra varv.)
  const firstSuit = SUIT_OF_LETTER[ctx.advancerBids[0].strain]
  const unbid = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st])
    .filter((s) => !ctx.theirSuits.has(s) && s !== suit)
    .sort((a, b) => len[b] - len[a] || SUIT_STRAINS.indexOf(letterOfSuit(b)) - SUIT_STRAINS.indexOf(letterOfSuit(a)))
  let chosen: Suit | null = null
  if (firstSuit && len[firstSuit] >= 5) chosen = firstSuit
  else chosen = unbid.find((s) => s !== firstSuit) ?? unbid[0] ?? firstSuit ?? null
  if (chosen) {
    const bid = cheapestBidIn(history, seat, letterOfSuit(chosen))
    if (bid && legal.includes(bid)) {
      const same = chosen === firstSuit
      return { seat, bid, rule: 'tvångssvar (utan stöd)', explanation: `Utan stöd i ${SWE_SYM[letter]} → ${same ? `bjuder om min ${SWE_SYM[letterOfSuit(chosen)]} (5+)` : `näst längsta objudna (${SWE_SYM[letterOfSuit(chosen)]})`} = tvång, lovar inga poäng.` }
    }
  }
  // Nödfall (ingen färg att visa): ge minsta stöd i dubblarens färg (fortsatt tvång).
  const fallback = cheapestBidIn(history, seat, letter)
  if (fallback && legal.includes(fallback)) {
    return { seat, bid: fallback, rule: 'tvångssvar (preferens)', explanation: `Inget eget bud → minsta preferens i ${SWE_SYM[letter]} (tvunget svar).` }
  }
  return null
}

/**
 * Den STARKA HANDEN (dubblaren) dömer på sitt andra återbud efter advancerns svar.
 * Höjde advancern dubblarens färg (stöd) hanteras det längre ned; visade advancern
 * INGET stöd (bjöd egen/annan färg) gäller ägarbeslutet 2026-07-05: bjud om färgen
 * på LÄGSTA nivå (5-korts, eller 6+ men < 22 TP), eller HOPPA till 3-läget =
 * utgångskrav (6+ korts färg OCH ≥ 22 TP). TP = startpoäng.
 */
function strongDoublerSecondRebid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = strongDoubleContext(history, seat)
  if (!ctx || ctx.role !== 'doubler') return null
  // Part 3: dubblaren har gjort ETT återbud, advancern har svarat på det (2 bud).
  if (ctx.doublerBids.length !== 1 || ctx.advancerBids.length !== 2) return null

  const hand = deal.hands[seat]
  const len = lengths(hand)
  const suit = ctx.doublerSuit
  const letter = letterOfSuit(suit)
  const legal = legalCalls(history, seat)
  const isMajor = suit === 'hearts' || suit === 'spades'
  const gameLevel = isMajor ? 4 : 5
  const shownLevel = ctx.doublerBids[0].level

  // Höjde advancern VÅR färg? (stöd visat) → döm game efter partnerns visade spann.
  const advancerRaised = SUIT_OF_LETTER[ctx.advancerBids[1].strain] === suit
  const advancerCued = ctx.theirSuits.has(SUIT_OF_LETTER[ctx.advancerBids[1].strain] ?? ('' as Suit))
  if (advancerRaised || advancerCued) {
    // ⚠️ KONSERVATIV DEFAULT (ägaren ska finslipa i spel, se 👀 Bevaka): en cue
    // (slamintresse) eller redan nådd utgång får aldrig passas – annars stannar vi.
    const raiseLevel = advancerRaised ? ctx.advancerBids[1].level : 0
    if (raiseLevel >= gameLevel) return null // partnern bjöd redan utgång → passa (annan logik/pass)
    const game = `${gameLevel}${letter}` as Bid
    if (advancerCued && legal.includes(game)) {
      return { seat, bid: game, rule: 'accepterar (minimum)', explanation: `Partnerns cue visade slamintresse; med minimum stannar jag i utgång ${game}.` }
    }
    // Höjning under utgång (2M minimum / 3M inbjudan): acceptera utgång med tillägg.
    const p = hcp(hand)
    const accept = raiseLevel >= shownLevel + 2 ? p >= 18 : p >= 21
    if (accept && legal.includes(game)) {
      return { seat, bid: game, rule: 'accepterar utgång', explanation: `Utgångsvärden mittemot partnerns stödhöjning → utgång ${game}.` }
    }
    return null // minimum → passa höjningen (delkontrakt)
  }

  // Advancern visade INGET stöd (bjöd egen/annan färg). Ägarbeslut 2026-07-05:
  const tp = startingPoints(hand).startingPoints
  const sixPlus = len[suit] >= 6
  if (sixPlus && tp >= 22 && shownLevel === 1) {
    const jump = `3${letter}` as Bid
    if (legal.includes(jump)) {
      return { seat, bid: jump, rule: 'starkt återbud (utgångskrav)', explanation: `6+ ${SWE_SYM[letter]} (≥22 med fördelning) → hopp till ${prettyBid(jump)} = utgångskrav.` }
    }
  }
  // Annars: bjud om färgen på lägsta nivå (ej krav; delkontrakt mot en tom partner).
  const low = cheapestBidIn(history, seat, letter)
  if (low && legal.includes(low)) {
    return { seat, bid: low, rule: 'starkt återbud (lägsta)', explanation: `6+ ${SWE_SYM[letter]} – bjuder om färgen lägst (${prettyBid(low)}); ej utgångskrav mot ett tvångssvar.` }
  }
  return null
}

/**
 * ADVANCERN svarar den starka handens 3-hopp (utgångskrav). Ägarbeslut 2026-07-05:
 * nekar helt stöd och är svagast möjliga → 3NT; med 1–2 korts stöd i färgen → bjud
 * utgång i färgen (minimum men utgång). Kör bara efter ett 3-läges-hopp i dubblarens
 * färg (Part 4).
 */
function answerStrongDoubleGameForce(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = strongDoubleContext(history, seat)
  if (!ctx || ctx.role !== 'advancer') return null
  // Part 4: dubblaren har gjort TVÅ återbud, advancern svarat EN gång på återbudet.
  if (ctx.doublerBids.length !== 2 || ctx.advancerBids.length !== 2) return null
  const suit = ctx.doublerSuit
  const letter = letterOfSuit(suit)
  const second = ctx.doublerBids[1]
  const hand = deal.hands[seat]
  const support = lengths(hand)[suit]
  const legal = legalCalls(history, seat)
  const game = `${suit === 'hearts' || suit === 'spades' ? 4 : 5}${letter}` as Bid

  // Gren A: HOPPET till 3-läget i dubblarens färg (från ett 1-läges återbud) = krav.
  if (second.strain === letter && second.level === 3 && ctx.doublerBids[0].level === 1) {
    if (support >= 1 && legal.includes(game)) {
      return { seat, bid: game, rule: 'utgång (1–2 korts stöd)', explanation: `Utgångskravet accepteras: stöd i ${SWE_SYM[letter]} → ${prettyBid(game)} (minimum men utgång).` }
    }
    if (legal.includes('3NT')) {
      return { seat, bid: '3NT', rule: 'nekar stöd (3NT)', explanation: `Nekar helt stöd i ${SWE_SYM[letter]}, svagast möjliga → 3NT.` }
    }
    return null
  }

  // Gren B (Speldiagnosen S0, frö 20260772): dubblarens andra återbud var LÅGT
  // (ej krav) — men en advancer som ÖPPNADE med CUE har redan visat värden och
  // får inte lämna auktionen regellöst. Utan fixen höjde motorn i stället
  // regellöst till 4♥ på A9 DUBBELTON mot visade fyra (4-2-utgång, 6 bet), och
  // med enbart fit-vakten blev det regellös PASS på 14 hp. Domen: 3-korts stöd →
  // utgång i färgen; annars 12+ hp med stopp i deras färg(er) → 3NT (facit på
  // given: 3NT jämnt hem). I övrigt: lämna vidare (pass är rätt mot minimum).
  const gameLevel = suit === 'hearts' || suit === 'spades' ? 4 : 5
  const advancerFirst = SUIT_OF_LETTER[ctx.advancerBids[0].strain]
  const advancerCuedFirst = !!advancerFirst && ctx.theirSuits.has(advancerFirst)
  if (second.strain !== letter || second.level >= gameLevel || !advancerCuedFirst) return null
  const p = hcp(hand)
  if (support >= 3 && legal.includes(game)) {
    return { seat, bid: game, rule: 'cue-advancerns dom (utgång)', explanation: `Cuen visade redan mina värden; med stöd i ${SWE_SYM[letter]} → utgång ${game}.` }
  }
  const stoppAlla = [...ctx.theirSuits].every((s) => hasStopper(hand, s))
  if (p >= 12 && stoppAlla && legal.includes('3NT')) {
    return { seat, bid: '3NT', rule: 'cue-advancerns dom (3NT)', explanation: `Cuen visade redan mina värden; utan fit i ${SWE_SYM[letter]} men med stopp i deras färg → 3NT.` }
  }
  return null
}

// ---- Essfrågan 4NT (1430 RKC) i den levande auktionen -----------------------

/**
 * Parets ÖVERENSKOMNA trumf: en färg BÅDA parterna bjudit som kontraktsbud
 * (senast bjudna om flera). null när ingen fit är överenskommen.
 */
function agreedTrump(history: ResolvedCall[], seat: Seat): Suit | null {
  const strainsOf = (s: Seat) =>
    new Set(
      history
        .filter((c) => c.seat === s)
        .map((c) => parseContractBid(c.bid)?.strain)
        .filter((st): st is string => !!st && st !== 'NT'),
    )
  const mine = strainsOf(seat)
  const partners = strainsOf(PARTNER[seat])
  const agreed = [...mine].filter((st) => partners.has(st))
  if (agreed.length === 0) return null
  for (let i = history.length - 1; i >= 0; i--) {
    const cb = parseContractBid(history[i].bid)
    if (cb && agreed.includes(cb.strain)) return SUIT_OF_LETTER[cb.strain]
  }
  return SUIT_OF_LETTER[agreed[0]]
}

/**
 * Har vår sida etablerat en HÖGFÄRGS-fit via **Jacoby 2NT** (systembok §4.1)?
 * Mönstret: vår sidas 1♥/1♠-öppning, och svararens (partnern till öppnaren)
 * FÖRSTA bud efter öppningen är **2NT** – i 2/1 är direkt 2NT över 1M alltid
 * Jacoby (utgångskravande högfärgshöjning). Även 1M–(X)–2NT (Jordan) sätter
 * majoren som fit. Trumfen är då öppnarens högfärg, även om ingen bjudit den som
 * ett naturligt FÄRGbud (2NT är konstgjort) – därför missar `agreedTrump` den.
 * Returnerar högfärgen, annars null. Ett motståndar-KONTRAKTsbud mellan
 * öppningen och 2NT betyder att 2NT är något annat → null.
 */
function jacobyFitTrump(history: ResolvedCall[], seat: Seat): Suit | null {
  const open = openingBid(history)
  if (!open || side(open.seat) !== side(seat) || open.level !== 1) return null
  const major = SUIT_OF_LETTER[open.strain]
  if (major !== 'hearts' && major !== 'spades') return null
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  // Första KONTRAKTsbudet efter öppningen (pass/X/XX hoppas över).
  for (let i = openIdx + 1; i < history.length; i++) {
    if (!parseContractBid(history[i].bid)) continue
    if (side(history[i].seat) !== side(seat)) return null // motståndarna bjöd → ej Jacoby
    if (history[i].seat === open.seat) return null // öppnarens eget bud, inte svararens svar
    return history[i].bid === '2NT' ? major : null // svararens första svar
  }
  return null
}

/**
 * Grundmönstret för Jordan/Truscott (§7.3): vår 1M-öppning, DIREKT X från
 * motståndaren, partnerns 2NT som sidans första svar. Positionsexakt läsning
 * (öppning → X → 2NT) så en försenad 2NT eller sang i annan sits aldrig
 * feltolkas. Delas av öppnarens svarsplikt och Jordan-bjudarens fortsättning.
 */
function jordanBase(history: ResolvedCall[]): { openerSeat: Seat; major: Major; ntIdx: number } | null {
  const open = openingBid(history)
  if (!open || open.level !== 1) return null
  const major = SUIT_OF_LETTER[open.strain]
  if (major !== 'hearts' && major !== 'spades') return null
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  const dbl = history[openIdx + 1]
  if (!dbl || dbl.bid !== 'X') return null
  const nt = history[openIdx + 2]
  if (!nt || nt.bid !== '2NT' || nt.seat !== PARTNER[open.seat]) return null
  return { openerSeat: open.seat, major, ntIdx: openIdx + 2 }
}

/**
 * Partnerns Jordan 2NT väntar på mitt (öppnarens) svar — jag passar ALDRIG
 * (systemfel #4, frö 20260739). Bjuder advancern vidare över 2NT lämnas läget
 * till det ordinarie konkurrensmaskineriet (Jordan är inbjudan, inte rondkrav
 * i störd fortsättning).
 */
function jordanToAnswer(history: ResolvedCall[], seat: Seat): { major: Major } | null {
  const j = jordanBase(history)
  if (!j || j.openerSeat !== seat) return null
  for (let i = j.ntIdx + 1; i < history.length; i++) {
    if (history[i].bid !== 'P') return null
  }
  return { major: j.major }
}

/**
 * Öppnaren avslutade 3M på min Jordan 2NT — med utgångsstyrka (13+) går jag
 * vidare, med ren limithöjning står avslutet.
 */
function jordanSignoffToAnswer(history: ResolvedCall[], seat: Seat): { major: Major } | null {
  const j = jordanBase(history)
  if (!j || PARTNER[j.openerSeat] !== seat) return null
  let i = j.ntIdx + 1
  while (i < history.length && history[i].bid === 'P') i++
  const signoff = history[i]
  const letter = j.major === 'hearts' ? 'H' : 'S'
  if (!signoff || signoff.seat !== j.openerSeat || signoff.bid !== `3${letter}`) return null
  for (let k = i + 1; k < history.length; k++) {
    if (history[k].bid !== 'P') return null
  }
  return { major: j.major }
}

/**
 * Trumffärgen partnerns 4NT-essfråga gäller. Tre steg:
 *  1. ÖVERENSKOMMEN trumf (en färg båda bjudit) – felrapport #9.
 *  2. KONVENTIONS-fit utan naturligt färgbud: en Jacoby 2NT sätter öppnarens
 *     högfärg som trumf (R1-fynd #3 – annars lästes öppnarens konstgjorda
 *     Jacoby-kortfärg, t.ex. 3♣, som en naturlig klöverfärg → fel essredovisning).
 *  3. Ingen av ovan? Standardregeln (felrapport #10: 4NT direkt på partnerns
 *     3♠-spärr passades): 4NT är essfråga så länge sidans senaste naturliga bud
 *     FÖRE frågan var en FÄRG – trumfen är den färgen. Kvantitativt är 4NT bara
 *     när sidans senaste bud var SANG.
 * Ankras vid partnerns FÖRSTA 4NT så kungfrågan (5NT) läser samma trumf och
 * aldrig snubblar på det konstgjorda stegsvaret (5♣/5♦/…) däremellan.
 */
function slamAskTrump(history: ResolvedCall[], seat: Seat): Suit | null {
  const agreed = agreedTrump(history, seat)
  if (agreed) return agreed
  const jacoby = jacobyFitTrump(history, seat)
  if (jacoby) return jacoby
  const askIdx = history.findIndex((c) => c.seat === PARTNER[seat] && c.bid === '4NT')
  if (askIdx < 0) return null
  for (let i = askIdx - 1; i >= 0; i--) {
    const c = history[i]
    if (side(c.seat) !== side(seat)) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    if (cb.strain === 'NT') return null // sidans senaste bud var sang → kvantitativt
    if (opponentsBidStrain(history, seat, cb.strain)) continue // cue, ingen egen färg
    return SUIT_OF_LETTER[cb.strain]
  }
  return null
}

/**
 * Ska `seat` svara på partnerns 4NT-ESSFRÅGA (1430 RKC, §6.1)? Kraven
 * (felrapport #9 + #10 – Nord passade på en "odiskutabel essfråga"):
 *  - partnerns senaste icke-pass är 4NT (bara pass har följt),
 *  - trumfen kan härledas via `slamAskTrump` (överenskommen färg, eller
 *    sidans senaste naturliga färg – t.ex. spärröppningen 4NT ställs på).
 * Returnerar trumffärgen, annars null.
 */
function rkcToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '4NT') return null
  return slamAskTrump(history, seat)
}

/**
 * Har partnern bett öppnaren VÄLJA UTGÅNG efter en Jacoby-transfer
 * (felrapport #13: transferns relä lästes som naturlig hjärter → 4♥ på en
 * 2-kortsfärg)? Mönstret (§5, ostört): `seat` öppnade 1NT/2NT, partnern
 * överförde (relät = färgen UNDER högfärgen), `seat` fullföljde transfern,
 * partnern bjöd 3NT = "pass med 2-korts stöd, 4M med 3+" och bara pass har
 * följt. Motståndarna ska ha varit tysta (inga kontraktsbud). Returnerar
 * transferns högfärg, annars null.
 */
function transferGameChoiceToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null

  // Auktionens kontraktsbud i exakt denna ordning, alla från vår sida:
  // NT-öppning, relä, fullföljd transfer, 3NT.
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 4 || bids.some((c) => side(c.seat) !== side(seat))) return null
  const [open, relay, complete, nt] = bids
  if (open.seat !== seat || (open.bid !== '1NT' && open.bid !== '2NT')) return null
  const level = open.bid === '1NT' ? 2 : 3
  if (relay.seat !== PARTNER[seat] || (relay.bid !== `${level}D` && relay.bid !== `${level}H`)) return null
  const target: Suit = relay.bid === `${level}D` ? 'hearts' : 'spades'
  if (complete.seat !== seat || complete.bid !== `${level}${letterOfSuit(target)}`) return null
  if (nt !== lastNonPass) return null
  return target
}

/**
 * Ska `seat` svara på partnerns 5NT-KUNGFRÅGA (Sjöberg, §6.3)? Bara i en
 * essfrågesekvens: partnern har tidigare bjudit 4NT (essfrågan) och nu 5NT.
 */
function kingAskToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '5NT') return null
  if (!history.some((c) => c.seat === PARTNER[seat] && c.bid === '4NT')) return null
  return slamAskTrump(history, seat)
}

// ---- Kvantitativ höjning av partnerns naturliga 3NT (felrapport #42) --------
//
// Systemets slamportar satt bara i den kanoniska linjens NAMNGIVNA mönster
// (Jacoby 2NT, inverterad minor, 1NT-återbudet, MSS …). Placerade partnern
// kontraktet i ett naturligt 3NT i en vanlig färgauktion fanns ingen kvantitativ
// höjning alls — kaptenen hade inget bud och passade bort lillslammen
// (felrapport #42: 21 hp mittemot en öppningshand, 12 stick i 3NT).
//
// Regeln är systemets EGEN kaptensregel (§5.2, ärliga slamportar 2026-07-07):
// egen hand + partnerns VISADE minimum ≥ 33 → driv. Partnern har ÖPPNAT på
// 1-läget i en färg, och den låsta regeln är att en 12-poängshand alltid öppnar
// → visat minimum = 12, alltså tröskeln 21 hp på egen hand. Ingen kontrollkoll
// (ägarbeslut), och storslam kräver visshet → taket är 6NT.

/** Partnerns visade minimum när hen öppnat på 1-läget i en färg (låst regel). */
const SUIT_OPENING_SHOWN_MIN = 12

/**
 * Höjer partnerns naturliga 3NT till 6NT när kaptenens egen hand + partnerns
 * visade minimum når slamzonen (33). Smal med flit:
 *  - partnerns 3NT ska vara auktionens SENASTE bud (ingen har bjudit över),
 *  - partnern ska ha ÖPPNAT på 1-läget i en FÄRG (då är 12-golvet ärligt;
 *    sangöppningar har sina egna portar i `respondTo1NT`/`respondTo2NT`),
 *  - motståndarna ska ha varit tysta (deras bud kan göra 3NT till ett
 *    tävlingsbud i stället för en styrkevisning),
 *  - egen hand utan renons — vild fördelning hör inte hemma i 6NT.
 */
function raisePartnerThreeNTToSlam(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null

  const open = openingBid(history)
  if (!open || open.seat !== PARTNER[seat]) return null
  if (open.level !== 1 || open.strain === 'NT') return null
  if (history.some((c) => side(c.seat) !== side(seat) && c.bid !== 'P')) return null

  const hand = deal.hands[seat]
  const p = hcp(hand)
  if (p + SUIT_OPENING_SHOWN_MIN < 33) return null
  const len = lengths(hand)
  if ((['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).some((s) => len[s] === 0)) return null
  if (!legalCalls(history, seat).includes('6NT')) return null

  return {
    seat,
    bid: '6NT',
    rule: 'slamhöjning av 3NT',
    explanation:
      `Slamzon mot partnerns visade ${SUIT_OPENING_SHOWN_MIN}+ (öppningen) ` +
      `→ 6NT. Slamzonen nås redan mot partnerns minimum, så jag placerar lillslammen i stället för att passa 3NT.`,
  }
}

// ---- Etapp 7 hål D: slaminvit efter en HÖGFÄRGSFIT funnen i KONKURRENS -------
//
// Systemrevisorns Fynd 3 (mönster E): vår sida hittar en högfärgsfit GENOM
// konkurrens och når 4M — sedan passar den starka kaptenen naket (Fynd 1). Cue-/
// RKC-maskineriet fanns bara i det kanoniska lagret.
//
// ÄGARBESLUT 2026-08-05 "bara äkta extra" + info-läckage: i konkurrens läcker
// cue-bud kontroll-info till motståndarna som lyssnar. STEG 1 (detta) tar därför
// bara det KONTROLL-KOMPLETTA fallet: har kaptenen första-rondskontroll (ess/
// renons) i ALLA sidofärger behövs ingen cue — hen frågar nyckelkort direkt (4NT).
// Det är samtidigt en tight grind: en vanlig utgångshand är nästan aldrig kontroll-
// komplett, så trevaren tänds inte på den (v0-genvägen "17+ + fit → 4NT" blåste
// 8 utgångshänder till slam; kontroll-kompletthet är det som skiljer). Cue-front-
// enden för de kontroll-OFULLSTÄNDIGA fallen byggs som steg 2. Ingen kik: kaptenen
// räknar sin EGEN hand + partnerns visade fit. Storslam bjuds aldrig blint.

/** Antal kontrollkort (ess + kungar) på handen — ägarens "3 kontroller"-tröskel. */
function controlCount(hand: Hand): number {
  return hand.filter((c) => c.rank === 'A' || c.rank === 'K').length
}

/**
 * Vår sidas agreed HÖGFÄRG i en konkurrensauktion, sedd från `seat`:
 *  1. en högfärg BÅDA bjudit (`agreedTrump`), eller
 *  2. en högfärg PARTNERN bjudit naturligt (ej cue av deras färg) som jag har 3+ i.
 */
function competitiveMajorFit(history: ResolvedCall[], seat: Seat, hand: Hand): Suit | null {
  const agreed = agreedTrump(history, seat)
  if (agreed === 'hearts' || agreed === 'spades') return agreed
  for (let i = history.length - 1; i >= 0; i--) {
    const c = history[i]
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    const s = SUIT_OF_LETTER[cb.strain]
    if ((s === 'hearts' || s === 'spades') && lengths(hand)[s] >= 3 && !opponentsBidStrain(history, seat, cb.strain)) {
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
function partnerShowedJump(history: ResolvedCall[], seat: Seat): boolean {
  const partner = PARTNER[seat]
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
function competitiveSlamTry(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (!bids.some((c) => side(c.seat) !== side(seat))) return null // ingen konkurrens
  if (!legalCalls(history, seat).includes('4NT')) return null
  if (history.some((c) => side(c.seat) === side(seat) && (c.bid === '4NT' || (parseContractBid(c.bid)?.level ?? 0) >= 5))) {
    return null // vår sida redan i slamzonen på annan väg
  }
  const hand = deal.hands[seat]
  const fit = competitiveMajorFit(history, seat, hand)
  if (!fit) return null
  const sp = startingPoints(hand).startingPoints
  const honestExtra = sp >= 17 || (sp >= 16 && controlCount(hand) >= 3)
  if (!honestExtra) return null
  if (!controlComplete(hand, fit)) return null // steg 1: bara kontroll-komplett
  if (!partnerShowedJump(history, seat)) return null // partnern måste ha visat extra (hopp)

  return {
    seat,
    bid: '4NT',
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
function competitiveRKCPlace(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const askIdx = history.findIndex((c) => c.seat === seat && c.bid === '4NT' && c.rule === 'konkurrens-slaminvit (RKC)')
  if (askIdx < 0) return null // placerar bara efter VÅR egen konkurrens-slaminvit
  const after = history.slice(askIdx + 1)
  if (after.some((c) => c.seat === seat && parseContractBid(c.bid))) return null // redan placerat
  const answer = after.find((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (!answer) return null

  const hand = deal.hands[seat]
  const trump = competitiveMajorFit(history, seat, hand) ?? agreedTrump(history, seat)
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
      seat, bid: slam, rule: 'konkurrens-slam: placering',
      explanation: `essvaret ${prettyBid(answer.bid)} + min hand = ${own + possible[0]} av 5 nyckelkort (högst ett saknas) → ${prettyBid(slam)} (lillslam).`,
    }
  }
  if (legal.includes(stop)) {
    return {
      seat, bid: stop, rule: 'konkurrens-slam: stopp',
      explanation: `essvaret ${answer.bid} lämnar nyckelkortsläget osäkert → stannar i ${stop} (utgång).`,
    }
  }
  return null
}

// ---- Etapp 7 hål 2: öppnarens slamtrevare efter svararens 3NT ("3NT-stoppen")
//
// Systerfallet till felrapport #42 (`raisePartnerThreeNTToSlam` ovan), fast från
// den sida som SJÄLV har extra: öppnaren invit-hoppade i sin minor (1m–1X–3m), och
// svararen accepterade utgången med 3NT. Öppnaren saknade en väg vidare och föll
// till det nakna passet (Fynd 1) — lillslammen försvann fast öppnaren hade en
// stark hand med löpande färg. Med genuint slamvärde hen SJÄLV vet om gör öppnaren
// nu EN kvantitativ slamtrevare (4NT); svararen accepterar 6NT med ett maximum av
// sin acceptans (topp av intervallet, eller en fittande topphonnör i minoren).
//
// Smal med flit (ägarbeslut 2026-07-31, "bara äkta extra"): från öppnarens stol är
// en 16–18-hand med löpande minor OSKILJBAR från en tunn 26-hp-slam som bara går
// på DD, så bara 19+ får treva. Ingen kontrollkoll (ägarbeslut), taket är 6NT.

const MINOR_SUIT: Record<string, Suit> = { C: 'clubs', D: 'diamonds' }
const ALL_SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/** Öppnarens invit-hopp 1m–1X–3m följt av svararens 3NT (senaste budet, ostört)? */
function openerJumpMinorThenResponder3NT(history: ResolvedCall[], seat: Seat): { minor: string } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null
  const open = openingBid(history)
  if (!open || open.seat !== seat) return null // seat = öppnaren själv
  if (open.level !== 1 || (open.strain !== 'C' && open.strain !== 'D')) return null
  if (history.some((c) => side(c.seat) !== side(seat) && c.bid !== 'P')) return null // ostört
  // Öppnarens ANDRA kontraktsbud ska vara hoppet 3m i öppningsfärgen.
  const ourBids = history.filter((c) => c.seat === seat).map((c) => parseContractBid(c.bid)).filter((b): b is { level: number; strain: string } => b !== null)
  if (ourBids.length < 2) return null
  const rebid = ourBids[1]
  if (rebid.level !== 3 || rebid.strain !== open.strain) return null
  return { minor: open.strain }
}

/** Öppnaren (19+ hp, 6+ i minoren) trevar 4NT efter svararens 3NT. */
function openerTriesSlamAfter3NT(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const m = openerJumpMinorThenResponder3NT(history, seat)
  if (!m) return null
  const hand = deal.hands[seat]
  const p = hcp(hand)
  if (p < 19) return null // bara äkta extra öppnaren SJÄLV vet om
  const len = lengths(hand)
  if (len[MINOR_SUIT[m.minor]] < 6) return null
  if (ALL_SUITS.some((s) => len[s] === 0)) return null // ingen renons – NT är målet
  if (!legalCalls(history, seat).includes('4NT')) return null
  return {
    seat,
    bid: '4NT',
    rule: 'slamtrevare efter 3NT',
    explanation:
      `Slamintresse med löpande ${SWE_SYM[m.minor]} – för starkt för att bara passa partnerns 3NT ` +
      `→ 4NT (kvantitativ slamtrevare; partnern lyfter till 6NT med ett maximum).`,
  }
}

/** Öppnarens kvantitativa 4NT efter 1m–1X–3m–3NT (senaste budet, ostört)? */
function openerSlamTryToAnswer(history: ResolvedCall[], seat: Seat): { minor: string } | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '4NT') return null
  const open = openingBid(history)
  if (!open || open.seat !== PARTNER[seat]) return null // partnern = öppnaren
  if (open.level !== 1 || (open.strain !== 'C' && open.strain !== 'D')) return null
  if (history.some((c) => side(c.seat) !== side(seat) && c.bid !== 'P')) return null // ostört
  // Sekvensen ska vara 1m–1X–3m–3NT–4NT: partnern hoppade 3m, VI bjöd 3NT.
  const partnerBids = history.filter((c) => c.seat === PARTNER[seat]).map((c) => parseContractBid(c.bid)).filter((b): b is { level: number; strain: string } => b !== null)
  if (partnerBids.length < 3) return null
  if (partnerBids[1].level !== 3 || partnerBids[1].strain !== open.strain) return null
  const ourBids = history.filter((c) => c.seat === seat).map((c) => parseContractBid(c.bid)).filter((b): b is { level: number; strain: string } => b !== null)
  if (!ourBids.some((b) => b.level === 3 && b.strain === 'NT')) return null
  return { minor: open.strain }
}

/** Svararen accepterar öppnarens slamtrevare med ett maximum, annars pass. */
function answerOpenerSlamTry(hand: Hand, minor: string): { call: Bid; rule: string; explanation: string } {
  const p = hcp(hand)
  const fitHonor = suitHcp(hand, MINOR_SUIT[minor]) >= 3 // K/A i partnerns 6-korts minor
  const accept = p >= 12 || (p >= 9 && fitHonor)
  return accept
    ? {
        call: '6NT',
        rule: 'accepterar slamtrevare',
        explanation:
          `Maximum av min acceptans${fitHonor ? ` (topphonnör i ${SWE_SYM[minor]})` : ''} → 6NT.`,
      }
    : { call: 'P', rule: 'avböjer slamtrevare', explanation: `Minimum – avböjer trevaren → 4NT står.` }
}

// ---- Sangsystemet off-book (§4.3–4.4, felrapport #41) -----------------------
//
// `respondTo1NT`/`respondTo2NT` och öppnarens återbud var BARA inkopplade i den
// kanoniska linjen (`auction.ts`). Bjöds sangöppningen off-book — t.ex. när
// ägaren tar budet själv i budlådan — fanns ingen väg in: `offBookResponse`
// kräver att partnern visat en FÄRG, och en sangöppning visar ingen. Resultatet
// var att 1NT passades ut även med en stark hand mittemot (felrapport #41).
//
// Båda sidor av bordet behövs för att auktionen ska bli hel: svararen får sitt
// systemsvar, öppnaren sitt återbud. Betydelsen av svarsbudet läses ur BUDET,
// aldrig ur partnerns kort (ärliga slamportar).

/** Är auktionen ostörd med sangöppningen som enda kontraktsbud från vår sida? */
function cleanNTOpening(history: ResolvedCall[], seat: Seat): { seat: Seat; level: number } | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level > 2) return null
  if (side(open.seat) !== side(seat)) return null
  // Motståndarna ska ha varit HELT tysta – stör de äger `ntInterferenceToAnswer`
  // och DONT-detektorerna läget, inte sangsystemet.
  if (history.some((c) => side(c.seat) !== side(seat) && c.bid !== 'P')) return null
  return { seat: open.seat, level: open.level }
}

/**
 * PARTNERN öppnade 1NT/2NT off-book och det är `seat`s tur att svara första
 * gången → kör sangsystemet (§4.3/§4.4): Stayman, transfers, Texas, Minor Suit
 * Stayman/minorfråga och NT-stegen. Kräver att öppningen är auktionens enda
 * kontraktsbud och att `seat` inte redan bjudit något själv (bara pass tillåts,
 * t.ex. när partnern öppnat i tredje hand).
 */
function answerPartnerNTOpening(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = cleanNTOpening(history, seat)
  if (!open || open.seat !== PARTNER[seat]) return null
  if (history.filter((c) => parseContractBid(c.bid)).length !== 1) return null
  if (history.some((c) => c.seat === seat && c.bid !== 'P')) return null

  const hand = deal.hands[seat]
  const res = open.level === 1 ? respondTo1NT(hand) : respondTo2NT(hand)
  const bid = res.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: res.rule, explanation: res.explanation }
}

/**
 * Betydelsen av partnerns svar på VÅR sangöppning, läst ur BUDET (aldrig ur
 * partnerns kort). Returnerar `ResponseResult.rule`-strängen som
 * `openerRebidAfter1NTResponse`/`openerRebidAfter2NTResponse` dispatchar på,
 * eller null när budet inte är ett systemsvar (då lämnas läget åt övriga
 * detektorer).
 */
function ntResponseRule(openLevel: number, bid: string): string | null {
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
 * `seat` öppnade 1NT/2NT off-book och partnern har svarat med ett systemsvar som
 * väntar på öppnarens återbud (Stayman-svar, fullföljd transfer/Texas, MSS-svar,
 * accept/avböj av inbjudan). Exakt två kontraktsbud i historiken: vår öppning +
 * partnerns svar.
 */
function openerAnswersNTResponse(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = cleanNTOpening(history, seat)
  if (!open || open.seat !== seat) return null
  const bids = history.filter((c) => parseContractBid(c.bid))
  if (bids.length !== 2 || bids[1].seat !== PARTNER[seat]) return null

  const rule = ntResponseRule(open.level, bids[1].bid)
  if (!rule) return null
  const response = { call: bids[1].bid, rule, explanation: '' }
  const hand = deal.hands[seat]
  const res = open.level === 1
    ? openerRebidAfter1NTResponse(response, hand)
    : openerRebidAfter2NTResponse(response, hand)
  if (!res) return null
  const bid = res.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: res.rule, explanation: res.explanation }
}

// ---- Systems on över ett 1NT-INKLIV (§4.3, uppföljning felrapport #53) ------
//
// Sangsystemet (`respondTo1NT` + fullföljandet ovan) var bara inkopplat över en
// 1NT-ÖPPNING (`cleanNTOpening` kräver att 1NT är öppningen och att motståndarna
// tigit). Ett 1NT-INKLIV (motståndarna öppnade i färg, vi klev in 1NT = 15–18
// balanserad) visar SAMMA sorts hand, så systems on ska gälla där också: Stayman,
// transfers, Texas, MSS – och inklivaren fullföljer. Betydelsen läses ur BUDET,
// aldrig ur partnerns kort. V1: den EGNA svarsronden är ostörd (RHO passade); vidare
// konkurrens över svaret är en känd förenkling.

/**
 * Gjorde vår sida ett rent, naturligt 1NT-INKLIV? Sant när auktionens öppning är
 * motståndarnas 1-läges FÄRGöppning och vår sidas FÖRSTA kontraktsbud är 1NT utan
 * en egen dubbling före (då vore 1NT en stark X-1NT, inte inklivet). Returnerar
 * inklivarens plats, annars null. (Ovanlig 2NT är 2NT, inte 1NT → faller utanför.)
 */
function our1NTOvercall(history: ResolvedCall[], seat: Seat): { overcaller: Seat } | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat) || open.strain === 'NT' || open.level !== 1) return null
  const ourContracts = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourContracts.length === 0 || ourContracts[0].bid !== '1NT') return null
  const firstIdx = history.indexOf(ourContracts[0])
  // Ingen egen icke-pass-handling FÖRE 1NT:et (t.ex. ett X) – då är det ett annat bud.
  if (history.slice(0, firstIdx).some((c) => side(c.seat) === side(seat) && c.bid !== 'P')) return null
  return { overcaller: ourContracts[0].seat }
}

/**
 * PARTNERN klev in 1NT och det är advancerns (`seat`) tur att svara första gången,
 * ostört (RHO passade) → kör sangsystemet (`respondTo1NT`): Stayman/transfer/Texas/MSS.
 */
function advancerRespondsTo1NTOvercall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const oc = our1NTOvercall(history, seat)
  if (!oc || oc.overcaller !== PARTNER[seat]) return null
  const ourContracts = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourContracts.length !== 1) return null // bara inklivet – advancern har inte svarat än
  if (history.some((c) => c.seat === seat && c.bid !== 'P')) return null // advancern objuden
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== oc.overcaller || lastNonPass.bid !== '1NT') return null // RHO passade
  const res = respondTo1NT(deal.hands[seat])
  const bid = res.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: res.rule, explanation: res.explanation }
}

/**
 * JAG klev in 1NT, advancern (partnern) svarade med ett systemsvar, ostört (RHO
 * passade) → fullfölj (Stayman-svar, transfer, Texas, MSS) via samma dispatch som
 * över en 1NT-öppning.
 */
function overcallerAnswersAdvance(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const oc = our1NTOvercall(history, seat)
  if (!oc || oc.overcaller !== seat) return null
  const ourContracts = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourContracts.length !== 2 || ourContracts[1].seat !== PARTNER[seat]) return null
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass !== ourContracts[1]) return null // advancerns svar senast (RHO passade)
  const rule = ntResponseRule(1, ourContracts[1].bid)
  if (!rule) return null
  const res = openerRebidAfter1NTResponse({ call: ourContracts[1].bid, rule, explanation: '' }, deal.hands[seat])
  if (!res) return null
  const bid = res.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: res.rule, explanation: res.explanation }
}

// ---- Off-book: svara historiedrivet på Syds egna bud (pivotens kärna) -------
//
// När Syd bjudit utanför systemlinjen (off-book) har partnern ingen kanonisk
// fortsättning. I stället för att tappa tråden och passa svarar vi som en
// förnuftig partner skulle: stöd partnerns färg om vi har fit (graderat efter
// styrka), annars en egen färg eller sang. Allt utläst ur historiken + den egna
// handen – aldrig ur den (nu ogiltiga) ideallinjen. Medvetet konservativt; varje
// regel ska vara TYDLIGT korrekt även om den är smal.

const SWE_SYM: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
/** Bud med färgsymbol för FÖRKLARINGSTEXTEN ("3H" → "3♥"); NT/pass/dubbel oförändrade. */
function prettyBid(bid: string): string {
  const m = bid.match(/^([1-7])(C|D|H|S)$/)
  return m ? `${m[1]}${SWE_SYM[m[2]]}` : bid
}
const SUIT_STRAINS = ['C', 'D', 'H', 'S'] as const

/** Första kontraktsbudet i historiken (öppningen), eller null om inget bjudits. */
function openingBid(history: ResolvedCall[]): { seat: Seat; level: number; strain: string } | null {
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb) return { seat: c.seat, level: cb.level, strain: cb.strain }
  }
  return null
}

/**
 * Partnerns SENAST visade naturliga färg (med nivån hen bjöd den på), läst ur
 * historiken. En cue i motståndarnas färg räknas inte som en egen färg, och
 * sang räknas inte som färg. Returnerar null om partnern inte visat någon färg.
 */
function partnerLastSuit(history: ResolvedCall[], seat: Seat): { strain: string; level: number } | null {
  let found: { strain: string; level: number } | null = null
  for (const [idx, c] of history.entries()) {
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb || cb.strain === 'NT') continue
    // Cue i motståndarnas färg är ingen egen färg att stödja.
    const isTheirSuit = history.some((x) => {
      const xb = parseContractBid(x.bid)
      return xb && xb.strain === cb.strain && side(x.seat) !== side(seat)
    })
    if (isTheirSuit) continue
    // Konstgjorda sang-svar är ingen färg: 2♣/3♣ (Stayman) och 2♦/2♥ resp.
    // 3♦/3♥ (överföringar) direkt över egen sidas 1NT/2NT lovar INTE färgen —
    // 5♣-ryckaren (fel färg-spåret fix 1) uppstod när Stayman-2♣ lästes som
    // klöver och "höjdes" till 5♣ över partnerns färdiga 3NT.
    if (isArtificialNTResponse(history, idx)) continue
    found = { strain: cb.strain, level: cb.level }
  }
  return found
}

/**
 * Är budet på plats `idx` ett KONSTGJORT svar på egen sidas sangbud (Stayman
 * 2♣/3♣ eller överföring 2♦/2♥/3♦/3♥)? Sant när närmast föregående
 * kontraktsbud är 1NT/2NT från SAMMA sida och budet ligger exakt en nivå upp
 * i klöver/ruter/hjärter (systemets sangkonventioner, systems on efter 2♣).
 */
function isArtificialNTResponse(history: ResolvedCall[], idx: number): boolean {
  const cb = parseContractBid(history[idx].bid)
  if (!cb || !['C', 'D', 'H'].includes(cb.strain)) return false
  for (let i = idx - 1; i >= 0; i--) {
    const prev = parseContractBid(history[i].bid)
    if (!prev) continue
    return (
      prev.strain === 'NT' &&
      prev.level <= 2 &&
      cb.level === prev.level + 1 &&
      side(history[i].seat) === side(history[idx].seat)
    )
  }
  return false
}

/** Har motståndarsidan (sett från `seat`) gjort ett kontraktsbud? (konkurrens) */
function opponentsHaveBid(history: ResolvedCall[], seat: Seat): boolean {
  return history.some((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid))
}

/** Har motståndarsidan bjudit `strain` som kontraktsbud? (då är det inte en egen färg) */
function opponentsBidStrain(history: ResolvedCall[], seat: Seat, strain: string): boolean {
  return history.some((c) => {
    const cb = parseContractBid(c.bid)
    return cb && cb.strain === strain && side(c.seat) !== side(seat)
  })
}

/** Lägsta lagliga budet i en färg/sang just nu (t.ex. "2H"), eller null. */
function cheapestBidIn(history: ResolvedCall[], seat: Seat, strain: string): Bid | null {
  const legal = legalCalls(history, seat)
  for (let level = 1; level <= 7; level++) {
    const bid = `${level}${strain}` as Bid
    if (legal.includes(bid)) return bid
  }
  return null
}

/**
 * Var partnerns färg ett HOPP-inkliv över motståndarnas öppning? Ett svagt
 * hoppinkliv (t.ex. 2♥ över 1♣) lovar 6+ kort i färgen — då räcker 3-korts
 * stöd för fit (9 trumf), och en höjning är SPÄRR (lag om totala stick), inte
 * styrkevisning. (Felrapport #2, ägarbeslut 2026-07-02.)
 */
function partnerJumpOvercalled(
  history: ResolvedCall[],
  seat: Seat,
  partnerSuit: { strain: string },
): boolean {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat)) return false // inkliv kräver deras öppning
  let prevValue = 0
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    if (c.seat === PARTNER[seat] && cb.strain === partnerSuit.strain) {
      // Hopp = budet ligger en hel nivå över det billigaste lagliga i färgen.
      let minLevel = 1
      while (bidValue(minLevel, cb.strain) <= prevValue) minLevel++
      return cb.level > minLevel
    }
    prevValue = bidValue(cb.level, cb.strain)
  }
  return false
}

/**
 * Var partnerns färg ett BALANSINKLIV över motståndarnas öppning (deras
 * öppning, två pass, partnerns bud i utpassningsläget)? Då är "kungen redan
 * lånad" av balanseraren (§7.6: golven sänkta ~3 hp) — advancern ska räkna av
 * den i sin höjning i stället för att värdera samma styrka två gånger.
 * Byggd för svaga tvåor i fix 5a; generaliserad till ALLA öppningsnivåer
 * (även 1-läget) i F3 (C12, 2026-08-07).
 */
function partnerBalanced(
  history: ResolvedCall[],
  seat: Seat,
  partnerSuit: { strain: string },
): boolean {
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  if (openIdx === -1 || openIdx + 3 >= history.length) return false
  if (side(history[openIdx].seat) === side(seat)) return false
  const entry = history[openIdx + 3]
  return (
    history[openIdx + 1].bid === 'P' &&
    history[openIdx + 2].bid === 'P' &&
    entry.seat === PARTNER[seat] &&
    parseContractBid(entry.bid)?.strain === partnerSuit.strain
  )
}

/**
 * Hur många trumf vi kräver för att kalla det fit i partnerns färg. Öppnade
 * partnern den HÖGfärgen på 1-läget lovar den 5+ → 3-korts stöd räcker (8-korts
 * fit). Samma sak när partnern HOPPINKLIVIT (6+ kort lovade). I alla andra fall
 * (minor, eller en högfärg som inte är öppningen) kräver vi 4+ för att vara
 * säkra på fit.
 */
function fitLengthNeeded(history: ResolvedCall[], seat: Seat, partnerSuit: { strain: string; level: number }): number {
  if (partnerJumpOvercalled(history, seat, partnerSuit)) return 3
  // Har partnern BJUDIT färgen minst två gånger (öppnat + rebjudit) lovar den 6+
  // → 2-korts stöd räcker för fit (8-korts fit). Utan detta passade svararen en
  // dubbelton mot en rebjuden 6-korts högfärg (felrapport #19: 1♥ … 2♥ passades
  // med KT doubleton, 8-korts fit + utgångsvärden). UNDANTAG (fel färg-spåret
  // fix 4, frö 20260763): ett BILLIGT ombud som svarar på MIN egen dubbling
  // (samma nivå som deras inkliv — kunde vara 5-korts nödrebuden i
  // `openerAnswerNegativeDouble`) lovar ingen extralängd och räknas inte —
  // UTOM när partnern öppnade färgen med 1♥/1♠ (öppningen lovade redan 5+, så
  // dubbelton = 7-korts fit). Ett tvingat ombud som fick gå UPP en nivå kommer
  // däremot ur 6+-steget och räknas som vanligt (frö 20260771: 1♣–(1♦)–X–P–2♣
  // = 6 klöver, dubbelhöjning på dubbelton är rätt).
  const opening = openingBid(history)
  const partnerOpened1Major =
    !!opening &&
    opening.seat === PARTNER[seat] &&
    opening.level === 1 &&
    opening.strain === partnerSuit.strain &&
    (opening.strain === 'H' || opening.strain === 'S')
  // F5/E2 (frö 20261885): det KONSTGJORDA 2♣-öppningsbudet är ingen klöverfärg
  // — utan detta räknades 2♣ + ett senare klöverbud som "bjudit klöver två
  // gånger → 6+" och dubbelton-stöd höjde till 5♣.
  const firstContractCall = history.find((c) => parseContractBid(c.bid))
  const partnerBidsInSuit = history.filter((c, idx) => {
    const cb = parseContractBid(c.bid)
    if (c.seat !== PARTNER[seat] || cb?.strain !== partnerSuit.strain) return false
    if (c === firstContractCall && c.bid === '2C') return false // konstgjord stark 2♣
    for (let i = idx - 1; i >= 0; i--) {
      if (history[i].bid === 'P') continue
      // Speldiagnosen S0 (frö 20260772): ett färgbud som SVARAR PÅ MIN CUE
      // (mitt bud i en färg motståndarna bjudit) efter partnerns egen
      // upplysningsdubbling visar exakt FYRA kort — det adderar ingen längd
      // och får inte räknas mot "två bud = 6+" (E höjde 3♥→4♥ på A9
      // dubbelton mot visade fyra; 4-2-utgången gick 6 bet).
      const prevCb = parseContractBid(history[i].bid)
      const svarPaMinCue =
        history[i].seat === seat &&
        !!prevCb &&
        history
          .slice(0, i)
          .some((c2) => {
            const cb2 = parseContractBid(c2.bid)
            return !!cb2 && cb2.strain === prevCb.strain && c2.seat !== seat && c2.seat !== PARTNER[seat]
          }) &&
        history.slice(0, idx).some((c2) => c2.seat === PARTNER[seat] && c2.bid === 'X')
      if (svarPaMinCue) return false
      const forcedByMyX = history[i].seat === seat && history[i].bid === 'X'
      if (!forcedByMyX) return true
      if (partnerOpened1Major) return true
      // Nivån på senaste kontraktsbudet före ombudet: samma nivå = billigt (5-korts möjligt).
      for (let j = i - 1; j >= 0; j--) {
        const prev = parseContractBid(history[j].bid)
        if (prev) return cb!.level > prev.level
      }
      return true
    }
    return true
  }).length
  if (partnerBidsInSuit >= 2) return 2
  const isMajor = partnerSuit.strain === 'H' || partnerSuit.strain === 'S'
  const open = openingBid(history)
  const partnerOpenedMajor =
    !!open && open.seat === PARTNER[seat] && open.strain === partnerSuit.strain && open.level === 1 && isMajor
  return partnerOpenedMajor ? 3 : 4
}

/**
 * Höj partnerns färg när vi har fit, graderat efter stödpoäng (dummyPoints):
 *   6–10 → enkel höjning · 11–12 → inbjudande hopp · 13+ → utgång (4 i hf).
 * Klampas till lagliga bud; räcker det inte ens till en enkel höjning passar vi.
 */
function raiseWithFit(
  deal: Deal,
  history: ResolvedCall[],
  seat: Seat,
  partnerSuit: { strain: string; level: number },
): ResolvedCall | null {
  const hand = deal.hands[seat]
  const suit = SUIT_OF_LETTER[partnerSuit.strain]
  if (lengths(hand)[suit] < fitLengthNeeded(history, seat, partnerSuit)) return null

  // Har vi redan bjudit färgen själva höjer vi inte upp den igen (ingen upptrappning).
  if (history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === partnerSuit.strain)) return null

  // Dubbelton-"fit" (partnern har rebjudit sin färg — i ett krav ofta TVINGAT,
  // så ombudet lovar bara 5+) slår aldrig en EGEN redan visad 6+ färg: den egna
  // färgen är trumfen (fel färg-spåret fix 2: 2♣–2♦–3♣–3♠–4♣ → rebjud 4♠, höj
  // inte 5♣ på ♣85). Returnerar null → kravlogiken rebjuder den egna färgen.
  if (
    lengths(hand)[suit] === 2 &&
    SUIT_STRAINS.some(
      (st) =>
        lengths(hand)[SUIT_OF_LETTER[st]] >= 6 &&
        history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st),
    )
  ) return null

  // Advancer-rabatt (fix 5a, generaliserad i F3): partnerns färgbud var en
  // BALANSERING över deras öppning (öppning, två pass, partnerns bud). Kungen är
  // redan lånad av balanseraren (golven sänkta ~3 hp) — räkna av den här, annars
  // värderas samma kung två gånger och höjningen blåser utgång på delkontrakts-
  // värden (frö 20260770: 2♠-balanseringen höjdes till 4♠ bet fast 3♠ = par;
  // F3-facit: 1♥–P–P–1♠ med 11 sp höjdes till invit-3♠ där 2♠ räcker).
  const balanced = partnerBalanced(history, seat, partnerSuit)
  const sp = dummyPoints(hand, suit).dummyPoints - (balanced ? 3 : 0)
  if (sp < 6) return null // för svagt för att höja

  // En dubbelton-fit som bygger på ett TVINGAT ombud (partnerns svar på min
  // egen dubbling) höjs bara med UTGÅNGSVÄRDEN (13+ stödpoäng, då jagar
  // höjningen en utgång som 4M/5m). En enkel/inbjudande höjning på dubbelton
  // pressar bara upp partnerns MINIMUM en nivå utan syfte (fel färg-spåret
  // fix 4, frön 20260847/20261251: 2♦/2♥ → 3♦/3♥ bet, fast ombudet stod).
  if (lengths(hand)[suit] === 2 && sp < 13) {
    const partnerForcedRebidInSuit = history.some((c, idx) => {
      const cb = parseContractBid(c.bid)
      if (c.seat !== PARTNER[seat] || cb?.strain !== partnerSuit.strain) return false
      for (let i = idx - 1; i >= 0; i--) {
        if (history[i].bid === 'P') continue
        return history[i].seat === seat && history[i].bid === 'X'
      }
      return false
    })
    if (partnerForcedRebidInSuit) return null
  }

  // FIX 6 mönster 1: har partnern just PASSAT i konkurrensen har hen visat
  // minimum utan utgångsintresse — höjningen är då bara TÄVLANDE: billigaste
  // nivån, aldrig invit/utgångsblås (frön 20261090/20261409/20261459: negativ-
  // dubblaren blåste 5♣ på 13–16 stödpoäng fast öppnaren passat; 2♣/3♣ räcker).
  const partnerLastCall = [...history].reverse().find((c) => c.seat === PARTNER[seat])
  if (partnerLastCall?.bid === 'P' && opponentsHaveBid(history, seat)) {
    const bid = cheapestBidIn(history, seat, partnerSuit.strain)
    if (!bid) return null
    const cb = parseContractBid(bid)!
    const game = partnerSuit.strain === 'H' || partnerSuit.strain === 'S' ? 4 : 5
    if (cb.level >= game) return null // tävla inte till utgångsnivå mot en passad partner
    return {
      seat, bid,
      explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]}, men partnern har passat (minimum) → ${prettyBid(bid)} (tävlande höjning, ej invit).`,
    }
  }

  // Partnern hoppinklev (svagt, 6+ kort) → höjningen är SPÄRR: en nivå upp,
  // aldrig styrkegraderad (partnern har max ~9 hp – utgångsblås vore fel).
  if (partnerJumpOvercalled(history, seat, partnerSuit)) {
    const bid = `${partnerSuit.level + 1}${partnerSuit.strain}` as Bid
    if (legalCalls(history, seat).includes(bid)) {
      return {
        seat,
        bid,
        explanation: `Höjer partnerns spärr – 3+ stöd mot ett hoppinkliv (6+ kort) gör det svårare för motståndarna.`,
      }
    }
    return null
  }

  const isMajor = partnerSuit.strain === 'H' || partnerSuit.strain === 'S'

  // Minorfit med UTGÅNGSVÄRDEN (13+ stödpoäng): nå utgång i stället för att kapa
  // vid en inbjudan (grunden "rätt nivå med fit", 2026-07-05). Balanserad hand →
  // 3NT (enklare utgång med 25 stick); annars minorutgången 5m. (Förr stannade
  // motorn alltid på ett inbjudande hopp för minor – aldrig utgång.)
  if (!isMajor && sp >= 13) {
    const legal = legalCalls(history, seat)
    if (isBalanced(hand) && legal.includes('3NT' as Bid)) {
      return {
        seat, bid: '3NT' as Bid,
        explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]} + utgångsvärden, balanserad → 3NT.`,
      }
    }
    const gameBid = `5${partnerSuit.strain}` as Bid
    if (legal.includes(gameBid)) {
      return {
        seat, bid: gameBid,
        explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]} + utgångsvärden → minorutgång ${gameBid}.`,
      }
    }
    // Varken 3NT eller 5m lagligt (konkurrensen tryckte upp budet) → fall vidare.
  }

  // Önskad nivå efter styrka. Högfärgsutgång = 4-läget; minorutgång sköts ovan.
  let wantLevel: number
  let label: string
  if (sp >= 13 && isMajor) {
    wantLevel = 4
    label = `utgång`
  } else if (sp >= 11) {
    wantLevel = partnerSuit.level + 2
    label = `inbjudande hopp`
  } else {
    wantLevel = partnerSuit.level + 1
    label = `enkel höjning`
  }
  // Mot en balansering kapas dessutom vid 3-LÄGET utan äkta utgångsvärden
  // efter rabatten (fix 5a): ett inbjudande hopp över ett 2-läges balansinkliv
  // vore redan utgångsnivån.
  if (balanced && sp < 13) wantLevel = Math.min(wantLevel, 3)
  // En inbjudande/enkel höjning får ALDRIG gå förbi utgång (felrapport #33: en
  // "inbjudande hopp" = level+2 blåste 7♦ över partnerns 5♦). Kapa vid utgångs-
  // nivån (högfärg 4, lågfärg 5). Har partnern REDAN nått utgång och vi bara har
  // inbjudningsvärden (slamvärden sköts ovan via sp≥13-grenarna) → passa i stället
  // för att pressa upp i slam.
  const gameLevel = isMajor ? 4 : 5
  wantLevel = Math.min(wantLevel, gameLevel)
  if (wantLevel < partnerSuit.level + 1) return null

  const legal = legalCalls(history, seat)
  // Sänk till lägsta lagliga höjning om önskenivån inte går (konkurrensen tryckt upp budet).
  for (let level = wantLevel; level >= partnerSuit.level + 1; level--) {
    const bid = `${level}${partnerSuit.strain}` as Bid
    if (legal.includes(bid)) {
      return {
        seat,
        bid,
        explanation: `Stöd för partnerns ${SWE_SYM[partnerSuit.strain]} – ${label} med fit.`,
      }
    }
  }
  return null
}

/**
 * Inget fit för partnern: bjud en egen 4+ färg (billigaste läge) eller en
 * balanserad sang. Bara när partnern redan bjudit (det är VÅR sidas auktion) –
 * vi hittar inte på inkliv från intet här (det hör till §7-försvaret).
 */
function respondWithoutFit(
  deal: Deal,
  history: ResolvedCall[],
  seat: Seat,
  partnerSuit: { strain: string; level: number },
): ResolvedCall | null {
  const hand = deal.hands[seat]
  const points = hcp(hand)
  if (points < 6) return null // för svagt för att svara
  const len = lengths(hand)

  // (1) Egen 4+ färg – välj längst, sedan billigast. Ny färg = inte partnerns,
  // inte motståndarnas, inte en vi redan bjudit.
  const candidates = SUIT_STRAINS.filter((st) => {
    if (st === partnerSuit.strain) return false
    if (opponentsBidStrain(history, seat, st)) return false
    if (history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st)) return false
    return len[SUIT_OF_LETTER[st]] >= 4
  }).sort((a, b) => {
    const byLen = len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]]
    if (byLen !== 0) return byLen
    return SUIT_STRAINS.indexOf(a) - SUIT_STRAINS.indexOf(b) // 4-4: billigast (lägst rang) först
  })
  for (const st of candidates) {
    const bid = cheapestBidIn(history, seat, st)
    if (!bid) continue
    const level = Number(bid[0])
    // 1-läget: ny färg från 6+. 2-läget (måste gå upp): kräver 12+ (2/1-anda). Högre: avstå.
    if (level === 1 && points >= 6) {
      return { seat, bid, explanation: `Egen färg ${SWE_SYM[st]} (4+ kort) – naturligt svar utan stöd för partnern.` }
    }
    if (level === 2 && points >= 12) {
      return { seat, bid, explanation: `Egen färg ${SWE_SYM[st]} på 2-läget – 4+ kort och utgångsvärden.` }
    }
  }

  // (2) Balanserad sang (bara ostört) – nivå efter styrka.
  if (!opponentsHaveBid(history, seat) && isBalanced(hand)) {
    const ntLevel = points >= 13 ? 3 : points >= 11 ? 2 : 1
    const bid = `${ntLevel}NT` as Bid
    if (legalCalls(history, seat).includes(bid)) {
      const range = ntLevel === 1 ? '6–10 hp' : ntLevel === 2 ? '11–12 hp' : '13+ hp'
      return { seat, bid, explanation: `${ntLevel} sang – balanserad hand (${range}), inget stöd för partnern.` }
    }
  }

  return null
}

/**
 * Off-book-svaret (pivotens kärna). Partnern har bjudit men linjen gäller inte:
 * stöd partnerns färg vid fit, annars egen färg/sang. Returnerar null när läget
 * inte är tydligt nog – då passar boten (som förut).
 */
function offBookResponse(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  // Respektera partnerns AVSLUT: står partnerns eget utgångsbud (3NT/4M/5m+)
  // obestritt ska vi inte hitta på en "höjning"/flykt till en annan strain —
  // 5♣-ryckaren (fel färg-spåret fix 1) drog partnerns 3NT till 5♣. Slamsvar
  // (essfrågor m.m.) ligger i egna detektorer FÖRE denna och berörs inte.
  if (partnerGameBidStandsUnopposed(history, seat)) return null
  const partnerSuit = partnerLastSuit(history, seat)
  if (!partnerSuit) return null // partnern har inte visat en färg → vi hittar inte på något
  return raiseWithFit(deal, history, seat, partnerSuit) ?? respondWithoutFit(deal, history, seat, partnerSuit)
}

/** Är partnerns SENASTE kontraktsbud utgång eller högre, utan att någon motståndare bjudit över det? */
function partnerGameBidStandsUnopposed(history: ResolvedCall[], seat: Seat): boolean {
  let partnerGameAt = -1
  for (const [idx, c] of history.entries()) {
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    const trickScore = cb.level * (cb.strain === 'C' || cb.strain === 'D' ? 20 : 30) + (cb.strain === 'NT' ? 10 : 0)
    partnerGameAt = trickScore >= 100 ? idx : -1 // senaste budet räknas
  }
  if (partnerGameAt < 0) return false
  return !history.some((c, idx) => idx > partnerGameAt && side(c.seat) !== side(seat) && parseContractBid(c.bid))
}

// ---- Auktionstillstånd: "är vi i krav?" (grunden bakom "krav får aldrig passas") ----
//
// Off-book-lagret hade förut inget minne av auktionens tillstånd: varje bud
// avgjordes från den egna handens poäng, och säkert standardval var pass. Krav
// låg bara UNDERFÖRSTÅTT i den kanoniska linjen, så varje ny kravsituation
// krävde en egen detektor (en per felrapport). `auctionForce` läser i stället
// kravet direkt ur de SPELADE buden, så "passa aldrig ett krav" blir EN regel.

/** Rang inom en färg (C<D<H<S) – skiljer ett 2/1 från ett hoppskift/reverse. */
function strainRank(strain: string): number {
  return SUIT_STRAINS.indexOf(strain as (typeof SUIT_STRAINS)[number])
}

/** Är budet minst utgång (3NT, 4 i högfärg, 5 i lågfärg, eller slam)? */
function isGameOrHigher(bid: Bid): boolean {
  const cb = parseContractBid(bid)
  if (!cb) return false
  if (cb.strain === 'NT') return cb.level >= 3
  if (cb.strain === 'H' || cb.strain === 'S') return cb.level >= 4
  return cb.level >= 5 // lågfärg
}

/**
 * Är VÅR sida i krav just nu (och av vilket slag), läst ur de SPELADE buden?
 * STEG 1 (grunder) täcker bara OSTÖRDA auktioner (motståndarna har inte gjort
 * något kontraktsbud) och tre klassiska krav – annars null:
 *   - 'game':  ett 2-över-1-svar har etablerat utgångskrav och utgång är EJ nådd.
 *   - 'round': ett OBESVARAT rondkrav ligger på bordet och det är vår tur att
 *      svara det – (a) partnerns nya färg (öppnaren måste rebjuda) eller
 *      (b) öppnarens reverse (svararen måste svara).
 * Konkurrens och fler kravtyper (fjärde färg, hoppskift, slamkrav) ligger utanför
 * steg 1 med flit – de täcks redan av egna detektorer eller tas i senare steg.
 */
function auctionForce(history: ResolvedCall[], seat: Seat): { kind: 'round' | 'game' } | null {
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  if (contractBids.length < 2) return null // öppning + minst ett svar krävs
  // Störd budgivning har EGEN kravsemantik (ett inkliv "lånar" utrymme → ett 2/1
  // lovar värden men ej garanterad utgång). Egen gren; koden nedan är OSTÖRT.
  if (contractBids.some((c) => side(c.seat) !== side(seat))) {
    return competitionForce(history, seat, contractBids)
  }

  const opener = contractBids[0].seat
  const open = parseContractBid(contractBids[0].bid)!
  const responderSeat = PARTNER[opener]
  const openerBids = contractBids.filter((c) => c.seat === opener)
  const responderBids = contractBids.filter((c) => c.seat === responderSeat)
  const firstResp = responderBids[0] ? parseContractBid(responderBids[0].bid)! : null

  // Passade svararen INNAN sitt första bud? Då är ett 2/1 inte utgångskrav.
  const responderPassedFirst =
    !!responderBids[0] &&
    history
      .slice(0, history.indexOf(responderBids[0]))
      .some((c) => c.seat === responderSeat && c.bid === 'P')

  const highest = contractBids[contractBids.length - 1]
  const gameReached = isGameOrHigher(highest.bid)

  // ---- Stark 2♣-öppning = utgångskrav (tills utgång nåtts) ----
  // 2♣ är ovillkorligt game-krav: auktionen får aldrig dö i delkontrakt. Enda
  // undantaget (som i standard 2/1): 2♣–2♦–2NT — öppnarens 22–24 balanserade
  // återbud är INBJUDANDE, inte krav, så svararen får passa. `buildAuction`
  // bygger bara ett par bud av 2♣-linjen och lämnar över resten hit; utan denna
  // gren spårades kravet aldrig och ~64 % av alla 2♣ dog under utgång.
  if (open.level === 2 && open.strain === 'C') {
    const openerRebid = openerBids[1] ? parseContractBid(openerBids[1].bid) : null
    const twoNoTrumpRebid = openerRebid?.level === 2 && openerRebid.strain === 'NT'
    if (twoNoTrumpRebid || gameReached) return null // inbjudan (2♦–2NT) eller redan i utgång
    return { kind: 'game' }
  }

  // ---- 2/1 = utgångskrav (gäller tills utgång nåtts, även mitt i sekvensen) ----
  const isTwoOverOne =
    !!firstResp &&
    open.level === 1 && open.strain !== 'NT' &&
    firstResp.level === 2 && firstResp.strain !== 'NT' &&
    strainRank(firstResp.strain) < strainRank(open.strain) &&
    !responderPassedFirst
  if (isTwoOverOne && !gameReached) return { kind: 'game' }

  // ---- Obesvarat rondkrav: bara pass efter vår sidas senaste kontraktsbud ----
  const onlyPassAfter = history
    .slice(history.indexOf(highest) + 1)
    .every((c) => c.bid === 'P')
  if (!onlyPassAfter) return null

  // (a) Partnerns NYA färg → öppnaren måste rebjuda (rondkrav). En färg som
  // ÖPPNAREN redan bjudit är en HÖJNING (ingen ny färg), och ett bud på
  // utgångsnivå lämnar inget rondkrav hängande (fix 6, frö 20261112: svararens
  // 4♥ i öppnarens hjärter lästes som ny färg → öppnaren "tvingades" dra
  // partnerns utgång till 5♦ bet).
  if (seat === opener && highest.seat === responderSeat && !isGameOrHigher(highest.bid as Bid)) {
    const bid = parseContractBid(highest.bid)!
    const responderTimesInSuit = responderBids.filter(
      (c) => parseContractBid(c.bid)!.strain === bid.strain,
    ).length
    const openerBidSuit = openerBids.some((c) => parseContractBid(c.bid)!.strain === bid.strain)
    const isNewSuit =
      bid.strain !== 'NT' && bid.strain !== open.strain && responderTimesInSuit === 1 && !openerBidSuit
    if (isNewSuit) return { kind: 'round' }
  }

  // (b) Öppnarens REVERSE → svararen måste svara (rondkrav).
  if (seat === responderSeat && highest.seat === opener && openerBids.length >= 2 && firstResp?.level === 1) {
    const first = parseContractBid(openerBids[0].bid)!
    const second = parseContractBid(highest.bid)!
    const isReverse =
      second.level === 2 && second.strain !== 'NT' &&
      second.strain !== first.strain &&
      strainRank(second.strain) > strainRank(first.strain)
    if (isReverse) return { kind: 'round' }
  }

  return null
}

/**
 * Är VÅR sida i krav i en STÖRD auktion (motståndarna har klivit in)?
 * Ägarbeslut 2026-07-05: ett inkliv "lånar" utrymme, så ett fritt 2-över-1 lovar
 * värden men INTE garanterad utgång. Därför finns bara RONDKRAV här (aldrig
 * 'game'): partnern får inte passa, men budgivningen får stanna UNDER utgång.
 * Två klassiska krav honoreras — och bara när VÅR sida öppnade:
 *   (a) svararens FRIA nya färg (ej hopp, ej cue i deras färg) → öppnaren måste
 *       rebjuda,
 *   (b) öppnarens REVERSE → svararen måste svara.
 * Allt annat (deras öppning + våra inkliv, sang-öppning, hopp, passad svarare) →
 * null. Störd semantik skiljer sig alltså från ostört: inget game-krav här.
 */
function competitionForce(
  history: ResolvedCall[],
  seat: Seat,
  contractBids: ResolvedCall[],
): { kind: 'round' } | null {
  const first = contractBids[0]
  if (side(first.seat) !== side(seat)) return null // VÅR sida måste ha öppnat
  const open = parseContractBid(first.bid)!
  if (open.strain === 'NT') return null // sang-öppning: annan struktur
  const opener = first.seat
  const responderSeat = PARTNER[opener]

  // Ett OBESVARAT krav: senaste kontraktsbudet är VÅRT och bara pass har följt.
  const highest = contractBids[contractBids.length - 1]
  if (side(highest.seat) !== side(seat)) return null
  const highestIdx = history.indexOf(highest)
  if (history.slice(highestIdx + 1).some((c) => c.bid !== 'P')) return null

  const openerBids = contractBids.filter((c) => c.seat === opener)
  const responderBids = contractBids.filter((c) => c.seat === responderSeat)
  const oppStrains = new Set(
    contractBids
      .filter((c) => side(c.seat) !== side(seat))
      .map((c) => parseContractBid(c.bid)!.strain),
  )
  // Passad svarare skapar inget krav: en ny färg efter en inledande pass är fri
  // men icke-krav (svararen är redan begränsad).
  const responderPassedFirst =
    !!responderBids[0] &&
    history
      .slice(0, history.indexOf(responderBids[0]))
      .some((c) => c.seat === responderSeat && c.bid === 'P')

  // (a) Svararens FRIA nya färg → öppnaren måste rebjuda. UNDANTAG (fix 5b):
  // dubblade svararen tidigare (negativ dubbling) är den senare färgen
  // DUBBLARENS OMBUD — X + egen färg är svagare än att bjuda färgen direkt
  // (invit, ej krav), så öppnaren får passa på minimum (frö 20261179: 2♥ efter
  // X ska stå, inte tvinga fram ett 2♠-rebud).
  const responderDoubledEarlier = history.some(
    (c, i) => i < highestIdx && c.seat === responderSeat && c.bid === 'X',
  )
  if (
    seat === opener && highest.seat === responderSeat && !responderPassedFirst &&
    !responderDoubledEarlier && !isGameOrHigher(highest.bid as Bid) // utgång = inget hängande rondkrav (fix 6)
  ) {
    const bid = parseContractBid(highest.bid)!
    const timesInStrain = responderBids.filter(
      (c) => parseContractBid(c.bid)!.strain === bid.strain,
    ).length
    const isNewSuit =
      bid.strain !== 'NT' &&
      bid.strain !== open.strain &&
      timesInStrain === 1 &&
      !oppStrains.has(bid.strain) && // ett cue i deras färg är en höjning, ej ny färg
      !openerBids.some((c) => parseContractBid(c.bid)!.strain === bid.strain) // öppnarens färg = höjning (fix 6)
    if (isNewSuit && !isJumpBid(history, highestIdx)) return { kind: 'round' }
  }

  // (b) Öppnarens REVERSE → svararen måste svara.
  if (seat === responderSeat && highest.seat === opener && openerBids.length >= 2) {
    const firstOpen = parseContractBid(openerBids[0].bid)!
    const second = parseContractBid(highest.bid)!
    const firstResp = responderBids[0] ? parseContractBid(responderBids[0].bid)! : null
    const isReverse =
      firstResp?.level === 1 &&
      second.level === 2 && second.strain !== 'NT' &&
      second.strain !== firstOpen.strain &&
      second.strain !== firstResp.strain && // öppnarens HÖJNING av svararens färg är ingen reverse (felrapport #55)
      strainRank(second.strain) > strainRank(firstOpen.strain)
    if (isReverse) return { kind: 'round' }
  }

  return null
}

/**
 * Är kontraktsbudet vid `idx` ett HOPP (högre nivå än billigaste möjliga för dess
 * färg givet auktionen dittills)? Ett fritt icke-hopp är entydigt krav; ett hopp
 * i konkurrens kan vara svagt/spärrartat (systemberoende) → honoreras ej som krav.
 */
function isJumpBid(history: ResolvedCall[], idx: number): boolean {
  const cb = parseContractBid(history[idx].bid)
  if (!cb) return false
  let prevLevel = 0
  let prevRank = -1
  for (let i = 0; i < idx; i++) {
    const p = parseContractBid(history[i].bid)
    if (!p) continue
    prevLevel = p.level
    prevRank = p.strain === 'NT' ? SUIT_STRAINS.length : strainRank(p.strain)
  }
  const targetRank = cb.strain === 'NT' ? SUIT_STRAINS.length : strainRank(cb.strain)
  const minLevel = targetRank > prevRank ? prevLevel : prevLevel + 1
  return cb.level > minLevel
}

/**
 * Ett naturligt MINIMIBUD som hedrar ett krav (aldrig pass). Prioritet:
 *   1. rebjud en egen 5+ färg vi redan visat (visar verklig längd),
 *   2. stöd en färg partnern visat (3+ kort), billigast,
 *   3. en ny 4+ färg, billigast (längst, sedan lägst),
 *   4. billigaste sang,
 *   5. sista utväg: billigaste lagliga kontraktsbud (kravet får aldrig brytas).
 */
function forcedMinimumBid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const hand = deal.hands[seat]
  const len = lengths(hand)
  const legal = legalCalls(history, seat)

  // 1) Rebjud egen 5+ färg vi redan bjudit. F5/E2 (frön 20262070/20261885):
  // det KONSTGJORDA 2♣-öppningsbudet räknas aldrig som bjuden klöver, och
  // högfärger går före minorer ("finaste färg" — en äkta 6-korts spader ska
  // rebjudas hellre än att "klövern" spränger 3NT).
  const firstContract = history.find((c) => parseContractBid(c.bid))
  const strong2C = firstContract?.bid === '2C' ? firstContract : null
  const rebidOrder = [...SUIT_STRAINS].sort(
    (a, b) => Number(b === 'H' || b === 'S') - Number(a === 'H' || a === 'S'),
  )
  for (const st of rebidOrder) {
    if (len[SUIT_OF_LETTER[st]] < 5) continue
    if (!history.some((c) => c.seat === seat && c !== strong2C && parseContractBid(c.bid)?.strain === st)) continue
    const bid = cheapestBidIn(history, seat, st)
    if (bid) return {
      seat, bid, rule: 'krav – rebjuder egen färg',
      explanation: `Auktionen är krav – jag får inte passa. Rebjuder min egna ${SWE_SYM[st]} (5+ kort).`,
    }
  }

  // 2) Stöd partnerns visade färg (3+ kort).
  const ps = partnerLastSuit(history, seat)
  if (ps && len[SUIT_OF_LETTER[ps.strain]] >= 3) {
    const bid = cheapestBidIn(history, seat, ps.strain)
    if (bid) return {
      seat, bid, rule: 'krav – stödjer partnern',
      explanation: `Auktionen är krav – jag får inte passa. Stöder partnerns ${SWE_SYM[ps.strain]} (3+ kort).`,
    }
  }

  // 3) En ny 4+ färg (längst först, sedan billigast).
  const newSuits = SUIT_STRAINS
    .filter((st) =>
      len[SUIT_OF_LETTER[st]] >= 4 &&
      !opponentsBidStrain(history, seat, st) &&
      !history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st))
    .sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]] || strainRank(a) - strainRank(b))
  for (const st of newSuits) {
    const bid = cheapestBidIn(history, seat, st)
    if (bid) return {
      seat, bid, rule: 'krav – ny färg',
      explanation: `Auktionen är krav – jag får inte passa. Visar en ny färg (${SWE_SYM[st]}, 4+ kort).`,
    }
  }

  // 4) Billigaste sang.
  const nt = (['1NT', '2NT', '3NT'] as Bid[]).find((b) => legal.includes(b))
  if (nt) return {
    seat, bid: nt, rule: 'krav – sang',
    explanation: `Auktionen är krav – jag får inte passa. Billigaste sang.`,
  }

  // 5) Sista utväg: billigaste lagliga kontraktsbud.
  const anyBid = allContractBids().find((b) => legal.includes(b))
  if (anyBid) return {
    seat, bid: anyBid, rule: 'krav – billigaste bud',
    explanation: `Auktionen är krav – jag får inte passa; billigaste möjliga bud.`,
  }
  return null
}

/**
 * Svararens fortsättning efter att FJÄRDE FÄRG (krav, §6.6) besvarats. Fjärde
 * färg lovar utgångsvärden, så svararen får ALDRIG passa öppnarens svar under
 * utgång (systemrevisorns fynd, frö 20260743: 33 hp dog i 2NT). Placerar utgång:
 * höjde öppnaren min högfärg → 4 i den (fit), annars 3NT (standardresolutionen –
 * alla fyra färger är nämnda och GF-värdena redan lovade). `auctionForce` täcker
 * medvetet inte fjärde färg; detta är dess motsvarighet för just den sekvensen.
 */
function placeGameAfterFourthSuit(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  if (contractBids.some((c) => side(c.seat) !== side(seat))) return null // ostört
  const fourth = [...contractBids].reverse().find((c) => c.seat === seat && c.rule === 'fjärde färg krav')
  if (!fourth) return null // det var JAG som bjöd fjärde färg
  const last = contractBids[contractBids.length - 1]
  if (last.seat !== PARTNER[seat]) return null // partnern (öppnaren) svarade sist
  if (contractBids.indexOf(last) <= contractBids.indexOf(fourth)) return null // svaret kom EFTER mitt bud
  if (history.slice(history.indexOf(last) + 1).some((c) => c.bid !== 'P')) return null // bara pass efter → min tur
  if (isGameOrHigher(last.bid as Bid)) return null // redan i/över utgång

  // Bara MODESTA utgångshänder placeras här. En stark hand (18+) har slamintresse
  // och fortsätter utreda via slam-/beskrivnings­maskineriet (t.ex. felrapport #42:
  // svararen har 21 hp och driver till 6NT — den får inte kapas i 3NT).
  if (hcp(deal.hands[seat]) >= 18) return null

  const legal = legalCalls(history, seat)
  const myFirst = contractBids.find((c) => c.seat === seat)!
  const myStrain = parseContractBid(myFirst.bid)!.strain
  const lastStrain = parseContractBid(last.bid)!.strain
  // Höjde öppnaren MIN första högfärg? → utgång i fiten.
  if ((myStrain === 'H' || myStrain === 'S') && lastStrain === myStrain) {
    const gameBid = `4${myStrain}` as Bid
    if (legal.includes(gameBid)) return {
      seat, bid: gameBid, rule: 'fjärde färg: utgång i fit',
      explanation: `Fjärde färg var krav; partnern höjde min ${SWE_SYM[myStrain]} → utgång ${gameBid}.`,
    }
  }
  if (legal.includes('3NT')) return {
    seat, bid: '3NT', rule: 'fjärde färg: placerar utgång',
    explanation: `Fjärde färg var krav (utgångsvärden); partnern har beskrivit sin hand → placerar 3NT.`,
  }
  return null
}

/**
 * Vakten som binder ihop det: är vår sida i krav och skulle annars passa, tvinga
 * fram ett naturligt minimibud i stället. Placeras SIST i off-book-kedjan (efter
 * offBookResponse) så den bara fångar det som annars blivit ett förbjudet pass.
 */
function honorForce(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  if (!auctionForce(history, seat)) return null
  return forcedMinimumBid(deal, history, seat)
}

/**
 * Svararens svar på öppnarens 2NT-återbud efter 2♣–2♦ (öppnaren visade 22–24
 * balanserad). `auctionForce` släpper kravet där (2NT är inbjudande, inte game),
 * men enkel matte (ägarbeslut 2026-07-07): 22–24 mittemot 3+ hp = utgång
 * (22+3 = 25). Svararen får aldrig passa bort utgångsvärden → 3NT med 3+ hp;
 * 0–2 = pass (null, korrekt: 24 max är under utgång). Full systems-on (Stayman/
 * transfer över 2NT-återbudet) är medvetet uppskjutet – här räcker "nå utgång".
 * Matchar bara den exakta ostörda sekvensen 2♣–2♦–2NT med svararen i tur.
 */
function respondToStrong2NTRebid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  if (contractBids.length !== 3) return null
  if (contractBids.some((c) => side(c.seat) !== side(seat))) return null // ostört
  const [o1, r1, o2] = contractBids
  const opener = o1.seat
  const responder = PARTNER[opener]
  if (seat !== responder) return null
  if (o1.bid !== '2C' || r1.seat !== responder || r1.bid !== '2D' || o2.seat !== opener || o2.bid !== '2NT') return null
  if (history.slice(history.indexOf(o2) + 1).some((c) => c.bid !== 'P')) return null // bara pass efter 2NT
  const p = hcp(deal.hands[seat])
  if (p < 3) return null // 0–2: passa 2NT (under utgång, korrekt)
  return {
    seat, bid: '3NT', rule: '2♣–2♦–2NT: utgång',
    explanation: `Partnern visade 22–24 balanserad; utgångsvärden räcker (22+3 = 25) → 3NT.`,
  }
}

/**
 * Har PARTNERN cue-bjudit motståndarnas färg som en LIMITHÖJNING+ av VÅR
 * öppning, så att jag (öppnaren) måste svara i stället för att passa
 * (felrapport #16)? Ett cue-bud i motståndarnas färg är konstgjort och krav –
 * öppnaren får aldrig lämnas att passa det. Mönstret: VÅR färgöppning, exakt två
 * kontraktsbud från vår sida (öppningen + partnerns cue), partnerns cue ligger i
 * en färg motståndarna bjudit, cuet är senaste kontraktsbudet (bara pass efter),
 * och `seat` är öppnaren. Returnerar den överenskomna färgen (vår öppningsfärg).
 */
function partnerCueRaiseToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { agreedStrain: string; theirStrain: string } | null {
  const open = openingBid(history)
  if (!open || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat) || seat !== open.seat) return null // vår öppning, öppnaren svarar
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null // öppning + partnerns bud
  const cue = ourBids[1]
  const cueStrain = parseContractBid(cue.bid)!.strain
  if (cueStrain === 'NT') return null
  const oppStrains = new Set(
    history
      .filter((c) => side(c.seat) !== side(seat))
      .map((c) => parseContractBid(c.bid)?.strain)
      .filter((st): st is string => !!st),
  )
  if (!oppStrains.has(cueStrain)) return null // cuet måste ligga i motståndarnas färg
  const cueIdx = history.indexOf(cue)
  if (history.slice(cueIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter cuet
  return { agreedStrain: open.strain, theirStrain: cueStrain }
}

/**
 * Har PARTNERN cue-bjudit motståndarnas SVAGA TVÅA som en stark tvåfärgshand
 * (§7.6 "cue (stark tvåfärg)", 15+ 5-5), så att jag (advancern) måste ge
 * preferens i stället för att passa (felrapport #18)? Ett tvåfärgs-cue är krav
 * och får aldrig passas – annars spelas cuet i motståndarnas färg. Mönstret:
 * motståndarnas svaga tvåa (2♦/2♥/2♠, ej 2♣), partnerns bud = 3-i-deras-färg
 * (cuet), det är vår sidas ENDA kontraktsbud och senaste (bara pass efter).
 * Returnerar deras (svaga-tvåa-)färg, annars null.
 */
function partnerWeakTwoCueToAnswer(history: ResolvedCall[], seat: Seat): { theirStrain: string } | null {
  const open = openingBid(history)
  if (!open || open.level !== 2 || open.strain === 'C' || open.strain === 'NT') return null
  if (side(open.seat) === side(seat)) return null // motståndarnas svaga tvåa
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1 || ourBids[0].seat !== PARTNER[seat]) return null
  const cue = ourBids[0]
  const cb = parseContractBid(cue.bid)!
  if (cb.level !== 3 || cb.strain !== open.strain) return null // cue = 3 i deras färg
  const cueIdx = history.indexOf(cue)
  if (history.slice(cueIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter
  return { theirStrain: open.strain }
}

/**
 * Har PARTNERN (advancern) avancerat MITT inkliv med en NY färg, så att jag
 * (inklivaren) ska visa stöd i stället för att passa (felrapport #15)? En ny
 * färg från advancern på 2-läget lovar en verklig 5+ färg, så mina 3-korts stöd
 * = 8-korts fit. Med stöd + lite extra (dummyPoints ≥ 10) höjer jag ETT steg –
 * enkel stödhöjning, ej krav (advancern är redan begränsad till ~8–11, så ett
 * hopp vore fel; ägarbeslut felrapport #15). Ett dött minimuminkliv passar.
 * Mönstret: motståndarna öppnade, vår sida har bjudit exakt två kontraktsbud —
 * MITT naturliga inkliv och partnerns NYA färg (≠ min färg, ≠ deras färg, ≠ NT),
 * och den nya färgen är senaste kontraktsbudet (bara pass efter).
 */
function overcallerRaiseAdvance(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat)) return null // motståndarna öppnade
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2) return null
  const [mine, adv] = ourBids
  if (mine.seat !== seat || adv.seat !== PARTNER[seat]) return null // jag klev in, partnern avancerade
  const mineCb = parseContractBid(mine.bid)!
  const advCb = parseContractBid(adv.bid)!
  if (mineCb.strain === open.strain || mineCb.strain === 'NT') return null // mitt bud var ett naturligt färginkliv, ej cue/1NT
  if (advCb.strain === 'NT' || advCb.strain === mineCb.strain || advCb.strain === open.strain) return null // partnerns bud = NY naturlig färg
  if (advCb.level < 2) return null // ny färg på 2-läget+ (fri budgivning → 5+)
  const advIdx = history.indexOf(adv)
  if (history.slice(advIdx + 1).some((c) => parseContractBid(c.bid))) return null // ingen har bjudit över

  const suit = SUIT_OF_LETTER[advCb.strain]
  if (lengths(deal.hands[seat])[suit] < 3) return null // inget stöd
  if (dummyPoints(deal.hands[seat], suit).dummyPoints < 10) return null // dött minimum → passa
  const bid = `${advCb.level + 1}${advCb.strain}` as Bid
  if (!legalCalls(history, seat).includes(bid)) return null
  return {
    seat, bid, rule: 'stöd åt advancern',
    explanation: `Partnern avancerade mitt inkliv med en ny färg (${SWE_SYM[advCb.strain]}, lovar 5+) och jag har 3+ stöd → enkel höjning som bekräftar fiten (ej krav).`,
  }
}

/**
 * Har MITT inkliv fått en CUE-HÖJNING av partnern (advancern cue-bjöd deras färg =
 * minst limithöjning i min färg), och sedan har motståndarna bjudit VIDARE så att
 * jag (överklivaren) står inför att sälja given (felrapport #47)? `answerCueRaise`/
 * `partnerCueRaiseToAnswer` täcker bara ÖPPNAREN i ett LUGNT läge (bara pass efter
 * cuet); här är budaren överklivaren OCH motståndarna har konkurrerat över cuet, så
 * ingen hanterare fanns → naket pass sålde en klar fit. Mönstret:
 *  - MOTSTÅNDARNA öppnade (deras 1-läges färgöppning),
 *  - vår sida har exakt två kontraktsbud: MITT inkliv (naturlig ny färg, ej deras,
 *    ej NT) + partnerns cue i en av DERAS färger (= höjning av min färg),
 *  - efter cuet har motståndarna bjudit minst ett kontraktsbud, vår sida inget,
 *  - det är min tur.
 * Returnerar min (fit-)färg, annars null.
 */
function overcallCueRaiseContested(
  history: ResolvedCall[],
  seat: Seat,
): { ourStrain: string } | null {
  const open = openingBid(history)
  if (!open || open.strain === 'NT') return null
  if (side(open.seat) === side(seat)) return null // MOTSTÅNDARNA öppnade
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2) return null
  const [mine, cue] = ourBids
  if (mine.seat !== seat || cue.seat !== PARTNER[seat]) return null // JAG klev in, partnern cue-höjde
  const mineCb = parseContractBid(mine.bid)!
  const cueCb = parseContractBid(cue.bid)!
  if (mineCb.strain === 'NT' || mineCb.strain === open.strain) return null // mitt inkliv = naturlig ny färg
  // Partnerns bud = cue i en av MOTSTÅNDARNAS färger (aldrig min egen).
  const oppStrains = new Set(
    history
      .filter((c) => side(c.seat) !== side(seat))
      .map((c) => parseContractBid(c.bid)?.strain)
      .filter((st): st is string => !!st),
  )
  if (cueCb.strain === 'NT' || cueCb.strain === mineCb.strain || !oppStrains.has(cueCb.strain)) return null
  // Efter cuet: motståndarna har bjudit vidare, vår sida ingenting, och det är min tur.
  const cueIdx = history.indexOf(cue)
  const afterCue = history.slice(cueIdx + 1)
  if (!afterCue.some((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid))) return null
  if (afterCue.some((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))) return null
  return { ourStrain: mineCb.strain }
}

/**
 * Överklivaren tävlar efter partnerns cue-höjning när motståndarna bjudit vidare
 * (felrapport #47). Cue-höjningen lovar minst en limithöjning i min färg → vår
 * fit bär oss till minst 3-läget i färgen; jag säljer aldrig ut under den. Med
 * EXTRA (6+ egen svit eller 14+ hp) sätter jag utgång i högfärg, annars tävlar
 * jag billigast i vår färg (men klättrar inte till 4-läget utan utgångsvärden).
 */
function overcallerCompetesAfterCueRaise(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const info = overcallCueRaiseContested(history, seat)
  if (!info) return null
  const strain = info.ourStrain
  const suit = SUIT_OF_LETTER[strain]
  const hand = deal.hands[seat]
  const isMajor = strain === 'H' || strain === 'S'
  const legal = legalCalls(history, seat)
  const cheapest = cheapestBidIn(history, seat, strain)
  if (!cheapest || !legal.includes(cheapest)) return null
  const cheapestLvl = parseContractBid(cheapest)!.level
  const gameLvl = isMajor ? 4 : 5
  const gameBid = `${gameLvl}${strain}` as Bid
  const extra = lengths(hand)[suit] >= 6 || hcp(hand) >= 14
  if (extra && cheapestLvl <= gameLvl && legal.includes(gameBid)) {
    return {
      seat, bid: gameBid, rule: 'överklivaren tävlar (cue-höjning)',
      explanation: `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; med en stark lång svit sätter jag utgång ${gameBid} i stället för att sälja given.`,
    }
  }
  if (cheapestLvl <= 3) {
    return {
      seat, bid: cheapest, rule: 'överklivaren tävlar (cue-höjning)',
      explanation: `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; jag tävlar ${cheapest} i vår fit i stället för att sälja given till motståndarna.`,
    }
  }
  return null
}

// ---- Off-book: motståndarnas riktiga inkliv (§7-försvaret in i budlådan) -----
//
// När den kanoniska linjen inte modellerar motståndarnas konkurrens tystnade de
// förut (passade). Här kliver de in på RIKTIGT via §7-motorn (`overcall`) i
// stället. Två bevisbart korrekta sitsar:
//  - DIREKT: motståndaren öppnade nyss 1 i färg och vår sida har inte sagt något.
//  - BALANSERING (felrapport #5): deras 1-lägesöppning följd av TVÅ pass – fjärde
//    hand får inte passa ut given med ett klart inkliv på handen.
// Inkliv över andra öppningar (1NT, svaga tvåor, hoppöppningar) hör till senare
// utbyggnad.

/**
 * Får `seat` kliva in på riktigt här? Kraven:
 *  - exakt ETT kontraktsbud i historiken så här långt (= öppningen, ingen har
 *    bjudit förut), och det är MOTSTÅNDARSIDANS 1-läges färgöppning,
 *  - budet är auktionens senaste (direkt sits) ELLER följt av exakt två pass
 *    (balanseringssits – utpassningsläget, felrapport #5).
 * Returnerar inklivet (eller X/Michaels/ovanlig 2NT) ur `overcall`, annars null.
 * I balansering skickas `balancing=true` till `overcall` → HP-golven sänks med en
 * kung ("låna en kung", 2026-07-05): partnern är markerad med värden i utpassnings-
 * läget, så inkliv/X/1NT får bjudas ~3 hp lättare än i direkt sits.
 */
function maybeOvercall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  if (openIdx === -1) return null
  const open = history[openIdx]
  if (!openingSuit(open.bid)) return null
  // Endast öppningen får ha bjudits hittills, och den ska vara motståndarnas.
  if (history.filter((c) => parseContractBid(c.bid)).length !== 1) return null
  if (side(open.seat) === side(seat)) return null

  const after = history.slice(openIdx + 1)
  const direct = after.length === 0
  const balancing = after.length === 2 && after.every((c) => c.bid === 'P')
  if (!direct && !balancing) return null

  const res = overcall(deal.hands[seat], open.bid, balancing)
  if (res.call === 'P') return null
  if (!legalCalls(history, seat).includes(res.call as Bid)) return null
  const note = balancing ? ' (balansering – utpassningsläget: lättare krav, "låna en kung")' : ''
  return { seat, bid: res.call as Bid, rule: res.rule, explanation: res.explanation + note }
}

/**
 * Upplysningsdubbling när motståndarna redan bjudit TVÅ 1-lägesfärger (öppning +
 * svar i ny färg), t.ex. 1♦–(P)–1♥ och vi sitter DIREKT över svararen. Ägarregel
 * (2026-07-05): X är fortfarande takeout, men lovar då **4+ 4+ i de två OBJUDNA
 * färgerna** (äkta 4-4 – partnern har bara två färger att välja mellan), 10+ hp.
 * En 5-korts objuden färg inkliver vi hellre (sköts av on-book-linjen), så här
 * krävs exakt 4-4. F6 (C5, 2026-08-08): även den STARKA 17+-enfärgshanden
 * dubblar här (X + egen färg nästa varv, `ownStrongDoubleRebid`) – själva
 * handbedömningen delas med den kanoniska linjen via `takeoutOfResponse`
 * (`overcalls.ts`). null = ingen sådan dubbling.
 */
function maybeTakeoutOfResponse(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  if (contractBids.length !== 2) return null
  const [openBid, respBid] = contractBids
  const ob = parseContractBid(openBid.bid)!
  const rb = parseContractBid(respBid.bid)!
  if (ob.level !== 1 || rb.level !== 1) return null
  const openSuit = SUIT_OF_LETTER[ob.strain]
  const respSuit = SUIT_OF_LETTER[rb.strain]
  if (!openSuit || !respSuit || openSuit === respSuit) return null
  // Båda kontraktsbuden ska vara MOTSTÅNDARNAS (samma sida, ej vår).
  if (side(openBid.seat) === side(seat) || side(openBid.seat) !== side(respBid.seat)) return null
  // Vi sitter direkt över svararen: svararens bud är senaste icke-pass.
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass !== respBid) return null

  const res = takeoutOfResponse(deal.hands[seat], openSuit, respSuit)
  if (res.call === 'P') return null
  if (!legalCalls(history, seat).includes(res.call as Bid)) return null

  return { seat, bid: res.call as Bid, rule: res.rule, explanation: res.explanation }
}

/**
 * Har motståndarna ÖPPNAT och SPÄRRHÖJT till 3-läget (etapp 6 hål 4)? Mönstret:
 * deras färgöppning + partnerns höjning i SAMMA färg till 3-läget (2♠–P–3♠
 * eller 1♣–P–3♣), och vår sida har inte sagt ett ljud. `maybeOvercall` kräver
 * exakt ETT kontraktsbud i historiken, så här stängdes auktionen helt förr —
 * en 21-poängare passade ut 2♦–P–3♦ (frö 20261477). Sitsen är direkt
 * (höjningen är senaste icke-pass) eller balansering (höjningen följd av exakt
 * två pass → "låna en kung"). Höjningar förbi 3-läget (2♠–P–4♠) lämnas
 * medvetet tysta — att väcka på 4-läget lovar mer än §7.6-fönstren har.
 */
function raisedPreemptToDefend(
  history: ResolvedCall[],
  seat: Seat,
): { suit: Suit; balancing: boolean } | null {
  // Vår sida har aldrig gjort något annat än pass.
  if (history.some((c) => side(c.seat) === side(seat) && c.bid !== 'P')) return null
  // Deras aktioner: exakt två kontraktsbud (öppning + höjning i samma färg,
  // höjningen av PARTNERN till 3-läget), inga X/XX.
  const theirs = history.filter((c) => c.bid !== 'P')
  if (theirs.length !== 2) return null
  const open = parseContractBid(theirs[0].bid)
  const raise = parseContractBid(theirs[1].bid)
  if (!open || !raise) return null
  if (theirs[1].seat !== PARTNER[theirs[0].seat]) return null
  const suit = SUIT_OF_LETTER[open.strain]
  if (!suit || open.strain !== raise.strain || raise.level !== 3) return null
  // Sits: direkt över höjningen, eller balansering efter exakt två pass.
  const after = history.slice(history.indexOf(theirs[1]) + 1)
  if (after.length !== 0 && after.length !== 2) return null
  return { suit, balancing: after.length === 2 }
}

/**
 * Får `seat` STRAFFDUBBLA här (ägarbeslut 2026-07-04, poängarbetet)? Kraven —
 * medvetet stränga, så X:et aldrig kan förväxlas med en konventionell dubbling:
 *  - senaste icke-pass är motståndarnas FÄRGKONTRAKT på 3-läget eller högre
 *    (låga delkontrakt straffdubblas inte – för lite att vinna, X kan ge dem
 *    utgång; NT-kontrakt dubblas inte här),
 *  - vår sida har gjort MINST TVÅ kontraktsbud: då kan partnern omöjligt läsa
 *    X:et som upplysning/negativt/tvåfärgssvar (alla de detektorerna kräver
 *    max ett kontraktsbud från vår sida) – X:et står som straff,
 *  - handen håller `penaltyDouble`-kraven (2+ säkra trumfstick + 10+ hp).
 */
function maybePenaltyDouble(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  const cb = parseContractBid(lastNonPass.bid)
  if (!cb || cb.strain === 'NT' || cb.level < 3) return null

  const ourContractBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourContractBids.length < 2) return null
  if (!legalCalls(history, seat).includes('X')) return null

  const ans = penaltyDouble(deal.hands[seat], SUIT_OF_LETTER[cb.strain])
  if (!ans) return null
  return { seat, bid: 'X', rule: ans.rule, explanation: ans.explanation }
}

// ---- DONT-fortsättningar mot deras 1NT (§7.5, Fynd #2 delbit 1) -------------

/**
 * Har partnern gjort ett DONT-bud mot motståndarnas 1NT som `seat` (advancern)
 * ska svara på? Mönstret: motståndarnas 1NT-öppning, och partnerns DONT-bud
 * (X / 2♣ / 2♦ / 2♥ / 2♠) är vår sidas ENDA aktion, senaste icke-pass, följt av
 * bara pass. Returnerar partnerns DONT-bud, annars null. (X får aldrig lämnas att
 * passas – det är ett relä; jfr felrapport #7 för tvåfärgsinkliv.)
 */
function partnerDONTToAnswer(history: ResolvedCall[], seat: Seat): string | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  if (!['X', '2C', '2D', '2H', '2S'].includes(lastNonPass.bid)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 1 || ourActions[0] !== lastNonPass) return null
  return lastNonPass.bid
}

/**
 * Står `seat`s egen DONT-X (enfärgshand) och väntar på rättelse? Mönstret:
 * motståndarnas 1NT, vår X, partnerns FORCERADE 2♣-relä, sedan bara pass. X:et
 * lovar en 6+ enfärgshand – vi rättar till den (pass med klöver-enfärg). Utan
 * detta skulle X:et bli spelat som straffdubbling av 1NT.
 */
function ownDONTXToCorrect(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 2) return null
  if (ourActions[0].seat !== seat || ourActions[0].bid !== 'X') return null
  if (ourActions[1].seat !== PARTNER[seat] || ourActions[1].bid !== '2C') return null
  const idx = history.indexOf(ourActions[1])
  if (!history.slice(idx + 1).every((c) => c.bid === 'P')) return null

  const len = lengths(deal.hands[seat])
  const suit = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st]).find((s) => len[s] >= 6)
  if (!suit || suit === 'clubs') {
    return { seat, bid: 'P', rule: 'DONT: pass (klöver)', explanation: 'min DONT-enfärg är ♣ → passa partnerns 2♣-relä.' }
  }
  const bid = cheapestBidIn(history, seat, letterOfSuit(suit))
  if (!bid) return null
  return {
    seat, bid, rule: 'DONT: rättelse',
    explanation: `min DONT-enfärg är ${SWE_SYM[letterOfSuit(suit)]} (6+) → rättar partnerns 2♣-relä till ${prettyBid(bid)}.`,
  }
}

/**
 * Står `seat`s egen DONT-TVÅFÄRGSbud (2♣/2♦ = lägre färg + en högre) och väntar
 * på rättelse efter partnerns pass-eller-rätta-relä? Mönstret: motståndarnas 1NT,
 * vårt 2♣/2♦, partnerns relä ETT steg upp (2♣→2♦ · 2♦→2♥), sedan bara pass.
 * Partnern saknade stöd i den lägre färgen och ber oss visa den HÖGRE – vi rättar
 * dit (felrapport #20). Utan detta skulle relä-budet bli spelat som ett äkta
 * naturligt bud i en misfit.
 */
function ownDONTTwoSuiterToCorrect(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const ourActions = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourActions.length !== 2) return null
  const [mine, relay] = ourActions
  if (mine.seat !== seat) return null
  const relayFor: Record<string, string> = { '2C': '2D', '2D': '2H' } // 2♥/2♠/X hanteras ej här
  const expectRelay = relayFor[mine.bid]
  if (!expectRelay || relay.seat !== PARTNER[seat] || relay.bid !== expectRelay) return null
  const idx = history.indexOf(relay)
  if (!history.slice(idx + 1).every((c) => c.bid === 'P')) return null

  // Min HÖGRE av de två DONT-färgerna (de två längsta i handen; högst rankad).
  const len = lengths(deal.hands[seat])
  const twoLongest = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st])
    .sort((a, b) => len[b] - len[a] || SUIT_STRAINS.indexOf(letterOfSuit(b)) - SUIT_STRAINS.indexOf(letterOfSuit(a)))
    .slice(0, 2)
  const higher = SUIT_STRAINS.indexOf(letterOfSuit(twoLongest[0])) > SUIT_STRAINS.indexOf(letterOfSuit(twoLongest[1]))
    ? twoLongest[0]
    : twoLongest[1]
  const bid = cheapestBidIn(history, seat, letterOfSuit(higher))
  if (!bid) return null
  return {
    seat, bid, rule: 'DONT: rättelse (tvåfärg)',
    explanation: `partnern relä:ade (${prettyBid(relay.bid)}) → visar min högre färg ${SWE_SYM[letterOfSuit(higher)]} → ${prettyBid(bid)}.`,
  }
}

// ---- Motståndaren stör VÅR icke-1-färgs-öppning (§7, Fynd #2 delbit 4) ------

/**
 * Har motståndaren stört VÅRT 1NT med DONT, så att svararen (öppnarens partner)
 * ska svara i stället för att passa? Mönstret: vår 1NT-öppning, motståndarens
 * DONT-bud (X / 2♣–2♠) är senaste icke-pass och vår sida har bara bjudit 1NT.
 * Returnerar deras DONT-bud, annars null. (Skiljer sig från DONT-FÖRSVARET, där
 * 1NT är MOTSTÅNDARNAS öppning – här är 1NT vårt eget.)
 */
function ntInterferenceToAnswer(history: ResolvedCall[], seat: Seat): string | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null // måste vara VÅRT 1NT
  if (seat !== PARTNER[open.seat]) return null // seat = svararen (öppnarens partner)
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // bara 1NT bjudet av oss (svararens FÖRSTA svar)
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  if (!['X', '2C', '2D', '2H', '2S'].includes(lastNonPass.bid)) return null
  return lastNonPass.bid
}

// ---- Öppnarens fortsättning efter partnerns VÄRDE-DUBBEL (felrapport #43) ----
// Läge: vi öppnade 1NT (15–17), motståndaren störde med ett 2-lägesinkliv (DONT),
// partnern (svararen) dubblade = straff/värden (8+ – answerNTInterference). X:et
// har en BRED range (8 upp till 15+), så öppnaren kan inte blint bjuda utgång
// (15+8 = 23 räcker inte). Ägarbeslut 2026-08-04: ett 2NT-RELÄ där öppnaren
// beskriver — VISAR en 5-korts färg om den finns, annars 2NT (förnekar 5-kort) —
// och svararen PLACERAR (pass 8–10 / 3NT 11+). Öppnaren säljer inte given med pass
// (det var det gamla off-book-reservbudet som missade utgången).

/** Öppnarens tur efter partnerns värde-X över deras 2-lägesstörning av vårt 1NT? */
function ntValueDoubleOpenerToAnswer(history: ResolvedCall[], seat: Seat): { theirStrain: string } | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // öppnaren själv
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // vi har bara bjudit 1NT
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null
  // Färgen partnern dubblade = motståndarnas senaste kontraktsbud, ett 2-lägesinkliv.
  let doubled: { level: number; strain: string; call: ResolvedCall } | null = null
  for (let i = history.length - 1; i >= 0; i--) {
    const cb = parseContractBid(history[i].bid)
    if (cb) { doubled = { level: cb.level, strain: cb.strain, call: history[i] }; break }
  }
  if (!doubled || side(doubled.call.seat) === side(seat) || doubled.level !== 2) return null
  // ENBART mot ett DONT-inkliv (konstgjort tvåfärg som de flyr från) beskriver
  // öppnaren mot utgång. Mot ett NATURLIGT inkliv står försvaret/passen kvar
  // (felrapport #39: 2♥X är rätt straff, 3NT går bet) – där firar detektorn inte.
  if (!doubled.call.rule?.startsWith('DONT')) return null
  return { theirStrain: doubled.strain }
}

/** Öppnarens beskrivande svar: 5-korts färg om den finns, annars 2NT (förnekar 5-kort). */
function answerNTValueDoubleOpener(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = ntValueDoubleOpenerToAnswer(history, seat)
  if (!ctx) return null
  const hand = deal.hands[seat]
  const len = lengths(hand)
  const theirSuit = SUIT_OF_LETTER[ctx.theirStrain]
  // Egen 5-korts färg (högst rankad, ej deras) → visa den naturligt.
  let five: Suit | null = null
  for (const s of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
    if (s !== theirSuit && len[s] >= 5) { five = s; break }
  }
  if (five) {
    const bid = cheapestBidIn(history, seat, letterOfSuit(five))
    if (bid) {
      return {
        seat, bid, rule: 'öppnarens svar på värde-X',
        explanation: `5+ ${SWE_SYM[letterOfSuit(five)]} → ${prettyBid(bid)} (visar färgen; 2NT hade förnekat 5-kort).`,
      }
    }
  }
  const nt = '2NT' as Bid
  if (!legalCalls(history, seat).includes(nt)) return null
  return {
    seat, bid: nt, rule: 'öppnarens svar på värde-X',
    explanation: 'balanserad 15–17 utan 5+ färg → 2NT (förnekar 5+; partnern placerar: pass 8–10, 3NT 11+).',
  }
}

/** Dubblarens (svararens) tur efter att öppnaren beskrivit med 2NT eller en 5-korts färg? */
function ntValueDoubleDoublerToAnswer(history: ResolvedCall[], seat: Seat): { openerBid: string } | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat) || seat !== PARTNER[open.seat]) return null // dubblaren
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2) return null // 1NT + öppnarens beskrivande bud
  const myLastNonPass = [...history.filter((c) => c.seat === seat)].reverse().find((c) => c.bid !== 'P')
  if (!myLastNonPass || myLastNonPass.bid !== 'X') return null // jag dubblade
  const openerBids = history.filter((c) => c.seat === open.seat && parseContractBid(c.bid))
  if (openerBids.length !== 2) return null
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== open.seat) return null // öppnarens svar är senast (LHO passade)
  return { openerBid: openerBids[1].bid }
}

/** Svararen placerar: 3NT med 11+, annars pass; över en visad färg — fit → höj, annars 3NT/pass. */
function answerNTValueDoubleDoubler(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = ntValueDoubleDoublerToAnswer(history, seat)
  if (!ctx) return null
  const hand = deal.hands[seat]
  const p = hcp(hand)
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const strong = p >= 11
  const openerCb = parseContractBid(ctx.openerBid as Bid)
  if (!openerCb) return null

  // Öppnaren visade en 5-korts FÄRG (inte 2NT).
  if (openerCb.strain !== 'NT') {
    const openerSuit = SUIT_OF_LETTER[openerCb.strain]
    const isMajor = openerSuit === 'hearts' || openerSuit === 'spades'
    if (isMajor && len[openerSuit] >= 3) {
      const bid = `${strong ? 4 : 3}${openerCb.strain}` as Bid
      if (legal.includes(bid)) {
        return {
          seat, bid, rule: 'svar på öppnarens värde-X-fortsättning',
          explanation: `3+ stöd i ${SWE_SYM[openerCb.strain]} → ${prettyBid(bid)} (${strong ? 'utgång' : 'inbjudan'}).`,
        }
      }
    }
    if (strong && legal.includes('3NT' as Bid)) {
      return { seat, bid: '3NT', rule: 'svar på öppnarens värde-X-fortsättning', explanation: `Utgångsvärden utan fit → 3NT.` }
    }
    return { seat, bid: 'P', rule: 'pass', explanation: `Inget bättre → pass (${ctx.openerBid} står).` }
  }

  // Öppnaren bjöd 2NT (förnekade 5-kort): placera utgång.
  if (strong && legal.includes('3NT' as Bid)) {
    return { seat, bid: '3NT', rule: 'placerar utgång efter öppnarens 2NT', explanation: `Utgångsvärden mitt emot öppnarens 15–17 → 3NT.` }
  }
  return { seat, bid: 'P', rule: 'pass', explanation: `Minimum (8–10) → pass, 2NT står.` }
}

// ---- Lebensohl efter VÅRT 1NT (§7.5, Lager 1) ------------------------------
// Motståndaren har klivit in NATURELLT över vårt 1NT (rule = 'naturligt inkliv
// (1NT)', modelleras i auction.ts). Svararen spelar Lebensohl; öppnaren fullföljer
// 2NT-reläet med tvunget 3♣. Ett DONT-inkliv saknar den naturliga rule-etiketten
// och faller därför på gamla vägen (answerNTInterference) – diskriminatorn.

/** Motståndarens naturliga inkliv över VÅRT 1NT (färg + budarens plats), annars null. */
function naturalOvercallOf1NT(history: ResolvedCall[], seat: Seat): { suit: Suit; seat: Seat } | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null // måste vara VÅRT 1NT
  const over = history.find((c) => c.rule === 'naturligt inkliv (1NT)' && side(c.seat) !== side(seat))
  if (!over) return null
  const m = /^2([CDHS])$/.exec(over.bid)
  if (!m) return null
  return { suit: SUIT_OF_LETTER[m[1]], seat: over.seat }
}

/** Svararens FÖRSTA Lebensohl-bud (deras naturliga inkliv ligger kvar). */
function lebensohl1NTFirstToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const open = openingBid(history)
  if (!open || seat !== PARTNER[open.seat]) return null // svararen (öppnarens partner)
  const nat = naturalOvercallOf1NT(history, seat)
  if (!nat) return null
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // bara 1NT bjudet av oss
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== nat.seat) return null // deras inkliv är senast
  return nat.suit
}

/** Öppnaren tvingas 3♣ över svararens 2NT-relä. */
function lebensohl1NTRelayComplete(history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || open.seat !== seat) return null // öppnaren själv
  if (!naturalOvercallOf1NT(history, seat)) return null
  const partnerBids = history.filter((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (partnerBids.length === 0 || partnerBids[partnerBids.length - 1].bid !== '2NT') return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // bara 1NT hittills
  if (!legalCalls(history, seat).includes('3C' as Bid)) return null
  return { seat, bid: '3C' as Bid, rule: 'Lebensohl 3♣ (tvunget relä-svar)', explanation: 'partnerns 2NT var Lebensohl-relä → jag måste bjuda 3♣.' }
}

/** Svararens rättelse (pass/ny färg) efter öppnarens tvungna 3♣. */
function lebensohl1NTRebidToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const open = openingBid(history)
  if (!open || seat !== PARTNER[open.seat]) return null
  const nat = naturalOvercallOf1NT(history, seat)
  if (!nat) return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1 || ourBids[0].bid !== '2NT') return null // vi bjöd 2NT
  const openerBids = history.filter((c) => c.seat === open.seat && parseContractBid(c.bid))
  if (openerBids[openerBids.length - 1]?.bid !== '3C') return null // öppnaren svarade 3♣
  return nat.suit
}

/** Öppnarens fortsättning efter svararens DIREKTA 3-läges krav (GF): major-fit → utgång, annars 3NT. */
function lebensohl1NTGFToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const open = openingBid(history)
  if (!open || open.seat !== seat) return null // öppnaren
  if (!naturalOvercallOf1NT(history, seat)) return null
  const partnerBids = history.filter((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (partnerBids.length !== 1) return null
  const m = /^3([CDHS])$/.exec(partnerBids[0].bid) // ett direkt 3-läges färgbud (ej 2NT-relä)
  if (!m) return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // bara 1NT
  return SUIT_OF_LETTER[m[1]]
}

function lebensohl1NTOpenerAnswerGF(hand: Hand, gfSuit: Suit): { call: string; rule: string; explanation: string } {
  const len = lengths(hand)
  const isMajor = gfSuit === 'hearts' || gfSuit === 'spades'
  if (isMajor && len[gfSuit] >= 3) {
    return {
      call: `4${letterOfSuit(gfSuit)}`,
      rule: 'Lebensohl höjer krav till utgång',
      explanation: `Stöd i partnerns ${SWE_SYM[letterOfSuit(gfSuit)]} → 4${SWE_SYM[letterOfSuit(gfSuit)]}.`,
    }
  }
  return { call: '3NT', rule: 'Lebensohl 3NT (öppnaren väljer utgång)', explanation: 'inget bättre än 3NT över partnerns krav.' }
}

/**
 * Har motståndaren stört VÅR svaga tvåa/spärr, så att svararen ska svara?
 * Mönstret: vår öppning är en svag tvåa (2♦/2♥/2♠) eller spärr (3-läget+ i färg),
 * motståndarens störning (X / inkliv) är senaste icke-pass och vår sida har bara
 * bjudit öppningen. Returnerar {ourSuit, ourLevel, theirCall}, annars null.
 */
function ownPreemptInterferenceToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { ourSuit: Suit; ourLevel: number; theirCall: string } | null {
  const open = openingBid(history)
  if (!open) return null
  const ourSuit = SUIT_OF_LETTER[open.strain]
  if (!ourSuit) return null // 1NT/2NT-öppning – hanteras inte här
  const isWeakTwo = open.level === 2 && open.strain !== 'C' // 2♣ = stark, ej svag tvåa
  const isPreempt = open.level >= 3
  if (!isWeakTwo && !isPreempt) return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  if (seat !== PARTNER[open.seat]) return null // seat = svararen (öppnarens partner)
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // bara öppningen bjuden av oss (svararens FÖRSTA svar)
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  if (lastNonPass.bid === 'XX') return null // deras ev. XX besvaras inte här
  return { ourSuit, ourLevel: open.level, theirCall: lastNonPass.bid }
}

/**
 * Case A (Fynd #2 delbit 5): FORTSÄTTNINGEN efter vårt 1NT + partnerns värde-XX.
 * Har motståndaren stört vårt 1NT med DONT och partnern REDUBBLAT (XX = 8+ hp,
 * delbit 4) äger vår sida handen: 1NT (15–17) + XX (8+) = 23+, majoriteten. Flyr
 * de då undan till en färg straffdubblar vi dem – VARJE steg, tills de får spela
 * dubblat. Utan detta passar öppnaren flykten (auktionen dör efter att XX-
 * detektorn svarat en gång). Kraven:
 *  - auktionens öppning är VÅRT 1NT (första kontraktsbud, vår sida, 1NT),
 *  - vår sida har ett XX i historiken (enda vägen dit är värde-XX:et över deras
 *    DONT-X – XX kan inte uppstå på annat sätt efter vårt eget 1NT),
 *  - senaste icke-pass är motståndarnas FÄRGkontraktsbud (deras flykt – DONT
 *    flyr aldrig till NT), och X är lagligt för oss nu.
 * Returnerar deras flyktfärg + nivå, annars null. INGEN handkvalitetsgrind:
 * mönstret garanterar att vi äger balansen, så dubblingen är korrekt oavsett
 * vilken av våra två händer som råkar vara i tur (öppnaren eller XX-svararen).
 */
function runoutAfterOurRedouble(history: ResolvedCall[], seat: Seat): { suit: Suit; level: number } | null {
  const open = openingBid(history)
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null // måste vara VÅRT 1NT
  if (!history.some((c) => side(c.seat) === side(seat) && c.bid === 'XX')) return null
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  const cb = parseContractBid(lastNonPass.bid)
  if (!cb || cb.strain === 'NT') return null // bara deras FÄRGflykt straffdubblas
  if (!legalCalls(history, seat).includes('X')) return null
  return { suit: SUIT_OF_LETTER[cb.strain], level: cb.level }
}

// ---- Bot-hjärnan -----------------------------------------------------------

/**
 * Har den VERKLIGA budföljden lämnat den kanoniska systemlinjen? Den jämförs
 * bud för bud så långt de överlappar; en motsägelse (Syd bjöd något annat än
 * linjen) = off-book. Att historiken bara är LÄNGRE än linjen (de avslutande
 * passen i en färdig auktion) räknas INTE som off-book – men ett RIKTIGT bud
 * bortom linjens slut (t.ex. en balansering där modellen trodde given passades
 * ut, felrapport #5) gör det: då gäller linjen inte längre.
 */
function divergedFromLine(history: ResolvedCall[], line: ResolvedCall[]): boolean {
  const overlap = Math.min(history.length, line.length)
  for (let i = 0; i < overlap; i++) {
    if (history[i].bid !== line[i].bid) return true
  }
  for (let i = line.length; i < history.length; i++) {
    if (history[i].bid !== 'P') return true
  }
  return false
}

/**
 * Vad datorn bjuder på `seat` givet budgivningen så här långt. Bygger parets
 * kanoniska systemlinje med `buildAuction` och spelar upp den bud för bud – men
 * BARA så länge den verkliga budföljden följer linjen. Två lägen lämnar linjen
 * och svarar historiedrivet i stället för att tappa tråden:
 *  1. **Off-book:** Syd har bjudit något annat än linjen (`divergedFromLine`).
 *  2. **Konkurrens:** linjen tog slut men auktionen är fortfarande ÖPPEN
 *     (`built.open`). `buildAuction` modellerar bara EN konkurrensrond, så utan
 *     detta skulle störda auktioner dö ut direkt – nu konkurrerar både partnern
 *     och motståndarna vidare (stöd m. fit / egen färg / pass).
 * Skillnaden mot en FÄRDIG linje (`built.open === false`): där är de extra
 * turerna bara avslutande pass och boten ska passa.
 */
/**
 * Kör mönstret "detektor → svar → laglighetskoll" som annars upprepades för varje
 * konvention: om `detected` är falsy hoppas steget över; annars byggs svaret och
 * returneras bara om budet är lagligt just här (annars null → nästa steg prövas).
 * Så en detektor kan aldrig råka lämna ett olagligt bud, och kedjan i decideCall
 * blir en läsbar, ordnad lista i stället för 17 nästan identiska if-block.
 */
function answered<T>(
  detected: T | null | undefined,
  answer: (d: T) => { call: string; rule?: string; explanation?: string },
  history: ResolvedCall[],
  seat: Seat,
): ResolvedCall | null {
  if (!detected) return null
  const ans = answer(detected)
  const bid = ans.call as Bid
  if (!legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: ans.rule, explanation: ans.explanation }
}

/**
 * Partnerns 3NT efter fullföljd transfer = välj utgång (felrapport #13): 4 i
 * högfärgen med 3-korts stöd, annars pass (3NT står).
 */
function answerTransferGameChoice(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const transferMajor = transferGameChoiceToAnswer(history, seat)
  if (!transferMajor) return null
  const support = lengths(deal.hands[seat])[transferMajor]
  if (support >= 3) {
    const bid = `4${letterOfSuit(transferMajor)}` as Bid
    if (legalCalls(history, seat).includes(bid)) {
      return {
        seat, bid, rule: 'till spel',
        explanation: `partnerns 3NT efter transfern = välj utgång: 3+ stöd i ${SWE_SYM[letterOfSuit(transferMajor)]} → 4 ${SWE_SYM[letterOfSuit(transferMajor)]} (5-3-fiten före sang).`,
      }
    }
  }
  return {
    seat, bid: 'P', rule: 'pass',
    explanation: `partnerns 3NT efter transfern = välj utgång: utan 3-stöd i ${SWE_SYM[letterOfSuit(transferMajor)]} → pass (3NT står).`,
  }
}

/**
 * Fynd #2 delbit 5 (Case A): efter vårt 1NT + partnerns värde-XX äger vår sida
 * handen; straffdubbla motståndarnas flykt undan till en färg – varje steg.
 */
function answerRunout(history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const runout = runoutAfterOurRedouble(history, seat)
  if (!runout) return null
  return {
    seat, bid: 'X', rule: 'straffdubbling (vi äger handen)',
    explanation:
      `Vi öppnade 1NT och partnern redubblade (XX) – vår sida har 23+ och äger handen. ` +
      `Motståndarna flyr till ${runout.level}${SWE_SYM[letterOfSuit(runout.suit)]} → straffdubbling.`,
  }
}

/**
 * Öppnaren svarar partnerns CUE-höjning i motståndarnas färg (felrapport #16):
 * minimum → billigaste återbud i vår färg, maximum (15+ hp) → accepterar utgång.
 */
function answerCueRaise(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const cueRaise = partnerCueRaiseToAnswer(history, seat)
  if (!cueRaise) return null
  const strain = cueRaise.agreedStrain
  const isMajor = strain === 'H' || strain === 'S'
  const signoff = cheapestBidIn(history, seat, strain)
  const gameBid = `${isMajor ? 4 : 5}${strain}` as Bid
  const legal = legalCalls(history, seat)
  // MINORFIT: 3NT (9 stick) är den naturliga utgången, inte 5m (fel färg-spåret
  // fix 3, frön 20260805/20260769). Öppnaren med JÄMN hand + STOPP i deras
  // (cuade) färg föreslår 3NT direkt — oavsett min/max (cue-höjningen driver
  // ändå alltid till utgång; det här väljer den BÄTTRE utgången). Minimi-
  // återgången 3m betyder därmed ärligt "inget stopp/ojämn hand", så cue-
  // bjudarens 5m i fortsättningen blir ett informerat val. Högfärg orörd (4M).
  if (
    !isMajor &&
    isBalanced(deal.hands[seat]) &&
    hasStopper(deal.hands[seat], SUIT_OF_LETTER[cueRaise.theirStrain]) &&
    legal.includes('3NT' as Bid)
  ) {
    return {
      seat, bid: '3NT', rule: 'svar på cue-höjning',
      explanation: `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; jämn hand med stopp i deras ${SWE_SYM[cueRaise.theirStrain]} → 3NT (rätt utgång före 5${SWE_SYM[strain]}).`,
    }
  }
  const acceptGame = hcp(deal.hands[seat]) >= 15 && legal.includes(gameBid)
  const bid = (acceptGame ? gameBid : signoff) as Bid | null
  if (bid && legal.includes(bid)) {
    return {
      seat, bid, rule: 'svar på cue-höjning',
      explanation: acceptGame
        ? `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; jag är maximum → accepterar utgång ${bid}.`
        : `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]} och är krav; med ett minimum återgår jag billigast i vår färg (${prettyBid(bid)}).`,
    }
  }
  return null
}

/**
 * Advancern svarar partnerns TVÅFÄRGS-cue över motståndarnas svaga tvåa
 * (felrapport #18): ge preferens till längsta sidofärg (≠ deras), passa aldrig.
 */
function answerWeakTwoCue(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const wtCue = partnerWeakTwoCueToAnswer(history, seat)
  if (!wtCue) return null
  const len = lengths(deal.hands[seat])
  const sideStrains = SUIT_STRAINS.filter((st) => st !== wtCue.theirStrain)
  // Cuet lovar 5-5 i TVÅ av de tre sidofärgerna — vilka två vet advancern inte.
  // Preferens på längd, men LIKA långa färger avgörs av billigaste nivån (frö
  // 20260733: 3-3 i klöver/hjärter valde förr 4♣ på tre hackor fast 3♥ fanns).
  let best: string | null = null
  let bestBid: Bid | null = null
  const legal = legalCalls(history, seat)
  for (const st of sideStrains) {
    const stBid = cheapestBidIn(history, seat, st)
    if (!stBid || !legal.includes(stBid)) continue
    const cb = parseContractBid(stBid)!
    const better =
      best === null ||
      len[SUIT_OF_LETTER[st]] > len[SUIT_OF_LETTER[best]] ||
      (len[SUIT_OF_LETTER[st]] === len[SUIT_OF_LETTER[best]] &&
        bidValue(cb.level, cb.strain) < bidValue(parseContractBid(bestBid!)!.level, parseContractBid(bestBid!)!.strain))
    if (better) {
      best = st
      bestBid = stBid
    }
  }
  const bid = bestBid
  if (bid && best) {
    return {
      seat, bid, rule: 'svar på tvåfärgs-cue',
      explanation: `Partnerns cue lovar en stark tvåfärgshand (krav) – jag ger preferens till min längsta sidofärg ${SWE_SYM[best]} (${prettyBid(bid)}), passar aldrig cuet.`,
    }
  }
  return null
}

/**
 * Har VÅR 2-över-1-svarare (utgångskrav) fått sin färg HÖJD av öppnaren, så att
 * svararen nu måste placera minst utgång i stället för att passa (felrapport #27)?
 * Ett 2-över-1-svar (ny lägre färg på 2-läget, ostört) är utgångskrav i hela
 * systemet – svararen får ALDRIG passa under utgång. Uppstår off-book när Syd
 * öppnade den svagare handen (motorns linje hade partnern som öppnare), så den
 * on-book-fortsättningen aldrig fyrar. Mönster: motståndarna helt tysta (ostört),
 * VÅR 1-färgsöppning, partnerns svar = ny lägre färg på 2-läget (äkta 2/1),
 * öppnaren höjde den färgen, det är svararens tur (bara pass efter höjningen) och
 * höjningen ligger under utgång. Returnerar den överenskomna färgen, annars null.
 */
function twoOverOneRaiseToAnswer(history: ResolvedCall[], seat: Seat): { strain: string } | null {
  // Ostört: motståndarna får inte ha gjort något kontraktsbud (då gäller ej rent 2/1).
  if (history.some((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid))) return null
  const open = openingBid(history)
  if (!open || open.level !== 1 || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  const opener = open.seat
  const responder = PARTNER[opener]
  if (seat !== responder) return null // svararen (2/1-budaren) själv placerar
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 3) return null
  const [openC, respC, raiseC] = ourBids
  if (openC.seat !== opener || respC.seat !== responder || raiseC.seat !== opener) return null
  const rb = parseContractBid(respC.bid)!
  // Äkta 2/1: ny färg (≠ öppningsfärgen), 2-läget, LÄGRE rang än öppningen.
  if (rb.strain === 'NT' || rb.level !== 2 || rb.strain === open.strain) return null
  const openRank = SUIT_STRAINS.indexOf(open.strain as (typeof SUIT_STRAINS)[number])
  const respRank = SUIT_STRAINS.indexOf(rb.strain as (typeof SUIT_STRAINS)[number])
  if (openRank < 0 || respRank < 0 || respRank >= openRank) return null
  // Öppnaren HÖJDE svararens färg (samma strain, högre nivå).
  const raiseBid = parseContractBid(raiseC.bid)!
  if (raiseBid.strain !== rb.strain || raiseBid.level <= rb.level) return null
  const raiseIdx = history.indexOf(raiseC)
  if (history.slice(raiseIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter höjningen
  const isMajor = rb.strain === 'H' || rb.strain === 'S'
  const gameLevel = isMajor ? 4 : 5
  if (raiseBid.level >= gameLevel) return null // redan utgång/över → inget att tvinga
  return { strain: rb.strain }
}

/**
 * Svararen sätter utgång efter att öppnaren höjt vår 2/1-färg (felrapport #27):
 * högfärg → 4M; lågfärg → 3NT med stopp i de objudna färgerna, annars 5m.
 * Utgångskravet får aldrig passas.
 */
function answerTwoOverOneRaise(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const info = twoOverOneRaiseToAnswer(history, seat)
  if (!info) return null
  const hand = deal.hands[seat]
  const legal = legalCalls(history, seat)
  const isMajor = info.strain === 'H' || info.strain === 'S'
  if (isMajor) {
    const bid = `4${info.strain}` as Bid
    if (!legal.includes(bid)) return null
    return {
      seat, bid, rule: '2/1 utgångskrav',
      explanation: `Vårt 2-över-1-svar var utgångskrav och partnern höjde min ${SWE_SYM[info.strain]} → jag sätter utgång ${prettyBid(bid)} (pass förbjudet).`,
    }
  }
  // Lågfärgs-2/1: 3NT om vi stoppar de objudna färgerna, annars 5m.
  const open = openingBid(history)!
  const bidStrains = new Set<string>([open.strain, info.strain])
  const unbid = SUIT_STRAINS.filter((st) => !bidStrains.has(st))
  if (unbid.every((st) => hasStopper(hand, SUIT_OF_LETTER[st])) && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: '2/1 utgångskrav',
      explanation: `Vårt 2-över-1 var utgångskrav; med stopp i de objudna färgerna → 3NT (pass förbjudet).`,
    }
  }
  const bid = `5${info.strain}` as Bid
  if (!legal.includes(bid)) return null
  return {
    seat, bid, rule: '2/1 utgångskrav',
    explanation: `Vårt 2-över-1 var utgångskrav och partnern höjde min ${SWE_SYM[info.strain]} → utgång ${prettyBid(bid)} (pass förbjudet).`,
  }
}

/**
 * Har JAG (cue-bjudaren) fått öppnarens svar på min cue-höjning, så att jag måste
 * fullfölja utgångskravet i stället för att passa (felrapport #26)? Ett cue-bud i
 * motståndarnas färg är en limithöjning+ (krav) av partnerns öppning – när
 * öppnaren svarat (t.ex. visat stopp med 3♠) får jag aldrig passa under utgång.
 * `answerCueRaise` sköter ÖPPNARENS svar på cuet; detta är CUE-BJUDARENS svar på
 * öppnarens svar. Mönster: partnern öppnade 1-i-färg, JAG cue-bjöd deras färg,
 * partnern svarade (senaste kontraktsbudet, bara pass efter), och svaret ligger
 * under utgång. Returnerar den överenskomna färgen + deras (cuade) färg.
 */
function cueBidderRebidToAnswer(
  history: ResolvedCall[],
  seat: Seat,
): { agreedStrain: string; theirStrain: string } | null {
  const open = openingBid(history)
  if (!open || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  if (open.seat !== PARTNER[seat]) return null // partnern öppnade, JAG cue-bjöd
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 3) return null
  const [openC, cueC, answerC] = ourBids
  if (openC.seat !== open.seat || cueC.seat !== seat || answerC.seat !== open.seat) return null
  const cb = parseContractBid(cueC.bid)!
  if (cb.strain === 'NT') return null
  // Cuet måste ligga i en färg motståndarna bjudit.
  const theyBidCue = history.some(
    (c) => side(c.seat) !== side(seat) && parseContractBid(c.bid)?.strain === cb.strain,
  )
  if (!theyBidCue) return null
  // Öppnarens svar = senaste kontraktsbudet, bara pass efter.
  const ansIdx = history.indexOf(answerC)
  if (history.slice(ansIdx + 1).some((c) => parseContractBid(c.bid))) return null
  const ans = parseContractBid(answerC.bid)!
  const isMajor = open.strain === 'H' || open.strain === 'S'
  const gameLevel = isMajor ? 4 : 5
  if (ans.strain === 'NT' && ans.level >= 3) return null // redan 3NT (utgång nådd)
  if (bidValue(ans.level, ans.strain) >= bidValue(gameLevel, open.strain)) return null // redan utgång/över
  return { agreedStrain: open.strain, theirStrain: cb.strain }
}

/**
 * Cue-bjudaren fullföljer utgångskravet efter öppnarens svar (felrapport #26):
 * med stopp i motståndarnas färg → 3NT, annars utgång i den överenskomna färgen
 * (4M/5m). Får aldrig passas.
 */
function answerCueBidderRebid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const info = cueBidderRebidToAnswer(history, seat)
  if (!info) return null
  const hand = deal.hands[seat]
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[info.theirStrain]

  // FIX 6 mönster 4: cuet lovar "limithöjning ELLER BÄTTRE" (§7.1). Återgick
  // öppnaren BILLIGAST i vår färg (= minimum) och jag bara har limit-värden
  // (<13 stödpoäng) stannar vi där — kravet var en rond, inte utgång (frö
  // 20260906: 11 hp blåste 5♦ två bet fast 3♦ var taket). Med utgångsvärden
  // drivs som förr.
  const lastContract = [...history].reverse().find((c) => parseContractBid(c.bid))!
  if (parseContractBid(lastContract.bid)!.strain === info.agreedStrain) {
    const sp = dummyPoints(hand, SUIT_OF_LETTER[info.agreedStrain]).dummyPoints
    if (sp < 13) return {
      seat, bid: 'P', rule: 'cue-höjningens fortsättning (limit stannar)',
      explanation: `Min cue lovade limithöjning eller bättre; öppnaren återgick billigast (minimum) och jag har bara limit-värden → pass.`,
    }
  }
  if (hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: 'cue-höjningens fortsättning',
      explanation: `Min cue-höjning var utgångskrav; jag stoppar deras ${SWE_SYM[info.theirStrain]} → 3NT (pass förbjudet).`,
    }
  }
  const isMajor = info.agreedStrain === 'H' || info.agreedStrain === 'S'
  const bid = `${isMajor ? 4 : 5}${info.agreedStrain}` as Bid
  if (!legal.includes(bid)) return null
  return {
    seat, bid, rule: 'cue-höjningens fortsättning',
    explanation: `Min cue-höjning var utgångskrav – utan säkert stopp i deras ${SWE_SYM[info.theirStrain]} sätter jag utgång i vår ${SWE_SYM[info.agreedStrain]} (${prettyBid(bid)}); pass förbjudet.`,
  }
}

/**
 * Öppnarens ROND-2-beslut i det INKLÄMDA konkurrensläget efter partnerns enkla
 * högfärgshöjning (R1 Fynd #2, delbit 6). Mönster: VÅR 1-högfärgsöppning (1♥/1♠),
 * ett inkliv, partnern höjde till 2M (enkel höjning, 6–9), och motståndarna
 * konkurrerade så att ett cue-bud i deras färg skulle hamna ÖVER 3M (inget
 * avböjnings-utrymme under utgång). Då används MAXIMAL DUBBLING: X = game try.
 * Returnerar { major } när mönstret + den inklämda triggern gäller, annars null.
 */
function openerMaximalToAnswer(history: ResolvedCall[], seat: Seat): { major: string } | null {
  const open = openingBid(history)
  if (!open || (open.strain !== 'H' && open.strain !== 'S') || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR öppning, ÖPPNAREN själv svarar
  const M = open.strain
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null // öppning + partnerns höjning
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== M || raise.level !== 2) return null // partnerns ENKLA höjning 2M
  // Motståndarna gjorde det SENASTE kontraktsbudet (de konkurrerade) i en färg.
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  const lastContract = contractBids[contractBids.length - 1]
  if (side(lastContract.seat) === side(seat)) return null
  const theirStrain = parseContractBid(lastContract.bid)!.strain
  if (theirStrain === 'NT' || theirStrain === M) return null
  const lastIdx = history.indexOf(lastContract)
  if (history.slice(lastIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter
  // Inklämt? Cue (billigaste i deras färg) hamnar ÖVER 3M → ingen 3M-avböjning
  // under utgång → X blir game try (annars ligger fallet utanför delbit 6).
  const cue = cheapestBidIn(history, seat, theirStrain)
  const threeM = `3${M}` as Bid
  if (!cue || !legalCalls(history, seat).includes(threeM)) return null
  const cb = parseContractBid(cue)!
  if (bidValue(cb.level, cb.strain) <= bidValue(3, M)) return null // cue under/på 3M → ej inklämt (utanför scope)
  return { major: M }
}

/** Öppnarens val i det inklämda läget: pass / 3M / X (game try) / 4M. */
function openerCompetesAfterRaise(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const m = openerMaximalToAnswer(history, seat)
  if (!m) return null
  const M = m.major
  const hand = deal.hands[seat]
  const suit = SUIT_OF_LETTER[M]
  const bp = pointsWithFloor(hand, suit, 'bergen').points
  const legal = legalCalls(history, seat)
  const game = `4${M}` as Bid
  const threeM = `3${M}` as Bid
  const mSym = SWE_SYM[M]
  // Utgångshand → utgång oavsett partnerns exakta styrka.
  if (bp >= 18 && legal.includes(game)) {
    return {
      seat, bid: game, rule: 'öppnaren bjuder utgång i konkurrens',
      explanation: `Utgångsvärden mittemot partnerns höjning → utgång ${game} i ${mSym}.`,
    }
  }
  // Utgångsintresse (~15–17) → X = game try (maximal dubbling; cue vore utan
  // avböjnings-utrymme). Partnern bjuder 4M med maximum, annars 3M.
  if (bp >= 15 && legal.includes('X')) {
    return {
      seat, bid: 'X', rule: 'maximal dubbling (game try)',
      explanation: `Utgångsintresse mittemot en 6–9-höjning – motståndarnas bud kläm­mer bort cue-budet, så X är game try: partnern bjuder ${game} med ett maximum, annars ${threeM}.`,
    }
  }
  // Minimum men 6:e trumfen (9+ trumf ihop) → konkurrera på lagen om totala stick.
  if (lengths(hand)[suit] >= 6 && legal.includes(threeM)) {
    return {
      seat, bid: threeM, rule: 'öppnaren konkurrerar (6:e trumfen)',
      explanation: `Minimum men 6:e trumfen (9+ trumf ihop) → ${prettyBid(threeM)} på lagen om totala stick (ej krav); säljer inte given billigt.`,
    }
  }
  // Dött minimum → försvara deras kontrakt.
  return {
    seat, bid: 'P', rule: 'öppnaren passar i konkurrens',
    explanation: `Dött minimum mittemot partnerns enkla höjning (6–9) – jag konkurrerar inte utan försvarar deras kontrakt.`,
  }
}

/**
 * Svarar öppnarens MAXIMAL-DUBBLING (delbit 6:s game try). Mönster: VÅR
 * 1-högfärgsöppning, MIN enkla höjning (2M), och ÖPPNARENS X som senaste
 * icke-pass-call. Jag (svararen som höjde) dömer: 4M med ett maximum av höjningen
 * (8+ stödpoäng), annars 3M (avböjer). Returnerar bud, annars null.
 */
function answerOpenerMaximal(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || (open.strain !== 'H' && open.strain !== 'S') || open.level !== 1) return null
  if (open.seat !== PARTNER[seat]) return null // partnern (öppnaren) dubblade; JAG (svararen) svarar
  const M = open.strain
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2) return null // öppning + min höjning (X är inget kontraktsbud)
  if (ourBids[0].seat !== PARTNER[seat] || ourBids[1].seat !== seat) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== M || raise.level !== 2) return null // min ENKLA höjning
  // Öppnarens senaste icke-pass-call = X (game try).
  const lastCall = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastCall || lastCall.seat !== PARTNER[seat] || lastCall.bid !== 'X') return null
  const sp = pointsWithFloor(deal.hands[seat], SUIT_OF_LETTER[M], 'support').points
  const legal = legalCalls(history, seat)
  const game = `4${M}` as Bid
  const decline = cheapestBidIn(history, seat, M) // 3M
  if (sp >= 8 && legal.includes(game)) {
    return {
      seat, bid: game, rule: 'accepterar game-try',
      explanation: `Partnerns X är ett game try (maximal dubbling); jag är maximum av höjningen → accepterar utgång ${game}.`,
    }
  }
  if (decline && legal.includes(decline)) {
    return {
      seat, bid: decline, rule: 'avböjer game-try',
      explanation: `Partnerns X är ett game try; med ett minimum återgår jag till ${decline} (avböjer).`,
    }
  }
  return null
}

/**
 * Höjaren svarar öppnarens 2NT-INBJUDAN efter en minorhöjning i konkurrens
 * (felrapport #30, syskon till openerStrongNTAfterMinorRaise). Mönster: partnern
 * (öppnaren) öppnade 1m, JAG höjde till 2m i konkurrens, öppnaren bjöd 2NT
 * (inbjudan, 18–19). Jag dömer i sang: med ett MAXIMUM av höjningen (8+ hp) →
 * 3NT (utgång), annars pass (stannar i inbjudan). Får inte passas bort tyst av
 * off-book-svaret. Returnerar bud, annars null.
 */
function answerOpenerNTInvite(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || (open.strain !== 'C' && open.strain !== 'D') || open.level !== 1) return null
  if (open.seat !== PARTNER[seat]) return null // partnern (öppnaren) bjöd inbjudan; JAG svarar
  // Vår sida: öppning(partner) + min höjning(jag) + 2NT-inbjudan(partner) = 3 kontraktsbud.
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 3) return null
  if (ourBids[0].seat !== PARTNER[seat] || ourBids[1].seat !== seat || ourBids[2].seat !== PARTNER[seat]) return null
  if (parseContractBid(ourBids[0].bid)!.strain !== open.strain) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== open.strain || raise.level !== 2) return null // min ENKLA minorhöjning
  if (ourBids[2].bid !== '2NT') return null // öppnarens inbjudan
  // Öppnarens SENASTE icke-pass-call måste vara just 2NT-inbjudan (ingen ny konkurrens sedan).
  const lastCall = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastCall || lastCall.seat !== PARTNER[seat] || lastCall.bid !== '2NT') return null
  const p = hcp(deal.hands[seat])
  const legal = legalCalls(history, seat)
  if (p >= 8 && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: 'accepterar sanginbjudan',
      explanation: `Partnerns 2NT är en inbjudan (18–19); med ett maximum av min höjning → 3NT (utgång).`,
    }
  }
  return {
    seat, bid: 'P', rule: 'avböjer sanginbjudan',
    explanation: `Partnerns 2NT är en inbjudan; med ett minimum av min höjning passar jag (stannar i 2NT).`,
  }
}

/**
 * Öppnarens ROND-2 när VÅR MINOR-öppning HÖJTS i en STÖRD auktion och öppnaren
 * har en stark, sangduglig hand (ägarbeslut 2026-07-06, felrapport #30). Mönster:
 * vår 1♣/1♦, en motståndare klev in, partnern HÖJDE vår minor, och det är vår tur
 * igen. Utan detta föll en stark jämn hand igenom till ett tyst naturligt
 * färgbud och blev passad (Väst nådde bara 2♥ med 19 hp). Med HÅLL i motståndarens
 * färg visar öppnaren nu styrkan i sang:
 *   • 20+ hp → 3NT (utgång, spela).
 *   • 18–19 hp → 2NT (inbjudan; partnern höjer till 3NT med maximum av höjningen).
 * Formkrav: jämn hand ELLER en egen 6+ minor (sangduglig). (En jämn 19 med
 * startpoäng ≥20 uppgraderade redan sin ÖPPNING till 2NT, så balanserade händer
 * här är 18–19 utan den kvaliteten samt fördelningshänder.) Systerfallet till
 * delbit 6 (majoröppning, openerCompetesAfterRaise) och openerRondTwoInCompetition
 * (partnern bjöd ny färg). Bara mönstret matchas; annars null.
 */
function openerStrongNTAfterMinorRaise(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || (open.strain !== 'C' && open.strain !== 'D') || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR minoröppning, ÖPPNAREN själv agerar
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  // Vår sida: EXAKT öppning + partnerns höjning av samma minor (öppnaren ej rebjudit).
  const ourBids = contractBids.filter((c) => side(c.seat) === side(seat))
  if (ourBids.length !== 2 || ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== open.strain) return null // partnerns bud måste vara en HÖJNING av vår minor
  // Konkurrens: motståndarna ska ha klivit in med en NATURLIG FÄRG att hålla i.
  const theirBids = contractBids.filter((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid)!.strain !== 'NT')
  if (theirBids.length === 0) return null
  const theirStrain = parseContractBid(theirBids[theirBids.length - 1].bid)!.strain
  const theirSuit = SUIT_OF_LETTER[theirStrain]

  const hand = deal.hands[seat]
  const len = lengths(hand)
  // Sangduglig hand med stopp i deras färg (annars ingen NT-visning här).
  if (!hasStopper(hand, theirSuit)) return null
  if (!isBalanced(hand) && len[SUIT_OF_LETTER[open.strain]] < 6) return null

  const p = hcp(hand)
  const legal = legalCalls(history, seat)
  // 20+ → utgång direkt (spela); 18–19 → 2NT inbjudan (partnern dömer).
  if (p >= 20 && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: 'öppnarens 3NT i konkurrens',
      explanation: `Jämn/sangduglig hand med stopp i ${SWE_SYM[theirStrain]} mittemot partnerns höjning → 3NT (utgång).`,
    }
  }
  if (p >= 18 && legal.includes('2NT' as Bid)) {
    return {
      seat, bid: '2NT', rule: 'öppnarens 2NT-inbjudan i konkurrens',
      explanation: `Jämn hand med stopp i ${SWE_SYM[theirStrain]} – för starkt för ett tyst färgbud → 2NT (inbjudan; partnern bjuder 3NT med ett maximum).`,
    }
  }
  return null
}

/**
 * Öppnarens ROND-2 i en STÖRD auktion när partnern svarat med en FRI NY FÄRG
 * eller 1NT (INTE en höjning) och motståndarna KONKURRERAT över svaret
 * (R1 Fynd #2). Utan detta passade öppnaren bort ÄVEN starka händer så snart
 * motståndarna bjöd om över partnerns fria svar (rondkravet är tekniskt av då –
 * de har lånat utrymme). Systerfallet till delbit 6 (som gällde partnerns
 * HÖJNING); här bjöd partnern en ny färg / 1NT.
 *
 * Ägarbeslut 2026-07-05: visa extra med CUE i deras färg + naturliga hopp;
 * trösklar speglar delbit 6 (15+ = extra, 18+ = utgång, 6:e kortet = tävla).
 * Strykan mäts som Bergenpoäng när det finns en fit (form lyfter), annars ren hp
 * (så en lång svag färg inte blåser upp handen till ett falskt utgångskrav).
 *   - 18+ & högfärgsfit → utgång 4M.
 *   - 18+ & jämn hand med stopp i deras färg → 3NT.
 *   - 15–17 med högfärgsfit → inbjudande hopphöjning (naturligt).
 *   - 15+ i övrigt → CUE i deras färg (game try / utgångskrav – hitta rätt utgång).
 *   - minimum & egen 6+ färg → bjud om den (tävlar, lagen om totala stick).
 *   - minimum & fit → enkel höjning (tävlar).
 *   - annars null → faller igenom till pass.
 * Bara mönstret matchas (senaste kontraktsbudet är motståndarnas); den ostörda
 * rondkravs-varianten (motståndarna passade svaret) sköts av honorForce.
 */
/**
 * Felrapport #55: läget kring partnerns/mitt FRIA BUD (§5.5) — svararens nya
 * färg (ej hopp, ej cue, ej sang) direkt över motståndarnas färginkliv på vår
 * 1-lägesöppning, som svararens första aktion. Sett från `seat` (öppnare eller
 * svarare). `contracts` = auktionens kontraktsbud i ordning (öppning, inkliv,
 * fritt bud, …). null när mönstret inte stämmer.
 */
function freeBidContext(
  history: ResolvedCall[],
  seat: Seat,
): { opener: Seat; responder: Seat; free: { strain: string; level: number }; contracts: ResolvedCall[] } | null {
  const open = openingBid(history)
  if (!open || open.level !== 1 || open.strain === 'NT' || side(open.seat) !== side(seat)) return null
  const contracts = history.filter((c) => parseContractBid(c.bid))
  if (contracts.length < 3) return null
  const [, ov, free] = contracts
  if (side(ov.seat) === side(seat)) return null
  const ovb = parseContractBid(ov.bid)!
  if (ovb.strain === 'NT') return null
  const responder = PARTNER[open.seat]
  if (free.seat !== responder) return null
  const fb = parseContractBid(free.bid)!
  if (fb.strain === 'NT' || fb.strain === open.strain || fb.strain === ovb.strain) return null
  const cheapest = ovb.level + (SUIT_STRAINS.indexOf(fb.strain as 'C') > SUIT_STRAINS.indexOf(ovb.strain as 'C') ? 0 : 1)
  if (fb.level !== cheapest) return null // ett hopp är inget fritt bud
  const responderActions = history.filter((c) => c.seat === responder && c.bid !== 'P')
  if (responderActions[0] !== free) return null // t.ex. X först → inte ett fritt bud
  return { opener: open.seat, responder, free: fb, contracts }
}

/**
 * Felrapport #55 (del 2): ÖPPNAREN höjer partnerns fria HÖGFÄRGSBUD på 3-korts
 * stöd — budet lovar 5+ (den negativa dubblingen tar 4-kortsfallet), så 3+3
 * … 5+3 = fit. Skalan är öppnarens (§5.2, ren hp som on-book-syskonet
 * `openerRebidAfter1LevelResponse`): 12–15 enkel höjning, 16–18 hopphöjning
 * (inbjudan), 19+ utgång. Bara när det fria budet
 * står som senaste kontraktsbud (bjuder de över gäller §5.8-logiken).
 * (Giv 2: 1♦–(1♥)–1♠–P: öppnaren bjöd 2♣ på ♠AJ9 — 2♠ är rätt, spader var hemma.)
 */
function openerRaisesFreeBid(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = freeBidContext(history, seat)
  if (!ctx || ctx.opener !== seat || ctx.contracts.length !== 3) return null
  const freeCall = ctx.contracts[2]
  if (history.slice(history.indexOf(freeCall) + 1).some((c) => c.bid !== 'P')) return null
  const strain = ctx.free.strain
  if (strain !== 'H' && strain !== 'S') return null
  const suit = SUIT_OF_LETTER[strain]
  const hand = deal.hands[seat]
  if (lengths(hand)[suit] < 3) return null
  const tp = hcp(hand)
  const legal = legalCalls(history, seat)
  const simple = cheapestBidIn(history, seat, strain)
  if (!simple) return null
  const simpleLevel = parseContractBid(simple)!.level
  const game = `4${strain}` as Bid
  // Ett fritt bud på 2-LÄGET lovade 10+ (§5.5): 14+ hos öppnaren = 24+ ihop
  // med fit → utgång direkt; 12–13 → enkel höjning (3M, partnern går vidare).
  const gameFloor = ctx.free.level >= 2 ? 14 : 19
  if (tp >= gameFloor && legal.includes(game)) return {
    seat, bid: game, rule: 'höjning av fritt bud (utgång)',
    explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]} (${ctx.free.level >= 2 ? '10+ hp' : '6+ hp'}); 3+ stöd och utgångsvärden → ${prettyBid(game)}.`,
  }
  const jump = `${simpleLevel + 1}${strain}` as Bid
  if (tp >= 16 && simpleLevel + 1 <= 4 && legal.includes(jump)) return {
    seat, bid: jump, rule: 'höjning av fritt bud (inbjudan)',
    explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]}; 3+ stöd och extra (16–18) → hopphöjning ${prettyBid(jump)} (inbjudan).`,
  }
  if (!legal.includes(simple)) return null
  return {
    seat, bid: simple, rule: 'höjning av fritt bud',
    explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]}; 3+ stöd → ${prettyBid(simple)} (enkel höjning, minimum 12–15).`,
  }
}

/**
 * Felrapport #55 (del 3): SVARAREN går vidare när öppnaren höjt det fria
 * högfärgsbudet enkelt (12–15): fiten är känd, så svararen räknar Bergenpoäng
 * (golvade vid hp — längden i den egna trumffärgen räknas): 14+ → utgång 4M,
 * 12–13 → inbjudan 3M, annars pass (null). Bara ostört efter höjningen.
 * (Giv 2: ♠KQ87432 = 8 hp men 7 trumf mot 3 visade → 14 → 4♠; 11 stick fanns.)
 */
function responderAfterFreeBidRaise(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = freeBidContext(history, seat)
  if (!ctx || ctx.responder !== seat || ctx.contracts.length !== 4) return null
  const raise = ctx.contracts[3]
  const rb = parseContractBid(raise.bid)!
  if (raise.seat !== ctx.opener || rb.strain !== ctx.free.strain || rb.level !== ctx.free.level + 1) return null
  if (history.slice(history.indexOf(raise) + 1).some((c) => c.bid !== 'P')) return null
  const strain = ctx.free.strain
  if (strain !== 'H' && strain !== 'S') return null
  const tp = pointsWithFloor(deal.hands[seat], SUIT_OF_LETTER[strain], 'bergen').points
  const legal = legalCalls(history, seat)
  const game = `4${strain}` as Bid
  // Efter ett 2-läges fritt bud (10+) är öppnarens enkla höjning 12–13 →
  // svararen behöver 13+ (Bergen) för utgång, annars pass.
  const gameFloor = ctx.free.level >= 2 ? 13 : 14
  if (tp >= gameFloor && legal.includes(game)) return {
    seat, bid: game, rule: 'utgång efter höjt fritt bud',
    explanation: `Öppnaren höjde min ${SWE_SYM[strain]} (fit); utgångsvärden med fördelning → ${prettyBid(game)}.`,
  }
  const invite = `3${strain}` as Bid
  if (tp >= 12 && rb.level < 3 && legal.includes(invite)) return {
    seat, bid: invite, rule: 'inbjudan efter höjt fritt bud',
    explanation: `Öppnaren höjde min ${SWE_SYM[strain]} (fit); inbjudningsvärden → ${prettyBid(invite)} (inbjudan).`,
  }
  return null
}

/**
 * Felrapport #55 (del 4): ÖPPNAREN svarar på svararens 3M-inbjudan efter sin
 * egen enkla höjning av det fria budet — samma dom som efter en ostörd
 * höjning (`openerThirdBidAfterOwnRaise`: 14+ stödpoäng accepterar).
 */
function openerAnswersFreeBidInvite(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const ctx = freeBidContext(history, seat)
  if (!ctx || ctx.opener !== seat || ctx.contracts.length !== 5) return null
  const [, , , raise, invite] = ctx.contracts
  const rb = parseContractBid(raise.bid)!
  const ib = parseContractBid(invite.bid)!
  const strain = ctx.free.strain
  if (strain !== 'H' && strain !== 'S') return null
  if (raise.seat !== seat || rb.strain !== strain || rb.level !== ctx.free.level + 1) return null
  if (invite.seat !== ctx.responder || ib.strain !== strain || ib.level !== 3) return null
  if (history.slice(history.indexOf(invite) + 1).some((c) => c.bid !== 'P')) return null
  const r = openerThirdBidAfterOwnRaise(deal.hands[seat], SUIT_OF_LETTER[strain] as Major)
  const bid = r.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: r.rule, explanation: r.explanation }
}

function openerRondTwoInCompetition(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR färgöppning, ÖPPNAREN själv agerar
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  // Vår sida ska ha bjudit exakt öppning + partnerns svar (öppnaren har ej rebjudit).
  const ourBids = contractBids.filter((c) => side(c.seat) === side(seat))
  if (ourBids.length !== 2 || ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null
  const resp = parseContractBid(ourBids[1].bid)!

  // Motståndarna ska ha gjort SENASTE kontraktsbudet (konkurrerat) + bara pass efter.
  const last = contractBids[contractBids.length - 1]
  if (side(last.seat) === side(seat)) return null
  const theirStrain = parseContractBid(last.bid)!.strain
  if (theirStrain === 'NT') return null
  const lastIdx = history.indexOf(last)
  if (history.slice(lastIdx + 1).some((c) => c.bid !== 'P')) return null

  // Klassa partnerns svar: en HÖJNING är delbit 6:s (ej detta); annars 1NT eller
  // en FRI ny färg (ej cue i motståndarnas färg).
  if (resp.strain === open.strain) return null // höjning → delbit 6
  let respStrain: string | null = null
  if (resp.strain === 'NT') {
    if (ourBids[1].bid !== '1NT') return null // bara 1NT-svaret (ej 2NT/3NT-hopp)
  } else {
    const oppStrains = new Set(
      contractBids.filter((c) => side(c.seat) !== side(seat)).map((c) => parseContractBid(c.bid)!.strain),
    )
    if (oppStrains.has(resp.strain)) return null // cue i deras färg är ingen ny färg
    respStrain = resp.strain
  }

  const hand = deal.hands[seat]
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[theirStrain]
  const cue = cheapestBidIn(history, seat, theirStrain)

  // Fit i partnerns nya färg? Ett fritt HÖGFÄRGSBUD lovar 5+ (felrapport #55:
  // den negativa dubblingen tar 4-kortsfallet) och ett 2/1-svar lovar 5+ →
  // öppnaren behöver 3; ett fritt 1-läges LÅGFÄRGSBUD lovar 4+ → 4 krävs.
  // Bergen bara med fit; annars ren hp.
  let fitStrain: string | null = null
  const respIsMajor = respStrain === 'H' || respStrain === 'S'
  if (respStrain && len[SUIT_OF_LETTER[respStrain]] >= (resp.level >= 2 || respIsMajor ? 3 : 4)) fitStrain = respStrain
  const tp = fitStrain ? pointsWithFloor(hand, SUIT_OF_LETTER[fitStrain], 'bergen').points : hcp(hand)
  const isMajorFit = fitStrain === 'H' || fitStrain === 'S'

  // --- 18+ utgångshand -------------------------------------------------------
  if (tp >= 18) {
    if (isMajorFit && legal.includes(`4${fitStrain}` as Bid)) return {
      seat, bid: `4${fitStrain}` as Bid, rule: 'öppnaren bjuder utgång i konkurrens',
      explanation: `Utgångsvärden med ${SWE_SYM[fitStrain!]}-fit → utgång 4${SWE_SYM[fitStrain!]}.`,
    }
    if (isBalanced(hand) && hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) return {
      seat, bid: '3NT', rule: 'öppnaren bjuder 3NT i konkurrens',
      explanation: `Jämn hand med stopp i ${SWE_SYM[theirStrain]} → 3NT.`,
    }
    if (cue) return {
      seat, bid: cue, rule: 'öppnarens cue (utgångskrav i konkurrens)',
      explanation: `För starkt för att sälja given: cue i ${SWE_SYM[theirStrain]} = utgångskrav, hjälp mig välja utgång.`,
    }
  }

  // --- 15–17 extra -----------------------------------------------------------
  if (tp >= 15) {
    if (isMajorFit) {
      const simple = cheapestBidIn(history, seat, fitStrain!)
      if (simple) {
        const cb = parseContractBid(simple)!
        const jump = `${cb.level + 1}${fitStrain}` as Bid
        if (legal.includes(jump)) return {
          seat, bid: jump, rule: 'öppnarens inbjudande höjning (konkurrens)',
          explanation: `Inbjudan med ${SWE_SYM[fitStrain!]}-fit → inbjudande hopphöjning ${prettyBid(jump)}.`,
        }
        if (legal.includes(simple)) return {
          seat, bid: simple, rule: 'öppnarens höjning (konkurrens)',
          explanation: `Med ${SWE_SYM[fitStrain!]}-fit → ${simple}.`,
        }
      }
    }
    if (cue) return {
      seat, bid: cue, rule: 'öppnarens cue (extra i konkurrens)',
      explanation: `För bra för ett minimibud: cue i ${SWE_SYM[theirStrain]} visar extra och letar rätt utgång.`,
    }
  }

  // --- Minimum: tävla med egen 6+ färg eller en fit, annars pass (null) -------
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid) return {
      seat, bid: rebid, rule: 'öppnaren tävlar (egen 6+ färg)',
      explanation: `Minimum men 6+ ${SWE_SYM[open.strain]} → ${prettyBid(rebid)} (tävlar på lagen om totala stick, ej krav).`,
    }
  }
  if (fitStrain) {
    const raise = cheapestBidIn(history, seat, fitStrain)
    if (raise) return {
      seat, bid: raise, rule: 'öppnaren tävlar (stödjer partnern)',
      explanation: `Minimum med ${SWE_SYM[fitStrain]}fit → ${prettyBid(raise)} (tävlar).`,
    }
  }
  return null
}

// R1 Fynd #2 (flerronds-konkurrens, del A): öppnarens ROND-2 när partnern PASSAT
// inklivet och motståndarna konkurrerat. Syskonet till openerRondTwoInCompetition
// (som kräver att partnern BJÖD) – här sa partnern INGET, så given föll förut
// igenom och öppnaren sålde den (proben, giv #159). Ägarregel: eftersom partnern
// passade ett inkliv (= sannolikt svag) tävlar öppnaren FÖRSIKTIGT: egen 6+ färg →
// rebjud (lagen om totala stick); 15+ hp + kort (≤2) i deras färg → återöppnings-
// dubbling (takeout, låt partnern välja); annars pass. Aldrig utgång blint mittemot
// en passad partner.
function openerReopensAfterPartnerPass(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR färgöppning, ÖPPNAREN själv agerar
  const contractBids = history.filter((c) => parseContractBid(c.bid))

  // Vår sida ska ha bjudit EXAKT öppningen (partnern passade, öppnaren ej rebjudit).
  const ourBids = contractBids.filter((c) => side(c.seat) === side(seat))
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null

  // Ingen motståndardubbling i bilden – då är det den starka-dubblings-/straff-
  // världen (felrapport #23), INTE en naturlig inklivskonkurrens.
  if (history.some((c) => (c.bid === 'X' || c.bid === 'XX') && side(c.seat) !== side(seat))) return null
  // Motståndarna ska ha gjort MINST två kontraktsbud: LHO-inkliv + RHO-konkurrens
  // (annars är det inte det här mönstret – t.ex. bara ett svar på en dubbling).
  const theirBids = contractBids.filter((c) => side(c.seat) !== side(seat))
  if (theirBids.length < 2) return null

  // Motståndarna ska ha gjort SENASTE kontraktsbudet (konkurrerat) + bara pass efter.
  const last = contractBids[contractBids.length - 1]
  if (side(last.seat) === side(seat)) return null
  const theirStrain = parseContractBid(last.bid)!.strain
  if (theirStrain === 'NT') return null // svårt att döma mot NT här → passa
  // FIX 6 mönster 3: tävla ALDRIG över deras UTGÅNG mittemot en passad partner
  // (frö 20261375: 5♥ på 6-korts färg över deras 4♠ → sex stick, −500; lagen
  // om totala stick gäller delkontraktsnivåer, inte 5-läget på egen hand).
  if (isGameOrHigher(last.bid as Bid)) return null
  const lastIdx = history.indexOf(last)
  if (history.slice(lastIdx + 1).some((c) => c.bid !== 'P')) return null

  const hand = deal.hands[seat]
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[theirStrain]

  // 1) Egen 6+ färg → tävla genom att rebjuda den (lagen om totala stick).
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid && legal.includes(rebid)) return {
      seat, bid: rebid, rule: 'öppnaren tävlar efter partnerns pass (egen 6+ färg)',
      explanation: `Partnern passade inklivet, men 6+ ${SWE_SYM[open.strain]} → ${prettyBid(rebid)} (tävlar på lagen om totala stick, ej krav).`,
    }
  }

  // 2) Extra (15+ hp) + kort i deras färg → återöppningsdubbling (takeout).
  if (hcp(hand) >= 15 && len[theirSuit] <= 2 && legal.includes('X' as Bid)) return {
    seat, bid: 'X', rule: 'öppnarens återöppningsdubbling (partnern passade)',
    explanation: `Kort i ${SWE_SYM[theirStrain]} och för bra för att sälja given → återöppningsdubbling (takeout, välj färg partner).`,
  }

  return null
}

// R1 Fynd #2 (flerronds-konkurrens, del B): öppnarens ÅTERÖPPNING i utpassnings-
// sitsen. Systerfallet till del A – här passade RHO inklivet (1M–(inkliv)–P–P), så
// auktionen DÖR om öppnaren passar. Partnern gjorde ofta en "trap pass" (sitter med
// inkliparens färg bakom sig), och öppnaren sålde given (proben, giv #56 + #552).
// Balanseringssits: partnern är markerad med värden (annars hade motståndarna budat
// vidare) → öppnaren återöppnar villigt när han är KORT i deras färg. Ägarregel: kort
// (≤1) i deras färg → återöppningsdubbling (partnern konverterar ofta till straff);
// egen 6+ färg → rebjud (tävla); 15+ hp → X; annars pass.
function openerReopensBalancing(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR färgöppning, ÖPPNAREN själv agerar
  const contractBids = history.filter((c) => parseContractBid(c.bid))

  // Vår sida ska ha bjudit EXAKT öppningen (partnern passade, öppnaren ej rebjudit).
  const ourBids = contractBids.filter((c) => side(c.seat) === side(seat))
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null

  // Ingen motståndardubbling i bilden (då är det en annan värld – straff/starkt X).
  if (history.some((c) => (c.bid === 'X' || c.bid === 'XX') && side(c.seat) !== side(seat))) return null

  // Motståndarna ska ha gjort EXAKT ETT kontraktsbud: LHO:s inkliv, nu passat runt
  // till öppnaren i utpassningssitsen (RHO passade). Öppnarens LHO = NEXT_SEAT[seat].
  const theirBids = contractBids.filter((c) => side(c.seat) !== side(seat))
  if (theirBids.length !== 1) return null
  const overcall = theirBids[0]
  if (overcall.seat !== NEXT_SEAT[seat]) return null // inklivet ska vara LHO:s
  const theirStrain = parseContractBid(overcall.bid)!.strain
  if (theirStrain === 'NT') return null // svårt att döma mot NT här → passa

  // Utpassningssits: inklivet är sista kontraktsbudet + bara pass efter (öppnaren
  // sitter på utpassningen – passar han dör given).
  const overIdx = history.indexOf(overcall)
  if (history.slice(overIdx + 1).some((c) => c.bid !== 'P')) return null

  const hand = deal.hands[seat]
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[theirStrain]

  // 1) Kort (singel/renons) i deras färg → återöppningsdubbling (takeout).
  //    Partnern har ofta längd/värden i deras färg (trap pass) → konverterar straff.
  if (len[theirSuit] <= 1 && legal.includes('X' as Bid)) return {
    seat, bid: 'X', rule: 'öppnarens återöppningsdubbling (utpassningssits)',
    explanation: `Kort i ${SWE_SYM[theirStrain]} – sälj inte given: återöppningsdubbling (takeout; partnern kan konvertera till straff).`,
  }

  // 2) Egen 6+ färg → tävla genom att rebjuda den.
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid && legal.includes(rebid)) return {
      seat, bid: rebid, rule: 'öppnaren tävlar i utpassningssits (egen 6+ färg)',
      explanation: `6+ ${SWE_SYM[open.strain]} → ${prettyBid(rebid)} (sälj inte given med en 6-korts färg).`,
    }
  }

  // 3) Extra (15+ hp) → återöppningsdubbling även utan kort i deras färg.
  if (hcp(hand) >= 15 && legal.includes('X' as Bid)) return {
    seat, bid: 'X', rule: 'öppnarens återöppningsdubbling (extra, utpassningssits)',
    explanation: `För bra för att sälja given → återöppningsdubbling.`,
  }

  return null
}

// R1 Fynd #2 (flerronds-konkurrens, del C): advancern TÄVLAR upp till fiten på
// 3-läget efter motståndarnas fitvisande höjning. Roten (proben, giv #263): partnern
// klev in 2♥ (bra 6+ färg), motståndarna hittade sin fit (1♠–…–2♠), men advancern med
// 3-korts stöd (= 9-korts fit) PASSADE. Lagen om totala stick: 9 trumf → tävla till
// 3-läget. Skilt från raiseWithFit (som kräver 4-korts stöd för ett 2-läges inkliv och
// hade bjudit 4♥ inbjudande = överbud). Ägarregel: 3-korts stöd + motståndarna har
// hittat sin fit → tävla 3M; genuina utgångsvärden (13+ stödpoäng) → utgång; svag → pass.
/**
 * Felrapport #56: advancerns PREFERENS när inklivaren visat TVÅ färger.
 * Mönstret: motståndarna öppnade; vår sidas enda kontraktsbud är partnerns
 * (naturliga) inkliv och sedan partnerns NYA färg — "välj den som passar bäst";
 * jag har bara passat; partnerns andra färg är senaste kontraktsbudet. Regeln
 * (§7.1): preferens till inklivsfärgen med bättre stöd där, OAVSETT poäng —
 * partnern bad om ett val, inte om styrka. Kostar preferensen ingen nivå
 * (inklivsfärgen rankar över den andra) räcker lika lång eller längre; kostar
 * den en nivå krävs klar skillnad (2+ kort). Aldrig förbi utgång. Bättre stöd i
 * den andra färgen → null (pass/höjning sköts av befintlig logik).
 * (Giv 6: 1♥–1♠–3♥–P–P–4♦–P: Nord passade 4♦ med ♠K9873 ♦T86 — 4♠ var gratis.)
 */
function advancerPrefersOvercallSuit(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat)) return null // motståndarna ska ha öppnat
  if (history.some((c) => c.seat === seat && c.bid !== 'P')) return null // jag har bara passat
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2 || ourBids.some((c) => c.seat !== PARTNER[seat])) return null
  const first = parseContractBid(ourBids[0].bid)!
  const second = parseContractBid(ourBids[1].bid)!
  if (first.strain === 'NT' || second.strain === 'NT' || first.strain === second.strain) return null
  // Båda ska vara naturliga egna färger (en cue i deras färg är ingen färg).
  if (opponentsBidStrain(history, seat, first.strain) || opponentsBidStrain(history, seat, second.strain)) return null
  // Partnerns andra färg står som senaste kontraktsbud (bjuder de över gäller konkurrenslogiken).
  const lastContract = [...history].reverse().find((c) => parseContractBid(c.bid))
  if (lastContract !== ourBids[1]) return null

  const len = lengths(deal.hands[seat])
  const a = SUIT_OF_LETTER[first.strain]
  const b = SUIT_OF_LETTER[second.strain]
  const bid = cheapestBidIn(history, seat, first.strain)
  if (!bid) return null
  const level = parseContractBid(bid)!.level
  const gameLevel = first.strain === 'H' || first.strain === 'S' ? 4 : 5
  if (level > gameLevel) return null // aldrig förbi utgång
  const costsLevel = level > second.level
  const clearlyBetter = costsLevel ? len[a] >= len[b] + 2 : len[a] >= len[b]
  if (!clearlyBetter) return null
  return {
    seat, bid, rule: 'preferens till inklivsfärgen',
    explanation: `Partnern visade ${SWE_SYM[first.strain]} och ${SWE_SYM[second.strain]} och bad mig välja — bättre stöd i ${SWE_SYM[first.strain]} → ${prettyBid(bid)} (preferens, ej krav).`,
  }
}

function advancerCompetesToFit(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat)) return null // motståndarna ska ha ÖPPNAT
  // Motståndarna ska ha KONKURRERAT (öppnat + höjt/bjudit igen = de har hittat sin fit).
  const theirBids = history.filter((c) => parseContractBid(c.bid) && side(c.seat) !== side(seat))
  if (theirBids.length < 2) return null

  const partnerSuit = partnerLastSuit(history, seat)
  if (!partnerSuit) return null
  // Partnern ska ha KLIVIT IN på 2-läget (icke-hopp lovar en bra 6+ färg → 3-korts
  // stöd = 9-korts fit). 1-läges inkliv (5+ lovad) sköts av raiseWithFit (4+ krävs).
  if (partnerSuit.level < 2) return null
  // Ingen upptrappning: vi får inte redan ha bjudit partnerns färg själva.
  if (history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === partnerSuit.strain)) return null

  const hand = deal.hands[seat]
  const suit = SUIT_OF_LETTER[partnerSuit.strain]
  if (lengths(hand)[suit] < 3) return null // 9-korts fit mot ett 2-läges inkliv
  const sp = dummyPoints(hand, suit).dummyPoints
  if (sp < 8) return null // för svag → passa (tävla inte på en bust in i deras kontrakt)

  const legal = legalCalls(history, seat)
  const cheapest = cheapestBidIn(history, seat, partnerSuit.strain)
  if (!cheapest) return null
  const level = parseContractBid(cheapest)!.level
  const isMajor = partnerSuit.strain === 'H' || partnerSuit.strain === 'S'

  // Genuina utgångsvärden (13+ stödpoäng) + högfärg → utgång.
  if (sp >= 13 && isMajor) {
    const game = `4${partnerSuit.strain}` as Bid
    if (legal.includes(game)) return {
      seat, bid: game, rule: 'advancern bjuder utgång med fit (konkurrens)',
      explanation: `Fit i partnerns ${SWE_SYM[partnerSuit.strain]} + utgångsvärden → utgång ${game}.`,
    }
  }
  // Tävla till lagens nivå (9 trumf → 3-läget). Har konkurrensen redan tryckt upp
  // billigaste höjning till 4-läget saknar vi värden att tävla dit → passa.
  if (level <= 3) return {
    seat, bid: cheapest, rule: 'advancern tävlar till fiten (lagen om totala stick)',
    explanation: `Med trumfstöd → ${prettyBid(cheapest)} (tävlar på lagen om totala stick; ej krav).`,
  }
  return null
}

/**
 * FIX 5b (fel färg-spåret, docs/systemrevisorn.md buggfamilj 4): negativ-
 * dubblarens INVIT-FORTSÄTTNING. Mönstret: partnern öppnade 1 i färg, de klev
 * in i färg, jag negativ-dubblade, partnern svarade BILLIGT i färg (tvingat —
 * kan vara ett minimum-nödrebud) och bara pass har följt. Förr passade
 * dubblaren allt under utgångsvärden, så 10–12-handen (invitzonen) lämnade
 * nödrebudet stående (frö 20261354: 2♠ stod fast 5♦ var hemma). Nu, i ordning:
 *   1. invit-preferens: 3+ stöd i partnerns ÖPPNINGSFÄRG → preferens, från
 *      11 hp ett steg upp (frö 20261139: 3♥ före en egen 4-korts spader),
 *   2. egen 5+ färg (en 6-korts räcker redan från 9 hp) → billigast, ej krav
 *      (frö 20261354: 3♦ · frö 20261179: 2♥),
 *   3. jämn hand med stopp i deras färg → 2NT (invit).
 * 13+ (utgångsvärden) och svagare händer lämnas till befintlig logik. Hoppade
 * partnern i svaret (16+) eller har motståndarna bjudit vidare gäller
 * kravlogiken/konkurrensdetektorerna i stället.
 */
function negativeDoublerContinues(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  const answer = parseContractBid(lastNonPass.bid)
  if (!answer || answer.strain === 'NT') return null

  const open = openingBid(history)
  if (!open || open.seat !== PARTNER[seat] || open.level !== 1) return null
  if (!SUIT_OF_LETTER[open.strain]) return null // 1NT-öppning → X:et var inte negativt

  // Mitt enda besked hittills ska vara X:et (den negativa dubblingen).
  const myCalls = history.filter((c) => c.seat === seat && c.bid !== 'P')
  if (myCalls.length !== 1 || myCalls[0].bid !== 'X') return null

  // Vår sida: exakt öppningen + svaret. Deras sida: exakt inklivet (ostört sedan).
  const ourBids = history.filter((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))
  if (ourBids.length !== 2 || ourBids[1] !== lastNonPass) return null
  const theirBids = history.filter((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid))
  if (theirBids.length !== 1) return null
  const theirCb = parseContractBid(theirBids[0].bid)!
  const theirSuit = SUIT_OF_LETTER[theirCb.strain]
  if (!theirSuit) return null

  // Bara partnerns BILLIGA svar (ett HOPP visar 16+ och sköts av kravlogiken).
  let minLevel = 1
  while (bidValue(minLevel, answer.strain) <= bidValue(theirCb.level, theirCb.strain)) minLevel++
  if (answer.level > minLevel) return null

  const hand = deal.hands[seat]
  const p = hcp(hand)
  const len = lengths(hand)
  // Skulle höjningslogiken höja den svarade färgen (fit + tillräckliga stöd-
  // poäng) går den före: detektorn får inte dra en egen sidofärg förbi en
  // höjning (regressionsvakter 20261621/20261351: dubbelton-höjning av rebjuden
  // 1M resp. 5-korts ruterstöd). raiseWithFit är ren → säkert att provfråga.
  if (raiseWithFit(deal, history, seat, answer)) return null
  if (p > 12) return null // utgångsvärden → befintlig kravlogik tar hand om det
  const hasSix = SUIT_STRAINS.some((st) => st !== theirCb.strain && len[SUIT_OF_LETTER[st]] >= 6)
  if (p < 10 && !(p >= 9 && hasSix)) return null // under invitzonen → pass som förr
  const legal = legalCalls(history, seat)

  // 1. Invit-preferens: 3+ stöd i partnerns ÖPPNINGSFÄRG när svaret var en annan.
  if (answer.strain !== open.strain && len[SUIT_OF_LETTER[open.strain]] >= 3) {
    const cheapest = cheapestBidIn(history, seat, open.strain)
    if (cheapest) {
      const lvl = Math.min(Number(cheapest[0]) + (p >= 11 ? 1 : 0), 3)
      const bid = `${lvl}${open.strain}` as Bid
      if (legal.includes(bid)) return {
        seat, bid, rule: 'negativ-dubblarens invit-fortsättning',
        explanation: `3-korts stöd för partnerns öppnade ${SWE_SYM[open.strain]} → ${lvl === Number(cheapest[0]) ? 'preferens' : 'invit-preferens'} ${prettyBid(bid)} (ej krav).`,
      }
    }
  }

  // 2. Egen 5+ färg (9 hp kräver 6+): längsta först, billigast — ej krav.
  const own = SUIT_STRAINS.filter(
    (st) =>
      st !== theirCb.strain && st !== open.strain && st !== answer.strain &&
      len[SUIT_OF_LETTER[st]] >= (p >= 10 ? 5 : 6),
  ).sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]])
  for (const st of own) {
    const bid = cheapestBidIn(history, seat, st)
    if (bid && Number(bid[0]) <= 3 && legal.includes(bid)) return {
      seat, bid, rule: 'negativ-dubblarens invit-fortsättning',
      explanation: `6+ ${SWE_SYM[st]} — rebjuder färgen billigast (invit, ej krav) i stället för att passa partnerns tvingade svar.`,
    }
  }

  // 3. Jämn hand med stopp i deras färg → 2NT (invit).
  if (isBalanced(hand) && hasStopper(hand, theirSuit) && legal.includes('2NT' as Bid)) {
    return {
      seat, bid: '2NT' as Bid, rule: 'negativ-dubblarens invit-fortsättning',
      explanation: `Jämn med stopp i deras ${SWE_SYM[theirCb.strain]} → 2NT (invit, ej krav).`,
    }
  }
  return null
}

// ---- F2: den datadrivna detektorkedjan -------------------------------------
// Kedjan i decideCall var tidigare två listor av anonyma funktioner där
// ordningskraven ("måste ligga FÖRE …") bara fanns i kommentarer. Nu är varje
// detektor DATA med ett unikt `id` och sina före-krav i `before`; kedjevakten
// `detector-chain.test.ts` gör sviten röd om en omflyttning bryter ett krav.
// Själva budlogiken är oförändrad — run-funktionerna är samma anrop som förr.

/** Allt en detektor behöver veta om läget — räknas fram EN gång per beslut. */
export interface DetectorCtx {
  deal: Deal
  history: ResolvedCall[]
  seat: Seat
  /** Egen hand (`deal.hands[seat]`), förberäknad. */
  hand: Hand
}

/** Ett steg i detektorkedjan: namn + ordningskrav + själva logiken. */
export interface LiveDetector {
  /** Unikt namn, normalt = detektorfunktionens namn. Används i före-kraven. */
  id: string
  /** Id:n som måste ligga SENARE i kedjan än den här (vaktas av kedjevakten). */
  before?: readonly string[]
  run: (c: DetectorCtx) => ResolvedCall | null
}

/**
 * §7.6-väckningen över deras öppning + spärrhöjning (etapp 6 hål 4): linjen
 * modellerar bara direktsitsen över själva ÖPPNINGEN, så försvarssidans pass
 * efter höjningen (2♠–P–3♠ / 1♣–P–3♣) ligger INBAKADE i linjen — en
 * 21-poängare passade ut 2♦–P–3♦ (frö 20261477). Prövas därför både som
 * överstyrning av linjens pass (i decideCall) och som tvingande svar bortom
 * en stängd linje (sist i FORCED_DETECTORS).
 */
function defendRaisedPreemptCall(c: DetectorCtx): ResolvedCall | null {
  return answered(raisedPreemptToDefend(c.history, c.seat), (r) => {
    const def = defendPreempt(c.hand, r.suit, 3, r.balancing, true)
    if (def.call === 'P') return def
    return r.balancing
      ? { ...def, explanation: `${def.explanation} (balansering – "låna en kung")` }
      : def
  }, c.history, c.seat)
}

// ---- Tvingande svar (gäller ÄVEN on-book) ----------------------------------
// Linjen gav inget bud för oss här. Vissa lägen är ändå rondkrav: partnern får
// ALDRIG lämnas att passa bort en upplysning/fjärde färg. Prövas i ordning;
// första detektorn som ger ett lagligt bud vinner.
export const FORCED_DETECTORS: readonly LiveDetector[] = [
  // Upplysningsdubbling från partnern (§7): svara, passa aldrig bort den.
  { id: 'takeoutDoubleToAnswer',
    run: (c) => answered(takeoutDoubleToAnswer(c.history, c.seat),
      (t) => answerTakeoutDouble(c.hand, t.suit, t.level, t.bidSuits, t.balancing), c.history, c.seat) },
  // Partnerns STÖDDUBBLING (§7.3, etapp 6 hål 1): svararen svarar alltid
  // (pass bara som medvetet straffpass med trumfstack).
  { id: 'supportDoubleToAnswer',
    run: (c) => answered(supportDoubleToAnswer(c.history, c.seat),
      (s) => answerSupportDouble(c.hand, s.myMajor, s.openerSuit, s.theirBid), c.history, c.seat) },
  // ... och stöddubblarens EGEN fortsättning: väg partnerns inbjudan (15+
  // accepterar), och låt partnerns utgångsbud stå.
  { id: 'supportDoubleFollowUpToAnswer',
    run: (c) => answered(supportDoubleFollowUpToAnswer(c.history, c.seat),
      (f) => supportDoublerRebid(c.hand, f.myOpenedSuit, f.partnerMajor, f.theirSuit, f.partnerAnswer), c.history, c.seat) },
  // De bjuder ÖVER partnerns upplysningsdubbling (§7.3, etapp 6 hål 2):
  // advancern talar fritt med värden/form (XX = tvångsflykt). Ger schemat
  // inget bud faller vi VIDARE (null) så t.ex. straffdubblingen kan pröva.
  { id: 'takeoutDoubleOverbidToAnswer',
    run: (c) => {
      const t = takeoutDoubleOverbidToAnswer(c.history, c.seat)
      if (!t) return null
      const ans = advancerFreeBidAfterDouble(c.hand, t.doubledSuit, t.openLevel, t.theirSuits, t.lastBid)
      return ans ? answered(t, () => ans, c.history, c.seat) : null
    } },
  // ... och advancerns CUE efter min upplysningsdubbling är krav: svara alltid.
  { id: 'advancerCueToAnswer',
    run: (c) => answered(advancerCueToAnswer(c.history, c.seat),
      (a) => doublerAnswersCue(c.hand, a.theirSuits, a.cueBid), c.history, c.seat) },
  // Dubblaren väger höjningen av advancerns färgsvar mot vad svaret VISADE
  // (hopp 9–11, fritt ~6–9, XX-flykt 0+) — före den generella fit-blastern
  // (offBookResponse i konkurrenskedjan, som körs efter denna lista).
  { id: 'doublerRaisesAdvance',
    run: (c) => doublerRaisesAdvance(c.deal, c.history, c.seat) },
  // Partnerns JORDAN 2NT över deras X (§7.3): öppnaren svarar alltid —
  // 3M minimum/avslut, 4M med 15+ stödpoäng (systemfel #4, frö 20260739).
  { id: 'jordanToAnswer',
    run: (c) => answered(jordanToAnswer(c.history, c.seat),
      (j) => openerRebidAfterJordan2NT(c.hand, j.major), c.history, c.seat) },
  // ... och Jordan-bjudaren väger öppnarens 3M-avslut: 13+ höjer till utgång.
  { id: 'jordanSignoffToAnswer',
    run: (c) => answered(jordanSignoffToAnswer(c.history, c.seat),
      (j) => jordanRaiseAfterSignoff(c.hand, j.major), c.history, c.seat) },
  // Partnerns NEGATIVA dubbling (§7.3, rondkrav): öppnaren svarar alltid.
  { id: 'negativeDoubleToAnswer',
    run: (c) => answered(negativeDoubleToAnswer(c.history, c.seat),
      (n) => openerAnswerNegativeDouble(c.hand, n.ourOpen, n.theirCall), c.history, c.seat) },
  // Partnerns FJÄRDE FÄRG (§6.6, utgångskrav): öppnaren svarar alltid.
  { id: 'fourthSuitToAnswer',
    run: (c) => answered(fourthSuitToAnswer(c.history, c.seat),
      (f) => openerAnswerFourthSuit(c.hand, f.opened, f.second, f.responderSuit, f.fourth), c.history, c.seat) },
  // Min EGEN fjärde färg har besvarats — placera utgång, passa aldrig kravet.
  { id: 'placeGameAfterFourthSuit',
    run: (c) => placeGameAfterFourthSuit(c.deal, c.history, c.seat) },
  // Partnerns NEW MINOR FORCING (§5.7, krav): öppnaren svarar alltid.
  { id: 'nmfToAnswer',
    run: (c) => answered(nmfToAnswer(c.history, c.seat),
      (n) => openerAnswerNMF(c.hand, n.opened, n.responderMajor, n.nmfMinor, n.unbidSuit), c.history, c.seat) },
  // §7.6-väckningen över deras spärrhöjning (etapp 6 hål 4) — täcker
  // balanseringssitsen när linjen är STÄNGD (built.open === false) och
  // konkurrenskedjan därför aldrig nås. Pass faller vidare (null).
  { id: 'defendRaisedPreempt',
    run: (c) => {
      const wake = defendRaisedPreemptCall(c)
      return wake && wake.bid !== 'P' ? wake : null
    } },
]

// ---- Historiedrivna svar när linjen inte styr längre -----------------------
// Off-book (Syd bjöd eget) eller en öppen konkurrensauktion som linjen bara
// modellerat en rond av. ORDNINGEN ÄR BETYDELSEFULL: flera steg måste ligga
// FÖRE det generella off-book-svaret näst sist (annars läser det ett konstgjort
// relä/cue som en naturlig färg och stöder/passar fel). Ordningskraven står som
// DATA i `before` och vaktas av kedjevakten — en ny konvention läggs på rätt
// plats i listan MED sina före-krav ifyllda, inte sist av bekvämlighet.
export const CONTESTED_DETECTORS: readonly LiveDetector[] = [
  // Motståndarna kliver in på riktigt (direkt sits eller balansering).
  { id: 'maybeOvercall',
    run: (c) => maybeOvercall(c.deal, c.history, c.seat) },
  // Upplysningsdubbling när de bjudit TVÅ 1-lägesfärger (1♦–P–1♥–X): 4-4 i de
  // objudna färgerna (eller 17+ stark enfärgshand). Ägarregel 2026-07-05.
  { id: 'maybeTakeoutOfResponse',
    run: (c) => maybeTakeoutOfResponse(c.deal, c.history, c.seat) },
  // Partnerns DONT-bud mot deras 1NT besvaras (§7.5, Fynd #2 delbit 1) …
  { id: 'partnerDONTToAnswer',
    run: (c) => answered(partnerDONTToAnswer(c.history, c.seat),
      (d) => advanceDONT(c.hand, d), c.history, c.seat) },
  // … och vår egen DONT-X rättas till sin riktiga färg efter partnerns relä.
  { id: 'ownDONTXToCorrect',
    run: (c) => ownDONTXToCorrect(c.deal, c.history, c.seat) },
  // … och vårt egna DONT-tvåfärgsbud (2♣/2♦) rättas till den högre färgen när
  // partnern relä:at pass-eller-rätta (felrapport #20).
  { id: 'ownDONTTwoSuiterToCorrect',
    run: (c) => ownDONTTwoSuiterToCorrect(c.deal, c.history, c.seat) },
  // Partnerns TVÅFÄRGSINKLIV (Michaels/ovanlig 2NT, §7.2): preferens via
  // advanceTwoSuiter; även advancerns medvetna pass (felrapport #7).
  { id: 'partnerTwoSuiterToAnswer',
    run: (c) => answered(partnerTwoSuiterToAnswer(c.history, c.seat),
      (t) => advanceTwoSuiter(c.hand, t.partnerCall, t.theirSuit, t.contested), c.history, c.seat) },
  // Ett EGET dubblat tvåfärgsinkliv får aldrig passas ut (felrapport #7):
  // konstgjort – utan preferens flyr vi till den längsta visade färgen.
  { id: 'ownDoubledTwoSuiterRescue',
    run: (c) => ownDoubledTwoSuiterRescue(c.deal, c.history, c.seat) },
  // Vår egen 17+ upplysningsdubbling får sitt starka återbud (felrapport #23):
  // vi bjuder egen färg (billigast, rondkrav) för att visa den starka enfärgshanden.
  { id: 'ownStrongDoubleRebid',
    run: (c) => ownStrongDoubleRebid(c.deal, c.history, c.seat) },
  // Den starka dubblingens FORTSÄTTNING (ägarbeslut 2026-07-05): advancern
  // svarar återbudet (Part 2), dubblaren dömer game (Part 3), advancern svarar
  // 3-hoppet (Part 4). Måste ligga FÖRE off-book-svaret så tvångssvaren inte
  // passas ut. Ordningen sinsemellan spelar ingen roll (ömsesidigt uteslutande).
  { id: 'advanceStrongDoubleRebid', before: ['offBookResponse'],
    run: (c) => advanceStrongDoubleRebid(c.deal, c.history, c.seat) },
  { id: 'strongDoublerSecondRebid', before: ['offBookResponse'],
    run: (c) => strongDoublerSecondRebid(c.deal, c.history, c.seat) },
  { id: 'answerStrongDoubleGameForce', before: ['offBookResponse'],
    run: (c) => answerStrongDoubleGameForce(c.deal, c.history, c.seat) },
  // Etapp 7 hål 2 ("3NT-stoppen"): öppnaren trevar 4NT efter svararens 3NT,
  // och svararen accepterar/avböjer. Måste ligga FÖRE rkcToAnswer så den
  // kvantitativa 4NT:n (ingen trumf agreed) inte läses som essfråga, och
  // FÖRE off-book-svaret som annars passar bort trevaren.
  { id: 'openerTriesSlamAfter3NT', before: ['rkcToAnswer', 'offBookResponse'],
    run: (c) => openerTriesSlamAfter3NT(c.deal, c.history, c.seat) },
  { id: 'openerSlamTryToAnswer', before: ['rkcToAnswer', 'offBookResponse'],
    run: (c) => answered(openerSlamTryToAnswer(c.history, c.seat),
      (s) => answerOpenerSlamTry(c.hand, s.minor), c.history, c.seat) },
  // Partnerns 4NT med trumf = ESSFRÅGAN (1430 RKC, §6.1); 5NT = kungfrågan
  // (Sjöberg, §6.3). Får aldrig passas (felrapport #9).
  { id: 'rkcToAnswer',
    run: (c) => answered(rkcToAnswer(c.history, c.seat),
      (trump) => respondToRKC(c.hand, trump), c.history, c.seat) },
  { id: 'kingAskToAnswer',
    run: (c) => answered(kingAskToAnswer(c.history, c.seat),
      (trump) => respondToKingAsk(c.hand, trump), c.history, c.seat) },
  // Öppnarens rond-2 i det INKLÄMDA konkurrensläget + partnerns svar på
  // maximal-dubblingen (R1 Fynd #2 delbit 6). Måste ligga FÖRE
  // maybePenaltyDouble: i det inklämda läget är X reserverat för game try
  // (maximal dubbling) – vi ger medvetet upp straffdubblingen där. Bara det
  // specifika mönstret matchas; annars faller det igenom orört.
  { id: 'answerOpenerMaximal', before: ['maybePenaltyDouble'],
    run: (c) => answerOpenerMaximal(c.deal, c.history, c.seat) },
  { id: 'openerCompetesAfterRaise', before: ['maybePenaltyDouble'],
    run: (c) => openerCompetesAfterRaise(c.deal, c.history, c.seat) },
  // Öppnarens rond-2 när VÅR MINOR höjts i konkurrens och öppnaren har en
  // stark sangduglig hand (felrapport #30): visa styrkan i sang (3NT med 20+,
  // 2NT-inbjudan med 18–19) i stället för ett tyst färgbud som passas ut.
  { id: 'openerStrongNTAfterMinorRaise',
    before: ['openerRondTwoInCompetition', 'maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerStrongNTAfterMinorRaise(c.deal, c.history, c.seat) },
  // Höjaren svarar öppnarens 2NT-inbjudan (felrapport #30): accepterar 3NT
  // med ett maximum, annars pass. FÖRE off-book-svaret (som annars passar).
  { id: 'answerOpenerNTInvite', before: ['offBookResponse'],
    run: (c) => answerOpenerNTInvite(c.deal, c.history, c.seat) },
  // Systerfallet: öppnarens rond-2 i konkurrens när partnern bjöd NY FÄRG /
  // 1NT (ej höjning) och motståndarna konkurrerat (R1 Fynd #2). Extra visas
  // med cue i deras färg + naturliga hopp; minimum tävlar med 6+ färg/fit.
  // FÖRE maybePenaltyDouble (extra → cue, inte straffdubbling), FÖRE
  // off-book-svaret (som annars säljer given genom att passa) och FÖRE
  // reopen-varianterna nedan (som kräver att partnern INTE bjöd).
  // Felrapport #55: partnerns FRIA högfärgsbud (5+) — öppnaren höjer på 3-korts
  // stöd, svararen går vidare, öppnaren dömer inviten. Måste ligga FÖRE
  // off-book-svaret (som kräver 4-korts stöd och därför bjöd 2♣ på ♠AJ9).
  { id: 'openerRaisesFreeBid', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerRaisesFreeBid(c.deal, c.history, c.seat) },
  { id: 'responderAfterFreeBidRaise', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => responderAfterFreeBidRaise(c.deal, c.history, c.seat) },
  { id: 'openerAnswersFreeBidInvite', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerAnswersFreeBidInvite(c.deal, c.history, c.seat) },
  { id: 'openerRondTwoInCompetition',
    before: ['openerReopensAfterPartnerPass', 'maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerRondTwoInCompetition(c.deal, c.history, c.seat) },
  // Del A (flerronds): samma rond-2 MEN partnern PASSADE inklivet (sa inget).
  // Öppnaren tävlar försiktigt (egen 6+ färg / återöppnings-X) i stället för
  // att sälja given.
  { id: 'openerReopensAfterPartnerPass', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerReopensAfterPartnerPass(c.deal, c.history, c.seat) },
  // Del B (flerronds): samma men RHO PASSADE inklivet (1M–(inkliv)–P–P) →
  // öppnaren sitter på utpassningen. Återöppnar (X med kort i deras färg /
  // egen 6+ färg) i stället för att sälja given. Partnern gör ofta trap pass.
  { id: 'openerReopensBalancing',
    run: (c) => openerReopensBalancing(c.deal, c.history, c.seat) },
  // Straffdubbla motståndarnas höga färgkontrakt när handen sätter det
  // (poängarbetet 2026-07-04): 2+ säkra trumfstick + 10+ hp.
  { id: 'maybePenaltyDouble',
    run: (c) => maybePenaltyDouble(c.deal, c.history, c.seat) },
  // Partnerns 3NT efter fullföljd transfer = VÄLJ UTGÅNG (felrapport #13).
  // Måste ligga FÖRE off-book-svaret (som annars stöder transferns relä).
  { id: 'answerTransferGameChoice', before: ['offBookResponse'],
    run: (c) => answerTransferGameChoice(c.deal, c.history, c.seat) },
  // Fynd #2 delbit 5 (Case A): efter vårt 1NT + partnerns värde-XX äger vi
  // handen – straffdubbla flykten. Måste ligga FÖRE delbit 4-detektorerna
  // (ntInterference) och off-book-svaret.
  { id: 'answerRunout', before: ['ntInterferenceToAnswer', 'offBookResponse'],
    run: (c) => answerRunout(c.history, c.seat) },
  // Lebensohl efter VÅRT 1NT (§7.5): motståndaren klev in NATURELLT. Måste
  // ligga FÖRE ntInterference (DONT) – annars läses det naturliga inklivet
  // som DONT. Diskriminatorn = 'naturligt inkliv (1NT)'-rule på deras bud.
  { id: 'lebensohl1NTFirstToAnswer', before: ['ntInterferenceToAnswer'],
    run: (c) => answered(lebensohl1NTFirstToAnswer(c.history, c.seat),
      (their) => lebensohlAfter1NT(c.hand, their), c.history, c.seat) },
  { id: 'lebensohl1NTRelayComplete',
    run: (c) => lebensohl1NTRelayComplete(c.history, c.seat) },
  { id: 'lebensohl1NTRebidToAnswer',
    run: (c) => answered(lebensohl1NTRebidToAnswer(c.history, c.seat),
      (their) => lebensohlAfter1NTRebid(c.hand, their), c.history, c.seat) },
  { id: 'lebensohl1NTGFToAnswer',
    run: (c) => answered(lebensohl1NTGFToAnswer(c.history, c.seat),
      (gf) => lebensohl1NTOpenerAnswerGF(c.hand, gf), c.history, c.seat) },
  // Motståndaren störde VÅR icke-1-färgs-öppning (Fynd #2 delbit 4):
  // svararen svarar. Måste ligga FÖRE off-book-svaret.
  { id: 'ntInterferenceToAnswer', before: ['offBookResponse'],
    run: (c) => answered(ntInterferenceToAnswer(c.history, c.seat),
      (i) => answerNTInterference(c.hand, i), c.history, c.seat) },
  { id: 'ownPreemptInterferenceToAnswer', before: ['offBookResponse'],
    run: (c) => answered(ownPreemptInterferenceToAnswer(c.history, c.seat),
      (p) => answerPreemptInterference(c.hand, p.ourSuit, p.theirCall, p.ourLevel), c.history, c.seat) },
  // Öppnarens fortsättning efter partnerns VÄRDE-DUBBEL över vårt störda 1NT
  // (felrapport #43): 2NT-relä (förnekar 5-kort) eller visa 5-korts färg, och
  // svararens placering över det. FÖRE off-book-svaret (som gav bar pass →
  // missad utgång eftersom öppnaren saknade all logik här).
  { id: 'answerNTValueDoubleOpener', before: ['offBookResponse'],
    run: (c) => answerNTValueDoubleOpener(c.deal, c.history, c.seat) },
  { id: 'answerNTValueDoubleDoubler', before: ['offBookResponse'],
    run: (c) => answerNTValueDoubleDoubler(c.deal, c.history, c.seat) },
  // Öppnaren svarar partnerns CUE-HÖJNING i motståndarnas färg (felrapport
  // #16): cue = krav, får aldrig passas. Måste ligga FÖRE off-book-svaret.
  { id: 'answerCueRaise', before: ['offBookResponse'],
    run: (c) => answerCueRaise(c.deal, c.history, c.seat) },
  // Advancern svarar partnerns TVÅFÄRGS-CUE över deras svaga tvåa (felrapport
  // #18): krav, får aldrig passas. Måste ligga FÖRE off-book-svaret.
  { id: 'answerWeakTwoCue', before: ['offBookResponse'],
    run: (c) => answerWeakTwoCue(c.deal, c.history, c.seat) },
  // Cue-BJUDAREN fullföljer utgångskravet efter öppnarens svar (felrapport
  // #26): krav, får aldrig passas. answerCueRaise sköter öppnarens svar på
  // cuet; detta är cue-bjudarens svar på det svaret. FÖRE off-book-svaret.
  { id: 'answerCueBidderRebid', before: ['offBookResponse'],
    run: (c) => answerCueBidderRebid(c.deal, c.history, c.seat) },
  // Vårt 2-över-1 var utgångskrav och öppnaren höjde vår färg (felrapport
  // #27): svararen sätter minst utgång, passar aldrig. Uppstår off-book (Syd
  // öppnade svagare handen). Måste ligga FÖRE off-book-svaret (som annars
  // vägrar höja en redan bjuden färg och passar).
  { id: 'answerTwoOverOneRaise', before: ['offBookResponse'],
    run: (c) => answerTwoOverOneRaise(c.deal, c.history, c.seat) },
  // Inklivaren stöttar advancerns NYA färg (felrapport #15): enkel stödhöjning
  // i stället för att passa. Måste ligga FÖRE off-book-svaret (som annars
  // kräver 4-korts stöd för en minor och passar en klar 3-korts fit).
  { id: 'overcallerRaiseAdvance', before: ['offBookResponse'],
    run: (c) => overcallerRaiseAdvance(c.deal, c.history, c.seat) },
  // Överklivaren tävlar efter partnerns CUE-HÖJNING när motståndarna bjudit
  // vidare över cuet (felrapport #47): en cue-höjning i vår färg + egen svit
  // säljs aldrig ut under fiten. answerCueRaise täcker bara öppnaren i lugnt
  // läge. Måste ligga FÖRE off-book-svaret (som annars passar).
  { id: 'overcallerCompetesAfterCueRaise', before: ['offBookResponse'],
    run: (c) => overcallerCompetesAfterCueRaise(c.deal, c.history, c.seat) },
  // Svararen PLACERAR kontraktet efter öppnarens NMF-svar (§5.7, steg 3).
  // Måste ligga FÖRE off-book-svaret (som annars vägrar re-höja svararens egen
  // högfärg och passar en klar 5-3-fit).
  { id: 'nmfPlacementToAnswer', before: ['offBookResponse'],
    run: (c) => answered(nmfPlacementToAnswer(c.history, c.seat),
      (n) => responderPlaceAfterNMF(c.hand, n.responderMajor, n.otherMajor, n.nmfMinor, n.opened, n.unbidSuit, n.answer), c.history, c.seat) },
  // Del C (flerronds): advancern tävlar upp till en 9-korts fit efter motstånd-
  // arnas fitvisande höjning (partnern klev in 2-läges → 3-korts stöd räcker).
  // Måste ligga FÖRE off-book-svaret (som kräver 4-korts stöd för ett 2-läges
  // inkliv och därför passar den 3-korts fiten).
  // Felrapport #56: partnern klev in och visade sedan en ANDRA färg — advancern
  // ger preferens till inklivsfärgen med bättre stöd, oavsett poäng. Måste ligga
  // FÖRE advancerCompetesToFit (som annars höjer den ANDRA färgen på 3-korts
  // stöd) och före off-book-svaret (som passade 4♦ med fem spader).
  { id: 'advancerPrefersOvercallSuit', before: ['advancerCompetesToFit', 'offBookResponse'],
    run: (c) => advancerPrefersOvercallSuit(c.deal, c.history, c.seat) },
  { id: 'advancerCompetesToFit', before: ['offBookResponse'],
    run: (c) => advancerCompetesToFit(c.deal, c.history, c.seat) },
  // Svararens svar på 2♣–2♦–2NT (öppnarens 22–24): 3+ hp = utgång → 3NT,
  // passar aldrig bort utgångsvärden. Måste ligga FÖRE off-book-svaret (som
  // annars passar en svag hand som ändå har utgång mittemot 22–24).
  { id: 'respondToStrong2NTRebid', before: ['offBookResponse'],
    run: (c) => respondToStrong2NTRebid(c.deal, c.history, c.seat) },
  // Negativ-dubblarens invit-fortsättning (fel färg-spåret fix 5b):
  // 9–12-handen bjuder vidare över öppnarens tvingade svar (preferens/egen
  // färg/2NT) i stället för att passa. Måste ligga FÖRE off-book-svaret
  // (som annars kräver 12+ för en ny färg på 2-läget och passar).
  { id: 'negativeDoublerContinues', before: ['offBookResponse'],
    run: (c) => negativeDoublerContinues(c.deal, c.history, c.seat) },
  // Kaptenen höjer partnerns naturliga 3NT till 6NT när slamzonen nås redan
  // mot partnerns visade minimum (felrapport #42). Måste ligga FÖRE
  // off-book-svaret, som skyddar partnerns utgångsbud och därmed passar.
  { id: 'raisePartnerThreeNTToSlam', before: ['offBookResponse'],
    run: (c) => raisePartnerThreeNTToSlam(c.deal, c.history, c.seat) },
  // Sangsystemet när sangöppningen bjudits OFF-BOOK (felrapport #41):
  // svararen får §4.3/§4.4-svaret, öppnaren sitt återbud. Måste ligga FÖRE
  // off-book-svaret (som kräver en visad FÄRG och därför passade ut 1NT)
  // och före honorForce (som läste Stayman-2♣ som "krav – ny färg").
  { id: 'answerPartnerNTOpening', before: ['offBookResponse', 'honorForce'],
    run: (c) => answerPartnerNTOpening(c.deal, c.history, c.seat) },
  { id: 'openerAnswersNTResponse', before: ['offBookResponse', 'honorForce'],
    run: (c) => openerAnswersNTResponse(c.deal, c.history, c.seat) },
  // Systems on över ett 1NT-INKLIV (uppföljning felrapport #53): den kanoniska
  // linjen (auction.ts) modellerar advancerns systemsvar, men off-book (ägaren
  // bjuder i budlådan) fångas advancern + inklivarens fullföljd här – FÖRE
  // off-book-svaret (som läste 2♦ som cue-höjning) och honorForce.
  { id: 'advancerRespondsTo1NTOvercall', before: ['offBookResponse', 'honorForce'],
    run: (c) => advancerRespondsTo1NTOvercall(c.deal, c.history, c.seat) },
  { id: 'overcallerAnswersAdvance', before: ['offBookResponse', 'honorForce'],
    run: (c) => overcallerAnswersAdvance(c.deal, c.history, c.seat) },
  // Generellt historiedrivet off-book-svar (fångar fit/egen färg/sang).
  { id: 'offBookResponse', before: ['honorForce'],
    run: (c) => offBookResponse(c.deal, c.history, c.seat) },
  // SISTA VAKTEN: är vår sida i krav och skulle annars passa → tvinga fram ett
  // naturligt minimibud (grunden bakom "krav får aldrig passas"). Ostörda 2/1,
  // ny färg och reverse; ersätter behovet av en detektor per felrapport.
  { id: 'honorForce',
    run: (c) => honorForce(c.deal, c.history, c.seat) },
]

export function decideCall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall {
  const pass: ResolvedCall = { seat, bid: 'P' }
  const built = buildAuction(deal)
  if (!built) return pass // ingen öppnar given → alla passar

  const line = turnsToCalls(built.turns, deal.dealer)
  const offBook = divergedFromLine(history, line)
  const c: DetectorCtx = { deal, history, seat, hand: deal.hands[seat] }

  // Följ linjen så länge den verkliga budföljden inte motsagt den — men ett
  // inbakat försvarspass efter deras spärrhöjning får inte tysta väckningen
  // (se defendRaisedPreemptCall ovan).
  if (!offBook) {
    const next = line[history.length]
    if (next && next.seat === seat) {
      if (next.bid === 'P') {
        const wake = defendRaisedPreemptCall(c)
        if (wake && wake.bid !== 'P') return wake
      }
      return next
    }
  }

  // Etapp 7 hål D: konkurrens-slaminvit (kontroll-komplett 4NT + placering) —
  // FÖRE utgångshöjningarna och det nakna passet.
  const slamStep = competitiveRKCPlace(deal, history, seat) ?? competitiveSlamTry(deal, history, seat)
  if (slamStep) return slamStep

  // Tvingande svar — gäller ÄVEN on-book (kedjan FORCED_DETECTORS ovan).
  for (const d of FORCED_DETECTORS) {
    const call = d.run(c)
    if (call) return call
  }

  // Konkurrenskedjan CONTESTED_DETECTORS — bara när linjen inte styr längre:
  // off-book, eller en ÖPPEN auktion som linjen bara modellerat en rond av.
  const lineExhaustedOpen = !offBook && history.length >= line.length && built.open
  if (offBook || lineExhaustedOpen) {
    for (const d of CONTESTED_DETECTORS) {
      const call = d.run(c)
      if (call) return call
    }
  }

  return pass
}
