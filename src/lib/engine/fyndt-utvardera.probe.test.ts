// FYND T — TRUMFKONTRAKTENS LEDNINGSVAL på spelförarsidan: analys + offline-
// utvärdering av kandidatregler mot DD-facit (NU 2026-10-26, fortsättning på fynd B).
// Läser fynd B-riggens dataset (`fyndb.probe.test.ts`, FYNDB=1) — varje
// ledningsval på spelförarsidan i 9–13-kortsfönstret med ställning + DD-poäng per
// lagligt kort — och tittar BARA på trumfkontrakten. Två delar:
//   1. ANALYS: vad DD helst ville (trumf · stöld i korta handen · cash · annat)
//      mot vad boten valde, kostnad per cell — det är här idén ska komma ifrån.
//   2. KANDIDATER: regler som bara ser ärlig information (egen hand, träkarlen,
//      spelade kort, trumf) räknas mot facit utan omspel (S6-lärdomen).
//
//   Bash: FYNDT=1 FYNDT_FILES=fyndb2 npx vitest run src/lib/engine/fyndt-utvardera.probe.test.ts
//   (FYNDT_FILES = prefix: fyndb = datasetet 2026-10-01, fyndb2 = dagens motor)

import { it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { isSureWinner } from './card-counting'
import { dummyOf, type PlayState } from './play'

const ON = process.env.FYNDT
const FILES = process.env.FYNDT_FILES ?? 'fyndb2'
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rv = (r: Rank) => RANKS.indexOf(r)
const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const SYM: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

interface Lage {
  seed: number
  kontrakt: string
  seat: Seat
  trick: number
  kortKvar: number
  valt: string
  skal: string
  kostnad: number
  state: PlayState
  poang: { card: Card; score: number }[]
}

const same = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank
const kortText = (c: Card) => `${SYM[c.suit]}${c.rank === '10' ? 'T' : c.rank}`
const played = (st: PlayState): Card[] => st.completedTricks.flatMap((t) => t.cards.map((pc) => pc.card))
const desc = (cards: Card[]) => cards.map((c) => c.rank).sort((a, b) => rv(b) - rv(a))
const lowest = (cards: Card[]) => cards.reduce((m, c) => (rv(c.rank) < rv(m.rank) ? c : m))
const highest = (cards: Card[]) => cards.reduce((m, c) => (rv(c.rank) > rv(m.rank) ? c : m))
const hand = (cards: Card[]) =>
  SUITS.slice().reverse().map((su) => SYM[su] + (cards.filter((c) => c.suit === su).sort((a, b) => rv(b.rank) - rv(a.rank)).map((c) => (c.rank === '10' ? 'T' : c.rank)).join('') || '–')).join(' ')

function suitTricks(ourDesc: Rank[], oppDesc: Rank[]): number {
  const o = [...ourDesc], p = [...oppDesc]
  let tricks = 0
  while (o.length > 0) {
    if (p.length === 0) { tricks += o.length; break }
    if (rv(o[0]) > rv(p[0])) { tricks++; o.shift(); p.pop() } else { o.pop(); p.shift() }
  }
  return tricks
}

interface Syn {
  seat: Seat
  partner: Seat
  mine: Card[]
  his: Card[]
  all: Card[]
  spelade: Card[]
  trump: Suit
}
function syn(st: PlayState, seat: Seat): Syn {
  const dummy = dummyOf(st.contract)
  const partner = seat === dummy ? st.contract.declarer : dummy
  const mine = st.hands[seat], his = st.hands[partner]
  return { seat, partner, mine, his, all: [...mine, ...his], spelade: played(st), trump: st.trump! }
}
function oppUnseen(s: Syn, suit: Suit): Rank[] {
  const seen = new Set<Rank>([...s.all, ...s.spelade].filter((c) => c.suit === suit).map((c) => c.rank))
  return RANKS.filter((r) => !seen.has(r)).sort((x, y) => rv(y) - rv(x))
}
const inSuit = (cards: Card[], suit: Suit) => cards.filter((c) => c.suit === suit)

/** Egenskaper hos en färg sedd från spelförarsidan (ärligt). */
interface Farg {
  suit: Suit
  mine: number
  his: number
  oppLeft: number // motståndarnas osedda kort i färgen
  oppTrumpsLeft: number
  sureMine: number // säkra vinnare i den ledande handen
  sureOurs: number
  tricks: number // suitTricks ur båda händerna
  ruffShort: boolean // partnern renons, partnern har trumf och FÄRRE trumf än jag (stöld i korta handen)
  ruffAny: boolean // partnern renons och har trumf
  ledande: boolean
}
function farg(s: Syn, suit: Suit): Farg {
  const mine = inSuit(s.mine, suit), his = inSuit(s.his, suit)
  const myT = inSuit(s.mine, s.trump).length, hisT = inSuit(s.his, s.trump).length
  const opp = oppUnseen(s, suit)
  return {
    suit, mine: mine.length, his: his.length, oppLeft: opp.length, oppTrumpsLeft: oppUnseen(s, s.trump).length,
    sureMine: mine.filter((c) => isSureWinner(c, s.all, s.spelade)).length,
    sureOurs: [...mine, ...his].filter((c) => isSureWinner(c, s.all, s.spelade)).length,
    tricks: suitTricks(desc([...mine, ...his]), opp),
    ruffShort: suit !== s.trump && his.length === 0 && hisT > 0 && hisT < myT,
    ruffAny: suit !== s.trump && his.length === 0 && hisT > 0,
    ledande: mine.length > 0,
  }
}

/** Klass för ett färgval. */
function klass(s: Syn, suit: Suit, card: Card | null): string {
  const f = farg(s, suit)
  if (suit === s.trump) return 'trumf'
  if (f.ruffShort) return 'stöld korta handen'
  if (f.ruffAny) return 'stöld långa handen'
  if (card && isSureWinner(card, s.all, s.spelade)) return 'cash'
  if (f.sureMine > 0) return 'färg med vinnare, lågt'
  return 'annan sidofärg'
}

type Kandidat = (st: PlayState, seat: Seat, legal: Card[]) => Card | null

/** Kortet i en vald färg (standardteknik ur fynd B). */
function kortIFarg(s: Syn, suit: Suit, legal: Card[]): Card {
  const mine = legal.filter((c) => c.suit === suit)
  const his = inSuit(s.his, suit)
  const md = desc(mine)
  if (md.length >= 2 && rv(md[0]) - rv(md[1]) === 1 && rv(md[0]) >= rv('10')) return highest(mine)
  const topHis = his.length ? Math.max(...his.map((c) => rv(c.rank))) : -1
  const topMine = rv(md[0])
  if (mine.length < his.length && topMine >= rv('10') && topHis > topMine) return highest(mine)
  if (topHis > topMine) return lowest(mine)
  const sure = mine.filter((c) => isSureWinner(c, s.all, s.spelade))
  if (sure.length > 0) return highest(sure)
  return lowest(mine)
}

/** T1 — stöld i korta handen FÖRST: finns en sidofärg där partnern (med färre trumf) är renons och har trumf, led den (lägsta förloraren). */
const t1: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const kand = SUITS.filter((su) => legal.some((c) => c.suit === su)).map((su) => farg(s, su)).filter((f) => f.ruffShort)
  if (kand.length === 0) return null
  const f = kand.sort((a, b) => b.mine - a.mine)[0]
  const mine = legal.filter((c) => c.suit === f.suit)
  const losers = mine.filter((c) => !isSureWinner(c, s.all, s.spelade))
  return losers.length > 0 ? lowest(losers) : null
}

