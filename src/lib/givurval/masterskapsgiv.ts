// MÄSTERSKAPSVÄRDA GIVAR — TESTBYGGE (2026-11-11), INTE inkopplat i appen.
//
// Frågan: kan appen själv plocka ut "mästerskapsvärda" givar ur slumpen — givar
// med svåra beslut och stora svängar i stället för platta rutingivar — så att
// en veckotävling inte behöver riktiga mästerskapsgivar (olöst rättighetsfråga)?
//
// Den här filen är den RENA delen: ingen I/O, ingen slump, ingen WASM.
//   poangsattGiv(underlag)  → ett tal 0–100 + delpoäng med svenska etiketter
//   valjTavling(kandidater) → tolv givar, en per bricka, med variation
//   kandidatGiv(fro, i)     → kandidat nr i ur ett frö (deterministiskt)
// DD-tabellen och bottarnas auktion räknas fram av anroparen (proben
// masterskapsgiv.probe.test.ts) och skickas in som data.
//
// DET HÄR ÄR INTE KIK. Ärlig inferens (CLAUDE.md) gäller bottarnas BUD och
// SPEL vid bordet. Givurvalet görs INNAN någon spelar, av "tävlingsledaren":
// att då titta på alla fyra händer och double-dummy-tabellen är hela poängen —
// precis som en mänsklig tävlingsledare som väljer ut intressanta brickor.
// Inget härifrån når någon spelare eller bot under budgivning eller spel.
//
// Modulen bor medvetet UTANFÖR src/lib/engine/ (kopplingsvakten i
// src/docs-vakt.test.ts kräver att varje motormodul importeras av
// produktionskod — det här är ett testbygge som ingen produktionskod använder).

