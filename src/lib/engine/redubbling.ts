// REDUBBLINGEN PÅ 1-LÄGET (ägarstruktur 2026-11-16, uppföljning av förslag #128).
//
// Tre lägen, alla lästa ur AUKTIONEN och bjudna ur EN hand (ärlig inferens):
//
//   A. 1♥/1♠–(X)–XX = EXAKT tre korts stöd, 8+ hp. Fiten är känd direkt, så vi
//      straffar aldrig på 1–2-läget — öppnaren visar sin styrka i högfärgen:
//      2M svag · 3M 14–15 · 4M 16+ (även när de flyr).
//   B. 1♣/1♦–(X)–XX = 8+ hp UTAN fyrkorts högfärg (med en sådan bjuds 1♥/1♠
//      som om dubblingen inte fanns). Ingen känd fit → vi bjuder naturligt och
//      straffdubblar deras flykt med fyra bra kort. Öppnarens pass är krav:
//      vi passar aldrig ut deras flykt.
//   C. Stödredubbling: 1x–(P)–1M–(X)–XX = EXAKT tre kort i partnerns högfärg
//      (samma löfte som stöddubblingen — de dubblade i stället för att kliva in).
//
// Svaren över själva dubblingen (XX / 1M / 1NT / ny färg) bor i
// `contestedResponse` (contested-opening.ts); här bor fortsättningarna.

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, prettyBid } from './auction-rules'
import { hcp, isBalanced, lengths, suitHcp } from './hand'
import { hasStopper } from './overcalls'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'

const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)
const isMajor = (s: Suit) => s === 'hearts' || s === 'spades'
const PASS = (explanation: string): Kunskap => ({ call: 'P', rule: 'pass', explanation })

function lawful(f: AuctionFacts, k: Kunskap | null): Kunskap | null {
  if (!k) return null
  if (k.call !== 'P' && !legalCalls(f.history, f.seat).includes(k.call as Bid)) return null
  return k
}
const levelOf = (bid: string | null | undefined) => (bid ? parseContractBid(bid as Bid)?.level ?? 0 : 0)

// ============================================================================
// Lägesläsare — 1x–(X)–XX
// ============================================================================

interface XXLäge {
  openerSeat: Seat
  openerSuit: Suit
  /** Index för öppningen i historiken (X ligger på i+1, XX på i+2). */
  i: number
}

/** Vår sida öppnade 1 i färg, de dubblade direkt och öppnarens partner redubblade direkt. */
function xxEfterÖppning(f: AuctionFacts): XXLäge | null {
  const open = f.opening
  if (!open || open.level !== 1 || side(open.seat) !== side(f.seat)) return null
  const openerSuit = SUIT_OF_LETTER[open.strain]
  if (!openerSuit) return null
  const h = f.history
  const i = open.index
  if (h[i + 1]?.bid !== 'X' || h[i + 2]?.bid !== 'XX') return null
  return { openerSeat: open.seat, openerSuit, i }
}

/** Sedan XX: vår sida har bara passat och de har gjort högst ETT kontraktsbud (flykten) — inga fler X/XX. */
function bareFlyktenSedanXX(f: AuctionFacts, i: number): { flykt: ResolvedCall | null } | null {
  const rest = f.history.slice(i + 3)
  let flykt: ResolvedCall | null = null
  for (const c of rest) {
    if (c.bid === 'P') continue
    if (side(c.seat) === side(f.seat)) return null
    if (c.bid === 'X' || c.bid === 'XX' || flykt) return null
    flykt = c
  }
  return { flykt }
}

// ============================================================================
// A. 1M–(X)–XX = exakt tre stöd, 8+
// ============================================================================

/** Öppnarens stol: direkt efter partnerns XX (+ fjärde hands pass/bud), eller efter redubblarens inbjudan. */
export function openerAfterSupportXXSeat(f: AuctionFacts): boolean {
  const s = xxEfterÖppning(f)
  if (!s || s.openerSeat !== f.seat || !isMajor(s.openerSuit)) return false
  return f.history.length === s.i + 4 || f.history.length === s.i + 8
}

