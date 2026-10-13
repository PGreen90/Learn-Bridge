// FACIT FÖRE FIX — cron-handlern `generera-dagens-givar` (nattkedjans härdning,
// 2026-10-13). Grinden (401 utan bevis) står som förr; det nya är att EN
// transient 5xx från databasen inte längre blankar dagen: handlern går genom
// den delade `sakerstallTavling` (omförsök) och svarar 200 med båda seten,
// och svaret berättar om seten skapades nu eller redan fanns.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import handler from './generera-dagens-givar'

const BAS = 'https://exempel.supabase.co'

function fakeReq(authorization?: string): IncomingMessage {
  const req = Readable.from([]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = 'GET'
  req.url = '/api/generera-dagens-givar'
  req.headers = authorization ? { authorization } : {}
  return req as unknown as IncomingMessage
}

type Svar = {
  ok: boolean
  fel?: string
  tävlingsdag?: string
  antalGivar?: number
  brickor?: number[]
  former?: Record<string, { antalGivar?: number; skapad?: boolean; fel?: string }>
  stadadeBord?: number
}

function fakeRes(): { res: ServerResponse; svar: () => { status: number; body: Svar } } {
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

/** Databas-attrapp: första set-upserten svarar 503, resten går; städningen svarar med räkning. */
function mockaFetch() {
  let setPostNr = 0
  const anrop: Array<{ method: string; url: string }> = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    anrop.push({ method, url })
    if (method === 'GET' && url.includes('/daily_sets?')) return new Response('[]', { status: 200 })
    if (method === 'POST' && url.includes('/daily_sets')) {
      const status = setPostNr++ === 0 ? 503 : 201
      return new Response(status === 201 ? JSON.stringify([{ id: `set-${setPostNr}` }]) : 'gateway timeout', { status })
    }
    if (method === 'POST' && url.includes('/daily_deals')) return new Response('', { status: 201 })
    if (method === 'DELETE') return new Response('', { status: 200, headers: { 'content-range': '0-1/2' } })
    throw new Error(`oväntat anrop: ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fn)
  return { anrop }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'bevis')
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
  vi.stubEnv('DAILY_SEED_SECRET', 'test-hemlighet')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('generera-dagens-givar (cronen)', () => {
  test('utan rätt bevis → 401, och databasen rörs inte', async () => {
    const { anrop } = mockaFetch()
    const { res, svar } = fakeRes()
    await handler(fakeReq('Bearer fel'), res)
    expect(svar().status).toBe(401)
    expect(anrop).toEqual([])
  })

  test('en 503 på set-upserten → omförsök, 200 med båda seten skapade', async () => {
    const { anrop } = mockaFetch()
    const { res, svar } = fakeRes()
    await handler(fakeReq('Bearer bevis'), res)
    const { status, body } = svar()
    expect(status, JSON.stringify(body)).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.tävlingsdag).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Bakåtkompatibla fält = MP-setet.
    expect(body.antalGivar).toBe(12)
    expect(body.brickor).toHaveLength(12)
    expect(body.former?.mp).toMatchObject({ antalGivar: 12, skapad: true })
    expect(body.former?.imp).toMatchObject({ antalGivar: 12, skapad: true })
    expect(body.stadadeBord).toBeGreaterThanOrEqual(0)
    // Omförsöket syns: tre set-upserter (503 + MP + IMP), två givinsättningar.
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_sets'))).toHaveLength(3)
    expect(anrop.filter((a) => a.method === 'POST' && a.url.includes('/daily_deals'))).toHaveLength(2)
  })
})
