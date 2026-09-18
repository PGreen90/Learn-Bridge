// SYSTEMS ON EFTER VÅRT 1NT I KONKURRENS (ägarens spec 2026-09-18, felrapport
// #77 — docs/1nt-systems-on-plan.md; systemboken §7.5). EN struktur mot ALLA
// inkliv i direkt sits (naturliga som konstgjorda):
//   • deras X        → systems on helt; XX = värden 8+ (jämn hand)
//   • deras 2♣       → X = Stayman (stulet bud), i övrigt systems on
//   • deras 2♦       → X = överföring till hjärter (stulet bud); Stayman tappad
//   • deras 2♥/2♠    → X = 8+ med fyrkorts (andra) högfärg; 3♦→♥ / 3♥→♠ med
//                      5+ kort och 8+; 2♠ över 2♥ = MSS; svag hand passar
//   • jämn hand      → 2NT (8–9) / 3NT (10+) med stopp, annars pass först och
//                      straff-X i andra ronden
// Öppnaren svarar stulet bud som ostört, svarar värde-X:et med fit på lägsta
// nivå / annars 2NT-3NT, fullföljer 3-lägesöverföringen med bara 3M, och
// återöppnar bara med 5+ högfärg på 2-läget.
//
// Modulen läser BUDEN, aldrig regelnamnet på partnerns bud — så den fungerar
// lika när en människa sitter på platsen. Ärlig inferens: bara egen hand +
// auktionen. Fjärde hands inblandning efter svararens bud ligger utanför (null).

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, type AuctionFacts } from './auction-facts'
import { legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { hcp, lengths } from './hand'
import { hasStopper } from './overcalls'
import { ntResponseRule } from './overcall-continuations'
import { side } from './play'
import { openerRebidAfter1NTResponse } from './rebids'
import { responderRebidIn1NTAuction } from './responder-rebids'
import { respondTo1NT } from './responses-nt'
import type { ResponseResult } from './responses'

const NEXT: Record<Seat, Seat> = { N: 'E', E: 'S', S: 'W', W: 'N' }
const STRAIN_ORD: Record<string, number> = { C: 0, D: 1, H: 2, S: 3, NT: 4 }
/** Budets höjd som tal (nivå·5 + färgrang) — för "över/under deras bud". */
const ord = (bid: string): number => {
  const cb = parseContractBid(bid as Bid)
  return cb ? cb.level * 5 + STRAIN_ORD[cb.strain] : -1
}
const sym = (s: Suit) => SWE_SYM[letterOfSuit(s)]

// ---------------------------------------------------------------------------
// Svararens FÖRSTA bud
// ---------------------------------------------------------------------------

/**
 * Svararens svar när vårt 1NT störts i direkt sits. `theirCall` = 'X' eller ett
 * 2-lägesbud ('2C'/'2D'/'2H'/'2S').
 */
export function systemsOnResponse(hand: Hand, theirCall: string): ResponseResult {
  const u = respondTo1NT(hand) // vad jag hade bjudit ostört
  const p = hcp(hand)
  const len = lengths(hand)
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'pass', explanation: `${why} → pass.` })
  const naturligSang = u.call === '2NT' || u.call === '3NT'

  // --- Deras X: hela systemet står kvar; XX = värden med jämn hand. --------
  if (theirCall === 'X') {
    if (naturligSang) {
      return { call: 'XX', rule: 'straff/värden', explanation: '8+ hp, jämn hand mitt emot 15–17 → XX (värden; vi äger given).' }
    }
    return u.call === 'P' ? pass('svag hand') : { ...u, explanation: `${u.explanation} (systems on över deras X)` }
  }

  const theirSuit = SUIT_OF_LETTER[theirCall[1]]
  const stopp = hasStopper(hand, theirSuit)
  /** Jämna vägen: sang med trolig stopp, annars pass (straff-X i andra ronden). */
  const jamnaVagen = (): ResponseResult => {
    if (p >= 10 && stopp) return { call: '3NT', rule: '3NT till spel', explanation: `10+ hp med stopp i ${sym(theirSuit)} → 3NT (till spel).` }
    if (p >= 8 && stopp) return { call: '2NT', rule: '2NT inbjudan', explanation: `8–9 hp med stopp i ${sym(theirSuit)} → 2NT (inbjudan).` }
    return p >= 8
      ? pass(`värden men inget stopp i ${sym(theirSuit)} och inget systembud — avvaktar (straff-X i andra ronden)`)
      : pass('svag hand')
  }

  // Texas står alltid kvar (4♦/4♥ ligger över varje 2-lägesbud) — men aldrig IN i deras färg.
  if (u.rule === 'Texas') {
    const mal: Suit = u.call === '4D' ? 'hearts' : 'spades'
    if (mal !== theirSuit) return { ...u, explanation: `${u.explanation} (systems on över deras ${prettyBid(theirCall as Bid)})` }
  }

  // --- Deras 2♥/2♠: X = 8+ med fyrkorts högfärg, överföring på 3-läget. -----
  if (theirSuit === 'hearts' || theirSuit === 'spades') {
    const annan: Suit = theirSuit === 'hearts' ? 'spades' : 'hearts'
    if (len[annan] >= 5) {
      if (p < 8) return pass(`5+ ${sym(annan)} men under 8 hp (överföringen på 3-läget kräver 8+)`)
      const call = annan === 'hearts' ? '3D' : '3H'
      return {
        call, rule: 'överföring på 3-läget (stört 1NT)',
        explanation: `5+ ${sym(annan)} och 8+ hp → ${prettyBid(call as Bid)} (överföring till ${sym(annan)}; stayman/2-lägesöverföringen gick förlorad).`,
      }
    }
    if (len[annan] === 4 && p >= 8) {
      return {
        call: 'X', rule: 'värde-X med högfärg (stört 1NT)',
        explanation: `8+ hp med fyrkorts ${sym(annan)} → X (värden + fyrkorts högfärg; öppnaren svarar med fit eller sang).`,
      }
    }
    // Systembud som fortfarande ligger över deras bud och inte krockar med 3♦/3♥.
    if (u.call !== 'P' && !naturligSang && ord(u.call) > ord(theirCall) && u.call !== '3D' && u.call !== '3H') return u
    return jamnaVagen()
  }

  // --- Deras 2♣/2♦: stulet bud. ---------------------------------------------
  if (u.call === 'P') return pass('svag hand')
  if (u.call === theirCall) {
    return theirCall === '2C'
      ? { call: 'X', rule: 'stulet bud: Stayman', explanation: 'De bjöd min Stayman (2♣) → X = Stayman (stulet bud), frågar efter fyrkorts högfärg.' }
      : { call: 'X', rule: 'stulet bud: överföring', explanation: 'De bjöd min överföring (2♦) → X = överföring till ♥ (stulet bud, 5+ ♥).' }
  }
  if (ord(u.call) < ord(theirCall)) {
    // Tappat bud = Stayman under deras 2♦. Femkorts högfärg visas med överföring
    // i stället; annars jämna vägen (ingen fyrkortsfråga över 2♦).
    if (len.spades >= 5) return { call: '2H', rule: 'Jacoby-transfer', explanation: '5+ ♠ → 2♥ (överföring; Stayman gick förlorad under deras 2♦).' }
    if (len.hearts >= 5) return { call: 'X', rule: 'stulet bud: överföring', explanation: '5+ ♥ → X = överföring till ♥ (stulet bud; Stayman gick förlorad under deras 2♦).' }
    return jamnaVagen()
  }
  if (naturligSang) return jamnaVagen()
  return u
}

