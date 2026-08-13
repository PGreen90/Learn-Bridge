import { describe, expect, it } from 'vitest'
import type { Card, Deal, Hand, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botCard, botCardReasoned, botCardSmart } from './play-bot'
import { playCard, startPlay, type Contract, type PlayedCard, type PlayState, type Trick } from './play'
import { doubleDummyDeclarerRemaining } from './dds'

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
  level?: number // kontraktsnivå (default 3; sätt 6 för slam-tester)
}): PlayState {
  const seat = opts.seat ?? 'S'
  const trump = opts.trump === undefined ? null : opts.trump
  const contract: Contract = { declarer: opts.declarer ?? 'N', strain: trump ?? 'NT', level: opts.level ?? 3 }
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

// Utspelsbugg (ägaren, 2026-08): mot ett TRUMFKONTRAKT (extra dyrt mot slam)
// underledde boten sitt ess – längsta färgen ♣AQJxx föll till spotkort (5:e bästa)
// och ledde lågt UNDER esset. Doktrin: underled aldrig ett ess mot ett
// trumfkontrakt. Facit FÖRE fix.
describe('utspel mot trumfkontrakt – underled aldrig ett ess', () => {
  it('♣AQJ98 längst mot slam → leder INTE lågt under esset (byter till ♠KQJ2-sekvensen)', () => {
    const hand: Hand = [
      C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '2'),
      C('hearts', '4'), C('hearts', '3'),
      C('diamonds', '4'), C('diamonds', '3'),
      C('clubs', 'A'), C('clubs', 'Q'), C('clubs', 'J'), C('clubs', '9'), C('clubs', '8'),
    ]
    // Längsta färgen (♣AQJ98) skulle underleda esset → byt till längsta SÄKRA
    // färgen ♠KQJ2 och toppa sekvensen (♠K).
    expect(botCard(state({ trump: 'hearts', level: 6, hand }), 'S')).toEqual(C('spades', 'K'))
  })

  it('alla färger har ett oskyddat ess → cashar esset i längsta färgen, underleder inte', () => {
    const hand: Hand = [
      C('spades', 'A'), C('spades', '4'), C('spades', '3'), C('spades', '2'),
      C('hearts', 'A'), C('hearts', '3'), C('hearts', '2'),
      C('diamonds', 'A'), C('diamonds', '3'), C('diamonds', '2'),
      C('clubs', 'A'), C('clubs', '3'), C('clubs', '2'),
    ]
    // Var färg (alla 3+ kort, inga dubbelton-ess) skulle underleda ett ess → led
    // esset i längsta färgen (♠A) i stället.
    expect(botCard(state({ trump: 'hearts', level: 6, hand }), 'S')).toEqual(C('spades', 'A'))
  })

  it('SANG oförändrat: ♣A8765 underleder esset som förr (5:e bästa, §8.3)', () => {
    const hand: Hand = [
      C('clubs', 'A'), C('clubs', '8'), C('clubs', '7'), C('clubs', '6'), C('clubs', '5'),
      C('spades', 'K'), C('spades', '2'),
    ]
    // Utan trumf gäller klassisk längsta-färg-doktrin (ess-underspel OK i sang):
    // ingen sekvens → 5:e bästa = ♣5.
    expect(botCard(state({ hand }), 'S')).toEqual(C('clubs', '5'))
  })

  // Hål E (docs/utspel-teori.md §2): mot SANG väljs längsta OCH starkaste färgen
  // (längd primärt; vid lika längd starkast; vid lika styrka högfärg).
  it('hål E – SANG: två 5-korts, leder den STARKARE (♥KQJ54, inte ♣87654)', () => {
    const hand: Hand = [
      C('clubs', '8'), C('clubs', '7'), C('clubs', '6'), C('clubs', '5'), C('clubs', '4'),
      C('hearts', 'K'), C('hearts', 'Q'), C('hearts', 'J'), C('hearts', '5'), C('hearts', '3'),
      C('diamonds', 'A'), C('diamonds', '3'), C('diamonds', '2'),
    ]
    expect(botCard(state({ hand }), 'S')).toEqual(C('hearts', 'K'))
  })

  it('hål E – SANG: lika längd & styrka → HÖGfärg (♠, inte ♣)', () => {
    const hand: Hand = [
      C('clubs', '9'), C('clubs', '6'), C('clubs', '5'), C('clubs', '4'),
      C('spades', '9'), C('spades', '6'), C('spades', '5'), C('spades', '4'),
      C('diamonds', 'A'), C('diamonds', '3'), C('diamonds', '2'),
      C('hearts', 'A'), C('hearts', '2'),
    ]
    // Båda 4-korts utan honnör → föredra spader (högfärg). 3:e bästa = ♠5.
    expect(botCard(state({ hand }), 'S')).toEqual(C('spades', '5'))
  })

  it('hål E – SANG: längd slår styrka (5-korts svag ♣ före 4-korts stark ♠KQJ2)', () => {
    const hand: Hand = [
      C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '2'),
      C('clubs', '8'), C('clubs', '7'), C('clubs', '6'), C('clubs', '5'), C('clubs', '4'),
      C('diamonds', 'A'), C('diamonds', '3'),
      C('hearts', 'A'), C('hearts', '2'),
    ]
    // Längsta färgen (♣ 5 kort) leds trots att ♠KQJ2 är starkare. 5:e bästa = ♣4.
    expect(botCard(state({ hand }), 'S')).toEqual(C('clubs', '4'))
  })

  // Hål F: mitt-i-given (jag är inne och leder ur längsta färgen) fick förr underleda
  // ett ess mot trumf – ess-regeln gällde bara trick 1. Nu samma regel överallt.
  it('hål F – mitt-i-given: leder INTE lågt under esset ur längsta färgen mot trumf', () => {
    const hand: Hand = [
      C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '2'),
      C('hearts', '4'), C('hearts', '3'),
      C('diamonds', '4'), C('diamonds', '3'),
      C('clubs', 'A'), C('clubs', '9'), C('clubs', '8'), C('clubs', '7'), C('clubs', '6'),
    ]
    // Försvarare S är inne mitt i given (spelförare Öst), inga säkra vinnare att
    // casha → leder ur längsta färgen. ♣A9876 skulle underleda esset → byt till
    // ♠KQJ-sekvensen.
    const st = state({
      trump: 'hearts', level: 4, hand, declarer: 'E',
      completedTricks: [doneTrick('S')], leader: 'S',
    })
    expect(botCard(st, 'S')).toEqual(C('spades', 'K'))
  })
})

