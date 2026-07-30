// SPELSTYRKE-PROBE för spelförarens etablering av lång färg (felrapport #32).
// Körs ALDRIG i vanliga npm test / deploygrinden (skipIf) – bara på begäran:
//
//   PowerShell:  $env:ESTABLISH='1'; npx vitest run src/lib/engine/play-establish.probe.test.ts
//   Bash:        ESTABLISH=1 npx vitest run src/lib/engine/play-establish.probe.test.ts
//
// Rattar: ESTABLISH_DEALS (antal, standard 40), ESTABLISH_SEED (basfrö, standard
// 20260729 – behåll för jämförbara mätningar).
//
// DETERMINISTISK: alla fyra spelas av den skarpa boten under MOCKAD slump
// (mulberry32, nollställd per giv), så summan av spelförarens stick är exakt
// reproducerbar körning för körning. A/B mot en kodändring görs genom att stasha
// bort ändringen (`git stash push -- src/lib/engine/play-bot.ts`), köra igen och
// jämföra. Uppmätt 2026-07-29 (40 givar, frö 20260729): baslinje 366 →
// med #32-fixen (etablera lång färg i sang) 374, netto +8; noll trumf-regressioner
// efter att heuristiken begränsats till sang.

import { afterEach, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { botCardSmart } from './play-bot'
import { contractResult, isComplete, playCard, startPlay, type Contract } from './play'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'

/** Deterministisk PRNG (mulberry32) – samma stabilisering som teknik-testerna. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function declarerTricks(deal: Deal, contract: Contract, calls: ResolvedCall[]): number {
  let st = startPlay(deal, contract)
  let guard = 0
  while (!isComplete(st) && guard++ < 60) st = playCard(st, botCardSmart(st, st.toAct, calls, { samples: 30 }))
  return contractResult(st).declarerTricks
}

const DEALS = Number(process.env.ESTABLISH_DEALS ?? 40)
const SEED = Number(process.env.ESTABLISH_SEED ?? 20260729)

it.skipIf(!process.env.ESTABLISH)(
  `spelstyrka: spelförarstick över ${DEALS} seedade givar, frö ${SEED}`,
  { timeout: 0 },
  () => {
    let played = 0
    let sum = 0
    const per: string[] = []
    for (let i = 0; i < DEALS; i++) {
      const seed = SEED + i
      const deal = dealFromSeed(seed)
      const calls = botAuction(deal)
      const contract = calls && contractFromCalls(calls)
      if (!contract || !calls) continue
      vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed)) // determinism per giv
      const t = declarerTricks(deal, contract, calls)
      vi.restoreAllMocks()
      played++
      sum += t
      per.push(`${seed}:${contract.level}${contract.strain}=${t}`)
    }
    const report = `SPELSTYRKA: ${played} givar, SUMMA spelförarstick=${sum}\n${per.join(' ')}\n`
    writeFileSync(process.env.TEMP + '/establish.txt', report)
    // eslint-disable-next-line no-console
    console.log(report)
  },
)

afterEach(() => vi.restoreAllMocks())
