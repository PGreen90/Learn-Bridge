import { describe, expect, it } from 'vitest'
import type { Suit } from '../../types/bridge'
import type { Major } from './responses'
import { parseHand } from '../bidding'
import type { ResponseResult } from './responses'
import {
  openerAnswerFourthSuit,
  openerRebidAfter1LevelResponse,
  openerRebidAfter1NTResponse,
  openerRebidAfter2over1,
  openerRebidAfterBergen,
  openerRebidAfterInvertedMinor,
  openerRebidAfterJacoby2NT,
  openerRebidAfterLimitedResponse,
  openerRebidAfterSemiForcing1NT,
  openerRebidAfterSimpleRaise,
  openerRebidAfterSplinter,
} from './rebids'

function reb(notation: string, opened: Suit, responder: Suit): string {
  return openerRebidAfter1LevelResponse(parseHand(notation), opened, responder).call
}

function sfnt(notation: string, M: Major): string {
  return openerRebidAfterSemiForcing1NT(parseHand(notation), M).call
}

function raise(notation: string, M: Major): string {
  return openerRebidAfterSimpleRaise(parseHand(notation), M).call
}

function twoOne(notation: string, opened: Suit, responder: Suit): string {
  return openerRebidAfter2over1(parseHand(notation), opened, responder).call
}

function bergen(notation: string, M: Major, rule: string): string {
  return openerRebidAfterBergen(parseHand(notation), M, rule).call
}

function splinter(notation: string, M: Major): string {
  return openerRebidAfterSplinter(parseHand(notation), M).call
}

function jacoby(notation: string, M: Major): string {
  return openerRebidAfterJacoby2NT(parseHand(notation), M).call
}

function invMinor(notation: string, m: Suit, strong: boolean): string {
  return openerRebidAfterInvertedMinor(parseHand(notation), m, strong).call
}

function limited(notation: string, rule: string, call: string, opened: Suit): string {
  const response: ResponseResult = { call, rule, explanation: '' }
  return openerRebidAfterLimitedResponse(parseHand(notation), response, opened).call
}

function after1nt(rule: string, call: string, notation: string): string {
  const response: ResponseResult = { call, rule, explanation: '' }
  return openerRebidAfter1NTResponse(response, parseHand(notation))?.call ?? 'null'
}

describe('openerRebidAfter1LevelResponse', () => {
  it('enkel höjning av svararens högfärg (minimum)', () => {
    expect(reb('S:K3 H:Q742 D:A52 C:K642', 'clubs', 'hearts')).toBe('2H') // 12 hp, 4 stöd
  })

  it('hopphöjning med 16–18', () => {
    expect(reb('S:K3 H:Q742 D:AQ2 C:KQ42', 'clubs', 'hearts')).toBe('3H') // 16 hp, 4 stöd
  })

  it('visar ny 4-korts högfärg billigt på 1-läget', () => {
    expect(reb('S:73 H:KJ85 D:Q2 C:AQ842', 'clubs', 'diamonds')).toBe('1H') // 4 hjärter
  })

  it('billig högfärg up the line – hjärter före spader', () => {
    expect(reb('S:KJ85 H:KQ85 D:2 C:A842', 'clubs', 'diamonds')).toBe('1H') // 4-4 hf
  })

  it('reverse med 16+ och längre första färg', () => {
    expect(reb('S:3 H:AQ85 D:AKJ85 C:K42', 'diamonds', 'spades')).toBe('2H') // 17 hp, 5-4
  })

  it('1NT (12–14) balanserad utan högfärg/stöd', () => {
    expect(reb('S:KJ3 H:A2 D:Q852 C:K642', 'clubs', 'hearts')).toBe('1NT') // 13 hp
  })

  it('2NT (18–19) balanserad', () => {
    expect(reb('S:KJ3 H:A2 D:KQ52 C:AQ42', 'clubs', 'hearts')).toBe('2NT') // 19 hp
  })

  it('rebjuder egen 6-korts färg (minimum)', () => {
    expect(reb('S:3 H:AQ8742 D:K52 C:K42', 'hearts', 'spades')).toBe('2H') // 12 hp, 6 hjärter
  })

  it('hopp i egen färg (16–18, inbjudan)', () => {
    expect(reb('S:A3 H:AQJ742 D:KQ2 C:42', 'hearts', 'spades')).toBe('3H') // 16 hp, 6 hjärter
  })

  it('ny lägre färg på 2-läget (naturlig, minimum)', () => {
    expect(reb('S:3 H:AQ842 D:K2 C:KQ85', 'hearts', 'spades')).toBe('2C') // 5-5, minimum
  })

  it('höjning av svararens minor (reservfall)', () => {
    expect(reb('S:32 H:K2 D:KJ85 C:AQ854', 'clubs', 'diamonds')).toBe('2D') // 13 hp, 4 stöd
  })
})

