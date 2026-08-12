// SPELDIAGNOSEN (steg 4) — aggregatorn som väger ihop bud- och speldomarna över
// många givar till en rapport. Spegel av runRevisor/formatRevisorReport i
// revisor.ts, men för HELA kedjan: auktion → kontrakt → botarnas spel →
// per-kort-DD-facit → dom per giv.
//
// Ren logik utan I/O: DD-oraklet OCH spelaren injiceras (fejkas i
// speldiagnos.test.ts; i skarp drift bridge-dds + spelaMedFro via proben).
//
// ÄGARPRINCIPEN (2026-08-12): DD-tappen i rapporten är LARMKLOCKOR — kandidater
// att granska, inte fel i sig. Klassningen systemfel/ärlig miss/oklart görs i
// agent-steget (/speldiagnos) på den information sätet ärligt hade.
// Aggregatsiffrorna är trendmätare mellan körningar, aldrig mål i sig.

import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import type { Contract, Strain, Trick } from './play'
import { botAuction, dealFromSeed, judgeDeal, type DDSolver, type MissCategory, CATEGORY_LABEL } from './revisor'
import { bedomSpel, helDom, type KortFel, type SpelRoll } from './speldom'

// ---- Ingångar ---------------------------------------------------------------

export interface SpeldiagnosOracle {
  solve: DDSolver
  parNS?: number
  /** Per-kort-DD-facit för den spelade given (analyseSpel i revisor-dds.ts). */
  analyse: (contract: Contract, tricks: Trick[]) => number[]
}

export interface SpeldiagnosOptions {
  deals: number
  baseSeed: number
  oracle: (deal: Deal) => SpeldiagnosOracle
  /** Spela given färdigt (i skarp drift spelaMedFro med playSeed = givens frö). */
  spela: (deal: Deal, contract: Contract, calls: ResolvedCall[], seed: number) => { tricks: Trick[] }
  /** Max sparade värsta-exempel per grupp (roll/kategori). */
  examplesPerGrupp?: number
  onProgress?: (done: number, total: number) => void
}

// ---- Utdata -----------------------------------------------------------------

/** Domen över EN giv — komplett underlag för agent-steget (frö → repro). */
export interface GivDom {
  seed: number
  kontrakt: string
  budKategori: MissCategory
  budtapp: number
  /** Poängeffekt av spelet mot DD, NS-orienterad (se helDom). */
  spelDeltaNS: number
  ddTricks: number | null
  actualTricks: number | null
  spelforartapp: number
  forsvarstapp: number
  fel: KortFel[]
}

export interface BudKategoriStat {
  category: MissCategory
  count: number
  totalLoss: number
  /** Värsta exempelfrön (högst tapp först). */
  seeds: number[]
}

export interface RollStat {
  roll: SpelRoll
  /** Antal givar där rollen tappade minst ett stick. */
  givar: number
  /** Antal enskilda felkort. */
  fel: number
  /** Summa tappade stick. */
  stick: number
  /** Värsta exempel (flest tappade stick för rollen på given). */
  varsta: { seed: number; kontrakt: string; stick: number }[]
}

export interface SpeldiagnosRapport {
  total: number
  judged: number
  skippedAuction: number
  skippedSolver: number
  baseSeed: number
  elapsedMs: number
  bud: { rattShare: number; avgTapp: number; kategorier: BudKategoriStat[] }
  spel: {
    /** Givar med kontrakt som spelades helt utan DD-rörelse. */
    rentSpelade: number
    /** Givar med kontrakt (= spelade; utpassade ingår inte). */
    spelade: number
    perRoll: RollStat[]
  }
  /** Alla bedömda givar — hela underlaget till /speldiagnos-agenten. */
  domar: GivDom[]
}

const STRAIN_BOKSTAV: Record<Strain, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S', NT: 'NT' }

function kontraktText(contract: Contract | null): string {
  if (!contract) return 'utpassad'
  return `${contract.level}${STRAIN_BOKSTAV[contract.strain]}${contract.doubled ?? ''} av ${contract.declarer}`
}

// ---- Körningen --------------------------------------------------------------

