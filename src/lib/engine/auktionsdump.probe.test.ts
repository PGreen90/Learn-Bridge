// AUKTIONSDUMP (tillfälligt mönsterjaktsverktyg) — skriver ut hela auktionen med
// REGELNAMN + förklaring, så att man ser VARFÖR motorn bjöd som den gjorde.
//
// Enskilda frön:
//   $env:DUMP='20261658,20261274'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
// Hela en kategori ur senaste mätningen (revisor-output/latest.json):
//   $env:DUMP_CAT='billig-offring'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
// Utdata: revisor-output/auktionsdump.txt (+ .json när DUMP_CAT används).
import { it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dealFromSeed, botAuction } from './revisor'
import { formatHand } from '../felrapport'

const CAT = process.env.DUMP_CAT
const SEEDS = CAT
  ? (JSON.parse(readFileSync('revisor-output/latest.json', 'utf8')) as {
      categories: { category: string; examples: { seed: number }[] }[]
    }).categories.find((c) => c.category === CAT)!.examples.map((e) => e.seed)
  : (process.env.DUMP ?? '').split(',').filter(Boolean).map(Number)

it.skipIf(SEEDS.length === 0)('auktionsdump', () => {
  const rader: string[] = []
  const json: unknown[] = []
  for (const seed of SEEDS) {
    const deal = dealFromSeed(seed)
    const history = botAuction(deal) ?? []
    const calls = history.map((call) => {
      const c = call as { seat: string; bid: string; rule?: string; explanation?: string }
      return { seat: c.seat, bid: c.bid, rule: c.rule ?? null, explanation: c.explanation ?? null }
    })
    rader.push(`\n=== frö ${seed} · giv ${deal.dealer} · zon ${deal.vulnerability} ===`)
    for (const s of ['N', 'E', 'S', 'W'] as const) rader.push(`  ${s}: ${formatHand(deal.hands[s])}`)
    for (const c of calls) rader.push(`  ${c.seat} ${c.bid.padEnd(4)} [${c.rule ?? '—'}] ${c.explanation ?? ''}`)
    json.push({
      seed,
      dealer: deal.dealer,
      vulnerability: deal.vulnerability,
      hands: Object.fromEntries((['N', 'E', 'S', 'W'] as const).map((s) => [s, formatHand(deal.hands[s])])),
      calls,
    })
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/auktionsdump.txt', rader.join('\n'), 'utf8')
  if (CAT) writeFileSync('revisor-output/auktionsdump.json', JSON.stringify(json, null, 2), 'utf8')
})
