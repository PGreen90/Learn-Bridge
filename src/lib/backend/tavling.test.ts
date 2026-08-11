// Facit för klientens tävlingshämtare (Beslut B etapp 2): den rena
// översättningen server-JSON → DagensTavling. Fetch-omslutningen testas inte
// här (nätverk) — översättningen är där felen kan gömma sig.

import { describe, test, expect } from 'vitest'
import type { Card, Suit, Rank } from '../../types/bridge'
import {
  slåIhopFramsteg,
  tavlingFromResponse,
  type DinInskick,
  type GivKontrakt,
  type GivResultat,
} from './tavling'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/** 52 kort i ordning, delade i fyra 13-kortshänder — bara för att fylla formen
 *  (giltigheten som bridge-giv spelar ingen roll för översättningstestet). */
function fyraHänder(): Record<'N' | 'E' | 'S' | 'W', Card[]> {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return {
    N: deck.slice(0, 13),
    E: deck.slice(13, 26),
    S: deck.slice(26, 39),
    W: deck.slice(39, 52),
  }
}

function svar(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    nummer: 9,
    'tävlingsdag': '2026-08-11',
    storlek: 2,
    givar: [
      { board: 1, dealer: 'N', vulnerability: 'none', hands: fyraHänder(), playSeed: 111 },
      { board: 2, dealer: 'E', vulnerability: 'ns', hands: fyraHänder(), playSeed: 222 },
    ],
    ...overrides,
  }
}

describe('tavlingFromResponse — översätter serversvaret', () => {
  test('mappar nummer/dag/storlek och varje giv', () => {
    const t = tavlingFromResponse(svar())
    expect(t.nummer).toBe(9)
    expect(t.dag).toBe('2026-08-11')
    expect(t.storlek).toBe(2)
    expect(t.givar).toHaveLength(2)
  })

  test('varje giv får ett stabilt, unikt id (tavling-<nr>-<bricka>)', () => {
    const t = tavlingFromResponse(svar())
    expect(t.givar[0].deal.id).toBe('tavling-9-1')
    expect(t.givar[1].deal.id).toBe('tavling-9-2')
  })

  test('behåller dealer, zon, bricka, händer och play-frö', () => {
    const t = tavlingFromResponse(svar())
    const g = t.givar[1]
    expect(g.deal.dealer).toBe('E')
    expect(g.deal.vulnerability).toBe('ns')
    expect(g.deal.board).toBe(2)
    expect(g.playSeed).toBe(222)
    for (const s of ['N', 'E', 'S', 'W'] as const) expect(g.deal.hands[s]).toHaveLength(13)
  })

  test('kastar när ok saknas', () => {
    expect(() => tavlingFromResponse(svar({ ok: false }))).toThrow()
  })

  test('kastar vid ogiltig dealer', () => {
    expect(() =>
      tavlingFromResponse(svar({ givar: [{ board: 1, dealer: 'X', vulnerability: 'none', hands: fyraHänder(), playSeed: 1 }] })),
    ).toThrow()
  })

  test('kastar när en hand inte har 13 kort', () => {
    const trasig = fyraHänder()
    trasig.N = trasig.N.slice(0, 12)
    expect(() =>
      tavlingFromResponse(svar({ givar: [{ board: 1, dealer: 'N', vulnerability: 'none', hands: trasig, playSeed: 1 }] })),
    ).toThrow()
  })

  test('kastar när play-frö saknas', () => {
    expect(() =>
      tavlingFromResponse(svar({ givar: [{ board: 1, dealer: 'N', vulnerability: 'none', hands: fyraHänder() }] })),
    ).toThrow()
  })
})

// --- Hopslagning: lokalt framsteg + serverns inskick (cross-device-fixen) -----

const KONTRAKT_4S: GivKontrakt = { level: 4, strain: 'spades', declarer: 'S', diff: 0 }
const KONTRAKT_3NT: GivKontrakt = { level: 3, strain: 'NT', declarer: 'N', diff: 1 }

