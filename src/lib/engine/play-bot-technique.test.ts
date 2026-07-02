// Avancerad kortspelsteknik (docs/bot-hjarna.md, trappan Steg A): facit-lås på
// att Monte-Carlo-DDS:en EXEKVERAR avancerad teknik i slutspelsfönstret –
// korsruff med lönnkast (A0), slutkast/inkast (A1) och enkel skvis (A2).
// DDS:en ser tekniken i varje sampel och röstningen gynnar linjer som fungerar i
// ALLA troliga lägen – därför hittar botten dem utan tjuvkik. Tumreglerna (som
// bara cashar säkra vinnare) tappar stick → testerna bevisar skillnaden.
//
// FACIT FÖRE FIX: varje giv verifieras först mot DDS-oraklet
// (doubleDummyDeclarerRemaining) så positionen BEVISAT innehåller tekniken.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCard, botCardSmart } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { currentWinner, isComplete, playCard, side, type Contract, type PlayState, type Trick } from './play'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const C = (s: Suit, r: Rank): Card => ({ suit: s, rank: r })
const key = (c: Card) => `${c.suit}${c.rank}`

function fullDeck(): Card[] {
  const out: Card[] = []
  for (const s of SUITS) for (const r of RANKS) out.push({ suit: s, rank: r })
  return out
}

/**
 * Slutspel med `live` som återstående kort (jfr play-bot-smart.test.ts): övriga
 * kort stoppas in som fyllnadsstick, byggda så att bara de SYNLIGA platserna
 * (N/S) kan få en "falsk renons" av shownVoids – de dolda Ö/V följer alltid färg
 * i fyllnadssticken, så samplingen förgiftas inte. VIKTIGT: Syd spelar första
 * kortet i första fyllnadssticket – signalavkodningen (signal-decode.ts) läser
 * "öppningsutspelet" ur completedTricks[0] och människans (Syds) utspel avkodas
 * aldrig, så det fabricerade sticket kan inte förgifta hand-modellen.
 */
function fabricate(live: Record<Seat, Hand>, declarer: Seat, strain: Contract['strain'], leader: Seat): PlayState {
  const liveKeys = new Set(Object.values(live).flat().map(key))
  const filler = fullDeck().filter((c) => !liveKeys.has(key(c)))
  filler.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))
  const completedTricks: Trick[] = []
  for (let i = 0; i < filler.length; i += 4) {
    const chunk = filler.slice(i, i + 4)
    const counts = new Map<Suit, number>()
    for (const c of chunk) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1)
    let led = chunk[0].suit
    for (const [s, n] of counts) if (n > (counts.get(led) ?? 0)) led = s
    const off = chunk.filter((c) => c.suit !== led)
    const cards: { seat: Seat; card: Card }[] = []
    off.forEach((card, idx) => cards.push({ seat: (['N', 'S'] as Seat[])[idx], card }))
    const remaining = (['S', 'N', 'E', 'W'] as Seat[]).filter((s) => !cards.some((pc) => pc.seat === s))
    chunk.filter((c) => c.suit === led).forEach((card, idx) => cards.push({ seat: remaining[idx], card }))
    cards.sort((a, b) => (a.card.suit === led ? 0 : 1) - (b.card.suit === led ? 0 : 1))
    completedTricks.push({ leader: 'N', cards, winner: 'N' })
  }
  return {
    contract: { declarer, strain, level: 1 },
    trump: strain === 'NT' ? null : strain,
    hands: live, leader, toAct: leader, currentTrick: [], completedTricks, tricksNS: 0, tricksEW: 0,
  }
}

/** Deterministisk PRNG (mulberry32) – samma stabilisering som i play-bot-smart.test.ts. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Spela ut hela given: NS-platserna med MC-hjärnan, ÖV med tumregler. */
function playOutSmartNS(start: PlayState): number {
  let s = start
  while (!isComplete(s)) {
    const seat = s.toAct
    const card = side(seat) === 'NS' ? botCardSmart(s, seat, [], { samples: 100 }) : botCard(s, seat)
    s = playCard(s, card)
  }
  return side(start.contract.declarer) === 'NS' ? s.tricksNS : s.tricksEW
}

