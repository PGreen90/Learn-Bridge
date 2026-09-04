// AUKTIONSDUMP — skriver ut hela auktionen med REGELNAMN + KÄLLA + förklaring,
// så att man ser VARFÖR motorn bjöd som den gjorde och VAR i motorn beslutet
// togs (manus / detektor:<id> / …, se `decideCallTraced` i auction-live.ts).
//
// Tre lägen (miljövariabler, PowerShell-form):
//
//   Enskilda frön (läsbar text + JSON):
//     $env:DUMP='20261658,20261274'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
//   Hela en kategori ur senaste revisormätningen (revisor-output/latest.json):
//     $env:DUMP_CAT='billig-offring'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
//   Intervall (motorbytets auktionsdiff, docs/motorbyte-plan.md §3 — bara JSON):
//     $env:DUMP_RANGE='20270001-20273000'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
//
// Utdata: revisor-output/auktionsdump.txt (DUMP/DUMP_CAT), JSON till
// revisor-output/auktionsdump.json — eller den fil $env:DUMP_OUT pekar på, så
// att en baslinje kan sparas undan: $env:DUMP_OUT='revisor-output/auktionsdump-baslinje.json'.
// Intervall-läget skriver dessutom revisor-output/auktionsdump-frekvens.txt:
// hur ofta varje källa och regel avgjorde ett bud (familjeordningen i etapp 4).
//
// Jämför två JSON-filer: node scripts/auktionsdiff.mjs <före.json> <efter.json>
import { it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Deal } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { auctionComplete, decideCallTraced } from './auction-live'
import { dealFromSeed } from './revisor'
import { formatHand } from '../felrapport'

const CAT = process.env.DUMP_CAT
const RANGE = process.env.DUMP_RANGE
const OUT = process.env.DUMP_OUT ?? 'revisor-output/auktionsdump.json'

function seedsFromRange(range: string): number[] {
  const m = /^(\d+)-(\d+)$/.exec(range.trim())
  if (!m) throw new Error(`DUMP_RANGE ska vara 'från-till', t.ex. 20270001-20273000 (fick '${range}')`)
  const [from, to] = [Number(m[1]), Number(m[2])]
  if (to < from) throw new Error(`DUMP_RANGE: till (${to}) är mindre än från (${from})`)
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

const SEEDS = RANGE
  ? seedsFromRange(RANGE)
  : CAT
    ? (JSON.parse(readFileSync('revisor-output/latest.json', 'utf8')) as {
        categories: { category: string; examples: { seed: number }[] }[]
      }).categories.find((c) => c.category === CAT)!.examples.map((e) => e.seed)
    : (process.env.DUMP ?? '').split(',').filter(Boolean).map(Number)

/** Ett bud i dumpen: vad, enligt vilken regel, från vilken källa i motorn. */
interface DumpCall {
  seat: string
  bid: string
  rule: string | null
  källa: string
  explanation: string | null
}

/** En giv i dumpen. `calls === null` = auktionen tog aldrig slut (motorfel). */
interface DumpDeal {
  seed: number
  dealer: string
  vulnerability: string
  hands: Record<string, string>
  calls: DumpCall[] | null
}

/** Som `botAuction` i revisor.ts, men med källan per bud. */
function tracedAuction(deal: Deal, maxCalls = 60): DumpCall[] | null {
  const history: ResolvedCall[] = []
  const calls: DumpCall[] = []
  while (!auctionComplete(history)) {
    if (history.length >= maxCalls) return null
    const t = decideCallTraced(deal, history, seatAt(deal.dealer, history.length))
    history.push(t.call)
    const c = t.call as { seat: string; bid: string; rule?: string; explanation?: string }
    calls.push({ seat: c.seat, bid: c.bid, rule: c.rule ?? null, källa: t.källa, explanation: c.explanation ?? null })
  }
  return calls
}

function dumpDeal(seed: number): DumpDeal {
  const deal = dealFromSeed(seed)
  return {
    seed,
    dealer: deal.dealer,
    vulnerability: deal.vulnerability,
    hands: Object.fromEntries((['N', 'E', 'S', 'W'] as const).map((s) => [s, formatHand(deal.hands[s])])),
    calls: tracedAuction(deal),
  }
}

function textOf(d: DumpDeal): string[] {
  const rader = [`\n=== frö ${d.seed} · giv ${d.dealer} · zon ${d.vulnerability} ===`]
  for (const s of ['N', 'E', 'S', 'W']) rader.push(`  ${s}: ${d.hands[s]}`)
  if (!d.calls) rader.push('  !! auktionen tog aldrig slut')
  else for (const c of d.calls) rader.push(`  ${c.seat} ${c.bid.padEnd(4)} [${c.rule ?? '—'}] <${c.källa}> ${c.explanation ?? ''}`)
  return rader
}

/** Frekvensbilden: hur ofta varje källa/regel avgjorde ett bud (etapp 4:s ordning). */
function frekvens(deals: DumpDeal[]): string {
  const räkna = (nycklar: string[]) => {
    const m = new Map<string, number>()
    for (const k of nycklar) m.set(k, (m.get(k) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
  }
  const alla = deals.flatMap((d) => d.calls ?? [])
  const öppnade = deals.filter((d) => d.calls?.some((c) => c.bid !== 'P'))
  const störda = deals.filter((d) => {
    const sidor = new Set((d.calls ?? []).filter((c) => c.bid !== 'P').map((c) => (c.seat === 'N' || c.seat === 'S' ? 'NS' : 'EW')))
    return sidor.size === 2
  })
  const oändliga = deals.filter((d) => !d.calls)
  const rader: string[] = [
    `Auktionsdumpens frekvensbild — ${deals.length} givar (frö ${deals[0]?.seed}–${deals[deals.length - 1]?.seed})`,
    `  givar med öppning: ${öppnade.length}`,
    `  störda auktioner (båda sidor bjöd): ${störda.length}`,
    `  auktioner som aldrig tog slut: ${oändliga.length}${oändliga.length ? ' (frön ' + oändliga.map((d) => d.seed).join(', ') + ')' : ''}`,
    `  bud totalt: ${alla.length}`,
    '',
    'KÄLLA per bud (var i motorn beslutet togs):',
    ...räkna(alla.map((c) => c.källa)).map(([k, n]) => `  ${String(n).padStart(6)}  ${k}`),
    '',
    'KÄLLA per bud som INTE är pass:',
    ...räkna(alla.filter((c) => c.bid !== 'P').map((c) => c.källa)).map(([k, n]) => `  ${String(n).padStart(6)}  ${k}`),
    '',
    'REGEL per bud som inte är pass (alla källor):',
    ...räkna(alla.filter((c) => c.bid !== 'P').map((c) => c.rule ?? '—')).map(([k, n]) => `  ${String(n).padStart(6)}  ${k}`),
  ]
  return rader.join('\n')
}

it.skipIf(SEEDS.length === 0)(`auktionsdump (${SEEDS.length} frön)`, { timeout: 0 }, () => {
  const deals = SEEDS.map(dumpDeal)
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync(OUT, JSON.stringify(deals, null, 1), 'utf8')
  if (RANGE) writeFileSync('revisor-output/auktionsdump-frekvens.txt', frekvens(deals), 'utf8')
  else writeFileSync('revisor-output/auktionsdump.txt', deals.flatMap(textOf).join('\n'), 'utf8')
})
