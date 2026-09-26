// Facit för travellerns endpoint-skal (Påbyggnad 3, 2026-09-13): grindarna
// (401 utan token, 403 utan eget resultat på brickan, 429 vid kvot), att varje
// spelares auktion + spelade kort + spelförarstick följer med (för genomgången),
// att förklaringstexten strippas, och att bot-flaggan aldrig lämnar servern.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import handler from './giv-resultat'

const BAS = 'https://exempel.supabase.co'

function fakeReq(url: string, token?: string): IncomingMessage {
  const req = Readable.from([]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = 'GET'
  req.url = url
  req.headers = token ? { authorization: `Bearer ${token}` } : {}
  return req as unknown as IncomingMessage
}

type Rad = {
  namn: string
  jag: boolean
  kontrakt: { level: number; strain: string; declarer: string; diff: number } | null
  form?: string
  tal?: number
  procent?: number
  imp?: number
  history: Array<{ seat: string; bid: string; rule?: string; explanation?: string }>
  plays: Array<{ suit: string; rank: string }>
  declarerTricks: number | null
}
type Svar = { ok: boolean; fel?: string; form?: string; board?: number; resultat?: Rad[] }

function fakeRes(): { res: ServerResponse; svar: () => { status: number; body: Svar; text: string } } {
  let status = 0
  let data = ''
  const res = {
    set statusCode(s: number) {
      status = s
    },
    get statusCode() {
      return status
    },
    setHeader() {},
    end(d: string) {
      data = d
    },
  } as unknown as ServerResponse
  return { res, svar: () => ({ status, body: JSON.parse(data), text: data }) }
}

const AUKTION = [
  { seat: 'S', bid: '4S', rule: 'game-raise', explanation: 'Byggd av handen — får inte läcka' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: 'P' },
]
const KORT = [{ suit: 'hearts', rank: 'A' }, { suit: 'hearts', rank: '2' }]

function rader(medMig: boolean) {
  const alla = [
    { user_id: 'user-b', ns_score: 450, declarer_tricks: 11, passed_out: false, payload: { history: AUKTION, plays: KORT } },
  ]
  if (medMig) alla.push({ user_id: 'user-a', ns_score: 420, declarer_tricks: 10, passed_out: false, payload: { history: AUKTION, plays: KORT } })
  return alla
}

function mockaFetch({ authOk = true, kvotOk = true, medMig = true } = {}) {
  return vi.fn(async (url: string) => {
    const svar = (json: unknown, ok = true, status = 200) => ({ ok, status, json: async () => json, text: async () => '' })
    if (url.includes('/auth/v1/user')) return authOk ? svar({ id: 'user-a' }) : svar({}, false, 401)
    if (url.includes('/rpc/kvot_okning')) return svar(kvotOk)
    if (url.includes('daily_sets?')) return svar([{ id: 'set-1' }])
    if (url.includes('daily_results?')) return svar(rader(medMig))
    if (url.includes('profiles?')) {
      return svar([
        { id: 'user-a', display_name: 'Green', is_bot: false },
        { id: 'user-b', display_name: 'Gunnar52', is_bot: true },
      ])
    }
    return svar([])
  })
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('giv-resultat — grindarna', () => {
  test('utan token → 401', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3'), res)
    expect(svar().status).toBe(401)
  })

  test('ogiltig bricka → 400', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=0', 't'), res)
    expect(svar().status).toBe(400)
  })

  test('kvoten full → 429', async () => {
    vi.stubGlobal('fetch', mockaFetch({ kvotOk: false }))
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3', 't'), res)
    expect(svar().status).toBe(429)
  })

  test('ingen tjuvkik: har du inte spelat brickan → 403', async () => {
    vi.stubGlobal('fetch', mockaFetch({ medMig: false }))
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3', 't'), res)
    expect(svar().status).toBe(403)
  })
})

describe('giv-resultat — genomgångsdata per spelare (Påbyggnad 3)', () => {
  test('varje rad bär auktion (kompakt) + spelade kort + spelförarstick; din rad markerad', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3', 't'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.board).toBe(3)
    const b = body.resultat!.find((r) => r.namn === 'Gunnar52')!
    expect(b.jag).toBe(false)
    expect(b.plays).toEqual(KORT)
    expect(b.declarerTricks).toBe(11)
    expect(b.kontrakt).toEqual({ level: 4, strain: 'spades', declarer: 'S', diff: 1 })
    // Kompakt auktion: säte + bud + regelnamn, ingen förklaringstext.
    expect(b.history).toEqual([
      { seat: 'S', bid: '4S', rule: 'game-raise' },
      { seat: 'W', bid: 'P' },
      { seat: 'N', bid: 'P' },
      { seat: 'E', bid: 'P' },
    ])
    expect(body.resultat!.find((r) => r.namn === 'Green')!.jag).toBe(true)
  })

  test('varken förklaringstexten eller bot-flaggan lämnar servern', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3', 't'), res)
    const { text } = svar()
    expect(text).not.toContain('explanation')
    expect(text).not.toContain('får inte läcka')
    expect(text).not.toContain('is_bot')
  })
})

describe('giv-resultat — tidigare dagar (?dag=, Påbyggnad 3)', () => {
  test('avslutad dag: inloggning räcker — tjuvkiks-grinden gäller bara idag', async () => {
    vi.stubGlobal('fetch', mockaFetch({ medMig: false }))
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3&dag=2026-08-11', 't'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.resultat!.map((r) => r.namn)).toEqual(['Gunnar52'])
  })

  test('framtida dag → 400', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3&dag=2099-01-01', 't'), res)
    expect(svar().status).toBe(400)
  })
})

describe('giv-resultat — Dagens IMP (?form=imp, 2026-09-26)', () => {
  test('MP som förr utan ?form=: procent per rad, form mp', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3', 't'), res)
    const { body } = svar()
    expect(body.form).toBe('mp')
    const b = body.resultat!.find((r) => r.namn === 'Gunnar52')!
    expect(b).toMatchObject({ form: 'mp', tal: 100, procent: 100 })
    expect(b.imp).toBeUndefined()
  })

  test('?form=imp: cross-IMP per rad (450 mot 420 = 30 → ±1 IMP), IMP-setet slås upp', async () => {
    const fn = mockaFetch()
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('/api/giv-resultat?board=3&form=imp', 't'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.form).toBe('imp')
    const setUrl = fn.mock.calls.map((c) => String(c[0])).find((u) => u.includes('daily_sets?'))!
    expect(setUrl).toContain('form=eq.imp')
    const b = body.resultat!.find((r) => r.namn === 'Gunnar52')!
    expect(b).toMatchObject({ form: 'imp', tal: 1, imp: 1 })
    expect(b.procent).toBeUndefined()
    expect(body.resultat!.find((r) => r.namn === 'Green')!.imp).toBe(-1)
    // Sorterad bäst först.
    expect(body.resultat!.map((r) => r.namn)).toEqual(['Gunnar52', 'Green'])
  })
})
