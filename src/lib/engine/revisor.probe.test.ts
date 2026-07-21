// SYSTEMREVISORNS MÄTKÖRNING (docs/systemrevisorn.md) — körs ALDRIG i vanliga
// `npm test`/deploygrinden (skipIf), bara på uttrycklig begäran:
//
//   PowerShell:  $env:REVISOR='1'; npx vitest run src/lib/engine/revisor.probe.test.ts
//   Bash:        REVISOR=1 npx vitest run src/lib/engine/revisor.probe.test.ts
//
// Valfria rattar (miljövariabler):
//   REVISOR_DEALS     antal givar (standard 1000)
//   REVISOR_SEED      basfrö (standard 20260721 — behåll för jämförbara mätningar!)
//   REVISOR_EXAMPLES  max sparade exempelgivar per kategori (standard 8;
//                     sätt högt, t.ex. 500, för mönsterjakt i en misstyp)
//
// DD-facit: bridge-dds (Bo Haglunds lösare i WASM, via revisor-dds.ts) — hela
// 20-tabellen + riktig par-poäng per giv på tiotals millisekunder.
//
// Utdata: rapport i konsolen + JSON med exempelgivar i revisor-output/
// (gitignorad). Ett exempels `seed` + `dealFromSeed(seed)` återskapar given
// exakt → en miss kan bli ett facit-test på minuter.

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatRevisorReport, runRevisor } from './revisor'
import { computeOracle, getDds } from './revisor-dds'

const DEALS = Number(process.env.REVISOR_DEALS ?? 1000)
const SEED = Number(process.env.REVISOR_SEED ?? 20260721)
const EXAMPLES = Number(process.env.REVISOR_EXAMPLES ?? 8)

it.skipIf(!process.env.REVISOR)(
  `systemrevisorn: ${DEALS} givar, frö ${SEED}`,
  { timeout: 0 }, // mätningen får ta den tid den tar
  async () => {
    const dds = await getDds()
    const report = runRevisor({
      deals: DEALS,
      baseSeed: SEED,
      oracle: (deal) => computeOracle(dds, deal),
      examplesPerCategory: EXAMPLES,
      onProgress: (done, total) => {
        if (done % 100 === 0 || done === total) console.log(`  ...${done}/${total} givar`)
      },
    })

    console.log('\n' + formatRevisorReport(report) + '\n')

    const dir = join(process.cwd(), 'revisor-output')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const file = join(dir, `revisor-${stamp}.json`)
    writeFileSync(file, JSON.stringify(report, null, 2), 'utf8')
    writeFileSync(join(dir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8')
    console.log(`Full rapport med exempelgivar: ${file}`)
  },
)