export function korSpeldiagnos(opts: SpeldiagnosOptions): SpeldiagnosRapport {
  const { deals, baseSeed, oracle, spela, examplesPerGrupp = 8, onProgress } = opts
  const start = Date.now()
  const domar: GivDom[] = []
  let skippedAuction = 0
  let skippedSolver = 0

  for (let i = 0; i < deals; i++) {
    const seed = baseSeed + i
    const deal = dealFromSeed(seed)
    const history = botAuction(deal)
    if (!history) {
      skippedAuction++
      onProgress?.(i + 1, deals)
      continue
    }
    const { solve, parNS, analyse } = oracle(deal)
    const verdict = judgeDeal(deal, history, solve, seed, parNS)
    if (!verdict) {
      skippedSolver++
      onProgress?.(i + 1, deals)
      continue
    }

    let spelDom = null
    if (verdict.contract) {
      const spelad = spela(deal, verdict.contract, history, seed)
      spelDom = bedomSpel(verdict.contract, analyse(verdict.contract, spelad.tricks), spelad.tricks)
    }
    const hel = helDom(deal, verdict, spelDom)
    domar.push({
      seed,
      kontrakt: kontraktText(verdict.contract),
      budKategori: hel.budKategori,
      budtapp: hel.budtapp,
      spelDeltaNS: hel.spelDeltaNS,
      ddTricks: spelDom?.ddTricks ?? null,
      actualTricks: spelDom?.actualTricks ?? null,
      spelforartapp: spelDom?.spelforartapp ?? 0,
      forsvarstapp: spelDom?.forsvarstapp ?? 0,
      fel: spelDom?.fel ?? [],
    })
    onProgress?.(i + 1, deals)
  }

  // -- Budsidan (samma måttstock som M-serien) --
  const ratt = domar.filter((d) => d.budtapp === 0).length
  const budKategorier = new Map<MissCategory, BudKategoriStat & { _tapp: { seed: number; loss: number }[] }>()
  for (const d of domar) {
    if (d.budtapp === 0) continue
    const stat = budKategorier.get(d.budKategori) ?? { category: d.budKategori, count: 0, totalLoss: 0, seeds: [], _tapp: [] }
    stat.count++
    stat.totalLoss += d.budtapp
    stat._tapp.push({ seed: d.seed, loss: d.budtapp })
    budKategorier.set(d.budKategori, stat)
  }
  const kategorier: BudKategoriStat[] = [...budKategorier.values()]
    .map(({ _tapp, ...stat }) => ({
      ...stat,
      seeds: _tapp.sort((a, b) => b.loss - a.loss).slice(0, examplesPerGrupp).map((t) => t.seed),
    }))
    .sort((a, b) => b.totalLoss - a.totalLoss)

  // -- Spelsidan: tapp per roll --
  const spelade = domar.filter((d) => d.ddTricks !== null)
  const rentSpelade = spelade.filter((d) => d.fel.length === 0).length
  const perRoll: RollStat[] = (['utspel', 'spelforare', 'forsvar'] as SpelRoll[]).map((roll) => {
    const rollTapp = spelade
      .map((d) => ({ d, stick: d.fel.filter((f) => f.roll === roll).reduce((s, f) => s + f.kostnad, 0) }))
      .filter((x) => x.stick > 0)
    return {
      roll,
      givar: rollTapp.length,
      fel: rollTapp.reduce((s, x) => s + x.d.fel.filter((f) => f.roll === roll).length, 0),
      stick: rollTapp.reduce((s, x) => s + x.stick, 0),
      varsta: rollTapp
        .sort((a, b) => b.stick - a.stick)
        .slice(0, examplesPerGrupp)
        .map((x) => ({ seed: x.d.seed, kontrakt: x.d.kontrakt, stick: x.stick })),
    }
  })

  return {
    total: deals,
    judged: domar.length,
    skippedAuction,
    skippedSolver,
    baseSeed,
    elapsedMs: Date.now() - start,
    bud: {
      rattShare: domar.length > 0 ? ratt / domar.length : 0,
      avgTapp: domar.length > 0 ? domar.reduce((s, d) => s + d.budtapp, 0) / domar.length : 0,
      kategorier,
    },
    spel: { rentSpelade, spelade: spelade.length, perRoll },
    domar,
  }
}

// ---- Läsbar rapport ---------------------------------------------------------

const ROLL_LABEL: Record<SpelRoll, string> = {
  utspel: 'Utspelet',
  spelforare: 'Spelförarsidan (inkl. träkarlen)',
  forsvar: 'Försvaret (efter utspelet)',
}

export function formatSpeldiagnos(r: SpeldiagnosRapport): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`
  const lines: string[] = []
  lines.push('=== SPELDIAGNOSEN ===')
  lines.push(`Givar: ${r.total} (bedömda ${r.judged}, auktionsfel ${r.skippedAuction}, olösbara ${r.skippedSolver})`)
  lines.push(`Frö: ${r.baseSeed}..${r.baseSeed + r.total - 1} · ${(r.elapsedMs / 1000).toFixed(0)} s`)
  lines.push('')
  lines.push('-- BUDGIVNINGEN (samma måttstock som M-serien) --')
  lines.push(`Rätt kontrakt (poängtapp 0): ${pct(r.bud.rattShare)} · snitt ${r.bud.avgTapp.toFixed(0)} poäng/giv`)
  for (const k of r.bud.kategorier) {
    lines.push(`  ${CATEGORY_LABEL[k.category]}: ${k.count} givar, ${k.totalLoss} poäng (värsta frön: ${k.seeds.join(', ')})`)
  }
  lines.push('')
  lines.push('-- KORTSPELET (DD-tapp = larmklocka att granska, INTE fel i sig) --')
  lines.push(`Rent spelade givar (ingen DD-rörelse): ${r.spel.rentSpelade}/${r.spel.spelade}`)
  for (const roll of r.spel.perRoll) {
    if (roll.stick === 0) {
      lines.push(`  ${ROLL_LABEL[roll.roll]}: 0 tappade stick`)
      continue
    }
    lines.push(`  ${ROLL_LABEL[roll.roll]}: ${roll.stick} stick på ${roll.givar} givar (${roll.fel} felkort)`)
    for (const v of roll.varsta) {
      lines.push(`    frö ${v.seed} (${v.kontrakt}): ${v.stick} stick`)
    }
  }
  lines.push('')
  lines.push('Repro av en giv: DUMP_SPEL=<frö> npx vitest run src/lib/engine/speldump.probe.test.ts')
  return lines.join('\n')
}
