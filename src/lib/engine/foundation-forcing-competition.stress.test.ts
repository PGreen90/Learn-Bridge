// STRESSTEST (10 000 seedade givar) för "störda krav" (competitionForce).
//
// Spelar upp HELA auktioner via decideCall för alla fyra platser (motståndarna
// kliver in på riktigt via §7 → auktionerna blir konkurrensutsatta av sig
// själva). Deterministiskt (seedad rng) så varje fel kan återskapas.
//
// Kontrollerar tre saker på varje giv:
//   1. LAGLIGHET   – varje bud finns i legalCalls (ingen olaglig utdata).
//   2. TERMINERING – auktionen blir alltid klar (aldrig oändlig).
//   3. RONDKRAVET  – ett OBEROENDE orakel (nedan) re-härleder när VÅR sida är i
//      konkurrens-rondkrav (fritt bud / reverse, obesvarat). Är sätet i krav får
//      motorns bud ALDRIG vara pass. Detta är hela poängen med fixen, prövad över
//      10 000 slumpade störda auktioner i stället för tre handgjorda facit.

import { describe, expect, it } from 'vitest'
import { dealRandom } from './deal'
import { auctionComplete, decideCall, legalCalls, seatToAct } from './auction-live'
import type { ResolvedCall } from '../bidding'
import type { Seat } from '../../types/bridge'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Oberoende orakel (re-härlett från grunden, delar ingen kod med motorn) ----
const STRAINS = ['C', 'D', 'H', 'S'] as const
function parseBid(bid: string): { level: number; strain: string } | null {
  const m = /^([1-7])(NT|C|D|H|S)$/.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}
function oracleSide(seat: Seat): 'NS' | 'EW' {
  return seat === 'N' || seat === 'S' ? 'NS' : 'EW'
}
function oraclePartner(seat: Seat): Seat {
  return ({ N: 'S', S: 'N', E: 'W', W: 'E' } as const)[seat]
}
function rank(strain: string): number {
  return strain === 'NT' ? STRAINS.length : STRAINS.indexOf(strain as (typeof STRAINS)[number])
}
/** Är kontraktsbudet vid `idx` ett HOPP (över billigaste möjliga nivå)? */
function oracleIsJump(history: ResolvedCall[], idx: number): boolean {
  const cb = parseBid(history[idx].bid)
  if (!cb) return false
  let prevLevel = 0
  let prevRank = -1
  for (let i = 0; i < idx; i++) {
    const p = parseBid(history[i].bid)
    if (!p) continue
    prevLevel = p.level
    prevRank = rank(p.strain)
  }
  const minLevel = rank(cb.strain) > prevRank ? prevLevel : prevLevel + 1
  return cb.level > minLevel
}
/** Är VÅR sida i konkurrens-rondkrav som `seat` (obesvarat fritt bud / reverse)? */
function oracleCompetitionForce(history: ResolvedCall[], seat: Seat): boolean {
  const contractBids = history.filter((c) => parseBid(c.bid))
  if (contractBids.length < 2) return false
  const first = contractBids[0]
  if (oracleSide(first.seat) !== oracleSide(seat)) return false // vår sida måste ha öppnat
  const open = parseBid(first.bid)!
  if (open.strain === 'NT') return false
  if (!contractBids.some((c) => oracleSide(c.seat) !== oracleSide(seat))) return false // måste vara störd
  const opener = first.seat
  const responder = oraclePartner(opener)
  const highest = contractBids[contractBids.length - 1]
  if (oracleSide(highest.seat) !== oracleSide(seat)) return false
  const highestIdx = history.indexOf(highest)
  if (history.slice(highestIdx + 1).some((c) => c.bid !== 'P')) return false

  const openerBids = contractBids.filter((c) => c.seat === opener)
  const responderBids = contractBids.filter((c) => c.seat === responder)
  const oppStrains = new Set(
    contractBids.filter((c) => oracleSide(c.seat) !== oracleSide(seat)).map((c) => parseBid(c.bid)!.strain),
  )
  const responderPassedFirst =
    !!responderBids[0] &&
    history.slice(0, history.indexOf(responderBids[0])).some((c) => c.seat === responder && c.bid === 'P')

  // (a) svararens fria nya färg → öppnaren måste rebjuda. UNDANTAG (fix 5b,
  // speglar competitionForce): dubblade svararen tidigare är den senare färgen
  // dubblarens ombud (X + färg = invit, ej krav) → inget rondkrav.
  const responderDoubledEarlier = history.some(
    (c, i) => i < highestIdx && c.seat === responder && c.bid === 'X',
  )
  if (seat === opener && highest.seat === responder && !responderPassedFirst && !responderDoubledEarlier) {
    const b = parseBid(highest.bid)!
    const timesInStrain = responderBids.filter((c) => parseBid(c.bid)!.strain === b.strain).length
    const isNewSuit =
      b.strain !== 'NT' && b.strain !== open.strain && timesInStrain === 1 && !oppStrains.has(b.strain)
    if (isNewSuit && !oracleIsJump(history, highestIdx)) return true
  }
  // (b) öppnarens reverse → svararen måste svara
  if (seat === responder && highest.seat === opener && openerBids.length >= 2) {
    const firstOpen = parseBid(openerBids[0].bid)!
    const second = parseBid(highest.bid)!
    const firstResp = responderBids[0] ? parseBid(responderBids[0].bid)! : null
    const isReverse =
      firstResp?.level === 1 &&
      second.level === 2 && second.strain !== 'NT' &&
      second.strain !== firstOpen.strain &&
      rank(second.strain) > rank(firstOpen.strain)
    if (isReverse) return true
  }
  return false
}

