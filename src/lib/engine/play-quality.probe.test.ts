// SPELKVALITETS-PROBE (markeringar Steg 5a). Körs ALDRIG i vanliga npm test /
// deploygrinden (skipIf) – bara på begäran:
//
//   PowerShell:  $env:PLAYQ='1'; npx vitest run src/lib/engine/play-quality.probe.test.ts
//   Bash:        PLAYQ=1 npx vitest run src/lib/engine/play-quality.probe.test.ts
//
// Rattar: PLAYQ_DEALS (antal givar, standard 24), PLAYQ_SEED (basfrö, standard
// 20260729 – behåll för jämförbara mätningar).
//
// Varför: systemrevisorn mäter BUDGIVNING. Den här riggen mäter SPELSTYRKA –
// hur många stick spelföraren tar när alla fyra spelas av bot-hjärnan
// (Monte-Carlo-DDS). När signalavkodningen (Steg 5b/5c) byggs körs samma frö
// MED och UTAN avkodning: avkodningen får inte höja spelförarens stick (då
// försämrar den försvaret). Décode ska sänka eller lämna oförändrat.

import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import type { SmartOpts } from './play-bot'
import type { Contract } from './play'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import { spelaHelGiv } from './spela-giv'
import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'

const DEALS = Number(process.env.PLAYQ_DEALS ?? 24)
const SEED = Number(process.env.PLAYQ_SEED ?? 20260729)

/** Spela hela given med bot-hjärnan (Monte-Carlo) för alla fyra; spelförarens stick. */
function declarerTricksSmart(deal: Deal, contract: Contract, calls: ResolvedCall[], opts: SmartOpts): number {
  return spelaHelGiv(deal, contract, calls, { smart: opts }).declarerTricks
}

it.skipIf(!process.env.PLAYQ)(
  `spelkvalitet A/B (avkodning av/på): ${DEALS} givar, frö ${SEED}`,
  { timeout: 0 },
  () => {
    const t0 = Date.now()
    let spelade = 0
    let sumOff = 0
    let sumOn = 0
    const changed: string[] = []
    for (let i = 0; i < DEALS; i++) {
      const seed = SEED + i
      const deal = dealFromSeed(seed)
      const calls = botAuction(deal)
      const contract = calls && contractFromCalls(calls)
      if (!contract || !calls) continue
      spelade++
      const off = declarerTricksSmart(deal, contract, calls, { decodeSignals: false })
      const on = declarerTricksSmart(deal, contract, calls, { decodeSignals: true })
      sumOff += off
      sumOn += on
      if (on !== off) {
        changed.push(`seed ${seed}: ${contract.level}${contract.strain} by ${contract.declarer} → decl UTAN ${off} MED ${on} (${on - off > 0 ? '+' : ''}${on - off})`)
      }
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    // netDecl < 0 = avkodningen SÄNKTE spelförarens stick = bättre försvar (bra).
    const netDecl = sumOn - sumOff
    const report =
      `PLAYQ A/B: ${spelade} givar, ${secs}s\n` +
      `spelförarstick UTAN avkodning=${sumOff}, MED=${sumOn}, netto MED−UTAN=${netDecl > 0 ? '+' : ''}${netDecl}\n` +
      `(negativt = avkodningen förbättrade försvaret; ${changed.length} givar ändrades)\n` +
      changed.join('\n')
    writeFileSync(process.env.TEMP + '/playq.txt', report)
    // eslint-disable-next-line no-console
    console.log(report)
  },
)
