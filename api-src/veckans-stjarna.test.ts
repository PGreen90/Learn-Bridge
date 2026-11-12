// Facit för "Veckans stjärna" på servern (ägarbeslut 2026-11-12):
// /api/topplista?form=guld&stjarna=1 svarar med vinnaren av den senast
// avslutade stjärntävlingen — utan inloggning, och utan att en datorspelare
// någonsin koras eller pekas ut.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO } from '../src/lib/engine/daily'
import { forraStjarnveckan } from '../src/lib/engine/tavlingsavslut'
import handler from './topplista'

const BAS = 'https://exempel.supabase.co'
const URLEN = '/api/topplista?form=guld&stjarna=1'

function fakeReq(url = URLEN): IncomingMessage {
  const req = Readable.from([]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = 'GET'
  req.url = url
  req.headers = {}
  return req as unknown as IncomingMessage
}

type Svar = { ok: boolean; vecka?: string; stjarna?: { namn: string; snitt: number; nummer: number } | null }

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
  return { res, svar: () => ({ status, body: JSON.parse(data) as Svar, text: data }) }
}

const PROFILER = [
  { id: 'anna', display_name: 'Anna', is_bot: false },
  { id: 'bo', display_name: 'Bo', is_bot: false },
  { id: 'bot', display_name: 'Gunnar52', is_bot: true },
]

function mockaFetch({
  setFinns = true,
  standings = [] as Array<{ user_id: string; placering: number; snitt: number }>,
  results = [] as Array<{ board: number; user_id: string; ns_score: number }>,
} = {}) {
  const anrop: string[] = []
  const fn = vi.fn(async (url: string) => {
    anrop.push(url)
    const svar = (json: unknown) => ({ ok: true, status: 200, json: async () => json, text: async () => '' })
    if (url.includes('daily_sets?')) return svar(setFinns ? [{ id: 'set-g1', daily_number: 1, size: 12 }] : [])
    if (url.includes('daily_standings?')) return svar(standings)
    if (url.includes('daily_results?')) return svar(results)
    if (url.includes('profiles?')) return svar(PROFILER)
    return svar([])
  })
  return { fn, anrop }
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('topplista ?stjarna=1 — veckans stjärna', () => {
  test('frusen ställning: bästa MÄNNISKAN koras, även när en datorspelare vann', async () => {
    const { fn, anrop } = mockaFetch({
      standings: [
        { user_id: 'bot', placering: 1, snitt: 64.6 },
        { user_id: 'anna', placering: 2, snitt: 58.3 },
        { user_id: 'bo', placering: 3, snitt: 41 },
      ],
    })
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq(), res)
    const { status, body, text } = svar()
    expect(status).toBe(200)
    expect(body.stjarna).toEqual({ namn: 'Anna', snitt: 58.3, nummer: 1 })
    // Förra veckans måndag, guld-formen — aldrig veckan som pågår.
    const vecka = forraStjarnveckan(stockholmDateISO())
    expect(body.vecka).toBe(vecka)
    expect(anrop.find((u) => u.includes('daily_sets?'))).toContain(`comp_date=eq.${vecka}&form=eq.guld`)
    // Ingen inloggning, ingen bot-flagga, inga id:n i svaret.
    expect(anrop.some((u) => u.includes('/auth/v1/user'))).toBe(false)
    expect(text).not.toContain('is_bot')
    expect(text).not.toContain('Gunnar52')
  })

  test('ofrusen vecka (natten mot tisdag): räknas i farten ur inskicken', async () => {
    const { fn } = mockaFetch({
      results: [
        { board: 1, user_id: 'bo', ns_score: 620 },
        { board: 1, user_id: 'anna', ns_score: 170 },
        { board: 2, user_id: 'bo', ns_score: 620 },
        { board: 2, user_id: 'anna', ns_score: 170 },
      ],
    })
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq(), res)
    expect(svar().body.stjarna?.namn).toBe('Bo')
  })

  test('ingen avslutad vecka än → stjarna: null (bubblan visar sin väntetext)', async () => {
    const { fn } = mockaFetch({ setFinns: false })
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq(), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.stjarna).toBeNull()
  })

  test('bara datorspelare spelade → ingen stjärna', async () => {
    const { fn } = mockaFetch({ standings: [{ user_id: 'bot', placering: 1, snitt: 60 }] })
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq(), res)
    expect(svar().body.stjarna).toBeNull()
  })
})