/**
 * Öppnaren efter 1M–(X)–XX: fiten är känd (exakt tre hos partnern, 8+), så
 * öppnaren visar bara styrkan — 2M svag (under 14), 3M 14–15, 4M 16+. Samma
 * trappa när fjärde hand flyr; går 2M inte längre att bjuda passar den svaga
 * handen (partnern vet om fiten och avgör). Ingen straffdubbling: med känd
 * högfärgsfit letar vi utgång (ägarbeslut 2026-11-16).
 */
export function openerAfterSupportXX(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = xxEfterÖppning(f)
  if (!s || s.openerSeat !== f.seat || !isMajor(s.openerSuit)) return null
  const h = f.history
  const { i, openerSuit: M } = s
  const sym = SYM[M]
  const bid = (L: number) => `${L}${LETTER[M]}` as Bid
  const p = hcp(hand)
  const legal = legalCalls(h, f.seat)

  // Andra turen: jag visade minimum med 2M och partnern inbjöd med 3M.
  if (h.length === i + 8) {
    if (h[i + 4].bid !== bid(2) || h[i + 5].bid !== 'P' || h[i + 6].bid !== bid(3) || h[i + 7].bid !== 'P') return null
    if (p >= 13) return lawful(f, { call: bid(4), rule: 'accepterar inbjudan', explanation: `Partnerns 3${sym} inbjuder (11–12 med tre stöd); jag är i toppen av min svaga hand (${p} hp) → 4${sym}.` })
    return PASS(`Partnerns 3${sym} inbjuder; mitt 2${sym} var äkta minimum (${p} hp) → pass.`)
  }
  if (h.length !== i + 4) return null

  if (p >= 16 && legal.includes(bid(4))) {
    return { call: bid(4), rule: 'efter XX: utgång', explanation: `Partnerns XX visar exakt tre ${sym} och 8+ hp; med ${p} hp (16+) → 4${sym}.` }
  }
  if (p >= 14) {
    if (legal.includes(bid(3))) return { call: bid(3), rule: 'efter XX: inbjudan', explanation: `Partnerns XX visar exakt tre ${sym} och 8+ hp; med ${p} hp (14–15) → 3${sym} (partnern höjer med 10+).` }
    return null
  }
  if (legal.includes(bid(2))) {
    return { call: bid(2), rule: 'efter XX: minimum', explanation: `Partnerns XX visar exakt tre ${sym} och 8+ hp; med ${p} hp (svag öppning) → 2${sym}.` }
  }
  return PASS(`Partnerns XX visar exakt tre ${sym}; svag öppning och 2${sym} går inte längre att bjuda → pass (partnern känner fiten och avgör).`)
}

/** Redubblarens stol efter öppnarens besked (2M/3M/4M/pass) och ett pass från dem. */
export function supportRedoublerSeat(f: AuctionFacts): boolean {
  const s = xxEfterÖppning(f)
  if (!s || s.openerSeat !== f.partner || !isMajor(s.openerSuit)) return false
  const h = f.history
  return h.length === s.i + 6 && h[s.i + 2].seat === f.seat && h[s.i + 5].bid === 'P'
}

/**
 * Redubblaren (exakt tre stöd, 8+) efter öppnarens besked:
 *   · 2M (svag): pass med 8–10, 3M med 11–12 (inbjudan), 4M med 13+.
 *   · 3M (14–15): 4M med 10+, annars pass.
 *   · 4M: pass.
 *   · öppnaren passade deras flykt (2M gick inte): 10+ → billigaste M på
 *     högst 3-läget, annars pass.
 */