// Hål A+G (docs/utspel-teori.md §1/§2/§4): budgivningen styr utspelet. Går bara via
// botCardSmart (som får `calls`); botCard/botCardReasoned är budblinda som förr.
// Kort-notation för bud: "1H", "3NT", "pass". Facit FÖRE fix.
describe('utspel hål A+G – budgivningen styr', () => {
  const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

  // Ägarens giv: ♠KJ843 ♥Q10 ♦1083 ♣A82.
  const ownerHand: Hand = [
    C('spades', 'K'), C('spades', 'J'), C('spades', '8'), C('spades', '4'), C('spades', '3'),
    C('hearts', 'Q'), C('hearts', '10'),
    C('diamonds', '10'), C('diamonds', '8'), C('diamonds', '3'),
    C('clubs', 'A'), C('clubs', '8'), C('clubs', '2'),
  ]

  it('KJ843 mot 4♥: leder INTE bort från KJ-tenassen → passivt ♦3 (hål G)', () => {
    // Syd bjöd hjärter (trumf/motståndarfärg), Nord höjde. Väst leder.
    const calls = [call('S', '1H'), call('W', 'pass'), call('N', '4H'), call('E', 'pass')]
    const st = state({ trump: 'hearts', level: 4, declarer: 'S', seat: 'W', leader: 'W', hand: ownerHand })
    // Safe passiv färg = ♦1083 (ingen honnör att leda bort från). Inte ♠ (KJ-tenass),
    // inte ♣ (ess-underspel), inte ♥ (deras trumf).
    expect(botCardSmart(st, 'W', calls)).toEqual(C('diamonds', '3'))
  })

  it('samma hand mot 3NT (ingen färg visad): längst & starkast → ♠3', () => {
    const calls = [call('S', '1NT'), call('W', 'pass'), call('N', '3NT'), call('E', 'pass')]
    const st = state({ trump: null, level: 3, declarer: 'S', seat: 'W', leader: 'W', hand: ownerHand })
    expect(botCardSmart(st, 'W', calls)).toEqual(C('spades', '3'))
  })

  it('leder partnerns bjudna färg (♦) före sin egen längre färg', () => {
    // Spelförare Syd 4♠. Partner (Öst) klev in 2♦. Väst leder.
    const hand: Hand = [
      C('spades', '3'), C('spades', '2'),
      C('hearts', 'A'), C('hearts', '7'), C('hearts', '6'), C('hearts', '5'),
      C('diamonds', 'K'), C('diamonds', '8'), C('diamonds', '3'),
      C('clubs', '9'), C('clubs', '7'), C('clubs', '6'), C('clubs', '4'),
    ]
    const calls = [
      call('S', '1S'), call('W', 'pass'), call('N', '2S'), call('E', '2D'),
      call('S', '4S'), call('W', 'pass'), call('N', 'pass'), call('E', 'pass'),
    ]
    const st = state({ trump: 'spades', level: 4, declarer: 'S', seat: 'W', leader: 'W', hand })
    // Partnerns färg ♦ (låg från K83 = ♦3) före egna ♥/♣.
    expect(botCardSmart(st, 'W', calls)).toEqual(C('diamonds', '3'))
  })

  it('mot NT: undviker motståndarnas bjudna färg när ett alternativ finns', () => {
    // Syd öppnade 1♠ (visar spader), auktionen landar i 3NT. Väst leder.
    const hand: Hand = [
      C('spades', 'K'), C('spades', 'J'), C('spades', '8'), C('spades', '4'), C('spades', '3'),
      C('hearts', 'Q'), C('hearts', '9'), C('hearts', '5'),
      C('diamonds', '10'), C('diamonds', '8'),
      C('clubs', '7'), C('clubs', '6'), C('clubs', '4'),
    ]
    const calls = [call('S', '1S'), call('W', 'pass'), call('N', '2NT'), call('E', 'pass'), call('S', '3NT'), call('E', 'pass')]
    const st = state({ trump: null, level: 3, declarer: 'S', seat: 'W', leader: 'W', hand })
    // Längsta är ♠ (5) men Syd bjöd spader → undvik den; näst bästa objudna = ♥Q95 (3).
    const card = botCardSmart(st, 'W', calls)
    expect(card.suit).not.toBe('spades')
  })

  // Felrapport #46 (github.com/PGreen90/Learn-Bridge/issues/46): bricka 6, 1NT av S.
  // Väst ♠62 ♥A4 ♦KQ96532 ♣Q2 mot 1NT; Syd öppnade 1♦, Nord bjöd 1♠. Motorn ledde
  // ♥A (från Ax) för att undvika Syds ruter — men en 7-korts KQ-svit ÄR utspelet mot
  // sang även om spelföraren bjudit färgen. Facit FÖRE fix: ♦K (topp av KQ-sekvensen).
  it('#46 – stark lång färg leds mot NT även om motståndaren bjudit den (♦K, ej ♥A)', () => {
    const hand: Hand = [
      C('spades', '6'), C('spades', '2'),
      C('hearts', 'A'), C('hearts', '4'),
      C('diamonds', 'K'), C('diamonds', 'Q'), C('diamonds', '9'), C('diamonds', '6'),
      C('diamonds', '5'), C('diamonds', '3'), C('diamonds', '2'),
      C('clubs', 'Q'), C('clubs', '2'),
    ]
    const calls = [
      call('S', '1D'), call('W', 'pass'), call('N', '1S'), call('E', 'pass'),
      call('S', '1NT'), call('W', 'pass'), call('N', 'pass'), call('E', 'pass'),
    ]
    const st = state({ trump: null, level: 1, declarer: 'S', seat: 'W', leader: 'W', hand })
    expect(botCardSmart(st, 'W', calls)).toEqual(C('diamonds', 'K'))
  })

  // Hål D: singel för ruff när trumfen är kort (kan ruffa, ingen trumfkontroll).
  it('hål D – leder singeln för ruff (korta trumf) före en säker lång färg', () => {
    const hand: Hand = [
      C('spades', '7'), C('spades', '6'), C('spades', '5'), // 3 små trumf → kan ruffa
      C('hearts', '4'), // singel
      C('diamonds', 'J'), C('diamonds', '8'), C('diamonds', '7'), C('diamonds', '3'), C('diamonds', '2'),
      C('clubs', '8'), C('clubs', '6'), C('clubs', '4'), C('clubs', '2'),
    ]
    const calls = [call('S', '1S'), call('W', 'pass'), call('N', '4S'), call('E', 'pass')]
    const st = state({ trump: 'spades', level: 4, declarer: 'S', seat: 'W', leader: 'W', hand })
    expect(botCardSmart(st, 'W', calls)).toEqual(C('hearts', '4'))
  })

  // Speldiagnosen fynd 6 (frö 20260807): trumfutspelsregeln räknade
  // motståndarnas CUE-BUD som en bjuden färg — "3+ färger = korsruff-läge"
  // triggade på en vanlig Jacoby-höjning (1♠ … 4♦ sidofärg + 4♥ KONTROLLBUD).
  // Ett cue-bud visar en kontroll, ingen egen längd, och försvararen hör det i
  // budförklaringen → det räknas INTE som bjuden färg. Med bara två riktiga
  // färger väljs det passiva sidofärgsutspelet. Facit FÖRE fix.
  it('fynd 6 – cue-bud räknas inte som bjuden färg (ingen korsruff-trigger)', () => {
    const hand: Hand = [
      C('spades', '9'), C('spades', '7'), C('spades', '3'),
      C('hearts', 'J'), C('hearts', '10'), C('hearts', '9'), C('hearts', '8'), C('hearts', '2'),
      C('diamonds', '8'), C('diamonds', '6'), C('diamonds', '2'),
      C('clubs', '5'), C('clubs', '4'),
    ]
    const calls: ResolvedCall[] = [
      { seat: 'E', bid: '1S' }, { seat: 'S', bid: 'pass' },
      { seat: 'W', bid: '2NT', rule: 'Jacoby 2NT' }, { seat: 'N', bid: 'pass' },
      { seat: 'E', bid: '4D', rule: 'Jacoby: sidofärg' }, { seat: 'S', bid: 'pass' },
      { seat: 'W', bid: '4H', rule: 'cue-bid' }, { seat: 'N', bid: 'pass' },
      { seat: 'E', bid: '4S', rule: 'cue: avslut' }, { seat: 'S', bid: 'pass' },
      { seat: 'W', bid: 'pass' }, { seat: 'N', bid: 'pass' },
    ]
    const st = state({ trump: 'spades', level: 4, declarer: 'E', seat: 'S', leader: 'S', hand })
    // Utan cue-räkningen: bara ♠+♦ är bjudna → passivt utspel ur ♥J10982-
    // sekvensen (inte trumf via korsruff-regeln).
    expect(botCardSmart(st, 'S', calls)).toEqual(C('hearts', 'J'))
  })

  // Hål C: trumfutspel i korsruff-läge (motståndarna bjöd 3+ färger) – mitten av 3 små.
  it('hål C – trumf i korsruff-läge (3 bjudna motståndarfärger) → mitten av 3 små', () => {
    const hand: Hand = [
      C('hearts', '7'), C('hearts', '6'), C('hearts', '5'), // 3 små trumf
      C('spades', 'J'), C('spades', '8'), C('spades', '4'),
      C('diamonds', 'Q'), C('diamonds', '9'), C('diamonds', '3'),
      C('clubs', '8'), C('clubs', '6'), C('clubs', '4'), C('clubs', '2'),
    ]
    // S–N bjöd klöver, spader OCH hjärter (3 färger) → korsruff-signal.
    const calls = [
      call('S', '1C'), call('W', 'pass'), call('N', '1S'), call('E', 'pass'),
      call('S', '2H'), call('W', 'pass'), call('N', '4H'), call('E', 'pass'),
    ]
    const st = state({ trump: 'hearts', level: 4, declarer: 'S', seat: 'W', leader: 'W', hand })
    expect(botCardSmart(st, 'W', calls)).toEqual(C('hearts', '6')) // mitten av 7-6-5
  })
})

