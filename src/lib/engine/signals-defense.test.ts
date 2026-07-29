// Facit för försvarssignalernas SÄKERHETSKÄRNA (markeringar Steg 0). Skrivet
// FÖRE koden. `defensiveSignalCard` kapslar in två oberoende val: (1) vilka kort
// jag ÄRLIGT kan avvara (spare), (2) vilket av dem encodern väljer för att bära
// en attityd-/räknings-/Lavinthal-signal. Kärngarantin: encodern får BARA välja
// bland spare-kort som bevisligen aldrig kan bli/kosta ett stick, så en markering
// aldrig sänker spelstyrkan.
//
// Spare-regeln (v1, konservativ): ett kort SKYDDAS (är inte spare) om det är en
// säker vinnare, en honnör (kn+ = J+), eller ingår i den sammanhängande topp-
// sekvensen ledd av en honnör (J-10-9 skyddas – de kan promoveras). Alla andra
// (rena små spotkort) är spare. Har spare 0 kort → lägsta (ingen signal möjlig);
// 1 kort → det kortet (tvingat, per definition ingen vinnare).

import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '../../types/bridge'
import { defensiveSignalCard } from './signals'

const C = (rank: Rank, suit: Suit = 'spades'): Card => ({ suit, rank })
const cards = (...ranks: Rank[]): Card[] => ranks.map((r) => C(r))

describe('spare-regeln: skyddar vinnare/honnörer/sekvens', () => {
  it('rena spotkort (8-5-2, ingen honnör) → allt är spare', () => {
    // discourage = högsta av spare = 8; encourage = lägsta = 2.
    expect(defensiveSignalCard(cards('8', '5', '2'), [], { kind: 'attitude', encourage: false })).toEqual(C('8'))
    expect(defensiveSignalCard(cards('8', '5', '2'), [], { kind: 'attitude', encourage: true })).toEqual(C('2'))
  })

  it('honnör skyddas (Q-8-2) → signalen väljer bara bland 8/2, aldrig damen', () => {
    expect(defensiveSignalCard(cards('Q', '8', '2'), [], { kind: 'attitude', encourage: false })).toEqual(C('8'))
    expect(defensiveSignalCard(cards('Q', '8', '2'), [], { kind: 'attitude', encourage: true })).toEqual(C('2'))
  })

  it('honnörsledd sekvens skyddas (J-10-9-3-2) → 10 och 9 kan promoveras, spare = 3/2', () => {
    expect(defensiveSignalCard(cards('J', '10', '9', '3', '2'), [], { kind: 'attitude', encourage: false })).toEqual(C('3'))
    expect(defensiveSignalCard(cards('J', '10', '9', '3', '2'), [], { kind: 'attitude', encourage: true })).toEqual(C('2'))
  })

  it('säkra vinnare skyddas (A-K-4-3, inget högre ute) → spare = 4/3', () => {
    // played tomt men A/K är högsta ranken → isSureWinner sant för båda.
    expect(defensiveSignalCard(cards('A', 'K', '4', '3'), [], { kind: 'attitude', encourage: false })).toEqual(C('4'))
    expect(defensiveSignalCard(cards('A', 'K', '4', '3'), [], { kind: 'attitude', encourage: true })).toEqual(C('3'))
  })
})

describe('encoder-riktningen (på spare-mängden)', () => {
  it('attityd: encourage → lägsta, discourage → högsta (UDCA omvänd)', () => {
    expect(defensiveSignalCard(cards('9', '5', '2'), [], { kind: 'attitude', encourage: true })).toEqual(C('2'))
    expect(defensiveSignalCard(cards('9', '5', '2'), [], { kind: 'attitude', encourage: false })).toEqual(C('9'))
  })

  it('räkning: jämnt → lägsta (lågt-högt), udda → högsta (högt-lågt)', () => {
    expect(defensiveSignalCard(cards('9', '5', '2'), [], { kind: 'count', even: true })).toEqual(C('2'))
    expect(defensiveSignalCard(cards('9', '5', '2'), [], { kind: 'count', even: false })).toEqual(C('9'))
  })

  it('Lavinthal: wantHigher → högsta, annars lägsta', () => {
    expect(defensiveSignalCard(cards('9', '5', '2'), [], { kind: 'lavinthal', wantHigher: true })).toEqual(C('9'))
    expect(defensiveSignalCard(cards('9', '5', '2'), [], { kind: 'lavinthal', wantHigher: false })).toEqual(C('2'))
  })
})

describe('spare-fallback (ingen frihet → dagens beteende)', () => {
  it('allt skyddat (A-K-Q, idel vinnare/honnörer) → lägsta kortet, ingen signal', () => {
    expect(defensiveSignalCard(cards('A', 'K', 'Q'), [], { kind: 'attitude', encourage: false })).toEqual(C('Q'))
  })

  it('en spare (K-Q-J-5) → det kortet oavsett signal', () => {
    expect(defensiveSignalCard(cards('K', 'Q', 'J', '5'), [], { kind: 'attitude', encourage: false })).toEqual(C('5'))
    expect(defensiveSignalCard(cards('K', 'Q', 'J', '5'), [], { kind: 'count', even: true })).toEqual(C('5'))
  })

  it('singelton → kortet självt, ingen krasch', () => {
    expect(defensiveSignalCard(cards('7'), [], { kind: 'attitude', encourage: true })).toEqual(C('7'))
  })
})

describe('säker vinnare beror på spelade kort (played skärper spare)', () => {
  it('Q blir säker vinnare när A och K fallit → Q skyddas ändå (honnör), spare = 8/2', () => {
    const played = [C('A'), C('K')]
    expect(defensiveSignalCard(cards('Q', '8', '2'), played, { kind: 'attitude', encourage: false })).toEqual(C('8'))
  })

  it('10 blir säker vinnare när alla honnörer fallit → skyddas som vinnare, spare = 6/3', () => {
    // Ute: bara småkort under 10 kvar hos motståndarna → 10 är säker vinnare.
    const played = [C('A'), C('K'), C('Q'), C('J')]
    expect(defensiveSignalCard(cards('10', '6', '3'), played, { kind: 'attitude', encourage: false })).toEqual(C('6'))
  })
})
