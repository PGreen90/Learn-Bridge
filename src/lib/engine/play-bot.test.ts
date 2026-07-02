import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { botCard, botCardReasoned } from './play-bot'
import type { Contract, PlayedCard, PlayState, Trick } from './play'

const C = (suit: Suit, rank: Rank): Card => ({ suit, rank })

/** Ett avslutat stick (bara för att markera att given inte är på trick 1). */
const doneTrick = (winner: Seat = 'W'): Trick => ({ leader: winner, cards: [], winner })

/** Bygger ett kortspelsläge för att testa botCard i en viss situation. */
function state(opts: {
  trump?: Suit | null
  hand: Hand // den agerande platsens kort
  seat?: Seat // den agerande platsen (default S)
  trick?: PlayedCard[] // redan lagda kort i sticket
  leader?: Seat
  completedTricks?: Trick[] // avslutade stick (för att skilja mitt-i-given från utspel)
  declarer?: Seat // spelförare (default N)
  otherHands?: Partial<Record<Seat, Hand>> // t.ex. träkarlens kort
}): PlayState {
  const seat = opts.seat ?? 'S'
  const trump = opts.trump === undefined ? null : opts.trump
  const contract: Contract = { declarer: opts.declarer ?? 'N', strain: trump ?? 'NT', level: 3 }
  const hands: Record<Seat, Hand> = { N: [], E: [], S: [], W: [], ...opts.otherHands }
  hands[seat] = opts.hand
  return {
    contract,
    trump,
    hands,
    leader: opts.leader ?? 'W',
    toAct: seat,
    currentTrick: opts.trick ?? [],
    completedTricks: opts.completedTricks ?? [],
    tricksNS: 0,
    tricksEW: 0,
  }
}

describe('utspel – topp av sekvens, annars lågt från längsta', () => {
  it('KQJ i längsta färgen → spelar ut K (topp av sekvens)', () => {
    const hand: Hand = [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '5'), C('spades', '2'), C('hearts', 'A'), C('hearts', '8')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('spades', 'K'))
  })

  it('QJ10 → spelar ut Q (cheapest topp-sekvens med honnör)', () => {
    const hand: Hand = [C('diamonds', 'Q'), C('diamonds', 'J'), C('diamonds', '10'), C('diamonds', '3'), C('clubs', 'A')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('diamonds', 'Q'))
  })

  it('längsta färgen utan sekvens → lågt (4th-best-ish, ej honnör)', () => {
    const hand: Hand = [C('hearts', 'A'), C('hearts', '8'), C('hearts', '7'), C('hearts', '6'), C('hearts', '5'), C('spades', 'K'), C('spades', 'Q')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('hearts', '5'))
  })

  it('jämn 4-korts utan honnör (7654) → 3:e bästa (§8.3), ej honnörssekvens', () => {
    const hand: Hand = [C('clubs', '7'), C('clubs', '6'), C('clubs', '5'), C('clubs', '4'), C('diamonds', 'A')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('clubs', '5'))
  })
})

