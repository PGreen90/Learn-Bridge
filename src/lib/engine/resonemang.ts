// RESONEMANGSLAGRET — steg 1, probe utanför appen (ägarbeslut 2026-09-22,
// docs/sunt-fornuft-plan.md). Ägarens krav: datorn ska kunna resonera som en
// människa i lägen där ingen tabellrad träffar — "partnern bjöd inte om klövern,
// alltså inte 5 klöver; dubblade inte, alltså inte 4-4 i de objudna; kvar 4♠ 4♣".
//
// Metoden: simulering med den EGNA regelboken som filter.
//   1. Slumpa händer till de tre andra stolarna, med bara min hand känd.
//   2. Behåll de händer där motorn själv (decideCall) hade bjudit exakt som
//      stolen faktiskt gjorde — varje bud OCH varje pass. Det ger den negativa
//      inferensen gratis: händer som hade bjudit annorlunda faller bort.
//   3. För varje tänkbart bud: buda klart given med fyra bottar på varje behållen
//      hand, räkna dubbeldummy-resultatet, ta snittet (poäng för min sida).
//   4. Sluta tidigt när ledaren är säkert före (budget + tidigt stopp).
//   5. Pass-spärren (urvalsprovet 2026-09-23): ett bud väljs bara om det slår pass
//      säkert, parat hand för hand — en ledning inom bruset lämnar tystnaden kvar.
// Ärlig inferens: bara egen hand + auktionen; slumpen ersätter de dolda korten.
// Bedömningen är väntevärdet över allt handen KAN vara — inte en DD-dom på en
// enskild giv (ägarprincip 2026-08-06 gäller oförändrad).

