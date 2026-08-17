// Facit för bordens grundhjälpare (etapp 4A): inbjudningskoden och vakterna.

import { describe, test, expect } from 'vitest'
import { KOD_LANGD, giltigBordKod, giltigStol, nyBordKod } from './bord-grund'

describe('nyBordKod', () => {
  test('sex tecken ur alfabetet utan I/O/0/1', () => {
    // Deterministisk slump: gå igenom alfabetet i ordning.
    let i = 0
    const kod = nyBordKod((max) => i++ % max)
    expect(kod).toHaveLength(KOD_LANGD)
    expect(kod).toBe('ABCDEF')
    expect(giltigBordKod(kod)).toBe(true)
  })

  test('slumpindexet begränsas av alfabetets längd', () => {
    // Högsta indexet (max-1) ska ge sista tecknet i alfabetet, aldrig krascha.
    const kod = nyBordKod((max) => max - 1)
    expect(kod).toBe('999999')
  })

  test('riktiga koder (node:crypto) är giltiga', () => {
    for (let i = 0; i < 20; i++) expect(giltigBordKod(nyBordKod())).toBe(true)
  })
})

describe('giltigBordKod', () => {
  test('avvisar fel längd, förväxlingsbara tecken och icke-strängar', () => {
    expect(giltigBordKod('ABC')).toBe(false)
    expect(giltigBordKod('ABCDEFG')).toBe(false)
    expect(giltigBordKod('ABCDE1')).toBe(false) // 1 finns inte i alfabetet
    expect(giltigBordKod('ABCDEO')).toBe(false) // O finns inte i alfabetet
    expect(giltigBordKod('abcdef')).toBe(false) // gemener normaliseras FÖRE vakten
    expect(giltigBordKod(123456)).toBe(false)
    expect(giltigBordKod(null)).toBe(false)
  })
})

describe('giltigStol', () => {
  test('N/E/S/W och inget annat', () => {
    expect(giltigStol('N')).toBe(true)
    expect(giltigStol('W')).toBe(true)
    expect(giltigStol('X')).toBe(false)
    expect(giltigStol(undefined)).toBe(false)
  })
})