import type { Deal, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from '../engine/auction-contract'
import { dealFromSeed } from '../engine/deal'
import { hcp, lengths } from '../engine/hand'
import { impFor } from '../engine/imp'
import { nsScore } from '../engine/matchpoints'
import type { Contract, Strain } from '../engine/play'
import { duplicateScore, sideVulnerable } from '../engine/scoring'

// ---------- Indata ----------

/** Double-dummy-stick per SPELFÖRARE och benämning (0–13). */
export type DdTabell = Record<Seat, Record<Strain, number>>

export interface GivUnderlag {
  deal: Deal
  dd: DdTabell
  /** DD-par sett från N/S (inkl. offringar), t.ex. ur DealerPar. */
  parNS: number
  /** Bottarnas simulerade auktion (simulateAuction) — tom/bara pass = utpassad. */
  auktion: ResolvedCall[]
}

// ---------- Utdata ----------

export type SignalId = 'niva' | 'knivsegg' | 'strid' | 'fordelning' | 'botmiss' | 'svang'

export interface Delpoang {
  signal: SignalId
  /** Läsbar svensk rubrik. */
  etikett: string
  /** Signalens styrka 0–1 före vikt. */
  varde: number
  vikt: number
  /** varde × vikt. */
  poang: number
  /** Vad som utlöste signalen på just den här given ("" när den inte slog till). */
  forklaring: string
}

/** Givens "typ" — styr variationen i urvalet. */
export type GivTyp = 'slam' | SignalId

export interface GivPoang {
  /** Summan av delpoängen, 0–100. */
  total: number
  delar: Delpoang[]
  typ: GivTyp
  typEtikett: string
  /** Bottarnas slutkontrakt (null = utpassad) och N/S-poängen om det spelas DD. */
  botKontrakt: Contract | null
  botNS: number
}

/** Vikterna (summa 100). Motiveringen står vid respektive signal nedan. */
export const VIKTER: Record<SignalId, number> = {
  niva: 15,
  knivsegg: 25,
  strid: 20,
  fordelning: 10,
  botmiss: 10,
  svang: 20,
}

export const SIGNAL_ETIKETT: Record<SignalId, string> = {
  niva: 'Nivå på spel (utgång/slam finns)',
  knivsegg: 'Knivsegg (precis hem / precis bet)',
  strid: 'Strid (båda sidor har ett kontrakt)',
  fordelning: 'Fördelning (ojämna händer)',
  botmiss: 'Svår att bjuda (bottarna missar par)',
  svang: 'Rätt benämning / rätt hand',
}

export const TYP_ETIKETT: Record<GivTyp, string> = { slam: 'Slamgiv', ...SIGNAL_ETIKETT }

/** Människan sitter alltid Syd i rebidz. En giv där allt intressant ligger hos
 *  Ö/V (deras slam, deras knivsegg) ger människan mest en försvarsuppgift —
 *  därför räknas Ö/V:s nivå-, knivseggs- och benämningssignaler ned. */
export const OV_FAKTOR = 0.6

// ---------- Hjälpare ----------

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const STRAINS: Strain[] = ['spades', 'hearts', 'diamonds', 'clubs', 'NT']
const SYMBOL: Record<Strain, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', NT: 'NT' }
const SIDOR = { NS: ['N', 'S'], EW: ['E', 'W'] } as const satisfies Record<string, readonly Seat[]>
type Sida = keyof typeof SIDOR
const SIDNAMN: Record<Sida, string> = { NS: 'N/S', EW: 'Ö/V' }
const SATE: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

/** Bonusklass: 0 = delkontrakt, 1 = utgång, 2 = lillslam, 3 = storslam. */
type Klass = 0 | 1 | 2 | 3
const KLASSNAMN = ['delkontrakt', 'utgång', 'lillslam', 'storslam'] as const

/** Kontraktsnivån som ger bonusklassen i benämningen (utgång: 3NT/4M/5m). */
function nivaFor(klass: Klass, strain: Strain): number {
  if (klass === 3) return 7
  if (klass === 2) return 6
  if (klass === 1) return strain === 'NT' ? 3 : strain === 'hearts' || strain === 'spades' ? 4 : 5
  return 1
}

function klassAv(strain: Strain, stick: number): Klass {
  if (stick >= 13) return 3
  if (stick >= 12) return 2
  if (stick >= 6 + nivaFor(1, strain)) return 1
  return 0
}

export function kontraktText(c: Contract | null): string {
  return c ? `${c.level}${SYMBOL[c.strain]}${c.doubled ?? ''} av ${SATE[c.declarer]}` : 'utpassad'
}

/** Handens "vildhet": 0 för 4-3-3-3 och 4-4-3-2, växer med lång färg och kortfärg
 *  (5-3-3-2 = 1, 5-4-3-1 = 2, 6-4-2-1 = 3, 7-4-1-1 = 4, 5-4-4-0 = 3). */
export function vildhet(hand: Hand): number {
  const l = Object.values(lengths(hand))
  return Math.max(0, Math.max(...l) - 4) + Math.max(0, 2 - Math.min(...l))
}

/** En sidas bild av given: styrka, trumfstöd och bästa DD-stick per benämning. */
interface SidoBild {
  sida: Sida
  hp: number
  /** Benämningen i bottarnas slutkontrakt, om det är den här sidans. */
  botStrain: Strain | null
  /** Färger med äkta trumfstöd: 8+ kort ihop. */
  stod: Suit[]
  /** Benämningar som är rimliga att spela: sang, färger med trumfstöd,
   *  sjukorts högfärg (5-2/4-3 spelas på riktigt) och den benämning bottarna
   *  själva hamnade i. Utan de två sista kallade första mätningen en giv för
   *  "5♦ går precis hem" fast 4♠ på 5-2 stod med övertrick. */
  rimliga: Strain[]
  /** Bästa DD-stick per benämning (den bättre av sidans två spelförare). */
  stick: Record<Strain, number>
  /** Högsta bonusklass som går hem i någon rimlig benämning. */
  klass: Klass
  vulnerable: boolean
}

function sidoBild(u: GivUnderlag, sida: Sida, botKontrakt: Contract | null): SidoBild {
  const [a, b] = SIDOR[sida]
  const la = lengths(u.deal.hands[a])
  const lb = lengths(u.deal.hands[b])
  const stod = SUITS.filter((s) => la[s] + lb[s] >= 8)
  const botStrain = botKontrakt && SIDOR[sida].some((s) => s === botKontrakt.declarer) ? botKontrakt.strain : null
  const rimliga: Strain[] = [
    'NT',
    ...SUITS.filter(
      (s) => stod.includes(s) || s === botStrain || ((s === 'spades' || s === 'hearts') && la[s] + lb[s] === 7),
    ),
  ]
  const stick = Object.fromEntries(STRAINS.map((st) => [st, Math.max(u.dd[a][st], u.dd[b][st])])) as Record<Strain, number>
  const klass = Math.max(...rimliga.map((st) => klassAv(st, stick[st]))) as Klass
  return {
    sida,
    hp: hcp(u.deal.hands[a]) + hcp(u.deal.hands[b]),
    stod,
    botStrain,
    rimliga,
    stick,
    klass,
    vulnerable: sideVulnerable(a, u.deal.vulnerability),
  }
}

/** Poängen (ur sidans perspektiv) för kontraktet som ger `klass` i benämningen. */
function klassPoang(b: SidoBild, klass: Klass, strain: Strain, stick: number): number {
  const contract: Contract = { declarer: SIDOR[b.sida][0], strain, level: nivaFor(klass, strain) }
  return duplicateScore(contract, stick, b.vulnerable)
}

type Utslag = { varde: number; forklaring: string }
const INGET: Utslag = { varde: 0, forklaring: '' }

/** Bästa utslaget av N/S och Ö/V, där Ö/V räknas ned med OV_FAKTOR. */
function bastaSida(ns: Utslag, ew: Utslag): Utslag {
  const ewNed = { varde: ew.varde * OV_FAKTOR, forklaring: ew.forklaring }
  return ns.varde >= ewNed.varde ? ns : ewNed
}

// ---------- Signalerna ----------

// 1. NIVÅ: finns en utgång eller slam i given? Låg vikt — en utgång finns i
//    ungefär varannan slumpgiv, så signalen skiljer mest ut slammarna.
const NIVA_VARDE = [0, 0.4, 0.85, 1] as const
function nivaSignal(b: SidoBild): Utslag {
  if (b.klass === 0) return INGET
  const st = b.rimliga.find((s) => klassAv(s, b.stick[s]) === b.klass)!
  return {
    varde: NIVA_VARDE[b.klass],
    forklaring: `${SIDNAMN[b.sida]} har ${KLASSNAMN[b.klass]} (${nivaFor(b.klass, st)}${SYMBOL[st]}, ${b.stick[st]} stick)`,
  }
}

// 2. KNIVSEGG: sticken ligger precis vid en bonusgräns. Tyngsta signalen — det
//    är här "bjuda eller inte bjuda" och "spela hem eller gå bet" avgörs.
//    a) Högsta bonusen går hem UTAN marginal (tunn utgång på ≤ 23 hp väger mest).
//    b) Nästa bonus är exakt ett stick bort. Räknas fullt bara när styrkan
//       lockar dit (25/31/35 hp) — annars bjuder ingen den och inget står på spel.
const LOCKAR_HP: readonly number[] = [25, 31, 35]
function knivseggSignal(b: SidoBild): Utslag {
  let basta = INGET
  if (b.klass >= 1) {
    const kandidater = b.rimliga.filter((s) => klassAv(s, b.stick[s]) === b.klass)
    const marginal = Math.max(...kandidater.map((s) => b.stick[s] - (6 + nivaFor(b.klass, s))))
    if (marginal === 0) {
      const st = kandidater[0]
      const tunn = b.klass === 1 && b.hp <= 23
      basta = {
        varde: b.klass >= 2 || tunn ? 1 : 0.7,
        forklaring: `${SIDNAMN[b.sida]}: ${nivaFor(b.klass, st)}${SYMBOL[st]} går precis hem (${b.hp} hp${tunn ? ', tunn' : ''})`,
      }
    }
  }
  if (b.klass < 3) {
    const nasta = (b.klass + 1) as Klass
    const [st, brist] = b.rimliga
      .map((s) => [s, 6 + nivaFor(nasta, s) - b.stick[s]] as const)
      .reduce((x, y) => (y[1] < x[1] ? y : x))
    if (brist === 1) {
      const lockar = b.hp >= LOCKAR_HP[b.klass]
      const varde = lockar ? 0.8 : 0.15
      if (varde > basta.varde)
        basta = {
          varde,
          forklaring: `${SIDNAMN[b.sida]}: ${nivaFor(nasta, st)}${SYMBOL[st]} går precis en bet (${b.hp} hp${lockar ? ' — lockar' : ''})`,
        }
    }
  }
  return basta
}

// 3. STRID: BÅDA sidor har trumfstöd (8+ kort) och ett färgkontrakt på 2-läget
//    eller högre som går hem. Värdet följer den SVAGARE sidans nivå — det är
//    den som avgör hur högt striden går (4 mot 4 = dubbel utgångssväng).
function stridSignal(ns: SidoBild, ew: SidoBild): Utslag {
  const basta = (b: SidoBild) => {
    if (b.stod.length === 0) return null
    const st: Strain = b.stod.reduce((x, y) => (b.stick[y] > b.stick[x] ? y : x))
    return { st, niva: b.stick[st] - 6 }
  }
  const n = basta(ns)
  const e = basta(ew)
  if (!n || !e) return INGET
  const lagst = Math.min(n.niva, e.niva)
  if (lagst < 2) return INGET
  return {
    varde: lagst >= 4 ? 1 : lagst === 3 ? 0.7 : 0.4,
    forklaring: `N/S gör ${Math.min(7, n.niva)}${SYMBOL[n.st]}, Ö/V gör ${Math.min(7, e.niva)}${SYMBOL[e.st]}`,
  }
}

// 4. FÖRDELNING: summan av de fyra händernas vildhet — LAGOM är bäst. Låg vikt:
//    fördelning är krydda, inte kvalitet i sig. Första mätningen (2026-11-11)
//    gav "ju vildare desto bättre" full poäng åt givar med renons + sjukortsfärg
//    på varje bricka — konstiga, inte mästerskapsvärda. Därför en kulle: platt
//    (0) ger 0, 4–8 ger fullt (en slumpgiv ligger kring 5), över 8 faller
//    värdet tillbaka mot 0 vid 12. Urvalet har dessutom en kvot för vilda givar.
export const VILD_GRANS = 9
export function vildhetSumma(deal: Deal): number {
  return (['N', 'E', 'S', 'W'] as const).reduce((acc, s) => acc + vildhet(deal.hands[s]), 0)
}
export function fordelningsVarde(summa: number): number {
  if (summa <= 4) return summa / 4
  if (summa <= 8) return 1
  return Math.max(0, 1 - (summa - 8) / 4)
}
function fordelningSignal(deal: Deal): Utslag {
  const seats: Seat[] = ['N', 'E', 'S', 'W']
  const summa = vildhetSumma(deal)
  const former = seats
    .map((s) => `${SATE[s]} ${Object.values(lengths(deal.hands[s])).sort((x, y) => y - x).join('-')}`)
    .join(', ')
  return { varde: fordelningsVarde(summa), forklaring: `vildhet ${summa} (${former})` }
}

// 5. SVÅR ATT BJUDA: bottarnas systemriktiga slutkontrakt, spelat double-dummy,
//    jämfört med DD-par i IMP. 12 IMP eller mer = fullt utslag.
//    Sänkt vikt (15 → 10) efter första mätningen: signalen slog till på 12 av
//    12 valda, mest för att bottarna tappar tråden i vilda stridsgivar och för
//    att par ofta är en dubblad offring som ingen bjuder — den mäter alltså
//    delvis botsvaghet, inte bara givens svårighet.
export const IMP_TAK = 12
function botmissSignal(botKontrakt: Contract | null, botNS: number, parNS: number): Utslag {
  const imp = Math.abs(impFor(botNS - parNS))
  if (imp === 0) return INGET
  return {
    varde: Math.min(1, imp / IMP_TAK),
    forklaring: `bottarna: ${kontraktText(botKontrakt)} = ${botNS} för N/S, par ${parNS} (${imp} IMP)`,
  }
}

// 6. RÄTT BENÄMNING / RÄTT HAND: sidan har en utgång eller slam, men
//    a) den NATURLIGA benämningen (högfärg med 8+ kort, annars sang) är inte
//       den som går hem — 3NT i stället för 4♠, 5♦ i stället för 3NT; eller
//    b) kontraktet går bara hem från den ena handen (räknas till hälften: vem
//       som blir spelförare styrs oftast av systemet, inte av ett beslut).
//    Räknas bara när sidan har styrkan att rimligen vara på den nivån (inom
//    2 hp från LOCKAR_HP: 23/29/33) — "5♦ går hem men inte 3NT" på 18 hp och
//    7-5-fördelning är inget benämningsbeslut, ingen bjuder 3NT där.
function svangSignal(u: GivUnderlag, b: SidoBild): Utslag {
  if (b.klass === 0) return INGET
  const k = b.klass
  if (b.hp < LOCKAR_HP[k - 1] - 2) return INGET
  const hogfarger = b.stod.filter((s) => s === 'spades' || s === 'hearts')
  const [a, c] = SIDOR[b.sida]
  const langd = (s: Strain) => lengths(u.deal.hands[a])[s as Suit] + lengths(u.deal.hands[c])[s as Suit]
  const naturlig: Strain = hogfarger.length ? hogfarger.reduce((x, y) => (langd(y) > langd(x) ? y : x)) : 'NT'

  const poang = (s: Strain) => klassPoang(b, k, s, b.stick[s])
  const bast = b.rimliga.reduce((x, y) => (poang(y) > poang(x) ? y : x))
  // Hamnade bottarna själva i den benämning som går hem är valet inte svårt.
  const benamningImp = b.botStrain === bast ? 0 : impFor(poang(bast) - poang(naturlig))

  const [hog, lag] = u.dd[a][bast] >= u.dd[c][bast] ? [a, c] : [c, a]
  const handImp =
    impFor(klassPoang(b, k, bast, u.dd[hog][bast]) - klassPoang(b, k, bast, u.dd[lag][bast])) / 2

  if (benamningImp === 0 && handImp === 0) return INGET
  const varde = Math.min(1, Math.max(benamningImp, handImp) / IMP_TAK)
  const forklaring =
    benamningImp >= handImp
      ? `${SIDNAMN[b.sida]}: ${nivaFor(k, bast)}${SYMBOL[bast]} går hem men inte ${nivaFor(k, naturlig)}${SYMBOL[naturlig]} (${benamningImp} IMP)`
      : `${SIDNAMN[b.sida]}: ${nivaFor(k, bast)}${SYMBOL[bast]} går bara hem från ${SATE[hog]} (${u.dd[hog][bast]} mot ${u.dd[lag][bast]} stick)`
  return { varde, forklaring }
}

// ---------- Poängsättaren ----------

/** Poängsätter EN giv. Ren funktion: samma underlag → samma svar. */
export function poangsattGiv(u: GivUnderlag): GivPoang {
  const botKontrakt = contractFromCalls(u.auktion)
  const ns = sidoBild(u, 'NS', botKontrakt)
  const ew = sidoBild(u, 'EW', botKontrakt)
  const botNS = botKontrakt
    ? nsScore(botKontrakt, u.dd[botKontrakt.declarer][botKontrakt.strain], u.deal.vulnerability)
    : 0

  const utslag: Record<SignalId, Utslag> = {
    niva: bastaSida(nivaSignal(ns), nivaSignal(ew)),
    knivsegg: bastaSida(knivseggSignal(ns), knivseggSignal(ew)),
    strid: stridSignal(ns, ew),
    fordelning: fordelningSignal(u.deal),
    botmiss: botmissSignal(botKontrakt, botNS, u.parNS),
    svang: bastaSida(svangSignal(u, ns), svangSignal(u, ew)),
  }

  const delar: Delpoang[] = (Object.keys(VIKTER) as SignalId[]).map((signal) => ({
    signal,
    etikett: SIGNAL_ETIKETT[signal],
    varde: utslag[signal].varde,
    vikt: VIKTER[signal],
    poang: utslag[signal].varde * VIKTER[signal],
    forklaring: utslag[signal].varde > 0 ? utslag[signal].forklaring : '',
  }))
  const total = delar.reduce((acc, d) => acc + d.poang, 0)

  // Typen: en giv med slam för någon sida är en "slamgiv" (så urvalet kan
  // begränsa antalet); annars den signal som bidrog mest till totalen.
  const storst = delar.reduce((x, y) => (y.poang > x.poang ? y : x))
  const typ: GivTyp = Math.max(ns.klass, ew.klass) >= 2 ? 'slam' : storst.signal

  return { total, delar, typ, typEtikett: TYP_ETIKETT[typ], botKontrakt, botNS }
}

// ---------- Urvalet ----------

export interface Kandidat {
  /** Löpnummer i kandidatlistan (återskapar given: kandidatGiv(fro, index)). */
  index: number
  deal: Deal
  poang: GivPoang
}

export interface UrvalsRegel {
  /** Antal brickor i tävlingen. */
  brickor: number
  /** Högst så här många slamgivar. */
  maxSlam: number
  /** Högst så här många givar av varje övrig typ. */
  maxPerTyp: number
  /** Högst så här många givar där Ö/V har majoriteten av honnörspoängen. */
  maxOvStarka: number
  /** Högst så här många "vilda" givar (vildhetssumma ≥ VILD_GRANS). */
  maxVilda: number
  /** Typkvoten gäller bara givar med minst så här hög poäng (se valjTavling). */
  golv: number
}

/** Standardregeln: 12 brickor, högst 2 slamgivar, högst 4 per övrig typ, högst
 *  5 givar där Ö/V har korten (människan sitter Syd), högst 3 vilda givar och
 *  golv 45 poäng (ungefär den bästa femtedelen av slumpgivarna). */
export const STANDARDREGEL: UrvalsRegel = {
  brickor: 12,
  maxSlam: 2,
  maxPerTyp: 4,
  maxOvStarka: 5,
  maxVilda: 3,
  golv: 45,
}

function ovStark(deal: Deal): boolean {
  return hcp(deal.hands.E) + hcp(deal.hands.W) > 20
}

/**
 * Väljer en tävling ur kandidaterna: GIRIGT från högsta poäng och nedåt, där en
 * giv tas om (1) dess bricka är ledig — varje kandidat är delad för ett bestämt
 * bricknummer, så giv och zon följer standardschemat och poängen (som beror på
 * zonen) stämmer; (2) typens kvot inte är full; (3) Ö/V-kvoten inte är full;
 * (4) kvoten för vilda givar inte är full.
 *
 * Tre varv, så att en kvot aldrig tvingar in en svag giv när en bra finns:
 *   1. alla kvoter + golvet (bara givar med minst `golv` poäng);
 *   2. brickor som blev över: typkvoten och golvet släpps (slam-, Ö/V- och
 *      vild-kvoten gäller fortfarande);
 *   3. fortfarande över (för få kandidater): bästa kvarvarande utan kvoter.
 * Första mätningen utan golv gav en 28-poängsgiv på en bricka där en
 * 60-poängare fanns men hade "fel" typ.
 * Returneras i brickordning. Deterministisk: lika poäng → lägst index.
 */
export function valjTavling(kandidater: Kandidat[], regel: UrvalsRegel = STANDARDREGEL): Kandidat[] {
  const sorterade = [...kandidater].sort((a, b) => b.poang.total - a.poang.total || a.index - b.index)
  const valda = new Map<number, Kandidat>()
  const perTyp = new Map<GivTyp, number>()
  let ovStarka = 0
  let vilda = 0
  const ledig = (k: Kandidat) => k.deal.board >= 1 && k.deal.board <= regel.brickor && !valda.has(k.deal.board)

  for (const varv of [1, 2, 3] as const) {
    for (const k of sorterade) {
      if (valda.size === regel.brickor) break
      if (!ledig(k)) continue
      const ov = ovStark(k.deal)
      const vild = vildhetSumma(k.deal) >= VILD_GRANS
      if (varv === 1 && k.poang.total < regel.golv) continue
      if (varv < 3) {
        const slam = k.poang.typ === 'slam'
        const tak = slam ? regel.maxSlam : varv === 1 ? regel.maxPerTyp : Infinity
        if ((perTyp.get(k.poang.typ) ?? 0) >= tak) continue
        if (ov && ovStarka >= regel.maxOvStarka) continue
        if (vild && vilda >= regel.maxVilda) continue
      }
      valda.set(k.deal.board, k)
      perTyp.set(k.poang.typ, (perTyp.get(k.poang.typ) ?? 0) + 1)
      if (ov) ovStarka++
      if (vild) vilda++
    }
  }
  return [...valda.values()].sort((a, b) => a.deal.board - b.deal.board)
}

/**
 * Kandidat nr `index` ur ett frö: bricknumret går runt 1…brickor (så varje
 * bricka får lika många kandidater) och korten delas deterministiskt ur
 * (frö, index). Samma (frö, index) → exakt samma giv, alltid.
 */
export function kandidatGiv(fro: number, index: number, brickor = STANDARDREGEL.brickor): Deal {
  const board = (index % brickor) + 1
  const givfro = (Math.imul(fro ^ Math.imul(index + 1, 0x9e3779b1), 0x85ebca6b) ^ (index >>> 3)) >>> 0
  return { ...dealFromSeed(givfro, board), id: `kandidat-${fro}-${index}` }
}

/** Summakoll för rapporter: 13 kort per hand, 52 olika kort, 40 hp totalt. */
export function summakoll(deal: Deal): { ok: boolean; hp: Record<Seat, number> } {
  const seats: Seat[] = ['N', 'E', 'S', 'W']
  const hp = Object.fromEntries(seats.map((s) => [s, hcp(deal.hands[s])])) as Record<Seat, number>
  const kort = new Set(seats.flatMap((s) => deal.hands[s].map((c) => c.suit + c.rank)))
  const ok =
    seats.every((s) => deal.hands[s].length === 13) && kort.size === 52 && seats.reduce((a, s) => a + hp[s], 0) === 40
  return { ok, hp }
}
