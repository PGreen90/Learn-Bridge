// FYND B-RIGGEN — spelförarsidans LEDNINGSVAL i tumregel-fönstret (9–13 kort),
// DD-mätt per alternativ (speldiagnosen runda 7, 2026-10-01; S6-lärdomen: mät
// alternativen FÖRE bygge). Varje gång spelförarsidan är inne (på lead, inte
// öppningsutspelet, över Monte-Carlo-fönstret) jämförs botens kort mot DD-poängen
// för VARJE lagligt kort (`solveAllCards`, bridge-dds). Rapporten grupperar
// kostnaden per SKÄL (tumregeln som valde kortet) och per "bästa färg enligt DD
// vs vald färg", så att man ser VILKEN regel som läcker stick och om det är
// färgvalet eller kortet i färgen som är fel. Samma deterministiska linje som
// speldiagnosen (spelaMedFro med playSeed = fröet).
//
//   Bash: FYNDB=1 FYNDB_DEALS=50 FYNDB_OFFSET=<0|50|100|150> FYNDB_OUT=fyndb-<a|b|c|d>.json npx vitest run src/lib/engine/fyndb.probe.test.ts
//   Enskilda frön: FYNDB=20260836,20260852 npx vitest run src/lib/engine/fyndb.probe.test.ts
//
// Utdata: revisor-output/<FYNDB_OUT> (JSON) + revisor-output/fyndb.txt (läsbar).

import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Card, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { isComplete, legalCards, playCard, startPlay, type PlayState } from './play'
import { side } from './play'
import { botDecisionSeed, playIndexOf } from './play-seed'
import { botAuction, dealFromSeed } from './revisor'
import { getDds, solveAllCards } from './revisor-dds'

const ON = process.env.FYNDB
const SEED = 20260721
const DEALS = Number(process.env.FYNDB_DEALS ?? 200)
const OFFSET = Number(process.env.FYNDB_OFFSET ?? 0)
const OUT = process.env.FYNDB_OUT ?? 'fyndb.json'
const SYM: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const kortText = (c: Card) => `${SYM[c.suit]}${c.rank === '10' ? 'T' : c.rank}`

interface Lage {
  seed: number
  kontrakt: string
  seat: Seat
  trick: number
  kortKvar: number
  valt: string
  skal: string
  kostnad: number
  /** Bästa DD-poäng per färg (för att se om FÄRGVALET eller kortet var fel). */
  perFarg: Record<string, number>
  bastaFarg: string
  valdFarg: string
  /** Hela ställningen + DD-poäng per lagligt kort — för offline-utvärdering av kandidatregler (fyndb-utvardera.probe.test.ts). */
  state: PlayState
  poang: { card: Card; score: number }[]
  calls: ResolvedCall[]
}

const skalNyckel = (reason: string): string => {
  if (reason.includes('drar trumf')) return 'drar trumf'
  if (reason.includes('cashar en säker vinnare')) return 'cashar säker vinnare'
  if (reason.includes('Spelförarplan (felrapport #32)')) return 'plan #32 etablera'
  if (reason.includes('felrapport #49')) return 'solid sekvens (#49)'
  if (reason.includes('längsta färg')) return 'längsta färg (reserv)'
  if (reason.includes('leder INTE trumf')) return 'undviker trumfgaffel'
  if (reason.includes('Bot-hjärnan')) return 'monte-carlo'
  return reason.slice(0, 40)
}

