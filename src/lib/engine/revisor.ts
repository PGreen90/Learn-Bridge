// Systemrevisorn (etapp 2 i "budgivningen mot perfekt", docs/systemrevisorn.md):
// mäter objektivt hur nära perfekt budmotorn är. Slumpar givar, låter motorn
// bjuda ALLA fyra händerna (inkl. konkurrensen), DD-löser resultatet och jämför
// slutkontraktets poäng mot facit (riktig par-poäng) → missprocent +
// topplista över misstyper. Ren logik utan I/O; själva körningen bor i
// revisor.probe.test.ts (miljövariabel-gated, får INTE in i deploygrinden).
//
// DD-facit kommer från ett injicerat ORAKEL (i skarp drift bridge-dds via
// revisor-dds.ts — Bo Haglunds riktiga lösare i WASM; i enhetstest en fejkad
// tabell). Referensen är riktig PAR-poäng (DealerPar: perfekt budgivning av
// alla fyra, inkl. offringar och dubblingar); kategoriseringen använder
// dessutom sidornas bästa GÖRBARA odubblade kontrakt ur DD-tabellen.
// Kom ihåg: DD ser alla kort — enskilda givar kan ljuga (tunna kontrakt "går"
// på DD). Läs MÖNSTER (kategoriernas storlek), inte enstaka exempel.

import type { Deal, Seat } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { dealRandom } from './deal'
import { auctionComplete, decideCall } from './auction-live'
import { contractFromCalls } from './auction-contract'
import { duplicateScore, sideVulnerable } from './scoring'
import { side, type Contract, type Strain } from './play'
import { formatHand } from '../felrapport'

const STRAINS: Strain[] = ['clubs', 'diamonds', 'hearts', 'spades', 'NT']
const SIDE_SEATS: Record<'NS' | 'EW', [Seat, Seat]> = { NS: ['N', 'S'], EW: ['E', 'W'] }

// ---- Reproducerbar slump ---------------------------------------------------

/** Mulberry32 — liten deterministisk RNG så varje giv kan återskapas ur sitt frö. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Given för ett frö — samma frö ger alltid exakt samma giv (repro av en miss). */
export function dealFromSeed(seed: number): Deal {
  return dealRandom(mulberry32(seed))
}

// ---- Motorns egen auktion (alla fyra sätena är bottar) ---------------------

/**
 * Låter motorn bjuda hela given själv: `decideCall` för varje säte i tur och
 * ordning tills auktionen är utpassad. Returnerar `null` om auktionen aldrig
 * tar slut (skyddsgräns — ett motorfel värt att räkna separat).
 */
export function botAuction(deal: Deal, maxCalls = 60): ResolvedCall[] | null {
  const history: ResolvedCall[] = []
  while (!auctionComplete(history)) {
    if (history.length >= maxCalls) return null
    history.push(decideCall(deal, history, seatAt(deal.dealer, history.length)))
  }
  return history
}

// ---- DD-oraklet -------------------------------------------------------------

/** DD-stick för (spelförare, strain). `null` = kunde inte lösas (given skippas). */
export type DDSolver = (declarer: Seat, strain: Strain) => number | null

// ---- Optimum: bästa görbara kontrakt per sida ------------------------------

export interface BestContract {
  contract: Contract
  tricks: number
  /** Poängen sedd från den egna sidan (alltid ≥ 0 — kontraktet går hem). */
  score: number
}

/**
 * Sidans bästa görbara odubblade kontrakt: för varje strain DD-sticken med den
 * bästa av sidans två spelförare; går ≥ 7 stick bjuds kontraktet på exakt den
 * nivån (maximerar bonusen — aldrig sämre än att stanna lägre). Högst poäng
 * vinner. Returnerar `null` när sidan inte kan ta hem något kontrakt alls, och
 * kastar aldrig — olösbara givar rapporteras som `undefined` (hoppas över).
 */
