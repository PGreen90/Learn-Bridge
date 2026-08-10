// @vitest-environment jsdom
// Facit för sömstället (Beslut B etapp 0, steg 3): backend-lagret ska vara en
// GENOMSKINLIG omslutning av lib/storage. Bevisar transparensen — att spara via
// en facade-metod skriver EXAKT samma `learnbridge:`-nyckel och samma JSON-värde
// som sidorna skrev förr, och läser tillbaka det — för minst dagsloggen,
// spelhistoriken, en temapoäng och en inställning. Samt att loadX ger rätt
// fallback när inget finns. Bricks bytet i etapp 1 formen, faller detta.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadAutoClaim,
  saveAutoClaim,
  loadDailyLog,
  saveDailyLog,
  loadDailyPlayed,
  saveDailyPlayed,
  loadPlaySpeed,
  savePlaySpeed,
  loadSpelHistorik,
  saveSpelHistorik,
  loadThemeScore,
  saveThemeScore,
  loadSavedGame,
} from './index'
import { loadValue } from '../storage'
import type { DailyLog } from '../engine/daily'
import type { SpelResultat } from '../engine/spel-historik'

const PREFIX = 'learnbridge:'

beforeEach(() => localStorage.clear())

describe('backend-lagret skriver EXAKT samma nyckel + värde som förr', () => {
  it('dagsloggen (konto): samma learnbridge:daily-log och samma JSON', () => {
    const log: DailyLog = { 3: { myTricks: 9 }, 4: { myTricks: 11, late: true } }
    saveDailyLog(log)
    // Rå nyckel + rått JSON-värde — precis som sidorna skrev via saveValue förr.
    expect(localStorage.getItem(PREFIX + 'daily-log')).toBe(JSON.stringify(log))
    // Går att läsa tillbaka via lagret OCH via primitiven (samma sömställe).
    expect(loadDailyLog()).toEqual(log)
    expect(loadValue<DailyLog>('daily-log', {})).toEqual(log)
  })

  it('spelhistoriken (konto): samma learnbridge:spel-historik och samma JSON', () => {
    const list: SpelResultat[] = [
      {
        seed: 12345,
        when: 1000,
        bid: '4S',
        doubled: '',
        declarer: 'S',
        myTricks: 10,
        win: true,
        headline: 'Hemgång! +0',
        scoreLabel: 'NS +420',
      },
    ]
    saveSpelHistorik(list)
    expect(localStorage.getItem(PREFIX + 'spel-historik')).toBe(JSON.stringify(list))
    expect(loadSpelHistorik()).toEqual(list)
  })

  it('temapoängen (konto): nyckeln learnbridge:theme:<id> med rätt id', () => {
    saveThemeScore('oppning-1nt', { correct: 7, total: 8 })
    expect(localStorage.getItem(PREFIX + 'theme:oppning-1nt')).toBe(
      JSON.stringify({ correct: 7, total: 8 }),
    )
    expect(loadThemeScore('oppning-1nt')).toEqual({ correct: 7, total: 8 })
  })

  it('en inställning (enhet): samma learnbridge:playSpeed och samma värde', () => {
    savePlaySpeed('snabb')
    expect(localStorage.getItem(PREFIX + 'playSpeed')).toBe(JSON.stringify('snabb'))
    expect(loadPlaySpeed()).toBe('snabb')
    // En boolean-inställning tur och retur.
    saveAutoClaim(false)
    expect(localStorage.getItem(PREFIX + 'autoClaim')).toBe(JSON.stringify(false))
    expect(loadAutoClaim()).toBe(false)
  })
})

describe('loadX ger rätt fallback när inget finns', () => {
  it('faller tillbaka på defaultvärdena', () => {
    expect(loadDailyLog()).toEqual({}) // tom logg
    expect(loadDailyPlayed()).toBeNull()
    expect(loadSpelHistorik()).toEqual([]) // tom historik
    expect(loadThemeScore('finns-ej')).toBeNull()
    expect(loadPlaySpeed()).toBe('normal')
    expect(loadAutoClaim()).toBe(true)
    expect(loadSavedGame()).toBeNull() // ingen pågående giv
  })

  it('daily-played tur och retur behåller talet', () => {
    saveDailyPlayed(42)
    expect(localStorage.getItem(PREFIX + 'daily-played')).toBe(JSON.stringify(42))
    expect(loadDailyPlayed()).toBe(42)
  })
})
