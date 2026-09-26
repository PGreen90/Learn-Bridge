// Beslut B etapp 2 (Led 3) — matchpoäng för dagliga tävlingen.
//
// Alla spelare spelar SAMMA 12 givar från N/S-stolarna (Syd är människan, Nord
// dess bot-partner). Tävlingsmåttet per giv är därför N/S-poängen: hur bra just
// den här spelaren gjorde given jämfört med alla andra som spelat den.
//
// Matchpoäng (klassisk parpoäng): för varje annan spelare på given ger en bättre
// N/S-poäng 1 poäng, lika 0,5. Toppen = (antal spelare − 1). Tävlingsresultatet
// är snittet i procent över de 12 givarna (docs/beslut-b-plan.md, 2b) — under
// dagen som TILLSVIDARE-snitt där varje ännu opoängsatt giv räknas som 40 %
// (Påbyggnad 3, ägarbeslut 2026-09-13). Minst två spelare per giv krävs för
// poäng — det gränsvärdet vaktas av kallaren.
//
// Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md): samma aggregat
// bär nu TVÅ tävlingsformer via en form-strategi (`FormStrategi`): MP (den här
// filens räkning, ord för ord som förr) och IMP (cross-IMP ur imp.ts, summa
// över givarna, 0 IMP per ännu opoängsatt giv). Formen avgör vad `snitt`
// betyder: MP-snitt i procent respektive IMP-summa. MP-räkningen ändras INTE
// (ägarbeslut 2026-09-26: ingen Neuberg, ingen ändring — de gamla facit står).
//
// Ren aritmetik utan I/O — servern räknar topplistan med den här funktionen, och
// facit testar den isolerat.

import type { Contract } from './play'
import type { Vulnerability } from '../../types/bridge'
import { duplicateScore, sideVulnerable } from './scoring'
import { side } from './play'
import { crossImpsForBoard } from './imp'

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
// Tävlingsformen — MP eller IMP (Dagens IMP, ägarbeslut 2026-09-26)
// ===========================================================================

/** De två tävlingsformerna. Samma värden som kolumnen `daily_sets.form`. */
export type TavlingsForm = 'mp' | 'imp'

/** En spelares tal på EN giv, med formens egna detaljer. `tal` är det som
 *  summeras/snittas till ställningen: MP% respektive cross-IMP. */
export type Givtal =
  | { form: 'mp'; tal: number; mp: number; max: number; procent: number }
  | { form: 'imp'; tal: number; imp: number }

export type GivUtfall = Givtal & { spelare: string }

/** Formens tre knoppar: talet per giv, vad en ännu opoängsatt giv räknas som
 *  under dagen, och hur givarna vägs ihop till ställningens tal. */
export interface FormStrategi {
  form: TavlingsForm
  perGiv(entries: GivPoäng[]): GivUtfall[]
  /** Tillsvidare-talet per giv som ännu inte poängsatts. */
  provisoriskt: number
  /** Ställningens tal ur summan av talen på de poängsatta givarna. */
  sammanvag(summa: number, antalPoängsatta: number, storlek: number): number
}

/** Tillsvidare-procenten för en giv spelaren ännu inte fått poäng på —
 *  klubbstandarden "medel minus" (ägarbeslut 2026-09-13). */
export const PROVISORISK_PROCENT = 40

/** Tillsvidare-talet för en IMP-giv som ännu inte poängsatts: 0 IMP
 *  (ägarbeslut 2026-09-26; −3 "medel minus" avfört). */
export const PROVISORISK_IMP = 0

/** Tillsvidare-snittet: (summan av MP% på de poängsatta givarna + 40 × de som
 *  återstår) / tävlingens storlek. Är alla `storlek` givar poängsatta blir det
 *  exakt det vanliga snittet. Samma tal styr ordningen i ställningen för alla
 *  och "Din ställning" — så en halvspelad serie aldrig ser bättre ut än en hel. */
export function provisorisktSnitt(summa: number, antalPoängsatta: number, storlek: number): number {
  if (storlek <= 0) return 0
  const kvar = Math.max(0, storlek - antalPoängsatta)
  return (summa + PROVISORISK_PROCENT * kvar) / storlek
}

/** IMP-ställningens tal: SUMMAN av cross-IMP över de poängsatta givarna
 *  (ägarbeslut 2026-09-26: summa, inte snitt) + 0 per återstående giv. */
export function provisoriskImpSumma(summa: number, antalPoängsatta: number, storlek: number): number {
  const kvar = Math.max(0, storlek - antalPoängsatta)
  return summa + PROVISORISK_IMP * kvar
}

/** MP-formen = dagens räkning, ord för ord. */
export const MP_STRATEGI: FormStrategi = {
  form: 'mp',
  perGiv: (entries) =>
    matchpointsForBoard(entries).map((m) => ({
      form: 'mp',
      spelare: m.spelare,
      tal: m.procent,
      mp: m.mp,
      max: m.max,
      procent: m.procent,
    })),
  provisoriskt: PROVISORISK_PROCENT,
  sammanvag: provisorisktSnitt,
}