/** Spela ut hela given: alla fyra platser med tumregler (referenslinjen). */
function playOutAllBasic(start: PlayState): number {
  let s = start
  while (!isComplete(s)) s = playCard(s, botCard(s, s.toAct))
  return side(start.contract.declarer) === 'NS' ? s.tricksNS : s.tricksEW
}

describe('Steg A0 – korsruff med lönnkast: MC tar alla stick där tumregeln cashar rakt', () => {
  afterEach(() => vi.restoreAllMocks())

  // 6-korts slutspel, spader trumf, Syd spelförare och inne. Motståndarna är
  // uttrumfade. Facit är ALLA sex sticken, men de kräver äkta teknik: på ♦E
  // sakar Nord ♥8 (lönnkast!), sedan ruffas Syds ♥7 hos Nord, Nords klöver hos
  // Syd, och ♦D ruffas över Östs täckande kung (Nord är renons i ruter). Rakt
  // cashande (tumregeln) ger bara 5 – hjärtern förloras alltid.
  const live: Record<Seat, Hand> = {
    S: [C('spades', 'A'), C('spades', 'K'), C('spades', 'Q'), C('hearts', '7'), C('diamonds', 'A'), C('diamonds', 'Q')],
    N: [C('spades', '4'), C('spades', '3'), C('spades', '2'), C('hearts', '8'), C('clubs', '3'), C('clubs', '2')],
    W: [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q'), C('diamonds', '10'), C('clubs', '10'), C('clubs', '9')],
    E: [C('diamonds', 'K'), C('diamonds', 'J'), C('clubs', 'A'), C('clubs', 'K'), C('clubs', 'Q'), C('clubs', 'J')],
  }

  it('DDS-facit: positionen ger 6 av 6 med perfekt spel (korsruffen finns)', () => {
    const start = fabricate(live, 'S', 'spades', 'S')
    expect(doubleDummyDeclarerRemaining(start.hands, 'spades', 'S', [], 'S', Infinity)).toBe(6)
  })

  it('tumregeln cashar rakt och tappar hjärtersticket → 5 (referens – luckan)', () => {
    const start = fabricate(live, 'S', 'spades', 'S')
    expect(playOutAllBasic(start)).toBe(5)
  })

  // Rymlig timeout: MC-utspelningen är billig ensam (<1 s) men kan ta ~10 s
  // när hela sviten kör parallellt och delar CPU.
  it('MC-spelföraren korsruffar och tar facit 6', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    const start = fabricate(live, 'S', 'spades', 'S')
    expect(playOutSmartNS(start)).toBe(6)
  }, 60_000)
})

