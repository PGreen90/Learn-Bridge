// AVBLOCKERING (ägaren 2026-10-10, Dagens tävling bricka 7: "Syd måste veta att
// det är rätt att göra en unblock — räkna spadern, partnern har fem från början,
// släng kneckten så partnerns kort blir stora").
//
// Idén är en LITEN ENFÄRGS-LÖSARE i stället för en samling mönster: när jag ska
// lägga ett kort i en färg (följa färg, eller leda den mitt i given) provar jag
// varje olikvärt kort jag har i färgen och spelar färgen till slut, exakt, på
// VARJE fördelning av de osedda korten som budgivningen + spelet tillåter. Ett
// avblockeringskort väljs bara om det DOMINERAR tumregelns/bot-hjärnans kort:
// aldrig sämre på någon fördelning, strikt bättre på minst en. Därför kan regeln
// aldrig skänka bort ett stopp på en fördelning som räkningen inte uteslutit
// (♠J8 utan inklivet: Öst kan ha ♠T → kneckten är ett stopp, ingen avblockering).
//
// ÄRLIG INFERENS: lösaren ser bara egen hand + den öppna handen (träkarlen /
// spelförarsidans båda händer) + spelade kort. De dolda korten fördelas över
// de dolda platserna inom hand-modellens längdspann (budgivningen: 1♠-inklivet
// = 5+; öppningsutspelet i sang = 4+) och kända renonser. Inga dolda kort kikas.
//
// Ingångsmodellen: färgen spelas isolerat, men en blockering handlar om
// ingångar. Lösaren räknar därför med tre lägen — (A) partnern har EN
// sidoingång och jag ingen, (B) jag har en och partnern ingen, (C) båda en — och
// kräver dominans i alla. Ingen kan återta given utan en ingång; den som vinner
// ett stick utan kort kvar i färgen kan bara lämna över via en ingång.
// Målet är NETTO: våra stick i färgen minus motståndarnas.
//
// Avgränsning (mätt med avblock.probe): bara ÄKTA avblockering — ett HÖGRE kort
// som inte tar ett stick baskortet lämnar åt motståndarna (hold-up, ducka och
// mask ägs av andra regler) — och aldrig i trumffärgen.

import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import { PARTNER_SEAT, side, type PlayState } from './play'
import { playedCards, shownVoids, unseenTrumpCount, visibleSeats } from './card-counting'
import type { HandModel } from './hand-model'

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankIdx = (r: Rank) => RANKS.indexOf(r)
const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SI: Record<Seat, number> = { N: 0, E: 1, S: 2, W: 3 }

/** Ett lagt kort i det pågående sticket: rank 0–12, −1 = sak, 13+ = stöld. */
type Spel = { s: number; r: number }

const SAK = -1
const STOLD = 13

/** Max fördelningar vi provar innan regeln avstår (prestanda, ärligt avstående). */
const MAX_LAYOUTS = 600
/** Max noder per beslut (skyddsnät; en färg är liten, men vi ska aldrig hänga). */
const MAX_NODES = 200_000

interface Losning {
  nodes: number
  memo: Map<string, number>
}

/** Bitmask-hjälpare. */
const bit = (r: number) => 1 << r
const ranksOf = (mask: number): number[] => {
  const out: number[] = []
  for (let r = 12; r >= 0; r--) if (mask & bit(r)) out.push(r)
  return out
}

/**
 * Enfärgs-minimax. `h` = varje plats kvarvarande kort i färgen (bitmask),
 * `trick` = pågående stick, `turn` = vems tur, `e` = våra ingångar per plats,
 * `vi` = vår sida (0 = NS, 1 = ÖV), `ruff` = får platsen stjäla när den är
 * renons (bara motståndarna, i trumf när färgen inte är trumf).
 * Returnerar netto (våra − deras) stick i färgen från och med nu.
 *
 * Exakta värden räknas och sparas vid stickets början (`stickStart`); inne i
 * ett stick gallras grenar med alfa-beta (`iSticket`) — ett gallrat värde är
 * bara en gräns, så det sparas aldrig.
 */
