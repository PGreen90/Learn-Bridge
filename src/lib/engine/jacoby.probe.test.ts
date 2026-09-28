// JACOBY-SONDEN (läge 3-paketet, 2026-09-28): bjuder N frögivar bot mot bot och
// skriver auktionerna till en fil, så två motorversioner kan diffas (A/B via
// git stash). Körs INTE i `npm test` (skipIf) — bara med JACOBY=1:
//
//   JACOBY=1 JACOBY_LABEL=fore npx vitest run src/lib/engine/jacoby.probe.test.ts
//
// Utfil: %TEMP%/jacoby-<label>.txt, en rad per giv: frö | auktion | slutkontrakt.
// Frön 20270001–20271500 = samma 1 500 givar som golvmätningen 2026-09-21.

import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { botAuction, dealFromSeed } from './revisor'
import { contractFromCalls } from './auction-contract'

const DEALS = Number(process.env.JACOBY_DEALS ?? 1500)
const FIRST = Number(process.env.JACOBY_SEED ?? 20270001)
const LABEL = process.env.JACOBY_LABEL ?? 'latest'

it.skipIf(!process.env.JACOBY)(`Jacoby-sonden: ${DEALS} givar → jacoby-${LABEL}.txt`, { timeout: 0 }, () => {
  const rows: string[] = []
  for (let i = 0; i < DEALS; i++) {
    const seed = FIRST + i
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    if (!history) { rows.push(`${seed}|(ofullständig)|`); continue }
    const contract = contractFromCalls(history)
    const c = contract ? `${contract.level}${contract.strain} ${contract.declarer}` : 'utpassad'
    rows.push(`${seed}|${history.map((x) => x.bid).join(' ')}|${c}`)
  }
  const out = join(process.env.TEMP ?? '.', `jacoby-${LABEL}.txt`)
  writeFileSync(out, rows.join('\n'))
})