/** T1b — som T1 men partnern får ha LIKA många trumf (stölden gör den till korta handen). */
const t1b: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const myT = inSuit(s.mine, s.trump).length, hisT = inSuit(s.his, s.trump).length
  const kand = SUITS.filter((su) => su !== s.trump && legal.some((c) => c.suit === su))
    .filter((su) => inSuit(s.his, su).length === 0 && hisT > 0 && hisT <= myT)
  if (kand.length === 0) return null
  const su = kand.sort((a, b) => inSuit(s.mine, b).length - inSuit(s.mine, a).length)[0]
  const losers = legal.filter((c) => c.suit === su && !isSureWinner(c, s.all, s.spelade))
  return losers.length > 0 ? lowest(losers) : null
}

/** T1c — som T1b men bara en RIKTIG förlorare (≤ 9) leds till stöld; en ensam honnör (♦K) är inget stöldkort. */
const t1c: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const myT = inSuit(s.mine, s.trump).length, hisT = inSuit(s.his, s.trump).length
  const kand = SUITS.filter((su) => su !== s.trump && legal.some((c) => c.suit === su))
    .filter((su) => inSuit(s.his, su).length === 0 && hisT > 0 && hisT <= myT)
    .filter((su) => legal.some((c) => c.suit === su && rv(c.rank) <= rv('9')))
  if (kand.length === 0) return null
  const su = kand.sort((a, b) => inSuit(s.mine, b).length - inSuit(s.mine, a).length)[0]
  return lowest(legal.filter((c) => c.suit === su && rv(c.rank) <= rv('9')))
}

