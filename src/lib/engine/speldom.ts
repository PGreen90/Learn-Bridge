// SPELDOMEN (Speldiagnosen steg 3) — kortspelets motsvarighet till revisorns
// judgeDeal. Tar DD-facitspåret från AnalysePlayPBN (analyseSpel i
// revisor-dds.ts) och attribuerar varje DD-rörelse till KORTET som orsakade den:
// säte, stick och roll (utspel/spelförare/försvar).
//
// VIKTIGT (ägarprincipen 2026-08-12, se docs/speldiagnos.md): ett DD-tapp är en
// LARMKLOCKA, inte en dom. DD ser alla 52 korten — ett kort kan vara helt rätt
// på den information sätet ärligt hade och ändå "tappa" mot facit (masken satt
// fel). Klassningen systemfel/ärlig miss görs i agent-steget (/speldiagnos),
// aldrig här. Den här modulen räknar bara VAR facit rörde sig.
//
// Teckenlogik (låst av speldom.test.ts): DD-spåret är spelförarsidans stick.
// Ett kort från spelförarsidan kan bara SÄNKA värdet (eller lämna det) — en
// sänkning = spelförarsidan skänkte stick. Ett försvarskort kan bara HÖJA
// värdet — en höjning = försvaret släppte stick. Rörelser i "omöjlig" riktning
// (motorfel) kostar 0 här och fångas i stället av invarianttestet.
//
// Ren modul: ingen I/O, inget WASM — DD-spåret injiceras (fejkas i test).

import type { Seat } from '../../types/bridge'
import { side, type Contract, type Trick } from './play'
import { duplicateScore, sideVulnerable } from './scoring'
import type { Deal } from '../../types/bridge'
import type { DealVerdict, MissCategory } from './revisor'

export type SpelRoll = 'utspel' | 'spelforare' | 'forsvar'

export interface KortFel {
  /** 1-baserat index i spelordningen (kort 1 = öppningsutspelet). */
  kortIndex: number
  /** 1-baserat sticknummer. */
  trick: number
  seat: Seat
  roll: SpelRoll
  /** Stick som sätets SIDA tappade mot DD-facit på just det här kortet. */
  kostnad: number
}

export interface SpelDom {
  /** DD-stick för spelförarsidan i utgångsläget (= ddTrace[0]). */
  ddTricks: number
  /** Spelförarsidans faktiska stick (= ddTrace sista värde — resten forcerat). */
  actualTricks: number
  /** Varje kort där DD-facit rörde sig, i spelordning. */
  fel: KortFel[]
  /** Summa stick spelförarsidan skänkte (inkl. träkarlen — samma bot spelar båda). */
  spelforartapp: number
  /** Summa stick försvaret släppte (utspelet inräknat). */
  forsvarstapp: number
}

/**
 * Bedöm kortspelet i EN spelad giv. `ddTrace` är analyseSpel-spåret
 * (värde 0 = före utspelet, värde i = efter kort i; full giv → 49 värden).
 */
export function bedomSpel(contract: Contract, ddTrace: number[], tricks: Trick[]): SpelDom {
  const cards = tricks.flatMap((t) => t.cards)
  const declSide = side(contract.declarer)
  const fel: KortFel[] = []
  let spelforartapp = 0
  let forsvarstapp = 0

  const analyserade = Math.min(ddTrace.length - 1, cards.length)
  for (let i = 1; i <= analyserade; i++) {
    const delta = ddTrace[i] - ddTrace[i - 1]
    if (delta === 0) continue
    const { seat } = cards[i - 1]
    const egenSida = side(seat) === declSide
    // Spelförarsidans kort: bara en SÄNKNING är deras tapp. Försvarets kort:
    // bara en HÖJNING är deras tapp. Motsatt riktning = omöjlig → kostnad 0.
    const kostnad = egenSida ? Math.max(0, -delta) : Math.max(0, delta)
    if (kostnad === 0) continue
    const roll: SpelRoll = egenSida ? 'spelforare' : i === 1 ? 'utspel' : 'forsvar'
    if (egenSida) spelforartapp += kostnad
    else forsvarstapp += kostnad
    fel.push({ kortIndex: i, trick: Math.floor((i - 1) / 4) + 1, seat, roll, kostnad })
  }

  return {
    ddTricks: ddTrace[0],
    actualTricks: ddTrace[ddTrace.length - 1],
    fel,
    spelforartapp,
    forsvarstapp,
  }
}

// ---- Helhetsdomen: bud + spel för EN giv ------------------------------------

export interface HelDom {
  seed: number
  /** Budsidan — rakt av från judgeDeal (par vs kontraktet spelat till DD-stick). */
  budKategori: MissCategory
  budtapp: number
  /** Kontraktet som nåddes (null = utpassad → ingen speldom). */
  contract: Contract | null
  spelDom: SpelDom | null
  /**
   * Poängskillnad (sedd från N/S) mellan FAKTISKT spel och DD-spel av det nådda
   * kontraktet: negativ = spelet kostade N/S poäng mot facit, positiv = N/S
   * vann poäng på motspelet. 0 vid utpassad giv.
   */
  spelDeltaNS: number
}

/** Väg ihop buddomen (judgeDeal) och speldomen till en giv-dom. */
export function helDom(deal: Deal, verdict: DealVerdict, spelDom: SpelDom | null): HelDom {
  let spelDeltaNS = 0
  if (verdict.contract && spelDom) {
    const vulnerable = sideVulnerable(verdict.contract.declarer, deal.vulnerability)
    const dd = duplicateScore(verdict.contract, spelDom.ddTricks, vulnerable)
    const faktisk = duplicateScore(verdict.contract, spelDom.actualTricks, vulnerable)
    const deltaDecl = faktisk - dd
    spelDeltaNS = side(verdict.contract.declarer) === 'NS' ? deltaDecl : -deltaDecl
  }
  return {
    seed: verdict.seed,
    budKategori: verdict.category,
    budtapp: verdict.loss,
    contract: verdict.contract,
    spelDom,
    spelDeltaNS,
  }
}