describe('Steg A1 – slutkast/inkast: MC spelar strip & exit (tumregeln maskar bort sticket)', () => {
  afterEach(() => vi.restoreAllMocks())

  // 6-korts slutspel, spader trumf, Syd spelförare och inne. Öst har VISAT
  // renons i ruter (sakade klöver på ett tidigare ruterstick) → hand-modellen
  // tvingar ♦K/♦kn till Väst i varje sampel – äkta inferens, ingen tjuvkik.
  // Rakt spel ger 4: ♦D sitter alltid bakom Västs garderade ♦K (ingen ingång
  // till Nord för mask, och Öst kan aldrig spela ruter genom gaffeln – renons).
  // Facit 5 nås bara via SLUTKASTET: cash:a topparna, släpp sedan ♥7 – Väst är
  // inne och måste antingen spela ruter in i ♦E-D, ge ruff-och-släng, eller
  // låta Nord ruffa över ♦K (Nord blir ruterrenons efter ♦E). Handordningen i
  // Syd (♦E först) är medveten: tumregel-referensen cashar då ♦E innan trumfen
  // så Väst FÖLJER med ♦kn i stället för att hinna saka bort gardens täckkort.
  const live: Record<Seat, Hand> = {
    S: [C('diamonds', 'A'), C('diamonds', 'Q'), C('spades', 'A'), C('spades', 'K'), C('spades', 'Q'), C('hearts', '7')],
    N: [C('spades', '4'), C('spades', '3'), C('spades', '2'), C('hearts', '8'), C('diamonds', '5'), C('clubs', '2')],
    W: [C('hearts', 'A'), C('hearts', 'K'), C('hearts', '10'), C('diamonds', 'K'), C('diamonds', 'J'), C('clubs', '5')],
    E: [C('clubs', 'A'), C('clubs', 'K'), C('clubs', 'Q'), C('clubs', 'J'), C('clubs', '8'), C('clubs', '7')],
  }

  /** Handbyggda fyllnadsstick: Öst visar ruterrenons ÄRLIGT (trick 1, lett av
   * Syd = avkodas aldrig av signal-avkodaren) och spelar aldrig ruter senare. */
  function startState(): PlayState {
    const T = (plays: [Seat, Suit, Rank][]): Trick => {
      const cards = plays.map(([seat, s, r]) => ({ seat, card: C(s, r) }))
      return { leader: cards[0].seat, cards, winner: currentWinner(cards, 'spades') }
    }
    const completedTricks: Trick[] = [
      T([['S', 'diamonds', '10'], ['W', 'diamonds', '9'], ['N', 'diamonds', '8'], ['E', 'clubs', '4']]), // Öst: renons ruter!
      T([['E', 'spades', 'J'], ['W', 'spades', '10'], ['N', 'spades', '9'], ['S', 'spades', '8']]),
      T([['E', 'spades', '7'], ['W', 'spades', '6'], ['S', 'spades', '5'], ['N', 'diamonds', '7']]),
      T([['E', 'hearts', 'Q'], ['W', 'hearts', 'J'], ['N', 'hearts', '9'], ['S', 'hearts', '6']]),
      T([['E', 'hearts', '5'], ['W', 'hearts', '4'], ['N', 'hearts', '3'], ['S', 'hearts', '2']]),
      T([['W', 'diamonds', '6'], ['N', 'diamonds', '4'], ['S', 'diamonds', '3'], ['E', 'clubs', '3']]),
      T([['E', 'clubs', '10'], ['W', 'clubs', '9'], ['N', 'clubs', '6'], ['S', 'diamonds', '2']]),
    ]
    return {
      contract: { declarer: 'S', strain: 'spades', level: 1 },
      trump: 'spades',
      hands: live, leader: 'S', toAct: 'S', currentTrick: [], completedTricks, tricksNS: 0, tricksEW: 0,
    }
  }

  it('sanity: fyllnadssticken + de levande händerna är exakt hela leken', () => {
    const start = startState()
    const all = [
      ...Object.values(start.hands).flat(),
      ...start.completedTricks.flatMap((t) => t.cards.map((pc) => pc.card)),
    ]
    expect(all.length).toBe(52)
    expect(new Set(all.map(key)).size).toBe(52)
  })

  it('DDS-facit: positionen ger 5 av 6 med perfekt spel (slutkastet finns)', () => {
    const start = startState()
    expect(doubleDummyDeclarerRemaining(start.hands, 'spades', 'S', [], 'S', Infinity)).toBe(5)
  })

  it('tumregeln cashar och lämnar ♦D under kungen → 4 (referens – luckan)', () => {
    const start = startState()
    expect(playOutAllBasic(start)).toBe(4)
  })

  it('MC-spelföraren spelar slutkastet och tar facit 5', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    const start = startState()
    expect(playOutSmartNS(start)).toBe(5)
  }, 60_000)
})

