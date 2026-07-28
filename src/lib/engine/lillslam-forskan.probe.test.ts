// FÖRSKANNINGSVERKTYG för etapp 7 (missad lillslam). Lever så länge etappen
// pågår — körs om efter varje hål för att se vilka givar som flyttat och vilka
// som återstår. Raderas när etappen är klar. Mönsteranalysen den producerade
// står i docs/systemrevisorn.md ("ETAPP 7 FÖRSKANNAD").
//
//   $env:FORSKAN='1'; npx vitest run src/lib/engine/lillslam-forskan.probe.test.ts
//
// Läser missad-lillslam-givarna ur revisor-output/latest.json, värderar
// SLAMSIDANS båda händer med systemets EGEN värdering (startingPoints +
// dummyPoints i facit-trumfen) och skriver ut hur många som når systemets
// slamportar (33 driv / 31–32 inbjudan) — inte bara råa hp.

import { it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Suit } from '../../types/bridge'
import { dealFromSeed } from './revisor'
import { startingPoints, dummyPoints } from './evaluation'
import { hcp, lengths } from './hand'

const SUIT_OF: Record<string, Suit | null> = {
  C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades', NT: null,
}

it.skipIf(!process.env.FORSKAN)('lillslam-förskanning', () => {
  const latest = JSON.parse(readFileSync('revisor-output/latest.json', 'utf8'))
  const cat = latest.categories.find((c: { category: string }) => c.category === 'missad-lillslam')
  const dump = JSON.parse(readFileSync('revisor-output/auktionsdump.json', 'utf8'))
  const calls = new Map(dump.map((d: { seed: number; calls: unknown[] }) => [d.seed, d.calls]))

  const out: string[] = []
  const rows: Record<string, unknown>[] = []

  for (const e of cat.examples) {
    const m = String(e.optimum).match(/bästa görbara (\d)([A-Z]+) av ([NESW]) \((NS|EW) (-?\d+)\)/)
    if (!m) continue
    const strain = m[2]
    const side = m[4] as 'NS' | 'EW'
    const owners = (side === 'NS' ? ['N', 'S'] : ['E', 'W']) as ('N' | 'E' | 'S' | 'W')[]
    const deal = dealFromSeed(e.seed)
    const trump = SUIT_OF[strain]

    // Systemets egen värdering: öppningshanden räknar startpoäng, den andra
    // handen stödpoäng i facit-trumfen (sang → startpoäng för båda).
    const pts = owners.map((s) => {
      const h = deal.hands[s]
      const sp = startingPoints(h).startingPoints
      const dp = trump ? dummyPoints(h, trump).dummyPoints : sp
      return { seat: s, hcp: hcp(h), sp, dp, len: lengths(h) }
    })
    const rawHcp = pts.reduce((t, p) => t + p.hcp, 0)
    // Par-summan: bästa av (A start + B stöd) och (B start + A stöd).
    const pairPts = Math.max(pts[0].sp + pts[1].dp, pts[1].sp + pts[0].dp)

    const mine = (calls.get(e.seed) ?? []) as { seat: string; bid: string; rule: string | null }[]
    const ours = mine.filter((c) => owners.includes(c.seat as 'N'))
    const lastPass = [...ours].reverse().find((c) => c.bid === 'P')
    const ruleless = !lastPass?.rule

    const port = pairPts >= 33 ? 'DRIV (33+)' : pairPts >= 31 ? 'INBJUDAN (31-32)' : 'under porten'
    rows.push({ seed: e.seed, loss: e.loss, rawHcp, pairPts, port, ruleless, contract: e.contract, facit: m[1] + strain, auction: (e.auction ?? []).join(' ') })
  }

  const bucket = (p: string) => rows.filter((r) => r.port === p)
  for (const p of ['DRIV (33+)', 'INBJUDAN (31-32)', 'under porten']) {
    const b = bucket(p)
    const loss = b.reduce((t, r) => t + (r.loss as number), 0)
    const rl = b.filter((r) => r.ruleless).length
    out.push(`${p.padEnd(18)} ${String(b.length).padStart(3)} givar  ${String(loss).padStart(6)} p   varav regellöst pass: ${rl}`)
  }
  out.push('')
  out.push('=== NÅR SYSTEMETS SLAMPORT MEN STANNADE (de äkta hålen) ===')
  for (const r of rows.filter((r) => r.port !== 'under porten').sort((a, b) => (b.loss as number) - (a.loss as number))) {
    out.push(`frö ${r.seed}  ${r.rawHcp} hp / ${r.pairPts} systempoäng  ${r.port}  tapp ${r.loss}  ->  ${r.contract}  facit ${r.facit}${r.ruleless ? '  [regellöst pass]' : ''}`)
    out.push(`     ${r.auction}`)
  }

  // ---- Delskanning: bjöd någon ett MINIMUM-märkt bud med extra styrka? ----
  out.push('')
  out.push('=== BUD SOM SÄGER "MINIMUM" MED EXTRA STYRKA (slamsidan) ===')
  const offenders: Record<string, { n: number; loss: number; seeds: number[] }> = {}
  for (const e of cat.examples) {
    const m = String(e.optimum).match(/\((NS|EW) (-?\d+)\)/)
    if (!m) continue
    const owners = (m[1] === 'NS' ? ['N', 'S'] : ['E', 'W']) as ('N' | 'E' | 'S' | 'W')[]
    const deal = dealFromSeed(e.seed)
    const cs = (calls.get(e.seed) ?? []) as { seat: string; bid: string; rule: string | null; explanation: string | null }[]
    for (const c of cs) {
      if (!owners.includes(c.seat as 'N')) continue
      if (!/minimum/i.test(c.explanation ?? '')) continue
      const tp = startingPoints(deal.hands[c.seat as 'N']).startingPoints
      if (tp < 17) continue // 12–16 ÄR minimum – bara riktiga extrahänder räknas
      const k = `${c.rule} (${c.bid})`
      offenders[k] = offenders[k] ?? { n: 0, loss: 0, seeds: [] }
      offenders[k].n++
      offenders[k].loss += e.loss
      offenders[k].seeds.push(e.seed)
    }
  }
  for (const [k, v] of Object.entries(offenders).sort((a, b) => b[1].loss - a[1].loss)) {
    out.push(`${String(v.n).padStart(3)}g ${String(v.loss).padStart(6)}p  ${k}  ${v.seeds.join(', ')}`)
  }

  const text = out.join('\n')
  console.log('\n' + text + '\n')
  writeFileSync('revisor-output/lillslam-forskan.txt', text, 'utf8')
  writeFileSync('revisor-output/lillslam-forskan.json', JSON.stringify(rows, null, 1), 'utf8')
})
