// FYND B — OFFLINE-UTVÄRDERING AV KANDIDATREGLER mot DD-facit (2026-10-01).
// Läser fyndb-<a|b|c|d>.json (ställning + DD-poäng per lagligt kort för varje
// ledningsval på spelförarsidan i 9–13-kortsfönstret, se fyndb.probe.test.ts) och
// räknar vad varje kandidatregel hade kostat — utan omspel. Reglerna ser bara
// ärlig information: egen hand, träkarlen, spelade kort, trumf. Inget byggs in i
// motorn förrän en kandidat vunnit här (S6-lärdomen: mät alternativen först).
//
//   Bash: FYNDB_EVAL=1 npx vitest run src/lib/engine/fyndb-utvardera.probe.test.ts

import { it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { isSureWinner } from './card-counting'
import { dummyOf, type PlayState } from './play'

const ON = process.env.FYNDB_EVAL
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

/** Sticken en färg ger med ärlig räkning (samma algoritm som play-bot.ts suitTricks). */
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
  his: Card[] // partnerns (synliga) hand på spelförarsidan
  spelade: Card[]
  trump: Suit | null
}
function syn(st: PlayState, seat: Seat): Syn {
  const dummy = dummyOf(st.contract)
  const partner = seat === dummy ? st.contract.declarer : dummy
  return { seat, partner, mine: st.hands[seat], his: st.hands[partner], spelade: played(st), trump: st.trump }
}
/** Motståndarnas osedda kort i färgen. */
function oppUnseen(s: Syn, suit: Suit): Rank[] {
  const seen = new Set<Rank>([...s.mine, ...s.his, ...s.spelade].filter((c) => c.suit === suit).map((c) => c.rank))
  // FALLANDE ordning (toppen först) — det är vad suitTricks förväntar sig.
  return RANKS.filter((r) => !seen.has(r)).sort((x, y) => rv(y) - rv(x))
}

/**
 * Kortet att leda i en VALD färg ur den ledande handen (standardteknik):
 *  · toppen av en touch-sekvens (2+) i ledande handen,
 *  · "högt från korta handen": har jag färre kort än partnern och en honnör som
 *    partnerns honnörer kan ta över, spelas honnören (avblockering),
 *  · annars lågt mot partnerns honnörer (om partnern har färgens bästa kort),
 *  · annars högsta säkra vinnaren, annars lägsta.
 */
function kortIFarg(s: Syn, suit: Suit): Card {
  const mine = s.mine.filter((c) => c.suit === suit)
  const his = s.his.filter((c) => c.suit === suit)
  const md = desc(mine)
  if (md.length >= 2 && rv(md[0]) - rv(md[1]) === 1 && rv(md[0]) >= rv('10')) return highest(mine)
  const topHis = his.length ? Math.max(...his.map((c) => rv(c.rank))) : -1
  const topMine = Math.max(...mine.map((c) => rv(c.rank)))
  const all = [...s.mine, ...s.his]
  if (mine.length < his.length && topMine >= rv('10') && topHis > topMine) return highest(mine) // högt från korta handen
  if (topHis > topMine) return lowest(mine) // mot partnerns honnör
  const sure = mine.filter((c) => isSureWinner(c, all, s.spelade))
  if (sure.length > 0) return highest(sure)
  return lowest(mine)
}

type Kandidat = (st: PlayState, seat: Seat, legal: Card[]) => Card