describe('Steg B – kast-vakten bevarar positionen FÖRE MC-fönstret (B0/B1)', () => {
  afterEach(() => vi.restoreAllMocks())

  // 9-korts NT-slutspel, Syd spelförare, Väst inne och cashar ♣EKD. Nord
  // (renons i klöver) måste saka TRE gånger – den FÖRSTA vid 9 kort ligger
  // UTANFÖR MC-fönstret (≤8) och avgörs av tumregeln. Positionen rymmer 6 stick
  // (♦EKD + ♠E + ♥E + ett skvisstick: Väst kan inte vakta både ♠K4 och ♥K4 mot
  // Nords ♠E5/♥E5 på Syds sista ruter). Gamla tumregeln ("kasta lägst") sakade
  // ♠5 → facit föll till 5 INNAN hjärnan ens fick ta över. Kast-vakten (B1,
  // `guardedDiscard` i play-bot.ts) räknar ärligt: ♠5 är lastbärande (bara ♠K
  // osedd och ♠E drar ut den) medan ♥5 inte är det (♥K OCH ♥6 osedda) och
  // ruterhackorna är rent överskott under EKD – vakten sakar rätt och facit 6
  // överlever. Öst-detaljer som gör given ärlig: ♥6 (täcker Västs ♥4-utspel =
  // inget inkast-plan B), ♦kn10xx (kapar Nords ruterhackor = inga längdstick).
  const live: Record<Seat, Hand> = {
    S: [C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', 'Q'), C('spades', '2'), C('hearts', '2'), C('clubs', '5'), C('clubs', '4'), C('clubs', '3'), C('clubs', '2')],
    N: [C('spades', 'A'), C('spades', '5'), C('hearts', 'A'), C('hearts', '5'), C('diamonds', '9'), C('diamonds', '8'), C('diamonds', '7'), C('diamonds', '6'), C('diamonds', '5')],
    W: [C('spades', 'K'), C('spades', '4'), C('spades', '3'), C('hearts', 'K'), C('hearts', '4'), C('diamonds', '2'), C('clubs', 'A'), C('clubs', 'K'), C('clubs', 'Q')],
    E: [C('hearts', '6'), C('diamonds', 'J'), C('diamonds', '10'), C('diamonds', '4'), C('diamonds', '3'), C('clubs', 'J'), C('clubs', '10'), C('clubs', '9'), C('clubs', '8')],
  }

  /** Handbyggda fyllnadsstick: Syd leder trick 1 (signalvakt); Ö/V visar aldrig
   * en falsk renons (Östs ♣-sakning i stick 2 är hans äkta spaderrenons). */
  function startState(): PlayState {
    const T = (plays: [Seat, Suit, Rank][]): Trick => {
      const cards = plays.map(([seat, s, r]) => ({ seat, card: C(s, r) }))
      return { leader: cards[0].seat, cards, winner: currentWinner(cards, null) }
    }
    const completedTricks: Trick[] = [
      T([['S', 'spades', 'Q'], ['W', 'spades', 'J'], ['N', 'spades', '10'], ['E', 'spades', '9']]),
      T([['S', 'spades', '8'], ['W', 'spades', '7'], ['N', 'spades', '6'], ['E', 'clubs', '7']]), // Öst: äkta ♠-renons
      T([['S', 'hearts', 'Q'], ['W', 'hearts', 'J'], ['N', 'hearts', '10'], ['E', 'hearts', '9']]),
      T([['S', 'hearts', '8'], ['W', 'hearts', '7'], ['N', 'clubs', '6'], ['E', 'hearts', '3']]),
    ]
    return {
      contract: { declarer: 'S', strain: 'NT', level: 1 },
      trump: null,
      hands: live, leader: 'W', toAct: 'W', currentTrick: [], completedTricks, tricksNS: 0, tricksEW: 0,
    }
  }

  it('sanity: fyllnadssticken + de levande händerna är exakt hela leken', () => {
    const start = startState()
    const all = [
      ...Object.values(start.hands).flat(),
      ...start.completedTricks.flatMap((t) => t.cards.map((pc) => pc.card)),
    ]
    expect(all.length).toBe(52)
    expect(new Set(all.map(key)).size).toBe(52)
  })

  it('DDS-facit: positionen ger 6 av 9 med perfekt spel (skvisen finns)', () => {
    const start = startState()
    expect(doubleDummyDeclarerRemaining(start.hands, 'NT', 'S', [], 'W', Infinity)).toBe(6)
  })

  it('facit-lås: ♠5 är lastbärande – sakas den faller facit till 5 (♥5/ruter ofarliga)', () => {
    let s = startState()
    s = playCard(s, C('clubs', 'A')) // Väst cashar första klövern
    const ddAfter = (pitch: Card) => {
      const next = playCard(s, pitch)
      return doubleDummyDeclarerRemaining(next.hands, 'NT', 'S', next.currentTrick, next.toAct, Infinity)
    }
    expect(ddAfter(C('spades', '5'))).toBe(5) // gamla tumregelns val – luckan B1 stänger
    expect(ddAfter(C('hearts', '5'))).toBe(6)
    expect(ddAfter(C('diamonds', '5'))).toBe(6)
  })

  it('B1 kast-vakten: Nords första sakning (vid 9 kort, utanför MC) bevarar facit 6', () => {
    let s = startState()
    s = playCard(s, C('clubs', 'A'))
    const pitch = botCardSmart(s, 'N', []) // 9 kort > MC-fönstret → tumregeln m. kast-vakt
    const next = playCard(s, pitch)
    expect(doubleDummyDeclarerRemaining(next.hands, 'NT', 'S', next.currentTrick, next.toAct, Infinity)).toBe(6)
  })

  it('hela utspelningen: både tumregel-laget och MC-laget landar på facit 6', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    expect(playOutAllBasic(startState())).toBe(6)
    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    expect(playOutSmartNS(startState())).toBe(6)
  }, 120_000)
})

