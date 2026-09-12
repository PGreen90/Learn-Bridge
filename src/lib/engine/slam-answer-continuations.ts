// SLAM-SVARSSVEPET — motorbytet etapp 4 familj 8 (docs/motorbyte-plan.md).
//
// De slam-beslut som INTE hörde till den kanoniska ostörda slamsekvensen
// (raden *slam*, familj 5) och inte till konkurrens-slaminvitet (raden
// *konkurrens-slam*, familj 1) låg kvar som detektorer i `auction-live.ts` och
// fyrade när auktionen lämnat manuslinjen: människan (eller ett inkliv) tog
// budgivningen förbi den kanoniska formen. De flyttar hit som funktioner av EN
// hand + fakta — ingen annan hand läses (kikvakten bevisar det):
//
//   · essfrågan 4NT (1430 RKC) besvaras oavsett hur trumfen sattes (felrapport
//     #9 överenskommen trumf, #10 sidans senaste naturliga färg, R1-fynd #3
//     Jacoby-fit) — `answerRKC`;
//   · kungfrågan 5NT (Sjöberg, §6.3) — `answerKingAsk`;
//   · rättelsen över stoppbudet efter det tvetydiga 1-eller-4-svaret
//     (felrapport #60) — `rkcCorrection`;
//   · kaptenens kvantitativa höjning av partnerns naturliga 3NT till 6NT
//     (felrapport #42, §5.2) — `raise3NTToSlam`;
//   · öppnarens slamtrevare 4NT efter svararens 3NT ("3NT-stoppen", etapp 7
//     hål 2) och svararens accept/avböjande — `openerTry3NTStop`/
//     `answer3NTStopTry`.
//
// `slamAnswerContinuation` prövar dem i den ordning detektorkedjan hade (3NT-
// stoppens svar FÖRE RKC-svaret, så det kvantitativa 4NT:t över sangen inte
// läses som essfråga — där sätter `slamAskTrump` ändå ingen trumf). Raden
// *slam-forts* ligger efter *slam*/*konkurrens-slam* men före positionsraderna,
// samma företräde som detektorerna hade när linjen tog slut.

import type { Hand, Suit } from '../../types/bridge'
import { openingBid, PARTNER, parseContractBid, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { legalCalls, letterOfSuit, SWE_SYM } from './auction-rules'
import { hcp, lengths, suitHcp } from './hand'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'
import { keycards, respondToKingAsk, respondToRKC } from './slam'

const MINOR_SUIT: Record<string, Suit> = { C: 'clubs', D: 'diamonds' }
const ALL_SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
/** Partnerns visade minimum när hen öppnat på 1-läget i en färg (låst regel, §5.2). */
const SUIT_OPENING_SHOWN_MIN = 12

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
export function slamAskTrump(f: AuctionFacts): Suit | null {
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
 *  - trumfen kan härledas via `slamAskTrump`.
 */
/**
 * Partnerns (essfrågarens) VISADE trumflängd, härledd ur auktionen med
 * försiktiga golv (ärlig inferens — motorn spårar inte visad längd exakt):
 *  · partnern öppnade trumffärgen: 1-läges högfärg → 5, 1♦ → 4, 1♣ → 3,
 *    svag tvåa → 6, spärr → nivån + 4;
 *  · trumf satt via Jacoby 2NT (partnern visade 4+ stöd) → 4;
 *  · annars (partnern höjde/agreed) → golv 3.
 * Används för RKC-svarets trumfdam: damen visas via längd bara när egen längd +
 * detta ≥ 10 (bevisad 10-korts fit), aldrig på ett antagande.
 */
export function partnerShownTrumpLength(f: AuctionFacts, trump: Suit): number {
  const partner = PARTNER[f.seat]
  const L = letterOfSuit(trump)
  const open = openingBid(f.history)
  if (open && open.seat === partner && open.strain === L) {
    if (open.level === 1) return trump === 'hearts' || trump === 'spades' ? 5 : trump === 'diamonds' ? 4 : 3
    if (open.level === 2) return 6 // svag tvåa
    return open.level + 4 // spärr (3→7, 4→8)
  }
  if (f.jacobyTrump === trump) return 4 // partnern satte fiten med Jacoby 2NT (4+ stöd)
  return 3 // partnern har agreed trumf (höjning) → golv 3
}

export function answerRKC(hand: Hand, f: AuctionFacts): Kunskap | null {
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[f.seat] || lastNonPass.bid !== '4NT') return null
  const trump = slamAskTrump(f)
  if (!trump) return null
  const knownCombined = lengths(hand)[trump] + partnerShownTrumpLength(f, trump)
  return respondToRKC(hand, trump, knownCombined)
}

/**
 * Ska `seat` svara på partnerns 5NT-KUNGFRÅGA (Sjöberg, §6.3)? Bara i en
 * essfrågesekvens: partnern har tidigare bjudit 4NT (essfrågan) och nu 5NT.
 */
export function answerKingAsk(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '5NT') return null
  if (!history.some((c) => c.seat === PARTNER[seat] && c.bid === '4NT')) return null
  const trump = slamAskTrump(f)
  if (!trump) return null
  return respondToKingAsk(hand, trump)
}

/**
 * RÄTTELSEN över stoppbudet (felrapport #60, §6.1): jag svarade 5♣/5♦ på
 * partnerns 4NT-essfråga (1 eller 4 / 0 eller 3), partnern stannade i 5-trumf,
 * och jag sitter med det HÖGA antalet. Stoppbudet betyder "pass med det låga,
 * bjud vidare med det höga" — annars säljs lillslammen (Nord passade 5♥ med
 * fyra nyckelkort). Positionsexakt: partnerns 4NT → mitt 5♣/5♦ → partnerns
 * 5-trumf → (bara pass).
 */
