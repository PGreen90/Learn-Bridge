// AVVIKELSEDUMPEN (motorbytet etapp 3, docs/motorbyte-plan.md §3): auktionerna
// där MÄNNISKAN avviker från vad motorn själv hade bjudit. Auktionsdumpen
// (auktionsdump.probe.test.ts) täcker bot-mot-bot; den här riggen låter en
// stol bjuda ett godtyckligt bud och låter bottarna spela klart, så att
// diffen mellan två körningar visar hur det NYA lagret svarar när manuset
// aldrig förutsåg budet. Samma JSON-form som auktionsdumpen → samma diff-skript:
//
//   $env:AVVIK='1'; $env:AVVIK_OUT='revisor-output/avvikelsedump-baslinje.json'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
//   $env:AVVIK='1'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
//   node scripts/auktionsdiff.mjs revisor-output/avvikelsedump-baslinje.json revisor-output/avvikelsedump.json revisor-output/avvikelsediff.txt
//
//   $env:AVVIK_RANGE='20270001-20270300'   (standard)
//
// Fyra lägen per giv. Öppningen (familj 1–2): "direkt" (given öppnar ett av 17
// bud) och "3:e hand" (given och nästa stol passar, tredje stolen öppnar →
// svararen är passad hand). Svaret (familj 3): "svar" — boten öppnar som
// vanligt (ostört), människan i svararstolen bjuder vart och ett av
// kontraktsbuden över öppningen upp till 4NT, bottarna spelar klart.
// Svararens andra bud (familj 4b): "svar2" — bottarna bjuder ostört fram till
// svararens ANDRA tur (öppning–P–svar–P–återbud–P), människan bjuder vart och
// ett av de lagliga kontraktsbuden upp till 4NT (+ 5♣/5♦), bottarna spelar
// klart → öppnarens tredje bud ur det nya lagret.
// Nyckeln i dumpen är "<frö>/<läge>/<bud>" (svar2: "<frö>/svar2/<öppning>-<svar>-<återbud>-<bud>").
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Deal } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { auctionComplete, decideCallTraced, legalCalls } from './auction-live'
import { formatHand } from '../felrapport'
import { dealFromSeed } from './revisor'

const RANGE = process.env.AVVIK_RANGE ?? '20270001-20270300'
const OUT = process.env.AVVIK_OUT ?? 'revisor-output/avvikelsedump.json'
const OPENINGS = ['1C', '1D', '1H', '1S', '1NT', '2C', '2D', '2H', '2S', '2NT', '3C', '3D', '3H', '3S', '3NT', '4H', '4S']

interface DumpCall {
  seat: string
  bid: string
  rule: string | null
  källa: string
  explanation: string | null
}

interface DumpDeal {
  seed: string
  dealer: string
  vulnerability: string
  hands: Record<string, string>
  calls: DumpCall[] | null
}

/** Spelar klart auktionen från `start`; buden i `start` utan källa är människans. */
function playOut(deal: Deal, start: DumpCall[], maxCalls = 60): DumpCall[] | null {
  const history: ResolvedCall[] = start.map((c) => ({ seat: c.seat as ResolvedCall['seat'], bid: c.bid as ResolvedCall['bid'], rule: c.rule ?? undefined }))
  const calls = [...start]
  while (!auctionComplete(history)) {
    if (history.length >= maxCalls) return null
    const t = decideCallTraced(deal, history, seatAt(deal.dealer, history.length))
    history.push(t.call)
    const c = t.call as { seat: string; bid: string; rule?: string; explanation?: string }
    calls.push({ seat: c.seat, bid: c.bid, rule: c.rule ?? null, källa: t.källa, explanation: c.explanation ?? null })
  }
  return calls
}

const människan = (seat: string, bid: string): DumpCall => ({ seat, bid, rule: null, källa: 'människan', explanation: null })