export function supportRedoublerContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  if (!supportRedoublerSeat(f)) return null
  const s = xxEfterÖppning(f)!
  const h = f.history
  const { i, openerSuit: M } = s
  const sym = SYM[M]
  const bid = (L: number) => `${L}${LETTER[M]}` as Bid
  const p = hcp(hand)
  const svar = h[i + 4].bid

  if (svar === bid(4)) return PASS(`Partnerns 4${sym} är utgång till spel → pass.`)
  if (svar === bid(3)) {
    if (p >= 10) return lawful(f, { call: bid(4), rule: 'redubblaren: utgång', explanation: `Partnerns 3${sym} visar 14–15; med ${p} hp (10+) räcker det till utgång → 4${sym}.` })
    return PASS(`Partnerns 3${sym} visar 14–15; med ${p} hp (8–9) → pass.`)
  }
  if (svar === bid(2)) {
    if (p >= 13) return lawful(f, { call: bid(4), rule: 'redubblaren: utgång', explanation: `Partnerns 2${sym} är en svag öppning; med ${p} hp (13+) och tre stöd → 4${sym}.` })
    if (p >= 11) return lawful(f, { call: bid(3), rule: 'redubblaren: inbjudan', explanation: `Partnerns 2${sym} är en svag öppning; med ${p} hp (11–12) och tre stöd → 3${sym} (inbjudan).` })
    return PASS(`Partnerns 2${sym} är en svag öppning; med ${p} hp (8–10) → pass.`)
  }
  if (svar === 'P') {
    // Kunde öppnaren ha bjudit 2M men passade (en människa — boten bjuder
    // alltid) gäller redubblarens gamla dom (#98, `redoublerContinues`).
    const fl = parseContractBid(h[i + 3].bid)
    if (!fl || fl.level === 1 || (fl.level === 2 && fl.strain !== 'NT' && rankIdx(SUIT_OF_LETTER[fl.strain]) < rankIdx(M))) return null
    const billigast = cheapestBidIn(h, f.seat, LETTER[M])
    if (p >= 10 && billigast && levelOf(billigast) <= 3) {
      return { call: billigast, rule: 'redubblaren: stöd', explanation: `Partnern passade deras flykt (svag öppning); med ${p} hp och tre stöd tävlar vi i fiten → ${prettyBid(billigast)}.` }
    }
    return PASS(`Partnern passade deras flykt (svag öppning); med ${p} hp (8–9) → pass.`)
  }
  return null
}

// ============================================================================
// B. 1m–(X)–XX = 8+ utan fyrkorts högfärg
// ============================================================================

interface LågfärgsLäge extends XXLäge {
  flykt: ResolvedCall | null
}

/** Öppnarens stol efter 1m–(X)–XX när vår sida inte bjudit sedan dess. */
export function openerAfterMinorXXSeat(f: AuctionFacts): LågfärgsLäge | null {
  const s = xxEfterÖppning(f)
  if (!s || s.openerSeat !== f.seat || isMajor(s.openerSuit)) return null
  const r = bareFlyktenSedanXX(f, s.i)
  if (!r) return null
  return { ...s, flykt: r.flykt }
}

/**
 * Öppnaren efter 1m–(X)–XX (8+ utan fyrkorts högfärg):
 *   · de passade: vi sitter i 1m redubblat och DE måste fly → pass (en svag
 *     hand med 6+ kort bjuder om lågfärgen direkt).
 *   · de flydde: straffdubbling med fyra bra kort i deras färg · sang med
 *     stopp · den andra lågfärgen (4+) eller en femkorts högfärg · lågfärgen
 *     igen med 6+ · annars pass. Passet är KRAV — partnern passar inte ut dem.
 *   · utpassningssitsen (partnern passade också): vi säljer inte ut → sang
 *     eller lågfärgen igen.
 */