export function rkcCorrection(hand: Hand, f: AuctionFacts): Kunskap | null {
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
  if (keycards(hand, trump) !== high) return null
  return {
    call: `6${letterOfSuit(trump)}`,
    rule: 'RKC: rättelse',
    explanation:
      `Mitt svar visade ${high === 4 ? '1 ELLER 4' : '0 ELLER 3'} nyckelkort och partnern räknade lågt i sitt stopp — ` +
      `jag har ${high} → lyfter till 6${SWE_SYM[letterOfSuit(trump)]}.`,
  }
}

/**
 * Höjer partnerns naturliga 3NT till 6NT (felrapport #42, §5.2) när kaptenens
 * egen hand + partnerns visade minimum når slamzonen (33). Smal med flit:
 *  - partnerns 3NT ska vara auktionens SENASTE bud (ingen har bjudit över),
 *  - partnern ska ha ÖPPNAT på 1-läget i en FÄRG (då är 12-golvet ärligt;
 *    sangöppningar har sina egna portar i `respondTo1NT`/`respondTo2NT`),
 *  - motståndarna ska ha varit tysta (deras bud kan göra 3NT till ett
 *    tävlingsbud i stället för en styrkevisning),
 *  - egen hand utan renons — vild fördelning hör inte hemma i 6NT.
 */
export function raise3NTToSlam(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null
  const open = f.opening
  if (!open || open.seat !== PARTNER[seat]) return null
  if (open.level !== 1 || open.strain === 'NT') return null
  if (history.some((c) => side(c.seat) !== side(seat) && c.bid !== 'P')) return null
  const p = hcp(hand)
  if (p + SUIT_OPENING_SHOWN_MIN < 33) return null
  const len = lengths(hand)
  if (ALL_SUITS.some((s) => len[s] === 0)) return null
  if (!legalCalls(history, seat).includes('6NT')) return null
  return {
    call: '6NT',
    rule: 'slamhöjning av 3NT',
    explanation:
      `Slamzon mot partnerns visade ${SUIT_OPENING_SHOWN_MIN}+ (öppningen) ` +
      `→ 6NT. Slamzonen nås redan mot partnerns minimum, så jag placerar lillslammen i stället för att passa 3NT.`,
  }
}

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

/**
 * Öppnaren (19+ hp, 6+ i minoren) trevar 4NT efter svararens 3NT ("3NT-stoppen",
 * etapp 7 hål 2). Bara äkta extra öppnaren SJÄLV vet om — en 16–18-hand med
 * löpande minor är oskiljbar från en tunn DD-slam; taket är 6NT (ägarbeslut).
 */
export function openerTry3NTStop(hand: Hand, f: AuctionFacts): Kunskap | null {
  const m = openerJumpMinorThenResponder3NT(f)
  if (!m) return null
  const p = hcp(hand)
  if (p < 19) return null
  const len = lengths(hand)
  if (len[MINOR_SUIT[m.minor]] < 6) return null
  if (ALL_SUITS.some((s) => len[s] === 0)) return null // ingen renons – NT är målet
  if (!legalCalls(f.history, f.seat).includes('4NT')) return null
  return {
    call: '4NT',
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

/**
 * Svararen accepterar öppnarens 3NT-stopp-slamtrevare med ett maximum (topp av
 * intervallet, eller en fittande topphonnör i öppnarens 6-korts minor), annars
 * pass — 4NT står.
 */
export function answer3NTStopTry(hand: Hand, f: AuctionFacts): Kunskap | null {
  const m = openerSlamTryToAnswer(f)
  if (!m) return null
  const p = hcp(hand)
  const fitHonor = suitHcp(hand, MINOR_SUIT[m.minor]) >= 3 // K/A i partnerns 6-korts minor
  const accept = p >= 12 || (p >= 9 && fitHonor)
  return accept
    ? {
        call: '6NT',
        rule: 'accepterar slamtrevare',
        explanation: `Maximum av min acceptans${fitHonor ? ` (topphonnör i ${SWE_SYM[m.minor]})` : ''} → 6NT.`,
      }
    : { call: 'P', rule: 'avböjer slamtrevare', explanation: `Minimum – avböjer trevaren → 4NT står.` }
}

/**
 * Läget för raden *slam-forts* (bara fakta): partnerns senaste icke-pass är ett
 * slamrelevant bud som någon av vakterna kan behöva svara på — 3NT (höjning /
 * 3NT-stopp), 4NT (RKC / 3NT-stoppens accept), 5NT (kungfrågan) eller ett
 * 5-lägesfärgbud (rättelsen över stoppet). Valet (`slamAnswerContinuation`)
 * avgör sedan om någon vakt faktiskt gäller.
 */
export function slamAnswerSeat(f: AuctionFacts): boolean {
  const last = f.lastNonPass
  if (!last || last.seat !== f.partner) return false
  return last.bid === '3NT' || last.bid === '4NT' || last.bid === '5NT' || /^5[CDHS]$/.test(last.bid)
}

/**
 * Slam-svarssvepets val: prövar vakterna i detektorkedjans ordning (3NT-
 * stoppens svar före RKC-svaret; höjningen av 3NT sist) och ger första
 * träffande budet, annars null (nästa rad / det gamla lagret).
 */
export function slamAnswerContinuation(hand: Hand, f: AuctionFacts): Kunskap | null {
  return (
    openerTry3NTStop(hand, f) ??
    answer3NTStopTry(hand, f) ??
    answerRKC(hand, f) ??
    answerKingAsk(hand, f) ??
    rkcCorrection(hand, f) ??
    raise3NTToSlam(hand, f)
  )
}
