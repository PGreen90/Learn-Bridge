import { describe, expect, it } from 'vitest'
import { isAlertRule } from './alerts'

describe('isAlertRule – flaggar konstgjorda bud', () => {
  it('konventionella bud alertas', () => {
    for (const rule of [
      'Jacoby 2NT',
      'tvetydig splinter',
      'Stayman',
      'Stayman (2NT)',
      'Jacoby-transfer',
      'transfer (2NT)',
      'Texas',
      'Bergen limit',
      'inverterad minor',
      'Drury',
      '1430 RKC',
      'Sjöberg 5NT',
      'Gerber kungfråga',
      'Exclusion',
      'cue-bid',
      'cue (limithöjning+)',
      'Michaels',
      'ovanlig 2NT',
      'negativ dubbling',
      'Lebensohl 2NT (svag)',
      'DONT tvåfärg',
      'Mathe X (högfärger)',
      'Ogust',
      'Smolen',
      'fjärde färg krav',
      'stark 2♣',
      '2♦ väntebud',
      'trumfdam: ja + kung',
    ]) {
      expect(isAlertRule(rule), rule).toBe(true)
    }
  })

  it('naturliga bud alertas INTE', () => {
    for (const rule of [
      '5-korts högfärg',
      'minor-regeln',
      'enkel höjning',
      'ny färg (1-läget)',
      '2-över-1 GF',
      '3NT till spel',
      'pass',
      'rebid: pass',
      'spärr',
      'svag tvåa',
      'höjning till utgång',
      'slamavslut',
      '4NT kvantitativ',
      undefined,
    ]) {
      expect(isAlertRule(rule), String(rule)).toBe(false)
    }
  })
})
