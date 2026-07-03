// Claim-funktionerna (ägarönskemål 2026-07-03), facit-låsta:
// - adjudicateClaim: manuell claim döms mot PERFEKT spel (DDS) – godkänd om
//   spelföraren kan säkra så många stick mot bästa motspel.
// - autoClaimAvailable: strängare – sant bara när sidan OMÖJLIGT kan förlora
//   något återstående stick, oavsett hur den själv spelar. Ägarens exempel:
//   bara höga trumf kvar, eller tre ess + en kung i sang.

import { describe, expect, it } from 'vitest'
import type { Card, Hand, Rank, Seat, Suit } from '../../types/bridge'
import type { Contract, PlayState } from './play'
import { adjudicateClaim, autoClaimAvailable, declarerTricksWon, remainingTricks } from './claim'

const C = (s: Suit, r: Rank): Card => ({ suit: s, rank: r })

/** Bygg ett spelläge direkt (samma mönster som play-bot-testerna). */
function state(opts: {
  declarer: Seat
  strain: Contract['strain']
  level?: number
  hands: Record<Seat, Hand>
  toAct: Seat
  tricksNS?: number
  tricksEW?: number
  currentTrick?: { seat: Seat; card: Card }[]
}): PlayState {
  return {
    contract: { declarer: opts.declarer, strain: opts.strain, level: opts.level ?? 4 },
    trump: opts.strain === 'NT' ? null : opts.strain,
    hands: opts.hands,
    leader: opts.toAct,
    toAct: opts.toAct,
    currentTrick: opts.currentTrick ?? [],
    completedTricks: [],
    tricksNS: opts.tricksNS ?? 0,
    tricksEW: opts.tricksEW ?? 0,
  }
}