// ---------------------------------------------------------------------------
// Läget: vårt 1NT, deras inkliv i direkt sits, svararens bud
// ---------------------------------------------------------------------------

interface Lage {
  opener: Seat
  inter: ResolvedCall // deras X / 2-lägesbud direkt över 1NT
  resp: ResolvedCall // svararens första bud (kan vara P)
  after: ResolvedCall[] // allt efter svararens bud
}

function lage(f: AuctionFacts): Lage | null {
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || !f.weOpened) return null
  const h = f.history
  const i = h.findIndex((c) => c.seat === open.seat && c.bid === '1NT')
  if (i < 0 || h.length < i + 3) return null
  const inter = h[i + 1]
  const resp = h[i + 2]
  if (inter.seat !== NEXT[open.seat] || resp.seat !== PARTNER[open.seat]) return null
  if (inter.bid !== 'X' && !/^2[CDHS]$/.test(inter.bid)) return null
  return { opener: open.seat, inter, resp, after: h.slice(i + 3) }
}

/** Deras inkliv direkt över vårt 1NT är SENASTE budet och jag är svararen → budet, annars null. */
function forstaSvaret(f: AuctionFacts): string | null {
  const open = f.opening
  if (!open || open.strain !== 'NT' || open.level !== 1 || !f.weOpened) return null
  if (f.seat !== PARTNER[open.seat]) return null
  const h = f.history
  const i = h.findIndex((c) => c.seat === open.seat && c.bid === '1NT')
  if (i < 0 || h.length !== i + 2) return null
  const inter = h[i + 1]
  if (inter.seat !== NEXT[open.seat]) return null
  return inter.bid === 'X' || /^2[CDHS]$/.test(inter.bid) ? inter.bid : null
}

