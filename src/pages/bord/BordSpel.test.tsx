// @vitest-environment jsdom
// Röktest för spelvyn (etapp 4B): bud- och spelfasen ska rendera ur ett
// serverläge (mockat backend-lager). Spelmotoriken vaktas av bord-motor.test.ts
// (servern) och bord-projektion.test.ts (klienten) — här verifieras att vyn
// faktiskt monterar med de riktiga presentationskomponenterna, eftersom bordet
// inte kan provspelas lokalt (serverfunktionerna finns bara i molnet).

import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Card, Seat } from '../../types/bridge'
import type { BordHandelse } from '../../lib/backend/bord'

const kort = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

/** 13 giltiga kort till min hand. */
const MIN_HAND: Card[] = [
  kort('spades', 'A'),
  kort('spades', 'K'),
  kort('spades', '7'),
  kort('hearts', 'Q'),
  kort('hearts', '8'),
  kort('hearts', '3'),
  kort('diamonds', 'J'),
  kort('diamonds', '9'),
  kort('diamonds', '4'),
  kort('clubs', '10'),
  kort('clubs', '6'),
  kort('clubs', '5'),
  kort('clubs', '2'),
]

let seq = 0
const h = (typ: string, seat: Seat | null, data: unknown, giv = 1): BordHandelse => ({
  seq: ++seq,
  giv,
  typ,
  seat,
  data: data as Record<string, unknown>,
})

/** Det mockade serverläget — sätts per test före render. */
let svarEvents: BordHandelse[] = []

vi.mock('../../lib/backend/bord', () => ({
  hamtaBordLage: vi.fn(async () => ({
    ok: true,
    meta: {
      id: 'bord-id',
      kod: 'ABC234',
      status: 'spelar',
      spelform: 'full',
      givar: 4,
      tempo: 'normal',
      privat: false,
      aktuellGiv: 1,
      duArAgare: true,
      dinStol: 'S',
    },
    stolar: (['N', 'E', 'S', 'W'] as Seat[]).map((stol) => ({
      stol,
      typ: stol === 'S' ? 'manniska' : 'bot',
      namn: stol === 'S' ? 'Patrik' : null,
      status: 'aktiv',
    })),
    events: svarEvents,
    senasteSeq: svarEvents.length ? svarEvents[svarEvents.length - 1].seq : 0,
    dinHand: MIN_HAND,
    stallning: { ns: 0, ew: 0 },
    givStartSeq: 1,
  })),
  bordHjartslag: vi.fn(async () => ({ ok: true, senasteSeq: 0, events: [] })),
  skickaDrag: vi.fn(async () => ({ ok: true, events: [], senasteSeq: 0 })),
  prenumereraBordHandelser: vi.fn(() => () => {}),
}))

import { BordSpel } from './BordSpel'

afterEach(() => {
  cleanup()
})

function rendera() {
  return render(
    <MemoryRouter>
      <BordSpel kod="ABC234" minStol="S" tempo="normal" givar={4} />
    </MemoryRouter>,
  )
}

describe('BordSpel — röktest', () => {
  test('budfasen renderar: budlådan, min hand och namnraden', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
    ]
    rendera()
    expect(await screen.findByText('PASS')).toBeTruthy() // budlådan
    expect(screen.getByText(/Patrik \(du\)/)).toBeTruthy() // namnraden
    expect(screen.getByText(/Giv 1 av 4/)).toBeTruthy() // givbrickan
  })

  test('spelfasen renderar: stickräknaren och min klickbara hand', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
    ]
    rendera()
    expect(await screen.findByText(/Stick: Ni 0 – De 0/)).toBeTruthy()
    expect(screen.getByText(/Giv 1\/4/)).toBeTruthy()
  })

  test('giv-klar renderar reveal + nästa giv-knappen', async () => {
    seq = 0
    const hands = { N: MIN_HAND, E: MIN_HAND, S: MIN_HAND, W: MIN_HAND }
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('giv-klar', null, {
        hands,
        contract: { declarer: 'N', strain: 'spades', level: 1 },
        passadUt: false,
        declarerTricks: 8,
        nsScore: 110,
        stallning: { ns: 110, ew: 0 },
      }),
    ]
    rendera()
    expect(await screen.findByText('Nästa giv →')).toBeTruthy()
    expect(screen.getByText(/8 stick/)).toBeTruthy()
    expect(screen.getByText(/Ni \+110/)).toBeTruthy()
  })
})
