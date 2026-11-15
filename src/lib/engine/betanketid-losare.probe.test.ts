// BETÄNKETID — LÖSARJÄMFÖRELSEN (ägarfråga 2026-11-15, förslag för stick 6–7).
// Samma givar som betanketid.probe, men varje Monte-Carlo-beslut räknas TVÅ
// gånger på EXAKT samma utdelade lägen:
//   A) som i dag: appens egen TS-lösare, ett anrop per lagligt kort och läge;
//   B) WASM-lösaren bridge-dds (solveAllCards): ett anrop per läge ger alla kort.
// Mäter tid för båda, hur ofta de väljer SAMMA kort, och hur många lagliga kort
// som egentligen är likvärdiga grannar (t.ex. 7-6) och räknas i onödan.
//
//   Bash:  BETANKETID_LOSARE=30 npx vitest run src/lib/engine/betanketid-losare.probe.test.ts
//
// Utdata: revisor-output/betanketid-losare.txt. Rör ingen produktionskod.

import { expect, it, vi } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Dds } from 'bridge-dds'
import type { Card, Rank } from '../../types/bridge'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { playedCards } from './card-counting'
import { botCardSmartReasoned } from './play-bot'
import { isComplete, legalCards, playCard, side, startPlay, type PlayState } from './play'
import { botAuction, dealFromSeed } from './revisor'
import { getDds, solveAllCards } from './revisor-dds'

const ANTAL = Number(process.env.BETANKETID_LOSARE ?? 0)
const FRO0 = 20261115
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rv = (r: Rank) => RANKS.indexOf(r)

interface Matning {
  kortKvar: number
  lagliga: number
  klasser: number
  lagen: number
  tsMs: number
  wasmMs: number
  wasm30Ms: number
  sammaKort: boolean
  tsTappade: number // lägen TS-lösaren inte hann (nodbudgeten)
}

const delat = vi.hoisted(() => ({ dds: null as unknown, rader: [] as unknown[], n: 0 }))

/** Antal likvärdighetsklasser bland de lagliga korten: två kort i samma färg är
 *  likvärdiga om alla valörer mellan dem är spelade eller på samma hand. */
function klasser(state: PlayState, legal: Card[], hand: Card[]): number {
  const borta = new Set([...playedCards(state), ...hand].map((c) => `${c.suit}${c.rank}`))
  let n = 0
  for (const suit of new Set(legal.map((c) => c.suit))) {
    const rs = legal.filter((c) => c.suit === suit).map((c) => rv(c.rank)).sort((a, b) => a - b)
    n++
    for (let i = 1; i < rs.length; i++) {
      let grannar = true
      for (let r = rs[i - 1] + 1; r < rs[i]; r++) if (!borta.has(`${suit}${RANKS[r]}`)) grannar = false
      if (!grannar) n++
    }
  }
  return n
}

vi.mock('./monte-carlo', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./monte-carlo')>()
  return {
    ...orig,
    chooseCardMonteCarlo: (
      state: PlayState,
      seat: Parameters<typeof orig.chooseCardMonteCarlo>[1],
      model: Parameters<typeof orig.chooseCardMonteCarlo>[2],
      opts: { samples?: number; maxNodes?: number; rng?: () => number } = {},
    ) => {
      const dds = delat.dds as Dds
      const fro = 977 + delat.n++ * 7919
      const legal = legalCards(state, seat)
      const samples = opts.samples ?? 20

      const t0 = performance.now()
      const ts = orig.chooseCardMonteCarlo(state, seat, model, { ...opts, rng: mulberry32(fro) })
      const t1 = performance.now()

      const rosta = (n: number) => {
        const layouts = orig.sampleLayouts(state, seat, model, n, undefined, mulberry32(fro))
        const sum = new Map<string, number>()
        for (const layout of layouts) {
          for (const kp of solveAllCards(dds, { ...state, hands: layout })) {
            const k = `${kp.card.suit}${kp.card.rank}`
            sum.set(k, (sum.get(k) ?? 0) + kp.score)
          }
        }
        let best: Card | null = null
        let bestScore = -1
        for (const c of legal) {
          const s = sum.get(`${c.suit}${c.rank}`) ?? -1
          if (s > bestScore || (s === bestScore && best && rv(c.rank) < rv(best.rank))) {
            best = c
            bestScore = s
          }
        }
        return { best, lagen: layouts.length }
      }
      const t2 = performance.now()
      const w = rosta(samples)
      const t3 = performance.now()
      rosta(30)
      const t4 = performance.now()

      if (ts && w.best) {
        delat.rader.push({
          kortKvar: state.hands[seat].length,
          lagliga: legal.length,
          klasser: klasser(state, legal, state.hands[seat]),
          lagen: w.lagen,
          tsMs: t1 - t0,
          wasmMs: t3 - t2,
          wasm30Ms: t4 - t3,
          sammaKort: ts.card.suit === w.best.suit && ts.card.rank === w.best.rank,
          tsTappade: w.lagen - ts.samples,
        } satisfies Matning)
      }
      return ts
    },
  }
})

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const f = (n: number, w = 7) => n.toFixed(0).padStart(w)

