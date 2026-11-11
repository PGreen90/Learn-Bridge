// Facit för Veckans guld-tävling i klienten (ägarbeslut 2026-11-11):
// veckoräkningen, formens namn/länkar/lagringsplatser, och att tävlingen
// spelas utan hjälpmedel.

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadTavlingFramsteg, loadTavlingPagaende, saveTavlingFramsteg, saveTavlingPagaende } from './backend'
import { enhetText, formQuery, formTitel, talText, tolkaForm } from './backend/tavling'
import { guldNummer, GULD_PREMIAR, msTillNastaGuld, tavlingShareText, veckansMandag } from './engine/daily'
import { validSparadTavlingsgiv } from './engine/resume'
import { utanHjalpmedel, rapportLage, type TavlingSpel } from '../pages/play/tavling-mode'

beforeEach(() => localStorage.clear())

describe('veckoräkningen', () => {
  it('veckansMandag: alla dagar måndag–söndag ger samma måndag', () => {
    for (const d of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-14', '2026-11-15']) {
      expect(veckansMandag(d)).toBe('2026-11-09')
    }
    expect(veckansMandag('2026-11-16')).toBe('2026-11-16')
    // Över årsskifte och sommartidsbyte.
    expect(veckansMandag('2027-01-01')).toBe('2026-12-28')
    expect(veckansMandag('2027-03-28')).toBe('2027-03-22')
  })

  it('guldNummer: premiärveckan är nr 1, sedan en per vecka', () => {
    expect(guldNummer(GULD_PREMIAR)).toBe(1)
    expect(guldNummer('2026-11-16')).toBe(2)
    expect(guldNummer('2027-01-04')).toBe(9)
  })

  it('nedräkningen går till nästa måndag 00:00 svensk tid', () => {
    const TIMME = 60 * 60 * 1000
    // Onsdag 12:00 svensk tid (11:00 UTC, vintertid): 4 dygn + 12 timmar kvar.
    expect(msTillNastaGuld(new Date('2026-11-11T11:00:00Z'))).toBe((4 * 24 + 12) * TIMME)
    // Söndag 23:00 svensk tid: en timme kvar.
    expect(msTillNastaGuld(new Date('2026-11-15T22:00:00Z'))).toBe(TIMME)
    // Måndag 00:30 svensk tid: nästan en hel vecka.
    expect(msTillNastaGuld(new Date('2026-11-15T23:30:00Z'))).toBe(7 * 24 * TIMME - TIMME / 2)
  })
})

describe('formen guld i klienten', () => {
  it('namn, tal och enhet: guld visas som MP% under eget namn', () => {
    expect(formTitel('guld')).toBe('Veckans guld-tävling')
    expect(formTitel('mp')).toBe('Dagens MP%')
    expect(enhetText('guld')).toBe('%')
    expect(talText(62.5, 'guld', 1)).toBe('62.5')
  })

  it('tolkaForm och formQuery: guld är sig själv, okänt blir MP', () => {
    expect(tolkaForm('guld')).toBe('guld')
    expect(tolkaForm('imp')).toBe('imp')
    expect(tolkaForm('silver')).toBe('mp')
    expect(tolkaForm(null)).toBe('mp')
    expect(formQuery('guld')).toBe('?form=guld')
    expect(formQuery('imp')).toBe('?form=imp')
    expect(formQuery('mp')).toBe('')
  })

  it('egna lagringsplatser — guld-framsteg skriver aldrig över MP-tävlingens', () => {
    saveTavlingFramsteg({ nummer: 93, klara: [] }, 'mp')
    saveTavlingFramsteg({ nummer: 1, klara: [] }, 'guld')
    expect(loadTavlingFramsteg('mp')?.nummer).toBe(93)
    expect(loadTavlingFramsteg('guld')?.nummer).toBe(1)
    expect(localStorage.getItem('learnbridge:tavling-framsteg')).toContain('93')
    expect(localStorage.getItem('learnbridge:tavling-framsteg-guld')).toContain('"nummer":1')
    // IMP-nyckeln är oförändrad sedan förr.
    saveTavlingFramsteg({ nummer: 50, klara: [] }, 'imp')
    expect(localStorage.getItem('learnbridge:tavling-framsteg-imp')).toContain('50')

    saveTavlingPagaende(null, 'guld')
    expect(localStorage.getItem('learnbridge:tavling-pagaende-guld')).toBe('null')
    expect(loadTavlingPagaende('mp')).toBeNull()
  })

  it('en pågående guld-giv kan återupptas', () => {
    const giv = { v: 1, nummer: 1, board: 4, form: 'guld', phase: 'bidding', history: [], plays: [], undoFloor: 0 }
    expect(validSparadTavlingsgiv(giv)).toBe(true)
    expect(validSparadTavlingsgiv({ ...giv, form: 'silver' })).toBe(false)
  })

  it('delningstexten länkar till guld-tävlingen', () => {
    const text = tavlingShareText({ form: 'guld', nummer: 1, placering: 2, antalSpelare: 6, resultat: '58,3 %' })
    expect(text).toContain('Veckans guld-tävling #1')
    expect(text).toContain('https://rebidz.com/#/spela-kort/tavling?form=guld')
  })
})

describe('utan hjälpmedel', () => {
  const spel = (form: TavlingSpel['form'], övning = false) => ({ form, övning, nummer: 1, board: 5 }) as TavlingSpel

  it('bara den skarpa guld-tävlingen spelas utan budhjälp och facit', () => {
    expect(utanHjalpmedel(spel('guld'))).toBe(true)
    expect(utanHjalpmedel(spel('guld', true))).toBe(false) // övningsomspel har hjälpen kvar
    expect(utanHjalpmedel(spel('mp'))).toBe(false)
    expect(utanHjalpmedel(spel('imp'))).toBe(false)
    expect(utanHjalpmedel(undefined)).toBe(false)
  })

  it('felrapporten säger att given kom från guld-tävlingen', () => {
    expect(rapportLage(spel('guld'))).toBe('Veckans guld-tävling nr 1, giv 5')
    expect(rapportLage(spel('mp'))).toBe('Dagens MP% nr 1, giv 5')
  })
})
