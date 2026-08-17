// Facit för bordroutern (etapp 4A): metod-/handlings-/auth-/kvotgrindarna och
// indatavakterna — grenarna som skyddar databasen INNAN någon handling rör den.
// (Själva bordslogiken mot databasen facittestas i 4B via bord-motor med
// fejkad händelselista; här testas routerns skal med mockad fetch.)

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import handler from './bord'

const BAS = 'https://exempel.supabase.co'

// Unik token per test — routerns auth-cache lever på modulnivå (60 s TTL),
// så återanvända tokens skulle smitta mellan tester.
let tokenNr = 0
function nyToken(): string {
  return `token-${++tokenNr}`
}

function fakeReq(
  metod: string,
  url: string,
  { body, token }: { body?: unknown; token?: string } = {},
): IncomingMessage {
  // Readable buffrar tills en lyssnare kopplas — data/end kommer fram även om
  // handlern läser kroppen först efter sina await:ar.
  const req = Readable.from(body !== undefined ? [JSON.stringify(body)] : []) as unknown as {
    method: string
    url: string
    headers: Record<string, string>
  }
  req.method = metod
  req.url = url
  req.headers = token ? { authorization: `Bearer ${token}` } : {}
  return req as unknown as IncomingMessage
}

function fakeRes(): { res: ServerResponse; svar: () => { status: number; body: { ok: boolean; fel?: string } } } {
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
  return { res, svar: () => ({ status, body: JSON.parse(data) }) }
}

/** Fetch-mock: auth svarar ok/nej, kvoten svarar ja/nej, allt annat tomt. */
function mockaFetch({ authOk = true, kvotOk = true } = {}) {
  return vi.fn(async (url: string) => {
    if (url.includes('/auth/v1/user')) {
      return authOk
        ? { ok: true, status: 200, json: async () => ({ id: 'user-abc' }), text: async () => '' }
        : { ok: false, status: 401, json: async () => ({}), text: async () => '' }
    }
    if (url.includes('/rpc/kvot_okning')) {
      return { ok: true, status: 200, json: async () => kvotOk, text: async () => '' }
    }
    return { ok: true, status: 200, json: async () => [], text: async () => '' }
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

describe('bordroutern — grindarna', () => {
  test('okänd handling → 400', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(fakeReq('POST', '/api/bord?h=pastej', { token: nyToken() }), res)
    expect(svar().status).toBe(400)
    expect(svar().body.fel).toMatch(/okänd handling/i)
  })

  test('fel metod → 405 (lista är GET, skapa är POST)', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const a = fakeRes()
    await handler(fakeReq('POST', '/api/bord?h=lista', { token: nyToken() }), a.res)
    expect(a.svar().status).toBe(405)
    const b = fakeRes()
    await handler(fakeReq('GET', '/api/bord?h=skapa', { token: nyToken() }), b.res)
    expect(b.svar().status).toBe(405)
  })

  test('utan token → 401 utan att databasen rörs', async () => {
    const fetchMock = mockaFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', '/api/bord?h=lista'), res)
    expect(svar().status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('ogiltig session → 401', async () => {
    vi.stubGlobal('fetch', mockaFetch({ authOk: false }))
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', '/api/bord?h=lista', { token: nyToken() }), res)
    expect(svar().status).toBe(401)
  })

  test('kvoten nekar → 429', async () => {
    vi.stubGlobal('fetch', mockaFetch({ kvotOk: false }))
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', '/api/bord?h=lista', { token: nyToken() }), res)
    expect(svar().status).toBe(429)
  })

  test('saknade miljövariabler → 500 direkt', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    const fetchMock = mockaFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', '/api/bord?h=lista', { token: nyToken() }), res)
    expect(svar().status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('bordroutern — indatavakterna (skapa)', () => {
  test('ogiltig spelform → 400', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(
      fakeReq('POST', '/api/bord?h=skapa', {
        token: nyToken(),
        body: { spelform: 'poker', givar: 8 },
      }),
      res,
    )
    expect(svar().status).toBe(400)
    expect(svar().body.fel).toMatch(/spelform/i)
  })

  test('givar utanför 1–24 → 400', async () => {
    vi.stubGlobal('fetch', mockaFetch())
    const { res, svar } = fakeRes()
    await handler(
      fakeReq('POST', '/api/bord?h=skapa', {
        token: nyToken(),
        body: { spelform: 'full', givar: 25 },
      }),
      res,
    )
    expect(svar().status).toBe(400)
    expect(svar().body.fel).toMatch(/1–24/)
  })

  test('ogiltig bordskod till ga-med → 400 utan databasuppslag', async () => {
    const fetchMock = mockaFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { res, svar } = fakeRes()
    await handler(
      fakeReq('POST', '/api/bord?h=ga-med', { token: nyToken(), body: { kod: 'hejhej!' } }),
      res,
    )
    expect(svar().status).toBe(400)
    // Bara auth + kvot får ha gått ut på nätet — inget tables-uppslag.
    const vagar = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(vagar.some((v) => v.includes('rest/v1/tables'))).toBe(false)
  })

  test('gemener i koden normaliseras före vakten (ga-med hittar bordet)', async () => {
    // Koden "abc234" ska bli "ABC234" och slås upp — mocken svarar "inget bord".
    const fetchMock = mockaFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { res, svar } = fakeRes()
    await handler(
      fakeReq('POST', '/api/bord?h=ga-med', { token: nyToken(), body: { kod: 'abc234' } }),
      res,
    )
    expect(svar().status).toBe(404)
    const vagar = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(vagar.some((v) => v.includes('kod=eq.ABC234'))).toBe(true)
  })
})
