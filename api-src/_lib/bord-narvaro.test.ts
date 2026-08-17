// Facit för närvarodomaren (etapp 4C) — bord-regler med injicerad klocka:
// 45 s-frånvaron, 60 s-auto-godkännandet, ägarbytet till äldsta människan och
// begärande-projektionen ur händelseflödet.

import { describe, test, expect } from 'vitest'
import type { Stol } from './bord-grund'
import {
  AUTO_GODKANN_MS,
  FRANVARO_MS,
  narvaroBeslut,
  vantandeBegaranden,
  type NarvaroStol,
} from './bord-narvaro'

const NU = 1_000_000_000

function stol(
  s: Stol,
  over: Partial<NarvaroStol> = {},
): NarvaroStol {
  return {
    stol: s,
    userId: null,
    typ: 'bot',
    status: 'aktiv',
    lastSeen: null,
    joined: null,
    ...over,
  }
}

const AGARE = 'agare-id'

describe('narvaroBeslut', () => {
  test('pigga spelare → inga beslut', () => {
    const stolar = [
      stol('S', { userId: AGARE, typ: 'manniska', lastSeen: NU - 1_000, joined: 1 }),
      stol('N', { userId: 'u2', typ: 'manniska', lastSeen: NU - 3_000, joined: 2 }),
      stol('E'),
      stol('W'),
    ]
    expect(narvaroBeslut(stolar, [], AGARE, NU)).toEqual([])
  })

  test('45 s utan hjärtslag → boten tar stolen', () => {
    const stolar = [
      stol('S', { userId: AGARE, typ: 'manniska', lastSeen: NU - 1_000, joined: 1 }),
      stol('N', { userId: 'u2', typ: 'manniska', lastSeen: NU - FRANVARO_MS - 1, joined: 2 }),
    ]
    expect(narvaroBeslut(stolar, [], AGARE, NU)).toEqual([{ slag: 'bot-tar-over', stol: 'N' }])
  })

  test('paus-stol utan hjärtslag rör inte frånvaron (boten spelar redan)', () => {
    const stolar = [
      stol('S', { userId: AGARE, typ: 'manniska', lastSeen: NU - 1_000, joined: 1 }),
      stol('N', { userId: 'u2', typ: 'manniska', status: 'paus', lastSeen: NU - 90_000, joined: 2 }),
    ]
    expect(narvaroBeslut(stolar, [], AGARE, NU)).toEqual([])
  })

  test('obesvarad begäran auto-godkänns efter 60 s — inte före', () => {
    const stolar = [stol('S', { userId: AGARE, typ: 'manniska', lastSeen: NU, joined: 1 })]
    const farsk = [{ stol: 'N' as Stol, slag: 'paus' as const, sedan: NU - AUTO_GODKANN_MS + 1_000 }]
    expect(narvaroBeslut(stolar, farsk, AGARE, NU)).toEqual([])
    const gammal = [{ stol: 'N' as Stol, slag: 'lamna' as const, sedan: NU - AUTO_GODKANN_MS - 1 }]
    expect(narvaroBeslut(stolar, gammal, AGARE, NU)).toEqual([
      { slag: 'godkann', stol: 'N', begaran: 'lamna' },
    ])
  })

  test('ägaren borta > 60 s → värdskapet till människan med äldst joined', () => {
    const stolar = [
      stol('S', { userId: AGARE, typ: 'manniska', lastSeen: NU - AUTO_GODKANN_MS - 1, joined: 1 }),
      stol('N', { userId: 'u2', typ: 'manniska', lastSeen: NU - 1_000, joined: 30 }),
      stol('E', { userId: 'u3', typ: 'manniska', lastSeen: NU - 2_000, joined: 20 }),
    ]
    const beslut = narvaroBeslut(stolar, [], AGARE, NU)
    // Ägarens stol får också bot-övertag (45 s < 60 s), och värdskapet går
    // till u3 (joined 20 < 30).
    expect(beslut).toContainEqual({ slag: 'bot-tar-over', stol: 'S' })
    expect(beslut).toContainEqual({ slag: 'agarbyte', tillUserId: 'u3' })
  })

  test('ägaren borta men ingen aktiv människa kvar → inget ägarbyte', () => {
    const stolar = [
      stol('S', { userId: AGARE, typ: 'manniska', lastSeen: NU - AUTO_GODKANN_MS - 1, joined: 1 }),
      stol('N', { userId: 'u2', typ: 'manniska', status: 'paus', lastSeen: NU - 1_000, joined: 2 }),
    ]
    const beslut = narvaroBeslut(stolar, [], AGARE, NU)
    expect(beslut.some((b) => b.slag === 'agarbyte')).toBe(false)
  })
})

describe('vantandeBegaranden', () => {
  test('senaste begäran per stol utan senare svar; svar och stolbyten nollar', () => {
    const h = (typ: string, seat: Stol, tidMs: number, data: unknown = {}) => ({
      typ,
      seat,
      data,
      tidMs,
    })
    const flode = [
      h('paus-begaran', 'N', 100),
      h('paus-svar', 'N', 200), // besvarad → borta
      h('lamna-begaran', 'E', 300),
      h('paus-begaran', 'W', 400),
      h('stol', 'W', 500, { handling: 'bot-tar-over' }), // stolen togs över → inaktuell
    ]
    expect(vantandeBegaranden(flode)).toEqual([{ stol: 'E', slag: 'lamna', sedan: 300 }])
  })
})
