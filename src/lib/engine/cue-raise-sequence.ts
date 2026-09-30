// CUE-HÖJNINGENS FORTSÄTTNING — läsaren (Hål D steg 2, ägarens struktur
// 2026-09-28, systembok §7.8 c). Läser UR AUKTIONEN ENSAM (ingen hand): vår
// 1♥/1♠-öppning, ett färginkliv, partnerns cue-höjning i deras färg (limit-
// höjning eller bättre) och därefter vår sidas alternerande bud medan
// motståndarna tiger. Både beslutstabellens kunskapsfunktioner
// (`cue-raise-continuations.ts`) och betydelselagret (`auction-meaning.ts`)
// läser samma sekvens härifrån — därför inga beroenden på faktalagret (som
// själv importerar betydelselagret).

import type { Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { side } from './play'

const PARTNER_OF: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const STRAIN_ORDER = ['C', 'D', 'H', 'S', 'NT']
const SUIT_OF: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

interface Parsed { level: number; strain: string }
function parse(bid: string): Parsed | null {
  const m = /^([1-7])(C|D|H|S|NT)$/.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}
/** Rangtal för "högre/lägre bud"-jämförelser. */
export function cueRank(bid: string): number {
  const p = parse(bid)
  return p ? (p.level - 1) * 5 + STRAIN_ORDER.indexOf(p.strain) : -1
}

/** Vad ett bud i sekvensen EFTER cue-höjningen är. */
export type CueRaiseSteg = 'minimum' | '3NT' | 'kontrollbud' | 'utgång' | '4NT' | 'övrigt'

export interface CueRaiseSequence {
  opener: Seat
  raiser: Seat
  /** Den satta trumfen (öppningsfärgen). */
  trump: Suit
  trumpStrain: 'H' | 'S'
  /** Motståndarnas färg som partnern cue-bjöd. */
  theirStrain: string
  theirSuit: Suit
  /** Index i historiken för cue-höjningen. */
  cueIdx: number
  /** Vår sidas kontraktsbud EFTER cue-höjningen (öppnare, höjare, öppnare …). */
  after: ResolvedCall[]
}

/**
 * Sekvensen sedd från `seat`s sida, eller null när auktionen inte är en
 * cue-höjning av vår högfärgsöppning med tysta motståndare efteråt:
 *  · första kontraktsbudet är 1♥/1♠ från vår sida,
 *  · vår sidas andra kontraktsbud är partnerns (öppnarens partner) cue i en
 *    färg motståndarna bjudit dessförinnan, under 3 i trumf (så att det
 *    billiga minimisvaret finns),
 *  · efter cuet har motståndarna bara passat (bjuder eller dubblar de tar
 *    konkurrensreglerna över — §7.1 felrapport #47 m.fl.).
 * `fore` = läs bara fram till (exklusive) det indexet — betydelselagret
 * tolkar bud nr i mot auktionen före det.
 */
export function cueRaiseSequenceIn(history: ResolvedCall[], seat: Seat, fore: number = history.length): CueRaiseSequence | null {
  const h = history.slice(0, fore)
  const contracts = h.map((c, i) => ({ c, i, p: parse(c.bid) })).filter((x) => x.p !== null) as { c: ResolvedCall; i: number; p: Parsed }[]
  if (contracts.length < 2) return null
  const open = contracts[0]
  if (open.p.level !== 1 || (open.p.strain !== 'H' && open.p.strain !== 'S')) return null
  if (side(open.c.seat) !== side(seat)) return null
  const opener = open.c.seat
  const raiser = PARTNER_OF[opener]
  const ours = contracts.filter((x) => side(x.c.seat) === side(seat))
  if (ours.length < 2 || ours[1].c.seat !== raiser) return null
  const cue = ours[1]
  const theirBefore = new Set(contracts.filter((x) => x.i < cue.i && side(x.c.seat) !== side(seat)).map((x) => x.p.strain))
  if (cue.p.strain === 'NT' || cue.p.strain === open.p.strain || !theirBefore.has(cue.p.strain)) return null
  if (cueRank(cue.c.bid) >= cueRank(`3${open.p.strain}`)) return null
  // Höjaren får inte ha dubblat före cuet (negativ-dubblarens cue är §5.8, en annan struktur).
  if (h.slice(0, cue.i).some((c) => c.seat === raiser && c.bid !== 'P')) return null
  // Efter cuet: bara pass från motståndarna.
  const after: ResolvedCall[] = []
  for (let i = cue.i + 1; i < h.length; i++) {
    const c = h[i]
    if (side(c.seat) !== side(seat)) {
      if (c.bid !== 'P') return null
      continue
    }
    if (c.bid === 'X' || c.bid === 'XX') return null
    if (c.bid !== 'P') after.push(c)
  }
  const trumpStrain = open.p.strain as 'H' | 'S'
  return { opener, raiser, trump: SUIT_OF[trumpStrain], trumpStrain, theirStrain: cue.p.strain, theirSuit: SUIT_OF[cue.p.strain], cueIdx: cue.i, after }
}

/** Klassar ett av vår sidas bud efter cue-höjningen. */
export function cueRaiseSteg(bid: string, seq: Pick<CueRaiseSequence, 'trumpStrain'>): CueRaiseSteg {
  const p = parse(bid)
  if (!p) return 'övrigt'
  if (bid === '4NT') return '4NT'
  if (p.strain === 'NT') return p.level === 3 ? '3NT' : 'övrigt'
  if (p.strain === seq.trumpStrain) return p.level === 3 ? 'minimum' : p.level === 4 ? 'utgång' : 'övrigt'
  return cueRank(bid) < cueRank(`4${seq.trumpStrain}`) ? 'kontrollbud' : 'övrigt'
}

/** Färgerna som kontrollbjudits (av någon av oss) i sekvensen hittills. */
export function cuedSuits(seq: CueRaiseSequence): Set<Suit> {
  const s = new Set<Suit>()
  for (const c of seq.after) {
    if (cueRaiseSteg(c.bid, seq) === 'kontrollbud') s.add(SUIT_OF[parse(c.bid)!.strain])
  }
  return s
}

export const CUE_SUIT_OF = SUIT_OF