export function openerAfterMinorXX(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = openerAfterMinorXXSeat(f)
  if (!s) return null
  const { openerSuit: m, flykt } = s
  const h = f.history
  const len = lengths(hand)
  const p = hcp(hand)
  const sym = SYM[m]
  const omM = cheapestBidIn(h, f.seat, LETTER[m])

  if (!flykt) {
    if (len[m] >= 6 && p < 14 && omM && levelOf(omM) === 2) {
      return { call: omM, rule: 'efter XX: egen färg', explanation: `Partnerns XX visar 8+ hp; svag öppning med ${len[m]} ${sym} → ${prettyBid(omM)} (visar handtypen direkt).` }
    }
    return PASS(`Partnerns XX visar 8+ hp — vi sitter i 1${sym} redubblat och de måste fly → pass.`)
  }

  const cb = parseContractBid(flykt.bid)
  const deras = cb && cb.strain !== 'NT' ? SUIT_OF_LETTER[cb.strain] : null
  if (deras && len[deras] >= 4 && suitHcp(hand, deras) >= 5) {
    return lawful(f, { call: 'X', rule: 'efter XX: straffdubbling', explanation: `Partnerns XX visar 8+ hp, vi äger given; ${len[deras]} kort med honnörer i deras ${SYM[deras]} → X (straff på ${prettyBid(flykt.bid)}).` })
  }
  const nt = cheapestBidIn(h, f.seat, 'NT')
  if (deras && nt && isBalanced(hand) && hasStopper(hand, deras)) {
    if (p >= 18) return lawful(f, { call: '3NT', rule: 'efter XX: sang', explanation: `Partnerns XX visar 8+ hp; ${p} hp, jämn hand med stopp i deras ${SYM[deras]} → 3NT.` })
    if (levelOf(nt) === 1 || (levelOf(nt) === 2 && p >= 14)) {
      return { call: nt, rule: 'efter XX: sang', explanation: `Partnerns XX visar 8+ hp; jämn hand med stopp i deras ${SYM[deras]} → ${prettyBid(nt)}.` }
    }
  }
  // Ny färg: den andra lågfärgen (4+) eller en femkorts högfärg (partnern har
  // förnekat fyra kort i högfärgerna). Över 2 i öppningsfärgen krävs 16+.
  const nya = RANK_ORDER.filter((x) => x !== m && x !== deras && len[x] >= (isMajor(x) ? 5 : 4)).sort((a, b) => len[b] - len[a])
  for (const x of nya) {
    const b = cheapestBidIn(h, f.seat, LETTER[x])
    const L = levelOf(b)
    if (!b || L > 2) continue
    if (L === 2 && rankIdx(x) > rankIdx(m) && p < 16) continue
    return { call: b, rule: 'efter XX: ny färg', explanation: `Partnerns XX visar 8+ hp; ${len[x]} kort i ${SYM[x]} → ${prettyBid(b)} (naturligt).` }
  }
  if (len[m] >= 6 && omM && levelOf(omM) <= 3) {
    return { call: omM, rule: 'efter XX: egen färg', explanation: `Partnerns XX visar 8+ hp; ${len[m]} kort i ${sym} → ${prettyBid(omM)}.` }
  }
  if (!f.passOut) {
    return PASS(`Partnerns XX visar 8+ hp; inget naturligt bud just nu → pass (kravpass — partnern passar inte ut deras flykt).`)
  }
  // Utpassningssitsen: vi har minst 20 hp ihop och säljer inte ut.
  if (nt && levelOf(nt) === 1) return { call: nt, rule: 'efter XX: sang', explanation: `Partnerns XX visar 8+ hp och vi säljer inte ut deras flykt → ${prettyBid(nt)}.` }
  if (omM && levelOf(omM) <= 2) return { call: omM, rule: 'efter XX: egen färg', explanation: `Partnerns XX visar 8+ hp och vi säljer inte ut deras flykt → ${prettyBid(omM)}.` }
  return PASS(`Partnerns XX visar 8+ hp, men inget bud finns på en rimlig nivå → pass.`)
}

/** Redubblarens stol efter 1m–(X)–XX när de flytt i en färg och vår sida inte bjudit sedan dess. */
export function minorRedoublerSeat(f: AuctionFacts): (LågfärgsLäge & { flykt: ResolvedCall; deras: Suit }) | null {
  const s = xxEfterÖppning(f)
  if (!s || s.openerSeat !== f.partner || isMajor(s.openerSuit) || f.history[s.i + 2].seat !== f.seat) return null
  const r = bareFlyktenSedanXX(f, s.i)
  if (!r || !r.flykt) return null
  const cb = parseContractBid(r.flykt.bid)
  const deras = cb && cb.strain !== 'NT' ? SUIT_OF_LETTER[cb.strain] : null
  if (!deras) return null
  return { ...s, flykt: r.flykt, deras }
}

