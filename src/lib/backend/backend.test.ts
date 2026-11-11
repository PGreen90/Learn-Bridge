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
  loadTraningslogg,
  loadTraningsmissar,
  sparaTraningssvar,
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

  it('träningsloggen (konto): nyckeln learnbridge:traning:<id>, nyast sist, högst 20 svar', () => {
    expect(sparaTraningssvar('oppning', true)).toEqual([true])
    expect(sparaTraningssvar('oppning', false)).toEqual([true, false])
    expect(localStorage.getItem(PREFIX + 'traning:oppning')).toBe(JSON.stringify([true, false]))
    for (let i = 0; i < 30; i++) sparaTraningssvar('oppning', true)
    const logg = loadTraningslogg('oppning')
    expect(logg).toHaveLength(20)
    expect(logg.every((x) => x)).toBe(true) // det gamla felsvaret har rullat ut
    // Trasig lagring ger tom logg, inte krasch.
    localStorage.setItem(PREFIX + 'traning:oppning', JSON.stringify({ skräp: 1 }))
    expect(loadTraningslogg('oppning')).toEqual([])
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
    expect(loadTraningslogg('finns-ej')).toEqual([])
    expect(loadTraningsmissar()).toEqual([]) // tom kö
    // Trasig lagring ger tom kö, inte krasch.
    localStorage.setItem(PREFIX + 'traning-missar', JSON.stringify([{ skräp: 1 }, null, 'x']))
    expect(loadTraningsmissar()).toEqual([])
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