/** Svararens bud översatt till systembudet det betyder (call + regel), annars null. */
function virtuelltSvar(l: Lage): ResponseResult | null {
  const { inter, resp } = l
  if (resp.bid === 'X') {
    if (inter.bid === '2C') return { call: '2C', rule: 'Stayman', explanation: '' }
    if (inter.bid === '2D') return { call: '2D', rule: 'Jacoby-transfer', explanation: '' }
    return null // värde-X över 2♥/2♠ — eget svar
  }
  if ((inter.bid === '2H' || inter.bid === '2S') && (resp.bid === '3D' || resp.bid === '3H')) return null // 3-lägesöverföring
  const rule = ntResponseRule(1, resp.bid)
  return rule ? { call: resp.bid, rule, explanation: '' } : null
}

const asCall = (seat: Seat, r: { call: string; rule: string; explanation: string }): ResolvedCall =>
  ({ seat, bid: r.call as Bid, rule: r.rule, explanation: r.explanation })

// ---------------------------------------------------------------------------
// Öppnarens andra tur
// ---------------------------------------------------------------------------

function openerSecondTurn(hand: Hand, f: AuctionFacts, l: Lage): ResolvedCall | null {
  const { seat, history } = f
  if (l.after.length !== 1 || l.after[0].bid !== 'P') return null // fjärde hand blandade sig i → utanför
  const legal = legalCalls(history, seat)
  const p = hcp(hand)
  const len = lengths(hand)

  // Återöppning: 1NT – (2x) – pass – pass. Pass, utom 5+ högfärg på 2-läget.
  if (l.resp.bid === 'P') {
    if (l.inter.bid === 'X') return null
    for (const m of ['spades', 'hearts'] as Suit[]) {
      const bid = `2${letterOfSuit(m)}` as Bid
      if (len[m] >= 5 && legal.includes(bid)) {
        return { seat, bid, rule: 'återöppning med högfärg (1NT)', explanation: `Partnern passade deras inkliv – jag återöppnar bara med 5+ högfärg: ${prettyBid(bid)} (till spel).` }
      }
    }
    return { seat, bid: 'P', rule: 'pass', explanation: '1NT har sagt sitt – utan 5+ högfärg att bjuda på 2-läget passar jag deras inkliv.' }
  }

  if (l.resp.bid === 'XX') return { seat, bid: 'P', rule: 'pass', explanation: 'Partnerns XX = värden, vi äger given → pass (1NT redubblat står; flyr de straffdubblar vi).' }

  // Värde-X över deras 2♥/2♠: fit → lägsta nivå, annars 2NT (min) / 3NT (max).
  if (l.resp.bid === 'X' && (l.inter.bid === '2H' || l.inter.bid === '2S')) {
    const annan: Suit = l.inter.bid === '2H' ? 'spades' : 'hearts'
    if (len[annan] >= 4) {
      const bid = (annan === 'spades' ? '2S' : '3H') as Bid
      if (legal.includes(bid)) return { seat, bid, rule: 'svar på värde-X (stört 1NT)', explanation: `Partnerns X lovade fyrkorts ${sym(annan)} – jag har fit → ${prettyBid(bid)} (lägsta nivå; partnern placerar).` }
    }
    const bid = (p >= 17 ? '3NT' : '2NT') as Bid
    if (!legal.includes(bid)) return null
    return { seat, bid, rule: 'svar på värde-X (stört 1NT)', explanation: `Ingen fit i ${sym(annan)} → ${prettyBid(bid)} (${p >= 17 ? 'maximum' : 'minimum'}; partnern placerar).` }
  }

  // Överföring på 3-läget: alltid bara 3M.
  if ((l.inter.bid === '2H' || l.inter.bid === '2S') && (l.resp.bid === '3D' || l.resp.bid === '3H')) {
    const mal: Suit = l.resp.bid === '3D' ? 'hearts' : 'spades'
    const bid = `3${letterOfSuit(mal)}` as Bid
    if (!legal.includes(bid)) return null
    return { seat, bid, rule: 'fullföljd överföring (3-läget)', explanation: `Partnerns ${prettyBid(l.resp.bid as Bid)} = överföring till ${sym(mal)} → ${prettyBid(bid)} (fullföljer alltid; partnern avgör nivån).` }
  }

  // Stulet bud / systembud: svara exakt som ostört.
  const v = virtuelltSvar(l)
  if (!v) return null
  const res = openerRebidAfter1NTResponse(v, hand)
  if (!res) return null
  if (res.call !== 'P' && !legal.includes(res.call as Bid)) return null
  const stulet = l.resp.bid === 'X'
  return asCall(seat, {
    ...res,
    explanation: stulet ? `Partnerns X = ${v.rule === 'Stayman' ? 'Stayman' : 'överföring till ♥'} (stulet bud) – ${res.explanation}` : `${res.explanation} (systems on)`,
  })
}

