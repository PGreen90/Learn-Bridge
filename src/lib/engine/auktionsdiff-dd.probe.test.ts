// AUKTIONSDIFFENS DD-DOM (2026-10-08): dömer varje ändrat slutkontrakt mellan två
// auktionsdumpar med dubbeldummy — "skadar ändringen systemet?" i stick och poäng,
// inte i tyckande. För varje giv där slutkontraktet skiljer sig räknas poängen
// (duplicate, zon ur given) för före- och efterkontraktet på DD-stick, sett från
// den sida vars bud först ändrades. Netto > 0 = ändringen vann poäng.
//
//   Bash:        DDDIFF=1 npx vitest run src/lib/engine/auktionsdiff-dd.probe.test.ts
//   PowerShell:  $env:DDDIFF='1'; npx vitest run src/lib/engine/auktionsdiff-dd.probe.test.ts
// Rattar: DDDIFF_FORE (standard revisor-output/auktionsdump-baslinje.json),
// DDDIFF_EFTER (standard revisor-output/auktionsdump.json), DDDIFF_UT
// (standard revisor-output/auktionsdiff-dd.txt). Exempel: de tio största
// vinsterna och förlusterna per kategori (regelövergången i första skillnaden).
import { it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { dealFromSeed } from './revisor'
import { computeOracle, getDds } from './revisor-dds'
import { contractFromCalls } from './auction-contract'
import { duplicateScore, sideVulnerable } from './scoring'
import { side } from './play'

interface Dump { seed: number; dealer: Seat; vulnerability: 'none' | 'ns' | 'ew' | 'all'; hands: Record<Seat, string>; calls: (ResolvedCall & { rule?: string })[] }

it.skipIf(!process.env.DDDIFF)('auktionsdiffens DD-dom', async () => {
  const fore: Dump[] = JSON.parse(readFileSync(process.env.DDDIFF_FORE ?? 'revisor-output/auktionsdump-baslinje.json', 'utf8'))
  const efter: Dump[] = JSON.parse(readFileSync(process.env.DDDIFF_EFTER ?? 'revisor-output/auktionsdump.json', 'utf8'))
  const efterBySeed = new Map(efter.map((d) => [d.seed, d]))
  const dds = await getDds()
  let changedAuctions = 0
  let changedContracts = 0
  let netto = 0
  let better = 0
  let worse = 0
  let same = 0
  const perCat = new Map<string, { n: number; netto: number; better: number; worse: number; ex: { seed: number; delta: number; text: string }[] }>()
  for (const a of fore) {
    const b = efterBySeed.get(a.seed)
    if (!b) continue
    const ab = a.calls.map((c) => c.bid)
    const bb = b.calls.map((c) => c.bid)
    if (ab.join(' ') === bb.join(' ')) continue
    changedAuctions++
    const firstIdx = ab.findIndex((x, i) => x !== bb[i])
    const changer = a.calls[firstIdx]?.seat ?? b.calls[firstIdx]?.seat
    const ourSide = side(changer)
    const cat = `${a.calls[firstIdx]?.rule ?? '—'} ${ab[firstIdx] ?? '·'} → ${b.calls[firstIdx]?.rule ?? '—'} ${bb[firstIdx] ?? '·'}`
    const ca = contractFromCalls(a.calls)
    const cb = contractFromCalls(b.calls)
    const key = (c: ReturnType<typeof contractFromCalls>) => (c ? `${c.level}${c.strain}${c.doubled ?? ''}${c.declarer}` : 'pass')
    if (key(ca) === key(cb)) continue
    changedContracts++
    const deal = dealFromSeed(a.seed)
    const oracle = computeOracle(dds, deal)
    const scoreFor = (c: ReturnType<typeof contractFromCalls>): number => {
      if (!c) return 0
      const tricks = oracle.solve(c.declarer, c.strain) ?? 0
      const s = duplicateScore(c, tricks, sideVulnerable(c.declarer, deal.vulnerability))
      return side(c.declarer) === ourSide ? s : -s
    }
    const delta = scoreFor(cb) - scoreFor(ca)
    netto += delta
    if (delta > 0) better++
    else if (delta < 0) worse++
    else same++
    const entry = perCat.get(cat) ?? { n: 0, netto: 0, better: 0, worse: 0, ex: [] }
    entry.n++
    entry.netto += delta
    if (delta > 0) entry.better++
    if (delta < 0) entry.worse++
    entry.ex.push({ seed: a.seed, delta, text: `${key(ca)} → ${key(cb)} · ${changer}: ${deal.hands[changer].length ? a.hands[changer] : ''} · zon ${deal.vulnerability}` })
    perCat.set(cat, entry)
  }
  const rader = [
    `=== AUKTIONSDIFFENS DD-DOM · ändrade auktioner ${changedAuctions} · ändrade slutkontrakt ${changedContracts} ===`,
    `netto ${netto >= 0 ? '+' : ''}${netto} poäng (sett från sidan vars bud ändrades) · bättre ${better} · sämre ${worse} · lika ${same}`,
    '',
  ]
  for (const [cat, e] of [...perCat.entries()].sort((x, y) => y[1].n - x[1].n)) {
    rader.push(`##### ${cat}: ${e.n} ändrade kontrakt · netto ${e.netto >= 0 ? '+' : ''}${e.netto} · bättre ${e.better} · sämre ${e.worse}`)
    const sorted = [...e.ex].sort((x, y) => x.delta - y.delta)
    for (const x of sorted.slice(0, 5)) rader.push(`  ${String(x.delta).padStart(6)}  frö ${x.seed}  ${x.text}`)
    if (sorted.length > 5) for (const x of sorted.slice(-3)) rader.push(`  ${String(x.delta).padStart(6)}  frö ${x.seed}  ${x.text}`)
    rader.push('')
  }
  writeFileSync(process.env.DDDIFF_UT ?? 'revisor-output/auktionsdiff-dd.txt', rader.join('\n'), 'utf8')
  expect(changedAuctions).toBeGreaterThanOrEqual(0)
}, 0)