it.skipIf(process.env.AVVIK !== '1')('avvikelsedumpen: människan bjuder fritt, bottarna spelar klart', { timeout: 0 }, () => {
  const m = /^(\d+)-(\d+)$/.exec(RANGE)!
  const [från, till] = [Number(m[1]), Number(m[2])]
  const dump: DumpDeal[] = []
  for (let seed = från; seed <= till; seed++) {
    const deal = dealFromSeed(seed)
    const hands = Object.fromEntries((['N', 'E', 'S', 'W'] as const).map((s) => [s, formatHand(deal.hands[s])]))
    const giv = (key: string, calls: DumpCall[] | null): DumpDeal => ({ seed: key, dealer: deal.dealer, vulnerability: deal.vulnerability, hands, calls })
    const d0 = seatAt(deal.dealer, 0)
    const d1 = seatAt(deal.dealer, 1)
    const d2 = seatAt(deal.dealer, 2)
    for (const open of OPENINGS) {
      dump.push(giv(`${seed}/direkt/${open}`, playOut(deal, [människan(d0, open)])))
      dump.push(giv(`${seed}/3:e hand/${open}`, playOut(deal, [människan(d0, 'P'), människan(d1, 'P'), människan(d2, open)])))
    }
    // Svaret: bottarna bjuder fram till svararens tur (ostörd öppning), sedan
    // bjuder människan vart och ett av de lagliga kontraktsbuden upp till 4NT.
    const fram: ResolvedCall[] = []
    while (!auctionComplete(fram) && fram.length < 8) {
      const seat = seatAt(deal.dealer, fram.length)
      const t = decideCallTraced(deal, fram, seat)
      fram.push(t.call)
      const o = fram.findIndex((c) => c.bid !== 'P')
      if (o !== -1 && fram.length === o + 2) {
        if (fram[o + 1].bid !== 'P') break // störd → inte det här läget
        const svarare = seatAt(deal.dealer, fram.length)
        const start: DumpCall[] = fram.map((c) => ({ seat: c.seat, bid: c.bid, rule: c.rule ?? null, källa: 'bot', explanation: c.explanation ?? null }))
        for (const bid of legalCalls(fram, svarare)) {
          if (!/^[1-4](C|D|H|S|NT)$/.test(bid)) continue
          dump.push(giv(`${seed}/svar/${fram[o].bid}-${bid}`, playOut(deal, [...start, människan(svarare, bid)])))
        }
        break
      }
    }
    // Svararens andra bud: bottarna bjuder ostört fram till svararens andra
    // tur (öppning–P–svar–P–återbud–P), sedan bjuder människan vart och ett
    // av de lagliga kontraktsbuden upp till 4NT samt 5♣/5♦.
    const fram2: ResolvedCall[] = []
    while (!auctionComplete(fram2) && fram2.length < 12) {
      const seat = seatAt(deal.dealer, fram2.length)
      fram2.push(decideCallTraced(deal, fram2, seat).call)
      const o = fram2.findIndex((c) => c.bid !== 'P')
      if (o === -1) continue
      const k = fram2.length - o
      if (k === 2 || k === 4 || k === 6) {
        if (fram2[fram2.length - 1].bid !== 'P') break // stört → inte det här läget
      }
      if (k === 3 || k === 5) {
        if (fram2[fram2.length - 1].bid === 'P') break // svararen/öppnaren passade → auktionen dör
      }
      if (k === 6) {
        const svarare = seatAt(deal.dealer, fram2.length)
        const start: DumpCall[] = fram2.map((c) => ({ seat: c.seat, bid: c.bid, rule: c.rule ?? null, källa: 'bot', explanation: c.explanation ?? null }))
        for (const bid of legalCalls(fram2, svarare)) {
          if (!/^([1-4](C|D|H|S|NT)|5[CD])$/.test(bid)) continue
          dump.push(giv(`${seed}/svar2/${fram2[o].bid}-${fram2[o + 2].bid}-${fram2[o + 4].bid}-${bid}`, playOut(deal, [...start, människan(svarare, bid)])))
        }
        break
      }
    }
  }
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync(OUT, JSON.stringify(dump), 'utf8')
})
