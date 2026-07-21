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

import type { Bid, Deal, Seat, Suit } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { turnsToCalls } from './auction-contract'
import { answerTakeoutDouble, openerAnswerNegativeDouble, penaltyDouble } from './doubles'
import { advanceDONT } from './dont'
import { answerNTInterference, answerPreemptInterference } from './contested-openings'
import { openerAnswerFourthSuit, openerAnswerNMF } from './rebids'
import { responderPlaceAfterNMF } from './responder-rebids'
import { dummyPoints, pointsWithFloor, startingPoints } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'
import { advanceTwoSuiter, hasStopper, openingSuit, overcall } from './overcalls'
import { side, NEXT_SEAT } from './play'
import { respondToKingAsk, respondToRKC } from './slam'

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
function takeoutDoubleToAnswer(history: ResolvedCall[], seat: Seat): { suit: Suit; level: number; bidSuits: Suit[] } | null {
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
  return their ? { suit: their, level, bidSuits } : null
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
      `partnern visade ingen preferens, så jag flyr till min längsta visade färg: ${SWE_NAME[letterOfSuit(best)]}.`,
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
    explanation: `17+ hp – jag bjuder min egna ${SWE_NAME[letter]} över dubblingen (för stark för ett enkelt inkliv, rondkrav – game avgörs nästa varv).`,
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
        return { seat, bid: cue, rule: 'stöd-cue (slamintresse)', explanation: `${p} hp med ${support} korts stöd i ${SWE_NAME[letter]} → cue i deras färg = utgång + slamintresse.` }
      }
    }
    const target = p >= 7 ? gameLevel : p >= 4 ? Math.min(shownLevel + 2, gameLevel) : Math.min(shownLevel + 1, gameLevel)
    const bid = bidAt(target) ?? bidAt(shownLevel + 1)
    if (bid) {
      const label = target >= gameLevel ? 'utgång' : p >= 4 ? 'hopphöjning (inbjudan)' : 'enkel höjning (minimum)'
      return { seat, bid, rule: `stödhöjning – ${label}`, explanation: `${p} hp med ${support} korts stöd → ${bid} (${label}; tvunget svar på det starka återbudet).` }
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
      return { seat, bid, rule: 'tvångssvar (utan stöd)', explanation: `Utan stöd i ${SWE_NAME[letter]} → ${same ? `bjuder om min ${SWE_NAME[letterOfSuit(chosen)]} (5+)` : `näst längsta objudna (${SWE_NAME[letterOfSuit(chosen)]})`} = tvång, lovar inga poäng.` }
    }
  }
  // Nödfall (ingen färg att visa): ge minsta stöd i dubblarens färg (fortsatt tvång).
  const fallback = cheapestBidIn(history, seat, letter)
  if (fallback && legal.includes(fallback)) {
    return { seat, bid: fallback, rule: 'tvångssvar (preferens)', explanation: `Inget eget bud → minsta preferens i ${SWE_NAME[letter]} (tvunget svar).` }
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
      return { seat, bid: game, rule: 'accepterar utgång', explanation: `${p} hp mittemot partnerns stödhöjning → utgång ${game}.` }
    }
    return null // minimum → passa höjningen (delkontrakt)
  }

  // Advancern visade INGET stöd (bjöd egen/annan färg). Ägarbeslut 2026-07-05:
  const tp = startingPoints(hand).startingPoints
  const sixPlus = len[suit] >= 6
  if (sixPlus && tp >= 22 && shownLevel === 1) {
    const jump = `3${letter}` as Bid
    if (legal.includes(jump)) {
      return { seat, bid: jump, rule: 'starkt återbud (utgångskrav)', explanation: `${len[suit]} korts ${SWE_NAME[letter]}, ${tp} TP (≥22) → hopp till ${jump} = utgångskrav.` }
    }
  }
  // Annars: bjud om färgen på lägsta nivå (ej krav; delkontrakt mot en tom partner).
  const low = cheapestBidIn(history, seat, letter)
  if (low && legal.includes(low)) {
    return { seat, bid: low, rule: 'starkt återbud (lägsta)', explanation: `${len[suit]} korts ${SWE_NAME[letter]}, ${tp} TP – bjuder om färgen lägst (${low}); ej utgångskrav mot ett tvångssvar.` }
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
  // Måste vara ett HOPP till 3-läget i dubblarens färg (från ett 1-läges återbud).
  if (second.strain !== letter || second.level !== 3 || ctx.doublerBids[0].level !== 1) return null

  const hand = deal.hands[seat]
  const support = lengths(hand)[suit]
  const legal = legalCalls(history, seat)
  const game = `${suit === 'hearts' || suit === 'spades' ? 4 : 5}${letter}` as Bid
  if (support >= 1 && legal.includes(game)) {
    return { seat, bid: game, rule: 'utgång (1–2 korts stöd)', explanation: `Utgångskravet accepteras: ${support} korts stöd i ${SWE_NAME[letter]} → ${game} (minimum men utgång).` }
  }
  if (legal.includes('3NT')) {
    return { seat, bid: '3NT', rule: 'nekar stöd (3NT)', explanation: `Nekar helt stöd i ${SWE_NAME[letter]}, svagast möjliga → 3NT.` }
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

// ---- Off-book: svara historiedrivet på Syds egna bud (pivotens kärna) -------
//
// När Syd bjudit utanför systemlinjen (off-book) har partnern ingen kanonisk
// fortsättning. I stället för att tappa tråden och passa svarar vi som en
// förnuftig partner skulle: stöd partnerns färg om vi har fit (graderat efter
// styrka), annars en egen färg eller sang. Allt utläst ur historiken + den egna
// handen – aldrig ur den (nu ogiltiga) ideallinjen. Medvetet konservativt; varje
// regel ska vara TYDLIGT korrekt även om den är smal.

const SWE_NAME: Record<string, string> = { C: 'klöver', D: 'ruter', H: 'hjärter', S: 'spader' }
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
  // med KT doubleton, 8-korts fit + utgångsvärden).
  const partnerBidsInSuit = history.filter(
    (c) => c.seat === PARTNER[seat] && parseContractBid(c.bid)?.strain === partnerSuit.strain,
  ).length
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

  const sp = dummyPoints(hand, suit).dummyPoints
  if (sp < 6) return null // för svagt för att höja

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
        explanation: `Fit i partnerns ${SWE_NAME[partnerSuit.strain]} + utgångsvärden (${sp} stödpoäng), balanserad → 3NT.`,
      }
    }
    const gameBid = `5${partnerSuit.strain}` as Bid
    if (legal.includes(gameBid)) {
      return {
        seat, bid: gameBid,
        explanation: `Fit i partnerns ${SWE_NAME[partnerSuit.strain]} + utgångsvärden (${sp} stödpoäng) → minorutgång ${gameBid}.`,
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
        explanation: `Stöd för partnerns ${SWE_NAME[partnerSuit.strain]} – ${label} med fit.`,
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
      return { seat, bid, explanation: `Egen färg ${SWE_NAME[st]} (4+ kort) – naturligt svar utan stöd för partnern.` }
    }
    if (level === 2 && points >= 12) {
      return { seat, bid, explanation: `Egen färg ${SWE_NAME[st]} på 2-läget – 4+ kort och utgångsvärden.` }
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

  // (a) Partnerns NYA färg → öppnaren måste rebjuda (rondkrav).
  if (seat === opener && highest.seat === responderSeat) {
    const bid = parseContractBid(highest.bid)!
    const responderTimesInSuit = responderBids.filter(
      (c) => parseContractBid(c.bid)!.strain === bid.strain,
    ).length
    const isNewSuit = bid.strain !== 'NT' && bid.strain !== open.strain && responderTimesInSuit === 1
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

  // (a) Svararens FRIA nya färg → öppnaren måste rebjuda.
  if (seat === opener && highest.seat === responderSeat && !responderPassedFirst) {
    const bid = parseContractBid(highest.bid)!
    const timesInStrain = responderBids.filter(
      (c) => parseContractBid(c.bid)!.strain === bid.strain,
    ).length
    const isNewSuit =
      bid.strain !== 'NT' &&
      bid.strain !== open.strain &&
      timesInStrain === 1 &&
      !oppStrains.has(bid.strain) // ett cue i deras färg är en höjning, ej ny färg
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

  // 1) Rebjud egen 5+ färg vi redan bjudit.
  for (const st of SUIT_STRAINS) {
    if (len[SUIT_OF_LETTER[st]] < 5) continue
    if (!history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st)) continue
    const bid = cheapestBidIn(history, seat, st)
    if (bid) return {
      seat, bid, rule: 'krav – rebjuder egen färg',
      explanation: `Auktionen är krav – jag får inte passa. Rebjuder min egna ${SWE_NAME[st]} (5+ kort).`,
    }
  }

  // 2) Stöd partnerns visade färg (3+ kort).
  const ps = partnerLastSuit(history, seat)
  if (ps && len[SUIT_OF_LETTER[ps.strain]] >= 3) {
    const bid = cheapestBidIn(history, seat, ps.strain)
    if (bid) return {
      seat, bid, rule: 'krav – stödjer partnern',
      explanation: `Auktionen är krav – jag får inte passa. Stöder partnerns ${SWE_NAME[ps.strain]} (3+ kort).`,
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
      explanation: `Auktionen är krav – jag får inte passa. Visar en ny färg (${SWE_NAME[st]}, 4+ kort).`,
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
    explanation: `Partnern visade 22–24 balanserad; ${p} hp räcker till utgång (22+3 = 25) → 3NT.`,
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
function partnerCueRaiseToAnswer(history: ResolvedCall[], seat: Seat): { agreedStrain: string } | null {
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
  return { agreedStrain: open.strain }
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
    explanation: `Partnern avancerade mitt inkliv med en ny färg (${SWE_NAME[advCb.strain]}, lovar 5+) och jag har 3+ stöd → enkel höjning som bekräftar fiten (ej krav).`,
  }
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
 * krävs exakt 4-4. (Den starka 17+-enfärgshanden hanteras i öppningsfallet, se
 * `overcall` + `ownStrongDoubleRebid`.) null = ingen sådan dubbling.
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

  const hand = deal.hands[seat]
  const p = hcp(hand)
  const len = lengths(hand)
  const unbid = (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[]).filter((s) => s !== openSuit && s !== respSuit)
  const [u1, u2] = unbid
  // Exakt 4-4 i de objudna (en 5-korts objuden färg inkliver vi hellre).
  const fourFour = len[u1] >= 4 && len[u2] >= 4 && len[u1] < 5 && len[u2] < 5
  if (p < 10 || !fourFour) return null
  if (!legalCalls(history, seat).includes('X' as Bid)) return null

  return {
    seat, bid: 'X', rule: 'upplysningsdubbling',
    explanation: `${p} hp, 4-4 i ${SWE_NAME[letterOfSuit(u1)]}+${SWE_NAME[letterOfSuit(u2)]} (deras ${SWE_NAME[letterOfSuit(openSuit)]}+${SWE_NAME[letterOfSuit(respSuit)]} objudna) → X (upplysning).`,
  }
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
    return { seat, bid: 'P', rule: 'DONT: pass (klöver)', explanation: 'min DONT-enfärg är klöver → passa partnerns 2♣-relä.' }
  }
  const bid = cheapestBidIn(history, seat, letterOfSuit(suit))
  if (!bid) return null
  return {
    seat, bid, rule: 'DONT: rättelse',
    explanation: `min DONT-enfärg är ${SWE_NAME[letterOfSuit(suit)]} (6+) → rättar partnerns 2♣-relä till ${bid}.`,
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
    explanation: `partnern relä:ade (${relay.bid}) → visar min högre färg ${SWE_NAME[letterOfSuit(higher)]} → ${bid}.`,
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
        explanation: `partnerns 3NT efter transfern = välj utgång: ${support}-korts stöd i ${SWE_NAME[letterOfSuit(transferMajor)]} → 4 ${SWE_NAME[letterOfSuit(transferMajor)]} (5-3-fiten före sang).`,
      }
    }
  }
  return {
    seat, bid: 'P', rule: 'pass',
    explanation: `partnerns 3NT efter transfern = välj utgång: bara ${support}-korts stöd i ${SWE_NAME[letterOfSuit(transferMajor)]} → pass (3NT står).`,
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
      `Motståndarna flyr till ${runout.level}${SWE_NAME[letterOfSuit(runout.suit)]} → straffdubbling.`,
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
  const acceptGame = hcp(deal.hands[seat]) >= 15 && legal.includes(gameBid)
  const bid = (acceptGame ? gameBid : signoff) as Bid | null
  if (bid && legal.includes(bid)) {
    return {
      seat, bid, rule: 'svar på cue-höjning',
      explanation: acceptGame
        ? `Partnerns cue lovar minst limithöjning i ${SWE_NAME[strain]}; jag är maximum → accepterar utgång ${bid}.`
        : `Partnerns cue lovar minst limithöjning i ${SWE_NAME[strain]} och är krav; med ett minimum återgår jag billigast i vår färg (${bid}).`,
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
  let best = sideStrains[0]
  for (const st of sideStrains) {
    if (len[SUIT_OF_LETTER[st]] > len[SUIT_OF_LETTER[best]]) best = st
  }
  const bid = cheapestBidIn(history, seat, best)
  if (bid && legalCalls(history, seat).includes(bid)) {
    return {
      seat, bid, rule: 'svar på tvåfärgs-cue',
      explanation: `Partnerns cue lovar en stark tvåfärgshand (krav) – jag ger preferens till min längsta sidofärg ${SWE_NAME[best]} (${bid}), passar aldrig cuet.`,
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
      explanation: `Vårt 2-över-1-svar var utgångskrav och partnern höjde min ${SWE_NAME[info.strain]} → jag sätter utgång ${bid} (pass förbjudet).`,
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
    explanation: `Vårt 2-över-1 var utgångskrav och partnern höjde min ${SWE_NAME[info.strain]} → utgång ${bid} (pass förbjudet).`,
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
  if (hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: 'cue-höjningens fortsättning',
      explanation: `Min cue-höjning var utgångskrav; jag stoppar deras ${SWE_NAME[info.theirStrain]} → 3NT (pass förbjudet).`,
    }
  }
  const isMajor = info.agreedStrain === 'H' || info.agreedStrain === 'S'
  const bid = `${isMajor ? 4 : 5}${info.agreedStrain}` as Bid
  if (!legal.includes(bid)) return null
  return {
    seat, bid, rule: 'cue-höjningens fortsättning',
    explanation: `Min cue-höjning var utgångskrav – utan säkert stopp i deras ${SWE_NAME[info.theirStrain]} sätter jag utgång i vår ${SWE_NAME[info.agreedStrain]} (${bid}); pass förbjudet.`,
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
  const mSym = SWE_NAME[M]
  // Utgångshand → utgång oavsett partnerns exakta styrka.
  if (bp >= 18 && legal.includes(game)) {
    return {
      seat, bid: game, rule: 'öppnaren bjuder utgång i konkurrens',
      explanation: `~${bp} totalpoäng mittemot partnerns höjning → utgång ${game} i ${mSym}.`,
    }
  }
  // Utgångsintresse (~15–17) → X = game try (maximal dubbling; cue vore utan
  // avböjnings-utrymme). Partnern bjuder 4M med maximum, annars 3M.
  if (bp >= 15 && legal.includes('X')) {
    return {
      seat, bid: 'X', rule: 'maximal dubbling (game try)',
      explanation: `~${bp} totalpoäng, utgångsintresse mittemot en 6–9-höjning – motståndarnas bud kläm­mer bort cue-budet, så X är game try: partnern bjuder ${game} med ett maximum, annars ${threeM}.`,
    }
  }
  // Minimum men 6:e trumfen (9+ trumf ihop) → konkurrera på lagen om totala stick.
  if (lengths(hand)[suit] >= 6 && legal.includes(threeM)) {
    return {
      seat, bid: threeM, rule: 'öppnaren konkurrerar (6:e trumfen)',
      explanation: `Minimum men 6:e trumfen (9+ trumf ihop) → ${threeM} på lagen om totala stick (ej krav); säljer inte given billigt.`,
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
  const mSym = SWE_NAME[M]
  if (sp >= 8 && legal.includes(game)) {
    return {
      seat, bid: game, rule: 'accepterar game-try',
      explanation: `Partnerns X är ett game try (maximal dubbling); jag är maximum av höjningen (${sp} stödpoäng i ${mSym}) → accepterar utgång ${game}.`,
    }
  }
  if (decline && legal.includes(decline)) {
    return {
      seat, bid: decline, rule: 'avböjer game-try',
      explanation: `Partnerns X är ett game try; med ett minimum (${sp} stödpoäng i ${mSym}) återgår jag till ${decline} (avböjer).`,
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
      explanation: `Partnerns 2NT är en inbjudan (18–19); med ett maximum av min höjning (${p} hp) → 3NT (utgång).`,
    }
  }
  return {
    seat, bid: 'P', rule: 'avböjer sanginbjudan',
    explanation: `Partnerns 2NT är en inbjudan; med ett minimum av min höjning (${p} hp) passar jag (stannar i 2NT).`,
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
      explanation: `~${p} hp, jämn/sangduglig hand med stopp i ${SWE_NAME[theirStrain]} mittemot partnerns höjning → 3NT (utgång).`,
    }
  }
  if (p >= 18 && legal.includes('2NT' as Bid)) {
    return {
      seat, bid: '2NT', rule: 'öppnarens 2NT-inbjudan i konkurrens',
      explanation: `~${p} hp, jämn hand med stopp i ${SWE_NAME[theirStrain]} – för starkt för ett tyst färgbud → 2NT (inbjudan; partnern bjuder 3NT med ett maximum).`,
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

  // Fit i partnerns nya färg? 1-lägessvar lovar 4+ (öppnaren behöver 4), ett
  // 2/1-svar lovar 5+ (öppnaren behöver 3). Bergen bara med fit; annars ren hp.
  let fitStrain: string | null = null
  if (respStrain && len[SUIT_OF_LETTER[respStrain]] >= (resp.level >= 2 ? 3 : 4)) fitStrain = respStrain
  const tp = fitStrain ? pointsWithFloor(hand, SUIT_OF_LETTER[fitStrain], 'bergen').points : hcp(hand)
  const isMajorFit = fitStrain === 'H' || fitStrain === 'S'

  // --- 18+ utgångshand -------------------------------------------------------
  if (tp >= 18) {
    if (isMajorFit && legal.includes(`4${fitStrain}` as Bid)) return {
      seat, bid: `4${fitStrain}` as Bid, rule: 'öppnaren bjuder utgång i konkurrens',
      explanation: `~${tp} totalpoäng med ${SWE_NAME[fitStrain!]}fit → utgång 4${SWE_NAME[fitStrain!]}.`,
    }
    if (isBalanced(hand) && hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) return {
      seat, bid: '3NT', rule: 'öppnaren bjuder 3NT i konkurrens',
      explanation: `~${tp} hp, jämn hand med stopp i ${SWE_NAME[theirStrain]} → 3NT.`,
    }
    if (cue) return {
      seat, bid: cue, rule: 'öppnarens cue (utgångskrav i konkurrens)',
      explanation: `~${tp} hp – för starkt för att sälja given: cue i ${SWE_NAME[theirStrain]} = utgångskrav, hjälp mig välja utgång.`,
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
          explanation: `~${tp} stödpoäng med ${SWE_NAME[fitStrain!]}fit → inbjudande hopphöjning ${jump}.`,
        }
        if (legal.includes(simple)) return {
          seat, bid: simple, rule: 'öppnarens höjning (konkurrens)',
          explanation: `~${tp} stödpoäng med ${SWE_NAME[fitStrain!]}fit → ${simple}.`,
        }
      }
    }
    if (cue) return {
      seat, bid: cue, rule: 'öppnarens cue (extra i konkurrens)',
      explanation: `~${tp} hp – för bra för ett minimibud: cue i ${SWE_NAME[theirStrain]} visar extra och letar rätt utgång.`,
    }
  }

  // --- Minimum: tävla med egen 6+ färg eller en fit, annars pass (null) -------
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid) return {
      seat, bid: rebid, rule: 'öppnaren tävlar (egen 6+ färg)',
      explanation: `Minimum men 6+ ${SWE_NAME[open.strain]} → ${rebid} (tävlar på lagen om totala stick, ej krav).`,
    }
  }
  if (fitStrain) {
    const raise = cheapestBidIn(history, seat, fitStrain)
    if (raise) return {
      seat, bid: raise, rule: 'öppnaren tävlar (stödjer partnern)',
      explanation: `Minimum med ${SWE_NAME[fitStrain]}fit → ${raise} (tävlar).`,
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
      explanation: `Partnern passade inklivet, men 6+ ${SWE_NAME[open.strain]} → ${rebid} (tävlar på lagen om totala stick, ej krav).`,
    }
  }

  // 2) Extra (15+ hp) + kort i deras färg → återöppningsdubbling (takeout).
  if (hcp(hand) >= 15 && len[theirSuit] <= 2 && legal.includes('X' as Bid)) return {
    seat, bid: 'X', rule: 'öppnarens återöppningsdubbling (partnern passade)',
    explanation: `~${hcp(hand)} hp och kort i ${SWE_NAME[theirStrain]} – för bra för att sälja given: återöppningsdubbling (takeout, välj färg partner).`,
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
    explanation: `Kort i ${SWE_NAME[theirStrain]} – sälj inte given: återöppningsdubbling (takeout; partnern kan konvertera till straff).`,
  }

  // 2) Egen 6+ färg → tävla genom att rebjuda den.
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid && legal.includes(rebid)) return {
      seat, bid: rebid, rule: 'öppnaren tävlar i utpassningssits (egen 6+ färg)',
      explanation: `6+ ${SWE_NAME[open.strain]} → ${rebid} (sälj inte given med en 6-korts färg).`,
    }
  }

  // 3) Extra (15+ hp) → återöppningsdubbling även utan kort i deras färg.
  if (hcp(hand) >= 15 && legal.includes('X' as Bid)) return {
    seat, bid: 'X', rule: 'öppnarens återöppningsdubbling (extra, utpassningssits)',
    explanation: `~${hcp(hand)} hp – för bra för att sälja given: återöppningsdubbling.`,
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
      explanation: `Fit i partnerns ${SWE_NAME[partnerSuit.strain]} + utgångsvärden (${sp} stödpoäng) → utgång ${game}.`,
    }
  }
  // Tävla till lagens nivå (9 trumf → 3-läget). Har konkurrensen redan tryckt upp
  // billigaste höjning till 4-läget saknar vi värden att tävla dit → passa.
  if (level <= 3) return {
    seat, bid: cheapest, rule: 'advancern tävlar till fiten (lagen om totala stick)',
    explanation: `3-korts stöd = 9-korts fit → ${cheapest} (tävlar på lagen om totala stick; ej krav).`,
  }
  return null
}

export function decideCall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall {
  const pass: ResolvedCall = { seat, bid: 'P' }
  const built = buildAuction(deal)
  if (!built) return pass // ingen öppnar given → alla passar

  const line = turnsToCalls(built.turns, deal.dealer)
  const offBook = divergedFromLine(history, line)

  // Följ linjen så länge den verkliga budföljden inte motsagt den.
  if (!offBook) {
    const next = line[history.length]
    if (next && next.seat === seat) return next
  }

  const hand = deal.hands[seat]

  // ---- Tvingande svar (gäller ÄVEN on-book) --------------------------------
  // Linjen gav inget bud för oss här. Vissa lägen är ändå rondkrav: partnern får
  // ALDRIG lämnas att passa bort en upplysning/fjärde färg. Prövas i ordning;
  // första steget som ger ett lagligt bud vinner.
  const forcedAnswers: Array<() => ResolvedCall | null> = [
    // Upplysningsdubbling från partnern (§7): svara, passa aldrig bort den.
    () => answered(takeoutDoubleToAnswer(history, seat),
      (t) => answerTakeoutDouble(hand, t.suit, t.level, t.bidSuits), history, seat),
    // Partnerns NEGATIVA dubbling (§7.3, rondkrav): öppnaren svarar alltid.
    () => answered(negativeDoubleToAnswer(history, seat),
      (n) => openerAnswerNegativeDouble(hand, n.ourOpen, n.theirCall), history, seat),
    // Partnerns FJÄRDE FÄRG (§6.6, utgångskrav): öppnaren svarar alltid.
    () => answered(fourthSuitToAnswer(history, seat),
      (f) => openerAnswerFourthSuit(hand, f.opened, f.second, f.responderSuit, f.fourth), history, seat),
    // Partnerns NEW MINOR FORCING (§5.7, krav): öppnaren svarar alltid.
    () => answered(nmfToAnswer(history, seat),
      (n) => openerAnswerNMF(hand, n.opened, n.responderMajor, n.nmfMinor, n.unbidSuit), history, seat),
  ]
  for (const run of forcedAnswers) {
    const call = run()
    if (call) return call
  }

  // ---- Historiedrivna svar när linjen inte styr längre ---------------------
  // Off-book (Syd bjöd eget) eller en öppen konkurrensauktion som linjen bara
  // modellerat en rond av. ORDNINGEN I LISTAN ÄR BETYDELSEFULL: flera steg måste
  // ligga FÖRE det generella off-book-svaret sist (annars läser det ett
  // konstgjort relä/cue som en naturlig färg och stöder/passar fel). Lägg nya
  // konventioner på rätt plats i listan – inte sist av bekvämlighet.
  const lineExhaustedOpen = !offBook && history.length >= line.length && built.open
  if (offBook || lineExhaustedOpen) {
    const contestedAnswers: Array<() => ResolvedCall | null> = [
      // Motståndarna kliver in på riktigt (direkt sits eller balansering).
      () => maybeOvercall(deal, history, seat),
      // Upplysningsdubbling när de bjudit TVÅ 1-lägesfärger (1♦–P–1♥–X): 4-4 i de
      // objudna färgerna (eller 17+ stark enfärgshand). Ägarregel 2026-07-05.
      () => maybeTakeoutOfResponse(deal, history, seat),
      // Partnerns DONT-bud mot deras 1NT besvaras (§7.5, Fynd #2 delbit 1) …
      () => answered(partnerDONTToAnswer(history, seat),
        (d) => advanceDONT(hand, d), history, seat),
      // … och vår egen DONT-X rättas till sin riktiga färg efter partnerns relä.
      () => ownDONTXToCorrect(deal, history, seat),
      // … och vårt egna DONT-tvåfärgsbud (2♣/2♦) rättas till den högre färgen när
      // partnern relä:at pass-eller-rätta (felrapport #20).
      () => ownDONTTwoSuiterToCorrect(deal, history, seat),
      // Partnerns TVÅFÄRGSINKLIV (Michaels/ovanlig 2NT, §7.2): preferens via
      // advanceTwoSuiter; även advancerns medvetna pass (felrapport #7).
      () => answered(partnerTwoSuiterToAnswer(history, seat),
        (t) => advanceTwoSuiter(hand, t.partnerCall, t.theirSuit, t.contested), history, seat),
      // Ett EGET dubblat tvåfärgsinkliv får aldrig passas ut (felrapport #7):
      // konstgjort – utan preferens flyr vi till den längsta visade färgen.
      () => ownDoubledTwoSuiterRescue(deal, history, seat),
      // Vår egen 17+ upplysningsdubbling får sitt starka återbud (felrapport #23):
      // vi bjuder egen färg (billigast, rondkrav) för att visa den starka enfärgshanden.
      () => ownStrongDoubleRebid(deal, history, seat),
      // Den starka dubblingens FORTSÄTTNING (ägarbeslut 2026-07-05): advancern
      // svarar återbudet (Part 2), dubblaren dömer game (Part 3), advancern svarar
      // 3-hoppet (Part 4). Måste ligga FÖRE off-book-svaret så tvångssvaren inte
      // passas ut. Ordningen sinbördes spelar ingen roll (ömsesidigt uteslutande).
      () => advanceStrongDoubleRebid(deal, history, seat),
      () => strongDoublerSecondRebid(deal, history, seat),
      () => answerStrongDoubleGameForce(deal, history, seat),
      // Partnerns 4NT med trumf = ESSFRÅGAN (1430 RKC, §6.1); 5NT = kungfrågan
      // (Sjöberg, §6.3). Får aldrig passas (felrapport #9).
      () => answered(rkcToAnswer(history, seat),
        (trump) => respondToRKC(hand, trump), history, seat),
      () => answered(kingAskToAnswer(history, seat),
        (trump) => respondToKingAsk(hand, trump), history, seat),
      // Öppnarens rond-2 i det INKLÄMDA konkurrensläget + partnerns svar på
      // maximal-dubblingen (R1 Fynd #2 delbit 6). Måste ligga FÖRE
      // maybePenaltyDouble: i det inklämda läget är X reserverat för game try
      // (maximal dubbling) – vi ger medvetet upp straffdubblingen där. Bara det
      // specifika mönstret matchas; annars faller det igenom orört.
      () => answerOpenerMaximal(deal, history, seat),
      () => openerCompetesAfterRaise(deal, history, seat),
      // Öppnarens rond-2 när VÅR MINOR höjts i konkurrens och öppnaren har en
      // stark sangduglig hand (felrapport #30): visa styrkan i sang (3NT med 20+,
      // 2NT-inbjudan med 18–19) i stället för ett tyst färgbud som passas ut.
      // Ligger FÖRE openerRondTwoInCompetition (som utesluter höjningar) och FÖRE
      // maybePenaltyDouble/off-book-svaret.
      () => openerStrongNTAfterMinorRaise(deal, history, seat),
      // Höjaren svarar öppnarens 2NT-inbjudan (felrapport #30): accepterar 3NT
      // med ett maximum, annars pass. FÖRE off-book-svaret (som annars passar).
      () => answerOpenerNTInvite(deal, history, seat),
      // Systerfallet: öppnarens rond-2 i konkurrens när partnern bjöd NY FÄRG /
      // 1NT (ej höjning) och motståndarna konkurrerat (R1 Fynd #2). Extra visas
      // med cue i deras färg + naturliga hopp; minimum tävlar med 6+ färg/fit.
      // Ligger FÖRE maybePenaltyDouble (extra → cue, inte straffdubbling) och
      // FÖRE off-book-svaret (som annars säljer given genom att passa).
      () => openerRondTwoInCompetition(deal, history, seat),
      // Del A (flerronds): samma rond-2 MEN partnern PASSADE inklivet (sa inget).
      // Öppnaren tävlar försiktigt (egen 6+ färg / återöppnings-X) i stället för
      // att sälja given. Ligger EFTER openerRondTwoInCompetition (som kräver att
      // partnern bjöd) och FÖRE maybePenaltyDouble/off-book-svaret.
      () => openerReopensAfterPartnerPass(deal, history, seat),
      // Del B (flerronds): samma men RHO PASSADE inklivet (1M–(inkliv)–P–P) →
      // öppnaren sitter på utpassningen. Återöppnar (X med kort i deras färg /
      // egen 6+ färg) i stället för att sälja given. Partnern gör ofta trap pass.
      () => openerReopensBalancing(deal, history, seat),
      // Straffdubbla motståndarnas höga färgkontrakt när handen sätter det
      // (poängarbetet 2026-07-04): 2+ säkra trumfstick + 10+ hp.
      () => maybePenaltyDouble(deal, history, seat),
      // Partnerns 3NT efter fullföljd transfer = VÄLJ UTGÅNG (felrapport #13).
      // Måste ligga FÖRE off-book-svaret (som annars stöder transferns relä).
      () => answerTransferGameChoice(deal, history, seat),
      // Fynd #2 delbit 5 (Case A): efter vårt 1NT + partnerns värde-XX äger vi
      // handen – straffdubbla flykten. Måste ligga FÖRE delbit 4-detektorerna
      // (ntInterference) och off-book-svaret.
      () => answerRunout(history, seat),
      // Motståndaren störde VÅR icke-1-färgs-öppning (Fynd #2 delbit 4):
      // svararen svarar. Måste ligga FÖRE off-book-svaret.
      () => answered(ntInterferenceToAnswer(history, seat),
        (i) => answerNTInterference(hand, i), history, seat),
      () => answered(ownPreemptInterferenceToAnswer(history, seat),
        (p) => answerPreemptInterference(hand, p.ourSuit, p.theirCall, p.ourLevel), history, seat),
      // Öppnaren svarar partnerns CUE-HÖJNING i motståndarnas färg (felrapport
      // #16): cue = krav, får aldrig passas. Måste ligga FÖRE off-book-svaret.
      () => answerCueRaise(deal, history, seat),
      // Advancern svarar partnerns TVÅFÄRGS-CUE över deras svaga tvåa (felrapport
      // #18): krav, får aldrig passas. Måste ligga FÖRE off-book-svaret.
      () => answerWeakTwoCue(deal, history, seat),
      // Cue-BJUDAREN fullföljer utgångskravet efter öppnarens svar (felrapport
      // #26): krav, får aldrig passas. answerCueRaise sköter öppnarens svar på
      // cuet; detta är cue-bjudarens svar på det svaret. FÖRE off-book-svaret.
      () => answerCueBidderRebid(deal, history, seat),
      // Vårt 2-över-1 var utgångskrav och öppnaren höjde vår färg (felrapport
      // #27): svararen sätter minst utgång, passar aldrig. Uppstår off-book (Syd
      // öppnade svagare handen). Måste ligga FÖRE off-book-svaret (som annars
      // vägrar höja en redan bjuden färg och passar).
      () => answerTwoOverOneRaise(deal, history, seat),
      // Inklivaren stöttar advancerns NYA färg (felrapport #15): enkel stödhöjning
      // i stället för att passa. Måste ligga FÖRE off-book-svaret (som annars
      // kräver 4-korts stöd för en minor och passar en klar 3-korts fit).
      () => overcallerRaiseAdvance(deal, history, seat),
      // Svararen PLACERAR kontraktet efter öppnarens NMF-svar (§5.7, steg 3).
      // Måste ligga FÖRE off-book-svaret (som annars vägrar re-höja svararens egen
      // högfärg och passar en klar 5-3-fit).
      () => answered(nmfPlacementToAnswer(history, seat),
        (n) => responderPlaceAfterNMF(hand, n.responderMajor, n.otherMajor, n.nmfMinor, n.opened, n.unbidSuit, n.answer), history, seat),
      // Del C (flerronds): advancern tävlar upp till en 9-korts fit efter motstånd-
      // arnas fitvisande höjning (partnern klev in 2-läges → 3-korts stöd räcker).
      // Måste ligga FÖRE off-book-svaret (som kräver 4-korts stöd för ett 2-läges
      // inkliv och därför passar den 3-korts fiten).
      () => advancerCompetesToFit(deal, history, seat),
      // Svararens svar på 2♣–2♦–2NT (öppnarens 22–24): 3+ hp = utgång → 3NT,
      // passar aldrig bort utgångsvärden. Måste ligga FÖRE off-book-svaret (som
      // annars passar en svag hand som ändå har utgång mittemot 22–24).
      () => respondToStrong2NTRebid(deal, history, seat),
      // Generellt historiedrivet off-book-svar (fångar fit/egen färg/sang).
      () => offBookResponse(deal, history, seat),
      // SISTA VAKTEN: är vår sida i krav och skulle annars passa → tvinga fram ett
      // naturligt minimibud (grunden bakom "krav får aldrig passas"). Ostörda 2/1,
      // ny färg och reverse; ersätter behovet av en detektor per felrapport.
      () => honorForce(deal, history, seat),
    ]
    for (const run of contestedAnswers) {
      const call = run()
      if (call) return call
    }
  }

  return pass
}
