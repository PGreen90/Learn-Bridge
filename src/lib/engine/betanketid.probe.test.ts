// BETÄNKETID-SOND (ägarfråga 2026-11-15: "bottarna tänker för länge på sina
// kort — hur länge, varför, på vad?"). Spelar slumpgivar med bot-hjärnan på
// alla fyra stolar, exakt som tävlingen/bordet (per-beslut-frön), och mäter
// REN RÄKNETID per kortval — utan gränssnittets pauser (tempo.ts).
//
//   PowerShell:  $env:BETANKETID='40'; npx vitest run src/lib/engine/betanketid.probe.test.ts
//   Bash:        BETANKETID=40 npx vitest run src/lib/engine/betanketid.probe.test.ts
//
// Talet = antal givar (frön 20261115, 20261116, …). Utdata:
// revisor-output/betanketid.txt. Tiderna gäller DEN HÄR datorn i Node — en
// telefon eller serverfunktionen är långsammare, men fördelningen står sig.

import { expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { laddaSnabbLosare } from './mc-losare'
import { harSnabbLosare } from './monte-carlo'
import { botCardSmartBase, botCardSmartReasoned, usesMonteCarlo } from './play-bot'
import { isComplete, legalCards, playCard, startPlay } from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { botAuction, dealFromSeed } from './revisor'

const ANTAL = Number(process.env.BETANKETID ?? 0)
const FRO0 = 20261115

interface Rad {
  giv: number
  stick: number // 1–13
  kortKvar: number
  lagliga: number
  vag: 'ett kort' | 'utspel' | 'tumregel' | 'MC' | 'regel i MC-fönstret'
  bas: number // ms: valet (tumregel eller Monte-Carlo)
  avblock: number // ms: enfärgs-lösaren ovanpå
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const f = (n: number) => n.toFixed(0).padStart(6)

it.skipIf(ANTAL === 0)('betänketid', { timeout: 0 }, async () => {
  // BETANKETID_TS=1 mäter den gamla TS-lösaren (jämförelsetalet före lösarbytet
  // 2026-11-15); annars den snabba lösaren, som i drift.
  if (process.env.BETANKETID_TS !== '1') await laddaSnabbLosare()
  const rader: Rad[] = []
  const perGiv: number[] = []
  let spelade = 0
  for (let i = 0; spelade < ANTAL && i < ANTAL * 3; i++) {
    const fro = FRO0 + i
    const deal = dealFromSeed(fro)
    const history = botAuction(deal)
    const contract = history && contractFromCalls(history)
    if (!history || !contract) continue
    spelade++
    let st = startPlay(deal, contract)
    let givMs = 0
    while (!isComplete(st)) {
      const seat = st.toAct
      const idx = playIndexOf(st.completedTricks.length, st.currentTrick.length)
      const lagliga = legalCards(st, seat).length
      const utspel = st.completedTricks.length === 0 && st.currentTrick.length === 0
      const mc = usesMonteCarlo(st, seat)
      const t0 = performance.now()
      const bas = botCardSmartBase(st, seat, history, { rng: mulberry32(botDecisionSeed(fro, idx)) })
      const t1 = performance.now()
      const val = botCardSmartReasoned(st, seat, history, { rng: mulberry32(botDecisionSeed(fro, idx)) })
      const t2 = performance.now()
      const basMs = t1 - t0
      const helMs = t2 - t1
      const blevMC = bas.reason.startsWith('Bot-hjärnan tänkte')
      rader.push({
        giv: fro,
        stick: st.completedTricks.length + 1,
        kortKvar: st.hands[seat].length,
        lagliga,
        vag: lagliga === 1 ? 'ett kort' : utspel ? 'utspel' : !mc ? 'tumregel' : blevMC ? 'MC' : 'regel i MC-fönstret',
        bas: basMs,
        avblock: Math.max(0, helMs - basMs),
      })
      givMs += helMs
      st = playCard(st, val.card)
    }
    perGiv.push(givMs)
  }

  const ut: string[] = []
  const tot = (r: Rad) => r.bas + r.avblock
  ut.push(`Lösare: ${harSnabbLosare() ? 'snabb (bridge-dds), som i drift' : 'TS (före lösarbytet)'}`)
  ut.push(`BETÄNKETID — ${spelade} givar, ${rader.length} kortval (alla fyra stolar är bottar)`)
  ut.push(`Räknetid totalt: ${(sum(rader.map(tot)) / 1000).toFixed(1)} s · per giv median ${(pct(perGiv, 50) / 1000).toFixed(1)} s, p90 ${(pct(perGiv, 90) / 1000).toFixed(1)} s, max ${(Math.max(...perGiv) / 1000).toFixed(1)} s`)
  ut.push('')
  ut.push('PER VÄG (ms per kortval)')
  ut.push('väg                     antal  andel tid  median    p90    p99    max')
  const allTid = sum(rader.map(tot))
  for (const v of ['ett kort', 'utspel', 'tumregel', 'regel i MC-fönstret', 'MC'] as const) {
    const xs = rader.filter((r) => r.vag === v).map(tot)
    if (!xs.length) continue
    ut.push(`${v.padEnd(22)} ${String(xs.length).padStart(6)}  ${((100 * sum(xs)) / allTid).toFixed(1).padStart(7)} %  ${f(pct(xs, 50))} ${f(pct(xs, 90))} ${f(pct(xs, 99))} ${f(Math.max(...xs))}`)
  }
  ut.push('')
  ut.push('MONTE-CARLO PER KORT KVAR PÅ HANDEN (ms per kortval)')
  ut.push('kort kvar  antal  median    p90    max   varav avblockering (median)')
  for (let k = 8; k >= 2; k--) {
    const rs = rader.filter((r) => r.vag === 'MC' && r.kortKvar === k)
    if (!rs.length) continue
    ut.push(`${String(k).padStart(9)} ${String(rs.length).padStart(6)}  ${f(pct(rs.map(tot), 50))} ${f(pct(rs.map(tot), 90))} ${f(Math.max(...rs.map(tot)))}   ${f(pct(rs.map((r) => r.avblock), 50))}`)
  }
  ut.push('')
  ut.push('PER STICK (summa ms för stickets fyra kort, median / p90 över givarna)')
  for (let s = 1; s <= 13; s++) {
    const perG = new Map<number, number>()
    for (const r of rader.filter((r) => r.stick === s)) perG.set(r.giv, (perG.get(r.giv) ?? 0) + tot(r))
    const xs = [...perG.values()]
    ut.push(`stick ${String(s).padStart(2)}: ${f(pct(xs, 50))} / ${f(pct(xs, 90))}`)
  }
  ut.push('')
  ut.push('KORTVAL ÖVER TRÖSKLAR (räknetid)')
  for (const t of [250, 500, 1000, 2000, 4000]) {
    const n = rader.filter((r) => tot(r) > t).length
    ut.push(`> ${String(t).padStart(4)} ms: ${String(n).padStart(5)} (${((100 * n) / rader.length).toFixed(1)} %)`)
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/betanketid.txt', ut.join('\n') + '\n')
  expect(spelade).toBeGreaterThan(0)
})
