// Monte-Carlo-samplaren (docs/bot-hjarna.md, Steg 3a – "läsa bordet" på riktigt).
// Delar ut de OSEDDA korten till de två dolda händerna så att varje utdelning
// stämmer med allt vi ÄRLIGT vet: egen hand + träkarl ligger fast, spelade kort
// är borta, och varje dold hand måste passa hand-modellens spann (renonser,
// färglängder, HP). Detta är grunden Monte-Carlo-DDS vilar på (Steg 3b röstar
// fram bästa kortet ur DDS över de här sampeln).
//
// Järnprincip: INGEN tjuvkik. Samplaren rör aldrig de dolda platsernas verkliga
// kort – den känner bara deras ANTAL (offentligt ur spelläget) och bygger nya,
// troliga händer ur poolen av osedda kort. De verkliga korten i state.hands för
// en dold plats används alltså BARA för att räkna hur många kort platsen har kvar.
//
// Skärpning ur spelade kort: hand-modellens längd/HP-spann gäller URSPRUNGS-
// handen (13 kort). En dold plats ursprungslängd i en färg = redan spelade kort
// i färgen (känd fakta, per plats) + de kort samplaren tilldelar. Samma för HP.

import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { playedCards, visibleSeats } from './card-counting'
import { hcp } from './hand'
import { legalCards, playCard, side, type PlayState } from './play'
import { doubleDummyDeclarerRemaining } from './dds'
import type { HandModel, SeatConstraint } from './hand-model'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const key = (c: Card) => `${c.suit}${c.rank}`

/** Hela kortleken (52 kort). */
function fullDeck(): Card[] {
  const out: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) out.push({ suit, rank })
  return out
}

/** Kort varje plats redan SPELAT (avslutade stick + pågående stick), per plats. */
function playedBySeat(state: PlayState): Record<Seat, Card[]> {
  const out: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] }
  for (const t of state.completedTricks) for (const pc of t.cards) out[pc.seat].push(pc.card)
  for (const pc of state.currentTrick) out[pc.seat].push(pc.card)
  return out
}

/** De osedda korten = kortleken minus spelade minus de synliga platsernas kort. */
function unseenPool(state: PlayState, visible: Seat[]): Card[] {
  const seen = new Set<string>()
  for (const c of playedCards(state)) seen.add(key(c))
  for (const v of visible) for (const c of state.hands[v]) seen.add(key(c))
  return fullDeck().filter((c) => !seen.has(key(c)))
}

/** Fisher–Yates på en kopia (rör inte indata). */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const countSuit = (cards: Card[], suit: Suit) => cards.reduce((n, c) => n + (c.suit === suit ? 1 : 0), 0)

/**
 * Passar den TILLDELADE handen platsens spann? Ursprungshanden = tilldelade +
 * redan spelade kort. Renonsfärger hoppas över i längd-kollen (en renons säger
 * bara att inget kort är KVAR i färgen; platsen kan ha spelat färgen tidigare).
 */
function satisfies(c: SeatConstraint, assigned: Hand, played: Card[]): boolean {
  for (const s of c.voids) if (countSuit(assigned, s) > 0) return false
  for (const s of SUITS) {
    if (c.voids.has(s)) continue
    const orig = countSuit(assigned, s) + countSuit(played, s)
    if (orig < c.length[s].min || orig > c.length[s].max) return false
  }
  const origHcp = hcp(assigned) + hcp(played)
  return origHcp >= c.hcpMin && origHcp <= c.hcpMax
}

/**
 * Sampla upp till `n` fullständiga givar som stämmer med `model` och spelläget.
 * `seat` är den plats som ska agera (avgör vad som är synligt). Returnerar en
 * lista med kompletta `Record<Seat, Hand>` (synliga platser oförändrade, de två
 * dolda ifyllda ur poolen). Returnerar FÄRRE än `n` (t.o.m. tom lista) om
 * constraints är för hårda/omöjliga – då faller anroparen tillbaka på tumregler.
 */
