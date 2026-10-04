// SLAMTABELLENS DD-DOM (2026-10-03): vad hände med de givar där ägarens
// slamtabell (§6.1, 2026-10-02) ändrade slutkontraktet? Läser två auktionsdumpar
// (före/efter, skrivna av auktionsdump-sonden) och dömer varje ÄNDRAT
// slutkontrakt mot double-dummy: stod slammen eller inte?
//
// Mått på en REGEL över många givar — aldrig ett facit för enskilda bud.
//
//   $env:SLAMDD_FORE='revisor-output/före-a.json,revisor-output/före-b.json'
//   $env:SLAMDD_EFTER='revisor-output/efter-a.json,revisor-output/efter-b.json'
//   npx vitest run src/lib/engine/slamtabell-dd.probe.test.ts
//
// Utdata: revisor-output/slamtabell-dd.txt
import { it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { dealFromSeed } from './revisor'
import { computeOracle, getDds } from './revisor-dds'

const FORE = (process.env.SLAMDD_FORE ?? '').split(',').filter(Boolean)
const EFTER = (process.env.SLAMDD_EFTER ?? '').split(',').filter(Boolean)

interface Dumpad { seed: number; calls: { seat: string; bid: string; rule: string | null }[] | null }
const läs = (p: string): Dumpad[] => {
  const j = JSON.parse(readFileSync(p, 'utf8'))
  return Array.isArray(j) ? j : j.deals
}

it.skipIf(FORE.length === 0 || FORE.length !== EFTER.length)('slamtabellens DD-dom', { timeout: 0 }, async () => {
  const dds = await getDds()
  const rader: string[] = []
  const tal = { ändrade: 0, slamBortStod: 0, slamBortBet: 0, slamTillStod: 0, slamTillBet: 0, annat: 0 }
  for (let k = 0; k < FORE.length; k++) {
    const efter = new Map(läs(EFTER[k]).map((d) => [d.seed, d]))
    for (const f of läs(FORE[k])) {
      const e = efter.get(f.seed)
      if (!f.calls || !e?.calls) continue
      if (f.calls.map((c) => c.bid).join(' ') === e.calls.map((c) => c.bid).join(' ')) continue
      const k1 = contractFromCalls(f.calls as unknown as ResolvedCall[])
      const k2 = contractFromCalls(e.calls as unknown as ResolvedCall[])
      if (!k1 || !k2) continue
      if (k1.level === k2.level && k1.strain === k2.strain) continue // samma slutkontrakt, annan väg
      tal.ändrade++
      const o = computeOracle(dds, dealFromSeed(f.seed))
      const stick1 = o.solve(k1.declarer, k1.strain) ?? 0
      const stick2 = o.solve(k2.declarer, k2.strain) ?? 0
      const hem1 = stick1 >= k1.level + 6
      const hem2 = stick2 >= k2.level + 6
      const slam1 = k1.level >= 6
      const slam2 = k2.level >= 6
      let klass = 'annat'
      if (slam1 && !slam2) { klass = hem1 ? 'slam BORT som stod' : 'slam BORT som gick bet'; hem1 ? tal.slamBortStod++ : tal.slamBortBet++ }
      else if (!slam1 && slam2) { klass = hem2 ? 'slam TILL som står' : 'slam TILL som går bet'; hem2 ? tal.slamTillStod++ : tal.slamTillBet++ }
      else tal.annat++
      const namn = (c: typeof k1, s: number) => `${c.level}${String(c.strain).length <= 2 ? c.strain : String(c.strain)[0].toUpperCase()} av ${c.declarer} (${s} stick, ${s >= c.level + 6 ? 'hem' : `bet ${c.level + 6 - s}`})`
      rader.push(`frö ${f.seed}: ${namn(k1, stick1)}  →  ${namn(k2, stick2)}   [${klass}]`)
    }
  }
  const huvud = [
    `SLAMTABELLENS DD-DOM — ${tal.ändrade} givar med ändrat slutkontrakt`,
    `  slam som inte längre bjuds:  ${tal.slamBortBet} gick bet (rätt att stanna) · ${tal.slamBortStod} stod (missad)`,
    `  slam som nu bjuds:           ${tal.slamTillStod} står · ${tal.slamTillBet} går bet`,
    `  övriga ändringar (nivå/färg): ${tal.annat}`,
    '',
  ]
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/slamtabell-dd.txt', [...huvud, ...rader].join('\n'), 'utf8')
})
