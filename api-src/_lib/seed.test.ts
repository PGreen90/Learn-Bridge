// Facit för frönyckeln (Dagens IMP, docs/imp-tavling-plan.md etapp 1).
//
// Det viktigaste låset i hela IMP-bygget: MP-tävlingens frön får INTE flytta
// sig. Nattgranskningens omprov av gamla dagar, valideringen av inskick och
// alla probar räknar givarna ur (hemlighet, datum, bricka) — samma tal som
// före 2026-09-26 måste komma ut.

import { describe, test, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { fronyckel, playSeedForBoard, seedForBoard } from './seed'

const HEMLIGHET = 'test-hemlighet'

describe('fronyckel', () => {
  test('MP-nyckeln ÄR datumet — byte-identiskt med hur fröet hashades före IMP-bygget', () => {
    expect(fronyckel('2026-09-26', 'mp')).toBe('2026-09-26')
  })

  test('IMP-nyckeln är datumet + "#imp"', () => {
    expect(fronyckel('2026-09-26', 'imp')).toBe('2026-09-26#imp')
  })
})

describe('seedForBoard / playSeedForBoard', () => {
  test('MP-fröet är exakt HMAC-SHA256("datum:bricka") som förr', () => {
    const förr = createHmac('sha256', HEMLIGHET).update('2026-09-26:7').digest().readUInt32BE(0)
    expect(seedForBoard(HEMLIGHET, fronyckel('2026-09-26', 'mp'), 7)).toBe(förr)
    const förrPlay = createHmac('sha256', HEMLIGHET).update('2026-09-26:7:play').digest().readUInt32BE(0)
    expect(playSeedForBoard(HEMLIGHET, fronyckel('2026-09-26', 'mp'), 7)).toBe(förrPlay)
  })

  test('IMP-tävlingens frön skiljer sig från MP-tävlingens samma dag och bricka', () => {
    for (let board = 1; board <= 12; board++) {
      expect(seedForBoard(HEMLIGHET, fronyckel('2026-09-26', 'imp'), board)).not.toBe(
        seedForBoard(HEMLIGHET, fronyckel('2026-09-26', 'mp'), board),
      )
      expect(playSeedForBoard(HEMLIGHET, fronyckel('2026-09-26', 'imp'), board)).not.toBe(
        playSeedForBoard(HEMLIGHET, fronyckel('2026-09-26', 'mp'), board),
      )
    }
  })

  test('giv-fröet och play-fröet sammanfaller aldrig', () => {
    const nyckel = fronyckel('2026-09-26', 'imp')
    expect(seedForBoard(HEMLIGHET, nyckel, 3)).not.toBe(playSeedForBoard(HEMLIGHET, nyckel, 3))
  })
})