// ---------------------------------------------------------------------------
// Svararens andra tur
// ---------------------------------------------------------------------------

function responderSecondTurn(hand: Hand, f: AuctionFacts, l: Lage): ResolvedCall | null {
  const { seat, history } = f
  const legal = legalCalls(history, seat)
  const p = hcp(hand)
  const len = lengths(hand)

  // Straff-X i andra ronden: jag passade deras inkliv med värden (inget stopp,
  // inget systembud); budgivningen har kommit tillbaka och de spelar på 2–3-läget.
  if (l.resp.bid === 'P') {
    const last = f.lastNonPass
    const cb = last ? parseContractBid(last.bid as Bid) : null
    // Ägarbeslut 2026-09-18 (stört-1NT-sonden: blinda straff-X dubblade hem deras
    // 2♠, −870/−470): kräver 8+ hp OCH minst tre kort i färgen de spelar.
    const iDerasFarg = cb && cb.strain !== 'NT' ? len[SUIT_OF_LETTER[cb.strain]] : 0
    if (p >= 8 && iDerasFarg >= 3 && last && cb && side(last.seat) !== side(seat) && cb.level <= 3 && legal.includes('X' as Bid)) {
      return { seat, bid: 'X', rule: 'straff-X (andra ronden)', explanation: `Jag passade deras inkliv med värden (8+) och har längd i deras färg (3+) – nu är X straff mot deras ${prettyBid(last.bid as Bid)}.` }
    }
    return null
  }

  // Härifrån: ostört efter mitt bud — [P, öppnarens rebud, P].
  if (l.after.length !== 3 || l.after[0].bid !== 'P' || l.after[2].bid !== 'P') return null
  const rebid = l.after[1]
  if (rebid.seat !== l.opener) return null

  // Efter värde-X över 2♥/2♠: placera kontraktet.
  if (l.resp.bid === 'X' && (l.inter.bid === '2H' || l.inter.bid === '2S')) {
    const annan: Suit = l.inter.bid === '2H' ? 'spades' : 'hearts'
    const L = letterOfSuit(annan)
    if (rebid.bid === `2${L}` || rebid.bid === `3${L}`) {
      if (p >= 10) return { seat, bid: `4${L}` as Bid, rule: 'placerar efter värde-X-svaret', explanation: `Öppnaren visade fit i ${sym(annan)}; 10+ hp mot 15–17 → 4${sym(annan)}.` }
      if (rebid.bid === `2${L}` && legal.includes(`3${L}` as Bid)) return { seat, bid: `3${L}` as Bid, rule: 'inbjudan', explanation: `Fit i ${sym(annan)}, 8–9 hp → 3${sym(annan)} (inbjudan; öppnaren höjer med maximum).` }
      return { seat, bid: 'P', rule: 'svararens pass', explanation: `Fit i ${sym(annan)} men bara 8–9 hp → pass.` }
    }
    if (rebid.bid === '2NT') {
      return p >= 10
        ? { seat, bid: '3NT', rule: 'placerar efter värde-X-svaret', explanation: 'Öppnaren visade minimum utan fit; 10+ hp → 3NT.' }
        : { seat, bid: 'P', rule: 'svararens pass', explanation: 'Öppnaren visade minimum utan fit; 8–9 hp → pass (2NT står).' }
    }
    return { seat, bid: 'P', rule: 'svararens pass', explanation: 'Öppnaren har placerat kontraktet → pass.' }
  }

  // Efter 3-lägesöverföringen: pass 8–9; 3NT (fem kort) / 4M (sex kort) med 10+.
  if ((l.inter.bid === '2H' || l.inter.bid === '2S') && (l.resp.bid === '3D' || l.resp.bid === '3H')) {
    const mal: Suit = l.resp.bid === '3D' ? 'hearts' : 'spades'
    const L = letterOfSuit(mal)
    if (rebid.bid !== `3${L}`) return null
    if (p < 10) return { seat, bid: 'P', rule: 'svararens pass', explanation: `8–9 hp → pass (3${sym(mal)} står).` }
    return len[mal] >= 6
      ? { seat, bid: `4${L}` as Bid, rule: 'till spel', explanation: `10+ hp och 6+ ${sym(mal)} → 4${sym(mal)}.` }
      : { seat, bid: '3NT', rule: 'utgångsval', explanation: `10+ hp och fem ${sym(mal)} → 3NT (öppnaren rättar till 4${sym(mal)} med 3+ stöd).` }
  }

  // Stulet bud / systembud: mitt rebud exakt som ostört.
  const v = virtuelltSvar(l)
  if (!v) return null
  const res = responderRebidIn1NTAuction(v, { call: rebid.bid, rule: rebid.rule ?? '', explanation: '' }, hand)
  if (!res) return null
  if (res.call !== 'P' && !legal.includes(res.call as Bid)) return null
  return asCall(seat, res)
}

