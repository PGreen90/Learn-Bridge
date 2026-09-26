// Facit för `?dag=`-tolkningen (Påbyggnad 3): idag som standard, tidigare dagar
// tillåtna, framtid/ogiltigt avvisat — morgondagens givar får aldrig lämnas ut.

import { describe, test, expect } from 'vitest'
import { lasDag, lasForm } from './tavlingsdag'

// 2026-09-13 kl 10:00 UTC = 12:00 i Stockholm (sommartid).
const NU = new Date('2026-09-13T10:00:00Z')
const url = (q: string) => new URL(`http://x/api/topplista${q}`)

describe('lasDag', () => {
  test('utan ?dag= → idag (Stockholm), idag = true', () => {
    expect(lasDag(url(''), NU)).toEqual({ dag: '2026-09-13', idag: true })
    expect(lasDag(url('?dag='), NU)).toEqual({ dag: '2026-09-13', idag: true })
  })

  test('dagens datum uttryckligen → idag = true; gårdagen → idag = false', () => {
    expect(lasDag(url('?dag=2026-09-13'), NU)).toEqual({ dag: '2026-09-13', idag: true })
    expect(lasDag(url('?dag=2026-09-12'), NU)).toEqual({ dag: '2026-09-12', idag: false })
    expect(lasDag(url('?dag=2026-08-11'), NU)).toEqual({ dag: '2026-08-11', idag: false })
  })

  test('Stockholmsdygnet avgör "idag": sent på kvällen UTC är det redan nästa dag i Stockholm', () => {
    // 22:30 UTC = 00:30 den 14:e i Stockholm → 2026-09-13 är GÅRDAGEN.
    const sent = new Date('2026-09-13T22:30:00Z')
    expect(lasDag(url('?dag=2026-09-13'), sent)).toEqual({ dag: '2026-09-13', idag: false })
    expect(lasDag(url(''), sent)).toEqual({ dag: '2026-09-14', idag: true })
  })

  test('framtid → ogiltig (morgondagens givar ligger redan i databasen)', () => {
    expect(lasDag(url('?dag=2026-09-14'), NU)).toBe('ogiltig')
    expect(lasDag(url('?dag=2027-01-01'), NU)).toBe('ogiltig')
  })

  test('trasiga strängar → ogiltig', () => {
    for (const s of ['igår', '2026-9-1', '20260912', '2026-02-30', '2026-13-01', "2026-09-12' or 1=1"]) {
      expect(lasDag(url(`?dag=${encodeURIComponent(s)}`), NU)).toBe('ogiltig')
    }
  })
})

describe('lasForm — tävlingsformen (Dagens IMP, 2026-09-26)', () => {
  test('saknas/tom → mp (alla gamla klienter menar MP-tävlingen)', () => {
    expect(lasForm(null)).toBe('mp')
    expect(lasForm(undefined)).toBe('mp')
    expect(lasForm('')).toBe('mp')
  })
  test('mp/imp → den formen; allt annat → ogiltig', () => {
    expect(lasForm('mp')).toBe('mp')
    expect(lasForm('imp')).toBe('imp')
    expect(lasForm('IMP')).toBe('ogiltig')
    expect(lasForm('butler')).toBe('ogiltig')
    expect(lasForm(7)).toBe('ogiltig')
  })
})
