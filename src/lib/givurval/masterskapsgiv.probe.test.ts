// MÄSTERSKAPSGIV-PROBEN (testbygge 2026-11-11) — mäter om poängsättaren i
// masterskapsgiv.ts faktiskt väljer intressantare givar än slumpen.
// Körs ALDRIG i vanliga `npm test`/deploygrinden (skipIf), bara på begäran:
//
//   PowerShell:  $env:MASTERSKAP='1'; npx vitest run src/lib/givurval/masterskapsgiv.probe.test.ts
//   Bash:        MASTERSKAP=1 npx vitest run src/lib/givurval/masterskapsgiv.probe.test.ts
//
// Rattar: MASTERSKAP_N (antal kandidatgivar, standard 2400 = 200 per bricka) ·
// MASTERSKAP_FRO (frö, standard 20261111).
//
// Per kandidat: bottarna bjuder given (simulateAuction), DD-oraklet (bridge-dds,
// WASM) ger 20-tabellen + par, poängsättaren ger talet. Sedan väljs 12 givar.
// Att titta på alla händer + DD här är INTE kik — se filhuvudet i masterskapsgiv.ts.
//
// Utdata: revisor-output/masterskapsgiv.txt + .json (gitignorad mapp).
//
// DD-CACHE: double-dummy är den dyra delen (se TID i rapporten). Tabellerna
// sparas därför i revisor-output/masterskapsgiv-dd-<frö>.json och återanvänds
// nästa körning — så vikter och urvalsregel kan trimmas om på sekunder. Cachen
// innehåller bara DD-tabell + par per kandidatnummer; given, auktionen och
// poängen räknas alltid om. Radera filen för att mäta DD-tiden på nytt.

import { expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Deal, Seat } from '../../types/bridge'
import { formatHand } from '../felrapport'
import { simulateAuction } from '../engine/contract-target'
import { mulberry32 } from '../engine/deal'
import type { Strain } from '../engine/play'
import { computeOracle, getDds } from '../engine/revisor-dds'
import {
  kandidatGiv,
  kontraktText,
  poangsattGiv,
  SIGNAL_ETIKETT,
  STANDARDREGEL,
  summakoll,
  TYP_ETIKETT,
  valjTavling,
  VIKTER,
  VILD_GRANS,
  vildhetSumma,
  type DdTabell,
  type GivTyp,
  type Kandidat,
  type SignalId,
} from './masterskapsgiv'

const PA = process.env.MASTERSKAP === '1'
const N = Number(process.env.MASTERSKAP_N ?? 2400)
const FRO = Number(process.env.MASTERSKAP_FRO ?? 20261111)

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const STRAINS: Strain[] = ['spades', 'hearts', 'diamonds', 'clubs', 'NT']
const SIGNALER = Object.keys(VIKTER) as SignalId[]
const SATE: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }
const ZON: Record<Deal['vulnerability'], string> = { none: 'ingen', ns: 'N/S', ew: 'Ö/V', all: 'alla' }

const tal = (x: number, d = 1) => x.toFixed(d).replace('.', ',')
const snitt = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

interface Rad extends Kandidat {
  dd: DdTabell
  parNS: number
  parKontrakt: string[]
  auktion: string
}

