// Facit för Veckans stjärntävling på servern (ägarbeslut 2026-11-11): formen
// 'guld', veckodatumet, frönyckeln — och att ett inskick valideras mot den
// LAGRADE given utan att de dagliga tävlingarnas väg ändras en millimeter.

import { describe, expect, it } from 'vitest'
import { dealFromSeed } from '../../src/lib/engine/deal'
import { GULD_STRATEGI, MP_STRATEGI, raknesatt, strategiFor } from '../../src/lib/engine/matchpoints'
import { spelaBotGiv, spelaBotGivMedGiv } from '../../src/lib/engine/botspelare'
import { fronyckel, playSeedForBoard, seedForBoard } from './seed'
import { lasDag, lasForm, tavlingsdagFor } from './tavlingsdag'
import { validera, valideraGiv } from './validera'

const SECRET = 'test-hemlighet'
// Onsdagen 2026-11-11, mitt på dagen svensk tid. Veckans måndag = 2026-11-09.
const ONSDAG = new Date('2026-11-11T11:00:00Z')

describe('formen guld', () => {
  it('lasForm godtar guld; okända former är fortfarande ogiltiga', () => {
    expect(lasForm('guld')).toBe('guld')
    expect(lasForm('mp')).toBe('mp')
    expect(lasForm(null)).toBe('mp')
    expect(lasForm('silver')).toBe('ogiltig')
  })

  it('guld räknas som MP — samma tal per giv, bara namnet skiljer', () => {
    expect(strategiFor('guld')).toBe(GULD_STRATEGI)
    expect(GULD_STRATEGI.form).toBe('guld')
    expect(GULD_STRATEGI.perGiv).toBe(MP_STRATEGI.perGiv)
    expect(GULD_STRATEGI.provisoriskt).toBe(MP_STRATEGI.provisoriskt)
    expect(raknesatt('guld')).toBe('mp')
    expect(raknesatt('imp')).toBe('imp')
    // De dagliga formerna är orörda.
    expect(strategiFor('mp')).toBe(MP_STRATEGI)
    expect(strategiFor(undefined)).toBe(MP_STRATEGI)
  })

  it('frönyckeln är egen — bottarnas spelfrön krockar aldrig med måndagens MP-tävling', () => {
    expect(fronyckel('2026-11-09', 'guld')).toBe('2026-11-09#guld')
    expect(fronyckel('2026-11-09', 'mp')).toBe('2026-11-09')
    expect(playSeedForBoard(SECRET, fronyckel('2026-11-09', 'guld'), 1)).not.toBe(
      playSeedForBoard(SECRET, fronyckel('2026-11-09', 'mp'), 1),
    )
  })
})

describe('veckodatumet (tavlingsdagFor)', () => {
  const dag = (iso?: string) => {
    const d = lasDag(new URL(`http://x/${iso ? `?dag=${iso}` : ''}`), ONSDAG)
    if (d === 'ogiltig') throw new Error('ogiltig dag i testet')
    return d
  }

  it('de dagliga formerna: dagen själv, oförändrat', () => {
    expect(tavlingsdagFor('mp', dag(), ONSDAG)).toEqual({ dag: '2026-11-11', idag: true })
    expect(tavlingsdagFor('imp', dag('2026-11-10'), ONSDAG)).toEqual({ dag: '2026-11-10', idag: false })
  })

  it('guld: vilken dag i veckan som helst pekar på veckans måndag, och veckan PÅGÅR', () => {
    expect(tavlingsdagFor('guld', dag(), ONSDAG)).toEqual({ dag: '2026-11-09', idag: true })
    // Tjuvkiksgrinden: att fråga uttryckligen efter måndagen mitt i veckan får
    // INTE räknas som en avslutad dag.
    expect(tavlingsdagFor('guld', dag('2026-11-09'), ONSDAG)).toEqual({ dag: '2026-11-09', idag: true })
    expect(tavlingsdagFor('guld', dag('2026-11-10'), ONSDAG)).toEqual({ dag: '2026-11-09', idag: true })
  })

  it('guld: en tidigare vecka är avslutad', () => {
    expect(tavlingsdagFor('guld', dag('2026-11-05'), ONSDAG)).toEqual({ dag: '2026-11-02', idag: false })
  })

  it('guld: söndagen hör till veckan som pågår, måndagen efter är en ny vecka', () => {
    const sondag = new Date('2026-11-15T20:00:00Z')
    const mandag = new Date('2026-11-16T08:00:00Z')
    const idag = (nu: Date) => lasDag(new URL('http://x/'), nu) as { dag: string; idag: boolean }
    expect(tavlingsdagFor('guld', idag(sondag), sondag).dag).toBe('2026-11-09')
    expect(tavlingsdagFor('guld', idag(mandag), mandag).dag).toBe('2026-11-16')
  })
})

describe('valideraGiv — inskick mot en lagrad giv', () => {
  const board = 3
  const playSeed = 4242
  // En "utvald" giv som INTE kommer ur tävlingsfröet.
  const deal = { ...dealFromSeed(987654321, board), id: 'guld-3' }
  const inskick = spelaBotGivMedGiv(deal, playSeed)!

  it('ett ärligt botinskick på den lagrade given godkänns', () => {
    expect(inskick).not.toBeNull()
    const v = valideraGiv(deal, inskick)
    expect(v.giltig).toBe(true)
  })

  it('samma inskick mot en ANNAN giv avvisas — klienten kan inte byta giv', () => {
    const annan = { ...dealFromSeed(123456789, board), id: 'guld-3' }
    expect(valideraGiv(annan, inskick).giltig).toBe(false)
  })

  it('en giv som hör till en annan bricka avvisas', () => {
    expect(valideraGiv({ ...deal, board: 4 }, inskick)).toEqual({ giltig: false, skäl: 'given hör inte till brickan' })
  })

  it('de dagliga tävlingarna går exakt samma väg som förr: validera = valideraGiv på frögiven', () => {
    const nyckel = fronyckel('2026-11-11', 'mp')
    for (const b of [1, 5, 12]) {
      const ins = spelaBotGiv(seedForBoard(SECRET, nyckel, b), playSeedForBoard(SECRET, nyckel, b), b)!
      const viaFro = validera(SECRET, nyckel, ins)
      const viaGiv = valideraGiv(dealFromSeed(seedForBoard(SECRET, nyckel, b), b), ins)
      expect(viaFro).toEqual(viaGiv)
      expect(viaFro.giltig).toBe(true)
    }
    // Fel bricknummer fångas som förr.
    expect(validera(SECRET, nyckel, { board: 0, history: [], plays: [], declarerTricks: 0 })).toEqual({
      giltig: false,
      skäl: 'ogiltig bricka',
    })
  })

  it('botspelaren: frövägen och givvägen ger identiska inskick', () => {
    const nyckel = fronyckel('2026-11-11', 'imp')
    const givSeed = seedForBoard(SECRET, nyckel, 7)
    const ps = playSeedForBoard(SECRET, nyckel, 7)
    expect(spelaBotGiv(givSeed, ps, 7)).toEqual(spelaBotGivMedGiv(dealFromSeed(givSeed, 7), ps))
  })
})