/** T1d — T1b (partnern ≤ lika trumf) och kortet är en riktig förlorare: inte säker vinnare OCH högst en nia. */
const t1d: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const myT = inSuit(s.mine, s.trump).length, hisT = inSuit(s.his, s.trump).length
  const loser = (c: Card) => rv(c.rank) <= rv('9') && !isSureWinner(c, s.all, s.spelade)
  const kand = SUITS.filter((su) => su !== s.trump)
    .filter((su) => inSuit(s.his, su).length === 0 && hisT > 0 && hisT <= myT)
    .filter((su) => legal.some((c) => c.suit === su && loser(c)))
  if (kand.length === 0) return null
  const su = kand.sort((a, b) => inSuit(s.mine, b).length - inSuit(s.mine, a).length)[0]
  return lowest(legal.filter((c) => c.suit === su && loser(c)))
}

/** T1e — T1d + SÄKER stöld: motståndarna har inga trumf kvar, eller partnern har en trumf som slår alla osedda. */
const t1e: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const oppT = oppUnseen(s, s.trump)
  const hisT = inSuit(s.his, s.trump)
  const saker = oppT.length === 0 || hisT.some((c) => rv(c.rank) > rv(oppT[0]))
  if (!saker) return null
  return t1d(st, seat, legal)
}
/** T1f — T1d + partnern kan stjäla med en trumf som slår alla osedda ELLER högst EN trumf är ute. */
const t1f: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const oppT = oppUnseen(s, s.trump)
  const hisT = inSuit(s.his, s.trump)
  const saker = oppT.length <= 1 || hisT.some((c) => rv(c.rank) > rv(oppT[0]))
  if (!saker) return null
  return t1d(st, seat, legal)
}

/** T1g — T1d + vår sida har minst lika många trumf som motståndarna har osedda (trumfmajoritet). */
const t1g: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  if (inSuit(s.all, s.trump).length < oppUnseen(s, s.trump).length) return null
  return t1d(st, seat, legal)
}
/** T1h — T1d + partnerns bästa trumf slår minst HÄLFTEN av de osedda (inte en hopplös hacka mot sju trumf). */
const t1h: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const oppT = oppUnseen(s, s.trump)
  const hisTop = Math.max(-1, ...inSuit(s.his, s.trump).map((c) => rv(c.rank)))
  const over = oppT.filter((r) => rv(r) > hisTop).length
  if (over > oppT.length / 2) return null
  return t1d(st, seat, legal)
}

/** T2b — som T2 men bara mot en GAFFEL/honnörer med lucka (partnern har inte både A och K) och partnern har ≥3 kort i färgen. */
const t2b: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  let best: { su: Suit; gain: number } | null = null
  for (const su of SUITS) {
    if (su === s.trump || !legal.some((c) => c.suit === su)) continue
    const his = inSuit(s.his, su), mine = inSuit(s.mine, su)
    if (his.length < 3) continue
    const hon = his.filter((c) => rv(c.rank) >= rv('J'))
    if (hon.length < 2) continue
    if (his.some((c) => c.rank === 'A') && his.some((c) => c.rank === 'K')) continue // solid topp, inget att leda mot
    const myTop = Math.max(...mine.map((c) => rv(c.rank)))
    if (myTop >= Math.min(...hon.map((c) => rv(c.rank)))) continue
    if (oppUnseen(s, su).length < 2) continue
    const gain = gainOf(s, su)
    if (gain < 1) continue
    if (!best || gain > best.gain) best = { su, gain }
  }
  return best ? lowest(legal.filter((c) => c.suit === best!.su)) : null
}

