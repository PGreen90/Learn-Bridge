// Facit för "Veckans stjärna" (ägarbeslut 2026-11-12): vinnaren av den senast
// avslutade stjärntävlingen koras och syns i en pratbubbla på startsidan.
// Samma regel som medaljerna: datorspelarna koras aldrig.

import { describe, expect, it } from 'vitest'
import { forraStjarnveckan, veckansStjarna } from './tavlingsavslut'

const rad = (spelare: string, placering: number, snitt: number) => ({ spelare, placering, snitt })

describe('veckansStjarna', () => {
  it('ettan i ställningen är veckans stjärna', () => {
    const st = [rad('b', 2, 55), rad('a', 1, 64.6), rad('c', 3, 41)]
    expect(veckansStjarna(st, new Set())).toEqual({ spelare: 'a', snitt: 64.6 })
  })

  it('en datorspelare koras aldrig — bästa människan blir stjärnan', () => {
    const st = [rad('bot', 1, 70), rad('anna', 2, 61), rad('bo', 3, 50)]
    expect(veckansStjarna(st, new Set(['bot']))).toEqual({ spelare: 'anna', snitt: 61 })
  })

  it('ingen människa spelade → ingen stjärna', () => {
    expect(veckansStjarna([rad('bot1', 1, 60), rad('bot2', 2, 50)], new Set(['bot1', 'bot2']))).toBeNull()
    expect(veckansStjarna([], new Set())).toBeNull()
  })

  it('delad förstaplats: stabil ordning (id) så bubblan inte växlar mellan anrop', () => {
    const st = [rad('zeb', 1, 60), rad('adam', 1, 60)]
    expect(veckansStjarna(st, new Set())?.spelare).toBe('adam')
  })
})

describe('forraStjarnveckan', () => {
  it('måndagen i veckan FÖRE den som pågår', () => {
    expect(forraStjarnveckan('2026-11-12')).toBe('2026-11-02') // torsdag v46 → mån v45
    expect(forraStjarnveckan('2026-11-16')).toBe('2026-11-09') // måndag v47 → mån v46
    expect(forraStjarnveckan('2026-11-15')).toBe('2026-11-02') // söndag v46: veckan pågår än
  })
})
