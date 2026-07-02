import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCard, botCardSmart, mcBudget, usesMonteCarlo } from './play-bot'
import { isComplete, playCard, side, type Contract, type PlayState, type Trick } from './play'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const C = (s: Suit, r: Rank): Card => ({ suit: s, rank: r })
const key = (c: Card) => `${c.suit}${c.rank}`
const doneTrick = (): Trick => ({ leader: 'W', cards: [], winner: 'W' })

function fullDeck(): Card[] {
  const out: Card[] = []
  for (const s of SUITS) for (const r of RANKS) out.push({ suit: s, rank: r })
  return out
}

/**
 * Slutspel med `live` som återstående kort; övriga stoppas in som fyllnadsstick.
 * Sticken byggs så att bara de SYNLIGA platserna (N/S) kan råka få en "falsk
 * renons" av shownVoids – off-färgs-korten i ett stick läggs på N/S, medan de
 * dolda Ö/V bara får utspelsfärgen (följer alltid). Så förgiftas inte samplingen.
 */
function fabricate(live: Record<Seat, Hand>, declarer: Seat, strain: Contract['strain'], leader: Seat): PlayState {
  const liveKeys = new Set(Object.values(live).flat().map(key))
  const filler = fullDeck().filter((c) => !liveKeys.has(key(c)))
  filler.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)) // samla färger → mest mono
  const completedTricks: Trick[] = []
  for (let i = 0; i < filler.length; i += 4) {
    const chunk = filler.slice(i, i + 4)
    const counts = new Map<Suit, number>()
    for (const c of chunk) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1)
    let led = chunk[0].suit // utspelsfärg = den vanligaste i sticket
    for (const [s, n] of counts) if (n > (counts.get(led) ?? 0)) led = s
    const off = chunk.filter((c) => c.suit !== led) // högst 2 (sorterad → ≤2 färger/stick)
    const cards: { seat: Seat; card: Card }[] = []
    off.forEach((card, idx) => cards.push({ seat: (['N', 'S'] as Seat[])[idx], card })) // off → synliga
    const remaining = (['E', 'W', 'N', 'S'] as Seat[]).filter((s) => !cards.some((pc) => pc.seat === s))
    chunk.filter((c) => c.suit === led).forEach((card, idx) => cards.push({ seat: remaining[idx], card }))
    cards.sort((a, b) => (a.card.suit === led ? 0 : 1) - (b.card.suit === led ? 0 : 1)) // led-kort först
    completedTricks.push({ leader: 'N', cards, winner: 'N' })
  }
  return {
    contract: { declarer, strain, level: 1 },
    trump: strain === 'NT' ? null : strain,
    hands: live, leader, toAct: leader, currentTrick: [], completedTricks, tricksNS: 0, tricksEW: 0,
  }
}

/** Enkel state-byggare för de "oförändrat"-testerna (jfr play-bot.test.ts). */
function state(opts: {
  hand: Hand
  seat?: Seat
  completedTricks?: Trick[]
  otherHands?: Partial<Record<Seat, Hand>>
}): PlayState {
  const seat = opts.seat ?? 'S'
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [], ...opts.otherHands }
  hands[seat] = opts.hand
  return {
    contract: { declarer: 'N', strain: 'NT', level: 3 },
    trump: null, hands, leader: 'W', toAct: seat,
    currentTrick: [], completedTricks: opts.completedTricks ?? [], tricksNS: 0, tricksEW: 0,
  }
}

describe('botCardSmart – tumreglerna orörda utanför Monte-Carlo-fönstret', () => {
  it('öppningsutspel (trick 1) → identiskt med tumregeln (doktrin, ingen MC)', () => {
    const hand: Hand = [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '5'), C('hearts', 'A')]
    const s = state({ hand })
    expect(botCardSmart(s, 'S', [])).toEqual(botCard(s, 'S'))
  })

  it('bara ett lagligt kort → det kortet', () => {
    const s = state({ hand: [C('hearts', '7')] })
    expect(botCardSmart(s, 'S', [])).toEqual(C('hearts', '7'))
  })

  it('för många kort kvar (över MC-fönstret) → identiskt med tumregeln', () => {
    // 8 kort kvar, mitt i given (ett avslutat stick) → MC gated av, tumregler.
    const hand: Hand = (['A', 'K', 'Q', 'J', '9', '7', '5', '3'] as Rank[]).map((r) => C('spades', r))
    const s = state({ hand, completedTricks: [doneTrick()] })
    expect(botCardSmart(s, 'S', [], { maxCardsForMC: 7 })).toEqual(botCard(s, 'S'))
  })
})

