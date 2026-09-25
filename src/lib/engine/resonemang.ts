// RESONEMANGSLAGRET — steg 1, probe utanför appen (ägarbeslut 2026-09-22,
// docs/sunt-fornuft-plan.md). Ägarens krav: datorn ska kunna resonera som en
// människa i lägen där ingen tabellrad träffar — "partnern bjöd inte om klövern,
// alltså inte 5 klöver; dubblade inte, alltså inte 4-4 i de objudna; kvar 4♠ 4♣".
//
// Metoden: simulering med den EGNA regelboken som filter.
//   0. Kandidaterna = bara bud systemet tillåter med handen (systemKandidater).
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
import { auctionComplete, decideCall, decideCallTraced } from './auction-live'
import { legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import { nsScore } from './matchpoints'
import { meaningOf } from './auction-meaning'
import { side, type Strain } from './play'
import type { DDSolver } from './revisor'

export interface ResonemangOpts {
  /** Dubbeldummy för en (slumpad) giv — anropas en gång per behållen hand. */
  oracle: (deal: Deal) => DDSolver
  budgetMs?: number
  minHands?: number
  maxHands?: number
  /** Högsta antal slumpdragningar innan vi ger upp (för långa auktioner). */
  maxDraws?: number
  /** Ingen tidsgräns: bara händer/dragningar räknas (deterministiskt — tävlingen). */
  utanTid?: boolean
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
const LEK: Card[] = (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).flatMap((suit) =>
  (['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as Card['rank'][]).map((rank) => ({ suit, rank })),
)

/** Slumpa de 39 okända korten över de tre andra stolarna. Utgår från LEKEN minus
 *  min hand i fast ordning — aldrig från de verkliga dolda händerna — så att
 *  slumpen (och därmed beslutet) bara beror på egen hand + auktionen (2026-09-24). */
function slumpaGiv(deal: Deal, me: Seat, rand: () => number): Deal {
  const others = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => s !== me)
  const mina = new Set(deal.hands[me].map((c) => `${c.suit}${c.rank}`))
  const cards: Card[] = LEK.filter((c) => !mina.has(`${c.suit}${c.rank}`))
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

/** Konventionella bud är tabellens sak — lagret rör dem aldrig (hade handen passat
 *  konventionen hade tabellen redan bjudit den). Läses ur betydelselagret. */
// Felrapport #83: även DONT/Stayman/överföringar/reläer — ett 2♥ över deras 1NT är
// hjärter+spader, ingen "naturlig sexkortsfärg". Regelnamn OCH text prövas.
const KONVENTION = /michaels|ovanlig|cue|dont|stayman|transfer|överföring|relä|puppet|konstlat|konstgjor/i

/**
 * Tänkbara bud som SYSTEMET tillåter med handen (ägarbeslut 2026-09-23, "2/1-systemet
 * är nyckeln"): pass · X (upplysning bara med högst 2 kort i deras färger) · XX med 10+ hp · naturligt färgbud med 5+ kort i
 * den längsta färgen (lång färg först) eller en höjning av partnerns färg med 3+ ·
 * billigaste sang med jämn hand och håll i deras färger (eller höjning av partnerns sang) — och aldrig ett bud som betydelselagret läser som konventionellt.
 */
export function systemKandidater(hand: Hand, history: ResolvedCall[], me: Seat): Bid[] {
  const legal = legalCalls(history, me)
  const len = lengths(hand)
  const out = new Set<Bid>(['P' as Bid])
  if (legal.includes('XX' as Bid) && hcp(hand) >= 10) out.add('XX' as Bid)
  const farger = (vem: (c: ResolvedCall) => boolean) =>
    new Set(history.filter(vem).map((c) => parseContractBid(c.bid)?.strain).filter((s): s is string => !!s && s !== 'NT'))
  const partnerSuits = farger((c) => c.seat === PARTNER[me])
  const theirSuits = farger((c) => side(c.seat) !== side(me))
  const mySuits = farger((c) => c.seat === me)
  const betydelse = (b: Bid) => meaningOf([...history, { seat: me, bid: b } as ResolvedCall], history.length)
  const konventionell = (b: Bid) => {
    const m = betydelse(b)
    return KONVENTION.test(`${m.rule ?? ''} ${m.text}`)
  }
  // Upplysningsdubbling: högst 2 kort i varje färg de bjudit (ägarbeslut 2026-09-24 —
  // med längd i deras färg och en egen färg bjuder man färgen, "dubbel finns inte").
  if (legal.includes('X' as Bid)) {
    const m = betydelse('X' as Bid)
    const upplysning = /upplysning|takeout/i.test(`${m.rule ?? ''} ${m.text}`)
    if ((!upplysning || SUITS.every((s) => !theirSuits.has(letterOfSuit(s)) || len[s] <= 2)) && !konventionell('X' as Bid)) out.add('X' as Bid)
  }
  // Lång färg först: jämför med de färger jag ännu inte bjudit och som inte är deras.
  const langst = Math.max(0, ...SUITS.filter((s) => !theirSuits.has(letterOfSuit(s)) && !mySuits.has(letterOfSuit(s))).map((s) => len[s]))
  const cheapest = (strain: string): Bid | null => legal.find((b) => parseContractBid(b)?.strain === strain) ?? null
  for (const s of SUITS) {
    const L = letterOfSuit(s)
    const b = cheapest(L)
    if (!b || parseContractBid(b)!.level > 5) continue
    const hojning = partnerSuits.has(L) && len[s] >= 3
    const egen = len[s] >= 5 && !theirSuits.has(L) && (mySuits.has(L) || len[s] >= langst)
    if ((hojning || egen) && !konventionell(b)) out.add(b)
  }
  const nt = cheapest('NT')
  // Naturlig sang: jämn hand med håll i varje färg de bjudit — utom när jag höjer
  // partnerns sang (då har partnern redan visat sanghanden).
  const partnerSang = history.some((c) => c.seat === PARTNER[me] && parseContractBid(c.bid)?.strain === 'NT')
  const sangHand = partnerSang || (isBalanced(hand) && SUITS.every((s) => !theirSuits.has(letterOfSuit(s)) || hasStopper(hand, s)))
  if (nt && parseContractBid(nt)!.level <= 3 && sangHand && !konventionell(nt)) out.add(nt)
  return [...out]
}

const RANG: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 }

/**
 * Försvarsstick i `jag` som håller mot spelföraren + träkarlen i `strain` (ägarens
 * princip 2026-09-23: värdera handen mot budgivningen — AK i en färg de är korta i
 * dubblar man inte med). Sidofärg: toppsekvensen från esset, men i färgkontrakt bara
 * så många ronder som BÅDA har kort (annars trumfas det). Trumf: ett kort räknas när
 * deras högre trumf inte är fler än mina lägre (Qxx mot AK = 1).
 */
export function sakraStick(jag: Hand, spelforare: Hand, trakarl: Hand, strain: Strain): number {
  let n = 0
  for (const s of SUITS) {
    const mina = jag.filter((c) => c.suit === s).map((c) => RANG[c.rank]).sort((a, b) => b - a)
    const sf = spelforare.filter((c) => c.suit === s)
    const tr = trakarl.filter((c) => c.suit === s)
    if (s === strain) {
      const deras = [...sf, ...tr].map((c) => RANG[c.rank])
      for (const v of mina) if (deras.filter((x) => x > v).length <= mina.filter((x) => x < v).length) n++
    } else {
      const ronder = strain === 'NT' ? 13 : Math.min(sf.length, tr.length)
      for (let i = 0; i < mina.length && mina[i] === 14 - i && i < ronder; i++) n++
    }
  }
  return n
}

/** Deras kontrakt på utgångsnivå eller högre (3NT · 4♥/4♠ · 5♣/5♦). */
function arUtgang(k: { strain: Strain; level: number }): boolean {
  return k.strain === 'NT' ? k.level >= 3 : k.strain === 'hearts' || k.strain === 'spades' ? k.level >= 4 : k.level >= 5
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
  const buds = systemKandidater(hand, history, me)
  // Systemet tillåter inget annat än pass → inget att simulera (sparar betänketid).
  if (buds.length === 1) {
    return {
      val: 'P' as Bid, kandidater: [], hander: 0, dragningar: 0, ms: performance.now() - t0, stoppadeTidigt: true,
      partner: { langd: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 }, hpMin: 0, hpMax: 0, hpSnitt: 0 },
      forklaring: 'Inget bud som systemet tillåter med handen → pass.',
    }
  }
  // s/s2 = budets poäng; d/d2 = skillnaden mot pass på samma hand (parad jämförelse).
  const sum = new Map<Bid, { n: number; s: number; s2: number; d: number; d2: number }>(
    buds.map((b) => [b, { n: 0, s: 0, s2: 0, d: 0, d2: 0 }]),
  )
  const plen: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 }
  let php = 0, phpMin = 40, phpMax = 0
  let hander = 0, dragningar = 0, stoppadeTidigt = false
  // Dubbling av deras utgång = straffbud: X får bara väljas om mina + partnerns säkra
  // försvarsstick (räknade på händer som stämmer med budgivningen) räcker till bet.
  const kontrakt = contractFromCalls(history)
  const straffX = buds.includes('X' as Bid) && !!kontrakt && side(kontrakt.declarer) !== side(me) && arUtgang(kontrakt)
  const behov = kontrakt ? 8 - kontrakt.level : 0
  let stickSum = 0
  const stickSnitt = () => (hander ? stickSum / hander : 0)
  const tillatna = (k: Kandidat[]) => (straffX && stickSnitt() < behov ? k.filter((c) => c.bud !== 'X') : k)

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

  while (hander < maxH && dragningar < maxDraws && (opts.utanTid || performance.now() - t0 < budget)) {
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
    if (straffX) {
      const sf = d.hands[kontrakt!.declarer], tr = d.hands[PARTNER[kontrakt!.declarer]]
      stickSum += sakraStick(hand, sf, tr, kontrakt!.strain) + sakraStick(ph, sf, tr, kontrakt!.strain)
    }
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
      if (diff > 2 * se && valjMotPass(tillatna(k)).val === k[0].bud) { stoppadeTidigt = true; break }
    }
  }

  const k = stat().sort((a, b) => b.snitt - a.snitt)
  const { val, spärrad } = hander > 0 ? valjMotPass(tillatna(k)) : { val: 'P' as Bid, spärrad: undefined }
  const partner = {
    langd: Object.fromEntries(SUITS.map((s) => [s, hander ? plen[s] / hander : 0])) as Record<Suit, number>,
    hpMin: hander ? phpMin : 0, hpMax: hander ? phpMax : 0, hpSnitt: hander ? php / hander : 0,
  }
  const form = SUITS.map((s) => `${SWE_SYM[letterOfSuit(s)]}${partner.langd[s].toFixed(1)}`).join(' ')
  const alt = k.slice(0, 3).map((c) => `${prettyBid(c.bud)} ${c.snitt >= 0 ? '+' : ''}${c.snitt.toFixed(0)}`).join(' · ')
  const forklaring = hander
    ? `Av ${hander} händer som stämmer med budgivningen ser partnern ut att ha ${form} och ${partner.hpMin}–${partner.hpMax} hp (snitt ${partner.hpSnitt.toFixed(0)}). Bästa bud i snitt: ${alt}.` +
      (straffX && stickSnitt() < behov
        ? ` X stryks: i snitt ${stickSnitt().toFixed(1)} säkra försvarsstick, det krävs ${behov} för bet.`
        : '') +
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
/**
 * Lagrets standard (2026-09-24): ETT bestämt antal händer i stället för sekunder,
 * så att samma läge ger samma bud på telefonen, på servern och i nattgranskningen
 * — tävlingen kan då validera en tänkande bot. Tidigt stopp räknas på händer.
 */
export const RESONEMANG_STANDARD = { minHands: 12, maxHands: 24, maxDraws: 30_000 } as const

/** Slumpfröet ur det boten VET: egen hand, stol, giv, zon och auktionen. */
export function resonemangFro(deal: Deal, history: ResolvedCall[], seat: Seat): number {
  const hand = [...deal.hands[seat]].map((c) => `${c.suit[0]}${c.rank}`).sort().join('')
  let h = 2166136261
  for (const ch of `${hand}|${seat}|${deal.dealer}|${deal.vulnerability}|${history.map((c) => c.bid).join(',')}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Ska boten tänka här? Tabellen saknar regel (pass utan regel) och läget är värt det. */
export function borTanka(deal: Deal, history: ResolvedCall[], seat: Seat): boolean {
  return decideCallTraced(deal, history, seat).källa === 'pass (ingen regel)' && vardAttTanka(deal, history, seat)
}

/**
 * Bottens bud i ett läge: tabellen — eller, där boten tänker och ett orakel finns,
 * resonemangslagret. EN funktion för klientens worker-väg, datorspelarnas nattspel,
 * förhandsgranskningen och nattgranskningen, så alla får samma bud.
 */
export function botBud(deal: Deal, history: ResolvedCall[], seat: Seat, oracle?: (d: Deal) => DDSolver): ResolvedCall {
  if (oracle && borTanka(deal, history, seat)) {
    const r = resoneraBot(deal, history, seat, oracle)
    return { seat, bid: r.val, rule: 'resonemang', explanation: r.forklaring } as ResolvedCall
  }
  return decideCall(deal, history, seat)
}

/** Bottens tänkande i standardläget — samma svar överallt för samma läge. */
export function resoneraBot(deal: Deal, history: ResolvedCall[], seat: Seat, oracle: (d: Deal) => DDSolver): Resonemang {
  return resonera(deal, history, seat, { oracle, ...RESONEMANG_STANDARD, utanTid: true, seed: resonemangFro(deal, history, seat) })
}
