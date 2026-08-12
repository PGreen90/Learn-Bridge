// SPELDIAGNOSENS MÄTKÖRNING — körs ALDRIG i vanliga `npm test`/deploygrinden
// (skipIf), bara på uttrycklig begäran:
//
//   PowerShell:  $env:SPELDIAG='1'; npx vitest run src/lib/engine/speldiagnos.probe.test.ts
//   Bash:        SPELDIAG=1 npx vitest run src/lib/engine/speldiagnos.probe.test.ts
//
// Valfria rattar (miljövariabler):
//   SPELDIAG_DEALS     antal givar (standard 200 ≈ 20–40 min — botCardSmart är
//                      Monte-Carlo per beslut; DD-analysen kostar bara sekunder)
//   SPELDIAG_SEED      basfrö (standard 20260721 — SAMMA givuniversum som
//                      M-serien så budsiffrorna är direkt jämförbara!)
//   SPELDIAG_OFFSET    hoppa fram i frö-serien (parallella skivor: kör 4
//                      terminaler med OFFSET 0/50/100/150 och DEALS 50)
//   SPELDIAG_EXAMPLES  max värsta-exempel per grupp (standard 8)
//   SPELDIAG_OUT       filnamn för latest-JSON (standard speldiagnos-latest.json;
//                      sätt eget per skiva, t.ex. speldiagnos-s0.json)
//
// Spelet är 100 % reproducerbart: varje botbeslut får sitt frö via
// botDecisionSeed(givens frö, beslutsindex) — samma väg som tävlingen.
// Utdata: läsbar rapport i konsolen + JSON i revisor-output/ (gitignorad).
// OBS ägarprincipen: DD-tappen är larmklockor att granska i /speldiagnos —
// klassningen systemfel/ärlig miss görs där, aldrig av siffrorna själva.

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyseSpel, computeOracle, getDds } from './revisor-dds'
import { spelaMedFro } from './spela-giv'
import { formatSpeldiagnos, korSpeldiagnos } from './speldiagnos'

const DEALS = Number(process.env.SPELDIAG_DEALS ?? 200)
const SEED = Number(process.env.SPELDIAG_SEED ?? 20260721)
const OFFSET = Number(process.env.SPELDIAG_OFFSET ?? 0)
const EXAMPLES = Number(process.env.SPELDIAG_EXAMPLES ?? 8)
const OUT = process.env.SPELDIAG_OUT ?? 'speldiagnos-latest.json'

it.skipIf(!process.env.SPELDIAG)(
  `speldiagnosen: ${DEALS} givar, frö ${SEED}+${OFFSET}`,
  { timeout: 0 }, // mätningen får ta den tid den tar
  async () => {
    const dds = await getDds()
    const rapport = korSpeldiagnos({
      deals: DEALS,
      baseSeed: SEED + OFFSET,
      oracle: (deal) => {
        const o = computeOracle(dds, deal)
        return { solve: o.solve, parNS: o.parNS, analyse: (contract, tricks) => analyseSpel(dds, deal, contract, tricks) }
      },
      spela: (deal, contract, calls, seed) => spelaMedFro(deal, contract, calls, seed),
      examplesPerGrupp: EXAMPLES,
      onProgress: (done, total) => {
        if (done % 10 === 0 || done === total) console.log(`  ...${done}/${total} givar`)
      },
    })

    console.log('\n' + formatSpeldiagnos(rapport) + '\n')

    const dir = join(process.cwd(), 'revisor-output')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const file = join(dir, `speldiagnos-${stamp}.json`)
    writeFileSync(file, JSON.stringify(rapport, null, 2), 'utf8')
    writeFileSync(join(dir, OUT), JSON.stringify(rapport, null, 2), 'utf8')
    console.log(`Full rapport med alla domar: ${file}`)
  },
)
