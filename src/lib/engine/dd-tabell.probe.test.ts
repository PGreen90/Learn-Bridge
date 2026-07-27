// TILLFÄLLIGT VERKTYG (etapp 6 hål 1): skriv ut hela DD-tabellen för givna frön,
// så facit-testets målkontrakt kan väljas på riktiga DD-stick. Miljöstyrt som
// övriga probar — körs ALDRIG i npm test.
//   $env:DDTAB='20260884,20261005'; npx vitest run src/lib/engine/dd-tabell.probe.test.ts
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dealFromSeed } from './revisor'
import { computeOracle, getDds } from './revisor-dds'
import type { Strain } from './play'

const SEEDS = (process.env.DDTAB ?? '').split(',').filter(Boolean).map(Number)
const STRAINS: Strain[] = ['clubs', 'diamonds', 'hearts', 'spades', 'NT']

it.skipIf(SEEDS.length === 0)('dd-tabell', async () => {
  const dds = await getDds()
  const rader: string[] = []
  for (const seed of SEEDS) {
    const deal = dealFromSeed(seed)
    const oracle = computeOracle(dds, deal)
    rader.push(`\n=== frö ${seed} · giv ${deal.dealer} · zon ${deal.vulnerability} ===`)
    rader.push(`par (NS): ${oracle.parNS} · ${oracle.parContracts.join(' | ')}`)
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      const row = STRAINS.map((st) => `${st === 'NT' ? 'NT' : st[0].toUpperCase()}:${oracle.solve(seat, st)}`).join(' ')
      rader.push(`  ${seat}  ${row}`)
    }
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/dd-tabell.txt', rader.join('\n'), 'utf8')
})
