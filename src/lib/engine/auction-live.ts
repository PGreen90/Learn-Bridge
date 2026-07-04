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
import { openerAnswerFourthSuit } from './rebids'
import { dummyPoints } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'
import { advanceTwoSuiter, openingSuit, overcall } from './overcalls'
import { side } from './play'
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
function takeoutDoubleToAnswer(history: ResolvedCall[], seat: Seat): Suit | null {
  const lastNonPass = [...history].reverse().find((c) => c.bid !== 'P')
  // Senaste icke-pass måste vara PARTNERNS dubbling (annars: RHO bjöd → ej tvång).
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null
  // Har vår sida redan bjudit ett kontraktsbud är X:et inte en ren take-out.
  if (history.some((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))) return null
  // Deras dubblade färg = senaste kontraktsbudet (öppningen) på motståndarsidan.
  let theirSuit: Suit | null = null
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) theirSuit = SUIT_OF_LETTER[cb.strain] ?? null
  }
  return theirSuit
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

/** Färgbokstaven ('C'/'D'/'H'/'S') för en Suit (omvänd SUIT_OF_LETTER). */
function letterOfSuit(suit: Suit): (typeof SUIT_STRAINS)[number] {
  return SUIT_STRAINS.find((st) => SUIT_OF_LETTER[st] === suit)!
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
const SYM_OF_LETTER: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
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
  for (const c of history) {
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb || cb.strain === 'NT') continue
    // Cue i motståndarnas färg är ingen egen färg att stödja.
    const isTheirSuit = history.some((x) => {
      const xb = parseContractBid(x.bid)
      return xb && xb.strain === cb.strain && side(x.seat) !== side(seat)
    })
    if (isTheirSuit) continue
    found = { strain: cb.strain, level: cb.level }
  }
  return found
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
  // Önskad nivå efter styrka. Utgång bara i högfärg (4-läget); minorutgång (5-läget)
  // blåser vi inte ut här – då stannar vi på inbjudande hopp.
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
  wantLevel = Math.max(wantLevel, partnerSuit.level + 1) // alltid minst ett steg upp

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
  const partnerSuit = partnerLastSuit(history, seat)
  if (!partnerSuit) return null // partnern har inte visat en färg → vi hittar inte på något
  return raiseWithFit(deal, history, seat, partnerSuit) ?? respondWithoutFit(deal, history, seat, partnerSuit)
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
 * Balanseringen använder samma §7-krav som direkt sits (medvetet konservativt –
 * "låna en kung"-lättnaden är en senare förfining).
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

  const res = overcall(deal.hands[seat], open.bid)
  if (res.call === 'P') return null
  if (!legalCalls(history, seat).includes(res.call as Bid)) return null
  const note = balancing ? ' (balansering – utpassningsläget)' : ''
  return { seat, bid: res.call as Bid, rule: res.rule, explanation: res.explanation + note }
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

  // Linjen gäller inte här (slut eller off-book): en upplysningsdubbling från
  // partnern tvingar fram ett svar (partnern får inte lämnas att passa
  // take-out-dubbla bort kontraktet).
  const theirSuit = takeoutDoubleToAnswer(history, seat)
  if (theirSuit) {
    const ans = answerTakeoutDouble(deal.hands[seat], theirSuit)
    if (legalCalls(history, seat).includes(ans.call as Bid)) {
      return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
    }
  }

  // Samma tvång för öppnaren mot partnerns NEGATIVA dubbling (§7.3, rondkrav):
  // öppnaren får aldrig lämnas att passa bort svararens upplysning.
  const neg = negativeDoubleToAnswer(history, seat)
  if (neg) {
    const ans = openerAnswerNegativeDouble(deal.hands[seat], neg.ourOpen, neg.theirCall)
    if (legalCalls(history, seat).includes(ans.call as Bid)) {
      return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
    }
  }

  // Partnerns FJÄRDE FÄRG (§6.6) är utgångskrav – öppnaren svarar alltid
  // (stöd / extra längd / NT med stopp / höjning), passar aldrig.
  const fourth = fourthSuitToAnswer(history, seat)
  if (fourth) {
    const ans = openerAnswerFourthSuit(
      deal.hands[seat], fourth.opened, fourth.second, fourth.responderSuit, fourth.fourth,
    )
    if (legalCalls(history, seat).includes(ans.call as Bid)) {
      return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
    }
  }

  // Häng med och svara historiedrivet när linjen inte styr oss längre:
  // off-book (Syd bjöd eget), eller en öppen konkurrensauktion som linjen bara
  // modellerat en rond av.
  const lineExhaustedOpen = !offBook && history.length >= line.length && built.open
  if (offBook || lineExhaustedOpen) {
    // Motståndarna kliver in på riktigt (direkt sits eller balansering)
    // i stället för att tystna.
    const oc = maybeOvercall(deal, history, seat)
    if (oc) return oc

    // Partnerns TVÅFÄRGSINKLIV (Michaels / ovanlig 2NT, §7.2) besvaras med
    // preferens via advanceTwoSuiter – verktyget fanns (FAS 10) men var aldrig
    // inkopplat i live-flödet, så auktionen dog (felrapport #7). Även
    // advancerns medvetna pass (contested, svag utan fit) går den här vägen.
    const twoSuiter = partnerTwoSuiterToAnswer(history, seat)
    if (twoSuiter) {
      const ans = advanceTwoSuiter(
        deal.hands[seat], twoSuiter.partnerCall, twoSuiter.theirSuit, twoSuiter.contested,
      )
      if (legalCalls(history, seat).includes(ans.call as Bid)) {
        return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
      }
    }

    // Ett EGET dubblat tvåfärgsinkliv får aldrig passas ut (felrapport #7):
    // budet är konstgjort – utan preferens från partnern flyr vi till den
    // längsta visade färgen.
    const rescue = ownDoubledTwoSuiterRescue(deal, history, seat)
    if (rescue) return rescue

    // Partnerns 4NT med överenskommen trumf är ESSFRÅGAN (1430 RKC, §6.1) och
    // får aldrig passas (felrapport #9: 4NT blev spelat kontrakt). 5NT därefter
    // är kungfrågan (Sjöberg, §6.3) – svara alltid.
    const rkcTrump = rkcToAnswer(history, seat)
    if (rkcTrump) {
      const ans = respondToRKC(deal.hands[seat], rkcTrump)
      if (legalCalls(history, seat).includes(ans.call as Bid)) {
        return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
      }
    }
    const kingTrump = kingAskToAnswer(history, seat)
    if (kingTrump) {
      const ans = respondToKingAsk(deal.hands[seat], kingTrump)
      if (legalCalls(history, seat).includes(ans.call as Bid)) {
        return { seat, bid: ans.call as Bid, rule: ans.rule, explanation: ans.explanation }
      }
    }

    // Straffdubbla motståndarnas höga färgkontrakt när handen sätter det
    // (poängarbetet 2026-07-04): 2+ säkra trumfstick + 10+ hp, och bara när
    // X:et omöjligt kan läsas som en konventionell dubbling.
    const pen = maybePenaltyDouble(deal, history, seat)
    if (pen) return pen

    // Partnerns 3NT efter fullföljd transfer = VÄLJ UTGÅNG (felrapport #13):
    // 4 i högfärgen med 3-korts stöd, annars pass (3NT står). Måste ligga FÖRE
    // det generella off-book-svaret, som annars läser transferns relä som en
    // naturlig färg och "stöder" den.
    const transferMajor = transferGameChoiceToAnswer(history, seat)
    if (transferMajor) {
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

    const response = offBookResponse(deal, history, seat)
    if (response) return response
  }

  return pass
}
