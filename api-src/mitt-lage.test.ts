// Facit för startsidans läge från servern (ägarbeslut 2026-11-22):
// /api/topplista?lage=1 svarar med HUR MÅNGA givar den inloggade har skickat in
// i de tre tävlingar som pågår (dagens MP%, dagens IMP, veckans stjärntävling).
// Bakgrund: startsidan räknade förr bara ur enhetens egen lagring, så datorn
// visade "Spela" på tävlingar som spelats klart på telefonen.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { stockholmDateISO, veckansMandag } from '../src/lib/engine/daily'
import handler from './topplista'

const BAS = 'https://exempel.supabase.co'

function fakeReq(token?: string): IncomingMessage {
  const req = Readable.from([]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = 'GET'
  req.url = '/api/topplista?lage=1'
  req.headers = token ? { authorization: `Bearer ${token}` } : {}
  return req as unknown as IncomingMessage
}

type Svar = { ok: boolean; lage?: Record<string, { nummer: number; antal: number }> }

function fakeRes() {
  let status = 0
  let data = ''
  const rubriker: Record<string, string> = {}
  const res = {
    set statusCode(s: number) {
      status = s
    },
    get statusCode() {
      return status
    },
    setHeader(namn: string, varde: string) {
      rubriker[namn.toLowerCase()] = varde
    },
    end(d: string) {
      data = d
    },
  } as unknown as ServerResponse
  return { res, svar: () => ({ status, body: JSON.parse(data) as Svar, rubriker }) }
}

const SETS = [
  { id: 's-mp', form: 'mp', daily_number: 104 },
  { id: 's-imp', form: 'imp', daily_number: 58 },
  { id: 's-guld', form: 'guld', daily_number: 2 },
]

function mockaFetch(rader: Array<{ set_id: string; board: number }>, sets = SETS) {
  const anrop: string[] = []
  const fn = vi.fn(async (url: string) => {
    anrop.push(url)
    const svar = (json: unknown) => ({ ok: true, status: 200, json: async () => json, text: async () => '' })
    if (url.includes('/auth/v1/user')) return svar({ id: 'jag' })
    if (url.includes('/rpc/kvot_okning')) return svar(true)
    if (url.includes('daily_sets?')) return svar(sets)
    if (url.includes('daily_results?')) return svar(rader)
    return svar([])
  })
  return { fn, anrop }
}

const brickor = (set_id: string, n: number) => Array.from({ length: n }, (_, i) => ({ set_id, board: i + 1 }))

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('topplista ?lage=1 — mitt läge i de pågående tävlingarna', () => {
  test('utan inloggning: 401, och inget läses ur databasen', async () => {
    const { fn, anrop } = mockaFetch([])
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq(), res)
    expect(svar().status).toBe(401)
    expect(anrop.some((u) => u.includes('daily_results'))).toBe(false)
  })

  test('inloggad: antal inskickade givar per tävling, med tävlingens nummer', async () => {
    const { fn } = mockaFetch([...brickor('s-mp', 3), ...brickor('s-guld', 12)])
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('min-token'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.lage).toEqual({
      mp: { nummer: 104, antal: 3 },
      imp: { nummer: 58, antal: 0 },
      guld: { nummer: 2, antal: 12 },
    })
  })

  test('frågar efter DAGENS dagliga set och VECKANS stjärnset', async () => {
    const { fn, anrop } = mockaFetch([])
    vi.stubGlobal('fetch', fn)
    await handler(fakeReq('min-token'), fakeRes().res)
    const setFraga = decodeURIComponent(anrop.find((u) => u.includes('daily_sets?')) ?? '')
    const idag = stockholmDateISO()
    expect(setFraga).toContain(`comp_date.eq.${idag}`)
    expect(setFraga).toContain(`comp_date.eq.${veckansMandag(idag)}`)
  })

  test('bara KALLARENS godkända rader läses — aldrig någon annans', async () => {
    const { fn, anrop } = mockaFetch(brickor('s-mp', 1))
    vi.stubGlobal('fetch', fn)
    await handler(fakeReq('min-token'), fakeRes().res)
    const radFraga = anrop.find((u) => u.includes('daily_results?')) ?? ''
    expect(radFraga).toContain('user_id=eq.jag')
    expect(radFraga).toContain('status=eq.godkand')
  })

  test('en tävling som inte finns än lämnas ute (startsidan faller tillbaka på det lokala)', async () => {
    const { fn } = mockaFetch(brickor('s-mp', 2), [SETS[0]])
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('min-token'), res)
    expect(svar().body.lage).toEqual({ mp: { nummer: 104, antal: 2 } })
  })

  test('svaret är personligt och får inte mellanlagras delat', async () => {
    const { fn } = mockaFetch([])
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('min-token'), res)
    expect(svar().rubriker['cache-control']).toContain('no-store')
  })
})
