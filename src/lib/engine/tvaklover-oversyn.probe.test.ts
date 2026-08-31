// 2♣-ÖVERSYN — mätsond (steg 1, SLUTKANDIDATEN). Källförankrad regel
// (K. Walker/bridgebum/Lawrence + ägarens fixpunkter 2026-08-26):
//
//   En distributionell 2♣ (hp<22) STÅR KVAR om
//     A) färgmodulerade spelstick:  ≥9 (längsta färg HÖG) / ≥9½ (LÅG),  ELLER
//     B) substans-valven:           quick tricks ≥ 4  (Walker "helst 4";
//                                    räddar honnörs-/esstunga händer som
//                                    faller på sticken, t.ex. frö 20261050)
//   Annars → 1-öppning.
//
// Quick tricks (spelfasta stick): AK=2, AQ=1½, A=1, KQ=1, Kx=½ per färg.
// Förlorare (LTC, rapporteras som jämförelse): topp-min(len,3), A/K/Q som täcks.
//
//   npx vitest run src/lib/engine/tvaklover-oversyn.probe.test.ts
//
// Utdata: revisor-output/tvaklover-oversyn.txt  (+ .json exempelfrön)
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dealFromSeed } from './revisor'
import { classifyOpening } from './openings'
import { playingTricks } from './evaluation'
import { hcp, lengths } from './hand'
import { formatHand } from '../felrapport'
import type { Hand, Rank, Suit } from '../../types/bridge'

const SEED_BASE = 20260000
const DEALS = 20000

const THRESH_MAJOR = 9
const THRESH_MINOR = 9.5
const QT_VALVE = 4

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

function ranksOf(h: Hand, s: Suit): Rank[] {
  return h.filter((c) => c.suit === s).map((c) => c.rank)
}

/** Spelfasta stick (quick tricks) per hand. */
function quickTricks(h: Hand): number {
  let qt = 0
  for (const s of SUITS) {
    const r = ranksOf(h, s)
    const A = r.includes('A'), K = r.includes('K'), Q = r.includes('Q')
    if (A && K) qt += 2
    else if (A && Q) qt += 1.5
    else if (A) qt += 1
    else if (K && Q) qt += 1
    else if (K && r.length >= 2) qt += 0.5
  }
  return qt
}

/** Förlorare (klassisk LTC): per färg topp-min(len,3); A/K/Q räknas som täckare. */
function losers(h: Hand): number {
  let l = 0
  for (const s of SUITS) {
    const r = ranksOf(h, s)
    const n = Math.min(r.length, 3)
    if (n === 0) continue
    const A = r.includes('A'), K = r.includes('K'), Q = r.includes('Q')
    let covers = 0
    if (A) covers++
    if (K && n >= 2) covers++
    if (Q && n >= 3) covers++
    l += n - covers
  }
  return l
}

const longestSuit = (h: Hand): Suit => {
  const l = lengths(h)
  return (['hearts', 'spades', 'diamonds', 'clubs'] as const).reduce((a, b) => (l[b] > l[a] ? b : a))
}
const suitSym: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

type Row = {
  hand: Hand; seed: number; seat: string
  p: number; pt: number; qt: number; ltc: number
  longSuit: Suit; isMajor: boolean
}