function solve(L: Losning, h: number[], trick: Spel[], turn: number, e: number[], vi: number, ruff: boolean[]): number {
  return trick.length === 0 ? stickStart(L, h, turn, e, vi, ruff) : iSticket(L, h, trick, turn, e, vi, ruff, -Infinity, Infinity)
}

function stickStart(L: Losning, h: number[], turn: number, e: number[], vi: number, ruff: boolean[]): number {
  const key = `${h[0]},${h[1]},${h[2]},${h[3]}|${turn}|${e[0]}${e[1]}${e[2]}${e[3]}`
  const hit = L.memo.get(key)
  if (hit !== undefined) return hit
  const v = iSticket(L, h, [], turn, e, vi, ruff, -Infinity, Infinity)
  L.memo.set(key, v)
  return v
}

function iSticket(
  L: Losning,
  h: number[],
  trick: Spel[],
  turn: number,
  e: number[],
  vi: number,
  ruff: boolean[],
  alpha: number,
  beta: number,
): number {
  if (++L.nodes > MAX_NODES) throw new Error('nodbudget')
  const ourSeat = (s: number) => s % 2 === vi

  if (trick.length === 4) {
    // Sticket klart: vinnaren = högsta stöld, annars högsta kort i färgen.
    let w = trick[0]
    for (const t of trick) if (t.r > w.r) w = t
    const ourWin = ourSeat(w.s)
    const gain = ourWin ? 1 : -1
    const anyOurs = h[vi] !== 0 || h[vi + 2] !== 0
    const anyTheirs = h[1 - vi] !== 0 || h[3 - vi] !== 0
    if (!anyOurs && !anyTheirs) return gain
    if (ourWin) {
      // Vi är inne: fortsätt från vinnaren, gå över till partnern via ingång,
      // eller sluta spela färgen.
      let best = 0
      if (h[w.s] !== 0) best = Math.max(best, stickStart(L, h, w.s, e, vi, ruff))
      const p = (w.s + 2) % 4
      if (h[p] !== 0 && e[p] > 0) {
        const e2 = [...e]
        e2[p]--
        best = Math.max(best, stickStart(L, h, p, e2, vi, ruff))
      }
      return gain + best
    }
    // De är inne: de spelar färgen själva, eller släpper — då tar vi tillbaka
    // given bara via en ingång (bästa av våra händer med kort kvar). Släpper de
    // och vi saknar ingång får vi inget mer (konservativt).
    let regain = 0
    let harIngang = false
    for (const s of [vi, vi + 2]) {
      if (h[s] !== 0 && e[s] > 0) {
        const e2 = [...e]
        e2[s]--
        const v = stickStart(L, h, s, e2, vi, ruff)
        regain = harIngang ? Math.max(regain, v) : v
        harIngang = true
      }
    }
    let best = regain
    if (h[w.s] !== 0) best = Math.min(best, stickStart(L, h, w.s, e, vi, ruff))
    return gain + best
  }

  const moves = movesFor(h, trick, turn, ruff[turn])
  const nextTurn = (turn + 1) % 4
  const maximize = ourSeat(turn)
  let best = maximize ? -Infinity : Infinity
  for (const r of moves) {
    const h2 = r >= 0 && r < STOLD ? h.map((m, i) => (i === turn ? m & ~bit(r) : m)) : h
    const v = iSticket(L, h2, [...trick, { s: turn, r }], nextTurn, e, vi, ruff, alpha, beta)
    if (maximize) {
      if (v > best) best = v
      if (best > alpha) alpha = best
    } else {
      if (v < best) best = v
      if (best < beta) beta = best
    }
    if (alpha >= beta) break
  }
  return best
}

