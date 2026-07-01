// Hand-modellen (docs/bot-hjarna.md, Steg 2 – ryggraden i bottens "läsa bordet").
// TOLKAR auktionen till STRUKTURERADE tal: för varje plats ett HP-SPANN + ett
// LÄNGD-spann per färg (och kända renonser), i stället för den prosa
// `auction-interpret.ts` ger. Det här är enkeldummy-inferensen: räkna de 40
// HP:na och fördelningen ur vad varje plats visat/förnekat.
//
// Del 1: HP-liggaren (öppnarens spann + passad hand + renonser).
// Del 2 (denna): FÄRGLÄNGDER ur naturliga bud – konservativa GOLV som aldrig
// kan vara fel (ett falskt spann förgiftar Monte Carlo-samplingen i Steg 3):
//   • öppning 1♥/1♠ → 5+, 1♣/1♦ → 3+, 1NT/2NT → balanserat (2–5 i varje färg)
//   • ny naturlig färg (ej höjning/cue) → 4+;  rebjuden egen färg → 6+
//   • känd renons → exakt 0 (hård fakta, slår budinferensen)
// Modellen KONSUMERAS ännu inte av botten; det gör Monte Carlo i Steg 3.
//
// DEL 3 (kommer): svarar-/inklivsspann i HP, svaga tvåor/spärrar/stark 2♣,
// samt skärpning ur spelade kort (exakt återstående längd).

