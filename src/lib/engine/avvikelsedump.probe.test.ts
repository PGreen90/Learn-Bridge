// AVVIKELSEDUMPEN (motorbytet etapp 3, docs/motorbyte-plan.md §3): auktionerna
// där MÄNNISKAN avviker från vad motorn själv hade bjudit. Auktionsdumpen
// (auktionsdump.probe.test.ts) täcker bot-mot-bot; den här riggen låter en
// stol öppna ett godtyckligt bud och låter bottarna spela klart, så att
// diffen mellan två körningar visar hur det NYA lagret svarar när manuset
// aldrig förutsåg budet. Samma JSON-form som auktionsdumpen → samma diff-skript:
//
//   $env:AVVIK='1'; $env:AVVIK_OUT='revisor-output/avvikelsedump-baslinje.json'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
//   $env:AVVIK='1'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
//   node scripts/auktionsdiff.mjs revisor-output/avvikelsedump-baslinje.json revisor-output/avvikelsedump.json revisor-output/avvikelsediff.txt
//
//   $env:AVVIK_RANGE='20270001-20270300'   (standard)
//
// Två lägen per giv och öppningsbud: "direkt" (given öppnar) och "3:e hand"
// (given och nästa stol passar, tredje stolen öppnar → svararen är passad hand).
// Nyckeln i dumpen är "<frö>/<läge>/<öppning>".
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Deal } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { auctionComplete, decideCallTraced } from './auction-live'
import { formatHand } from '../felrapport'
import { dealFromSeed } from './revisor'

const RANGE = process.env.AVVIK_RANGE ?? '20270001-20270300'
const OUT = process.env.AVVIK_OUT ?? 'revisor-output/avvikelsedump.json'
const OPENINGS = ['1C', '1D', '1H', '1S', '1NT', '2C', '2D', '2H', '2S', '2NT', '3C', '3D', '3H', '3S', '3NT', '4H', '4S']

interface DumpCall {
  seat: string
  bid: string
  rule: string | null
  källa: string
  explanation: string | null
}

interface DumpDeal {
  seed: string
  dealer: string
  vulnerability: string
  hands: Record<string, string>
  calls: DumpCall[] | null
}

function playOut(deal: Deal, start: ResolvedCall[], maxCalls = 60): DumpCall[] | null {
  const history = [...start]
  const calls: DumpCall[] = start.map((c) => ({ seat: c.seat, bid: c.bid, rule: null, källa: 'människan', explanation: null }))
  while (!auctionComplete(history)) {
    if (history.length >= maxCalls) return null
    const t = decideCallTraced(deal, history, seatAt(deal.dealer, history.length))
    history.push(t.call)
    const c = t.call as { seat: string; bid: string; rule?: string; explanation?: string }
    calls.push({ seat: c.seat, bid: c.bid, rule: c.rule ?? null, källa: t.källa, explanation: c.explanation ?? null })
  }
  return calls
}

it.skipIf(process.env.AVVIK !== '1')('avvikelsedumpen: människan öppnar fritt, bottarna spelar klart', { timeout: 0 }, () => {
  const m = /^(\d+)-(\d+)$/.exec(RANGE)!
  const [från, till] = [Number(m[1]), Number(m[2])]
  const dump: DumpDeal[] = []
  for (let seed = från; seed <= till; seed++) {
    const deal = dealFromSeed(seed)
    const hands = Object.fromEntries((['N', 'E', 'S', 'W'] as const).map((s) => [s, formatHand(deal.hands[s])]))
    const d0 = seatAt(deal.dealer, 0)
    const d1 = seatAt(deal.dealer, 1)
    const d2 = seatAt(deal.dealer, 2)
    for (const open of OPENINGS) {
      dump.push({ seed: `${seed}/direkt/${open}`, dealer: deal.dealer, vulnerability: deal.vulnerability, hands,
        calls: playOut(deal, [{ seat: d0, bid: open }]) })
      dump.push({ seed: `${seed}/3:e hand/${open}`, dealer: deal.dealer, vulnerability: deal.vulnerability, hands,
        calls: playOut(deal, [{ seat: d0, bid: 'P' }, { seat: d1, bid: 'P' }, { seat: d2, bid: open }]) })
    }
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync(OUT, JSON.stringify(dump), 'utf8')
})