export function bestSideContract(
  deal: Deal,
  solve: DDSolver,
  sideName: 'NS' | 'EW',
): BestContract | null | undefined {
  const seats = SIDE_SEATS[sideName]
  const vulnerable = sideVulnerable(seats[0], deal.vulnerability)
  let best: BestContract | null = null
  for (const strain of STRAINS) {
    const tricksA = solve(seats[0], strain)
    const tricksB = solve(seats[1], strain)
    if (tricksA === null || tricksB === null) return undefined // olösbar → skippa given
    const declarer = tricksA >= tricksB ? seats[0] : seats[1]
    const tricks = Math.max(tricksA, tricksB)
    if (tricks < 7) continue
    const contract: Contract = { declarer, strain, level: tricks - 6 }
    const score = duplicateScore(contract, tricks, vulnerable)
    if (!best || score > best.score) best = { contract, tricks, score }
  }
  return best
}

// ---- Kategorisering av missen ----------------------------------------------

export type MissCategory =
  | 'ratt' // poängtapp 0 — rätt kontrakt (eller likvärdigt)
  | 'utpassad' // alla passade fast en sida hade ett görbart kontrakt
  | 'missad-utgang'
  | 'missad-lillslam'
  | 'missad-storslam'
  | 'for-hogt' // ägarsidan gick bet i rätt strain (för högt bjudet)
  | 'fel-farg-bet' // ägarsidan gick bet i en strain där facit fanns i en annan
  | 'fel-strain' // ägarsidan spelade hem, men poäng låg kvar (fel färg/nivå)
  | 'sald-giv' // motståndarsidan köpte kontraktet och spelade hem det
  | 'billig-offring' // motståndarsidan gick bet men för billigt (straffen otillräcklig)
  | 'battre-an-facit' // ägarsidan fick MER än par → motsatta sidan överbjöd/dubblade fel (dyr offring, X på hemgång)

export const CATEGORY_LABEL: Record<MissCategory, string> = {
  ratt: 'Rätt kontrakt (0 poängtapp)',
  utpassad: 'Utpassad giv (görbart kontrakt fanns)',
  'missad-utgang': 'Missad utgång',
  'missad-lillslam': 'Missad lillslam',
  'missad-storslam': 'Missad storslam',
  'for-hogt': 'För högt (bet i rätt strain)',
  'fel-farg-bet': 'Fel färg (bet, facit i annan strain)',
  'fel-strain': 'Fel strain/nivå (hemspelat men poäng kvar)',
  'sald-giv': 'Såld giv (motståndarna spelade hem)',
  'billig-offring': 'Otillräcklig straff (de gick bet för billigt)',
  'battre-an-facit': 'Över par — motsatta sidan överbjöd/dubblade fel (dyr offring m.m.)',
}

/** Räknas kontraktet som utgång (odubblade trickpoäng ≥ 100)? */
function isGame(contract: Contract): boolean {
  const perTrick = contract.strain === 'clubs' || contract.strain === 'diamonds' ? 20 : 30
  const ntExtra = contract.strain === 'NT' ? 10 : 0
  return contract.level * perTrick + ntExtra >= 100
}

export interface DealVerdict {
  seed: number
  category: MissCategory
  /** Poängtappet mot facit (0 = perfekt). */
  loss: number
  /** Uppnådd poäng, sedd från N/S (negativ när Ö/V fick poängen). */
  achievedNS: number
  /** Facit-referensen sedd från N/S: riktig par-poäng när oraklet ger en,
   *  annars förenklat optimum (bästa görbara odubblade kontrakt). */
  optimumNS: number
  /** Sidan som "ägde" given (högst görbart optimum), null om ingen gör något. */
  ownerSide: 'NS' | 'EW' | null
  ownerBest: BestContract | null
  contract: Contract | null
  /** DD-stick i det nådda kontraktet (null när utpassat). */
  tricks: number | null
  auction: string[]
}

/**
 * Domen över EN giv: jämför motorns slutkontrakt mot facit och sätt kategori.
 * Ren funktion — DD:n kommer in via `solve` (fejkas i test). `parNS` är den
 * riktiga par-poängen från oraklet (NS-orienterad); saknas den används det
 * förenklade optimumet. Returnerar `undefined` när given inte gick att lösa.
 */