/** Lagliga drag i färgen, med likvärdiga kort hopslagna (inga levande kort emellan). */
function movesFor(h: number[], trick: Spel[], turn: number, canRuff: boolean): number[] {
  const mine = h[turn]
  if (mine === 0) return canRuff && trick.length > 0 ? [SAK, STOLD] : [SAK]
  let alive = 0
  for (let i = 0; i < 4; i++) if (i !== turn) alive |= h[i]
  for (const t of trick) if (t.r >= 0 && t.r < STOLD) alive |= bit(t.r)
  const out: number[] = []
  let prevKept = -2
  for (const r of ranksOf(mine)) {
    // Likvärdigt med föregående (högre) kort om inget levande kort ligger emellan.
    if (prevKept >= 0) {
      let gap = false
      for (let x = r + 1; x < prevKept; x++) if (alive & bit(x)) gap = true
      if (!gap) {
        prevKept = r
        out[out.length - 1] = r // behåll det LÄGSTA av likvärdiga
        continue
      }
    }
    out.push(r)
    prevKept = r
  }
  return out
}

/** Alla sätt att dela `ranks` mellan två dolda platser inom längdspannen. */
function layouts(ranks: number[], a: [number, number], b: [number, number]): Array<[number, number]> {
  const n = ranks.length
  const out: Array<[number, number]> = []
  const lo = Math.max(a[0], n - b[1])
  const hi = Math.min(a[1], n - b[0])
  if (lo > hi) return out
  for (let mask = 0; mask < 1 << n; mask++) {
    let cnt = 0
    for (let i = 0; i < n; i++) if (mask & (1 << i)) cnt++
    if (cnt < lo || cnt > hi) continue
    let ma = 0
    let mb = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) ma |= bit(ranks[i])
      else mb |= bit(ranks[i])
    }
    out.push([ma, mb])
    if (out.length > MAX_LAYOUTS) return out
  }
  return out
}

/** Ingångslägen lösaren kräver dominans i (mätvarianter i avblock.probe). */
export type Ingangslagen = 'AB' | 'A' | 'ABC'

export interface AvblockVal {
  card: Card
  reason: string
}

/**
 * Avblockeringsfiltret: `baseline` är kortet tumreglerna/bot-hjärnan valt.
 * Returnerar ett ANNAT kort i samma färg när det dominerar (aldrig sämre på
 * någon tillåten fördelning, i alla tre ingångslägena, och strikt bättre någonstans)
 * — annars null. Gäller bara när jag har ett verkligt val i färgen och
 * partnern kan ha fler kort kvar i färgen än jag (annars finns inget att avblockera).
 */