describe('punkt 1 – återbud efter semi-forcing 1NT', () => {
  it('rebjuder egen 6-korts färg (minimum)', () => {
    expect(sfnt('S:3 H:AQ8742 D:K52 C:K42', 'hearts')).toBe('2H') // 12 hp, 6 hjärter
  })

  it('2NT med 18–19 balanserad', () => {
    expect(sfnt('S:K3 H:AQ842 D:A32 C:KQ2', 'hearts')).toBe('2NT') // 18 hp, 5332
  })

  it('pass med 12–14 balanserad minimum', () => {
    expect(sfnt('S:K3 H:AQ842 D:Q32 C:Q42', 'hearts')).toBe('P') // 13 hp, 5332
  })

  it('reverse 2♠ med 5-4 i hjärter-spader, 16+', () => {
    expect(sfnt('S:KQ85 H:AQ842 D:AK C:42', 'hearts')).toBe('2S') // 18 hp, 5-4
  })
})

describe('punkt 2 – återbud efter enkel höjning (Bergen game try)', () => {
  it('pass med minimum', () => {
    expect(raise('S:KQ742 H:K3 D:Q42 C:Q42', 'spades')).toBe('P') // 12 hp
  })

  it('2NT game try med 15–17', () => {
    expect(raise('S:KQ742 H:KQ D:K42 C:Q42', 'spades')).toBe('2NT') // 15 hp
  })

  it('4♠ direkt med stark hand', () => {
    expect(raise('S:AKQ74 H:AQ D:KJ2 C:Q42', 'spades')).toBe('4S') // 18+ hp
  })

  it('TP-steg C: formstark 11:a → game try (singel + sidofärg = 15 Bergenp.)', () => {
    // Rå hp = 11 (förut pass), men singel hjärter + 5 trumf + 4-korts ruter ger 15
    // Bergenpoäng → utgångsförsök i stället för pass.
    expect(raise('S:AQ862 H:4 D:KQ73 C:953', 'spades')).toBe('2NT')
  })
})

describe('punkt 3 – återbud efter 2-över-1 GF', () => {
  it('rebjuder egen 6-korts färg', () => {
    expect(twoOne('S:3 H:AKQ742 D:K52 C:Q2', 'hearts', 'clubs')).toBe('2H') // 14 hp
  })

  it('stöder svararens färg med 4', () => {
    expect(twoOne('S:K3 H:AQ842 D:32 C:KQ42', 'hearts', 'clubs')).toBe('3C') // 4 stöd
  })

  it('visar ny 4-korts högfärg', () => {
    expect(twoOne('S:AQ842 H:KJ85 D:3 C:K42', 'spades', 'diamonds')).toBe('2H') // 4 hjärter
  })
})

describe('punkt 4 – återbud efter Bergen-höjningar', () => {
  it('Bergen konstruktiv, minimum → stannar i 3 i färgen', () => {
    expect(bergen('S:K3 H:AQ842 D:Q42 C:K42', 'hearts', 'Bergen konstruktiv')).toBe('3H') // 14 hp
  })

  it('Bergen konstruktiv, stark → utgång', () => {
    expect(bergen('S:KQ H:AQ842 D:KJ2 C:K42', 'hearts', 'Bergen konstruktiv')).toBe('4H') // 18 hp
  })

  it('Bergen limit (10–12), 13+ → utgång', () => {
    expect(bergen('S:K3 H:AQ842 D:Q42 C:Q42', 'hearts', 'Bergen limit')).toBe('4H') // 13 hp
  })

  it('Bergen spärr, minimum → pass', () => {
    expect(bergen('S:K3 H:AQ842 D:Q42 C:Q42', 'hearts', 'Bergen spärr')).toBe('P') // 13 hp
  })

  it('TP-steg C: formstark 11:a accepterar utgång mot limithöjning (ägarens hand)', () => {
    // Du öppnade 1♠, partnern limithöjde (3♦). 11 hp men singel + 5 trumf + 4-korts
    // ruter = 15 Bergenpoäng → 4♠ i stället för att stanna 3♠. Ägarens beslut.
    expect(bergen('S:AQ862 H:4 D:KQ73 C:953', 'spades', 'Bergen limit')).toBe('4S')
  })
})

