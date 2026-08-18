// Facit för presentationsköns takt (etapp 4B-fix, träkarlens eftersläpning):
// en passiv spelare (träkarlen) fick korten uppspelade i bot-takt, ett i taget,
// och halkade efter stick för stick när spelföraren (en människa) spelade
// snabbare än takten. Fixen: ligger vyn mer än ETT STICK efter loggens huvud
// snabbspolar kön ikapp (0 ms) och sticksvepet hoppas över. De rena besluten
// bor i avtackningsPaus/skaSvepa — här vaktas de utan timers.

import { describe, test, expect } from 'vitest'
import type { BordHandelse } from '../../lib/backend/bord'
import { ms } from '../play/tempo'
import { avtackningsPaus, skaSvepa, IKAPP_TROSKEL } from './useBordSpel'

const ev = (typ: string, data: Record<string, unknown> = {}): BordHandelse => ({
  seq: 1,
  giv: 1,
  typ,
  seat: 'N',
  data,
})

describe('presentationsköns takt — avtackningsPaus', () => {
  test('vid levande kanten: annans kort visas i den snabba utjämningstakten', () => {
    // Realtidskänsla, inte bot-tänketid — kortet syns i stort sett när det landar.
    expect(avtackningsPaus(ev('kort'), 1, false, 'normal')).toBe(ms('bordKort', 'normal'))
  })

  test('vid levande kanten: annans bud visas i budtakt', () => {
    expect(avtackningsPaus(ev('bud', { bid: '1S' }), 1, false, 'normal')).toBe(
      ms('budDelay', 'normal'),
    )
  })

  test('egna drag avtäcks omedelbart', () => {
    expect(avtackningsPaus(ev('kort'), 1, true, 'normal')).toBe(0)
    expect(avtackningsPaus(ev('bud', { bid: '1S' }), 1, true, 'normal')).toBe(0)
  })

  test('giv-klar/facit får resultatuttoningens paus', () => {
    expect(avtackningsPaus(ev('giv-klar'), 1, false, 'normal')).toBe(ms('resultOutro', 'normal'))
    expect(avtackningsPaus(ev('facit'), 1, false, 'normal')).toBe(ms('resultOutro', 'normal'))
  })

  test('KÄRNAN: ligger vyn mer än ett stick efter snabbspolas allt (0 ms)', () => {
    const bakom = IKAPP_TROSKEL + 1
    // Även ett annars långsamt bot-kort snabbspolas när backloggen är stor.
    expect(avtackningsPaus(ev('kort'), bakom, false, 'normal')).toBe(0)
    expect(avtackningsPaus(ev('bud', { bid: '1S' }), bakom, false, 'lugn')).toBe(0)
    expect(avtackningsPaus(ev('giv-klar'), bakom, false, 'normal')).toBe(0)
  })

  test('exakt på tröskeln behåller normal takt (ingen snabbspolning ännu)', () => {
    expect(avtackningsPaus(ev('kort'), IKAPP_TROSKEL, false, 'normal')).toBe(
      ms('bordKort', 'normal'),
    )
  })
})

describe('sticksvepet — skaSvepa', () => {
  test('sveper vid levande kanten', () => {
    expect(skaSvepa(0)).toBe(true)
    expect(skaSvepa(IKAPP_TROSKEL)).toBe(true)
  })

  test('hoppar över svepet under ikapp-spolning (annars fryser kön)', () => {
    expect(skaSvepa(IKAPP_TROSKEL + 1)).toBe(false)
  })
})