export function avblockering(
  state: PlayState,
  seat: Seat,
  baseline: Card,
  model: HandModel,
  opts: { lagen?: Ingangslagen } = {},
): AvblockVal | null {
  const suit: Suit = baseline.suit
  const leading = state.currentTrick.length === 0
  const led = leading ? suit : state.currentTrick[0].card.suit
  if (!leading && suit !== led) return null // jag sakar — inte ett färgval
  // Trumffärgen rörs inte: trumf har ett värde i stöld i ANDRA färger som en
  // enfärgs-räkning inte ser (mätt: avblock.probe, 400 givar — alla förluster
  // i trumffärgen kom därifrån).
  if (state.trump !== null && suit === state.trump) return null

  const mine = state.hands[seat].filter((c) => c.suit === suit)
  if (mine.length < 2) return null

  const partner = PARTNER_SEAT[seat]
  const vis = new Set(visibleSeats(state, seat))
  const played = playedCards(state)
  const voids = shownVoids(state)

  // Kort som syns för mig (egen hand + öppen hand) och de som fallit.
  const known = new Set<number>()
  for (const c of played) if (c.suit === suit) known.add(rankIdx(c.rank))
  const h: number[] = [0, 0, 0, 0]
  for (const s of SEATS) {
    if (!vis.has(s)) continue
    for (const c of state.hands[s]) {
      if (c.suit !== suit) continue
      h[SI[s]] |= bit(rankIdx(c.rank))
      known.add(rankIdx(c.rank))
    }
  }
  const unseen: number[] = []
  for (let r = 0; r < 13; r++) if (!known.has(r)) unseen.push(r)

  // Dolda platser och deras återstående längdspann (modellen minus spelat i färgen).
  const hidden = SEATS.filter((s) => !vis.has(s))
  if (hidden.length !== 2) return null
  const playedBy = (s: Seat) =>
    state.completedTricks.reduce((n, t) => n + t.cards.filter((pc) => pc.seat === s && pc.card.suit === suit).length, 0) +
    state.currentTrick.filter((pc) => pc.seat === s && pc.card.suit === suit).length
  const span = (s: Seat): [number, number] => {
    if (voids[s].has(suit)) return [0, 0]
    const len = model[s].length[suit]
    const p = playedBy(s)
    // Har platsen redan lagt i det pågående sticket ligger dess kort i `trick`.
    return [Math.max(0, len.min - p), Math.max(0, len.max - p)]
  }
  const lay = layouts(unseen, span(hidden[0]), span(hidden[1]))
  if (lay.length === 0 || lay.length > MAX_LAYOUTS) return null

  // Partnern måste KUNNA ha fler kort kvar än jag får kvar — annars finns inget
  // att avblockera (min korta hand blockerar bara en längre).
  const partnerMax = vis.has(partner)
    ? state.hands[partner].filter((c) => c.suit === suit).length
    : span(partner)[1]
  if (partnerMax === 0) return null

  // Pågående stick i lösarens format.
  const trumpOf = (c: Card) => c.suit === state.trump
  const trick: Spel[] = state.currentTrick.map((pc) => ({
    s: SI[pc.seat],
    r: pc.card.suit === led ? rankIdx(pc.card.rank) : trumpOf(pc.card) ? STOLD + rankIdx(pc.card.rank) : SAK,
  }))

  // Får motståndarna stjäla när de är renons? Bara i trumf, i en sidofärg, och
  // bara om de kan ha trumf (öppen hand: syns; dold hand: osedd trumf finns).
  const vi = side(seat) === 'NS' ? 0 : 1
  const ruff = SEATS.map((s) => {
    if (side(s) === side(seat)) return false
    if (state.trump === null || suit === state.trump) return false
    if (vis.has(s)) return state.hands[s].some((c) => c.suit === state.trump)
    return unseenTrumpCount(state, seat) > 0
  })

  // Kandidaterna: mina olikvärda kort i färgen, i grupper av likvärdiga (inget
  // levande kort emellan). Gruppens nyckel = dess lägsta rank.
  const aliveAll = new Set<number>(unseen)
  for (const s of SEATS) if (s !== seat) for (const r of ranksOf(h[SI[s]])) aliveAll.add(r)
  for (const t of trick) if (t.r >= 0 && t.r < STOLD) aliveAll.add(t.r)
  const cand = new Map<number, Card>()
  const groupOf = new Map<number, number>()
  {
    const sorted = [...mine].sort((x, y) => rankIdx(y.rank) - rankIdx(x.rank))
    let group: number[] = []
    const flush = () => {
      if (group.length === 0) return
      const key = group[group.length - 1]
      cand.set(key, mine.find((c) => rankIdx(c.rank) === key)!)
      for (const r of group) groupOf.set(r, key)
      group = []
    }
    for (const c of sorted) {
      const r = rankIdx(c.rank)
      const prev = group[group.length - 1]
      if (prev !== undefined) {
        let gap = false
        for (let x = r + 1; x < prev; x++) if (aliveAll.has(x)) gap = true
        if (gap) flush()
      }
      group.push(r)
    }
    flush()
  }
  if (cand.size < 2) return null
  const baseR = rankIdx(baseline.rank)
  const baseKey = groupOf.get(baseR)
  if (baseKey === undefined) return null

  const me = SI[seat]
  const pa = SI[partner]
  const lage = (eMe: number, ePa: number) => {
    const e = [0, 0, 0, 0]
    e[me] = eMe
    e[pa] = ePa
    return e
  }
  // (A) partnern har en ingång, jag ingen · (B) tvärtom · (C) båda en. Standard
  // ABC (avblock.probe 400 givar: samma DD-netto som AB, färre förluster).
  const val = opts.lagen ?? 'ABC'
  const lagen: number[][] = val === 'A' ? [lage(0, 1)] : val === 'ABC' ? [lage(0, 1), lage(1, 0), lage(1, 1)] : [lage(0, 1), lage(1, 0)]

  // Bara ÄKTA avblockering får byta kort: ett HÖGRE kort än baskortet, som inte
  // tar ett stick från motståndarna som baskortet lämnar åt dem (det vore ett
  // annat beslut — hold-up, ducka, maska — som andra regler äger, §8.9). Att gå
  // över PARTNERNS vinnande kort är däremot avblockering (esset på kungen).
  const nuVinner = trick.length > 0 ? trick.reduce((w, t) => (t.r > w.r ? t : w)) : null
  const motstVinner = nuVinner !== null && nuVinner.s % 2 !== vi
  const slar = (r: number) => nuVinner === null || r > nuVinner.r
  const tillaten = (r: number) => r > baseKey && !(motstVinner && slar(r) && !slar(baseKey))
  const provas = [...cand.keys()].filter(tillaten)
  if (provas.length === 0) return null

  // Ett gemensamt minne räcker: nyckeln bär hela ställningen (alla händer,
  // sticket, turen och ingångarna), så lösningar delas mellan kandidater/fördelningar.
  // Fördelning för fördelning: en kandidat som är SÄMRE någonstans stryks direkt,
  // och när ingen kandidat är kvar avbryts räkningen (de flesta beslut slutar där).
  const L: Losning = { nodes: 0, memo: new Map() }
  const kvar = new Map<number, { strikt: boolean; summa: number }>(provas.map((r) => [r, { strikt: false, summa: 0 }]))
  const varde = (hh: number[], r: number, e: number[]) => {
    const h2 = [...hh]
    h2[me] &= ~bit(r)
    return solve(L, h2, [...trick, { s: me, r }], (me + 1) % 4, e, vi, ruff)
  }
  try {
    for (const [ma, mb] of lay) {
      const hh = [...h]
      hh[SI[hidden[0]]] = ma
      hh[SI[hidden[1]]] = mb
      for (const e of lagen) {
        const bas = varde(hh, baseKey, e)
        for (const [r, st] of kvar) {
          const v = varde(hh, r, e)
          if (v < bas) kvar.delete(r)
          else {
            if (v > bas) st.strikt = true
            st.summa += v
          }
        }
        if (kvar.size === 0) return null
      }
    }
  } catch {
    return null // nodbudget — ärligt avstående, tumregeln står
  }

  let bestKey = -1
  let bestSum = -Infinity
  for (const [r, st] of kvar) {
    if (st.strikt && st.summa > bestSum) {
      bestSum = st.summa
      bestKey = r
    }
  }
  if (bestKey < 0) return null
  const card = cand.get(bestKey)!
  const glyf: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
  const k = `${glyf[suit]}${card.rank}`
  // Texten ska säga vad draget ÄR: en avblockering bara när partnern kan ha fler
  // kort kvar än jag och mitt kort inte tar sticket från motståndarna; annars är
  // det en ren färgräkning (andra hand högt, rätt kort ur en lång hand …).
  const avblock = partnerMax > mine.length - 1 && !(motstVinner && slar(bestKey))
  if (avblock) {
    const kalla = vis.has(partner) ? 'partnerns kort syns' : 'budgivningen och korten som fallit visar partnerns längd'
    return {
      card,
      reason:
        `Avblockering: jag räknar färgen (${kalla}) och lägger ${k} nu, så att det inte står i vägen ` +
        'när partnerns kort ska ta sina stick. Det kostar inget på någon möjlig fördelning men vinner stick när partnern kommer in.',
    }
  }
  return {
    card,
    reason:
      `Jag räknar färgen och lägger ${k}: på varje fördelning som budgivningen och korten som fallit tillåter ` +
      'ger det minst lika många stick i färgen som ett lägre kort, och ibland fler.',
  }
}