/** Utvecklingsvinst i en färg: beräknade stick ur båda händerna minus omedelbara säkra vinnare. */
const gainOf = (s: Syn, su: Suit) => {
  const ours = inSuit(s.all, su)
  return suitTricks(desc(ours), oppUnseen(s, su)) - ours.filter((c) => isSureWinner(c, s.all, s.spelade)).length
}

/** T2 — led LÅGT MOT partnerns honnörskombination: partnern har ≥2 honnörer (A–J) i en sidofärg, jag bara småkort under dem, färgen har något att utveckla. */
const t2: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  let best: { su: Suit; gain: number } | null = null
  for (const su of SUITS) {
    if (su === s.trump || !legal.some((c) => c.suit === su)) continue
    const his = inSuit(s.his, su), mine = inSuit(s.mine, su)
    const hon = his.filter((c) => rv(c.rank) >= rv('J'))
    if (hon.length < 2) continue
    const myTop = Math.max(...mine.map((c) => rv(c.rank)))
    if (myTop >= Math.min(...hon.map((c) => rv(c.rank)))) continue
    if (oppUnseen(s, su).length < 2) continue
    const gain = gainOf(s, su)
    if (gain < 1) continue
    if (!best || gain > best.gain) best = { su, gain }
  }
  return best ? lowest(legal.filter((c) => c.suit === best!.su)) : null
}

/** T3 — cash en säker sidovinnare trots att motståndarna har ≤1 trumf kvar (dagens cash kräver 0). */
const t3: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  if (oppUnseen(s, s.trump).length > 1) return null
  const sure = legal.filter((c) => c.suit !== s.trump && isSureWinner(c, s.all, s.spelade))
  return sure.length > 0 ? highest(sure) : null
}

/** T4 — parets färg (fynd B-tekniken) i TRUMF, bara sidofärger och bara med utvecklingsvinst ≥ min. */
const t4 = (min: number): Kandidat => (st, seat, legal) => {
  const s = syn(st, seat)
  let best: { su: Suit; v: number; gain: number } | null = null
  for (const su of SUITS) {
    if (su === s.trump || !legal.some((c) => c.suit === su)) continue
    const ours = inSuit(s.all, su)
    const tricks = suitTricks(desc(ours), oppUnseen(s, su))
    const gain = gainOf(s, su)
    const v = tricks + 0.25 * ours.length + 0.5 * gain
    if (!best || v > best.v) best = { su, v, gain }
  }
  if (!best || best.gain < min) return null
  return kortIFarg(s, best.su, legal)
}

/** T5 — när boten drar trumf: kortet med fynd B-tekniken (lågt mot partnerns honnör osv.) i stället för utspelsregeln. */
const t5 = (l: Lage, legal: Card[]): Card | null => {
  if (l.skal !== 'drar trumf') return null
  const s = syn(l.state, l.seat)
  return kortIFarg(s, s.trump, legal)
}

