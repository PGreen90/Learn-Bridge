// Facit för tävlingsavslutet (Påbyggnad 3, 2026-09-13): den slutliga ställningen
// per dag (delad rang, tillsvidare-snittet mot storleken) och medaljtabellen
// (guld/silver/brons = placering 1/2/3, bottar uteslutna, topp 5).

import { describe, test, expect } from 'vitest'
import { byggStallning, raknaMedaljer } from './tavlingsavslut'
import type { Tävlingsrad } from './matchpoints'

describe('byggStallning — slutlig ställning för en dag', () => {
  test('placering med delad rang, snitt mot storleken, antal poängsatta + spelade', () => {
    // a vinner båda givarna mot b och c; b och c lika → delad andraplats.
    const rader: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 },
      { board: 1, spelare: 'b', poäng: 170 },
      { board: 1, spelare: 'c', poäng: 170 },
      { board: 2, spelare: 'a', poäng: 620 },
      { board: 2, spelare: 'b', poäng: 170 },
      { board: 2, spelare: 'c', poäng: 170 },
    ]
    const st = byggStallning(rader, 2, 2)
    expect(st.map((r) => [r.spelare, r.placering])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
    ])
    expect(st[0]).toEqual({ spelare: 'a', placering: 1, snitt: 100, antalGivar: 2, spelade: 2 })
    // b och c: 0,5 av 2 möjliga = 25 % per giv.
    expect(st[1].snitt).toBe(25)
  })

  test('ofullständig dag: ospelade givar räknas som 40 % även i slutställningen', () => {
    const rader: Tävlingsrad[] = [
      { board: 1, spelare: 'a', poäng: 620 },
      { board: 1, spelare: 'b', poäng: 170 },
    ]
    const st = byggStallning(rader, 2, 12)
    expect(st.find((r) => r.spelare === 'a')!.snitt).toBeCloseTo((100 + 40 * 11) / 12, 6)
    expect(st.find((r) => r.spelare === 'a')!.spelade).toBe(1)
  })

  test('tom dag → tom ställning', () => {
    expect(byggStallning([], 2, 12)).toEqual([])
  })
})

describe('raknaMedaljer — topp 5 i guld/silver/brons', () => {
  // Varje anrop = en egen tävlingsdag (unikt set-id).
  let dagNr = 0
  const dag = (placeringar: Record<string, number>) => {
    const set = `set-${++dagNr}`
    return Object.entries(placeringar).map(([spelare, placering]) => ({ set, spelare, placering }))
  }

  test('räknar 1/2/3 per dag, sorterar guld → silver → brons, delad rang ger två guld', () => {
    const alla = [
      ...dag({ a: 1, b: 2, c: 3 }),
      ...dag({ a: 1, c: 2, b: 3 }),
      ...dag({ b: 1, a: 1, c: 3 }), // delad förstaplats: två guld
      ...dag({ c: 1, d: 2, a: 4 }), // a utanför pallen
    ]
    const m = raknaMedaljer(alla, new Set())
    expect(m).toEqual([
      { spelare: 'a', guld: 3, silver: 0, brons: 0 },
      // b och c lika i guld och silver — c har fler brons och står före.
      { spelare: 'c', guld: 1, silver: 1, brons: 2 },
      { spelare: 'b', guld: 1, silver: 1, brons: 1 },
      { spelare: 'd', guld: 0, silver: 1, brons: 0 },
    ])
  })

  test('bottar utesluts helt (ägarbeslut 2026-09-13) — och tar inte upp en plats', () => {
    const alla = [...dag({ bot: 1, a: 2, b: 3 }), ...dag({ bot: 1, a: 2, b: 3 })]
    const m = raknaMedaljer(alla, new Set(['bot']))
    expect(m.map((r) => r.spelare)).toEqual(['a', 'b'])
    // Placeringarna räknas som de var (a:s silver blir inte guld) — bottarna var
    // med i dagens ställning, de bara syns inte i medaljtabellen.
    expect(m[0]).toEqual({ spelare: 'a', guld: 0, silver: 2, brons: 0 })
  })

  test('topp 5: bara de fem främsta, och spelare utan medalj listas inte', () => {
    const alla = [
      ...dag({ a: 1, b: 2, c: 3, d: 4 }),
      ...dag({ e: 1, f: 2, g: 3, a: 4 }),
      ...dag({ h: 1, a: 2, b: 3 }),
    ]
    const m = raknaMedaljer(alla, new Set())
    expect(m).toHaveLength(5)
    expect(m.map((r) => r.spelare)).not.toContain('d')
    expect(m[0].spelare).toBe('a') // 1 guld + 1 silver
  })

  test('lika medaljer → stabil ordning på namn (deterministiskt)', () => {
    const m = raknaMedaljer([...dag({ b: 1, c: 2 }), ...dag({ a: 1, c: 2 })], new Set())
    expect(m.map((r) => r.spelare)).toEqual(['a', 'b', 'c'])
  })

  test('en dag med bara EN spelare i ställningen ger ingen medalj (ägarbeslut 2026-09-13)', () => {
    const alla = [
      ...dag({ a: 1 }), // ensam — inget guld
      ...dag({ a: 1, bot: 2 }), // människa + bot = två i ställningen → guld
      ...dag({ b: 1 }), // ensam — inget guld
    ]
    const m = raknaMedaljer(alla, new Set(['bot']))
    expect(m).toEqual([{ spelare: 'a', guld: 1, silver: 0, brons: 0 }])
  })

  test('gränsen går att höja (minSpelare = 3)', () => {
    const alla = [...dag({ a: 1, b: 2 }), ...dag({ a: 1, b: 2, c: 3 })]
    expect(raknaMedaljer(alla, new Set(), 5, 3)).toEqual([
      { spelare: 'a', guld: 1, silver: 0, brons: 0 },
      { spelare: 'b', guld: 0, silver: 1, brons: 0 },
      { spelare: 'c', guld: 0, silver: 0, brons: 1 },
    ])
  })
})