// Mätsonden körs bara på begäran (som auktionsdumpen — inte i deploygrinden):
//   $env:TVAKLOVER='1'; npx vitest run src/lib/engine/tvaklover-oversyn.probe.test.ts
it.skipIf(!process.env.TVAKLOVER)('2♣-översyn: slutkandidaten (stick 9/9½ ELLER QT≥4) — 20 000 givar', () => {
  const distr: Row[] = []
  let opens2C = 0
  let strong = 0
  for (let i = 0; i < DEALS; i++) {
    const deal = dealFromSeed(SEED_BASE + i)
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      const hand = deal.hands[seat]
      if (classifyOpening(hand).call !== '2C') continue
      opens2C++
      const p = hcp(hand)
      if (p >= 22) { strong++; continue }
      const ls = longestSuit(hand)
      distr.push({
        hand, seed: SEED_BASE + i, seat, p,
        pt: playingTricks(hand), qt: quickTricks(hand), ltc: losers(hand),
        longSuit: ls, isMajor: ls === 'spades' || ls === 'hearts',
      })
    }
  }

  const passTrick = (r: Row) => r.pt >= (r.isMajor ? THRESH_MAJOR : THRESH_MINOR)
  const passValve = (r: Row) => r.qt >= QT_VALVE
  const keeps = (r: Row) => passTrick(r) || passValve(r)

  const keep = distr.filter(keeps)
  const flip = distr.filter((r) => !keeps(r))
  const valveOnly = distr.filter((r) => !passTrick(r) && passValve(r))

  // VARIANT B (Walkers QT-minimum): stick-vägen kräver dessutom QT ≥ 3 —
  // stoppar spärrtypshänder (9 hp, 9-korts färg, 2 QT) från att öppna 2♣.
  const keepsB = (r: Row) => (passTrick(r) && r.qt >= 3) || passValve(r)
  const keepB = distr.filter(keepsB)
  const flipB = distr.filter((r) => !keepsB(r))
  const preemptStopped = distr.filter((r) => keeps(r) && !keepsB(r))

  const out: string[] = []
  const push = (s = '') => out.push(s)
  const pct = (n: number, d: number) => (d === 0 ? '0 %' : `${((100 * n) / d).toFixed(1)} %`)

  push(`=== 2♣-ÖVERSYN — SLUTKANDIDAT (frö ${SEED_BASE}–${SEED_BASE + DEALS - 1}) ===`)
  push(`Regel: distributionell 2♣ står kvar om stick ≥${THRESH_MAJOR}(hög)/${THRESH_MINOR}(låg) ELLER quick tricks ≥${QT_VALVE}`)
  push('')
  push(`2♣ totalt: ${opens2C}  (stark 22+: ${strong} — RÖRS EJ, distributionell: ${distr.length})`)
  push(`  STÅR KVAR: ${keep.length}  (${pct(keep.length, distr.length)})   — varav via valven enbart: ${valveOnly.length}`)
  push(`  FLIPPAR:   ${flip.length}  (${pct(flip.length, distr.length)})`)
  push(`  Netto 2♣-frekvens: ${opens2C} → ${opens2C - flip.length} = ${pct(opens2C - flip.length, DEALS * 4)} av alla händer (idag ${pct(opens2C, DEALS * 4)}; verkligheten ~1 %)`)
  push('')

  push('--- VARIANT B: stick-vägen kräver dessutom QT ≥ 3 (Walkers minimum) ---')
  push(`  STÅR KVAR: ${keepB.length}  (${pct(keepB.length, distr.length)})   FLIPPAR: ${flipB.length}`)
  push(`  Netto: ${opens2C} → ${opens2C - flipB.length} = ${pct(opens2C - flipB.length, DEALS * 4)} av alla händer`)
  push(`  Spärrtypshänder som B stoppar (stod kvar i A): ${preemptStopped.length} st — exempel:`)
  for (const r of preemptStopped.slice(0, 6)) {
    push(`    frö ${r.seed} ${r.seat}: ${formatHand(r.hand)}  (${r.p} hp, ${r.pt} stick, ${r.qt} QT)`)
  }
  push('')

  push('--- Flippade: hp-fördelning (sanity: tyngdpunkt ska ligga lågt) ---')
  const bands: [string, (p: number) => boolean][] = [
    ['≤13', (p) => p <= 13], ['14–15', (p) => p >= 14 && p <= 15],
    ['16–17', (p) => p >= 16 && p <= 17], ['18–19', (p) => p >= 18 && p <= 19],
    ['20–21', (p) => p >= 20 && p <= 21],
  ]
  for (const [label, t] of bands) {
    const n = flip.filter((r) => t(r.p)).length
    push(`  ${label.padEnd(7)} ${String(n).padStart(4)}  (${pct(n, flip.length)})`)
  }
  push('')

  push('--- Ägarens fixpunkter ---')
  const anchor = (seed: number, seat: string, want: 'KVAR' | 'FLIP') => {
    const r = distr.find((x) => x.seed === seed && x.seat === seat)
    if (!r) return push(`  frö ${seed} ${seat}: (ej distributionell 2♣ — kolla)`)
    const got = keeps(r) ? 'KVAR' : 'FLIP'
    push(`  frö ${seed} ${seat}: ${formatHand(r.hand)}  (${r.p} hp, ${r.pt} stick, ${r.qt} QT, ${r.ltc} förl) → ${got} ${got === want ? '✓' : '✗ FEL'}`)
  }
  anchor(20261050, 'S', 'KVAR') // 21 hp, tre ess — "verkligen en 2♣"
  anchor(20260220, 'S', 'FLIP') // 13 hp 6-5 — "1-läget"
  anchor(20260474, 'S', 'KVAR') // 19 hp fyra ess — räddas av valven
  push('')

  const exJson: unknown[] = []
  const dump = (title: string, rows: Row[], n = 10) => {
    push(`--- ${title} (${rows.length} st) ---`)
    for (const r of rows.slice(0, n)) {
      push(`  frö ${r.seed} ${r.seat}: ${formatHand(r.hand)}  (${r.p} hp, ${r.pt} stick, ${r.qt} QT, ${suitSym[r.longSuit]}-lång)`)
      exJson.push({ seed: r.seed, seat: r.seat, hand: formatHand(r.hand), hp: r.p, pt: r.pt, qt: r.qt })
    }
    push('')
  }
  // De viktigaste att SYNA: högst hp bland flipparna (risk för underbud) och
  // lägst hp bland kvarvarande (risk för överbud).
  dump('SYNA: STARKASTE som FLIPPAR (underbud-risk?)', [...flip].sort((a, b) => b.p - a.p))
  dump('SYNA: SVAGASTE som STÅR KVAR (överbud-risk?)', [...keep].sort((a, b) => a.p - b.p))
  dump('Valve-räddade (faller på stick, QT≥4 håller kvar dem)', valveOnly)

  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/tvaklover-oversyn.txt', out.join('\n'), 'utf8')
  writeFileSync('revisor-output/tvaklover-oversyn.json', JSON.stringify({ examples: exJson }, null, 2), 'utf8')
})
