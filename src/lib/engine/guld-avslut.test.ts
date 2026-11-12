// Facit för guld-tävlingens AVSLUT (ägarbeslut 2026-11-12: historik + medaljer
// även för Veckans stjärntävling). En daglig tävling är slut när dagen är slut;
// guld-tävlingen ligger på veckans MÅNDAG och är slut först när veckan är slut.
// Samma regel styr både historikens lista och nattens frysning av ställningen.

import { describe, expect, it } from 'vitest'
import { veckoText } from './daily'
import { avslutadFore, arAvslutat, skaSkrivasOm } from './tavlingsavslut'

const ONSDAG = '2026-11-18' // vecka 2 pågår (måndag 2026-11-16)

describe('när är en tävling avslutad?', () => {
  it('de dagliga: allt före i dag, som förr', () => {
    expect(avslutadFore('mp', ONSDAG)).toBe(ONSDAG)
    expect(avslutadFore('imp', ONSDAG)).toBe(ONSDAG)
    expect(arAvslutat({ comp_date: '2026-11-17', form: 'mp' }, ONSDAG)).toBe(true)
    expect(arAvslutat({ comp_date: ONSDAG, form: 'imp' }, ONSDAG)).toBe(false)
  })

  it('guld: veckan som pågår är INTE avslutad, fast dess måndag ligger före i dag', () => {
    expect(avslutadFore('guld', ONSDAG)).toBe('2026-11-16')
    expect(arAvslutat({ comp_date: '2026-11-16', form: 'guld' }, ONSDAG)).toBe(false)
    expect(arAvslutat({ comp_date: '2026-11-09', form: 'guld' }, ONSDAG)).toBe(true)
  })

  it('guld: söndag kväll pågår veckan, måndag morgon är den avslutad', () => {
    expect(arAvslutat({ comp_date: '2026-11-09', form: 'guld' }, '2026-11-15')).toBe(false)
    expect(arAvslutat({ comp_date: '2026-11-09', form: 'guld' }, '2026-11-16')).toBe(true)
    // Nästa veckas set läggs upp redan på söndagen — det är aldrig avslutat då.
    expect(arAvslutat({ comp_date: '2026-11-16', form: 'guld' }, '2026-11-15')).toBe(false)
  })

  it('en gammal rad utan form räknas som MP', () => {
    expect(arAvslutat({ comp_date: '2026-11-17', form: null }, ONSDAG)).toBe(true)
  })
})

describe('vilka ställningar skrivs om varje natt?', () => {
  it('de dagliga: de tre senaste dagarna', () => {
    expect(skaSkrivasOm({ comp_date: '2026-11-15', form: 'mp' }, ONSDAG)).toBe(true)
    expect(skaSkrivasOm({ comp_date: '2026-11-14', form: 'mp' }, ONSDAG)).toBe(false)
  })

  it('guld: förra veckan skrivs om hela veckan efter, äldre veckor rörs inte', () => {
    expect(skaSkrivasOm({ comp_date: '2026-11-09', form: 'guld' }, ONSDAG)).toBe(true)
    expect(skaSkrivasOm({ comp_date: '2026-11-09', form: 'guld' }, '2026-11-22')).toBe(true)
    expect(skaSkrivasOm({ comp_date: '2026-11-02', form: 'guld' }, ONSDAG)).toBe(false)
  })
})

describe('veckoText', () => {
  it('måndag–söndag i samma månad och över månadsskifte', () => {
    expect(veckoText('2026-11-09')).toBe('9–15 nov')
    expect(veckoText('2026-11-30')).toBe('30 nov–6 dec')
    expect(veckoText('2026-12-28')).toBe('28 dec–3 jan')
  })
})