import type { Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'

const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/
const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const STRAIN_SUIT: Record<string, Suit | undefined> = {
  C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades', NT: undefined,
}
const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const SIDE: Record<Seat, 'NS' | 'EW'> = { N: 'NS', S: 'NS', E: 'EW', W: 'EW' }
/** Praktiskt tak för en hand (en plats kan aldrig ha alla 40 hp). */
const HCP_CEIL = 37

export interface Range {
  min: number
  max: number
}

/** Vad auktionen (+ spelet) ärligt säger om EN plats hand. */
export interface SeatConstraint {
  hcpMin: number
  hcpMax: number
  /** Längd-spann per färg (default 0–13). */
  length: Record<Suit, Range>
  /** Färger platsen bevisat sig sakna (t.ex. via show-out under spelet). */
  voids: Set<Suit>
}

export type HandModel = Record<Seat, SeatConstraint>

function fresh(): SeatConstraint {
  const length = {} as Record<Suit, Range>
  for (const s of SUITS) length[s] = { min: 0, max: 13 }
  return { hcpMin: 0, hcpMax: HCP_CEIL, length, voids: new Set() }
}

interface ParsedBid {
  level: number
  strain: string
}
function parse(bid: string): ParsedBid | null {
  const m = CONTRACT_BID.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}

/**
 * Bygger hand-modellen ur budföljden. `voids` (från `card-counting.shownVoids`)
 * kan skjutas in för att lägga till kända renonser från spelet.
 */
export function buildHandModel(
  calls: ResolvedCall[],
  opts: { voids?: Record<Seat, Set<Suit>> } = {},
): HandModel {
  const model: HandModel = { N: fresh(), E: fresh(), S: fresh(), W: fresh() }

  // Öppnaren = den första platsen som gör ett kontraktsbud. Dess HP-spann OCH
  // form (naturlig färg / balanserad sang) är de säkraste inferenserna.
  const openerIdx = calls.findIndex((c) => CONTRACT_BID.test(c.bid))
  if (openerIdx >= 0) {
    const opener = calls[openerIdx]
    const p = parse(opener.bid)!
    applyOpening(model[opener.seat], p.level, p.strain)
  }

  // Passad hand: första budet är pass UTAN kontraktsbud före → < 12 hp.
  for (const seat of SEATS) {
    const firstIdx = calls.findIndex((c) => c.seat === seat)
    if (firstIdx < 0 || calls[firstIdx].bid !== 'P') continue
    const contractBefore = calls.slice(0, firstIdx).some((c) => CONTRACT_BID.test(c.bid))
    if (!contractBefore) model[seat].hcpMax = Math.min(model[seat].hcpMax, 11)
  }

  // Färglängder ur naturliga färgbud (öppningen redan hanterad ovan).
  calls.forEach((c, i) => {
    if (i === openerIdx) return
    const p = parse(c.bid)
    if (!p) return
    const suit = STRAIN_SUIT[p.strain]
    if (!suit) return // sang säger inget om en enskild färg här
    const prior = calls.slice(0, i)
    if (bidSuitBefore(c.seat, suit, prior)) {
      lenMin(model[c.seat], suit, 6) // rebjuden egen färg → extra längd
    } else if (partnerBidSuit(c.seat, suit, prior) || opponentBidSuit(c.seat, suit, prior)) {
      // höjning av partnerns färg / cue i motståndarnas → ingen egen längd-inferens
    } else {
      lenMin(model[c.seat], suit, 4) // ny naturlig färg → 4+
    }
  })

  // Kända renonser: hård fakta som slår budinferensen (längd exakt 0).
  if (opts.voids) {
    for (const seat of SEATS) {
      for (const s of opts.voids[seat]) {
        model[seat].voids.add(s)
        model[seat].length[s] = { min: 0, max: 0 }
      }
    }
  }

  for (const seat of SEATS) clampFloor(model[seat])
  return model
}

/** Öppningsbudets HP-spann + form. Del 1/2: 1NT/2NT/1-i-färg (säkra). */
function applyOpening(c: SeatConstraint, level: number, strain: string): void {
  if (strain === 'NT') {
    if (level === 1) narrowHcp(c, 15, 17)
    else if (level === 2) narrowHcp(c, 20, 21)
    // Balanserad → ingen kort/renons: varje färg 2–5.
    if (level === 1 || level === 2) for (const s of SUITS) narrowLen(c, s, 2, 5)
    return
  }
  if (level !== 1) return // svaga tvåor/spärrar/stark 2♣ → del 3
  narrowHcp(c, 12, 21)
  const suit = STRAIN_SUIT[strain]!
  // 2/1: högfärgsöppning 5+, minoröppning 3+ (better minor).
  lenMin(c, suit, suit === 'hearts' || suit === 'spades' ? 5 : 3)
}

function bidSuitBefore(seat: Seat, suit: Suit, prior: ResolvedCall[]): boolean {
  return prior.some((c) => c.seat === seat && STRAIN_SUIT[parse(c.bid)?.strain ?? ''] === suit)
}
function partnerBidSuit(seat: Seat, suit: Suit, prior: ResolvedCall[]): boolean {
  return prior.some((c) => c.seat === PARTNER[seat] && STRAIN_SUIT[parse(c.bid)?.strain ?? ''] === suit)
}
function opponentBidSuit(seat: Seat, suit: Suit, prior: ResolvedCall[]): boolean {
  return prior.some((c) => SIDE[c.seat] !== SIDE[seat] && STRAIN_SUIT[parse(c.bid)?.strain ?? ''] === suit)
}

function narrowHcp(c: SeatConstraint, min: number, max: number): void {
  c.hcpMin = Math.max(c.hcpMin, min)
  c.hcpMax = Math.min(c.hcpMax, max)
}
function lenMin(c: SeatConstraint, suit: Suit, min: number): void {
  c.length[suit].min = Math.max(c.length[suit].min, min)
}
function narrowLen(c: SeatConstraint, suit: Suit, min: number, max: number): void {
  c.length[suit].min = Math.max(c.length[suit].min, min)
  c.length[suit].max = Math.min(c.length[suit].max, max)
}
/** Håll golv <= tak för både HP och längder (skydd mot motstridiga inferenser). */
function clampFloor(c: SeatConstraint): void {
  if (c.hcpMin > c.hcpMax) c.hcpMin = c.hcpMax
  for (const s of SUITS) if (c.length[s].min > c.length[s].max) c.length[s].min = c.length[s].max
}
