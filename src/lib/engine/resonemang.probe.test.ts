// RESONEMANGSLAGRET — proven (steg 1, 2026-09-22, docs/sunt-fornuft-plan.md).
// Kör resonemangslagret på provlägena (pass utan regel ur sunt förnuft-mätningen)
// med olika budgetar och skriver vad det kom fram till + hur stabilt svaret var.
//
//   $env:RESONEMANG='1'; npx vitest run src/lib/engine/resonemang.probe.test.ts
//   $env:RESONEMANG='1'; $env:RESONEMANG_BUDGET='15000'; …
//
// Utdata: revisor-output/resonemang.txt

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { formatHand } from '../felrapport'
import { resonera, kandidatRad } from './resonemang'
import { dealFromSeed } from './revisor'
import { computeOracle, getDds } from './revisor-dds'

const ON = process.env.RESONEMANG === '1'
const BUDGET = Number(process.env.RESONEMANG_BUDGET ?? 15_000)

/** Provlägena: frö, stol, auktionen fram till stolens pass utan regel, ägarens/Claudes förväntan. */
const PROV: [number, Seat, string, string][] = [
  [20290770, 'N', 'S:1C W:X N:XX E:1S S:P W:P', 'ägaren: X (upplysning, partnern ~4♠ 4♣)'],
  [20290220, 'E', 'W:1S N:X E:XX S:2H W:P N:P', 'XX-handen passar ut 2♥?'],
  [20291093, 'S', 'E:P S:P W:P N:1H E:X S:XX W:1S N:P E:P', 'XX-handen passar ut 1♠?'],
  [20290022, 'W', 'S:1S W:X N:2S E:P S:P', 'dubblaren 16 hp i utpassning'],
  [20290227, 'E', 'S:P W:P N:1H E:X S:2H W:P N:P', 'dubblaren 19 hp i utpassning'],
  [20290048, 'W', 'N:P E:P S:1D W:X N:2D E:P S:P', 'dubblaren 14 hp i utpassning'],
  [20290277, 'N', 'E:P S:P W:2H N:X E:P S:2S W:P', 'stark dubblare, solid klöver'],
  [20290030, 'E', 'W:P N:2D E:X S:XX W:3C N:P', 'dubblaren 19 hp, 7 hjärter'],
  [20290085, 'W', 'S:2D W:X N:3D E:4D S:P', 'partnerns cue (krav!)'],
  [20290210, 'N', 'W:3D N:X E:XX S:P W:P', 'dubblaren 17 hp, 6 spader'],
]

it.skipIf(!ON)('resonemangslagret på provlägena', async () => {
  const dds = await getDds()
  const rader: string[] = [`Resonemangslagret — budget ${BUDGET} ms, tidigt stopp vid 2 standardfel`, '']
  for (const [seed, seat, auk, vantat] of PROV) {
    const deal = dealFromSeed(seed)
    const history = auk.split(' ').map((s) => ({ seat: s[0] as Seat, bid: s.slice(2) })) as ResolvedCall[]
    rader.push(`=== ${seed} ${seat} ${formatHand(deal.hands[seat])}  |  ${auk}`)
    rader.push(`    förväntan: ${vantat}`)
    for (const [namn, o] of [['budget', { budgetMs: BUDGET }], ['30 händer', { budgetMs: 600_000, minHands: 30, maxHands: 30 }], ['100 händer', { budgetMs: 600_000, minHands: 100, maxHands: 100 }]] as const) {
      const r = resonera(deal, history, seat, { oracle: (d) => computeOracle(dds, d).solve, ...o, seed: 7 })
      rader.push(`  [${namn.padEnd(10)}] → ${r.val.padEnd(3)}  ${r.hander} händer / ${r.dragningar} dragningar, ${(r.ms / 1000).toFixed(1)} s${r.stoppadeTidigt ? ' (tidigt stopp)' : ''}`)
      rader.push(`      ${kandidatRad(r.kandidater)}`)
      if (namn === 'budget') rader.push(`      ${r.forklaring}`)
    }
    rader.push('')
    mkdirSync('revisor-output', { recursive: true })
    writeFileSync('revisor-output/resonemang.txt', rader.join('\n'))
  }
}, 3_600_000)
