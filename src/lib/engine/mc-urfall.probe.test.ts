// TILLFÄLLIG UTREDNINGSPROBE (MC-urfallet, speldiagnosen) — spårs EJ i git.
// Replayar en giv exakt som speldiagnos-proben och kollar vid VARJE
// MC-berättigat beslut: hittar sampleLayouts lägen? Om inte — vilken
// modellrestriktion bryter den SANNA dolda handen mot? (Kik är ok HÄR:
// detta är ett dev-verktyg som testar modellens ärlighet, inte botens spel.)
//
// Kör:  MC_URFALL=20260772,20260731 npx vitest run src/lib/engine/mc-urfall.probe.test.ts

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Card, Seat, Suit } from '../../types/bridge'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { botCardSmartReasoned, budstyrtOpeningLead, usesMonteCarlo } from './play-bot'
import { isComplete, playCard, startPlay, type PlayState } from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { botAuction, dealFromSeed } from './revisor'
import { buildHandModel, type HandModel, type SeatConstraint } from './hand-model'
import { applyOpeningLeadSignal, applySignalReads } from './signal-decode'
import { sampleLayouts } from './monte-carlo'
import { shownVoids, visibleSeats } from './card-counting'
import { startingPoints } from './evaluation'
import { hcp, suitHcp } from './hand'

const SEEDS = (process.env.MC_URFALL ?? '').split(',').filter(Boolean).map(Number)
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

function playedBySeat(state: PlayState): Record<Seat, Card[]> {
  const out: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] }
  for (const t of state.completedTricks) for (const pc of t.cards) out[pc.seat].push(pc.card)
  for (const pc of state.currentTrick) out[pc.seat].push(pc.card)
  return out
}

/** Vilka villkor bryter den SANNA handen mot? (spegel av monte-carlo.satisfies) */
function violations(c: SeatConstraint, assigned: Card[], played: Card[]): string[] {
  const out: string[] = []
  const countSuit = (cards: Card[], suit: Suit) => cards.filter((x) => x.suit === suit).length
  for (const s of c.voids) if (countSuit(assigned, s) > 0) out.push(`void ${s} men håller kort`)
  for (const s of SUITS) {
    if (c.voids.has(s)) continue
    const orig = countSuit(assigned, s) + countSuit(played, s)
    if (orig < c.length[s].min || orig > c.length[s].max)
      out.push(`längd ${s}: orig ${orig} utanför [${c.length[s].min},${c.length[s].max}]`)
    const pts = suitHcp(assigned, s) + suitHcp(played, s)
    if (pts < c.suitHcp[s].min || pts > c.suitHcp[s].max)
      out.push(`suitHcp ${s}: ${pts} utanför [${c.suitHcp[s].min},${c.suitHcp[s].max}]`)
  }
  const h = hcp(assigned) + hcp(played)
  if (h < c.hcpMin || h > c.hcpMax) out.push(`hcp: ${h} utanför [${c.hcpMin},${c.hcpMax}]`)
  if (c.minPoints) {
    const tp = startingPoints([...assigned, ...played]).startingPoints
    if (Math.max(h, tp) < c.minPoints) out.push(`poäng: max(${h} hp, ${tp} TP) < ${c.minPoints}`)
  }
  return out
}

it.skipIf(SEEDS.length === 0)('mc-urfall-diagnos', { timeout: 0 }, () => {
  const rader: string[] = []
  const log = (s: string) => rader.push(s)
  for (const seed of SEEDS) {
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)!
    const contract = contractFromCalls(history)!
    log(`\n=== frö ${seed} · ${contract.level}${contract.strain} av ${contract.declarer} ===`)

    let st = startPlay(deal, contract)
    let guard = 0
    while (!isComplete(st) && guard++ < 60) {
      const seat = st.toAct
      if (usesMonteCarlo(st, seat)) {
        const model: HandModel = buildHandModel(history, { voids: shownVoids(st) })
        applyOpeningLeadSignal(model, st, seat, { budstyrt: budstyrtOpeningLead(st, history) })
        applySignalReads(model, st, seat)
        const layouts = sampleLayouts(st, seat, model, 12, undefined, mulberry32(1))
        const trick = st.completedTricks.length + 1
        if (layouts.length === 0) {
          const visible = visibleSeats(st, seat)
          const hidden = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => !visible.includes(s))
          const played = playedBySeat(st)
          const parts = hidden.map((h) => {
            const v = violations(model[h], st.hands[h], played[h])
            return v.length ? `${h}: ${v.join(' · ')}` : `${h}: sann hand OK`
          })
          log(`  stick ${trick}, ${seat} agerar (${st.hands[seat].length} kort): 0 LÄGEN — ${parts.join('  |  ')}`)
        } else {
          log(`  stick ${trick}, ${seat} agerar (${st.hands[seat].length} kort): ${layouts.length} lägen ok`)
        }
      }
      const rng = mulberry32(botDecisionSeed(seed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
      const val = botCardSmartReasoned(st, seat, history, { rng })
      st = playCard(st, val.card)
    }
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/mc-urfall.txt', rader.join('\n'), 'utf8')
})