/**
 * Redubblaren (8+ utan fyrkorts högfärg) när de flytt: straffdubbling med
 * fyra bra kort i deras färg · sang med stopp (1NT 8–10, 2NT 11–12, 3NT 13+)
 * · stöd i partnerns lågfärg (4+) · egen femkortsfärg. Direkt över flykten
 * får redubblaren passa (öppnaren har ordet); i utpassningssitsen aldrig —
 * vi säljer inte ut deras flykt.
 */
export function minorRedoublerContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = minorRedoublerSeat(f)
  if (!s) return null
  const { openerSuit: m, flykt, deras } = s
  const h = f.history
  const len = lengths(hand)
  const p = hcp(hand)

  if (len[deras] >= 4 && suitHcp(hand, deras) >= 5) {
    return lawful(f, { call: 'X', rule: 'redubblaren: straffdubbling', explanation: `Vi äger given efter XX; ${len[deras]} kort med honnörer i deras ${SYM[deras]} → X (straff på ${prettyBid(flykt.bid)}).` })
  }
  const nt = cheapestBidIn(h, f.seat, 'NT')
  const ntNivå = levelOf(nt)
  if (nt && hasStopper(hand, deras)) {
    const legal = legalCalls(h, f.seat)
    if (p >= 13 && legal.includes('3NT' as Bid)) return { call: '3NT', rule: 'redubblaren: sang', explanation: `${p} hp (13+) med stopp i deras ${SYM[deras]} mot partnerns öppning → 3NT.` }
    if (p >= 11 && ntNivå <= 2) return { call: '2NT', rule: 'redubblaren: sang (inbjudan)', explanation: `${p} hp (11–12) med stopp i deras ${SYM[deras]} → 2NT (inbjudan).` }
    if (ntNivå === 1) return { call: nt, rule: 'redubblaren: sang', explanation: `${p} hp (8–10) med stopp i deras ${SYM[deras]} → 1NT.` }
  }
  const stöd = cheapestBidIn(h, f.seat, LETTER[m])
  if (len[m] >= 4 && stöd && levelOf(stöd) <= 3) {
    return { call: stöd, rule: 'redubblaren: stöd', explanation: `Efter XX (8+) och deras flykt: ${len[m]} kort i partnerns ${SYM[m]} → ${prettyBid(stöd)}.` }
  }
  for (const x of RANK_ORDER.filter((x) => x !== m && x !== deras && len[x] >= 5).sort((a, b) => len[b] - len[a])) {
    const b = cheapestBidIn(h, f.seat, LETTER[x])
    if (b && levelOf(b) <= 2) return { call: b, rule: 'redubblaren: egen färg', explanation: `Efter XX (8+) och deras flykt: ${len[x]} kort i ${SYM[x]} → ${prettyBid(b)} (naturligt).` }
  }
  if (!f.passOut) return PASS(`Efter XX (8+): inget naturligt bud över deras flykt → pass (partnern har ordet).`)
  // Utpassningssitsen: partnern kravpassade — vi bjuder alltid.
  if (ntNivå === 1 && nt) return { call: nt, rule: 'redubblaren: sang', explanation: `Partnerns pass efter vår XX är krav — vi säljer inte ut deras flykt → 1NT.` }
  if (len[m] >= 3 && stöd && levelOf(stöd) <= 2) {
    return { call: stöd, rule: 'redubblaren: stöd', explanation: `Partnerns pass efter vår XX är krav — vi säljer inte ut deras flykt → ${prettyBid(stöd)} (tillbaka till partnerns färg).` }
  }
  if (nt && ntNivå === 2 && p >= 10) return { call: nt, rule: 'redubblaren: sang (inbjudan)', explanation: `Partnerns pass efter vår XX är krav — vi säljer inte ut deras flykt → 2NT.` }
  return PASS(`Efter XX: inget bud finns på en rimlig nivå → pass.`)
}

