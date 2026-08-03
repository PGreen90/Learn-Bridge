import { describe, expect, it } from 'vitest'
import { addResult, HISTORIK_CAP, validHistorik, type SpelResultat } from './spel-historik'

// Resultathistoriken för frispelet (granskningsputsen 2026-08-03): varje
// färdigspelad fri giv bokförs nyast först, listan kapas vid taket, och en
// korrupt sparning känns igen i stället för att krascha sidan.

function resultat(seed: number): SpelResultat {
  return {
    seed,
    when: seed * 1000,
    bid: '4S',
    doubled: '',
    declarer: 'S',
    myTricks: 10,
    win: true,
    headline: 'Hemgång!',
    scoreLabel: 'NS +420',
  }
}

describe('resultathistoriken för frispelet', () => {
  it('nya resultat läggs först — nyast överst', () => {
    const list = addResult(addResult([], resultat(1)), resultat(2))
    expect(list.map((r) => r.seed)).toEqual([2, 1])
  })

  it('listan kapas vid taket — de äldsta faller bort', () => {
    let list: SpelResultat[] = []
    for (let i = 1; i <= HISTORIK_CAP + 5; i++) list = addResult(list, resultat(i))
    expect(list).toHaveLength(HISTORIK_CAP)
    expect(list[0].seed).toBe(HISTORIK_CAP + 5) // nyast kvar
    expect(list[list.length - 1].seed).toBe(6) // 1–5 utkapade
  })

  it('strukturkontrollen släpper igenom riktiga listor …', () => {
    expect(validHistorik([])).toBe(true)
    expect(validHistorik([resultat(7)])).toBe(true)
  })

  it('… men stoppar korrupta sparningar', () => {
    expect(validHistorik(null)).toBe(false)
    expect(validHistorik('skräp')).toBe(false)
    expect(validHistorik([{ seed: 'fel-typ' }])).toBe(false)
    expect(validHistorik([resultat(1), { halvfärdig: true }])).toBe(false)
  })
})