it.skipIf(!ON)(
  `fynd B-riggen: spelförarsidans ledningsval, ${ON && /^\d{8}(,\d{8})*$/.test(ON) ? 'frön ' + ON : DEALS + ' givar'}`,
  async () => {
    const dds = await getDds()
    const seeds = ON && /^\d{8}(,\d{8})*$/.test(ON) ? ON.split(',').map(Number) : Array.from({ length: DEALS }, (_, i) => SEED + OFFSET + i)
    const lagen: Lage[] = []
    for (const seed of seeds) {
      const deal = dealFromSeed(seed)
      const history = botAuction(deal)
      if (!history) continue
      const contract = contractFromCalls(history)
      if (!contract) continue
      let st: PlayState = startPlay(deal, contract)
      let guard = 0
      while (!isComplete(st) && guard++ < 60) {
        const seat = st.toAct
        const rng = mulberry32(botDecisionSeed(seed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
        const val = botCardSmartReasoned(st, seat, history, { rng })
        const declSide = side(seat) === side(contract.declarer)
        const paLead = st.currentTrick.length === 0 && st.completedTricks.length > 0
        if (declSide && paLead && st.hands[seat].length > 8 && legalCards(st, seat).length > 1) {
          const poang = solveAllCards(dds, st)
          const best = Math.max(...poang.map((p) => p.score))
          const mitt = poang.find((p) => p.card.suit === val.card.suit && p.card.rank === val.card.rank)
          const perFarg: Record<string, number> = {}
          for (const p of poang) perFarg[p.card.suit] = Math.max(perFarg[p.card.suit] ?? -1, p.score)
          const bastaFarg = Object.entries(perFarg).sort((a, b) => b[1] - a[1])[0][0]
          lagen.push({
            seed, kontrakt: `${contract.level}${contract.strain === 'NT' ? 'NT' : SYM[contract.strain]} av ${contract.declarer}`, seat,
            trick: st.completedTricks.length + 1, kortKvar: st.hands[seat].length,
            valt: kortText(val.card), skal: skalNyckel(val.reason), kostnad: mitt ? best - mitt.score : 0,
            perFarg, bastaFarg, valdFarg: val.card.suit,
            state: st, poang, calls: history,
          })
        }
        st = playCard(st, val.card)
      }
    }
    // ---- Aggregat ---------------------------------------------------------
    const grupp = new Map<string, { n: number; fel: number; kostnad: number; fargfel: number }>()
    for (const l of lagen) {
      const g = grupp.get(l.skal) ?? { n: 0, fel: 0, kostnad: 0, fargfel: 0 }
      g.n++
      if (l.kostnad > 0) { g.fel++; g.kostnad += l.kostnad; if (l.bastaFarg !== l.valdFarg && l.perFarg[l.valdFarg] < l.perFarg[l.bastaFarg]) g.fargfel++ }
      grupp.set(l.skal, g)
    }
    const rader: string[] = []
    rader.push(`FYND B — spelförarsidans ledningsval i tumregel-fönstret (9–13 kort), ${seeds.length} givar, ${lagen.length} lägen`)
    rader.push(`skäl                         lägen   fel   kostnad(stick)   varav FEL FÄRG`)
    for (const [k, g] of [...grupp.entries()].sort((a, b) => b[1].kostnad - a[1].kostnad)) {
      rader.push(`${k.padEnd(28)} ${String(g.n).padStart(5)} ${String(g.fel).padStart(5)} ${String(g.kostnad).padStart(12)} ${String(g.fargfel).padStart(16)}`)
    }
    rader.push('')
    rader.push('VÄRSTA LÄGEN (kostnad ≥ 2):')
    for (const l of [...lagen].filter((l) => l.kostnad >= 2).sort((a, b) => b.kostnad - a.kostnad)) {
      const farger = Object.entries(l.perFarg).map(([s, v]) => `${SYM[s]}${v}`).join(' ')
      rader.push(`  ${l.seed} ${l.kontrakt} stick ${l.trick} ${l.seat} (${l.kortKvar} kort): valde ${l.valt} [${l.skal}] kostnad ${l.kostnad} · bästa per färg: ${farger}`)
    }
    mkdirSync('revisor-output', { recursive: true })
    writeFileSync(join('revisor-output', OUT), JSON.stringify({ seeds: seeds.length, lagen }))
    writeFileSync(join('revisor-output', OUT.replace(/\.json$/, '.txt')), rader.join('\n') + '\n')
    console.log(rader.slice(0, 12).join('\n'))
  },
  60 * 60 * 1000,
)
