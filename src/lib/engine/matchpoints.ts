// Beslut B etapp 2 (Led 3) — matchpoäng för dagliga tävlingen.
//
// Alla spelare spelar SAMMA 12 givar från N/S-stolarna (Syd är människan, Nord
// dess bot-partner). Tävlingsmåttet per giv är därför N/S-poängen: hur bra just
// den här spelaren gjorde given jämfört med alla andra som spelat den.
//
// Matchpoäng (klassisk parpoäng): för varje annan spelare på given ger en bättre
// N/S-poäng 1 poäng, lika 0,5. Toppen = (antal spelare − 1). Tävlingsresultatet
// är snittet i procent över de 12 givarna (docs/beslut-b-plan.md, 2b). Minst två
// spelare per giv krävs för poäng — det gränsvärdet vaktas av kallaren.
//
// Ren aritmetik utan I/O — servern räknar topplistan med den här funktionen, och
// facit testar den isolerat.

import type { Contract } from './play'
import type { Vulnerability } from '../../types/bridge'
import { duplicateScore, sideVulnerable } from './scoring'
import { side } from './play'

/** N/S-poängen för en spelad giv: `duplicateScore` är ur spelförarens perspektiv
 *  (positiv när spelföraren gick hem) → vänd tecknet när Ö/V var spelförare, så
 *  ett högre tal ALLTID är bättre för N/S-spelaren. En utpassad giv = 0. */
export function nsScore(
  contract: Contract,
  declarerTricks: number,
  vulnerability: Vulnerability,
): number {
  const vulnerable = sideVulnerable(contract.declarer, vulnerability)
  const declarerScore = duplicateScore(contract, declarerTricks, vulnerable)
  return side(contract.declarer) === 'NS' ? declarerScore : -declarerScore
}

/** En spelares N/S-poäng på en giv (identiteten är opak — vilket id som helst). */
export interface GivPoäng {
  spelare: string
  poäng: number
}

/** Matchpoängen för en spelare på en giv. */
export interface GivMatchpoäng {
  spelare: string
  /** Råa matchpoäng (0 … max, halvpoäng vid lika). */
  mp: number
  /** Toppen på given = antal spelare − 1. */
  max: number
  /** mp som andel av max (0–100). max = 0 (ensam spelare) ⇒ 100. */
  procent: number
}

/** Matchpoäng för alla spelare på EN giv. Jämför varje spelares N/S-poäng mot
 *  alla andras (index-baserat, så dubbletter av id inte stör). */
export function matchpointsForBoard(entries: GivPoäng[]): GivMatchpoäng[] {
  const max = Math.max(0, entries.length - 1)
  return entries.map((e, i) => {
    let mp = 0
    entries.forEach((o, j) => {
      if (i === j) return
      if (e.poäng > o.poäng) mp += 1
      else if (e.poäng === o.poäng) mp += 0.5
    })
    return { spelare: e.spelare, mp, max, procent: max === 0 ? 100 : (mp / max) * 100 }
  })
}

// ===========================================================================
// Topplistan — aggregatet servern lämnar ut (Beslut B etapp 2, UI-polish steg 2)
// ===========================================================================

/** En rå tävlingsrad: en spelares N/S-poäng på en giv (identiteten opak). */
export interface Tävlingsrad {
  board: number
  spelare: string
  poäng: number
}

/** En rad på topplistan — id kvar (servern översätter till visningsnamn). */
export interface TopplistaPost {
  spelare: string
  /** Snittprocent över spelarens poängsatta givar (0–100). */
  snitt: number
  antalGivar: number
}

/** Kallarens egen giv: matchpoängen på EN bricka hen spelat (poängsatt giv). */
export interface DinGiv {
  board: number
  mp: number
  max: number
  procent: number
}

/** Hela topplisteaggregatet: den sorterade listan + valfritt kallarens egna
 *  siffror (placering, snitt, per giv) när ett kallar-id ges. */
export interface TopplistaAggregat {
  topplista: TopplistaPost[]
  /** Antal givar med minst `minPerGiv` spelare (de som ger poäng). */
  poängsattaGivar: number
  /** Kallarens placering + snitt, eller null (okänd kallare / inga poängsatta
   *  givar spelade än). Placeringen delar rang vid lika snitt. */
  du: { placering: number; snitt: number; antalGivar: number } | null
  /** Kallarens matchpoäng per poängsatt giv, i brickordning. Tom om kallaren
   *  saknas eller ännu inte har någon poängsatt giv. */
  dinaGivar: DinGiv[]
}

/** Räkna topplistan ur alla godkända tävlingsrader: gruppera per bricka, ge
 *  matchpoäng på varje giv med ≥ `minPerGiv` spelare, och snitta i procent per
 *  spelare. Ges `kallare` fylls även `du` (placering delad vid lika snitt) och
 *  `dinaGivar` (kallarens MP% per poängsatt giv). Ren aritmetik utan I/O. */
export function aggregeraTopplista(
  rader: Tävlingsrad[],
  minPerGiv: number,
  kallare?: string | null,
): TopplistaAggregat {
  const perSpelare = new Map<string, { summa: number; antal: number }>()
  const brickor = new Map<number, GivPoäng[]>()
  for (const r of rader) {
    const lista = brickor.get(r.board) ?? []
    lista.push({ spelare: r.spelare, poäng: r.poäng })
    brickor.set(r.board, lista)
  }

  const dinaGivar: DinGiv[] = []
  let poängsattaGivar = 0
  // Stigande brickordning så dinaGivar (och räkningen) blir stabil oavsett
  // radernas ankomstordning.
  for (const board of [...brickor.keys()].sort((a, b) => a - b)) {
    const entries = brickor.get(board)!
    if (entries.length < minPerGiv) continue
    poängsattaGivar++
    for (const mp of matchpointsForBoard(entries)) {
      const nu = perSpelare.get(mp.spelare) ?? { summa: 0, antal: 0 }
      nu.summa += mp.procent
      nu.antal += 1
      perSpelare.set(mp.spelare, nu)
      if (kallare && mp.spelare === kallare) {
        dinaGivar.push({ board, mp: mp.mp, max: mp.max, procent: mp.procent })
      }
    }
  }

  const topplista: TopplistaPost[] = [...perSpelare.entries()]
    .map(([spelare, v]) => ({
      spelare,
      snitt: v.antal ? v.summa / v.antal : 0,
      antalGivar: v.antal,
    }))
    .sort((a, b) => b.snitt - a.snitt)

  let du: TopplistaAggregat['du'] = null
  if (kallare) {
    const min = perSpelare.get(kallare)
    if (min && min.antal > 0) {
      const snitt = min.summa / min.antal
      // Delad rang: 1 + antalet spelare med STRIKT högre snitt.
      const placering = 1 + topplista.filter((p) => p.snitt > snitt).length
      du = { placering, snitt, antalGivar: min.antal }
    }
  }

  return { topplista, poängsattaGivar, du, dinaGivar }
}