// Tänjt MC-fönster (docs/bot-hjarna.md): adaptiv budget + gräns 8, MC körs i webworker.
describe('adaptiv MC-budget (mcBudget) – uppmätt kostnadstrappa', () => {
  it('färre kort = fler sampel (billigare → högre kvalitet)', () => {
    expect(mcBudget(5).samples).toBe(30)
    expect(mcBudget(6).samples).toBe(30)
    expect(mcBudget(7).samples).toBe(24)
    expect(mcBudget(8).samples).toBe(12)
  })
  it('sampelantalet är monotont icke-ökande med kortantalet', () => {
    const s = [4, 5, 6, 7, 8].map((n) => mcBudget(n).samples)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThanOrEqual(s[i - 1])
  })
})

describe('usesMonteCarlo – när gränssnittet ska räkna i webworkern', () => {
  const eight: Hand = (['A', 'K', 'Q', 'J', '9', '7', '5', '3'] as Rank[]).map((r) => C('spades', r))
  it('öppningsutspel (trick 1) → nej (utspelsdoktrin, ingen MC)', () => {
    expect(usesMonteCarlo(state({ hand: eight }), 'S')).toBe(false)
  })
  it('ett lagligt kort → nej', () => {
    expect(usesMonteCarlo(state({ hand: [C('hearts', '7')], completedTricks: [doneTrick()] }), 'S')).toBe(false)
  })
  it('8 kort mitt i given (inom fönstret) → ja', () => {
    expect(usesMonteCarlo(state({ hand: eight, completedTricks: [doneTrick()] }), 'S')).toBe(true)
  })
  it('9 kort (över fönstret) → nej', () => {
    const nine: Hand = (['A', 'K', 'Q', 'J', '9', '7', '5', '3', '2'] as Rank[]).map((r) => C('spades', r))
    expect(usesMonteCarlo(state({ hand: nine, completedTricks: [doneTrick()] }), 'S')).toBe(false)
  })
})

/** Deterministisk PRNG (mulberry32). MC-samplingen (`shuffled` i monte-carlo.ts)
 * drar ur Math.random – med 60 sampel valde röstningen fel kort för ~1 seed av 10
 * (flaky). Seedskanning (1–30): 60 sampel föll för 3/30, 100 sampel för 0/30.
 * Därför: 100 sampel (bär beviset för ALLA skannade seedar) + seedad ström
 * (reproducerbart). Samma ärliga sampling – ingen tjuvkik, inget motorbyte. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('botCardSmart – Monte-Carlo lyfter stickföringen i slutspelet (Steg 3c)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('6-korts NT-slutspel: MC-spelföraren tar facit 3 (tumregeln utan vakt tappade ett)', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    const live: Record<Seat, Hand> = {
      N: [C('spades', '8'), C('hearts', 'Q'), C('hearts', '6'), C('diamonds', 'Q'), C('diamonds', '5'), C('clubs', 'K')],
      E: [C('spades', '6'), C('hearts', '8'), C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', '10'), C('clubs', '2')],
      S: [C('hearts', 'K'), C('hearts', '10'), C('hearts', '2'), C('diamonds', '9'), C('diamonds', '7'), C('clubs', '5')],
      W: [C('spades', '10'), C('spades', '3'), C('spades', '2'), C('hearts', '5'), C('clubs', '8'), C('clubs', '3')],
    }
    const start = fabricate(live, 'S', 'NT', 'W')
    const nsTricks = (s: PlayState) => (side(s.contract.declarer) === 'NS' ? s.tricksNS : s.tricksEW)

    // Referens: alla platser tumregler. Historik: före kast-vakten (Steg B1,
    // docs/bot-hjarna.md) tappade tumregel-spelföraren ett stick här (2 av 3) –
    // vakten på spelförarsidans sakningar räddar det. Låst på facit 3.
    let ref = start
    while (!isComplete(ref)) ref = playCard(ref, botCard(ref, ref.toAct))
    expect(nsTricks(ref)).toBe(3)

    // Monte-Carlo på spelförarsidan, tumregler i försvaret → facit 3.
    let mc = start
    while (!isComplete(mc)) {
      const seat = mc.toAct
      const card = side(seat) === 'NS' ? botCardSmart(mc, seat, [], { samples: 100 }) : botCard(mc, seat)
      mc = playCard(mc, card)
    }
    expect(nsTricks(mc)).toBe(3)
  })
})