// ---------------------------------------------------------------------------
// Öppnarens tredje tur (de två nya vägarna: inbjudan efter värde-X, utgångsval)
// ---------------------------------------------------------------------------

function openerThirdTurn(hand: Hand, f: AuctionFacts, l: Lage): ResolvedCall | null {
  const { seat } = f
  if (l.after.length !== 5 || ![0, 2, 4].every((k) => l.after[k].bid === 'P')) return null
  const mitt = l.after[1]
  const partners = l.after[3]
  if (mitt.seat !== seat || partners.seat !== PARTNER[seat]) return null
  const p = hcp(hand)
  const len = lengths(hand)

  // Värde-X-vägen: jag bjöd 2♠ (fit), partnern inbjöd med 3♠.
  if (l.resp.bid === 'X' && l.inter.bid === '2H' && mitt.bid === '2S' && partners.bid === '3S') {
    return p >= 17
      ? { seat, bid: '4S', rule: 'accepterar inbjudan', explanation: 'Maximum → 4♠.' }
      : { seat, bid: 'P', rule: 'rebid: pass', explanation: 'Minimum → pass (3♠ står).' }
  }
  // 3-lägesöverföringen: partnern valde 3NT med fem kort → rätta med 3+ stöd.
  if ((l.resp.bid === '3D' || l.resp.bid === '3H') && (l.inter.bid === '2H' || l.inter.bid === '2S') && partners.bid === '3NT') {
    const mal: Suit = l.resp.bid === '3D' ? 'hearts' : 'spades'
    return len[mal] >= 3
      ? { seat, bid: `4${letterOfSuit(mal)}` as Bid, rule: 'utgångsval: rättar till högfärgen', explanation: `Partnern visade fem ${sym(mal)}; 3+ stöd → 4${sym(mal)}.` }
      : { seat, bid: 'P', rule: 'rebid: pass', explanation: `Bara två ${sym(mal)} → pass (3NT står).` }
  }
  return null
}

/**
 * Ingången från raden *vårt-1nt-stört*: svararens första bud, öppnarens svar,
 * svararens placering och öppnarens sista ord. null → övriga lager.
 */
export function systemsOnAfterOur1NT(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const { seat } = f
  // Svararens FÖRSTA bud: deras inkliv är senaste budet.
  const forsta = forstaSvaret(f)
  if (forsta) return asCall(seat, systemsOnResponse(hand, forsta))
  const l = lage(f)
  if (!l) return null
  if (seat === l.opener) return openerSecondTurn(hand, f, l) ?? openerThirdTurn(hand, f, l)
  if (seat === PARTNER[l.opener]) return responderSecondTurn(hand, f, l)
  return null
}
