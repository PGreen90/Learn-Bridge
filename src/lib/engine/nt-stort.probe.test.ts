// STÖRT-1NT-SONDEN (felrapport #77, ägarens fråga 2026-09-18: "9/10 gånger ska
// paret som öppnat 1NT vinna budgivningen — har vi byggt bra?"). Körs ALDRIG i
// vanliga `npm test` (skipIf):
//
//   Bash:  NTSTORT=1 npx vitest run src/lib/engine/nt-stort.probe.test.ts
//
// Bottarna bjuder hela givar; sonden plockar ut dem där VÅRT 1NT störs i direkt
// sits (X eller 2-lägesbud) och mäter per giv: vem som vinner kontraktet, och
// 1NT-sidans DD-poäng i slutkontraktet jämfört med par. Jämför kodversioner på
// SAMMA givar (git stash = baslinjen). DD ser alla kort — aggregaten är
// trendmätare, inte domar.
//
// Rattar: NTSTORT_DEALS (20000) · NTSTORT_SEED (20260721) · NTSTORT_OUT

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contractFromCalls } from './auction-contract'
import { side } from './play'
import { botAuction, dealFromSeed } from './revisor'
import { computeOracle, getDds } from './revisor-dds'
import { duplicateScore, sideVulnerable } from './scoring'

const DEALS = Number(process.env.NTSTORT_DEALS ?? 20000)
const SEED = Number(process.env.NTSTORT_SEED ?? 20260721)
const OUT = process.env.NTSTORT_OUT ?? 'nt-stort-latest.json'
const NEXT: Record<string, string> = { N: 'E', E: 'S', S: 'W', W: 'N' }

it.skipIf(!process.env.NTSTORT)(`stört-1NT-sonden: ${DEALS} givar`, { timeout: 0 }, async () => {
  const dds = await getDds()
  const rader: any[] = []
  for (let i = 0; i < DEALS; i++) {
    const seed = SEED + i
    const deal = dealFromSeed(seed)
    const h = botAuction(deal)
    if (!h) continue
    const k = h.findIndex((c) => c.bid !== 'P')
    if (k < 0 || h[k].bid !== '1NT') continue
    const inter = h[k + 1]
    if (!inter || inter.seat !== NEXT[h[k].seat] || (inter.bid !== 'X' && !/^2[CDHS]$/.test(inter.bid))) continue
    const ntSida = side(h[k].seat)
    const contract = contractFromCalls(h)
    const o = computeOracle(dds, deal)
    const parForNT = ntSida === 'NS' ? o.parNS : -o.parNS
    let poang = 0
    let vinnare: 'vi' | 'de' | 'utpassad' = 'utpassad'
    let kontrakt = 'utpassad'
    if (contract) {
      const tricks = o.solve(contract.declarer, contract.strain)!
      const s = duplicateScore(contract, tricks, sideVulnerable(contract.declarer, deal.vulnerability))
      poang = side(contract.declarer) === ntSida ? s : -s
      vinnare = side(contract.declarer) === ntSida ? 'vi' : 'de'
      kontrakt = `${contract.level}${contract.strain === 'NT' ? 'NT' : contract.strain[0].toUpperCase()}${contract.doubled ?? ''} ${contract.declarer}`
    }
    rader.push({ seed, inter: inter.bid, svar: h[k + 2]?.bid, kontrakt, vinnare, poang, par: parForNT, tapp: parForNT - poang, bud: h.map((c) => c.bid).join(' ') })
  }
  const n = rader.length
  const vi = rader.filter((r) => r.vinnare === 'vi').length
  const sum = (f: (r: any) => number) => rader.reduce((a, r) => a + f(r), 0)
  const L = [
    `STÖRT-1NT-SONDEN — ${DEALS} givar, frö ${SEED} · ${n} givar där vårt 1NT störs i direkt sits`,
    `Vi vinner kontraktet: ${vi}/${n} = ${((100 * vi) / n).toFixed(1)} %`,
    `1NT-sidans DD-poäng i snitt: ${(sum((r) => r.poang) / n).toFixed(1)} · par i snitt: ${(sum((r) => r.par) / n).toFixed(1)} · tapp mot par i snitt: ${(sum((r) => r.tapp) / n).toFixed(1)}`,
    `När DE vinner kontraktet (${n - vi}): vårt snitt ${(rader.filter((r) => r.vinnare !== 'vi').reduce((a, r) => a + r.poang, 0) / Math.max(1, n - vi)).toFixed(1)} · därav odubblat på 2-läget: ${rader.filter((r) => r.vinnare === 'de' && /^2[A-Z]+ /.test(r.kontrakt) && !r.kontrakt.includes('X')).length}`,
  ]
  const dir = join(process.cwd(), 'revisor-output')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, OUT), JSON.stringify({ n, rader }, null, 1), 'utf8')
  writeFileSync(join(dir, OUT.replace('.json', '.txt')), L.join('\n'), 'utf8')
})