export function judgeDeal(
  deal: Deal,
  history: ResolvedCall[],
  solve: DDSolver,
  seed: number,
  parNS?: number,
): DealVerdict | undefined {
  const bestNS = bestSideContract(deal, solve, 'NS')
  const bestEW = bestSideContract(deal, solve, 'EW')
  if (bestNS === undefined || bestEW === undefined) return undefined

  const nsScore = bestNS?.score ?? -1
  const ewScore = bestEW?.score ?? -1
  const ownerSide: 'NS' | 'EW' | null =
    !bestNS && !bestEW ? null : nsScore >= ewScore ? 'NS' : 'EW'
  const ownerBest = ownerSide === 'NS' ? bestNS : ownerSide === 'EW' ? bestEW : null
  const simpleOptimumNS = ownerSide === 'NS' ? nsScore : ownerSide === 'EW' ? -ewScore : 0
  const optimumNS = parNS ?? simpleOptimumNS

  const contract = contractFromCalls(history)
  let achievedNS = 0
  let tricks: number | null = null
  if (contract) {
    tricks = solve(contract.declarer, contract.strain)
    if (tricks === null) return undefined
    const vulnerable = sideVulnerable(contract.declarer, deal.vulnerability)
    const s = duplicateScore(contract, tricks, vulnerable)
    achievedNS = side(contract.declarer) === 'NS' ? s : -s
  }

  const loss = Math.abs(optimumNS - achievedNS)
  const verdict: DealVerdict = {
    seed,
    category: 'ratt',
    loss,
    achievedNS,
    optimumNS,
    ownerSide,
    ownerBest: ownerBest ?? null,
    contract,
    tricks,
    auction: history.map((c) => c.bid),
  }
  if (loss === 0) return verdict

  if (!contract || !ownerBest || !ownerSide) {
    verdict.category = 'utpassad'
    return verdict
  }

  const declSide = side(contract.declarer)
  const needed = contract.level + 6
  const achievedOwner = ownerSide === 'NS' ? achievedNS : -achievedNS
  const optimumOwner = ownerSide === 'NS' ? optimumNS : -optimumNS

  if (achievedOwner > optimumOwner) {
    verdict.category = 'battre-an-facit'
  } else if (declSide !== ownerSide) {
    verdict.category = tricks! >= needed ? 'sald-giv' : 'billig-offring'
  } else if (tricks! < needed) {
    verdict.category = contract.strain === ownerBest.contract.strain ? 'for-hogt' : 'fel-farg-bet'
  } else if (ownerBest.contract.level === 7 && contract.level < 7) {
    verdict.category = 'missad-storslam'
  } else if (ownerBest.contract.level === 6 && contract.level < 6) {
    verdict.category = 'missad-lillslam'
  } else if (isGame(ownerBest.contract) && !isGame(contract)) {
    verdict.category = 'missad-utgang'
  } else {
    verdict.category = 'fel-strain'
  }
  return verdict
}

// ---- Hela mätningen ---------------------------------------------------------

export interface RevisorExample {
  seed: number
  board: number
  dealer: Seat
  vulnerability: Deal['vulnerability']
  hands: Record<Seat, string>
  auction: string[]
  contract: string
  tricks: number | null
  optimum: string
  loss: number
}

export interface CategoryStat {
  category: MissCategory
  count: number
  totalLoss: number
  examples: RevisorExample[]
}

export interface RevisorReport {
  /** Antal begärda givar. */
  total: number
  /** Antal faktiskt bedömda (total − skippade). */
  judged: number
  /** Givar oraklet inte kunde lösa (med bridge-dds i praktiken 0). */
  skippedSolver: number
  skippedAuction: number
  /** Andel bedömda givar med poängtapp 0. */
  rightShare: number
  avgLoss: number
  categories: CategoryStat[]
  baseSeed: number
  elapsedMs: number
}

function contractText(contract: Contract | null): string {
  if (!contract) return 'utpassad'
  const letter: Record<Strain, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S', NT: 'NT' }
  return `${contract.level}${letter[contract.strain]}${contract.doubled ?? ''} av ${contract.declarer}`
}