/** Öppnarens stol efter redubblarens ANDRA bud (1m–(X)–XX–…): partnerns bud är det senaste icke-passet. */
export function openerAfterMinorRedoublerSeat(f: AuctionFacts): { openerSuit: Suit; partnerCall: ResolvedCall } | null {
  const s = xxEfterÖppning(f)
  if (!s || s.openerSeat !== f.seat || isMajor(s.openerSuit)) return null
  const efter = f.history.slice(s.i + 3)
  if (efter.some((c) => c.seat === f.seat && c.bid !== 'P')) return null
  const partners = efter.filter((c) => c.seat === f.partner && c.bid !== 'P')
  if (partners.length !== 1 || f.lastNonPass !== partners[0]) return null
  return { openerSuit: s.openerSuit, partnerCall: partners[0] }
}

/**
 * Öppnaren efter redubblarens andra bud: X = straff → pass; 2NT = inbjudan
 * (11–12) → 3NT med 14+, annars pass; 1NT/3NT/stöd är naturliga och
 * begränsade → pass. Redubblarens NYA FÄRG är rondkrav → null (kravraderna svarar).
 */
export function openerAfterMinorRedoubler(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = openerAfterMinorRedoublerSeat(f)
  if (!s) return null
  const { partnerCall } = s
  const p = hcp(hand)
  if (partnerCall.bid === 'X') return PASS(`Partnerns X efter vår XX är straff — vi äger given → pass.`)
  if (partnerCall.bid === 'XX') return null
  if (partnerCall.bid === '2NT') {
    if (p >= 14) return lawful(f, { call: '3NT', rule: 'accepterar inbjudan', explanation: `Partnerns 2NT efter XX inbjuder (11–12); med ${p} hp → 3NT.` })
    return PASS(`Partnerns 2NT efter XX inbjuder (11–12); med ${p} hp (minimum) → pass.`)
  }
  const cb = parseContractBid(partnerCall.bid)
  if (cb && cb.strain !== 'NT' && SUIT_OF_LETTER[cb.strain] !== s.openerSuit) return null
  return PASS(`Partnerns ${prettyBid(partnerCall.bid)} efter XX är naturligt och begränsat → pass.`)
}

// ============================================================================
// C. Stödredubblingen — 1x–(P)–1M–(X)–XX = exakt tre stöd
// ============================================================================

interface StödXXFönster {
  /** Index för svaret 1M (X ligger på r+1, XX på r+2). */
  r: number
  major: Suit
  openerSuit: Suit
  openerSeat: Seat
}

/**
 * Fönstret: vår 1-läges färgöppning, partnerns svar 1♥/1♠ (svararens första
 * bud — ett inkliv före svaret tolereras, som i stöddubblingen #126) och deras
 * X DIREKT på svaret. Inga andra X/XX före det.
 */
function stödXXFönster(f: AuctionFacts): StödXXFönster | null {
  const open = f.opening
  if (!open || open.level !== 1 || side(open.seat) !== side(f.seat)) return null
  const openerSuit = SUIT_OF_LETTER[open.strain]
  if (!openerSuit) return null
  const resp = f.ourContractBids[1]
  if (!resp || resp.seat === open.seat) return null
  const rb = parseContractBid(resp.bid)
  if (!rb || rb.level !== 1 || (rb.strain !== 'H' && rb.strain !== 'S')) return null
  const h = f.history
  const r = h.indexOf(resp)
  const x = h[r + 1]
  if (!x || x.bid !== 'X' || side(x.seat) === side(f.seat)) return null
  if (h.slice(0, r + 1).some((c) => c.bid === 'X' || c.bid === 'XX')) return null
  // Före svaret: högst ett inkliv från dem, inget mer från oss.
  const före = h.slice(open.index + 1, r).filter((c) => c.bid !== 'P')
  if (före.length > 1 || före.some((c) => side(c.seat) === side(f.seat))) return null
  return { r, major: SUIT_OF_LETTER[rb.strain], openerSuit, openerSeat: open.seat }
}

/** Öppnarens stol direkt efter deras X av partnerns 1M-svar. */
export function supportRedoubleSeat(f: AuctionFacts): StödXXFönster | null {
  const s = stödXXFönster(f)
  if (!s || s.openerSeat !== f.seat || f.history.length !== s.r + 2) return null
  return s
}