export function sampleLayouts(
  state: PlayState,
  seat: Seat,
  model: HandModel,
  n: number,
  maxTriesPerSample = 400,
): Record<Seat, Hand>[] {
  const visible = visibleSeats(state, seat)
  const hidden = SEATS.filter((s) => !visible.includes(s))
  if (hidden.length !== 2) return [] // förväntas alltid vara 2 mitt i spelet

  const played = playedBySeat(state)
  const pool = unseenPool(state, visible)
  const [h1, h2] = hidden
  const need1 = state.hands[h1].length
  const need2 = state.hands[h2].length

  // Fördela renons-tvingade kort först (skär bort mängder av kasserade försök):
  // ett poolkort i en färg som h1 är renons i MÅSTE gå till h2, och tvärtom.
  const void1 = model[h1].voids
  const void2 = model[h2].voids
  const forced1: Card[] = []
  const forced2: Card[] = []
  const free: Card[] = []
  for (const c of pool) {
    const bad1 = void1.has(c.suit)
    const bad2 = void2.has(c.suit)
    if (bad1 && bad2) return [] // ingen kan hålla kortet → omöjligt
    else if (bad1) forced2.push(c)
    else if (bad2) forced1.push(c)
    else free.push(c)
  }
  const rem1 = need1 - forced1.length
  const rem2 = need2 - forced2.length
  if (rem1 < 0 || rem2 < 0 || rem1 + rem2 !== free.length) return [] // motstridigt

  const out: Record<Seat, Hand>[] = []
  for (let s = 0; s < n; s++) {
    let found: Record<Seat, Hand> | null = null
    for (let t = 0; t < maxTriesPerSample; t++) {
      const deck = shuffled(free)
      const hand1 = [...forced1, ...deck.slice(0, rem1)]
      const hand2 = [...forced2, ...deck.slice(rem1)]
      if (satisfies(model[h1], hand1, played[h1]) && satisfies(model[h2], hand2, played[h2])) {
        const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [] }
        for (const v of visible) hands[v] = state.hands[v]
        hands[h1] = hand1
        hands[h2] = hand2
        found = hands
        break
      }
    }
    if (!found) break // gick inte att uppfylla constraints → sluta (fallback)
    out.push(found)
  }
  return out
}

export interface MonteCarloChoice {
  /** Kortet röstningen valde. */
  card: Card
  /** Genomsnittligt antal stick SPELFÖRAREN tar efter kortet (över sampeln). */
  score: number
  /** Hur många sampel som faktiskt bidrog (DDS inom budget). */
  samples: number
}

/**
 * Monte-Carlo-DDS (docs/bot-hjarna.md, Steg 3b): för varje lagligt kort samplar
 * vi troliga givar (Steg 3a) och kör DDS på var och en → väljer kortet som ger
 * bäst genomsnittligt resultat. "Bäst" = flest stick åt spelföraren om `seat`
 * spelar med spelföraren, annars FÄRRST (motspelaren minimerar). DDS används
 * här ÄRLIGT – den ser bara de troliga korten, aldrig de verkliga dolda.
 *
 * Returnerar `null` om vi inte fick fram några sampel eller inget DDS-svar inom
 * nodbudgeten – då faller anroparen tillbaka på tumreglerna (`play-bot.ts`).
 */
export function chooseCardMonteCarlo(
  state: PlayState,
  seat: Seat,
  model: HandModel,
  opts: { samples?: number; maxNodes?: number } = {},
): MonteCarloChoice | null {
  const samplesN = opts.samples ?? 20
  const maxNodes = opts.maxNodes ?? 50_000
  const legal = legalCards(state, seat)
  if (legal.length === 0) return null

  const layouts = sampleLayouts(state, seat, model, samplesN)
  if (layouts.length === 0) return null

  const declSide = side(state.contract.declarer)
  const maximizeDeclarer = side(seat) === declSide

  let best: MonteCarloChoice | null = null
  for (const card of legal) {
    let total = 0
    let counted = 0
    for (const layout of layouts) {
      const next = playCard({ ...state, hands: layout }, card)
      const dd = doubleDummyDeclarerRemaining(
        next.hands, next.contract.strain, next.contract.declarer, next.currentTrick, next.toAct, maxNodes,
      )
      if (dd === null) continue // för tung ställning → hoppa detta sampel
      const banked = declSide === 'NS' ? next.tricksNS : next.tricksEW
      total += banked + dd
      counted++
    }
    if (counted === 0) continue
    const score = total / counted
    const better = best === null || (maximizeDeclarer ? score > best.score : score < best.score)
    if (better) best = { card, score, samples: counted }
  }
  return best
}