import type { Bid, Card, Deal, Hand, Seat, Suit } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER } from './auction-facts'
import { contractFromCalls } from './auction-contract'
import { auctionComplete, decideCall } from './auction-live'
import { legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { hcp, lengths } from './hand'
import { nsScore } from './matchpoints'
import { side } from './play'
import type { DDSolver } from './revisor'

export interface ResonemangOpts {
  /** Dubbeldummy för en (slumpad) giv — anropas en gång per behållen hand. */
  oracle: (deal: Deal) => DDSolver
  budgetMs?: number
  minHands?: number
  maxHands?: number
  /** Högsta antal slumpdragningar innan vi ger upp (för långa auktioner). */
  maxDraws?: number
  seed?: number
}

export interface Kandidat {
  bud: Bid
  n: number
  snitt: number
  /** Standardfel för snittet. */
  se: number
  /** Skillnaden mot pass, parad hand för hand (samma händer), med standardfel. Saknas för pass. */
  motPass?: { diff: number; se: number }
}

/** Pass-spärren (urvalsprovet 2026-09-23): ett bud måste slå pass med mer än så här
 *  många standardfel (parad skillnad), annars är ledningen brus och tystnaden står kvar. */
export const PASS_MARGINAL = 2

/** Välj bland kandidaterna: det bästa budet (högst snitt) som SÄKERT slår pass; annars pass.
 *  `spärrad` = budet som ledde i snitt men inte klarade spärren. */
export function valjMotPass(k: Kandidat[]): { val: Bid; spärrad?: Bid } {
  const sorterade = [...k].sort((a, b) => b.snitt - a.snitt)
  const saker = (c: Kandidat) => c.bud === 'P' || (!!c.motPass && c.motPass.diff > PASS_MARGINAL * c.motPass.se)
  const val = sorterade.find(saker)?.bud ?? ('P' as Bid)
  const ledare = sorterade[0]?.bud
  return ledare && ledare !== val && ledare !== 'P' ? { val, spärrad: ledare } : { val }
}

export interface Resonemang {
  val: Bid
  kandidater: Kandidat[]
  hander: number
  dragningar: number
  ms: number
  stoppadeTidigt: boolean
  /** Partnerns troliga hand ur de behållna händerna. */
  partner: { langd: Record<Suit, number>; hpMin: number; hpMax: number; hpSnitt: number }
  forklaring: string
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Slumpa de 39 okända korten över de tre andra stolarna. */
function slumpaGiv(deal: Deal, me: Seat, rand: () => number): Deal {
  const others = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => s !== me)
  const cards: Card[] = others.flatMap((s) => deal.hands[s])
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  const hands = { ...deal.hands }
  others.forEach((s, k) => { hands[s] = cards.slice(k * 13, k * 13 + 13) })
  return { ...deal, hands }
}

/** Stämmer den slumpade given med auktionen? Motorn måste reproducera varje annan stols bud. */
function stammer(d: Deal, history: ResolvedCall[], me: Seat): boolean {
  for (let i = 0; i < history.length; i++) {
    const seat = history[i].seat
    if (seat === me) continue
    if (decideCall(d, history.slice(0, i), seat).bid !== history[i].bid) return false
  }
  return true
}

/** Tänkbara bud: pass, X/XX om lagligt, billigaste bud i varje 4+ färg och i partnerns färg, billigaste sang. */
function kandidater(hand: Hand, history: ResolvedCall[], me: Seat): Bid[] {
  const legal = legalCalls(history, me)
  const len = lengths(hand)
  const out = new Set<Bid>(['P' as Bid])
  for (const b of ['X', 'XX'] as Bid[]) if (legal.includes(b)) out.add(b)
  const partnerSuits = new Set(
    history.filter((c) => c.seat === PARTNER[me]).map((c) => parseContractBid(c.bid)?.strain).filter((s): s is string => !!s && s !== 'NT'),
  )
  const cheapest = (strain: string): Bid | null => legal.find((b) => parseContractBid(b)?.strain === strain) ?? null
  for (const s of SUITS) {
    const L = letterOfSuit(s)
    if (len[s] >= 4 || (partnerSuits.has(L) && len[s] >= 3)) {
      const b = cheapest(L)
      if (b && parseContractBid(b)!.level <= 5) out.add(b)
    }
  }
  const nt = cheapest('NT')
  if (nt && parseContractBid(nt)!.level <= 3) out.add(nt)
  return [...out]
}

function budaKlart(d: Deal, history: ResolvedCall[]): ResolvedCall[] {
  const h = [...history]
  let guard = 0
  while (!auctionComplete(h) && guard++ < 60) h.push(decideCall(d, h, seatAt(d.dealer, h.length)))
  return h
}

/** Poäng för MIN sida på en slumpad giv efter budet `bud`. */
function poang(d: Deal, history: ResolvedCall[], me: Seat, bud: Bid, solve: DDSolver): number {
  const h = budaKlart(d, [...history, { seat: me, bid: bud } as ResolvedCall])
  const c = contractFromCalls(h)
  if (!c) return 0
  const tricks = solve(c.declarer, c.strain)
  if (tricks === null) return 0
  const ns = nsScore(c, tricks, d.vulnerability)
  return side(me) === 'NS' ? ns : -ns
}

export function resonera(deal: Deal, history: ResolvedCall[], me: Seat, opts: ResonemangOpts): Resonemang {
  const t0 = performance.now()
  const budget = opts.budgetMs ?? 15_000
  const minH = opts.minHands ?? 12
  const maxH = opts.maxHands ?? 300
  const maxDraws = opts.maxDraws ?? 200_000
  const rand = rng(opts.seed ?? 1)
  const hand = deal.hands[me]
  const buds = kandidater(hand, history, me)
  // s/s2 = budets poäng; d/d2 = skillnaden mot pass på samma hand (parad jämförelse).
  const sum = new Map<Bid, { n: number; s: number; s2: number; d: number; d2: number }>(
    buds.map((b) => [b, { n: 0, s: 0, s2: 0, d: 0, d2: 0 }]),
  )
  const plen: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 }
  let php = 0, phpMin = 40, phpMax = 0
  let hander = 0, dragningar = 0, stoppadeTidigt = false

  const stat = (): Kandidat[] =>
    buds.map((b) => {
      const { n, s, s2, d, d2 } = sum.get(b)!
      const medel = (x: number, x2: number) => {
        const m = n ? x / n : 0
        const v = n > 1 ? Math.max(0, (x2 - n * m * m) / (n - 1)) : 0
        return { m, se: n > 1 ? Math.sqrt(v / n) : Infinity }
      }
      const p = medel(s, s2)
      const kand: Kandidat = { bud: b, n, snitt: p.m, se: p.se }
      if (b !== 'P') { const q = medel(d, d2); kand.motPass = { diff: q.m, se: q.se } }
      return kand
    })

  while (hander < maxH && dragningar < maxDraws && performance.now() - t0 < budget) {
    dragningar++
    const d = slumpaGiv(deal, me, rand)
    if (!stammer(d, history, me)) continue
    hander++
    const solve = opts.oracle(d)
    const pa = new Map(buds.map((b) => [b, poang(d, history, me, b, solve)]))
    const passP = pa.get('P' as Bid)!
    for (const b of buds) {
      const p = pa.get(b)!
      const a = sum.get(b)!
      a.n++; a.s += p; a.s2 += p * p
      a.d += p - passP; a.d2 += (p - passP) ** 2
    }
    const ph = d.hands[PARTNER[me]]
    const l = lengths(ph)
    for (const s of SUITS) plen[s] += l[s]
    const h = hcp(ph)
    php += h; phpMin = Math.min(phpMin, h); phpMax = Math.max(phpMax, h)

    // Tidigt stopp: ledaren säkert före tvåan (skillnaden > 2 standardfel) OCH
    // ledaren är pass eller klarar pass-spärren — annars kan mer data ändra beslutet.
    if (hander >= minH && hander % 4 === 0 && buds.length > 1) {
      const k = stat().sort((a, b) => b.snitt - a.snitt)
      const diff = k[0].snitt - k[1].snitt
      const se = Math.sqrt(k[0].se ** 2 + k[1].se ** 2)
      if (diff > 2 * se && valjMotPass(k).val === k[0].bud) { stoppadeTidigt = true; break }
    }
  }

  const k = stat().sort((a, b) => b.snitt - a.snitt)
  const { val, spärrad } = hander > 0 ? valjMotPass(k) : { val: 'P' as Bid, spärrad: undefined }
  const partner = {
    langd: Object.fromEntries(SUITS.map((s) => [s, hander ? plen[s] / hander : 0])) as Record<Suit, number>,
    hpMin: hander ? phpMin : 0, hpMax: hander ? phpMax : 0, hpSnitt: hander ? php / hander : 0,
  }
  const form = SUITS.map((s) => `${SWE_SYM[letterOfSuit(s)]}${partner.langd[s].toFixed(1)}`).join(' ')
  const alt = k.slice(0, 3).map((c) => `${prettyBid(c.bud)} ${c.snitt >= 0 ? '+' : ''}${c.snitt.toFixed(0)}`).join(' · ')
  const forklaring = hander
    ? `Av ${hander} händer som stämmer med budgivningen ser partnern ut att ha ${form} och ${partner.hpMin}–${partner.hpMax} hp (snitt ${partner.hpSnitt.toFixed(0)}). Bästa bud i snitt: ${alt}.` +
      (spärrad ? ` ${prettyBid(spärrad)} leder, men inte säkert före pass${val === 'P' ? ' → pass' : ` → ${prettyBid(val)}`}.` : '')
    : `Hittade ingen hand som stämmer med budgivningen på ${dragningar} försök → pass.`
  return { val, kandidater: k, hander, dragningar, ms: performance.now() - t0, stoppadeTidigt, partner, forklaring }
}