describe('punkt 5 – återbud efter tvetydig splinter', () => {
  it('slamintresse → relä (3NT över 1♥)', () => {
    expect(splinter('S:K3 H:AKQ42 D:KJ2 C:Q42', 'hearts')).toBe('3NT') // 18 hp
  })

  it('relä 3♠ över 1♠', () => {
    expect(splinter('S:AKQ42 H:K3 D:KJ2 C:Q42', 'spades')).toBe('3S') // 18 hp
  })

  it('minimum → signoff i utgång', () => {
    expect(splinter('S:K3 H:AQ842 D:Q42 C:Q42', 'hearts')).toBe('4H') // 13 hp
  })
})

describe('punkt 6 – återbud efter Jacoby 2NT', () => {
  it('visar 5-korts sidofärg', () => {
    expect(jacoby('S:3 H:AKQ42 D:42 C:AQ842', 'hearts')).toBe('4C') // 5 klöver
  })

  it('visar kort färg (singleton)', () => {
    expect(jacoby('S:3 H:AKQ42 D:K942 C:Q42', 'hearts')).toBe('3S') // singel spader
  })

  it('slamintresse 16+ → 3 i trumf', () => {
    expect(jacoby('S:K3 H:AKQ42 D:KQ2 C:Q42', 'hearts')).toBe('3H') // 19 hp balanserad
  })

  it('14 balanserad → 3NT', () => {
    expect(jacoby('S:K3 H:AK842 D:Q42 C:Q42', 'hearts')).toBe('3NT') // 14 hp
  })

  it('minimum → signoff 4 i trumf', () => {
    expect(jacoby('S:K3 H:AK842 D:J42 C:Q42', 'hearts')).toBe('4H') // 13 hp
  })
})

describe('punkt 7 – återbud efter inverterade minorhöjningar', () => {
  it('stark, balanserad 18–19 → 3NT', () => {
    expect(invMinor('S:K3 H:AQ2 D:KQ842 C:KQ2', 'diamonds', true)).toBe('3NT') // 19 hp
  })

  it('stark, balanserad 12–14 → 2NT', () => {
    expect(invMinor('S:K3 H:Q42 D:KQ842 C:Q42', 'diamonds', true)).toBe('2NT') // 12 hp
  })

  it('stark, obalanserad → stopp-visning i ny färg', () => {
    expect(invMinor('S:KQ85 H:A2 D:KQ842 C:Q2', 'diamonds', true)).toBe('2S') // 16 hp, 5-4
  })

  it('svag spärrhöjning, minimum → pass', () => {
    expect(invMinor('S:K3 H:Q42 D:KQ842 C:Q42', 'diamonds', false)).toBe('P') // 12 hp
  })
})

describe('punkt 8 – återbud efter begränsade svar', () => {
  it('3NT till spel → pass', () => {
    expect(limited('S:K3 H:AQ842 D:Q42 C:Q42', '3NT till spel', '3NT', 'hearts')).toBe('P')
  })

  it('2NT-inbjudan, 14+ → 3NT', () => {
    expect(limited('S:KQ3 H:KJ2 D:Q42 C:AQ42', '2NT inbjudan', '2NT', 'clubs')).toBe('3NT') // 17 hp
  })

  it('2NT-inbjudan, platt minimum → pass', () => {
    // 13 hp men platt 4-3-3-3, quack-tungt → startpoäng ~11 (golvat 13) < 14 → pass.
    expect(limited('S:Q32 H:Q42 D:KJ2 C:KQ42', '2NT inbjudan', '2NT', 'clubs')).toBe('P')
  })

  // FAS 4 steg C-3: startpoäng lyfter en NT-accept (5-korts färg / löpande honnörer).
  it('2NT-inbjudan, 13 hp MEN solid 5-korts färg → accepterar 3NT (C-3)', () => {
    // ♣AKQ42 = 5 löpande stick → startpoäng 15 → accepterar trots 13 råa HP.
    expect(limited('S:32 H:Q42 D:Q42 C:AKQ42', '2NT inbjudan', '2NT', 'clubs')).toBe('3NT')
  })

  it('svagt hoppskift, minimum → pass', () => {
    expect(limited('S:K3 H:K42 D:Q842 C:AQ42', 'svagt hoppskift', '2H', 'clubs')).toBe('P') // 14 hp
  })
})