describe('Steg 1 – ärlig stickföring: cash:a säkra vinnare på lead', () => {
  it('sang, inne mitt i given: cashar HA i stället för lågt ur längsta färgen', () => {
    // Längsta färg = spader (S7654, ingen honnör) → gamla botten ledde lågt spader.
    // Men HA/HK/HQ är säkra vinnare → cash:a esset först, ta stick där stick finns.
    const hand: Hand = [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q'), C('spades', '7'), C('spades', '6'), C('spades', '5'), C('spades', '4')]
    expect(botCard(state({ hand, completedTricks: [doneTrick()] }), 'S')).toEqual(C('hearts', 'A'))
  })

  it('trumfkontrakt: cashar toppen av trumf (SA) när man är inne', () => {
    const hand: Hand = [C('spades', 'A'), C('hearts', '4'), C('diamonds', '3'), C('clubs', '2')]
    expect(botCard(state({ trump: 'spades', hand, completedTricks: [doneTrick()] }), 'S')).toEqual(C('spades', 'A'))
  })

  it('cashar INTE ett icke-topp-kort (HA fortfarande ute) → leder normalt', () => {
    // HK är ingen säker vinnare (HA ospelad + ej på hand). Längsta = klöver 7654
    // utan honnör → utspelsvalet 3:e bästa (C5), inte HK.
    const hand: Hand = [C('hearts', 'K'), C('hearts', '2'), C('clubs', '7'), C('clubs', '6'), C('clubs', '5'), C('clubs', '4')]
    expect(botCard(state({ hand, completedTricks: [doneTrick()] }), 'S')).toEqual(C('clubs', '5'))
  })

  it('på ÄKTA utspel (trick 1, inga avslutade stick) cashar man inte – utspelsdoktrin', () => {
    // Samma hand som första testet men på utspelet → längsta färg-doktrin gäller,
    // inte cash-out (annars underleder man ess på utspelet).
    const hand: Hand = [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q'), C('spades', '7'), C('spades', '6'), C('spades', '5'), C('spades', '4')]
    expect(botCard(state({ hand }), 'S')).toEqual(C('spades', '5'))
  })
})

describe('Steg 1b – cash:a sidofärgsvinnare när trumfen är räknad', () => {
  // Spelförare S, träkarl N. S har ♥A (sidofärgsvinnare) + ♠2 + låga ruter.
  const declHand: Hand = [C('hearts', 'A'), C('spades', '2'), C('diamonds', '5'), C('diamonds', '4'), C('diamonds', '3')]

  it('alla trumf räknade (syns hos spelförarsidan) → cashar ♥A trots trumfkontrakt', () => {
    // Träkarl N håller de 12 övriga spadren → 0 osedda trumf, ingen kan ruffa.
    const dummySpades: Hand = (['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3'] as const).map((r) => C('spades', r))
    const s = state({
      trump: 'spades', declarer: 'S', seat: 'S', hand: declHand,
      otherHands: { N: dummySpades }, completedTricks: [doneTrick()],
    })
    expect(botCard(s, 'S')).toEqual(C('hearts', 'A'))
  })

  it('trumf fortfarande ute → cashar INTE ♥A (kan ruffas), leder normalt', () => {
    // Träkarl har bara en spader → 11 osedda trumf → sidofärg osäker.
    const s = state({
      trump: 'spades', declarer: 'S', seat: 'S', hand: declHand,
      otherHands: { N: [C('spades', '3')] }, completedTricks: [doneTrick()],
    })
    const chosen = botCard(s, 'S')
    expect(chosen).not.toEqual(C('hearts', 'A')) // inte den ruffbara vinnaren
    expect(chosen.suit).toBe('diamonds') // leder lågt ur längsta färgen i stället
  })
})

describe('andra hand lågt', () => {
  it('motståndaren leder, bot näst på tur med Kx → lägger lågt, inte K', () => {
    // V leder hjärter 5; N (andra hand, motståndare till V) följer.
    const s = state({
      seat: 'N',
      leader: 'W',
      trick: [{ seat: 'W', card: C('hearts', '5') }],
      hand: [C('hearts', 'K'), C('hearts', '3')],
    })
    expect(botCard(s, 'N')).toEqual(C('hearts', '3'))
  })
})

describe('tredje hand – vinn billigast', () => {
  it('partnern leder, motståndaren övertar, 3:e hand vinner med billigaste vinnaren', () => {
    // S leder H4 (partner till N), V lägger H9 (övertar), N (3:e hand) på tur.
    const s = state({
      seat: 'N',
      leader: 'S',
      trick: [
        { seat: 'S', card: C('hearts', '4') },
        { seat: 'W', card: C('hearts', '9') },
      ],
      hand: [C('hearts', 'K'), C('hearts', 'Q'), C('hearts', '2')],
    })
    expect(botCard(s, 'N')).toEqual(C('hearts', 'Q')) // billigaste kortet som slår 9
  })
})

describe('aldrig ruffa partnerns vinnande stick', () => {
  it('partnern leder ess och vinner; renons → kastar lågt sidokort, ruffar inte', () => {
    // Trumf = spader. S spelar HA (vinner), V lägger H2. N renons i hjärter med
    // trumf S2 + klöver C3 → ska kasta C3, inte trumfa partnerns vinnare.
    const s = state({
      seat: 'N',
      trump: 'spades',
      leader: 'S',
      trick: [
        { seat: 'S', card: C('hearts', 'A') },
        { seat: 'W', card: C('hearts', '2') },
      ],
      hand: [C('spades', '2'), C('clubs', '3')],
    })
    expect(botCard(s, 'N')).toEqual(C('clubs', '3'))
  })
})

// "Varför?"-knappen (docs/bot-hjarna.md): botCardReasoned ger SAMMA kort som
// botCard + en klartextsmotivering som matchar den tumregel som slog till.
describe('botCardReasoned – kort + förklaring (Varför?-knappen)', () => {
  const spadesSeq: Hand = [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '5'), C('hearts', 'A'), C('hearts', '8'), C('hearts', '3')]

  it('samma kort som botCard, alltid en icke-tom motivering', () => {
    const s = state({ hand: spadesSeq })
    const r = botCardReasoned(s, 'S')
    expect(r.card).toEqual(botCard(s, 'S'))
    expect(r.reason.length).toBeGreaterThan(0)
  })

  it('utspel med honnörssekvens → förklaring nämner utspel + topp av sekvens', () => {
    const r = botCardReasoned(state({ hand: spadesSeq }), 'S')
    expect(r.card).toEqual(C('spades', 'K'))
    expect(r.reason).toContain('Utspel')
    expect(r.reason).toContain('honnörssekvensen')
  })

  it('andra hand mot motståndaren → "Andra hand lågt"', () => {
    const s = state({
      seat: 'N', leader: 'E',
      trick: [{ seat: 'E', card: C('diamonds', '5') }],
      hand: [C('diamonds', 'K'), C('diamonds', '4'), C('clubs', '2')],
    })
    const r = botCardReasoned(s, 'N')
    expect(r.card).toEqual(C('diamonds', '4'))
    expect(r.reason).toContain('Andra hand lågt')
  })

  it('partnern vinner redan (motspel) → förklaring nämner att vi inte ruffar partnern', () => {
    // Spelförare Ö ⇒ N/S är motspelare: motspelets gamla "kasta lågt"-gren gäller
    // (kast-vakten, Steg B1, är bara spelförarsidans – den ser båda händerna).
    const s = state({
      seat: 'N', trump: 'spades', leader: 'S', declarer: 'E',
      trick: [{ seat: 'S', card: C('hearts', 'A') }, { seat: 'W', card: C('hearts', '2') }],
      hand: [C('spades', '2'), C('clubs', '3')],
    })
    const r = botCardReasoned(s, 'N')
    expect(r.card).toEqual(C('clubs', '3'))
    expect(r.reason).toContain('ruffar aldrig')
  })

  it('spelförarsidan sakar → kast-vakten förklarar att hotkorten vaktas (Steg B1)', () => {
    // Samma läge men N är träkarl (spelförare S) ⇒ kast-vakten väljer sakningen.
    // Den ruffar fortfarande aldrig partnern (trumfen är aldrig kandidat).
    const s = state({
      seat: 'N', trump: 'spades', leader: 'S', declarer: 'S',
      trick: [{ seat: 'S', card: C('hearts', 'A') }, { seat: 'W', card: C('hearts', '2') }],
      hand: [C('spades', '2'), C('clubs', '3')],
    })
    const r = botCardReasoned(s, 'N')
    expect(r.card).toEqual(C('clubs', '3'))
    expect(r.reason).toContain('vaktar')
  })
})