/** Stödredubblingen: exakt tre kort i partnerns högfärg → XX. Annars null (det vanliga återbudet). */
export function openerSupportRedouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = supportRedoubleSeat(f)
  if (!s) return null
  if (lengths(hand)[s.major] !== 3) return null
  return lawful(f, { call: 'XX', rule: 'stödredubbling', explanation: `Exakt tre kort i partnerns ${SYM[s.major]} → XX (stödredubbling — samma löfte som stöddubblingen; säger inget om styrkan).` })
}

/** Svararens stol efter partnerns stödredubbling (+ pass), eller efter öppnarens inbjudan 3M. */
export function supportRedoubleToAnswer(f: AuctionFacts): StödXXFönster | null {
  const s = stödXXFönster(f)
  if (!s || s.openerSeat !== f.partner) return null
  const h = f.history
  if (h[s.r + 2]?.bid !== 'XX' || h[s.r + 3]?.bid !== 'P') return null
  if (h.length !== s.r + 4 && h.length !== s.r + 8) return null
  return s
}

/**
 * Svaret på stödredubblingen (öppnaren har exakt tre):
 *   · fem kort i högfärgen (8-kortsfit): 2M upp till 10 hp, 3M 11–12, 4M 13+.
 *   · bara fyra kort (4-3): 13+ → 3NT; jämn hand → 1NT (upp till 10) eller
 *     2NT (11–12); ojämn → tillbaka till öppnarens färg med 4+ stöd, annars 2M.
 * Aldrig pass: 1M redubblat ska inte spelas på en 4-3 av misstag.
 */
export function answerSupportRedouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = supportRedoubleToAnswer(f)
  if (!s) return null
  const h = f.history
  const { r, major: M, openerSuit: o } = s
  const sym = SYM[M]
  const bid = (L: number) => `${L}${LETTER[M]}` as Bid
  const len = lengths(hand)
  const p = hcp(hand)

  // Andra turen: jag svarade 2M och öppnaren inbjöd med 3M.
  if (h.length === r + 8) {
    if (h[r + 4].bid !== bid(2) || h[r + 5].bid !== 'P' || h[r + 6].bid !== bid(3) || h[r + 7].bid !== 'P') return null
    if (p >= 9) return lawful(f, { call: bid(4), rule: 'accepterar inbjudan', explanation: `Partnerns 3${sym} inbjuder (16–18 med tre stöd); med ${p} hp → 4${sym}.` })
    return PASS(`Partnerns 3${sym} inbjuder; med ${p} hp (minimum) → pass.`)
  }

  if (len[M] >= 5) {
    if (p >= 13) return lawful(f, { call: bid(4), rule: 'svar på stödredubbling', explanation: `Partnerns XX visar exakt tre ${sym}: ${len[M]}-3-fit och ${p} hp (13+) → 4${sym}.` })
    if (p >= 11) return lawful(f, { call: bid(3), rule: 'svar på stödredubbling (inbjudan)', explanation: `Partnerns XX visar exakt tre ${sym}: ${len[M]}-3-fit och ${p} hp (11–12) → 3${sym} (inbjudan).` })
    return lawful(f, { call: bid(2), rule: 'svar på stödredubbling (minimum)', explanation: `Partnerns XX visar exakt tre ${sym}: ${len[M]}-3-fit, ${p} hp → 2${sym}.` })
  }
  if (p >= 13) return lawful(f, { call: '3NT', rule: 'svar på stödredubbling', explanation: `Partnerns XX visar exakt tre ${sym} — bara en 4-3-fit; ${p} hp (13+) → 3NT.` })
  if (isBalanced(hand)) {
    if (p >= 11) return lawful(f, { call: '2NT', rule: 'svar på stödredubbling (inbjudan)', explanation: `Partnerns XX visar exakt tre ${sym} — bara en 4-3-fit; jämn hand, ${p} hp (11–12) → 2NT (inbjudan).` })
    return lawful(f, { call: '1NT', rule: 'svar på stödredubbling (minimum)', explanation: `Partnerns XX visar exakt tre ${sym} — bara en 4-3-fit; jämn hand, ${p} hp → 1NT.` })
  }
  const tillbaka = cheapestBidIn(h, f.seat, LETTER[o])
  if (o !== M && len[o] >= 4 && tillbaka && levelOf(tillbaka) <= 2) {
    return { call: tillbaka, rule: 'svar på stödredubbling (minimum)', explanation: `Partnerns XX visar exakt tre ${sym} — bara en 4-3-fit; ${len[o]} kort i partnerns ${SYM[o]} → ${prettyBid(tillbaka)}.` }
  }
  return lawful(f, { call: bid(2), rule: 'svar på stödredubbling (minimum)', explanation: `Partnerns XX visar exakt tre ${sym}; ojämn hand utan bättre läge → 2${sym} (4-3-fiten).` })
}