describe('Steg A2 – enkel skvis: MC pressar Väst på skviskortet (tumregeln släpper hotet)', () => {
  afterEach(() => vi.restoreAllMocks())

  // 4-korts NT-slutspel, Syd spelförare och inne. Väst vaktar BÅDA hotfärgerna
  // (♠K4 + ♥K4 mot Nords ♠E5 + ♥E5). ♦E är skviskortet: vad Väst än släpper
  // blir motsvarande femma i Nord ett stick (esset fäller den ogarderade
  // kungen, femman är sedan högst – Öst har varken spader eller hjärter kvar).
  // Utan skvisen finns bara 3 stick (♦E + två ess). Nords AVKAST på ♦E är
  // nyckelbeslutet: MC räknar ärligt (bara EN spader är osedd när Väst släppt
  // ♠4, men TVÅ hjärter → behåll ♠E5, släng hjärterfemman) – tumregeln kastar
  // "lägst" och river sitt eget hot.
  const live: Record<Seat, Hand> = {
    S: [C('diamonds', 'A'), C('spades', '2'), C('hearts', '2'), C('clubs', '2')],
    N: [C('spades', 'A'), C('spades', '5'), C('hearts', 'A'), C('hearts', '5')],
    W: [C('spades', 'K'), C('spades', '4'), C('hearts', 'K'), C('hearts', '4')],
    E: [C('diamonds', 'K'), C('diamonds', 'Q'), C('clubs', 'A'), C('clubs', 'K')],
  }

  it('DDS-facit: positionen ger 4 av 4 med perfekt spel (skvisen finns)', () => {
    const start = fabricate(live, 'S', 'NT', 'S')
    expect(doubleDummyDeclarerRemaining(start.hands, 'NT', 'S', [], 'S', Infinity)).toBe(4)
  })

  it('tumregeln kastar fel på skviskortet och tar bara 3 (referens – luckan)', () => {
    const start = fabricate(live, 'S', 'NT', 'S')
    expect(playOutAllBasic(start)).toBe(3)
  })

  it('MC-spelföraren behåller rätt hot och tar facit 4', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(1))
    const start = fabricate(live, 'S', 'NT', 'S')
    expect(playOutSmartNS(start)).toBe(4)
  }, 60_000)
})
