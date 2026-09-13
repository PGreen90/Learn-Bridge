// Facit för topplistans endpoint-skal (Påbyggnad 3, 2026-09-13): tillsvidare-
// snittet (40 % per ospelad giv), `spelade` per rad, kallarens egna fält bara
// med token, och — viktigast — att bot-flaggan ALDRIG lämnar servern.
// Databasen är hånad per URL; matematiken facittestas i matchpoints.test.ts.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import handler from './topplista'

const BAS = 'https://exempel.supabase.co'

function fakeReq(token?: string): IncomingMessage {
  const req = Readable.from([]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = 'GET'
  req.url = '/api/topplista'
  req.headers = token ? { authorization: `Bearer ${token}` } : {}
  return req as unknown as IncomingMessage
}

type Rad = { namn: string; snitt: number; antalGivar: number; spelade: number; jag: boolean }
type Svar = {
  ok: boolean
  storlek: number
  provisoriskProcent: number
  topplista: Rad[]
  du: { placering: number; snitt: number; antalGivar: number; spelade: number } | null
}

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

// Dagens tävling: 12 givar. Spelare a (kallaren) har spelat giv 1–7 och vunnit
// alla mot b; b (en bot i databasen) har spelat alla 12 — giv 8–12 ensam.
function resultatRader() {
  const rader: Array<{ board: number; user_id: string; ns_score: number }> = []
  for (let board = 1; board <= 12; board++) {
    if (board <= 7) rader.push({ board, user_id: 'user-a', ns_score: 620 })
    rader.push({ board, user_id: 'user-b', ns_score: 170 })
  }
  return rader
}

function mockaFetch() {
  const kvotAnrop: string[] = []
  const fn = vi.fn(async (url: string) => {
    const svar = (json: unknown) => ({ ok: true, status: 200, json: async () => json, text: async () => '' })
    if (url.includes('/auth/v1/user')) return svar({ id: 'user-a' })
    if (url.includes('/rpc/kvot_okning')) {
      kvotAnrop.push(url)
      return svar(true)
    }
    if (url.includes('daily_sets?')) return svar([{ id: 'set-1', daily_number: 42, size: 12 }])
    if (url.includes('daily_results?') && url.includes('user_id=eq.')) {
      return svar(resultatRader().filter((r) => r.user_id === 'user-a').map((r) => ({
        board: r.board, declarer_tricks: 10, passed_out: false, payload: null,
      })))
    }
    if (url.includes('daily_results?')) return svar(resultatRader())
    if (url.includes('profiles?')) {
      // Databasen HAR bot-flaggan — den får aldrig nå svaret.
      return svar([
        { id: 'user-a', display_name: 'Green', is_bot: false },
        { id: 'user-b', display_name: 'Gunnar52', is_bot: true },
      ])
    }
    return svar([])
  })
  return { fn, kvotAnrop }
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('topplista — tillsvidare-snittet och spelade givar', () => {
  test('inloggad: 7 av 12 spelade → snitt (700 + 40 × 5) / 12 = 75, spelade 7/12, egen rad markerad', async () => {
    const { fn } = mockaFetch()
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('token-1'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.storlek).toBe(12)
    expect(body.provisoriskProcent).toBe(40)
    expect(body.topplista[0]).toEqual({ namn: 'Green', snitt: 75, antalGivar: 7, spelade: 7, jag: true })
    // b vann inget av de sju poängsatta men har spelat alla tolv: (0 + 200) / 12.
    const b = body.topplista[1]
    expect(b.namn).toBe('Gunnar52')
    expect(b.spelade).toBe(12)
    expect(b.antalGivar).toBe(7)
    expect(b.snitt).toBeCloseTo(200 / 12, 6)
    expect(body.du).toEqual({ placering: 1, snitt: 75, antalGivar: 7, spelade: 7 })
  })

  test('bot-flaggan lämnar aldrig servern (ägarbeslut 2026-09-01)', async () => {
    const { fn } = mockaFetch()
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('token-2'), res)
    expect(svar().text).not.toContain('is_bot')
  })

  test('anonym: listan kommer ändå, men utan egna fält och utan kvotanrop', async () => {
    const { fn, kvotAnrop } = mockaFetch()
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq(), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.du).toBeNull()
    expect(body.topplista.every((r) => r.jag === false)).toBe(true)
    expect(kvotAnrop).toHaveLength(0)
  })
})
