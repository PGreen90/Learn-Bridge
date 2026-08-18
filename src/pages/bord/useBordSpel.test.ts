// Facit för presentationsköns takt (vänner-bordet): en passiv spelare
// (träkarlen, vars kort spelföraren spelar) får ANDRAS kort i en snabb
// utjämningstakt (`bordKort`) så vyn hinner med även en snabb spelförare och
// inte halkar efter stick för stick. Egna drag avtäcks direkt; andras bud i
// budtakt (auktionen ska gå att läsa); resultat en uttoning. De rena besluten
// bor i avtackningsPaus — här vaktas de utan timers.

import { describe, test, expect } from 'vitest'
import type { BordHandelse } from '../../lib/backend/bord'
import { ms } from '../play/tempo'
import { avtackningsPaus } from './useBordSpel'

const ev = (typ: string, data: Record<string, unknown> = {}): BordHandelse => ({
  seq: 1,
  giv: 1,
  typ,
  seat: 'N',
  data,
})

describe('presentationsköns takt — avtackningsPaus', () => {
  test('andras kort visas i den snabba utjämningstakten (realtidskänsla)', () => {
    expect(avtackningsPaus(ev('kort'), false, 'normal')).toBe(ms('bordKort', 'normal'))
  })

  test('andras bud visas i budtakt (auktionen ska gå att läsa)', () => {
    expect(avtackningsPaus(ev('bud', { bid: '1S' }), false, 'normal')).toBe(
      ms('budDelay', 'normal'),
    )
  })

  test('egna drag avtäcks omedelbart', () => {
    expect(avtackningsPaus(ev('kort'), true, 'normal')).toBe(0)
    expect(avtackningsPaus(ev('bud', { bid: '1S' }), true, 'normal')).toBe(0)
  })

  test('giv-klar/facit får resultatuttoningens paus', () => {
    expect(avtackningsPaus(ev('giv-klar'), false, 'normal')).toBe(ms('resultOutro', 'normal'))
    expect(avtackningsPaus(ev('facit'), false, 'normal')).toBe(ms('resultOutro', 'normal'))
  })

  test('takten skalar med tempot', () => {
    expect(avtackningsPaus(ev('kort'), false, 'snabb')).toBe(ms('bordKort', 'snabb'))
    expect(avtackningsPaus(ev('kort'), false, 'lugn')).toBe(ms('bordKort', 'lugn'))
  })
})
