// SKANNER (kontrollbud före essfrågan, steg 5, 2026-10-09): var finns 4m-
// slaminbjudningar ('slaminbjudan' på 4♣/4♦) kvar i motorn, och vad svarar
// partnern — accept rakt till 6m ('slaminbjudan: accept', förbjudet sedan
// ägarbeslutet 2026-10-07 "4→6 utan essfråga") eller något annat? Grupperar
// per budväg (tre första reglerna) så nästa budväg att bygga om syns direkt.
//
//   $env:STEG5='1'; $env:S5_FROM='20276001'; $env:S5_TO='20576000'
//   npx vitest run src/lib/engine/slaminbjudan-4m.probe.test.ts
//
// Utdata: revisor-output/slaminbjudan-4m.txt. 300 000 frön tar ~2 min.
import { mkdirSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { botAuction, dealFromSeed } from './revisor'

const PÅ = process.env.STEG5 === '1'
const FROM = Number(process.env.S5_FROM ?? 20276001)
const TO = Number(process.env.S5_TO ?? 20296000)

it.skipIf(!PÅ)('4m-slaminbjudningar per budväg', { timeout: 0 }, () => {
  const grupper = new Map<string, string[]>()
  let n = 0
  for (let seed = FROM; seed <= TO; seed++) {
    const deal = dealFromSeed(seed)
    const calls = botAuction(deal)
    if (!calls) continue
    const i = calls.findIndex((c) => c.rule === 'slaminbjudan' && /^4[CD]$/.test(c.bid))
    if (i < 0) continue
    const svar = calls.slice(i + 1).find((c) => c.bid !== 'P')
    if (!svar) continue
    n++
    const bud = calls.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`).join(' ')
    const väg = calls.filter((c) => c.bid !== 'P').slice(0, 3).map((c) => c.rule ?? '?').join(' · ')
    const nyckel = `${väg} ⇒ ${svar.rule}`
    if (!grupper.has(nyckel)) grupper.set(nyckel, [])
    grupper.get(nyckel)!.push(`${seed} [${deal.dealer}/${deal.vulnerability}] ${bud}`)
  }
  const rader = [`4m-SLAMINBJUDNINGAR — frön ${FROM}-${TO}: ${n} auktioner`]
  for (const [k, v] of [...grupper.entries()].sort((a, b) => b[1].length - a[1].length)) {
    rader.push(`\n== ${k} (${v.length})`)
    for (const r of v.slice(0, 8)) rader.push(`  ${r}`)
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/slaminbjudan-4m.txt', rader.join('\n') + '\n')
})