/** Hjälpare för proben: sammanfattning av en kandidatlista. */
export function kandidatRad(k: Kandidat[]): string {
  const z = (c: Kandidat) =>
    c.motPass && isFinite(c.motPass.se) && c.motPass.se > 0 ? ` (${(c.motPass.diff / c.motPass.se).toFixed(1)}σ)` : ''
  return k.map((c) => `${prettyBid(c.bud)}:${c.snitt >= 0 ? '+' : ''}${c.snitt.toFixed(0)}±${isFinite(c.se) ? c.se.toFixed(0) : '?'}${z(c)}`).join('  ')
}

export { SUIT_OF_LETTER }

/**
 * Är läget värt att tänka på? Gaten för bordet (steg 3): resonemangslagret körs
 * bara när ingen tabellrad träffade OCH handen har något att fundera över —
 * inte i de rena "inget att säga"-passen (mätningens B/F1/J: vi eller de står
 * redan i utgång, eller handen är tom). Egen hand + auktionen, inget annat.
 */
export function vardAttTanka(deal: Deal, history: ResolvedCall[], me: Seat): boolean {
  const hand = deal.hands[me]
  const p = hcp(hand)
  const len = lengths(hand)
  const longest = Math.max(len.spades, len.hearts, len.diamonds, len.clubs)
  const contracts = history.filter((c) => parseContractBid(c.bid))
  const last = contracts[contracts.length - 1]
  if (!last) return false // öppningsläget har egna regler
  const cb = parseContractBid(last.bid)!
  const game = (cb.strain === 'NT' && cb.level >= 3) || ((cb.strain === 'H' || cb.strain === 'S') && cb.level >= 4) || cb.level >= 5
  if (game && side(last.seat) === side(me)) return false // vi står i utgång+
  if (game && p < 14) return false // de står i utgång och jag är inte stark
  const partnerBid = history.some((c) => c.seat === PARTNER[me] && c.bid !== 'P')
  return p >= 10 || longest >= 6 || (partnerBid && p >= 6)
}

/** Deterministiskt frö ur given + läget, så samma läge alltid tänker likadant (felrapporter). */
export function resonemangSeed(deal: Deal, history: ResolvedCall[]): number {
  let h = 2166136261
  for (const ch of `${deal.id}|${history.length}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}
