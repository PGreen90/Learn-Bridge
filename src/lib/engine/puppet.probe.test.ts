// PUPPET-SONDEN — hälsokoll av Puppet Stayman i volym (2026-09-15). Körs
// ALDRIG i `npm test` (skipIf), bara på begäran:
//
//   Bash:        PUPPET=1 npx vitest run src/lib/engine/puppet.probe.test.ts
//   PowerShell:  $env:PUPPET='1'; npx vitest run src/lib/engine/puppet.probe.test.ts
//
// Läge A (standard): skannar frön från PUPPET_SEED (20260915) tills PUPPET_N
// (300) givar hittats där någon sida bjuder 2NT och partnern svarar 3♣
// (2NT-öppning, 2♣–2♦–2NT eller 2NT-inkliv). Varje träff döms mot DD-facit
// (bridge-dds, samma dom som systemrevisorn: `judgeDeal`) och alla träffar
// sparas med händer/auktion/kategori i revisor-output/puppet-sond.json;
// fröna i revisor-output/puppet-seeds.json; läsbar rapport i
// revisor-output/puppet-rapport.txt.
//
// Läge B (PUPPET_SEEDS=<fil>): bjuder exakt fröna i filen — så samma givar kan
// bjudas med en ÄLDRE kod (git worktree) och jämföras: samma giv, gammal
// Stayman mot Puppet. PUPPET_OUT styr filnamnet (standard puppet-sond).