it.skipIf(!PA)('mästerskapsgivar: poängfördelning + urval', { timeout: 0 }, async () => {
  expect(N).toBeGreaterThanOrEqual(STANDARDREGEL.brickor)
  const dds = await getDds()
  const katalog = join(process.cwd(), 'revisor-output')
  mkdirSync(katalog, { recursive: true })
  const cacheFil = join(katalog, `masterskapsgiv-dd-${FRO}.json`)
  interface CachePost {
    dd: DdTabell
    parNS: number
    parKontrakt: string[]
  }
  const cache: { msDd: number; antalMatta: number; givar: Record<number, CachePost> } = existsSync(cacheFil)
    ? JSON.parse(readFileSync(cacheFil, 'utf8'))
    : { msDd: 0, antalMatta: 0, givar: {} }
  let urCache = 0

  // ---------- 1. Poängsätt alla kandidater ----------
  const rader: Rad[] = []
  let msAuktion = 0
  let msPoang = 0
  const start = performance.now()
  for (let i = 0; i < N; i++) {
    const deal = kandidatGiv(FRO, i)
    expect(summakoll(deal).ok, `kandidat ${i}: summakoll (13 kort/hand, 40 hp)`).toBe(true)

    let t = performance.now()
    const calls = simulateAuction(deal)
    msAuktion += performance.now() - t

    let post = cache.givar[i]
    if (post) urCache++
    else {
      t = performance.now()
      const oracle = computeOracle(dds, deal)
      const tabell = Object.fromEntries(
        SEATS.map((s) => [s, Object.fromEntries(STRAINS.map((st) => [st, oracle.solve(s, st) ?? 0]))]),
      ) as DdTabell
      post = cache.givar[i] = { dd: tabell, parNS: oracle.parNS, parKontrakt: oracle.parContracts }
      cache.msDd += performance.now() - t
      cache.antalMatta++
    }
    const { dd } = post

    t = performance.now()
    const poang = poangsattGiv({ deal, dd, parNS: post.parNS, auktion: calls })
    msPoang += performance.now() - t

    rader.push({
      index: i,
      deal,
      poang,
      dd,
      parNS: post.parNS,
      parKontrakt: post.parKontrakt,
      auktion: calls.map((c) => c.bid).join(' '),
    })
  }
  const msKorning = performance.now() - start
  if (urCache < N) writeFileSync(cacheFil, JSON.stringify(cache), 'utf8')
  // DD-tiden är den UPPMÄTTA per löst giv (även när körningen läste ur cachen).
  const msDd = cache.antalMatta ? cache.msDd / cache.antalMatta : 0
  const msPerGiv = msAuktion / N + msDd + msPoang / N

  // ---------- 2. Välj tävlingen + en slumpad jämförelse ----------
  const t0 = performance.now()
  const valda = valjTavling(rader) as Rad[]
  const msUrval = performance.now() - t0
  expect(valda).toHaveLength(STANDARDREGEL.brickor)

  // Slumpad tolva: EN slumpvald kandidat per bricka (fast frö → samma varje gång).
  const rng = mulberry32(FRO ^ 0x5eed)
  const slump: Rad[] = []
  for (let board = 1; board <= STANDARDREGEL.brickor; board++) {
    const pool = rader.filter((r) => r.deal.board === board)
    slump.push(pool[Math.floor(rng() * pool.length)])
  }

  // ---------- 3. Rapporten ----------
  const ut: string[] = []
  ut.push(`=== MÄSTERSKAPSVÄRDA GIVAR — testbygge (frö ${FRO}, ${N} kandidater) ===`)
  ut.push('')
  ut.push('TID')
  ut.push(`  ${tal(msPerGiv)} ms per giv = ${tal((msPerGiv * N) / 60000)} min för ${N} givar på en kärna`)
  ut.push(`  varav auktion ${tal(msAuktion / N, 2)} ms · double-dummy ${tal(msDd, 2)} ms · poängsättning ${tal(msPoang / N, 3)} ms`)
  ut.push(`  (den här körningen: ${tal(msKorning / 1000)} s, ${urCache} av ${N} DD-tabeller ur cachen)`)
  ut.push(`  urvalet av 12 ur ${N}: ${tal(msUrval, 1)} ms`)
  ut.push('')

  const totaler = rader.map((r) => r.poang.total).sort((a, b) => a - b)
  const pct = (p: number) => totaler[Math.min(totaler.length - 1, Math.floor((p / 100) * totaler.length))]
  ut.push('POÄNGFÖRDELNING (0–100) över alla kandidater')
  ut.push(`  snitt ${tal(snitt(totaler))} · min ${tal(totaler[0])} · median ${tal(pct(50))} · p75 ${tal(pct(75))} · p90 ${tal(pct(90))} · p99 ${tal(pct(99))} · max ${tal(totaler[totaler.length - 1])}`)
  for (let lo = 0; lo < 100; lo += 10) {
    const n = totaler.filter((x) => x >= lo && (x < lo + 10 || (lo === 90 && x <= 100))).length
    ut.push(`  ${String(lo).padStart(2)}–${String(lo + 10).padEnd(3)} ${String(n).padStart(5)}  ${'#'.repeat(Math.round((n / N) * 100))}`)
  }
  ut.push('')

  const typer = Object.keys(TYP_ETIKETT) as GivTyp[]
  ut.push('GIVTYPER (andel av alla kandidater · antal bland de valda)')
  for (const typ of typer) {
    const n = rader.filter((r) => r.poang.typ === typ).length
    const v = valda.filter((r) => r.poang.typ === typ).length
    ut.push(`  ${TYP_ETIKETT[typ].padEnd(40)} ${tal((n / N) * 100).padStart(5)} %   valda ${v}`)
  }
  ut.push('')

  const varde = (r: Rad, s: SignalId) => r.poang.delar.find((d) => d.signal === s)!.varde
  const kol = (grupp: Rad[], s: SignalId) =>
    `${tal(snitt(grupp.map((r) => varde(r, s))), 2)} (${String(grupp.filter((r) => varde(r, s) > 0).length).padStart(grupp.length > 99 ? 4 : 2)} st)`
  ut.push('PER SIGNAL: snittvärde 0–1 (antal givar där signalen slog till)')
  ut.push(`  ${'signal'.padEnd(40)} ${'alla ' + N}`.padEnd(60) + 'slumpade 12'.padEnd(18) + 'valda 12')
  for (const s of SIGNALER) {
    ut.push(`  ${SIGNAL_ETIKETT[s].padEnd(40)} ${kol(rader, s).padEnd(18)} ${kol(slump, s).padEnd(17)} ${kol(valda, s)}`)
  }
  ut.push(
    `  ${'TOTALPOÄNG (snitt)'.padEnd(40)} ${tal(snitt(rader.map((r) => r.poang.total))).padEnd(18)} ${tal(snitt(slump.map((r) => r.poang.total))).padEnd(17)} ${tal(snitt(valda.map((r) => r.poang.total)))}`,
  )
  ut.push('')

  const hpNS = (r: Rad) => summakoll(r.deal).hp.N + summakoll(r.deal).hp.S
  const utpassade = (g: Rad[]) => g.filter((r) => !r.poang.botKontrakt).length
  ut.push('ÖVRIGT')
  ut.push(`  N/S-hp i snitt: alla ${tal(snitt(rader.map(hpNS)))} · slumpade ${tal(snitt(slump.map(hpNS)))} · valda ${tal(snitt(valda.map(hpNS)))}`)
  const vildSnitt = (g: Rad[]) => tal(snitt(g.map((r) => vildhetSumma(r.deal))))
  const vilda = (g: Rad[]) => g.filter((r) => vildhetSumma(r.deal) >= VILD_GRANS).length
  ut.push(`  vildhetssumma i snitt: alla ${vildSnitt(rader)} · slumpade ${vildSnitt(slump)} · valda ${vildSnitt(valda)}`)
  ut.push(`  vilda givar (vildhet ≥ ${VILD_GRANS}): alla ${vilda(rader)} (${tal((vilda(rader) / N) * 100)} %) · slumpade ${vilda(slump)} · valda ${vilda(valda)}`)
  ut.push(`  utpassade av bottarna: alla ${utpassade(rader)} · slumpade ${utpassade(slump)} · valda ${utpassade(valda)}`)
  ut.push('')

  const skrivGiv = (r: Rad) => {
    const { hp, ok } = summakoll(r.deal)
    expect(ok).toBe(true)
    const storst = r.poang.delar.reduce((x, y) => (y.poang > x.poang ? y : x))
    ut.push(
      `--- Bricka ${r.deal.board} · giv ${SATE[r.deal.dealer]} · zon ${ZON[r.deal.vulnerability]} · poäng ${tal(r.poang.total)} · typ: ${r.poang.typEtikett} (kandidat ${r.index}) ---`,
    )
    for (const s of SEATS) ut.push(`  ${SATE[s]}  ${formatHand(r.deal.hands[s]).padEnd(34)} ${String(hp[s]).padStart(2)} hp`)
    ut.push(`  summa ${SEATS.reduce((a, s) => a + hp[s], 0)} hp · N/S ${hp.N + hp.S} · Ö/V ${hp.E + hp.W}`)
    ut.push(`  DD-stick (♠ ♥ ♦ ♣ NT): ${SEATS.map((s) => `${SATE[s]} ${STRAINS.map((st) => r.dd[s][st]).join('/')}`).join('  ·  ')}`)
    ut.push(`  DD-par: ${r.parKontrakt.join(' | ')} = ${r.parNS} för N/S`)
    ut.push(`  Bottarna: ${r.auktion}  →  ${kontraktText(r.poang.botKontrakt)} = ${r.poang.botNS} för N/S (spelat DD)`)
    ut.push(`  Vald för: ${storst.etikett} — ${storst.forklaring}`)
    for (const d of r.poang.delar)
      if (d.poang > 0) ut.push(`    ${tal(d.poang).padStart(5)} / ${String(d.vikt).padStart(2)}  ${d.etikett}: ${d.forklaring}`)
    ut.push('')
  }
  ut.push('=== DE TOLV VALDA GIVARNA ===')
  ut.push('')
  valda.forEach(skrivGiv)
  ut.push('=== JÄMFÖRELSE: TOLV SLUMPADE GIVAR (samma kandidater, en per bricka) ===')
  ut.push('')
  slump.forEach(skrivGiv)

  writeFileSync(join(katalog, 'masterskapsgiv.txt'), ut.join('\n'), 'utf8')
  const json = (g: Rad[]) =>
    g.map((r) => ({
      index: r.index,
      board: r.deal.board,
      dealer: r.deal.dealer,
      vulnerability: r.deal.vulnerability,
      hands: Object.fromEntries(SEATS.map((s) => [s, formatHand(r.deal.hands[s])])),
      hp: summakoll(r.deal).hp,
      dd: r.dd,
      parNS: r.parNS,
      parKontrakt: r.parKontrakt,
      auktion: r.auktion,
      botKontrakt: kontraktText(r.poang.botKontrakt),
      botNS: r.poang.botNS,
      total: r.poang.total,
      typ: r.poang.typ,
      delar: r.poang.delar,
    }))
  writeFileSync(
    join(katalog, 'masterskapsgiv.json'),
    JSON.stringify({ fro: FRO, n: N, msPerGiv, valda: json(valda), slump: json(slump), totaler }, null, 1),
    'utf8',
  )
})