it.skipIf(ANTAL === 0)('betänketid: lösarjämförelsen', { timeout: 0 }, async () => {
  const dds = await getDds()
  delat.dds = dds
  // Sidomätning: vad kostar WASM-lösaren OVANFÖR dagens fönster (9–12 kort)?
  // Tolv anrop på den verkliga ställningen som kostnadsmått (inget kortval görs).
  const ovan = new Map<number, number[]>()
  let spelade = 0
  for (let i = 0; spelade < ANTAL && i < ANTAL * 3; i++) {
    const fro = FRO0 + i
    const deal = dealFromSeed(fro)
    const history = botAuction(deal)
    const contract = history && contractFromCalls(history)
    if (!history || !contract) continue
    spelade++
    let st = startPlay(deal, contract)
    while (!isComplete(st)) {
      const seat = st.toAct
      const kvar = st.hands[seat].length
      const utspel = st.completedTricks.length === 0 && st.currentTrick.length === 0
      if (kvar >= 9 && !utspel && legalCards(st, seat).length > 1) {
        const t0 = performance.now()
        for (let k = 0; k < 12; k++) solveAllCards(dds, st)
        const arr = ovan.get(kvar) ?? []
        arr.push(performance.now() - t0)
        ovan.set(kvar, arr)
      }
      st = playCard(st, botCardSmartReasoned(st, seat, history, {}).card)
    }
  }
  void side

  const rader = delat.rader as Matning[]
  const ut: string[] = []
  ut.push(`LÖSARJÄMFÖRELSEN — ${spelade} givar, ${rader.length} Monte-Carlo-beslut`)
  ut.push(`Total räknetid: i dag (TS) ${(sum(rader.map((r) => r.tsMs)) / 1000).toFixed(1)} s · WASM samma lägen ${(sum(rader.map((r) => r.wasmMs)) / 1000).toFixed(1)} s · WASM 30 lägen överallt ${(sum(rader.map((r) => r.wasm30Ms)) / 1000).toFixed(1)} s`)
  const lika = rader.filter((r) => r.sammaKort).length
  ut.push(`Samma kort valt: ${lika}/${rader.length} (${((100 * lika) / rader.length).toFixed(1)} %)`)
  const olikaUtanTapp = rader.filter((r) => !r.sammaKort && r.tsTappade === 0).length
  const olikaMedTapp = rader.filter((r) => !r.sammaKort && r.tsTappade > 0).length
  ut.push(`  olika kort: ${olikaMedTapp} där TS-lösaren tappade lägen på nodbudgeten, ${olikaUtanTapp} där den löste alla`)
  ut.push(`Beslut där TS-lösaren tappade minst ett läge: ${rader.filter((r) => r.tsTappade > 0).length}`)
  ut.push('')
  ut.push('PER KORT KVAR (ms per beslut)')
  ut.push('kort  antal | TS median    p90    max | WASM median    p90    max | WASM-30 median    p90 | samma kort | TS tappade lägen (beslut)')
  for (let k = 8; k >= 2; k--) {
    const rs = rader.filter((r) => r.kortKvar === k)
    if (!rs.length) continue
    const a = rs.map((r) => r.tsMs)
    const b = rs.map((r) => r.wasmMs)
    const c = rs.map((r) => r.wasm30Ms)
    ut.push(
      `${String(k).padStart(4)} ${String(rs.length).padStart(6)} | ${f(pct(a, 50), 9)} ${f(pct(a, 90), 6)} ${f(Math.max(...a), 6)} | ${f(pct(b, 50), 11)} ${f(pct(b, 90), 6)} ${f(Math.max(...b), 6)} | ${f(pct(c, 50), 14)} ${f(pct(c, 90), 6)} | ${((100 * rs.filter((r) => r.sammaKort).length) / rs.length).toFixed(0).padStart(8)} % | ${rs.filter((r) => r.tsTappade > 0).length}`,
    )
  }
  ut.push('')
  ut.push('LIKVÄRDIGA KORT (räknas i onödan av TS-vägen)')
  ut.push('kort  lagliga kort (medel)  klasser (medel)  andel anrop som kunde sparas')
  for (let k = 8; k >= 5; k--) {
    const rs = rader.filter((r) => r.kortKvar === k)
    if (!rs.length) continue
    const l = sum(rs.map((r) => r.lagliga))
    const kl = sum(rs.map((r) => r.klasser))
    ut.push(`${String(k).padStart(4)}  ${(l / rs.length).toFixed(2).padStart(12)}  ${(kl / rs.length).toFixed(2).padStart(15)}  ${((100 * (l - kl)) / l).toFixed(0).padStart(10)} %`)
  }
  ut.push('')
  ut.push('WASM OVANFÖR DAGENS FÖNSTER (12 lägen, ms per beslut — kostnadsmått)')
  for (let k = 9; k <= 12; k++) {
    const xs = ovan.get(k) ?? []
    if (!xs.length) continue
    ut.push(`${String(k).padStart(4)} kort: median ${f(pct(xs, 50), 5)}  p90 ${f(pct(xs, 90), 5)}  max ${f(Math.max(...xs), 5)}  (${xs.length} beslut)`)
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/betanketid-losare.txt', ut.join('\n') + '\n')
  expect(rader.length).toBeGreaterThan(0)
})