/** Stödredubblarens stol efter svararens besked (+ pass). */
export function supportRedoublerRebidSeat(f: AuctionFacts): StödXXFönster | null {
  const s = stödXXFönster(f)
  if (!s || s.openerSeat !== f.seat) return null
  const h = f.history
  if (h[s.r + 2]?.bid !== 'XX' || h[s.r + 3]?.bid !== 'P' || h.length !== s.r + 6 || h[s.r + 5].bid !== 'P') return null
  return s
}

/**
 * Stödredubblaren (öppnaren) väger svaret: 2M → 3M med 16–18, 4M med 19+,
 * annars pass; 3M (inbjudan) → 4M med 14+; 2NT (inbjudan) → 3NT med 14+;
 * 1NT → 2NT med 17+; utgångsbud och "tillbaka till min färg" står.
 */
export function supportRedoublerRebid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = supportRedoublerRebidSeat(f)
  if (!s) return null
  const { r, major: M } = s
  const sym = SYM[M]
  const bid = (L: number) => `${L}${LETTER[M]}` as Bid
  const p = hcp(hand)
  const svar = f.history[r + 4].bid
  if (svar === bid(2)) {
    if (p >= 19) return lawful(f, { call: bid(4), rule: 'stödredubblaren: utgång', explanation: `Partnerns 2${sym} visar fem kort; med ${p} hp (19+) → 4${sym}.` })
    if (p >= 16) return lawful(f, { call: bid(3), rule: 'stödredubblaren: inbjudan', explanation: `Partnerns 2${sym} visar fem kort och minimum; med ${p} hp (16–18) → 3${sym} (inbjudan).` })
    return PASS(`Partnerns 2${sym} visar fem kort och minimum; med ${p} hp → pass.`)
  }
  if (svar === bid(3)) {
    if (p >= 14) return lawful(f, { call: bid(4), rule: 'accepterar inbjudan', explanation: `Partnerns 3${sym} inbjuder (fem kort, 11–12); med ${p} hp → 4${sym}.` })
    return PASS(`Partnerns 3${sym} inbjuder; med ${p} hp (minimum) → pass.`)
  }
  if (svar === '2NT') {
    if (p >= 14) return lawful(f, { call: '3NT', rule: 'accepterar inbjudan', explanation: `Partnerns 2NT inbjuder (11–12, bara fyra ${sym}); med ${p} hp → 3NT.` })
    return PASS(`Partnerns 2NT inbjuder; med ${p} hp (minimum) → pass.`)
  }
  if (svar === '1NT') {
    if (p >= 17) return lawful(f, { call: '2NT', rule: 'stödredubblaren: inbjudan', explanation: `Partnerns 1NT visar fyra ${sym} och högst 10 hp; med ${p} hp → 2NT (inbjudan).` })
    return PASS(`Partnerns 1NT visar fyra ${sym} och högst 10 hp → pass.`)
  }
  if (svar === bid(4) || svar === '3NT') return PASS(`Partnerns ${prettyBid(svar)} är utgång till spel → pass.`)
  if (parseContractBid(svar)) return PASS(`Partnerns ${prettyBid(svar)} är ett avslut efter stödredubblingen → pass.`)
  return null
}
