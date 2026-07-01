// Hand-modellen (docs/bot-hjarna.md, Steg 2 – ryggraden i bottens "läsa bordet").
// TOLKAR auktionen till STRUKTURERADE tal: för varje plats ett HP-SPANN (och
// kända renonser), i stället för den prosa `auction-interpret.ts` ger. Det här
// är enkeldummy-inferensen: räkna de 40 HP:na ur vad varje plats visat/förnekat.
//
// Del 1 (denna): HP-liggaren – öppnarens spann (1NT/2NT/1-i-färg) + passad hand
// (< 12) + kända renonser. Modellen KONSUMERAS ännu inte av botten; det gör
// Monte Carlo i Steg 3. Den byggs och test-låses först (FACIT FÖRE FIX).
//
// DEL 2 (kommer): färglängder (naturliga bud → 4+/5+, sang → balanserat),
// svararens/inklivarens spann, svaga tvåor/spärrar/stark 2♣, samt skärpning ur
// spelade kort. Håll constraints KONSERVATIVA – ett falskt spann förgiftar
// samplingen i Steg 3. Hellre för brett än fel.

import type { Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'

const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/
const SEATS: Seat[] = ['N', 'E', 'S', 'W']
/** Praktiskt tak för en hand (en plats kan aldrig ha alla 40 hp). */
const HCP_CEIL = 37

/** Vad auktionen ärligt säger om EN plats hand. */
export interface SeatConstraint {
  hcpMin: number
  hcpMax: number
  /** Färger platsen bevisat sig sakna (t.ex. via show-out under spelet). */
  voids: Set<Suit>
}

export type HandModel = Record<Seat, SeatConstraint>

function fresh(): SeatConstraint {
  return { hcpMin: 0, hcpMax: HCP_CEIL, voids: new Set() }
}

/**
 * Bygger HP-liggaren ur budföljden. `voids` (från `card-counting.shownVoids`)
 * kan skjutas in för att lägga till kända renonser från spelet.
 */
export function buildHandModel(
  calls: ResolvedCall[],
  opts: { voids?: Record<Seat, Set<Suit>> } = {},
): HandModel {
  const model: HandModel = { N: fresh(), E: fresh(), S: fresh(), W: fresh() }

  // Öppnaren = den första platsen som gör ett kontraktsbud. Dess spann är den
  // säkraste HP-inferensen i hela auktionen.
  const openerIdx = calls.findIndex((c) => CONTRACT_BID.test(c.bid))
  if (openerIdx >= 0) {
    const opener = calls[openerIdx]
    const m = CONTRACT_BID.exec(opener.bid)!
    applyOpening(model[opener.seat], Number(m[1]), m[2])
  }

  // Passad hand: en plats vars FÖRSTA bud är pass UTAN att något kontraktsbud
  // fallit före → handen nådde inte öppningskraven (< 12 hp). Gäller även om
  // platsen senare bjuder (en passad hand är per definition < 12).
  for (const seat of SEATS) {
    const firstIdx = calls.findIndex((c) => c.seat === seat)
    if (firstIdx < 0 || calls[firstIdx].bid !== 'P') continue
    const contractBefore = calls.slice(0, firstIdx).some((c) => CONTRACT_BID.test(c.bid))
    if (!contractBefore) model[seat].hcpMax = Math.min(model[seat].hcpMax, 11)
  }

  // Kända renonser från spelet.
  if (opts.voids) {
    for (const seat of SEATS) for (const s of opts.voids[seat]) model[seat].voids.add(s)
  }

  for (const seat of SEATS) clampFloor(model[seat])
  return model
}

/** Öppningsbudets HP-spann. Del 1: 1NT/2NT/1-i-färg (säkra). 2-läget senare. */
function applyOpening(c: SeatConstraint, level: number, strain: string): void {
  if (strain === 'NT') {
    if (level === 1) narrow(c, 15, 17)
    else if (level === 2) narrow(c, 20, 21)
    return
  }
  // 1-i-färg = öppningshand, men inte stark 2♣/2NT: 12–21 hp. (Svaga tvåor,
  // spärrar och stark 2♣ har egna spann → del 2, för att inte sätta falskt golv.)
  if (level === 1) narrow(c, 12, 21)
}

/** Snäva spannet till [min,max] utan att någonsin vidga det. */
function narrow(c: SeatConstraint, min: number, max: number): void {
  c.hcpMin = Math.max(c.hcpMin, min)
  c.hcpMax = Math.min(c.hcpMax, max)
}

/** Håll golvet <= taket (skydd mot motstridiga inferenser). */
function clampFloor(c: SeatConstraint): void {
  if (c.hcpMin > c.hcpMax) c.hcpMin = c.hcpMax
}