/** Stick OCH antal gånger ledningen släpps (deras topp vinner ett varv). */
function suitPlan(ourDesc: Rank[], oppDesc: Rank[]): { tricks: number; losses: number } {
  const o = [...ourDesc], p = [...oppDesc]
  let tricks = 0, losses = 0
  while (o.length > 0) {
    if (p.length === 0) { tricks += o.length; break }
    if (rv(o[0]) > rv(p[0])) { tricks++; o.shift(); p.pop() } else { losses++; o.pop(); p.shift() }
  }
  return { tricks, losses }
}
interface Variant { lam: number; b4: boolean; maxLoss: number }
/** K5-familjen: K1 med förlustavdrag, tak på antal släppta ledningar och rättad teknik i gren 4. */
function k5(st: PlayState, seat: Seat, legal: Card[], v: Variant): { card: Card; gain: number } | null {
  const s = syn(st, seat)
  const all = [...s.mine, ...s.his]
  let best: { suit: Suit; val: number; gain: number } | null = null
  for (const suit of SUITS) {
    if (!legal.some((c) => c.suit === suit)) continue
    const ours = all.filter((c) => c.suit === suit)
    const plan = suitPlan(desc(ours), oppUnseen(s, suit))
    if (plan.losses > v.maxLoss) continue
    const sure = ours.filter((c) => isSureWinner(c, all, s.spelade)).length
    const gain = plan.tricks - sure
    const val = plan.tricks + 0.25 * ours.length + 0.5 * gain - v.lam * plan.losses
    if (!best || val > best.val) best = { suit, val, gain }
  }
  if (!best) return null
  const mine = s.mine.filter((c) => c.suit === best.suit)
  const his = s.his.filter((c) => c.suit === best.suit)
  const md = desc(mine)
  const topHis = his.length ? Math.max(...his.map((c) => rv(c.rank))) : -1
  const topMine = rv(md[0])
  let card: Card
  if (md.length >= 2 && rv(md[0]) - rv(md[1]) === 1 && topMine >= rv('10')) card = highest(mine)
  else if (mine.length < his.length && topMine >= rv('10') && topHis > topMine) card = highest(mine)
  else if (topHis > topMine) card = lowest(mine)
  else if (v.b4 && mine.length > his.length && his.some((c) => rv(c.rank) >= rv('10'))) card = lowest(mine) // höga kort från KORTA handen först
  else { const sure = mine.filter((c) => isSureWinner(c, all, s.spelade)); card = sure.length > 0 ? highest(sure) : lowest(mine) }
  // avblockering mot partnerns högre singel
  if (his.length === 1 && rv(his[0].rank) > rv(card.rank)) card = lowest(mine)
  return { card, gain: best.gain }
}

/** K1 — parets färg: välj färgen (som ledande handen har) med flest beräknade stick ur BÅDA händerna; trumf bara när allt annat är sämre. */
const k1: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  let best: { suit: Suit; v: number } | null = null
  for (const suit of SUITS) {
    if (!legal.some((c) => c.suit === suit)) continue
    const ours = [...s.mine, ...s.his].filter((c) => c.suit === suit)
    const tricks = suitTricks(desc(ours), oppUnseen(s, suit))
    const sure = ours.filter((c) => isSureWinner(c, [...s.mine, ...s.his], s.spelade)).length
    // Utvecklingsvärde: stick utöver de omedelbara vinnarna + längdbonus; trumf räknas inte som "färg att utveckla".
    let v = tricks + 0.25 * ours.length + 0.5 * (tricks - sure)
    if (suit === s.trump) v -= 2
    if (!best || v > best.v) best = { suit, v }
  }
  return kortIFarg(s, best!.suit)
}

/** Utvecklingsvinsten (beräknade stick − omedelbara säkra vinnare) i K1:s bästa färg. */
function k1Gain(st: PlayState, seat: Seat, legal: Card[]): number {
  const s = syn(st, seat)
  const suit = k1(st, seat, legal).suit
  const ours = [...s.mine, ...s.his].filter((c) => c.suit === suit)
  const tricks = suitTricks(desc(ours), oppUnseen(s, suit))
  const sure = ours.filter((c) => isSureWinner(c, [...s.mine, ...s.his], s.spelade)).length
  return tricks - sure
}

/** K2 — som K1, men säkra vinnare cashas FÖRST när hela resten kan cashas hem (annars utveckla). */
const k2: Kandidat = (st, seat, legal) => {
  const s = syn(st, seat)
  const all = [...s.mine, ...s.his]
  const sureAll = all.filter((c) => isSureWinner(c, all, s.spelade)).length
  const mineSure = legal.filter((c) => isSureWinner(c, all, s.spelade))
  if (sureAll >= s.mine.length && mineSure.length > 0) return highest(mineSure) // allt är kallt → cash
  return k1(st, seat, legal)
}

