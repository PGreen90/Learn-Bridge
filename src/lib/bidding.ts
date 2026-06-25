// Läser in teman/övningar och innehåller hjälparna som driver budträningen.
// Övningarna kommer från JSON-filer i src/data – aldrig hårdkodade i sidorna.

import type {
  AuctionStep,
  Bid,
  Card,
  Decision,
  Exercise,
  Hand,
  Rank,
  Scope,
  Seat,
  Suit,
  Theme,
  Vulnerability,
} from '../types/bridge'

import themesData from '../data/themes.json'
import open1suit from '../data/exercises/open-1-suit.json'
import open1nt from '../data/exercises/open-1nt.json'
import passOrOpen from '../data/exercises/pass-or-open.json'
import respond1suit from '../data/exercises/respond-1-suit.json'
import fullAuctionBasic from '../data/exercises/full-auction-basic.json'

// Övningarna i JSON har handen som kort text ("S:AK974 H:..."), inte som kort-lista.
interface RawExercise {
  id: string
  scope: Scope
  theme: string
  dealer: Seat
  vulnerability: Vulnerability
  yourSeat: Seat
  hand: string
  auction: AuctionStep[]
}

const EXERCISES_BY_THEME: Record<string, RawExercise[]> = {
  'open-1-suit': open1suit as RawExercise[],
  'open-1nt': open1nt as RawExercise[],
  'pass-or-open': passOrOpen as RawExercise[],
  'respond-1-suit': respond1suit as RawExercise[],
  'full-auction-basic': fullAuctionBasic as RawExercise[],
}

// ---- Teman & lägen ---------------------------------------------------------

export const SCOPES: { id: Scope; title: string; description: string }[] = [
  { id: 'opening', title: 'Bara öppningsbud', description: '"Vad öppnar du med?" – ett bud i taget.' },
  { id: 'opening-response', title: 'Öppning + svar', description: 'Svara på partnerns öppning.' },
  { id: 'full-auction', title: 'Hela budgivningen', description: 'Gör alla bud tills kontraktet är klart.' },
]

export function getThemes(): Theme[] {
  return themesData as Theme[]
}

export function getThemesByScope(scope: Scope): Theme[] {
  return getThemes().filter((t) => t.scope === scope)
}

export function getTheme(id: string): Theme | undefined {
  return getThemes().find((t) => t.id === id)
}

export function getExercises(themeId: string): Exercise[] {
  const raw = EXERCISES_BY_THEME[themeId] ?? []
  return raw.map((r) => ({
    id: r.id,
    scope: r.scope,
    theme: r.theme,
    dealer: r.dealer,
    vulnerability: r.vulnerability,
    yourSeat: r.yourSeat,
    yourHand: parseHand(r.hand),
    auction: r.auction,
  }))
}

// ---- Kort & händer ---------------------------------------------------------

const SUIT_OF: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }

/** Gör om "S:AK974 H:K83 D:Q6 C:J52" till en lista med kort. "T" = tia. */
export function parseHand(notation: string): Hand {
  const cards: Card[] = []
  for (const group of notation.trim().split(/\s+/)) {
    const [letter, ranks] = group.split(':')
    const suit = SUIT_OF[letter]
    if (!suit || !ranks || ranks === '-') continue
    for (const ch of ranks) {
      const rank = (ch === 'T' ? '10' : ch) as Rank
      cards.push({ suit, rank })
    }
  }
  return cards
}

// ---- Platser runt bordet ---------------------------------------------------

const SEATS_CW: Seat[] = ['N', 'E', 'S', 'W']

export const SEAT_LABEL: Record<Seat, string> = { N: 'Nord', E: 'Öst', S: 'Syd', W: 'Väst' }

/** Vilken plats bjuder vid ett visst steg, räknat medurs från given. */
export function seatAt(dealer: Seat, index: number): Seat {
  const start = SEATS_CW.indexOf(dealer)
  return SEATS_CW[(start + index) % 4]
}

// ---- Budgivningens tillstånd ----------------------------------------------

export interface ResolvedCall {
  seat: Seat
  bid: Bid
}

export interface AuctionState {
  /** Buden som redan ligger på bordet (manus + dina besvarade beslut). */
  resolved: ResolvedCall[]
  /** Det beslut det är din tur att ta just nu, eller null om budgivningen är klar. */
  current: Decision | null
  done: boolean
  totalDecisions: number
}

function isDecision(step: AuctionStep): step is { decision: Decision } {
  return 'decision' in step
}

/**
 * Räknar fram hur budgivningen ser ut när du har svarat på `numAnswered` av
 * dina beslut. Besvarade beslut fylls i med rätt bud (vi lär ut rätt linje).
 */
export function resolveAuction(ex: Exercise, numAnswered: number): AuctionState {
  const resolved: ResolvedCall[] = []
  let decisionsSeen = 0
  let current: Decision | null = null

  const totalDecisions = ex.auction.filter(isDecision).length

  for (let i = 0; i < ex.auction.length; i++) {
    const step = ex.auction[i]
    const seat = seatAt(ex.dealer, i)
    if (isDecision(step)) {
      if (decisionsSeen === numAnswered) {
        current = step.decision
        break
      }
      resolved.push({ seat, bid: step.decision.answer })
      decisionsSeen++
    } else {
      resolved.push({ seat, bid: step.bid })
    }
  }

  return { resolved, current, done: current === null, totalDecisions }
}
