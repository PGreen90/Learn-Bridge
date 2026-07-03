// Facit: ägarens poängguide (2026-07-04) — varje cell i tabellen låst, plus
// hela straff-/övertricktabellen (odubblat/dubblat/redubblat × ozon/zon).

import { describe, expect, it } from 'vitest'
import type { Vulnerability } from '../../types/bridge'
import type { Contract, Strain } from './play'
import { duplicateScore, scoreLine, sideVulnerable } from './scoring'

const c = (level: number, strain: Strain, doubled?: 'X' | 'XX'): Contract => ({
  declarer: 'S',
  strain,
  level,
  ...(doubled ? { doubled } : {}),
})

/** Hemspelat med exakt bjudna stick. */
const made = (contract: Contract, vulnerable: boolean) =>
  duplicateScore(contract, 6 + contract.level, vulnerable)

describe('poängguiden — hemspelade kontrakt (ozon / zon)', () => {
  // Varje rad ur ägarens tabell: [nivå, NT, ♥/♠, ♣/♦] × ozon/zon.
  it.each([
    // nivå, strain, ozon, zon
    [7, 'NT', 1520, 2220],
    [7, 'spades', 1510, 2210],
    [7, 'clubs', 1440, 2140],
    [6, 'NT', 990, 1440],
    [6, 'hearts', 980, 1430],
    [6, 'diamonds', 920, 1370],
    [5, 'NT', 460, 660],
    [5, 'hearts', 450, 650],
    [5, 'clubs', 400, 600], // utgång ♣/♦
    [4, 'NT', 430, 630],
    [4, 'spades', 420, 620], // utgång ♥/♠ — ägarens exempel
    [4, 'diamonds', 130, 130], // delkontrakt
    [3, 'NT', 400, 600], // utgång NT
    [3, 'hearts', 140, 140],
    [3, 'clubs', 110, 110],
    [2, 'NT', 120, 120],
    [2, 'spades', 110, 110],
    [2, 'diamonds', 90, 90],
    [1, 'NT', 90, 90],
    [1, 'hearts', 80, 80],
    [1, 'clubs', 70, 70],
  ] as [number, Strain, number, number][])(
    '%i%s: %i ozon / %i zon',
    (level, strain, ozon, zon) => {
      expect(made(c(level, strain), false)).toBe(ozon)
      expect(made(c(level, strain), true)).toBe(zon)
    },
  )
})

describe('övertrick', () => {
  it('odubblat: trickvärdet per stick (20/30)', () => {
    expect(duplicateScore(c(4, 'spades'), 11, false)).toBe(450) // 420 + 30
    expect(duplicateScore(c(3, 'clubs'), 11, true)).toBe(150) // 110 + 2×20
    expect(duplicateScore(c(3, 'NT'), 10, false)).toBe(430) // 400 + 30
  })

  it('dubblat: 100 ozon / 200 zon per stick', () => {
    expect(duplicateScore(c(2, 'hearts', 'X'), 9, false)).toBe(570) // 470 + 100
    expect(duplicateScore(c(2, 'hearts', 'X'), 9, true)).toBe(870) // 670 + 200
  })

  it('redubblat: 200 ozon / 400 zon per stick', () => {
    expect(duplicateScore(c(2, 'spades', 'XX'), 9, false)).toBe(840) // 640 + 200
    expect(duplicateScore(c(2, 'spades', 'XX'), 9, true)).toBe(1240) // 840 + 400
  })
})

describe('dubblade hemgångar (bonus + insult)', () => {
  it('2♥X hemma = 470/670 (dubblade trickpoäng 120 → utgång, +50 insult)', () => {
    expect(made(c(2, 'hearts', 'X'), false)).toBe(470)
    expect(made(c(2, 'hearts', 'X'), true)).toBe(670)
  })

  it('1NTX hemma = 180 (80 + 50 delkontrakt + 50 insult)', () => {
    expect(made(c(1, 'NT', 'X'), false)).toBe(180)
  })

  it('2♠XX hemma = 640/840 (240 → utgång, +100 insult)', () => {
    expect(made(c(2, 'spades', 'XX'), false)).toBe(640)
    expect(made(c(2, 'spades', 'XX'), true)).toBe(840)
  })
})

describe('straffar — ägarens strafftabell', () => {
  const down = (n: number, vulnerable: boolean, doubled?: 'X' | 'XX') =>
    -duplicateScore(c(4, 'hearts', doubled), 10 - n, vulnerable)

  it.each([
    // bet, ozon: odubblat, dubblat, redubblat
    [1, 50, 100, 200],
    [2, 100, 300, 600],
    [3, 150, 500, 1000],
    [4, 200, 800, 1600], // varje extra utöver 3: +50 / +300 / +600
    [5, 250, 1100, 2200],
  ])('%i bet ozon: %i / %i / %i', (n, plain, dbl, rdbl) => {
    expect(down(n, false)).toBe(plain)
    expect(down(n, false, 'X')).toBe(dbl)
    expect(down(n, false, 'XX')).toBe(rdbl)
  })

  it.each([
    // bet, zon: odubblat, dubblat, redubblat
    [1, 100, 200, 400],
    [2, 200, 500, 1000],
    [3, 300, 800, 1600],
    [4, 400, 1100, 2200], // varje extra utöver 3: +100 / +300 / +600
    [5, 500, 1400, 2800],
  ])('%i bet zon: %i / %i / %i', (n, plain, dbl, rdbl) => {
    expect(down(n, true)).toBe(plain)
    expect(down(n, true, 'X')).toBe(dbl)
    expect(down(n, true, 'XX')).toBe(rdbl)
  })
})

describe('sideVulnerable — zonen per sida', () => {
  it.each([
    ['none', 'S', false],
    ['all', 'S', true],
    ['ns', 'N', true],
    ['ns', 'E', false],
    ['ew', 'W', true],
    ['ew', 'S', false],
  ] as [Vulnerability, Contract['declarer'], boolean][])(
    'zon %s, spelförare %s → %s',
    (vul, declarer, expected) => {
      expect(sideVulnerable(declarer, vul)).toBe(expected)
    },
  )
})

describe('scoreLine — texten i resultatdialogen', () => {
  it('hemgång: spelförarsidan får poängen ("N/S +420")', () => {
    const line = scoreLine(c(4, 'spades'), 10, 'none')
    expect(line).toEqual({ side: 'NS', points: 420, label: 'N/S +420' })
  })

  it('ägarens exempel: Öst spelar hem 4♥ i zon → "Ö/V +620"', () => {
    const line = scoreLine({ declarer: 'E', strain: 'hearts', level: 4 }, 10, 'ew')
    expect(line).toEqual({ side: 'EW', points: 620, label: 'Ö/V +620' })
  })

  it('straff: försvaret får poängen', () => {
    // Syd går 2 bet dubblat i zon → Ö/V +500.
    const line = scoreLine(c(2, 'spades', 'X'), 6, 'ns')
    expect(line).toEqual({ side: 'EW', points: 500, label: 'Ö/V +500' })
  })
})