/** En lokal, färdigspelad rad (som den sparas i framsteget). */
function lokalRad(board: number, kontrakt?: GivKontrakt | null): GivResultat {
  return {
    board,
    myTricks: 10,
    win: true,
    headline: `Giv ${board}`,
    scoreLabel: '+420',
    inskickStatus: 'godkand',
    kontrakt,
    history: [],
    plays: [],
  }
}

describe('slåIhopFramsteg — lokalt framsteg + serverns inskick', () => {
  test('en server-giv som saknas lokalt läggs till som godkänd stub', () => {
    const server: DinInskick[] = [{ board: 5, kontrakt: KONTRAKT_4S }]
    const ut = slåIhopFramsteg([], server)
    expect(ut).toHaveLength(1)
    expect(ut[0].board).toBe(5)
    expect(ut[0].inskickStatus).toBe('godkand')
    expect(ut[0].kontrakt).toEqual(KONTRAKT_4S)
    // Ingen rondgenomgång för en giv spelad på en annan enhet.
    expect(ut[0].history).toBeUndefined()
    expect(ut[0].plays).toBeUndefined()
  })

  test('backfillar kontrakt på en lokal rad som saknar det (äldre "—"-giv)', () => {
    const lokala = [lokalRad(3, undefined)]
    const server: DinInskick[] = [{ board: 3, kontrakt: KONTRAKT_3NT }]
    const ut = slåIhopFramsteg(lokala, server)
    expect(ut).toHaveLength(1)
    expect(ut[0].kontrakt).toEqual(KONTRAKT_3NT)
    // Lokala fält (auktion/kort) bevaras — bara kontraktet fylldes på.
    expect(ut[0].history).toEqual([])
    expect(ut[0].plays).toEqual([])
  })

  test('skriver ALDRIG över ett kontrakt som redan finns lokalt', () => {
    const lokala = [lokalRad(3, KONTRAKT_4S)]
    const server: DinInskick[] = [{ board: 3, kontrakt: KONTRAKT_3NT }]
    const ut = slåIhopFramsteg(lokala, server)
    expect(ut[0].kontrakt).toEqual(KONTRAKT_4S)
  })

  test('utpassad server-giv (kontrakt null) backfillas inte över befintligt, men sätts på stub', () => {
    const ut = slåIhopFramsteg([], [{ board: 7, kontrakt: null }])
    expect(ut[0].kontrakt).toBeNull()
  })

  test('server utan kontrakt-fält ger en stub utan kontrakt (visas "—")', () => {
    const ut = slåIhopFramsteg([], [{ board: 8 }])
    expect(ut[0].board).toBe(8)
    expect('kontrakt' in ut[0]).toBe(false)
  })

  test('behåller lokal null (utpassad) och backfillar inte över den', () => {
    const lokala = [lokalRad(2, null)]
    const ut = slåIhopFramsteg(lokala, [{ board: 2, kontrakt: KONTRAKT_4S }])
    expect(ut[0].kontrakt).toBeNull()
  })

  test('tomt serversvar → lokala rader oförändrade (bakåtkompatibelt)', () => {
    const lokala = [lokalRad(1, KONTRAKT_4S), lokalRad(2, KONTRAKT_3NT)]
    const ut = slåIhopFramsteg(lokala, [])
    expect(ut.map((r) => r.board)).toEqual([1, 2])
    expect(ut[0].kontrakt).toEqual(KONTRAKT_4S)
  })

  test('en giv i både lokalt och server dubbelräknas inte, och sorteras på bricka', () => {
    const lokala = [lokalRad(4, KONTRAKT_4S), lokalRad(2, KONTRAKT_3NT)]
    const server: DinInskick[] = [
      { board: 4, kontrakt: KONTRAKT_4S }, // finns lokalt
      { board: 1, kontrakt: KONTRAKT_3NT }, // ny från annan enhet
    ]
    const ut = slåIhopFramsteg(lokala, server)
    expect(ut.map((r) => r.board)).toEqual([1, 2, 4])
  })
})