import { it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { handToNotation } from './hand'
import { botAuction, CATEGORY_LABEL, dealFromSeed, judgeDeal, type DealVerdict, type MissCategory } from './revisor'
import { computeOracle, getDds } from './revisor-dds'

const SEED = Number(process.env.PUPPET_SEED ?? 20260915)
const N = Number(process.env.PUPPET_N ?? 300)
const SCAN = Number(process.env.PUPPET_SCAN ?? 20000)
const OUT = process.env.PUPPET_OUT ?? 'puppet-sond'

type Kind = 'öppning' | '2♣-återbud' | 'inkliv' | 'ej Puppet'

/** Index i auktionen där 2NT följs av partnerns 3♣ (mellan: pass), och vilken sorts 2NT det var. */
function puppetSequence(history: ResolvedCall[]): { at: number; kind: Kind } | null {
  for (let i = 0; i + 2 < history.length; i++) {
    if (history[i].bid !== '2NT' || history[i + 1].bid !== 'P' || history[i + 2].bid !== '3C') continue
    const earlier = history.slice(0, i).filter((c) => c.bid !== 'P')
    const seat = history[i].seat
    const same = (a: Seat, b: Seat) => (a === 'N' || a === 'S') === (b === 'N' || b === 'S')
    // Bara de tre Puppet-lägena: 2NT-öppning, 2♣–2♦–2NT och det DIREKTA 2NT-inklivet
    // över deras öppning. Andra 2NT (1x–1y–2NT-checkback, balansering …) räknas inte.
    if (earlier.length === 0) return { at: i, kind: 'öppning' }
    if (earlier.length === 2 && earlier[0].seat === seat && earlier[0].bid === '2C' && earlier[1].bid === '2D') return { at: i, kind: '2♣-återbud' }
    if (earlier.length === 1 && !same(earlier[0].seat, seat) && /^[23][DHS]$|^3C$/.test(earlier[0].bid)) return { at: i, kind: 'inkliv' }
    return null
  }
  return null
}

interface Hit {
  seed: number
  kind: Kind
  dealer: Seat
  vulnerability: Deal['vulnerability']
  hands: Record<Seat, string>
  auction: string[]
  contract: string
  category: MissCategory
  loss: number
  achievedNS: number
  parNS: number
}

function hitOf(seed: number, deal: Deal, kind: Kind, v: DealVerdict): Hit {
  const hands = {} as Record<Seat, string>
  for (const s of ['N', 'E', 'S', 'W'] as Seat[]) hands[s] = handToNotation(deal.hands[s])
  const c = v.contract
  return {
    seed, kind, dealer: deal.dealer, vulnerability: deal.vulnerability, hands,
    auction: v.auction,
    contract: c ? `${c.level}${c.strain}${c.doubled === 'X' ? 'X' : c.doubled === 'XX' ? 'XX' : ''} av ${c.declarer}` : 'utpassad',
    category: v.category, loss: v.loss, achievedNS: v.achievedNS, parNS: v.optimumNS,
  }
}

it.skipIf(!process.env.PUPPET)(
  `Puppet-sonden: ${process.env.PUPPET_SEEDS ? 'läge B (givna frön)' : `läge A (${N} träffar från frö ${SEED})`}`,
  { timeout: 0 },
  async () => {
    const dds = await getDds()
    const dir = join(process.cwd(), 'revisor-output')
    mkdirSync(dir, { recursive: true })
    const hits: Hit[] = []
    let scanned = 0
    let skippedAuction = 0
    let skippedSolver = 0
    let noPuppet = 0

    const judge = (seed: number): void => {
      const deal = dealFromSeed(seed)
      const history = botAuction(deal)
      if (!history) { skippedAuction++; return }
      const seq = puppetSequence(history)
      // Läge B dömer ALLA givna frön (även när den äldre koden inte gick via 3♣) —
      // annars jämförs olika givmängder.
      if (!seq && !process.env.PUPPET_SEEDS) { noPuppet++; return }
      const { solve, parNS } = computeOracle(dds, deal)
      const v = judgeDeal(deal, history, solve, seed, parNS)
      if (!v) { skippedSolver++; return }
      hits.push(hitOf(seed, deal, seq?.kind ?? 'ej Puppet', v))
    }

    if (process.env.PUPPET_SEEDS) {
      const seeds: number[] = JSON.parse(readFileSync(process.env.PUPPET_SEEDS, 'utf8'))
      for (const seed of seeds) { scanned++; judge(seed) }
    } else {
      for (let i = 0; i < SCAN && hits.length < N; i++) { scanned++; judge(SEED + i) }
      writeFileSync(join(dir, 'puppet-seeds.json'), JSON.stringify(hits.map((h) => h.seed)), 'utf8')
    }

    // Rapport.
    const byCat = new Map<MissCategory, { n: number; loss: number }>()
    const byKind = new Map<Kind, { n: number; loss: number; right: number }>()
    let totalLoss = 0
    let right = 0
    for (const h of hits) {
      totalLoss += h.loss
      if (h.loss === 0) right++
      const c = byCat.get(h.category) ?? { n: 0, loss: 0 }
      c.n++; c.loss += h.loss; byCat.set(h.category, c)
      const k = byKind.get(h.kind) ?? { n: 0, loss: 0, right: 0 }
      k.n++; k.loss += h.loss; if (h.loss === 0) k.right++; byKind.set(h.kind, k)
    }
    const lines: string[] = []
    lines.push(`PUPPET-SONDEN ${new Date().toISOString().slice(0, 16)} — ${process.env.PUPPET_SEEDS ? 'läge B' : `läge A, frö ${SEED}`}`)
    lines.push(`skannade ${scanned} givar · träffar (2NT–P–3♣) ${hits.length} · utan Puppet ${noPuppet} · oavslutad auktion ${skippedAuction} · DD-miss ${skippedSolver}`)
    lines.push(`rätt kontrakt (par): ${right}/${hits.length} = ${hits.length ? ((100 * right) / hits.length).toFixed(1) : '–'} % · snittförlust ${hits.length ? (totalLoss / hits.length).toFixed(1) : '–'} p/giv`)
    lines.push('')
    lines.push('Per sorts 2NT:')
    for (const [kind, k] of byKind) lines.push(`  ${kind.padEnd(12)} n=${k.n}  rätt ${k.right}  snittförlust ${(k.loss / k.n).toFixed(1)}`)
    lines.push('')
    lines.push('Misstyper (sorterade på total förlust):')
    for (const [cat, c] of [...byCat.entries()].sort((a, b) => b[1].loss - a[1].loss)) {
      lines.push(`  ${CATEGORY_LABEL[cat].padEnd(28)} ${String(c.n).padStart(4)} givar  ${String(c.loss).padStart(7)} p  (snitt ${(c.loss / c.n).toFixed(0)})`)
    }
    lines.push('')
    lines.push('Dyraste 25 träffarna:')
    for (const h of [...hits].sort((a, b) => b.loss - a.loss).slice(0, 25)) {
      lines.push(`  frö ${h.seed} [${h.kind}] ${CATEGORY_LABEL[h.category]} −${h.loss}: ${h.auction.join(' ')} → ${h.contract} (par NS ${h.parNS}, nått ${h.achievedNS})`)
      lines.push(`      N ${h.hands.N} | S ${h.hands.S} | E ${h.hands.E} | W ${h.hands.W}`)
    }
    writeFileSync(join(dir, `${OUT}-rapport.txt`), lines.join('\n'), 'utf8')
    writeFileSync(join(dir, `${OUT}.json`), JSON.stringify({ seed: SEED, scanned, hits }, null, 2), 'utf8')
    console.log(lines.join('\n'))
  },
)
