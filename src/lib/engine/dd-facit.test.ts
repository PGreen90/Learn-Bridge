// FACIT för den delade DD-facit-läsaren (bordens SENARE-lista etapp 2,
// 2026-09-14): uppslag i lösarens tabell, jämförelsen mot spelade stick och
// par-textens format. Facit FÖRE kod.

import { describe, expect, it } from 'vitest'
import { ddJamforelse, ddStick, formateraParKontrakt, parText, type DdFacit } from './dd-facit'

// tabell[strain][säte]: strain 0=♠ 1=♥ 2=♦ 3=♣ 4=NT, säte 0=N 1=Ö 2=S 3=V.
const DD: DdFacit = {
  tabell: [
    [10, 3, 10, 3],
    [7, 6, 7, 6],
    [8, 5, 8, 5],
    [6, 7, 6, 7],
    [9, 4, 9, 4],
  ],
  parNS: 420,
  parKontrakt: ['4S-NS'],
}

describe('ddStick / ddJamforelse', () => {
  it('slår upp rätt cell: 4♠ av N = 10, 3NT av S = 9, 1♣ av V = 7', () => {
    expect(ddStick(DD, 'N', 'spades')).toBe(10)
    expect(ddStick(DD, 'S', 'NT')).toBe(9)
    expect(ddStick(DD, 'W', 'clubs')).toBe(7)
  })
  it('jämförelsen: 3NT av N med 8 tagna stick = facit 9, diff −1', () => {
    expect(ddJamforelse(DD, { declarer: 'N', strain: 'NT', level: 3 }, 8)).toEqual({ facit: 9, diff: -1 })
    expect(ddJamforelse(DD, { declarer: 'E', strain: 'hearts', level: 2 }, 8)).toEqual({ facit: 6, diff: 2 })
  })
  it('trasig tabell → null i stället för krasch', () => {
    expect(ddStick({ tabell: [], parNS: 0, parKontrakt: [] }, 'N', 'NT')).toBeNull()
    expect(ddJamforelse({ tabell: [], parNS: 0, parKontrakt: [] }, { declarer: 'N', strain: 'NT', level: 3 }, 9)).toBeNull()
  })
})

describe('par-texten', () => {
  it('lösarens kontraktsform blir läsbar: 4S-NS → 4♠ NS, 3Nx-EW → 3NTx ÖV', () => {
    expect(formateraParKontrakt('4S-NS')).toBe('4♠ NS')
    expect(formateraParKontrakt('3Nx-EW')).toBe('3NTx ÖV')
    expect(formateraParKontrakt('konstigt')).toBe('konstigt')
  })
  it('par-raden: kontrakt + poäng från den sida som äger den', () => {
    expect(parText(DD)).toBe('4♠ NS (NS +420)')
    expect(parText({ ...DD, parNS: -140, parKontrakt: ['2H-EW', '2S-EW'] })).toBe('2♥ ÖV / 2♠ ÖV (ÖV +140)')
    expect(parText({ ...DD, parNS: 0, parKontrakt: [] })).toBe('±0')
  })
})
