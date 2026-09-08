// Logiklagret bakom budlådan i "Spela kort": en LEVANDE budgivning som växer ett
// bud i taget runt bordet, i stället för en färdiggenererad auktion.
//
// Fyra rena, testbara delar:
//   - legalCalls       – vilka bud som är tillåtna just nu (bridge-reglerna)
//   - auctionComplete  – är budgivningen slut (tre pass efter ett bud / passat ut)?
//   - contractFromCalls – slutkontraktet ur en färdig budföljd (spelförare m.m.)
//   - decideCall       – "bot-hjärnan": vad bjuder datorn på en plats just nu?
//
// `decideCall` frågar FÖRST beslutstabellen (`auction-decide.ts`: egen hand +
// auktionen → ett bud, motorbytet etapp 3). Täcker tabellen inte läget tar det
// gamla lagret vid: manusets konkurrensrond (`buildAuction`, spelas upp bud
// för bud så länge historiken följer den) och detektorkedjan. Sedan familj 6
// (2026-09-05) avgör manuset inga bud i ostörda auktioner — bara `open`.

import type { Bid, Deal, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideFromTable } from './auction-decide'
import { turnsToCalls } from './auction-contract'
import { allContractBids, bidValue, cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { isVulnerable } from './openings'
import {
  auctionFacts, isGameOrHigher, parseContractBid, strainRank, PARTNER, STRAINS, SUIT_OF_LETTER, SUIT_STRAINS,
  type AuctionFacts,
} from './auction-facts'
import { penaltyDouble } from './doubles'
import { raiseWithFit as raisePartnerSuit } from './fit-raise'
import { advanceDONT } from './dont'
import { answerNTInterference, answerPreemptInterference } from './contested-openings'
import { lebensohlAfter1NT, lebensohlAfter1NTRebid } from './lebensohl'
import { defendPreempt } from './defense-conventional'
import { openerAnswerFourthSuit, openerAnswerNMF, openerRebidAfter1NTResponse, openerRebidAfter2over1, openerThirdBidAfterOwnRaise } from './rebids'
import { respondTo1NT } from './responses-nt'
import { openerRebidAfter2NTResponse, respondTo2NT } from './responses-2nt'
import { responderPlaceAfterNMF } from './responder-rebids'
import type { Major } from './responses'
import { pointsWithFloor } from './evaluation'
import { hcp, isBalanced, lengths, suitHcp } from './hand'
import { hasStopper } from './overcalls'
import { cueBidderContinues, ntResponseRule } from './overcall-continuations'
import { side, NEXT_SEAT } from './play'
import { keycards, respondToKingAsk, respondToRKC } from './slam'

// ---- Bridge-reglerna ------------------------------------------------------
// Utbrutna till `auction-rules.ts` (etapp 4 familj 1, 2026-09-08) så att
// beslutstabellen och dess kunskapsmoduler når `legalCalls` utan att importera
// det gamla lagret. Re-exporteras här så budlådans användare inte märker det.
export { auctionComplete, legalCalls, seatToAct } from './auction-rules'

// ---- Slutkontraktet ur en färdig budföljd ---------------------------------

// EN sanningskälla: härledningen bor i auction-contract.ts (delas med
// `finalContract`). Re-exporteras här så budlådans användare (Play.tsx m.fl.)
// hittar den bland de övriga auktionsverktygen.
export { contractFromCalls } from './auction-contract'

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
  f: AuctionFacts,
): { opened: Suit; second: Suit; responderSuit: Suit; fourth: Suit } | null {
  const { history, seat } = f
  if (f.opponentsHaveBid) return null // stört → fjärde färg gäller inte
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null

  // Kontraktsbuden ska vara exakt: vår öppning, partnerns svar, vårt återbud,
  // partnerns fjärde färg – alla i färg, de tre första på 1-läget.
  const bids = f.contractBids
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
  f: AuctionFacts,
): { opened: Suit; responderMajor: Suit; nmfMinor: Suit; unbidSuit: Suit } | null {
  const { history, seat } = f
  if (f.opponentsHaveBid) return null // stört → NMF gäller inte
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null

  const bids = f.contractBids
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
  f: AuctionFacts,
): { opened: Suit; responderMajor: Suit; otherMajor: Suit; nmfMinor: Suit; unbidSuit: Suit; answer: { level: number; strain: string } } | null {
  const { history, seat } = f
  if (f.opponentsHaveBid) return null
  const bids = f.contractBids
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

// ---- Essfrågan 4NT (1430 RKC) i den levande auktionen -----------------------

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
function slamAskTrump(f: AuctionFacts): Suit | null {
  const { history, seat } = f
  const agreed = f.agreedTrump
  if (agreed) return agreed
  const jacoby = f.jacobyTrump
  if (jacoby) return jacoby
  const askIdx = history.findIndex((c) => c.seat === PARTNER[seat] && c.bid === '4NT')
  if (askIdx < 0) return null
  for (let i = askIdx - 1; i >= 0; i--) {
    const c = history[i]
    if (side(c.seat) !== side(seat)) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    if (cb.strain === 'NT') return null // sidans senaste bud var sang → kvantitativt
    if (f.theirStrains.has(cb.strain)) continue // cue, ingen egen färg
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
function rkcToAnswer(f: AuctionFacts): Suit | null {
  const { seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '4NT') return null
  return slamAskTrump(f)
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
function transferGameChoiceToAnswer(f: AuctionFacts): Suit | null {
  const { seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null

  // Auktionens kontraktsbud i exakt denna ordning, alla från vår sida:
  // NT-öppning, relä, fullföljd transfer, 3NT.
  const bids = f.contractBids
  if (bids.length !== 4 || f.opponentsHaveBid) return null
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
function kingAskToAnswer(f: AuctionFacts): Suit | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '5NT') return null
  if (!history.some((c) => c.seat === PARTNER[seat] && c.bid === '4NT')) return null
  return slamAskTrump(f)
}

/**
 * RÄTTELSEN över stoppbudet (felrapport #60, §6.1): jag svarade 5♣/5♦ på
 * partnerns 4NT-essfråga (1 eller 4 / 0 eller 3), partnern stannade i 5-trumf,
 * och jag sitter med det HÖGA antalet. Stoppbudet betyder "pass med det låga,
 * bjud vidare med det höga" — annars säljs lillslammen (Nord passade 5♥ med
 * fyra nyckelkort). Mekaniken fanns i den kanoniska linjen
 * (`slam-auction.ts`, "RKC: rättelse") men saknades i budlådan. Positionsexakt:
 * partnerns 4NT → mitt 5♣/5♦ → partnerns 5-trumf → (bara pass). Returnerar
 * trumf + det höga antalet, annars null.
 */
function rkcSignoffCorrectionToBid(f: AuctionFacts, hand: Hand): { trump: Suit; high: number } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat]) return null
  let i = history.lastIndexOf(lastNonPass) - 1
  while (i >= 0 && history[i].bid === 'P') i--
  const answer = history[i]
  if (!answer || answer.seat !== seat || (answer.bid !== '5C' && answer.bid !== '5D')) return null
  let j = i - 1
  while (j >= 0 && history[j].bid === 'P') j--
  const ask = history[j]
  if (!ask || ask.seat !== PARTNER[seat] || ask.bid !== '4NT') return null
  const trump = slamAskTrump(f)
  if (!trump || lastNonPass.bid !== `5${letterOfSuit(trump)}`) return null
  const high = answer.bid === '5C' ? 4 : 3
  return keycards(hand, trump) === high ? { trump, high } : null
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
function raisePartnerThreeNTToSlam(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null

  const open = f.opening
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
function openerJumpMinorThenResponder3NT(f: AuctionFacts): { minor: string } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null
  const open = f.opening
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
function openerTriesSlamAfter3NT(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const m = openerJumpMinorThenResponder3NT(f)
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
function openerSlamTryToAnswer(f: AuctionFacts): { minor: string } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '4NT') return null
  const open = f.opening
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
function cleanNTOpening(f: AuctionFacts): { seat: Seat; level: number } | null {
  const { history, seat } = f
  const open = f.opening
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
function answerPartnerNTOpening(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = cleanNTOpening(f)
  if (!open || open.seat !== PARTNER[seat]) return null
  if (f.contractBids.length !== 1) return null
  if (history.some((c) => c.seat === seat && c.bid !== 'P')) return null

  const hand = deal.hands[seat]
  const res = open.level === 1 ? respondTo1NT(hand) : respondTo2NT(hand)
  const bid = res.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: res.rule, explanation: res.explanation }
}

/**
 * `seat` öppnade 1NT/2NT off-book och partnern har svarat med ett systemsvar som
 * väntar på öppnarens återbud (Stayman-svar, fullföljd transfer/Texas, MSS-svar,
 * accept/avböj av inbjudan). Exakt två kontraktsbud i historiken: vår öppning +
 * partnerns svar.
 */
function openerAnswersNTResponse(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = cleanNTOpening(f)
  if (!open || open.seat !== seat) return null
  const bids = f.contractBids
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

// ---- Off-book: svara historiedrivet på Syds egna bud (pivotens kärna) -------
//
// När Syd bjudit utanför systemlinjen (off-book) har partnern ingen kanonisk
// fortsättning. I stället för att tappa tråden och passa svarar vi som en
// förnuftig partner skulle: stöd partnerns färg om vi har fit (graderat efter
// styrka), annars en egen färg eller sang. Allt utläst ur historiken + den egna
// handen – aldrig ur den (nu ogiltiga) ideallinjen. Medvetet konservativt; varje
// regel ska vara TYDLIGT korrekt även om den är smal.

/**
 * Höjningen av partnerns färg med fit — kunskapen bor i `fit-raise.ts` (etapp 4
 * familj 3, 2026-09-08) så beslutstabellen läser samma dom; här bara
 * detektorformen (egen hand + fakta ur kontexten).
 */
function raiseWithFit(c: DetectorCtx, partnerSuit: { strain: string; level: number }): ResolvedCall | null {
  return raisePartnerSuit(c.hand, c.facts, partnerSuit)
}

/**
 * Inget fit för partnern: bjud en egen 4+ färg (billigaste läge) eller en
 * balanserad sang. Bara när partnern redan bjudit (det är VÅR sidas auktion) –
 * vi hittar inte på inkliv från intet här (det hör till §7-försvaret).
 */
function respondWithoutFit(
  c: DetectorCtx,
  partnerSuit: { strain: string; level: number },
): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const hand = deal.hands[seat]
  const points = hcp(hand)
  if (points < 6) return null // för svagt för att svara
  const len = lengths(hand)

  // (1) Egen 4+ färg – välj längst, sedan billigast. Ny färg = inte partnerns,
  // inte motståndarnas, inte en vi redan bjudit.
  const candidates = SUIT_STRAINS.filter((st) => {
    if (st === partnerSuit.strain) return false
    if (f.theirStrains.has(st)) return false
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
  if (!f.opponentsHaveBid && isBalanced(hand)) {
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
function offBookResponse(c: DetectorCtx): ResolvedCall | null {
  const { history, seat, facts: f } = c
  // Respektera partnerns AVSLUT: står partnerns eget utgångsbud (3NT/4M/5m+)
  // obestritt ska vi inte hitta på en "höjning"/flykt till en annan strain —
  // 5♣-ryckaren (fel färg-spåret fix 1) drog partnerns 3NT till 5♣. Slamsvar
  // (essfrågor m.m.) ligger i egna detektorer FÖRE denna och berörs inte.
  if (partnerGameBidStandsUnopposed(history, seat)) return null
  const partnerSuit = f.partnerLastSuit
  if (!partnerSuit) return null // partnern har inte visat en färg → vi hittar inte på något
  return raiseWithFit(c, partnerSuit) ?? respondWithoutFit(c, partnerSuit)
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

/**
 * Ett naturligt MINIMIBUD som hedrar ett krav (aldrig pass). Prioritet:
 *   1. rebjud en egen 5+ färg vi redan visat (visar verklig längd),
 *   2. stöd en färg partnern visat (3+ kort), billigast,
 *   3. en ny 4+ färg, billigast (längst, sedan lägst),
 *   4. billigaste sang,
 *   5. sista utväg: billigaste lagliga kontraktsbud (kravet får aldrig brytas).
 */
function forcedMinimumBid(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
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
  const ps = f.partnerLastSuit
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
      !f.theirStrains.has(st) &&
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
function placeGameAfterFourthSuit(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const contractBids = f.contractBids
  if (f.opponentsHaveBid) return null // ostört
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
function honorForce(c: DetectorCtx): ResolvedCall | null {
  const { facts: f } = c
  if (!f.force) return null
  return forcedMinimumBid(c)
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
function respondToStrong2NTRebid(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const contractBids = f.contractBids
  if (contractBids.length !== 3) return null
  if (f.opponentsHaveBid) return null // ostört
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
  f: AuctionFacts,
): { agreedStrain: string; theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat) || seat !== open.seat) return null // vår öppning, öppnaren svarar
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null // öppning + partnerns bud
  const cue = ourBids[1]
  const cueStrain = parseContractBid(cue.bid)!.strain
  if (cueStrain === 'NT') return null
  const oppStrains = f.theirStrains
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
function partnerWeakTwoCueToAnswer(f: AuctionFacts): { theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.level !== 2 || open.strain === 'C' || open.strain === 'NT') return null
  if (side(open.seat) === side(seat)) return null // motståndarnas svaga tvåa
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== PARTNER[seat]) return null
  const cue = ourBids[0]
  const cb = parseContractBid(cue.bid)!
  if (cb.level !== 3 || cb.strain !== open.strain) return null // cue = 3 i deras färg
  const cueIdx = history.indexOf(cue)
  if (history.slice(cueIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter
  return { theirStrain: open.strain }
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
function maybePenaltyDouble(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  const cb = parseContractBid(lastNonPass.bid)
  if (!cb || cb.strain === 'NT' || cb.level < 3) return null

  const ourContractBids = f.ourContractBids
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
function partnerDONTToAnswer(f: AuctionFacts): string | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || side(open.seat) === side(seat)) return null
  const lastNonPass = f.lastNonPass
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
function ownDONTXToCorrect(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
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
function ownDONTTwoSuiterToCorrect(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
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
function ntInterferenceToAnswer(f: AuctionFacts): string | null {
  const { seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null // måste vara VÅRT 1NT
  if (seat !== PARTNER[open.seat]) return null // seat = svararen (öppnarens partner)
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1) return null // bara 1NT bjudet av oss (svararens FÖRSTA svar)
  const lastNonPass = f.lastNonPass
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
function ntValueDoubleOpenerToAnswer(f: AuctionFacts): { theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // öppnaren själv
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1) return null // vi har bara bjudit 1NT
  const lastNonPass = f.lastNonPass
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
function answerNTValueDoubleOpener(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const ctx = ntValueDoubleOpenerToAnswer(f)
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
function ntValueDoubleDoublerToAnswer(f: AuctionFacts): { openerBid: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat) || seat !== PARTNER[open.seat]) return null // dubblaren
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null // 1NT + öppnarens beskrivande bud
  const myLastNonPass = [...history.filter((c) => c.seat === seat)].reverse().find((c) => c.bid !== 'P')
  if (!myLastNonPass || myLastNonPass.bid !== 'X') return null // jag dubblade
  const openerBids = history.filter((c) => c.seat === open.seat && parseContractBid(c.bid))
  if (openerBids.length !== 2) return null
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== open.seat) return null // öppnarens svar är senast (LHO passade)
  return { openerBid: openerBids[1].bid }
}

/** Svararen placerar: 3NT med 11+, annars pass; över en visad färg — fit → höj, annars 3NT/pass. */
function answerNTValueDoubleDoubler(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const ctx = ntValueDoubleDoublerToAnswer(f)
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
function naturalOvercallOf1NT(f: AuctionFacts): { suit: Suit; seat: Seat } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null // måste vara VÅRT 1NT
  const over = history.find((c) => c.rule === 'naturligt inkliv (1NT)' && side(c.seat) !== side(seat))
  if (!over) return null
  const m = /^2([CDHS])$/.exec(over.bid)
  if (!m) return null
  return { suit: SUIT_OF_LETTER[m[1]], seat: over.seat }
}

/** Svararens FÖRSTA Lebensohl-bud (deras naturliga inkliv ligger kvar). */
function lebensohl1NTFirstToAnswer(f: AuctionFacts): Suit | null {
  const { seat } = f
  const open = f.opening
  if (!open || seat !== PARTNER[open.seat]) return null // svararen (öppnarens partner)
  const nat = naturalOvercallOf1NT(f)
  if (!nat) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1) return null // bara 1NT bjudet av oss
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== nat.seat) return null // deras inkliv är senast
  return nat.suit
}

/** Öppnaren tvingas 3♣ över svararens 2NT-relä. */
function lebensohl1NTRelayComplete(f: AuctionFacts): ResolvedCall | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.seat !== seat) return null // öppnaren själv
  if (!naturalOvercallOf1NT(f)) return null
  const partnerBids = history.filter((c) => c.seat === PARTNER[seat] && parseContractBid(c.bid))
  if (partnerBids.length === 0 || partnerBids[partnerBids.length - 1].bid !== '2NT') return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1) return null // bara 1NT hittills
  if (!legalCalls(history, seat).includes('3C' as Bid)) return null
  return { seat, bid: '3C' as Bid, rule: 'Lebensohl 3♣ (tvunget relä-svar)', explanation: 'partnerns 2NT var Lebensohl-relä → jag måste bjuda 3♣.' }
}

/** Svararens rättelse (pass/ny färg) efter öppnarens tvungna 3♣. */
function lebensohl1NTRebidToAnswer(f: AuctionFacts): Suit | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || seat !== PARTNER[open.seat]) return null
  const nat = naturalOvercallOf1NT(f)
  if (!nat) return null
  const ourBids = history.filter((c) => c.seat === seat && parseContractBid(c.bid))
  if (ourBids.length !== 1 || ourBids[0].bid !== '2NT') return null // vi bjöd 2NT
  const openerBids = history.filter((c) => c.seat === open.seat && parseContractBid(c.bid))
  if (openerBids[openerBids.length - 1]?.bid !== '3C') return null // öppnaren svarade 3♣
  return nat.suit
}

/** Öppnarens fortsättning efter svararens DIREKTA 3-läges krav (GF): major-fit → utgång, annars 3NT. */
function lebensohl1NTGFToAnswer(f: AuctionFacts): Suit | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.seat !== seat) return null // öppnaren
  if (!naturalOvercallOf1NT(f)) return null
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
  f: AuctionFacts,
): { ourSuit: Suit; ourLevel: number; theirCall: string } | null {
  const { seat } = f
  const open = f.opening
  if (!open) return null
  const ourSuit = SUIT_OF_LETTER[open.strain]
  if (!ourSuit) return null // 1NT/2NT-öppning – hanteras inte här
  const isWeakTwo = open.level === 2 && open.strain !== 'C' // 2♣ = stark, ej svag tvåa
  const isPreempt = open.level >= 3
  if (!isWeakTwo && !isPreempt) return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  if (seat !== PARTNER[open.seat]) return null // seat = svararen (öppnarens partner)
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1) return null // bara öppningen bjuden av oss (svararens FÖRSTA svar)
  const lastNonPass = f.lastNonPass
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
function runoutAfterOurRedouble(f: AuctionFacts): { suit: Suit; level: number } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1) return null
  if (side(open.seat) !== side(seat)) return null // måste vara VÅRT 1NT
  if (!history.some((c) => side(c.seat) === side(seat) && c.bid === 'XX')) return null
  const lastNonPass = f.lastNonPass
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
function answerTransferGameChoice(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const transferMajor = transferGameChoiceToAnswer(f)
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
function answerRunout(f: AuctionFacts): ResolvedCall | null {
  const { seat } = f
  const runout = runoutAfterOurRedouble(f)
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
function answerCueRaise(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const cueRaise = partnerCueRaiseToAnswer(f)
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
function answerWeakTwoCue(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const wtCue = partnerWeakTwoCueToAnswer(f)
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
 * Öppnarens ÅTERBUD efter partnerns 2-ÖVER-1 när linjen inte styr (felrapport
 * #58, bricka 4: 1♦–P–2♣–P–?). Motorns linje hade valt ett annat svar för Syds
 * hand (inverterad 2♦), så människans 2♣ blev off-book och Nords återbud
 * byggdes av det generella off-book-svaret som ett SVARAR-bud ("2 sang,
 * 11–12 hp, inget stöd") — utan regel, utan utgångskrav. Ett äkta 2/1
 * (ostört, opassad svarare, ny LÄGRE färg på 2-läget) är utgångskrav i hela
 * systemet (§4.2), och öppnarens återbud följer §5.3: stöd = fit, ny färg =
 * form, 2NT = balanserad utan extra form (12–15). Samma on-book-funktion
 * (`openerRebidAfter2over1`) används här, så budet får regel + kravnivå.
 */
function openerRebidAfterPartnersTwoOverOne(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  if (f.opponentsHaveBid) return null // ostört
  const open = f.opening
  if (!open || open.seat !== seat || open.level !== 1 || open.strain === 'NT') return null
  const responder = PARTNER[seat]
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids[1].seat !== responder) return null
  const respC = ourBids[1]
  const rb = parseContractBid(respC.bid)!
  if (rb.strain === 'NT' || rb.level !== 2 || rb.strain === open.strain) return null
  const openRank = SUIT_STRAINS.indexOf(open.strain as (typeof SUIT_STRAINS)[number])
  const respRank = SUIT_STRAINS.indexOf(rb.strain as (typeof SUIT_STRAINS)[number])
  if (openRank < 0 || respRank < 0 || respRank >= openRank) return null // högre rang = inget 2/1
  const respIdx = history.indexOf(respC)
  if (history.slice(0, respIdx).some((c) => c.seat === responder && c.bid === 'P')) return null // passad hand: ej GF
  if (history.slice(respIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter svaret
  const res = openerRebidAfter2over1(
    deal.hands[seat],
    SUIT_OF_LETTER[open.strain as keyof typeof SUIT_OF_LETTER],
    SUIT_OF_LETTER[rb.strain as keyof typeof SUIT_OF_LETTER],
  )
  const bid = res.call as Bid
  if (!legalCalls(history, seat).includes(bid)) return null
  return { seat, bid, rule: res.rule, explanation: `Partnerns 2-över-1 är utgångskrav; ${res.explanation}` }
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
function twoOverOneRaiseToAnswer(f: AuctionFacts): { strain: string } | null {
  const { history, seat } = f
  // Ostört: motståndarna får inte ha gjort något kontraktsbud (då gäller ej rent 2/1).
  if (f.opponentsHaveBid) return null
  const open = f.opening
  if (!open || open.level !== 1 || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  const opener = open.seat
  const responder = PARTNER[opener]
  if (seat !== responder) return null // svararen (2/1-budaren) själv placerar
  const ourBids = f.ourContractBids
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
function answerTwoOverOneRaise(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const info = twoOverOneRaiseToAnswer(f)
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
  const open = f.opening!
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
 * Cue-bjudaren fullföljer utgångskravet efter ÖPPNARENS svar (felrapport #26,
 * fix 6 mönster 4). Kunskapen delas med inklivsfallet (raden *advance2* i
 * tabellen) och bor i `overcall-continuations.ts`; kvar här tills familj 4
 * (svararens fortsättning i konkurrens) flyttar in i tabellen.
 */
function answerCueBidderRebid(c: DetectorCtx): ResolvedCall | null {
  return answered(cueBidderContinues(c.hand, c.facts, 'öppnare'), (k) => k, c.history, c.seat)
}

/**
 * Öppnarens ROND-2-beslut i det INKLÄMDA konkurrensläget efter partnerns enkla
 * högfärgshöjning (R1 Fynd #2, delbit 6). Mönster: VÅR 1-högfärgsöppning (1♥/1♠),
 * ett inkliv, partnern höjde till 2M (enkel höjning, 6–9), och motståndarna
 * konkurrerade så att ett cue-bud i deras färg skulle hamna ÖVER 3M (inget
 * avböjnings-utrymme under utgång). Då används MAXIMAL DUBBLING: X = game try.
 * Returnerar { major } när mönstret + den inklämda triggern gäller, annars null.
 */
function openerMaximalToAnswer(f: AuctionFacts): { major: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || (open.strain !== 'H' && open.strain !== 'S') || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR öppning, ÖPPNAREN själv svarar
  const M = open.strain
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null // öppning + partnerns höjning
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== M || raise.level !== 2) return null // partnerns ENKLA höjning 2M
  // Motståndarna gjorde det SENASTE kontraktsbudet (de konkurrerade) i en färg.
  const contractBids = f.contractBids
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
function openerCompetesAfterRaise(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const m = openerMaximalToAnswer(f)
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
function answerOpenerMaximal(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
  if (!open || (open.strain !== 'H' && open.strain !== 'S') || open.level !== 1) return null
  if (open.seat !== PARTNER[seat]) return null // partnern (öppnaren) dubblade; JAG (svararen) svarar
  const M = open.strain
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null // öppning + min höjning (X är inget kontraktsbud)
  if (ourBids[0].seat !== PARTNER[seat] || ourBids[1].seat !== seat) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== M || raise.level !== 2) return null // min ENKLA höjning
  // Öppnarens senaste icke-pass-call = X (game try).
  const lastCall = f.lastNonPass
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
function answerOpenerNTInvite(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
  if (!open || (open.strain !== 'C' && open.strain !== 'D') || open.level !== 1) return null
  if (open.seat !== PARTNER[seat]) return null // partnern (öppnaren) bjöd inbjudan; JAG svarar
  // Vår sida: öppning(partner) + min höjning(jag) + 2NT-inbjudan(partner) = 3 kontraktsbud.
  const ourBids = f.ourContractBids
  if (ourBids.length !== 3) return null
  if (ourBids[0].seat !== PARTNER[seat] || ourBids[1].seat !== seat || ourBids[2].seat !== PARTNER[seat]) return null
  if (parseContractBid(ourBids[0].bid)!.strain !== open.strain) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== open.strain || raise.level !== 2) return null // min ENKLA minorhöjning
  if (ourBids[2].bid !== '2NT') return null // öppnarens inbjudan
  // Öppnarens SENASTE icke-pass-call måste vara just 2NT-inbjudan (ingen ny konkurrens sedan).
  const lastCall = f.lastNonPass
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
function openerStrongNTAfterMinorRaise(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
  if (!open || (open.strain !== 'C' && open.strain !== 'D') || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR minoröppning, ÖPPNAREN själv agerar
  const contractBids = f.contractBids
  // Vår sida: EXAKT öppning + partnerns höjning av samma minor (öppnaren ej rebjudit).
  const ourBids = f.ourContractBids
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
 * Felrapport #55 (del 2): ÖPPNAREN höjer partnerns fria HÖGFÄRGSBUD på 3-korts
 * stöd — budet lovar 5+ (den negativa dubblingen tar 4-kortsfallet), så 3+3
 * … 5+3 = fit. Skalan är öppnarens (§5.2, ren hp som on-book-syskonet
 * `openerRebidAfter1LevelResponse`): 12–15 enkel höjning, 16–18 hopphöjning
 * (inbjudan), 19+ utgång. Bara när det fria budet
 * står som senaste kontraktsbud (bjuder de över gäller §5.8-logiken).
 * (Giv 2: 1♦–(1♥)–1♠–P: öppnaren bjöd 2♣ på ♠AJ9 — 2♠ är rätt, spader var hemma.)
 */
function openerRaisesFreeBid(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const ctx = f.freeBid
  if (!ctx || ctx.opener !== seat || ctx.contracts.length !== 3) return null
  const freeCall = ctx.contracts[2]
  if (history.slice(history.indexOf(freeCall) + 1).some((c) => c.bid !== 'P')) return null
  const strain = ctx.free.strain
  const suit = SUIT_OF_LETTER[strain]
  const hand = deal.hands[seat]
  if (lengths(hand)[suit] < 3) return null
  const tp = hcp(hand)
  const legal = legalCalls(history, seat)
  const simple = cheapestBidIn(history, seat, strain)
  if (!simple) return null
  const simpleLevel = parseContractBid(simple)!.level
  // Pliktsvepet K5 (2026-09-02): ett fritt LÅGFÄRGSBUD på 2-läget (5+, 10+).
  // Förr föll öppnaren till off-book-höjningen, som blåste 5♣ på 13 hp och
  // 4-korts stöd (frö 20261396: 1♥–(1♠)–2♣–P–5♣). Nu: 12–13 → 3m (enkel
  // höjning, partnern går vidare med extra); 14+ → 3NT med stopp i deras
  // färg, annars 4m (hopphöjning = inbjudan till 5m, visar extra).
  if (strain === 'C' || strain === 'D') {
    if (ctx.free.level < 2) return null
    const theirStrain = parseContractBid(ctx.contracts[1].bid)!.strain
    if (tp >= 14 && hasStopper(hand, SUIT_OF_LETTER[theirStrain]) && legal.includes('3NT' as Bid)) return {
      seat, bid: '3NT', rule: 'höjning av fritt bud (utgång)',
      explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]} (10+ hp); stöd, utgångsvärden och stopp i deras ${SWE_SYM[theirStrain]} → 3NT (rätt utgång före 5${SWE_SYM[strain]}).`,
    }
    const jump = `${simpleLevel + 1}${strain}` as Bid
    if (tp >= 14 && simpleLevel + 1 <= 4 && legal.includes(jump)) return {
      seat, bid: jump, rule: 'höjning av fritt bud (inbjudan)',
      explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]}; stöd och extra utan stopp i deras ${SWE_SYM[theirStrain]} → hopphöjning ${prettyBid(jump)} (inbjudan till 5${SWE_SYM[strain]}).`,
    }
    if (!legal.includes(simple)) return null
    return {
      seat, bid: simple, rule: 'höjning av fritt bud',
      explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]} (10+ hp); 3+ stöd → ${prettyBid(simple)} (enkel höjning, minimum 12–13).`,
    }
  }
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
function responderAfterFreeBidRaise(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const ctx = f.freeBid
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
function openerAnswersFreeBidInvite(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const ctx = f.freeBid
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

function openerRondTwoInCompetition(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR färgöppning, ÖPPNAREN själv agerar
  const contractBids = f.contractBids
  // Vår sida ska ha bjudit exakt öppning + partnerns svar (öppnaren har ej rebjudit).
  const ourBids = f.ourContractBids
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
    if (f.theirStrains.has(resp.strain)) return null // cue i deras färg är ingen ny färg
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
function openerReopensAfterPartnerPass(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR färgöppning, ÖPPNAREN själv agerar
  const contractBids = f.contractBids

  // Vår sida ska ha bjudit EXAKT öppningen (partnern passade, öppnaren ej rebjudit).
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null

  // Ingen motståndardubbling i bilden – då är det den starka-dubblings-/straff-
  // världen (felrapport #23), INTE en naturlig inklivskonkurrens.
  if (history.some((c) => (c.bid === 'X' || c.bid === 'XX') && side(c.seat) !== side(seat))) return null
  // Motståndarna ska ha gjort MINST två kontraktsbud: LHO-inkliv + RHO-konkurrens
  // (annars är det inte det här mönstret – t.ex. bara ett svar på en dubbling).
  const theirBids = f.theirContractBids
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
function openerReopensBalancing(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const open = f.opening
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null // VÅR färgöppning, ÖPPNAREN själv agerar

  // Vår sida ska ha bjudit EXAKT öppningen (partnern passade, öppnaren ej rebjudit).
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null

  // Ingen motståndardubbling i bilden (då är det en annan värld – straff/starkt X).
  if (history.some((c) => (c.bid === 'X' || c.bid === 'XX') && side(c.seat) !== side(seat))) return null

  // Motståndarna ska ha gjort EXAKT ETT kontraktsbud: LHO:s inkliv, nu passat runt
  // till öppnaren i utpassningssitsen (RHO passade). Öppnarens LHO = NEXT_SEAT[seat].
  const theirBids = f.theirContractBids
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
  /** Auktionsläget (faktalagret, etapp 2) – räknas EN gång per beslut. */
  facts: AuctionFacts
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
  // Partnerns FJÄRDE FÄRG (§6.6, utgångskrav): öppnaren svarar alltid.
  { id: 'fourthSuitToAnswer',
    run: (c) => answered(fourthSuitToAnswer(c.facts),
      (f) => openerAnswerFourthSuit(c.hand, f.opened, f.second, f.responderSuit, f.fourth), c.history, c.seat) },
  // Min EGEN fjärde färg har besvarats — placera utgång, passa aldrig kravet.
  { id: 'placeGameAfterFourthSuit',
    run: (c) => placeGameAfterFourthSuit(c) },
  // Partnerns NEW MINOR FORCING (§5.7, krav): öppnaren svarar alltid.
  { id: 'nmfToAnswer',
    run: (c) => answered(nmfToAnswer(c.facts),
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
  // Partnerns DONT-bud mot deras 1NT besvaras (§7.5, Fynd #2 delbit 1) …
  { id: 'partnerDONTToAnswer',
    run: (c) => answered(partnerDONTToAnswer(c.facts),
      (d) => advanceDONT(c.hand, d), c.history, c.seat) },
  // … och vår egen DONT-X rättas till sin riktiga färg efter partnerns relä.
  { id: 'ownDONTXToCorrect',
    run: (c) => ownDONTXToCorrect(c) },
  // … och vårt egna DONT-tvåfärgsbud (2♣/2♦) rättas till den högre färgen när
  // partnern relä:at pass-eller-rätta (felrapport #20).
  { id: 'ownDONTTwoSuiterToCorrect',
    run: (c) => ownDONTTwoSuiterToCorrect(c) },
  // Etapp 7 hål 2 ("3NT-stoppen"): öppnaren trevar 4NT efter svararens 3NT,
  // och svararen accepterar/avböjer. Måste ligga FÖRE rkcToAnswer så den
  // kvantitativa 4NT:n (ingen trumf agreed) inte läses som essfråga, och
  // FÖRE off-book-svaret som annars passar bort trevaren.
  { id: 'openerTriesSlamAfter3NT', before: ['rkcToAnswer', 'offBookResponse'],
    run: (c) => openerTriesSlamAfter3NT(c) },
  { id: 'openerSlamTryToAnswer', before: ['rkcToAnswer', 'offBookResponse'],
    run: (c) => answered(openerSlamTryToAnswer(c.facts),
      (s) => answerOpenerSlamTry(c.hand, s.minor), c.history, c.seat) },
  // Partnerns 4NT med trumf = ESSFRÅGAN (1430 RKC, §6.1); 5NT = kungfrågan
  // (Sjöberg, §6.3). Får aldrig passas (felrapport #9).
  { id: 'rkcToAnswer',
    run: (c) => answered(rkcToAnswer(c.facts),
      (trump) => respondToRKC(c.hand, trump), c.history, c.seat) },
  { id: 'kingAskToAnswer',
    run: (c) => answered(kingAskToAnswer(c.facts),
      (trump) => respondToKingAsk(c.hand, trump), c.history, c.seat) },
  // Partnern stannade i 5-trumf efter mitt tvetydiga svar (5♣ = 1/4, 5♦ = 0/3)
  // och jag har det höga antalet → lyfter själv till 6 (felrapport #60, §6.1).
  { id: 'rkcSignoffCorrection',
    run: (c) => answered(rkcSignoffCorrectionToBid(c.facts, c.hand),
      (d) => ({
        call: `6${letterOfSuit(d.trump)}`,
        rule: 'RKC: rättelse',
        explanation:
          `Mitt svar visade ${d.high === 4 ? '1 ELLER 4' : '0 ELLER 3'} nyckelkort och partnern räknade lågt i sitt stopp — ` +
          `jag har ${d.high} → lyfter till 6${SWE_SYM[letterOfSuit(d.trump)]}.`,
      }), c.history, c.seat) },
  // Öppnarens rond-2 i det INKLÄMDA konkurrensläget + partnerns svar på
  // maximal-dubblingen (R1 Fynd #2 delbit 6). Måste ligga FÖRE
  // maybePenaltyDouble: i det inklämda läget är X reserverat för game try
  // (maximal dubbling) – vi ger medvetet upp straffdubblingen där. Bara det
  // specifika mönstret matchas; annars faller det igenom orört.
  { id: 'answerOpenerMaximal', before: ['maybePenaltyDouble'],
    run: (c) => answerOpenerMaximal(c) },
  { id: 'openerCompetesAfterRaise', before: ['maybePenaltyDouble'],
    run: (c) => openerCompetesAfterRaise(c) },
  // Öppnarens rond-2 när VÅR MINOR höjts i konkurrens och öppnaren har en
  // stark sangduglig hand (felrapport #30): visa styrkan i sang (3NT med 20+,
  // 2NT-inbjudan med 18–19) i stället för ett tyst färgbud som passas ut.
  { id: 'openerStrongNTAfterMinorRaise',
    before: ['openerRondTwoInCompetition', 'maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerStrongNTAfterMinorRaise(c) },
  // Höjaren svarar öppnarens 2NT-inbjudan (felrapport #30): accepterar 3NT
  // med ett maximum, annars pass. FÖRE off-book-svaret (som annars passar).
  { id: 'answerOpenerNTInvite', before: ['offBookResponse'],
    run: (c) => answerOpenerNTInvite(c) },
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
    run: (c) => openerRaisesFreeBid(c) },
  { id: 'responderAfterFreeBidRaise', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => responderAfterFreeBidRaise(c) },
  { id: 'openerAnswersFreeBidInvite', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerAnswersFreeBidInvite(c) },
  { id: 'openerRondTwoInCompetition',
    before: ['openerReopensAfterPartnerPass', 'maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerRondTwoInCompetition(c) },
  // Del A (flerronds): samma rond-2 MEN partnern PASSADE inklivet (sa inget).
  // Öppnaren tävlar försiktigt (egen 6+ färg / återöppnings-X) i stället för
  // att sälja given.
  { id: 'openerReopensAfterPartnerPass', before: ['maybePenaltyDouble', 'offBookResponse'],
    run: (c) => openerReopensAfterPartnerPass(c) },
  // Del B (flerronds): samma men RHO PASSADE inklivet (1M–(inkliv)–P–P) →
  // öppnaren sitter på utpassningen. Återöppnar (X med kort i deras färg /
  // egen 6+ färg) i stället för att sälja given. Partnern gör ofta trap pass.
  { id: 'openerReopensBalancing',
    run: (c) => openerReopensBalancing(c) },
  // Straffdubbla motståndarnas höga färgkontrakt när handen sätter det
  // (poängarbetet 2026-07-04): 2+ säkra trumfstick + 10+ hp.
  { id: 'maybePenaltyDouble',
    run: (c) => maybePenaltyDouble(c) },
  // Partnerns 3NT efter fullföljd transfer = VÄLJ UTGÅNG (felrapport #13).
  // Måste ligga FÖRE off-book-svaret (som annars stöder transferns relä).
  { id: 'answerTransferGameChoice', before: ['offBookResponse'],
    run: (c) => answerTransferGameChoice(c) },
  // Fynd #2 delbit 5 (Case A): efter vårt 1NT + partnerns värde-XX äger vi
  // handen – straffdubbla flykten. Måste ligga FÖRE delbit 4-detektorerna
  // (ntInterference) och off-book-svaret.
  { id: 'answerRunout', before: ['ntInterferenceToAnswer', 'offBookResponse'],
    run: (c) => answerRunout(c.facts) },
  // Lebensohl efter VÅRT 1NT (§7.5): motståndaren klev in NATURELLT. Måste
  // ligga FÖRE ntInterference (DONT) – annars läses det naturliga inklivet
  // som DONT. Diskriminatorn = 'naturligt inkliv (1NT)'-rule på deras bud.
  { id: 'lebensohl1NTFirstToAnswer', before: ['ntInterferenceToAnswer'],
    run: (c) => answered(lebensohl1NTFirstToAnswer(c.facts),
      (their) => lebensohlAfter1NT(c.hand, their), c.history, c.seat) },
  { id: 'lebensohl1NTRelayComplete',
    run: (c) => lebensohl1NTRelayComplete(c.facts) },
  { id: 'lebensohl1NTRebidToAnswer',
    run: (c) => answered(lebensohl1NTRebidToAnswer(c.facts),
      (their) => lebensohlAfter1NTRebid(c.hand, their), c.history, c.seat) },
  { id: 'lebensohl1NTGFToAnswer',
    run: (c) => answered(lebensohl1NTGFToAnswer(c.facts),
      (gf) => lebensohl1NTOpenerAnswerGF(c.hand, gf), c.history, c.seat) },
  // Motståndaren störde VÅR icke-1-färgs-öppning (Fynd #2 delbit 4):
  // svararen svarar. Måste ligga FÖRE off-book-svaret.
  { id: 'ntInterferenceToAnswer', before: ['offBookResponse'],
    run: (c) => answered(ntInterferenceToAnswer(c.facts),
      (i) => answerNTInterference(c.hand, i), c.history, c.seat) },
  { id: 'ownPreemptInterferenceToAnswer', before: ['offBookResponse'],
    run: (c) => answered(ownPreemptInterferenceToAnswer(c.facts),
      (p) => answerPreemptInterference(c.hand, p.ourSuit, p.theirCall, p.ourLevel), c.history, c.seat) },
  // Öppnarens fortsättning efter partnerns VÄRDE-DUBBEL över vårt störda 1NT
  // (felrapport #43): 2NT-relä (förnekar 5-kort) eller visa 5-korts färg, och
  // svararens placering över det. FÖRE off-book-svaret (som gav bar pass →
  // missad utgång eftersom öppnaren saknade all logik här).
  { id: 'answerNTValueDoubleOpener', before: ['offBookResponse'],
    run: (c) => answerNTValueDoubleOpener(c) },
  { id: 'answerNTValueDoubleDoubler', before: ['offBookResponse'],
    run: (c) => answerNTValueDoubleDoubler(c) },
  // Öppnaren svarar partnerns CUE-HÖJNING i motståndarnas färg (felrapport
  // #16): cue = krav, får aldrig passas. Måste ligga FÖRE off-book-svaret.
  { id: 'answerCueRaise', before: ['offBookResponse'],
    run: (c) => answerCueRaise(c) },
  // Advancern svarar partnerns TVÅFÄRGS-CUE över deras svaga tvåa (felrapport
  // #18): krav, får aldrig passas. Måste ligga FÖRE off-book-svaret.
  { id: 'answerWeakTwoCue', before: ['offBookResponse'],
    run: (c) => answerWeakTwoCue(c) },
  // Cue-BJUDAREN fullföljer utgångskravet efter öppnarens svar (felrapport
  // #26): krav, får aldrig passas. answerCueRaise sköter öppnarens svar på
  // cuet; detta är cue-bjudarens svar på det svaret. FÖRE off-book-svaret.
  { id: 'answerCueBidderRebid', before: ['offBookResponse'],
    run: (c) => answerCueBidderRebid(c) },
  // Vårt 2-över-1 var utgångskrav och öppnaren höjde vår färg (felrapport
  // #27): svararen sätter minst utgång, passar aldrig. Uppstår off-book (Syd
  // öppnade svagare handen). Måste ligga FÖRE off-book-svaret (som annars
  // vägrar höja en redan bjuden färg och passar).
  { id: 'answerTwoOverOneRaise', before: ['offBookResponse'],
    run: (c) => answerTwoOverOneRaise(c) },
  // Öppnarens återbud efter partnerns OFF-BOOK 2-över-1 (felrapport #58):
  // §5.3-återbudet med regel + utgångskrav, i stället för off-book-svarets
  // svarar-sang ("11–12 hp, inbjudan"). Måste ligga FÖRE off-book-svaret.
  { id: 'openerRebidAfterPartnersTwoOverOne', before: ['offBookResponse'],
    run: (c) => openerRebidAfterPartnersTwoOverOne(c) },
  // Svararen PLACERAR kontraktet efter öppnarens NMF-svar (§5.7, steg 3).
  // Måste ligga FÖRE off-book-svaret (som annars vägrar re-höja svararens egen
  // högfärg och passar en klar 5-3-fit).
  { id: 'nmfPlacementToAnswer', before: ['offBookResponse'],
    run: (c) => answered(nmfPlacementToAnswer(c.facts),
      (n) => responderPlaceAfterNMF(c.hand, n.responderMajor, n.otherMajor, n.nmfMinor, n.opened, n.unbidSuit, n.answer), c.history, c.seat) },
  { id: 'respondToStrong2NTRebid', before: ['offBookResponse'],
    run: (c) => respondToStrong2NTRebid(c) },
  // Kaptenen höjer partnerns naturliga 3NT till 6NT när slamzonen nås redan
  // mot partnerns visade minimum (felrapport #42). Måste ligga FÖRE
  // off-book-svaret, som skyddar partnerns utgångsbud och därmed passar.
  { id: 'raisePartnerThreeNTToSlam', before: ['offBookResponse'],
    run: (c) => raisePartnerThreeNTToSlam(c) },
  // Sangsystemet när sangöppningen bjudits OFF-BOOK (felrapport #41):
  // svararen får §4.3/§4.4-svaret, öppnaren sitt återbud. Måste ligga FÖRE
  // off-book-svaret (som kräver en visad FÄRG och därför passade ut 1NT)
  // och före honorForce (som läste Stayman-2♣ som "krav – ny färg").
  { id: 'answerPartnerNTOpening', before: ['offBookResponse', 'honorForce'],
    run: (c) => answerPartnerNTOpening(c) },
  { id: 'openerAnswersNTResponse', before: ['offBookResponse', 'honorForce'],
    run: (c) => openerAnswersNTResponse(c) },
  // Generellt historiedrivet off-book-svar (fångar fit/egen färg/sang).
  { id: 'offBookResponse', before: ['honorForce'],
    run: (c) => offBookResponse(c) },
  // SISTA VAKTEN: är vår sida i krav och skulle annars passa → tvinga fram ett
  // naturligt minimibud (grunden bakom "krav får aldrig passas"). Ostörda 2/1,
  // ny färg och reverse; ersätter behovet av en detektor per felrapport.
  { id: 'honorForce',
    run: (c) => honorForce(c) },
]

export function decideCall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall {
  return decideCallTraced(deal, history, seat).call
}

/**
 * Ett bud med sin KÄLLA — var i motorn beslutet togs. Motorbytets mätrigg
 * (docs/motorbyte-plan.md etapp 0): auktionsdumpen skriver källan per bud så
 * att diffen mellan två körningar visar inte bara ATT ett bud ändrats utan
 * vilken väg som tog det, och så att familjernas ordning i etapp 4 kan mätas
 * (hur ofta varje detektor faktiskt avgör ett bud). Källorna:
 *   'tabell:<familj>'      beslutstabellen (auction-decide.ts) — den nya motorn
 *   'ingen öppning'        ingen stol öppnar → alla passar
 *   'manus'                budet lästes ur `buildAuction`-linjen
 *   'väckning'             linjens pass byttes mot väckning efter spärrhöjning
 *   'konkurrens-slam'      competitiveRKCPlace/competitiveSlamTry
 *   'detektor:<id>'        en detektor i FORCED_/CONTESTED_DETECTORS
 *   'pass (ingen regel)'   ingen regel hade något att säga
 * Själva beslutet är oförändrat — `decideCall` är bara `.call` av detta.
 */
export interface TracedCall {
  call: ResolvedCall
  källa: string
}

export function decideCallTraced(deal: Deal, history: ResolvedCall[], seat: Seat): TracedCall {
  const pass: ResolvedCall = { seat, bid: 'P' }
  const hand = deal.hands[seat]
  const facts = auctionFacts(history, seat)

  // BESLUTSTABELLEN FÖRST (motorbytet etapp 3, docs/motorbyte-plan.md §2):
  // egen hand + auktionen hittills → ett bud, stol för stol. Täcker tabellen
  // läget avgörs budet här, utan manus och utan att någon annan hand finns
  // att läsa. Resten av funktionen är det gamla lagret, som rivs familj för
  // familj tills tabellen täcker allt.
  const tabell = decideFromTable(hand, facts, isVulnerable(seat, deal.vulnerability))
  if (tabell) {
    // Bridge-regeln vaktar tabellen: ett olagligt bud (kunskapsfunktionen
    // räknade inte med läget) blir pass med källan märkt, så att dumparna
    // avslöjar hålet i stället för att bordet kraschar.
    if (tabell.call.bid === 'P' || legalCalls(history, seat).includes(tabell.call.bid)) return tabell
    return { call: pass, källa: `${tabell.källa} (olagligt ${tabell.call.bid} → pass)` }
  }

  const built = buildAuction(deal)
  if (!built) return { call: pass, källa: 'ingen öppning' } // ingen öppnar given → alla passar

  const line = turnsToCalls(built.turns, deal.dealer)
  const offBook = divergedFromLine(history, line)
  const c: DetectorCtx = { deal, history, seat, hand, facts }

  // Följ linjen så länge den verkliga budföljden inte motsagt den — men ett
  // inbakat försvarspass efter deras spärrhöjning får inte tysta väckningen
  // (se defendRaisedPreemptCall ovan).
  if (!offBook) {
    const next = line[history.length]
    if (next && next.seat === seat) {
      if (next.bid === 'P') {
        const wake = defendRaisedPreemptCall(c)
        if (wake && wake.bid !== 'P') return { call: wake, källa: 'väckning' }
      }
      return { call: next, källa: 'manus' }
    }
  }

  // (Konkurrens-slaminvitet — etapp 7 hål D — är sedan etapp 4 familj 1 en
  // tabellrad, `konkurrens-slam`, med samma företräde som steget hade här.
  // Dubblingsfamiljen — svaret på X, dubblarens vakter, det starka X-flödet —
  // är sedan etapp 4 familj 2 raderna *dubbling*/*x-svar*/*x-dubblaren*/
  // *x-advancern*, med samma företräde som detektorerna hade.)

  // Tvingande svar — gäller ÄVEN on-book (kedjan FORCED_DETECTORS ovan).
  for (const d of FORCED_DETECTORS) {
    const call = d.run(c)
    if (call) return { call, källa: `detektor:${d.id}` }
  }

  // Konkurrenskedjan CONTESTED_DETECTORS — bara när linjen inte styr längre:
  // off-book, eller en ÖPPEN auktion som linjen bara modellerat en rond av.
  const lineExhaustedOpen = !offBook && history.length >= line.length && built.open
  if (offBook || lineExhaustedOpen) {
    for (const d of CONTESTED_DETECTORS) {
      const call = d.run(c)
      if (call) return { call, källa: `detektor:${d.id}` }
    }
  }

  return { call: pass, källa: 'pass (ingen regel)' }
}