/** K3 — DD-orakel på FÄRGNIVÅ (övre gräns för färgval) med kortIFarg i den färgen. */
function k3(l: Lage): Card {
  const perFarg: Partial<Record<Suit, number>> = {}
  for (const p of l.poang) perFarg[p.card.suit] = Math.max(perFarg[p.card.suit] ?? -1, p.score)
  const best = (Object.entries(perFarg) as [Suit, number][]).sort((a, b) => b[1] - a[1])[0][0]
  return kortIFarg(syn(l.state, l.seat), best)
}

it.skipIf(!ON)('fynd B: kandidatregler mot DD-facit', () => {
  const lagen: Lage[] = ['a', 'b', 'c', 'd'].flatMap((x) => JSON.parse(readFileSync(`revisor-output/fyndb-${x}.json`, 'utf8')).lagen)
  const kost = (l: Lage, card: Card) => {
    const best = Math.max(...l.poang.map((p) => p.score))
    const mitt = l.poang.find((p) => same(p.card, card))
    if (!mitt) throw new Error(`olagligt kort ${kortText(card)} i ${l.seed}`)
    return best - mitt.score
  }
  const legalOf = (l: Lage) => l.poang.map((p) => p.card).filter((c, i, a) => a.findIndex((d) => same(d, c)) === i)
  const botKort = (l: Lage): Card => l.poang.find((p) => kortText(p.card) === l.valt)!.card
  const kandidater: Record<string, (l: Lage) => Card> = {
    'bot (i dag)': (l) => l.poang.find((p) => kortText(p.card) === l.valt)!.card,
    'K1 parets färg': (l) => k1(l.state, l.seat, legalOf(l)),
    'K2 K1 + cash bara när allt är kallt': (l) => k2(l.state, l.seat, legalOf(l)),
    'K3 DD-färg + kortIFarg (övre gräns)': (l) => k3(l),
    // Hybrider: K1 bara i SANG och bara när parets bästa färg har stick att utveckla; annars dagens bot.
    'K4a sang: K1 om utvecklingsvinst ≥1': (l) => (l.state.trump === null && k1Gain(l.state, l.seat, legalOf(l)) >= 1 ? k1(l.state, l.seat, legalOf(l)) : botKort(l)),
    'K4b sang: K1 om utvecklingsvinst ≥2': (l) => (l.state.trump === null && k1Gain(l.state, l.seat, legalOf(l)) >= 2 ? k1(l.state, l.seat, legalOf(l)) : botKort(l)),
    'K4c sang: K1 alltid': (l) => (l.state.trump === null ? k1(l.state, l.seat, legalOf(l)) : botKort(l)),
    ...Object.fromEntries(
      ([[0, false, 9], [0, true, 9], [0.5, true, 9], [1, true, 9], [0.5, true, 2], [0.5, true, 1], [1, true, 1], [0, true, 1], [0, true, 2]] as [number, boolean, number][]).map(([lam, b4, maxLoss]) => [
        `K5 lam=${lam} b4=${b4 ? 'ja' : 'nej'} maxförlust=${maxLoss}`,
        (l: Lage) => {
          if (l.state.trump !== null) return botKort(l)
          const r = k5(l.state, l.seat, legalOf(l), { lam, b4, maxLoss })
          return r && r.gain >= 1 ? r.card : botKort(l)
        },
      ]),
    ),
  }
  const rader: string[] = [`fynd B — ${lagen.length} lägen`]
  const perKand: Record<string, number[]> = {}
  for (const [namn, f] of Object.entries(kandidater)) {
    let tot = 0, fel = 0
    const perSkal = new Map<string, number>()
    const perKort = new Map<number, number>()
    const kostnader: number[] = []
    for (const l of lagen) {
      const k = kost(l, f(l))
      kostnader.push(k)
      tot += k; if (k > 0) fel++
      perSkal.set(l.skal, (perSkal.get(l.skal) ?? 0) + k)
      perKort.set(l.kortKvar, (perKort.get(l.kortKvar) ?? 0) + k)
    }
    perKand[namn] = kostnader
    rader.push(`${namn.padEnd(40)} kostnad ${String(tot).padStart(4)} stick, fel i ${String(fel).padStart(3)} lägen · per skäl i dag: ${[...perSkal.entries()].map(([s, v]) => `${s}=${v}`).join(' ')} · per kort kvar: ${[...perKort.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
  }
  // Var K1 skiljer sig från boten: vinster och förluster per läge (de största).
  const bot = perKand['bot (i dag)'], k = perKand['K1 parets färg']
  const diffs = lagen.map((l, i) => ({ l, d: k[i] - bot[i] })).filter((x) => x.d !== 0).sort((a, b) => b.d - a.d)
  rader.push(`K1 vs bot: bättre i ${diffs.filter((x) => x.d < 0).length} lägen, sämre i ${diffs.filter((x) => x.d > 0).length}`)
  rader.push('K1 SÄMRE (värst först):')
  for (const x of diffs.filter((x) => x.d > 0).slice(0, 15)) rader.push(`  ${x.l.seed} ${x.l.kontrakt} stick ${x.l.trick} ${x.l.seat}: bot ${x.l.valt} [${x.l.skal}] → K1 ${kortText(k1(x.l.state, x.l.seat, legalOf(x.l)))} (+${x.d})`)
  rader.push('K1 BÄTTRE (störst först):')
  for (const x of [...diffs].reverse().filter((x) => x.d < 0).slice(0, 15)) rader.push(`  ${x.l.seed} ${x.l.kontrakt} stick ${x.l.trick} ${x.l.seat}: bot ${x.l.valt} [${x.l.skal}] → K1 ${kortText(k1(x.l.state, x.l.seat, legalOf(x.l)))} (${x.d})`)
  // Nedbrytning: skäl × sang/trumf — bot mot K1 mot övre gränsen.
  const k3k = perKand['K3 DD-färg + kortIFarg (övre gräns)']
  const cell = new Map<string, { n: number; bot: number; k1: number; k3: number }>()
  lagen.forEach((l, i) => {
    const key = `${l.state.trump === null ? 'SANG ' : 'TRUMF'} · ${l.skal}`
    const c = cell.get(key) ?? { n: 0, bot: 0, k1: 0, k3: 0 }
    c.n++; c.bot += bot[i]; c.k1 += k[i]; c.k3 += k3k[i]
    cell.set(key, c)
  })
  rader.push('NEDBRYTNING skäl × kontraktstyp:            lägen   bot    K1   övre gräns')
  for (const [key, c] of [...cell.entries()].sort()) rader.push(`  ${key.padEnd(38)} ${String(c.n).padStart(5)} ${String(c.bot).padStart(5)} ${String(c.k1).padStart(5)} ${String(c.k3).padStart(8)}`)
  // K1:s kvarvarande fel i SANG, med båda händerna — underlag för att vässa regeln.
  const hand = (cards: Card[]) => SUITS.slice().reverse().map((su) => SYM[su] + (cards.filter((c) => c.suit === su).sort((a, b) => rv(b.rank) - rv(a.rank)).map((c) => (c.rank === '10' ? 'T' : c.rank)).join('') || '–')).join(' ')
  rader.push('K1 KVARVARANDE FEL I SANG:')
  lagen.forEach((l, i) => {
    if (l.state.trump !== null || k[i] === 0) return
    const s = syn(l.state, l.seat)
    const perFarg: Partial<Record<Suit, number>> = {}
    for (const p of l.poang) perFarg[p.card.suit] = Math.max(perFarg[p.card.suit] ?? -1, p.score)
    rader.push(`  ${l.seed} stick ${l.trick} ${l.seat}: K1 ${kortText(k1(l.state, l.seat, legalOf(l)))} (−${k[i]}; bot ${l.valt} −${bot[i]}) · inne: ${hand(s.mine)} | partner: ${hand(s.his)} · DD per färg: ${(Object.entries(perFarg) as [Suit, number][]).map(([su, v]) => SYM[su] + v).join(' ')}`)
  })
  console.log(rader.join('\n'))
  writeFileSync('revisor-output/fyndb-utvardering.txt', rader.join('\n') + '\n')
})
