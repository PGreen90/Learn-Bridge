// Facit för inskicket till Veckans guld-tävling (2026-11-11): servern hittar
// VECKANS set (måndagen), läser SIN EGEN lagrade giv och validerar mot den —
// klienten kan varken byta giv eller hitta på ett resultat. Och de dagliga
// tävlingarna rör aldrig den vägen.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO, veckansMandag } from '../src/lib/engine/daily'
import { dealFromSeed } from '../src/lib/engine/deal'
import { spelaBotGivMedGiv } from '../src/lib/engine/botspelare'
import handler from './skicka-in'

const BAS = 'https://exempel.supabase.co'
const BRICKA = 3
const LAGRAD = { ...dealFromSeed(987654321, BRICKA), id: 'guld-3' }
const ARLIGT = spelaBotGivMedGiv(LAGRAD, 4242)!

function fakeReq(body: unknown): IncomingMessage {
  const req = Readable.from([JSON.stringify(body)]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = 'POST'
  req.url = '/api/skicka-in'
  req.headers = { authorization: 'Bearer token-a' }
  return req as unknown as IncomingMessage
}

function fakeRes() {
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
  return { res, svar: () => ({ status, body: JSON.parse(data) as { ok: boolean; form?: string; status?: string; fel?: string; skäl?: string } }) }
}

/** Fejkad Supabase. `givRad` = raden daily_deals lämnar ut för brickan. */
function mockaFetch(givRad: unknown[] = [{ board: LAGRAD.board, dealer: LAGRAD.dealer, vulnerability: LAGRAD.vulnerability, hands: LAGRAD.hands }]) {
  const anrop: string[] = []
  const skrivet: unknown[] = []
  const fn = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    anrop.push(url)
    const svar = (json: unknown, ok = true, status = 200) => ({ ok, status, json: async () => json, text: async () => '' })
    if (url.includes('/auth/v1/user')) return svar({ id: 'user-a' })
    if (url.includes('/rpc/kvot_okning')) return svar(true)
    if (url.includes('daily_sets?')) return svar([{ id: 'set-guld' }])
    if (url.includes('daily_deals?')) return svar(givRad)
    if (url.includes('daily_results') && init?.method === 'POST') {
      skrivet.push(...(JSON.parse(init.body ?? '[]') as unknown[]))
      return svar(null, true, 201)
    }
    if (url.includes('daily_results?')) return svar([]) // ingen tidigare rad
    return svar([])
  })
  return { fn, anrop, skrivet }
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
  vi.stubEnv('DAILY_SEED_SECRET', 'test-hemlighet')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('skicka-in — guld-tävlingen', () => {
  test('hittar veckans set (måndagen) och validerar mot den LAGRADE given', async () => {
    const m = mockaFetch()
    vi.stubGlobal('fetch', m.fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq({ ...ARLIGT, form: 'guld' }), res)

    expect(svar().status).toBe(200)
    expect(svar().body).toMatchObject({ ok: true, form: 'guld', status: 'godkand' })
    const mandag = veckansMandag(stockholmDateISO())
    expect(m.anrop.some((u) => u.includes(`daily_sets?comp_date=eq.${mandag}&form=eq.guld`))).toBe(true)
    expect(m.anrop.some((u) => u.includes(`daily_deals?set_id=eq.set-guld&board=eq.${BRICKA}`))).toBe(true)
    expect(m.skrivet).toHaveLength(1)
    expect(m.skrivet[0]).toMatchObject({ set_id: 'set-guld', board: BRICKA, user_id: 'user-a', status: 'godkand' })
  })

  test('ett inskick som inte stämmer med serverns giv sparas som AVVISAT', async () => {
    // Servern har en annan giv lagrad på brickan än den inskicket spelades på.
    const annan = dealFromSeed(123456789, BRICKA)
    const m = mockaFetch([{ board: annan.board, dealer: annan.dealer, vulnerability: annan.vulnerability, hands: annan.hands }])
    vi.stubGlobal('fetch', m.fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq({ ...ARLIGT, form: 'guld' }), res)

    expect(svar().body).toMatchObject({ ok: true, status: 'avvisad' })
    expect(m.skrivet[0]).toMatchObject({ status: 'avvisad', ns_score: null })
  })

  test('en bricka som inte finns i veckans tävling ger 400 och inget skrivs', async () => {
    const m = mockaFetch([])
    vi.stubGlobal('fetch', m.fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq({ ...ARLIGT, form: 'guld' }), res)

    expect(svar().status).toBe(400)
    expect(m.skrivet).toHaveLength(0)
  })

  test('de dagliga tävlingarna läser ALDRIG daily_deals vid inskick (frövägen som förr)', async () => {
    const m = mockaFetch()
    vi.stubGlobal('fetch', m.fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq({ ...ARLIGT, form: 'mp' }), res)

    expect(svar().status).toBe(200)
    expect(m.anrop.some((u) => u.includes('daily_deals?'))).toBe(false)
    expect(m.anrop.some((u) => u.includes(`daily_sets?comp_date=eq.${stockholmDateISO()}&form=eq.mp`))).toBe(true)
    // Inskicket spelades på en annan giv än dagens frögiv → avvisas, som förr.
    expect(m.skrivet[0]).toMatchObject({ status: 'avvisad' })
  })

  test('okänd form avvisas', async () => {
    const m = mockaFetch()
    vi.stubGlobal('fetch', m.fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq({ ...ARLIGT, form: 'silver' }), res)
    expect(svar().status).toBe(400)
  })
})