function toExample(deal: Deal, v: DealVerdict): RevisorExample {
  return {
    seed: v.seed,
    board: deal.board,
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    hands: {
      N: formatHand(deal.hands.N),
      E: formatHand(deal.hands.E),
      S: formatHand(deal.hands.S),
      W: formatHand(deal.hands.W),
    },
    auction: v.auction,
    contract: contractText(v.contract),
    tricks: v.tricks,
    optimum: v.ownerBest
      ? `facit N/S ${v.optimumNS} · bästa görbara ${contractText(v.ownerBest.contract)} (${v.ownerSide} ${v.ownerBest.score})`
      : `facit N/S ${v.optimumNS} · inget görbart kontrakt`,
    loss: v.loss,
  }
}

/** DD-facit för EN giv: lösare + ev. riktig par-poäng (NS-orienterad). */
export interface RevisorOracle {
  solve: DDSolver
  parNS?: number
}

export interface RevisorOptions {
  deals: number
  baseSeed: number
  /** Oraklet per giv — i skarp drift `computeOracle` (bridge-dds, revisor-dds.ts). */
  oracle: (deal: Deal) => RevisorOracle
  /** Max sparade exempelgivar per kategori i rapporten. */
  examplesPerCategory?: number
  onProgress?: (done: number, total: number) => void
}

/** Kör hela mätningen: `deals` givar med frön baseSeed, baseSeed+1, … */
export function runRevisor(opts: RevisorOptions): RevisorReport {
  const { deals, baseSeed, oracle, examplesPerCategory = 5, onProgress } = opts
  const start = Date.now()
  const stats = new Map<MissCategory, CategoryStat>()
  let judged = 0
  let skippedSolver = 0
  let skippedAuction = 0
  let right = 0
  let totalLoss = 0

  for (let i = 0; i < deals; i++) {
    const seed = baseSeed + i
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    if (!history) {
      skippedAuction++
      onProgress?.(i + 1, deals)
      continue
    }
    const { solve, parNS } = oracle(deal)
    const verdict = judgeDeal(deal, history, solve, seed, parNS)
    if (!verdict) {
      skippedSolver++
      onProgress?.(i + 1, deals)
      continue
    }
    judged++
    totalLoss += verdict.loss
    if (verdict.loss === 0) right++
    else {
      const stat = stats.get(verdict.category) ?? { category: verdict.category, count: 0, totalLoss: 0, examples: [] }
      stat.count++
      stat.totalLoss += verdict.loss
      if (stat.examples.length < examplesPerCategory) stat.examples.push(toExample(deal, verdict))
      stats.set(verdict.category, stat)
    }
    onProgress?.(i + 1, deals)
  }

  return {
    total: deals,
    judged,
    skippedSolver,
    skippedAuction,
    rightShare: judged > 0 ? right / judged : 0,
    avgLoss: judged > 0 ? totalLoss / judged : 0,
    categories: [...stats.values()].sort((a, b) => b.totalLoss - a.totalLoss),
    baseSeed,
    elapsedMs: Date.now() - start,
  }
}

/** Läsbar konsolrapport (missprocent + topplista) av en färdig mätning. */
export function formatRevisorReport(r: RevisorReport): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`
  const lines: string[] = []
  lines.push('=== SYSTEMREVISORN ===')
  lines.push(
    `Givar: ${r.total} (bedömda ${r.judged}, olösbara ${r.skippedSolver}, auktionsfel ${r.skippedAuction})`,
  )
  lines.push(`Frö: ${r.baseSeed}..${r.baseSeed + r.total - 1} · ${(r.elapsedMs / 1000).toFixed(0)} s`)
  lines.push(`Rätt kontrakt (poängtapp 0): ${pct(r.rightShare)}`)
  lines.push(`Genomsnittligt poängtapp: ${r.avgLoss.toFixed(0)} poäng/giv`)
  lines.push('')
  lines.push('Topplista (mest tappade poäng först):')
  for (const c of r.categories) {
    lines.push(
      `  ${CATEGORY_LABEL[c.category]}: ${c.count} givar, ${c.totalLoss} poäng totalt (snitt ${(c.totalLoss / c.count).toFixed(0)})`,
    )
  }
  return lines.join('\n')
}