describe('autoClaimAvailable – "omöjligt att förlora"', () => {
  // Ägarens exempel 1: tre kort kvar, alla är trumf och alla andra trumf är
  // spelade. Syd ruffar/övertar allt – går inte att förlora, oavsett spelordning.
  const onlyMasterTrumps = (toAct: Seat) =>
    state({
      declarer: 'S',
      strain: 'hearts',
      hands: {
        S: [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q')],
        N: [C('spades', '2'), C('diamonds', '2'), C('clubs', '2')],
        E: [C('spades', 'A'), C('spades', 'K'), C('spades', 'Q')],
        W: [C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', 'Q')],
      },
      toAct,
      tricksNS: 10,
    })

  it('bara höga trumf kvar → claimbart, både på egen och motståndarens utspel', () => {
    expect(autoClaimAvailable(onlyMasterTrumps('S'))).toBe(true)
    expect(autoClaimAvailable(onlyMasterTrumps('E'))).toBe(true)
  })

  // Ägarens exempel 2: tre ess + kungen i en av färgerna (sang), egen hand inne.
  it('tre ess + kung i sang på egen hand → claimbart', () => {
    const s = state({
      declarer: 'S',
      strain: 'NT',
      level: 3,
      hands: {
        S: [C('spades', 'A'), C('spades', 'K'), C('hearts', 'A'), C('diamonds', 'A')],
        N: [C('spades', '4'), C('hearts', '3'), C('diamonds', '3'), C('clubs', '3')],
        E: [C('hearts', 'K'), C('hearts', 'Q'), C('diamonds', 'K'), C('diamonds', 'Q')],
        W: [C('clubs', 'A'), C('clubs', 'K'), C('clubs', 'Q'), C('diamonds', '2')],
      },
      toAct: 'S',
      tricksNS: 9,
    })
    expect(autoClaimAvailable(s)).toBe(true)
  })

  it('samma toppkort men MOTSTÅNDAREN på utspel med en frisk färg → INTE claimbart', () => {
    const s = state({
      declarer: 'S',
      strain: 'NT',
      level: 3,
      hands: {
        S: [C('spades', 'A'), C('spades', 'K'), C('hearts', 'A'), C('diamonds', 'A')],
        N: [C('spades', '4'), C('hearts', '3'), C('diamonds', '3'), C('clubs', '3')],
        E: [C('hearts', 'K'), C('hearts', 'Q'), C('diamonds', 'K'), C('diamonds', 'Q')],
        W: [C('clubs', 'A'), C('clubs', 'K'), C('clubs', 'Q'), C('diamonds', '2')],
      },
      toAct: 'W', // Väst spelar ut ♣E som ingen kan ta i sang
      tricksNS: 9,
    })
    expect(autoClaimAvailable(s)).toBe(false)
  })

  it('toppkort i sidofärgerna men en trumf UTE hos motståndaren → INTE claimbart (kan ruffas)', () => {
    const s = state({
      declarer: 'S',
      strain: 'hearts',
      hands: {
        S: [C('spades', 'A'), C('diamonds', 'A'), C('clubs', 'A')],
        N: [C('spades', '2'), C('diamonds', '2'), C('clubs', '2')],
        E: [C('hearts', '2'), C('diamonds', '5'), C('clubs', '5')], // ♥2 = sista trumfen
        W: [C('spades', 'K'), C('spades', 'Q'), C('spades', 'J')],
      },
      toAct: 'S',
      tricksNS: 10,
    })
    expect(autoClaimAvailable(s)).toBe(false)
  })

  // Kärnskillnaden mot facit/DDS: en mask som ALLTID sitter rätt går att spela
  // hem (DDS godkänner claimen) men går också att spela BORT (esset först) –
  // alltså aldrig Auto Claim.
  it('fungerande mask → INTE Auto Claim (kortet kan spelas bort)', () => {
    const s = state({
      declarer: 'S',
      strain: 'NT',
      level: 1,
      hands: {
        N: [C('spades', 'A'), C('spades', 'Q')],
        S: [C('spades', '3'), C('spades', '2')],
        W: [C('spades', 'K'), C('spades', '4')], // kungen FRAMFÖR gaffeln
        E: [C('diamonds', '2'), C('diamonds', '3')],
      },
      toAct: 'S',
      tricksNS: 11,
    })
    expect(autoClaimAvailable(s)).toBe(false)
  })

  it('bot som spelförare (ÖV-sidan) claimas symmetriskt', () => {
    const s = state({
      declarer: 'E',
      strain: 'spades',
      hands: {
        E: [C('spades', 'A'), C('spades', 'K'), C('spades', 'Q')],
        W: [C('hearts', '2'), C('diamonds', '2'), C('clubs', '2')],
        N: [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q')],
        S: [C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', 'Q')],
      },
      toAct: 'S',
      tricksEW: 10,
    })
    expect(autoClaimAvailable(s)).toBe(true)
  })

  it('mitt i ett stick → aldrig Auto Claim (sticket spelas klart först)', () => {
    const base = onlyMasterTrumps('S')
    const mid: PlayState = {
      ...base,
      hands: { ...base.hands, S: base.hands.S.slice(1) },
      currentTrick: [{ seat: 'S', card: C('hearts', 'A') }],
      toAct: 'W',
    }
    expect(autoClaimAvailable(mid)).toBe(false)
  })

  it('nodbudgeten överskriden → false (hellre spela vidare än frysa)', () => {
    expect(autoClaimAvailable(onlyMasterTrumps('S'), 1)).toBe(false)
  })
})

describe('adjudicateClaim – manuell claim mot perfekt spel', () => {
  // Masken som alltid sitter: ♠K exakt framför N:s EQ → DDS säkrar båda sticken.
  const finesseOnside = state({
    declarer: 'S',
    strain: 'NT',
    level: 1,
    hands: {
      N: [C('spades', 'A'), C('spades', 'Q')],
      S: [C('spades', '3'), C('spades', '2')],
      W: [C('spades', 'K'), C('spades', '4')],
      E: [C('diamonds', '2'), C('diamonds', '3')],
    },
    toAct: 'S',
    tricksNS: 11,
  })

  it('claim som DDS kan säkra → godkänd (fast Auto Claim säger nej)', () => {
    expect(adjudicateClaim(finesseOnside, 13)).toEqual({ verdict: 'godkänd' })
  })

  it('claima FÄRRE stick än möjligt är tillåtet (resten skänks)', () => {
    expect(adjudicateClaim(finesseOnside, 12)).toEqual({ verdict: 'godkänd' })
  })

  it('kungen BAKOM gaffeln → claim på båda sticken nekas, ett stick godkänns', () => {
    const offside = state({
      declarer: 'S',
      strain: 'NT',
      level: 1,
      hands: {
        N: [C('spades', 'A'), C('spades', 'Q')],
        S: [C('spades', '3'), C('spades', '2')],
        E: [C('spades', 'K'), C('spades', '4')], // kungen BAKOM gaffeln
        W: [C('diamonds', '2'), C('diamonds', '3')],
      },
      toAct: 'S',
      tricksNS: 11,
    })
    expect(adjudicateClaim(offside, 13)).toEqual({ verdict: 'nekad' })
    expect(adjudicateClaim(offside, 12)).toEqual({ verdict: 'godkänd' })
  })

  it('utanför det möjliga spannet → nekad direkt', () => {
    expect(adjudicateClaim(finesseOnside, 14)).toEqual({ verdict: 'nekad' }) // fler än det finns
    expect(adjudicateClaim(finesseOnside, 10)).toEqual({ verdict: 'nekad' }) // färre än redan vunna
  })

  it('claim mitt i ett pågående stick bedöms med sticket inräknat', () => {
    const mid = state({
      declarer: 'S',
      strain: 'NT',
      level: 1,
      hands: {
        S: [C('spades', 'K')], // ♠E redan lagt i pågående stick
        W: [C('spades', '4'), C('spades', '5')],
        N: [C('spades', '6'), C('spades', '7')],
        E: [C('spades', '8'), C('spades', '9')],
      },
      toAct: 'W',
      tricksNS: 11,
      currentTrick: [{ seat: 'S', card: C('spades', 'A') }],
    })
    expect(remainingTricks(mid)).toBe(2)
    expect(adjudicateClaim(mid, 13)).toEqual({ verdict: 'godkänd' }) // ♠E vinner sticket, ♠K är hög
  })

  it('för tung ställning inom nodbudgeten → oavgjord', () => {
    expect(adjudicateClaim(finesseOnside, 13, 1)).toEqual({ verdict: 'oavgjord' })
  })
})

describe('hjälpfunktionerna', () => {
  it('remainingTricks + declarerTricksWon läser ställningen rätt', () => {
    const s = state({
      declarer: 'E',
      strain: 'spades',
      hands: {
        E: [C('spades', 'A'), C('spades', 'K'), C('spades', 'Q')],
        W: [C('hearts', '2'), C('diamonds', '2'), C('clubs', '2')],
        N: [C('hearts', 'A'), C('hearts', 'K'), C('hearts', 'Q')],
        S: [C('diamonds', 'A'), C('diamonds', 'K'), C('diamonds', 'Q')],
      },
      toAct: 'S',
      tricksNS: 4,
      tricksEW: 6,
    })
    expect(remainingTricks(s)).toBe(3)
    expect(declarerTricksWon(s)).toBe(6)
  })
})