function handsStr(deal: ReturnType<typeof dealRandom>): string {
  return (['N', 'E', 'S', 'W'] as const)
    .map((s) => `${s}=${deal.hands[s].map((c) => c.suit[0] + c.rank).join(',')}`)
    .join(' | ')
}

describe('STRESS (10 000 givar): störda krav honoreras alltid', () => {
  it('varje bud lagligt · auktionen blir klar · konkurrens-rondkrav passas aldrig', () => {
    const rng = mulberry32(20260705)
    let forcedHits = 0 // hur ofta rondkravet faktiskt utlöstes (täckningsbevis)
    for (let i = 0; i < 10000; i++) {
      const deal = dealRandom(rng)
      const history: ResolvedCall[] = []
      for (let step = 0; step < 40 && !auctionComplete(history); step++) {
        const seat = seatToAct(deal.dealer, history.length)
        const c = decideCall(deal, history, seat)
        const ctx = `giv ${i} dealer=${deal.dealer} ${handsStr(deal)} | historik=${history.map((h) => h.seat + h.bid).join(' ')} | bud=${c.seat}${c.bid}`
        expect(c.seat, ctx).toBe(seat)
        expect(legalCalls(history, seat), ctx).toContain(c.bid) // 1. laglighet
        if (oracleCompetitionForce(history, seat)) {
          forcedHits++
          expect(c.bid, `RONDKRAV PASSADES: ${ctx}`).not.toBe('P') // 3. kravet honoreras
        }
        history.push(c)
      }
      expect(auctionComplete(history), `giv ${i} blev aldrig klar: ${handsStr(deal)}`).toBe(true) // 2. terminering
    }
    // Täckningsbevis: kravet ska ha utlösts en icke-trivial mängd gånger, annars
    // provar testet ingenting (skydd mot att oraklet slutar matcha efter en fix).
    // (Tröskeln sänkt 20 → 5 i och med fix 5b: dubblarens ombud efter negativ
    // dubbling räknas inte längre som rondkrav, vilket var majoriteten av
    // träffarna. De kvarvarande är äkta fria bud/reverse i konkurrens.)
    expect(forcedHits, `konkurrens-rondkravet utlöstes bara ${forcedHits} gånger`).toBeGreaterThan(5)
  }, 240000)
})