describe('punkt 9 – öppnarens fullföljanden efter 1NT-svar', () => {
  it('Stayman → 2♥ med 4 hjärter', () => {
    expect(after1nt('Stayman', '2C', 'S:K3 H:KQ85 D:A42 C:KJ42')).toBe('2H')
  })

  it('Stayman → 2♠ med 4 spader utan 4 hjärter', () => {
    expect(after1nt('Stayman', '2C', 'S:KQ85 H:K3 D:A42 C:KJ42')).toBe('2S')
  })

  it('Stayman → 2♦ utan 4-korts högfärg', () => {
    expect(after1nt('Stayman', '2C', 'S:QJ3 H:K3 D:AQ42 C:KQ42')).toBe('2D')
  })

  it('fullföljer Jacoby-transfer till hjärter', () => {
    expect(after1nt('Jacoby-transfer', '2D', 'S:KQ3 H:K3 D:AQ42 C:KQJ2')).toBe('2H')
  })

  it('superaccept med 4 stöd och maximum', () => {
    expect(after1nt('Jacoby-transfer', '2D', 'S:Q3 H:KQ85 D:AQ43 C:KJ4')).toBe('3H') // 17 hp, 4 hjärter
  })

  it('fullföljer Texas till spader', () => {
    expect(after1nt('Texas', '4H', 'S:KQ3 H:K3 D:AQ42 C:KJ42')).toBe('4S')
  })

  it('Minor Suit Stayman → 3♣ med 4 klöver', () => {
    expect(after1nt('Minor Suit Stayman', '2S', 'S:K32 H:KQ3 D:A42 C:KQ42')).toBe('3C')
  })
})

// Fjärde färg krav (§6.6): öppnarens svar – facit-lås ur felrapport #3.
// Sammanhang i alla fall: 1♣–1♥–1♠–2♦ (öppning klöver, återbud spader,
// svararens färg hjärter, fjärde färgen ruter). Prioriteten kommer ur §6.6.
describe('openerAnswerFourthSuit (§6.6, felrapport #3)', () => {
  const answer = (hand: string) =>
    openerAnswerFourthSuit(parseHand(hand), 'clubs', 'spades', 'hearts', 'diamonds')

  it('prio 1: 3-korts stöd i svararens högfärg → 2♥', () => {
    expect(answer('S:AQ95 H:K64 D:32 C:KQ76').call).toBe('2H')
  })
  it('prio 2a: 6-4 → återbud av öppningsfärgen (3♣)', () => {
    expect(answer('S:AQ95 H:6 D:32 C:AKQ764').call).toBe('3C')
  })
  it('prio 2b: 5-5 → rebjud andrafärgen (2♠)', () => {
    expect(answer('S:AQ952 H:6 D:32 C:KQ764').call).toBe('2S')
  })
  it('prio 3: stopp i fjärde färgen → 2NT (Nords hand ur felrapporten)', () => {
    const r = answer('S:AT95 H:T D:AT4 C:QT764')
    expect(r.call).toBe('2NT')
    expect(r.rule).toBe('svar på fjärde färg')
  })
  it('prio 4: 4 kort i fjärde färgen utan stopp → höjning (3♦)', () => {
    expect(answer('S:AQ95 H:62 D:T987 C:KQ7').call).toBe('3D')
  })
  it('nödutväg: varken stöd, längd eller stopp → billigaste återbud (aldrig pass)', () => {
    expect(answer('S:AQ95 H:76 D:32 C:KQJ76').call).toBe('3C')
  })
})
