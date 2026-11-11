// Tillbaka till rätt sida efter inloggning: målet ska överleva, men länken får
// aldrig kunna skicka någon ut ur appen.

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { hamtaMal, inloggLank, kommIhagMal, malEfterInloggning, sakerVag } from './efter-inloggning'

beforeEach(() => localStorage.clear())

describe('sakerVag', () => {
  it('godtar vägar inom appen, med frågedel', () => {
    expect(sakerVag('/spela-kort/tavling')).toBe('/spela-kort/tavling')
    expect(sakerVag('/spela-kort/tavling?form=imp')).toBe('/spela-kort/tavling?form=imp')
    expect(sakerVag('/bord/ABCD')).toBe('/bord/ABCD')
  })

  it('vägrar allt som kan leda ut ur appen', () => {
    for (const v of ['https://ond.example', '//ond.example', '/\\ond.example', 'konto', '/x?u=http://ond.example', '', null, undefined]) {
      expect(sakerVag(v)).toBeNull()
    }
    expect(sakerVag('/' + 'a'.repeat(300))).toBeNull()
  })

  it('skickar aldrig tillbaka till inloggningssidorna själva', () => {
    for (const v of ['/logga-in', '/registrera', '/logga-in?till=/konto', '/auth/callback', '/nytt-losenord']) {
      expect(sakerVag(v)).toBeNull()
    }
  })
})

describe('inloggLank', () => {
  it('bär med sig målet, kodat', () => {
    expect(inloggLank('/logga-in', '/spela-kort/tavling?form=imp')).toBe(
      '/logga-in?till=%2Fspela-kort%2Ftavling%3Fform%3Dimp',
    )
  })
  it('utan säkert mål blir det den vanliga länken', () => {
    expect(inloggLank('/registrera', 'https://ond.example')).toBe('/registrera')
    expect(inloggLank('/logga-in', null)).toBe('/logga-in')
  })
})

describe('målet över mejlbekräftelsen', () => {
  it('sparas, hämtas EN gång och glöms sedan', () => {
    kommIhagMal('/spela-kort/tavling')
    expect(hamtaMal()).toBe('/spela-kort/tavling')
    expect(hamtaMal()).toBeNull()
  })

  it('ett dygn gammalt mål gäller inte längre', () => {
    kommIhagMal('/spela-kort/tavling', 0)
    expect(hamtaMal(25 * 60 * 60 * 1000)).toBeNull()
  })

  it('osäkra mål sparas aldrig, och manipulerad lagring ignoreras', () => {
    kommIhagMal('https://ond.example')
    expect(hamtaMal()).toBeNull()
    localStorage.setItem('rebidz:efter-inloggning', JSON.stringify({ mal: '//ond.example', nar: Date.now() }))
    expect(hamtaMal()).toBeNull()
    localStorage.setItem('rebidz:efter-inloggning', 'skräp')
    expect(hamtaMal()).toBeNull()
  })
})

describe('malEfterInloggning', () => {
  it('?till= går först, sedan det sparade målet, annars kontosidan', () => {
    kommIhagMal('/spela-med-vanner')
    expect(malEfterInloggning('/spela-kort/tavling')).toBe('/spela-kort/tavling')
    expect(malEfterInloggning(null)).toBe('/spela-med-vanner')
    expect(malEfterInloggning(null)).toBe('/konto')
    expect(malEfterInloggning('https://ond.example')).toBe('/konto')
  })
})