it.skipIf(!ON)('fynd T: trumfkontraktens ledningsval — analys + kandidater', () => {
  const alla: Lage[] = ['a', 'b', 'c', 'd'].flatMap((x) => JSON.parse(readFileSync(`revisor-output/${FILES}-${x}.json`, 'utf8')).lagen)
  const lagen = alla.filter((l) => l.state.trump !== null)
  const kost = (l: Lage, card: Card) => {
    const best = Math.max(...l.poang.map((p) => p.score))
    const mitt = l.poang.find((p) => same(p.card, card))
    if (!mitt) throw new Error(`olagligt kort ${kortText(card)} i ${l.seed}`)
    return best - mitt.score
  }
  const legalOf = (l: Lage) => l.poang.map((p) => p.card).filter((c, i, a) => a.findIndex((d) => same(d, c)) === i)
  const botKort = (l: Lage): Card => l.poang.find((p) => kortText(p.card) === l.valt)!.card
  const bestSuits = (l: Lage): Suit[] => {
    const best = Math.max(...l.poang.map((p) => p.score))
    return [...new Set(l.poang.filter((p) => p.score === best).map((p) => p.card.suit))]
  }
  const rader: string[] = [`fynd T — ${lagen.length} trumflägen av ${alla.length} (${FILES})`]
  const botTot = lagen.reduce((a, l) => a + kost(l, botKort(l)), 0)
  rader.push(`bot i dag: ${botTot} stick`)

  // ---- 1. ANALYS: botens klass × DD:s bästa klass(er) --------------------
  const cell = new Map<string, { n: number; kost: number }>()
  const perSkal = new Map<string, { n: number; kost: number; bestKlass: Map<string, number> }>()
  for (const l of lagen) {
    const s = syn(l.state, l.seat)
    const bk = botKort(l)
    const k = kost(l, bk)
    const botKlass = klass(s, bk.suit, bk)
    const bästa = bestSuits(l).map((su) => klass(s, su, null))
    const key = `${botKlass.padEnd(24)} → DD: ${[...new Set(bästa)].sort().join(' | ')}`
    const c = cell.get(key) ?? { n: 0, kost: 0 }
    c.n++; c.kost += k; cell.set(key, c)
    const ps = perSkal.get(l.skal) ?? { n: 0, kost: 0, bestKlass: new Map() }
    ps.n++; ps.kost += k
    if (k > 0) for (const b of new Set(bästa)) ps.bestKlass.set(b, (ps.bestKlass.get(b) ?? 0) + k)
    perSkal.set(l.skal, ps)
  }
  rader.push('', 'PER SKÄL (bot) — kostnad och vad DD hellre ville (kostnad fördelad på DD-bästa klasser):')
  for (const [sk, ps] of [...perSkal.entries()].sort((a, b) => b[1].kost - a[1].kost))
    rader.push(`  ${sk.padEnd(26)} ${String(ps.n).padStart(4)} lägen ${String(ps.kost).padStart(4)} stick · ${[...ps.bestKlass.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')}`)
  rader.push('', 'BOTENS KLASS → DD:s BÄSTA KLASS(er):   lägen  kostnad')
  for (const [key, c] of [...cell.entries()].sort((a, b) => b[1].kost - a[1].kost)) if (c.kost > 0) rader.push(`  ${key.padEnd(70)} ${String(c.n).padStart(4)} ${String(c.kost).padStart(5)}`)

  // ---- 2. KANDIDATER ------------------------------------------------------
  const kandidater: Record<string, (l: Lage) => Card> = {
    'bot (i dag)': botKort,
    'T1 stöld i korta handen först, annars bot': (l) => t1(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1b stöld, partnern ≤ lika många trumf': (l) => t1b(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T2 lågt mot partnerns honnörskombination': (l) => t2(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T3 cash sidovinnare med ≤1 trumf ute': (l) => t3(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T4 parets färg i trumf, vinst ≥1': (l) => t4(1)(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T4 parets färg i trumf, vinst ≥2': (l) => t4(2)(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T5 trumfdragningens kort med fynd B-teknik': (l) => t5(l, legalOf(l)) ?? botKort(l),
    'T1+T2': (l) => t1(l.state, l.seat, legalOf(l)) ?? t2(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1+T3': (l) => t1(l.state, l.seat, legalOf(l)) ?? t3(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1+T2+T3': (l) => t1(l.state, l.seat, legalOf(l)) ?? t2(l.state, l.seat, legalOf(l)) ?? t3(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1+T2+T3+T5': (l) => t1(l.state, l.seat, legalOf(l)) ?? t2(l.state, l.seat, legalOf(l)) ?? t3(l.state, l.seat, legalOf(l)) ?? t5(l, legalOf(l)) ?? botKort(l),
    'T1c stöld ≤ lika trumf, bara riktig förlorare': (l) => t1c(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T2b lågt mot gaffel (ej AK), partnern ≥3 kort': (l) => t2b(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1c+T2b': (l) => t1c(l.state, l.seat, legalOf(l)) ?? t2b(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1b+T2b': (l) => t1b(l.state, l.seat, legalOf(l)) ?? t2b(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1d stöld ≤ lika trumf, förlorare ≤9 ej vinnare': (l) => t1d(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1e T1d + säker stöld (0 trumf ute / högre trumf)': (l) => t1e(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1f T1d + ≤1 trumf ute / högre trumf': (l) => t1f(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1g T1d + trumfmajoritet': (l) => t1g(l.state, l.seat, legalOf(l)) ?? botKort(l),
    'T1h T1d + partnerns topp slår ≥ hälften': (l) => t1h(l.state, l.seat, legalOf(l)) ?? botKort(l),
  }
  // Per kandidat: var den ändrar botens kort — bättre/sämre-lägen (de största) för granskning.
  const detalj = (namn: string, f: (l: Lage) => Card) => {
    const d = lagen.map((l) => ({ l, c: f(l), d: kost(l, f(l)) - kost(l, botKort(l)) })).filter((x) => x.d !== 0).sort((a, b) => b.d - a.d)
    const ut = [`  ${namn}: sämre i ${d.filter((x) => x.d > 0).length}, bättre i ${d.filter((x) => x.d < 0).length}`]
    for (const x of d.filter((x) => x.d > 0).slice(0, 8)) ut.push(`    SÄMRE ${x.l.seed} ${x.l.kontrakt} stick ${x.l.trick} ${x.l.seat}: bot ${x.l.valt} → ${kortText(x.c)} (+${x.d}) · inne ${hand(syn(x.l.state, x.l.seat).mine)} | partner ${hand(syn(x.l.state, x.l.seat).his)}`)
    for (const x of [...d].reverse().filter((x) => x.d < 0).slice(0, 5)) ut.push(`    BÄTTRE ${x.l.seed} ${x.l.kontrakt} stick ${x.l.trick} ${x.l.seat}: bot ${x.l.valt} → ${kortText(x.c)} (${x.d}) · inne ${hand(syn(x.l.state, x.l.seat).mine)} | partner ${hand(syn(x.l.state, x.l.seat).his)}`)
    return ut
  }
  rader.push('', 'KANDIDATER:')
  for (const [namn, f] of Object.entries(kandidater)) {
    let tot = 0, fel = 0, andrade = 0, battre = 0, samre = 0
    for (const l of lagen) {
      const c = f(l), k = kost(l, c), kb = kost(l, botKort(l))
      tot += k; if (k > 0) fel++
      if (!same(c, botKort(l))) { andrade++; if (k < kb) battre++; if (k > kb) samre++ }
    }
    rader.push(`  ${namn.padEnd(44)} kostnad ${String(tot).padStart(4)} stick, fel i ${String(fel).padStart(3)} lägen · ändrade ${andrade} (bättre ${battre}, sämre ${samre})`)
  }
  rader.push('', 'DETALJ PER KANDIDAT (var den ändrar botens kort):')
  for (const [namn, f] of Object.entries(kandidater)) if (namn !== 'bot (i dag)' && !namn.includes('+')) rader.push(...detalj(namn, f))

  // ---- 3. VÄRSTA LÄGEN med båda händerna (underlag för idéer) -------------
  rader.push('', 'VÄRSTA LÄGEN (kostnad ≥ 2), båda händerna, DD per färg:')
  for (const l of [...lagen].filter((l) => kost(l, botKort(l)) >= 2).sort((a, b) => kost(b, botKort(b)) - kost(a, botKort(a)))) {
    const s = syn(l.state, l.seat)
    const perFarg: Partial<Record<Suit, number>> = {}
    for (const p of l.poang) perFarg[p.card.suit] = Math.max(perFarg[p.card.suit] ?? -1, p.score)
    rader.push(`  ${l.seed} ${l.kontrakt} stick ${l.trick} ${l.seat} (${l.kortKvar} kort): bot ${l.valt} [${l.skal}] −${kost(l, botKort(l))} · inne: ${hand(s.mine)} | partner: ${hand(s.his)} · DD: ${(Object.entries(perFarg) as [Suit, number][]).sort((a, b) => b[1] - a[1]).map(([su, v]) => SYM[su] + v).join(' ')} · deras trumf kvar ${oppUnseen(s, s.trump).length}`)
  }
  console.log(rader.slice(0, 30).join('\n'))
  writeFileSync(`revisor-output/fyndt-utvardering-${FILES}.txt`, rader.join('\n') + '\n')
})