// Felrapport #17 (github.com/PGreen90/Learn-Bridge/issues/17): bricka 16, 3NT
// av Öst. Öst (spelförare) hade ♠KQ53 mittemot träkarlens SINGEL-♠A. Inne mitt
// i given ledde Öst ♠K rakt in i singel-essen → båda honnörerna dog på ETT
// stick (ett spaderstick bortslarvat). Avblockningsregeln: leder jag en färg där
// den synliga medspelaren har en högre singel, spelar jag LÅGT i stället (♠3),
// så mina honnörer sparas och singeln vinner sticket ändå.
describe('felrapport #17 – avblockning: led inte honnör in i medspelarens singel', () => {
  it('Öst (spelförare, ♠KQ53) leder LÅGT när träkarlen har singel-♠A, ej ♠K', () => {
    const east: Hand = [
      C('spades', 'K'), C('spades', 'Q'), C('spades', '5'), C('spades', '3'),
      C('hearts', 'J'), C('hearts', '9'), C('hearts', '8'), C('hearts', '4'),
      C('diamonds', '7'), C('clubs', '10'),
    ]
    const dummy: Hand = [
      C('spades', 'A'),
      C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q'), C('hearts', '10'), C('hearts', '6'), C('hearts', '2'),
      C('diamonds', '8'), C('clubs', 'A'), C('clubs', '8'),
    ]
    const st = state({
      hand: east, seat: 'E', declarer: 'E', leader: 'E',
      otherHands: { W: dummy }, completedTricks: [doneTrick('E')],
    })
    const card = botCard(st, 'E')
    expect(card.suit).toBe('spades')
    expect(card.rank).toBe('3') // lägsta spadern – aldrig K/Q in i singel-essen
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

// Felrapport #12 (github.com/PGreen90/Learn-Bridge/issues/12): bricka 3,
// 4♠ av Öst. Stick 4: Syd vänder med ♥3, träkarlen Väst håller ♥AKQT98 –
// och lade ♥8 ("mask") som Nords knekt vann. Ägaren: "väst ska gå upp med ett
// garanterat stort hjärter, finns ingen anledning till en mask här." Med
// LÖPANDE toppvinnare (A, K och Q är alla säkra – bara knekten är ute och
// den slår ingen av dem) finns inget att spara på: gå upp med den BILLIGASTE
// säkra vinnaren, ♥Q. Ett ensamt säkert kort (torrt ess) läggs fortfarande
// lågt (hold-up-doktrinen orörd – testet "Kx → lågt" ovan vaktar den).
describe('felrapport #12 – andra hand går upp med löpande toppvinnare', () => {
  const deal: Deal = {
    id: 'felrapport-12', dealer: 'S', vulnerability: 'ew', board: 3,
    hands: {
      N: parseHand('S:J9 H:J2 D:76532 C:Q982'),
      E: parseHand('S:KQ542 H:74 D:JT84 C:76'),
      S: parseHand('S:T8 H:653 D:AK9 C:AKJ43'),
      W: parseHand('S:A763 H:AKQT98 D:Q C:T5'),
    },
  }
  const contract: Contract = { declarer: 'E', strain: 'spades', level: 4 }

  it('stick 4: Väst (träkarlen) går upp med ♥Q ur AKQT98 – maskar aldrig med 8:an', () => {
    let s = startPlay(deal, contract)
    // Stick 1–3 exakt ur rapporten + Syds ♥3 i stick 4.
    const played: Array<[Suit, Rank]> = [
      ['clubs', 'A'], ['clubs', '5'], ['clubs', '2'], ['clubs', '6'],
      ['clubs', 'K'], ['clubs', '10'], ['clubs', '8'], ['clubs', '7'],
      ['diamonds', 'A'], ['diamonds', 'Q'], ['diamonds', '2'], ['diamonds', '4'],
      ['hearts', '3'],
    ]
    for (const [suit, rank] of played) s = playCard(s, C(suit, rank))
    expect(s.toAct).toBe('W')
    expect(botCard(s, 'W')).toEqual(C('hearts', 'Q'))
  })
})

// Speldiagnosen S0 (frö 20260731, stick 1): Öst spelade ut ♣K mot 2♠ av N.
// Träkarlen Syd höll ♣AQ42 och lade ♣Q — "billigaste säkra vinnaren" — UNDER
// den redan utspelade kungen. Damen är "säker" mot utestående kort (kungen
// ligger ju), men den VINNER INTE STICKET. Regeln måste kräva att kortet slår
// det som redan ligger: rätt kort är ♣A (esset vinner, damen sitter kvar som
// mask mot knekten). Facit FÖRE fix.
describe('speldiagnos S0 – säkra vinnaren måste slå kortet som redan ligger', () => {
  it('♣K utspelad, andra hand med AQ42 → esset (aldrig damen under kungen)', () => {
    const s = state({
      trump: 'spades', declarer: 'N', seat: 'S', leader: 'E',
      trick: [{ seat: 'E', card: C('clubs', 'K') }],
      hand: [
        C('spades', '9'), C('spades', '5'),
        C('hearts', 'J'), C('hearts', '10'), C('hearts', '9'), C('hearts', '3'),
        C('diamonds', '7'), C('diamonds', '4'), C('diamonds', '3'),
        C('clubs', 'A'), C('clubs', 'Q'), C('clubs', '4'), C('clubs', '2'),
      ],
    })
    expect(botCard(s, 'S')).toEqual(C('clubs', 'A'))
  })
})

// Speldiagnosen S0 (frö 20260772, stick 8–12): spelföraren Väst (4♥) var
// renons i klöver med trumfsjuan KVAR på handen — och sakade ♦Q, ♦A och ♠A
// medan Syd körde klöverfärgen. Sakreglerna ("vakta hotkorten") övervägde
// aldrig att RUFFA, fast en trumf per definition vinner sticket när motståndaren
// leder en sidofärg. Fem stick rann bort. Doktrin (rad 10): "ruffa bara när det
// vinner sticket" — här VINNER ruffen. Facit FÖRE fix. Gäller spelförarsidan;
// försvarets andra hand ändras inte (partnern kan fortfarande vinna sticket).
describe('speldiagnos S0 – spelförarsidan ruffar i stället för att saka vinnare', () => {
  it('renons i ledd färg + trumf kvar → ruffa lågt, saka inte esset', () => {
    // Stick 8-läget ur frö 20260772: S leder ♣7, W (spelförare, hjärter trumf)
    // renons i klöver med ♥7 + tre vinnare kvar.
    const s = state({
      trump: 'hearts', declarer: 'W', seat: 'W', leader: 'S',
      trick: [{ seat: 'S', card: C('clubs', '7') }],
      completedTricks: [doneTrick()],
      hand: [
        C('spades', 'A'), C('spades', '7'), C('spades', '4'),
        C('diamonds', 'A'), C('diamonds', 'Q'),
        C('hearts', '7'),
      ],
    })
    expect(botCard(s, 'W')).toEqual(C('hearts', '7'))
  })
})

// Speldiagnosen S2 (frö 20260731, stick 6): Nord (spelförare i 2♠) hade dragit
// ♠A och ♠K när Öst sakade — all kvarvarande trumf (♠QT32) satt alltså
// bevisligen hos Väst, ÖVER Nords ♠J76 och minst lika lång. Ändå ledde Nord
// trumf ("längsta färgen") rakt in i den kända gaffeln och Väst vann billigt
// två varv (−2 stick). En trumfled kan där aldrig dra ut mästartrumfen — boten
// ska välja en sidofärg. Ärlig inferens: bara show-outen (shownVoids) + egna
// sidans kort. Facit FÖRE fix.
describe('speldiagnos S2 – led inte trumf in i en känd gaffel', () => {
  const dragnaTrumfvarv: Trick[] = [
    {
      leader: 'N', winner: 'N',
      cards: [
        { seat: 'N', card: C('spades', 'A') }, { seat: 'E', card: C('spades', '4') },
        { seat: 'S', card: C('spades', '5') }, { seat: 'W', card: C('spades', '8') },
      ],
    },
    {
      leader: 'N', winner: 'N',
      cards: [
        { seat: 'N', card: C('spades', 'K') }, { seat: 'E', card: C('hearts', '2') },
        { seat: 'S', card: C('spades', '9') }, { seat: 'W', card: C('spades', '2') },
      ],
    },
  ]

  it('Öst sakade i trumf, ♠QT3 kvar bakom ♠J76 → leder INTE trumf', () => {
    const s = state({
      trump: 'spades', declarer: 'N', seat: 'N', leader: 'N',
      completedTricks: dragnaTrumfvarv,
      hand: [
        C('spades', 'J'), C('spades', '7'), C('spades', '6'),
        C('hearts', '7'), C('diamonds', 'K'), C('diamonds', '5'),
        C('clubs', '8'), C('clubs', '5'),
      ],
      otherHands: {
        S: [
          C('hearts', 'J'), C('hearts', '10'), C('hearts', '9'),
          C('diamonds', '7'), C('diamonds', '4'), C('diamonds', '3'),
          C('clubs', 'Q'), C('clubs', '4'),
        ],
      },
    })
    expect(botCard(s, 'N').suit).not.toBe('spades')
  })

  it('KQJ76 mot kortare känd trumf (A98) → att driva ut mästartrumfen är fortfarande rätt', () => {
    // Show-outen har placerat A98 hos Väst — men vår trumf är LÄNGRE, så att
    // leda trumf (driva ut esset, sen dra resten) är sund teknik och ska bestå.
    const s = state({
      trump: 'spades', declarer: 'N', seat: 'N', leader: 'N',
      completedTricks: [
        {
          leader: 'N', winner: 'W',
          cards: [
            { seat: 'N', card: C('spades', '2') }, { seat: 'E', card: C('hearts', '2') },
            { seat: 'S', card: C('spades', '3') }, { seat: 'W', card: C('spades', '4') },
          ],
        },
      ],
      hand: [
        C('spades', 'K'), C('spades', 'Q'), C('spades', 'J'), C('spades', '7'), C('spades', '6'),
        C('hearts', '7'), C('diamonds', 'K'), C('diamonds', '5'),
      ],
      otherHands: { S: [C('spades', '10'), C('spades', '5'), C('diamonds', '7'), C('diamonds', '4'), C('diamonds', '3'), C('clubs', 'Q'), C('clubs', '4'), C('clubs', '2')] },
    })
    expect(botCard(s, 'N').suit).toBe('spades')
  })
})

// Speldiagnosen S2 (frö 20260730, stick 2): spelföraren Väst (4♥, ♥KJ982 på
// handen) ledde ♥2 mot träkarlens ♥Q753; Nord la sexan och träkarlen valde ♥7 —
// "vinn billigast". Sjuan föll för Syds tia, och damen dog senare under esset:
// −2 stick. Spelförarsidan SER båda sina händer och ska värdera hela
// färgkombinationen: bara A-10-4 är ute, så DAMEN tvingar esset och promoverar
// K-J-9-8 (tian faller sen under en mask). Facit FÖRE fix.
describe('speldiagnos S2 – tredje hand på spelförarsidan följer färgkombinationen', () => {
  it('♥2 mot Q753 (KJ98 kvar hos partnern, A-10-4 ute) → damen, inte sjuan', () => {
    const s = state({
      trump: 'hearts', declarer: 'W', seat: 'E', leader: 'W',
      completedTricks: [doneTrick()],
      trick: [
        { seat: 'W', card: C('hearts', '2') },
        { seat: 'N', card: C('hearts', '6') },
      ],
      hand: [
        C('hearts', 'Q'), C('hearts', '7'), C('hearts', '5'), C('hearts', '3'),
        C('spades', 'Q'), C('spades', '8'), C('clubs', 'J'), C('clubs', '9'),
      ],
      otherHands: {
        W: [
          C('hearts', 'K'), C('hearts', 'J'), C('hearts', '9'), C('hearts', '8'),
          C('spades', 'A'), C('spades', 'J'), C('diamonds', '9'), C('diamonds', '8'),
          C('clubs', 'A'), C('clubs', '5'),
        ],
      },
    })
    expect(botCard(s, 'E')).toEqual(C('hearts', 'Q'))
  })
})

// Speldiagnosen runda 4 (tävling 2026-08-11 bricka 1, stick 10): Syd ledde ♥6.
// Väst (spelförare, renons i hjärter) RUFFADE med ♦9 — fast träkarlens ♥Q låg
// SYNLIGT bakom och bevisligen vann sticket gratis (varje osedd hjärter var
// lägre). S1-regeln "ruffa i stället för att saka" saknade vakten "synlig
// partner vinner redan sticket" — doktrinen "ruffa aldrig partnerns stick"
// gäller även här. Ärligt krav: partnerns kort slår utspelet OCH alla osedda
// kort i färgen, och motståndaren emellan har inte visat renons. Facit FÖRE fix.
describe('speldiagnos runda 4 – ruffa inte när synliga partnern redan vinner sticket', () => {
  const hjarterBorta: Trick = {
    leader: 'S', winner: 'N',
    cards: [
      { seat: 'S', card: C('hearts', '2') }, { seat: 'W', card: C('hearts', '10') },
      { seat: 'N', card: C('hearts', 'A') }, { seat: 'E', card: C('hearts', 'K') },
    ],
  }

  it('träkarlens ♥Q är boss bakom → spelföraren sakar i stället för att ruffa', () => {
    const s = state({
      trump: 'diamonds', declarer: 'W', seat: 'W', leader: 'S',
      completedTricks: [hjarterBorta],
      trick: [{ seat: 'S', card: C('hearts', '6') }],
      hand: [C('spades', 'A'), C('spades', 'J'), C('spades', '8'), C('diamonds', '9'), C('diamonds', '4')],
      otherHands: {
        E: [C('hearts', 'Q'), C('hearts', '9'), C('clubs', 'J'), C('clubs', '8'), C('clubs', '6')],
      },
    })
    expect(botCard(s, 'W').suit).not.toBe('diamonds')
  })

  it('utan boss hos partnern ruffas fortfarande lågt (S1-regeln består)', () => {
    // Samma läge men träkarlen har bara småhjärter → ruffen är rätt.
    const s = state({
      trump: 'diamonds', declarer: 'W', seat: 'W', leader: 'S',
      completedTricks: [hjarterBorta],
      trick: [{ seat: 'S', card: C('hearts', '6') }],
      hand: [C('spades', 'A'), C('spades', 'J'), C('spades', '8'), C('diamonds', '9'), C('diamonds', '4')],
      otherHands: {
        E: [C('hearts', '5'), C('hearts', '3'), C('clubs', 'J'), C('clubs', '8'), C('clubs', '6')],
      },
    })
    expect(botCard(s, 'W')).toEqual(C('diamonds', '4'))
  })
})

// Speldiagnosen runda 4 (tävling 2026-08-11 bricka 8, stick 1): Väst spelade ut
// ♦7 mot 3NT. Träkarlen (♦J-10-8-4) lade ♦4 — "andra hand lågt" — fast
// spelföraren satt SYNLIGT med ♦A-K-2 bakom. Åttan är gratis att prova: slås
// den över vinner spelförarens kung ändå (precis som om 4:an lagts), och
// vinner den är det ett rent extrastick — dessutom sparas partnerns boss.
// Samma sjukdom som fynd 5 (tredje hand), fast i ANDRA hand: spelförarsidan
// ser båda händerna och ska täcka billigt när partnern har boss i färgen.
// Facit FÖRE fix.
describe('speldiagnos runda 4 – andra hand på spelförarsidan täcker billigt mot partnerns boss', () => {
  it('♦7 utspelad, träkarlen J1084 + spelföraren AK2 → åttan (inte fyran)', () => {
    const s = state({
      trump: null, level: 3, declarer: 'S', seat: 'N', leader: 'W',
      trick: [{ seat: 'W', card: C('diamonds', '7') }],
      hand: [
        C('diamonds', 'J'), C('diamonds', '10'), C('diamonds', '8'), C('diamonds', '4'),
        C('spades', '6'), C('spades', '4'), C('spades', '2'),
        C('hearts', 'A'), C('hearts', 'Q'),
        C('clubs', 'K'), C('clubs', 'J'), C('clubs', '8'), C('clubs', '7'),
      ],
      otherHands: {
        S: [
          C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', '2'),
          C('spades', 'K'), C('spades', 'Q'), C('spades', '10'), C('spades', '5'),
          C('hearts', '8'), C('hearts', '6'), C('hearts', '3'),
          C('clubs', '9'), C('clubs', '5'), C('clubs', '2'),
        ],
      },
    })
    expect(botCard(s, 'N')).toEqual(C('diamonds', '8'))
  })

  it('utan boss hos partnern gäller fortfarande andra hand lågt', () => {
    // Samma träkarl men spelföraren har bara småruter → 4:an (doktrinen består).
    const s = state({
      trump: null, level: 3, declarer: 'S', seat: 'N', leader: 'W',
      trick: [{ seat: 'W', card: C('diamonds', '7') }],
      hand: [
        C('diamonds', 'J'), C('diamonds', '10'), C('diamonds', '8'), C('diamonds', '4'),
        C('hearts', 'A'), C('hearts', 'Q'),
        C('clubs', 'K'), C('clubs', 'J'),
      ],
      otherHands: {
        S: [
          C('diamonds', '6'), C('diamonds', '3'), C('diamonds', '2'),
          C('spades', 'K'), C('spades', 'Q'), C('spades', '10'),
          C('clubs', '9'), C('clubs', '5'),
        ],
      },
    })
    expect(botCard(s, 'N')).toEqual(C('diamonds', '4'))
  })
})

// Speldiagnosen runda 4 (tävling 2026-08-11 bricka 1, stick 2+5): spelföraren
// hade ♦A-J-9-4 mot träkarlens ♦Q-8-6 (bara kungen och småkort ute) men drog
// ALDRIG trumf — cash-regeln kräver en säker vinnare, så tumregel-lagret hade
// i praktiken ingen trumfdragning alls när den kräver att driva ut/maska bort
// en honnör. Nord ruffade ♣K med sin sista hacka. Ny plan: på lead räknas
// styrkeprovet i trumffärgen ärligt (kombinerad trumf mot de osedda korten) —
// vinner vår sida fler trumfvarv än motståndarna leds trumf tills deras är
// slut. Svag trumf drar fortfarande inte. Facit FÖRE fix.
describe('speldiagnos runda 4 – spelföraren drar trumf när kombinationen vinner styrkeprovet', () => {
  it('träkarlen Q86 mot spelförarens AJ94 (K ute) → leder trumf, inte sidofärgen', () => {
    const s = state({
      trump: 'diamonds', declarer: 'W', seat: 'E', leader: 'E',
      completedTricks: [doneTrick()],
      hand: [
        C('diamonds', 'Q'), C('diamonds', '8'), C('diamonds', '6'),
        C('clubs', 'Q'), C('clubs', 'J'), C('clubs', '8'), C('clubs', '6'), C('clubs', '3'),
        C('hearts', 'K'), C('hearts', 'Q'), C('hearts', 'J'), C('hearts', '9'),
      ],
      otherHands: {
        W: [
          C('diamonds', 'A'), C('diamonds', 'J'), C('diamonds', '9'), C('diamonds', '4'),
          C('spades', 'A'), C('spades', 'J'), C('spades', '8'), C('spades', '6'), C('spades', '4'), C('spades', '2'),
          C('clubs', 'K'), C('clubs', '4'),
        ],
      },
    })
    expect(botCard(s, 'E').suit).toBe('diamonds')
  })

  it('jämnt styrkeprov (J94+Q8 mot K-10-7-5 ute) → fortsätter dra trumf', () => {
    // Bricka 1-läget efter ♦A-varvet: 2 vinstvarv mot 2 förlustvarv. Släpps
    // trumfen här ruffas sidovinnarna (♣K åkte) — jämnt prov ska fortsätta dra.
    const s = state({
      trump: 'diamonds', declarer: 'W', seat: 'W', leader: 'W',
      completedTricks: [
        {
          leader: 'W', winner: 'W',
          cards: [
            { seat: 'W', card: C('diamonds', 'A') }, { seat: 'N', card: C('diamonds', '2') },
            { seat: 'E', card: C('diamonds', '6') }, { seat: 'S', card: C('diamonds', '3') },
          ],
        },
      ],
      hand: [
        C('diamonds', 'J'), C('diamonds', '9'), C('diamonds', '4'),
        C('spades', 'J'), C('spades', '8'), C('spades', '6'), C('spades', '4'), C('spades', '2'),
        C('clubs', '7'), C('clubs', '4'),
      ],
      otherHands: {
        E: [
          C('diamonds', 'Q'), C('diamonds', '8'),
          C('hearts', 'Q'), C('hearts', 'J'), C('hearts', '9'),
          C('clubs', 'J'), C('clubs', '8'), C('clubs', '6'), C('clubs', '3'), C('clubs', '2'),
        ],
      },
    })
    expect(botCard(s, 'W').suit).toBe('diamonds')
  })

  it('svag trumf (853 mot 97) drar inte – den långa sidofärgen leds som förut', () => {
    const s = state({
      trump: 'spades', declarer: 'W', seat: 'W', leader: 'W',
      completedTricks: [doneTrick()],
      hand: [
        C('spades', '8'), C('spades', '5'), C('spades', '3'),
        C('diamonds', 'K'), C('diamonds', 'Q'), C('diamonds', 'J'), C('diamonds', '10'), C('diamonds', '9'),
        C('hearts', 'A'), C('hearts', '2'),
        C('clubs', '4'), C('clubs', '2'),
      ],
      otherHands: {
        E: [C('spades', '9'), C('spades', '7'), C('clubs', 'K'), C('clubs', '8'), C('clubs', '7'), C('clubs', '5')],
      },
    })
    expect(botCard(s, 'W')).toEqual(C('diamonds', 'K'))
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

describe('tredje hand – vinnaren måste hålla mot träkarlen (spelar efter oss)', () => {
  it('billigaste vinnaren som även slår bordets kort – inte bara det som redan ligger', () => {
    // Spelförare S ⇒ träkarl N, som spelar SIST i sticket (öppen information).
    // Ö leder ♥2, S lägger ♥3. V:s ♥4 "vinner" mot ♥3 men bordets ♥5/♥7 går
    // över – ♥J är billigaste kortet som håller hela vägen.
    const s = state({
      seat: 'W', leader: 'E', declarer: 'S',
      trick: [
        { seat: 'E', card: C('hearts', '2') },
        { seat: 'S', card: C('hearts', '3') },
      ],
      hand: [C('hearts', 'K'), C('hearts', 'J'), C('hearts', '4')],
      otherHands: { N: [C('hearts', '7'), C('hearts', '5')] },
    })
    expect(botCard(s, 'W')).toEqual(C('hearts', 'J'))
  })

  it('bordet toppar allt vi kan vinna med → gamla regeln (billigaste vinnaren) gäller', () => {
    // Träkarlen håller ♥A ⇒ inget av V:s kort håller sticket. Då gäller den
    // gamla tumregeln oförändrat: billigaste kortet som slår det som ligger.
    const s = state({
      seat: 'W', leader: 'E', declarer: 'S',
      trick: [
        { seat: 'E', card: C('hearts', '2') },
        { seat: 'S', card: C('hearts', '3') },
      ],
      hand: [C('hearts', 'K'), C('hearts', '4')],
      otherHands: { N: [C('hearts', 'A'), C('hearts', '5')] },
    })
    expect(botCard(s, 'W')).toEqual(C('hearts', '4'))
  })
})

// Felrapport #1 (github.com/PGreen90/Learn-Bridge/issues/1): bricka 8, 2♦ av S.
// Ägaren: "i trick 4 så skall väst ta sticket, kryper nu och tappar detta stick".
// Given återskapad EXAKT ur rapporten (FACIT FÖRE FIX).
describe('felrapport #1 – V kryper i stick 4 och tappar sticket till bordet', () => {
  it('stick 4: Ö ♥2, S ♥3 → V spelar ♥J (inte ♥4 som bordets ♥5 slår)', () => {
    const deal: Deal = {
      id: 'felrapport-1',
      board: 8,
      dealer: 'W',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:Q93 H:875 D:862 C:9853'),
        E: parseHand('S:A72 H:AT92 D:K3 C:KQ64'),
        S: parseHand('S:KT5 H:Q3 D:AJT954 C:J7'),
        W: parseHand('S:J864 H:KJ64 D:Q7 C:AT2'),
      },
    }
    let s = startPlay(deal, { declarer: 'S', strain: 'diamonds', level: 2 })
    // Stick 1–3 + Ö:s ♥2 och S:s ♥3 i stick 4, exakt som i rapporten:
    const played: [Suit, Rank][] = [
      ['hearts', '6'], ['hearts', '8'], ['hearts', '9'], ['hearts', 'Q'], // stick 1 (S)
      ['spades', '5'], ['spades', '4'], ['spades', '9'], ['spades', 'A'], // stick 2 (Ö)
      ['clubs', 'K'], ['clubs', '7'], ['clubs', '2'], ['clubs', '3'],     // stick 3 (Ö)
      ['hearts', '2'], ['hearts', '3'],                                   // stick 4: Ö leder, S lägger
    ]
    for (const [suit, rank] of played) s = playCard(s, { suit, rank })

    expect(s.toAct).toBe('W')
    // Bordet (N) har ♥75 kvar; V har ♥KJ4. ♥J = billigaste kortet som håller.
    expect(botCard(s, 'W')).toEqual(C('hearts', 'J'))
  })
})

// Felrapport #6 (github.com/PGreen90/Learn-Bridge/issues/6): bricka 7, 3NT av N.
// Ägaren: "öst spelar ut spader och bör fortsätta spela spader (men byter färg)
// fel 1. fel 2 öst spelar ut ruter ess vilket gör motståndets honörer stora."
// Given återskapad EXAKT ur rapporten (FACIT FÖRE FIX). Rätt motspel: Ö vinner
// stick 1 med ♠Q och FORTSÄTTER spader (Väst har ♠AK kvar) – cashar inte det
// torra ruteresset, som bara gör spelförarens ♦KQJT stora.
describe('felrapport #6 – Ö fortsätter spadern i stick 2, cashar inte torrt ess', () => {
  it('stick 2: Ö inne på ♠Q → spelar spader, ALDRIG ♦A', () => {
    const deal: Deal = {
      id: 'felrapport-6',
      board: 7,
      dealer: 'S',
      vulnerability: 'all',
      hands: {
        N: parseHand('S:T2 H:Q96 D:J86 C:AKQJ9'),
        E: parseHand('S:QJ43 H:854 D:A75 C:872'),
        S: parseHand('S:986 H:AK2 D:KQT43 C:65'),
        W: parseHand('S:AK75 H:JT73 D:92 C:T43'),
      },
    }
    let s = startPlay(deal, { declarer: 'N', strain: 'NT', level: 3 })
    // Stick 1 exakt som i rapporten: Ö ♠Q, S ♠6, V ♠5, N ♠2 → Ö vinner.
    const trick1: [Suit, Rank][] = [
      ['spades', 'Q'], ['spades', '6'], ['spades', '5'], ['spades', '2'],
    ]
    for (const [suit, rank] of trick1) s = playCard(s, { suit, rank })

    expect(s.toAct).toBe('E')
    const chosen = botCard(s, 'E')
    expect(chosen.suit).toBe('spades') // fel 1: färgbytet
    expect(chosen).not.toEqual(C('diamonds', 'A')) // fel 2: torra esset
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

// Felrapport #48 (github.com/PGreen90/Learn-Bridge/issues/48): bricka 1, 3♥ av Ö.
// Trumf hjärter: dummy V ♥AQJT5, spelföraren Ö ♥K86432 = ALLA honnörer, bara ♥97
// ute (Nord). Ö ledde låg ♥6 i stick 3 och V (dummy) följde med låg ♥5 (tumregeln
// "partnern vinner redan → kasta lågt") → Nords ♥7 vann ett trumfstick helt i
// onödan. Spelförarsidan ser BÅDA sina händer och får inte gömma sig bakom
// partnerns SLAGBARA kort: V går upp med ♥10 (billigaste kort som vinner över
// Nords utestående 9/7) och trumfsticket räddas. FACIT FÖRE FIX.
describe('felrapport #48 – spelförarsidan gömmer sig inte bakom partnerns slagbara kort', () => {
  const deal: Deal = {
    id: 'felrapport-48', board: 1, dealer: 'N', vulnerability: 'none',
    hands: {
      N: parseHand('S:QJ4 H:97 D:T9542 C:QJ8'),
      E: parseHand('S:A5 H:K86432 D:87 C:K62'),
      S: parseHand('S:KT98732 H:- D:KQ63 C:A3'),
      W: parseHand('S:6 H:AQJT5 D:AJ C:T9754'),
    },
  }

  it('stick 3: Ö leder ♥6, S sakar ♠2 → V (dummy) vinner med ♥10, inte ♥5', () => {
    let s = startPlay(deal, { declarer: 'E', strain: 'hearts', level: 3 })
    // Stick 1–2 + Ö:s ♥6 och S:s ♠2 i stick 3, exakt som i rapporten:
    const pre: [Suit, Rank][] = [
      ['diamonds', 'K'], ['diamonds', 'J'], ['diamonds', '5'], ['diamonds', '7'], // stick 1 (S vinner)
      ['spades', '10'], ['spades', '6'], ['spades', '4'], ['spades', 'A'],         // stick 2 (Ö vinner)
      ['hearts', '6'], ['spades', '2'],                                            // stick 3: Ö leder, S sakar
    ]
    for (const [su, r] of pre) s = playCard(s, { suit: su, rank: r })
    expect(s.toAct).toBe('W')
    expect(botCard(s, 'W')).toEqual(C('hearts', '10'))
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

// Felrapport #25 (github.com/PGreen90/Learn-Bridge/issues/25): 3NT av Syd. I
// stick 3 sakade Väst (motspelet, void i ruter) sitt LÄGSTA kort = ♣2 ur ♣Q92,
// vilket började blotta klöverdamen → damen föll senare under AK och Syd tog 11
// stick. DDS-facit på ställningen: ett KLÖVERkast ger spelföraren 11 stick, en
// låg SPADER eller HJÄRTER håller honom till 9. Fixen: motspelarens kast-vakt
// sakar ur en färg UTAN skyddsvärd honnör i stället för att blotta damen.
describe('felrapport #25 – motspelaren blottar inte en honnör vid sakning', () => {
  const HANDS: Record<Seat, string> = {
    N: 'S:K5 H:Q8 D:KJ8642 C:K86',
    E: 'S:QJ2 H:KT92 D:Q73 C:T75',
    S: 'S:8764 H:AJ D:AT5 C:AJ43',
    W: 'S:AT93 H:76543 D:9 C:Q92',
  }
  const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
  const c = (code: string): Card => ({ suit: SUIT[code[0]], rank: (code.slice(1) === 'T' ? '10' : code.slice(1)) as Rank })

  function atTrick3WestToDiscard(): PlayState {
    const deal: Deal = {
      id: 'fr25', dealer: 'N', vulnerability: 'all', board: 13,
      hands: { N: parseHand(HANDS.N), E: parseHand(HANDS.E), S: parseHand(HANDS.S), W: parseHand(HANDS.W) },
    }
    let st = startPlay(deal, { declarer: 'S', strain: 'NT', level: 3 })
    for (const code of ['H3', 'H8', 'H9', 'HJ', 'DA', 'D9', 'D2', 'D3', 'DT']) st = playCard(st, c(code))
    return st
  }

  it('Väst är på tur att saka i stick 3 (void i ruter)', () => {
    const st = atTrick3WestToDiscard()
    expect(st.toAct).toBe('W')
    expect(st.currentTrick.map((p) => p.card.suit)).toEqual(['diamonds'])
    expect(st.hands.W.some((x) => x.suit === 'diamonds')).toBe(false)
  })

  it('sakar INTE en klöver (blottar aldrig ♣Q) – väljer en färg utan skyddsvärd honnör', () => {
    const st = atTrick3WestToDiscard()
    const r = botCardReasoned(st, 'W')
    expect(r.card.suit).not.toBe('clubs')
    // Klöverdamen förblir garderad: minst två klöver kvar efter kastet.
    const clubsLeft = st.hands.W.filter((x) => x.suit === 'clubs').length
    expect(clubsLeft).toBe(3) // kastet rörde inte klöver
    // Kastet är säkert (rör inte ♣Q) OCH bär numera en Lavinthal-markering på
    // första saket (markeringar Steg 3): honnörsvakten väljer den säkra färgen,
    // Lavinthal väljer kortet i den. Endera förklaringen är korrekt.
    expect(r.reason).toMatch(/vaktar|honnör|blotta|Lavinthal/i)
  })

  it('DDS-facit: det valda kastet håller Syd till 9, ett klöverkast ger 11', () => {
    const st = atTrick3WestToDiscard()
    const declTricksAfter = (wc: Card): number => {
      const after = playCard(st, wc)
      const dd = doubleDummyDeclarerRemaining(
        after.hands, 'NT', 'S', after.currentTrick.map((p) => ({ seat: p.seat, card: p.card })), after.toAct, 5_000_000,
      )
      expect(dd).not.toBeNull()
      return (dd as number) + after.tricksNS
    }
    // Botens val (låg spader): optimalt försvar, Syd hålls till 9 (jämnt hem i 3NT).
    const chosen = botCardReasoned(st, 'W').card
    expect(declTricksAfter(chosen)).toBe(9)
    // Det rapporterade felet: ett klöverkast blottar damen → Syd tar 11 (+2).
    expect(declTricksAfter(c('C2'))).toBe(11)
  }, 120_000) // hängningsdetektor, inte prestandakrav — Vercels byggare är långsam (2026-07-28)
})