/** IMP-formen: cross-IMP per giv, summa över givarna. */
export const IMP_STRATEGI: FormStrategi = {
  form: 'imp',
  perGiv: (entries) =>
    crossImpsForBoard(entries).map((c) => ({ form: 'imp', spelare: c.spelare, tal: c.imp, imp: c.imp })),
  provisoriskt: PROVISORISK_IMP,
  sammanvag: provisoriskImpSumma,
}

/** Strategin för en form. Okänd/utelämnad form ⇒ MP (bakåtkompatibelt). */
export function strategiFor(form: TavlingsForm | string | null | undefined): FormStrategi {
  return form === 'imp' ? IMP_STRATEGI : MP_STRATEGI
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
  /** Ställningens tal. MP: tillsvidare-snittet (0–100) med 40 % per
   *  återstående giv. IMP: summan av cross-IMP (0 per återstående giv).
   *  Namnet `snitt` är historiskt (MP kom först) och bärs vidare genom API,
   *  klient och `daily_standings.snitt` — formen säger vad talet betyder. */
  snitt: number
  /** Antal POÄNGSATTA givar (≥ minPerGiv spelare). */
  antalGivar: number
  /** Antal SPELADE (inskickade) givar — det som visas som "7/12". */
  spelade: number
}

/** Kallarens egen giv: talet på EN bricka hen spelat (poängsatt giv), med
 *  formens detaljer (MP: mp/max/procent · IMP: imp). */
export type DinGiv = Givtal & { board: number }

/** Hela topplisteaggregatet: den sorterade listan + valfritt kallarens egna
 *  siffror (placering, snitt, per giv) när ett kallar-id ges. */
export interface TopplistaAggregat {
  /** Formen talen räknats i. */
  form: TavlingsForm
  topplista: TopplistaPost[]
  /** Antal givar med minst `minPerGiv` spelare (de som ger poäng). */
  poängsattaGivar: number
  /** Kallarens placering + snitt, eller null (okänd kallare / inget inskick
   *  än). Placeringen delar rang vid lika snitt. */
  du: { placering: number; snitt: number; antalGivar: number; spelade: number } | null
  /** Kallarens tal per poängsatt giv, i brickordning. Tom om kallaren
   *  saknas eller ännu inte har någon poängsatt giv. */
  dinaGivar: DinGiv[]
}

/** Räkna topplistan ur alla godkända tävlingsrader: gruppera per bricka, ge
 *  poäng på varje giv med ≥ `minPerGiv` spelare enligt formens strategi, och
 *  räkna ställningens tal per spelare (`strategi.sammanvag` mot tävlingens
 *  `storlek`). Alla som skickat in minst en giv står på listan. Ges `kallare`
 *  fylls även `du` (placering delad vid lika tal) och `dinaGivar` (kallarens
 *  tal per poängsatt giv). Utan `strategi` = MP, exakt som förr. Ren
 *  aritmetik utan I/O. */
export function aggregeraTopplista(
  rader: Tävlingsrad[],
  minPerGiv: number,
  kallare: string | null | undefined,
  storlek: number,
  strategi: FormStrategi = MP_STRATEGI,
): TopplistaAggregat {
  const perSpelare = new Map<string, { summa: number; antal: number; spelade: number }>()
  const brickor = new Map<number, GivPoäng[]>()
  for (const r of rader) {
    const lista = brickor.get(r.board) ?? []
    lista.push({ spelare: r.spelare, poäng: r.poäng })
    brickor.set(r.board, lista)
    // Spelade givar räknas ur ALLA rader — även de som ännu inte poängsatts.
    const nu = perSpelare.get(r.spelare) ?? { summa: 0, antal: 0, spelade: 0 }
    nu.spelade += 1
    perSpelare.set(r.spelare, nu)
  }

  const dinaGivar: DinGiv[] = []
  let poängsattaGivar = 0
  // Stigande brickordning så dinaGivar (och räkningen) blir stabil oavsett
  // radernas ankomstordning.
  for (const board of [...brickor.keys()].sort((a, b) => a - b)) {
    const entries = brickor.get(board)!
    if (entries.length < minPerGiv) continue
    poängsattaGivar++
    for (const utfall of strategi.perGiv(entries)) {
      const nu = perSpelare.get(utfall.spelare)!
      nu.summa += utfall.tal
      nu.antal += 1
      if (kallare && utfall.spelare === kallare) {
        const { spelare: _spelare, ...tal } = utfall
        dinaGivar.push({ board, ...tal })
      }
    }
  }

  const topplista: TopplistaPost[] = [...perSpelare.entries()]
    .map(([spelare, v]) => ({
      spelare,
      snitt: strategi.sammanvag(v.summa, v.antal, storlek),
      antalGivar: v.antal,
      spelade: v.spelade,
    }))
    .sort((a, b) => b.snitt - a.snitt)

  let du: TopplistaAggregat['du'] = null
  if (kallare) {
    const min = topplista.find((p) => p.spelare === kallare)
    if (min) {
      // Delad rang: 1 + antalet spelare med STRIKT högre tal.
      const placering = 1 + topplista.filter((p) => p.snitt > min.snitt).length
      du = { placering, snitt: min.snitt, antalGivar: min.antalGivar, spelade: min.spelade }
    }
  }

  return { form: strategi.form, topplista, poängsattaGivar, du, dinaGivar }
}
