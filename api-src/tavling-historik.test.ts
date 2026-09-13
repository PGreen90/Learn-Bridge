// Facit för tävlingshistorikens endpoint-skal (Påbyggnad 3, 2026-09-13):
// grindarna (401/405/429), dagslistan ur frusna ställningar + räknad i farten
// för ofrusna dagar (max tre), din placering, och medaljtabellen med bottarna
// UTESLUTNA — utan att bot-flaggan någonsin lämnar servern.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import handler from './tavling-historik'

const BAS = 'https://exempel.supabase.co'

function fakeReq(metod = 'GET', token?: string): IncomingMessage {
  const req = Readable.from([]) as unknown as { method: string; url: string; headers: Record<string, string> }
  req.method = metod
  req.url = '/api/tavling-historik'
  req.headers = token ? { authorization: `Bearer ${token}` } : {}
  return req as unknown as IncomingMessage
}

type Dag = {
  dag: string
  nummer: number
  storlek: number
  antalSpelare: number | null
  slutlig: boolean
  du: { placering: number; snitt: number; spelade: number } | null
}
type Svar = {
  ok: boolean
  fel?: string
  dagar?: Dag[]
  medaljer?: Array<{ namn: string; guld: number; silver: number; brons: number; jag: boolean }>
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

// Fem avslutade dagar (nyast först som servern beställer dem). set-1..set-3 är
// frusna i daily_standings; set-4 och set-5 saknar ställning.
const SETS = [
  { id: 'set-5', comp_date: '2026-09-12', daily_number: 5, size: 12 },
  { id: 'set-4', comp_date: '2026-09-11', daily_number: 4, size: 12 },
  { id: 'set-3', comp_date: '2026-09-10', daily_number: 3, size: 12 },
  { id: 'set-2', comp_date: '2026-09-09', daily_number: 2, size: 12 },
  { id: 'set-1', comp_date: '2026-09-08', daily_number: 1, size: 12 },
]
const STANDINGS = [
  // dag 1: bot 1:a, a 2:a, b 3:a
  { set_id: 'set-1', user_id: 'bot', placering: 1, snitt: 66.5, spelade: 12 },
  { set_id: 'set-1', user_id: 'user-a', placering: 2, snitt: 55.25, spelade: 12 },
  { set_id: 'set-1', user_id: 'user-b', placering: 3, snitt: 50, spelade: 7 },
  // dag 2: a 1:a, bot 2:a
  { set_id: 'set-2', user_id: 'user-a', placering: 1, snitt: 70, spelade: 12 },
  { set_id: 'set-2', user_id: 'bot', placering: 2, snitt: 60, spelade: 12 },
  // dag 3: b 1:a, a 1:a (delad), bot 3:a
  { set_id: 'set-3', user_id: 'user-b', placering: 1, snitt: 58, spelade: 12 },
  { set_id: 'set-3', user_id: 'user-a', placering: 1, snitt: 58, spelade: 12 },
  { set_id: 'set-3', user_id: 'bot', placering: 3, snitt: 40, spelade: 12 },
  // dag 0 (gammal): b ENSAM i ställningen → ingen medalj (ägarbeslut 2026-09-13)
  { set_id: 'set-0', user_id: 'user-b', placering: 1, snitt: 40, spelade: 3 },
]

function mockaFetch({ authOk = true, kvotOk = true, standingsFinns = true } = {}) {
  const resultatAnrop: string[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const svar = (json: unknown, ok = true, status = 200) => ({ ok, status, json: async () => json, text: async () => '' })
    if (url.includes('/auth/v1/user')) return authOk ? svar({ id: 'user-a' }) : svar({}, false, 401)
    if (url.includes('/rpc/kvot_okning')) return svar(kvotOk)
    // Range-sidor: allt ryms på första sidan (testet är litet).
    const range = (init?.headers as Record<string, string> | undefined)?.Range ?? '0-999'
    if (!range.startsWith('0-')) return svar([])
    if (url.includes('daily_sets?')) return svar(SETS)
    if (url.includes('daily_standings?')) return standingsFinns ? svar(STANDINGS) : svar('relation saknas', false, 404)
    if (url.includes('daily_results?')) {
      resultatAnrop.push(url)
      // set-5 (ofrusen): a vinner två givar mot bot; set-4: ingen spelade.
      if (url.includes('set-5')) {
        return svar([
          { board: 1, user_id: 'user-a', ns_score: 620 },
          { board: 1, user_id: 'bot', ns_score: 170 },
          { board: 2, user_id: 'user-a', ns_score: 620 },
          { board: 2, user_id: 'bot', ns_score: 170 },
        ])
      }
      return svar([])
    }
    if (url.includes('profiles?')) {
      return svar([
        { id: 'user-a', display_name: 'Green', is_bot: false },
        { id: 'user-b', display_name: 'Anna', is_bot: false },
        { id: 'bot', display_name: 'Gunnar52', is_bot: true },
      ])
    }
    return svar([])
  })
  return { fn, resultatAnrop }
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', BAS)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-nyckel')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('tavling-historik — grindarna', () => {
  test('bara GET → 405', async () => {
    vi.stubGlobal('fetch', mockaFetch().fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('POST', 't'), res)
    expect(svar().status).toBe(405)
  })
  test('utan token → 401; ogiltig token → 401', async () => {
    vi.stubGlobal('fetch', mockaFetch().fn)
    const a = fakeRes()
    await handler(fakeReq('GET'), a.res)
    expect(a.svar().status).toBe(401)
    vi.stubGlobal('fetch', mockaFetch({ authOk: false }).fn)
    const b = fakeRes()
    await handler(fakeReq('GET', 't'), b.res)
    expect(b.svar().status).toBe(401)
  })
  test('kvoten full → 429', async () => {
    vi.stubGlobal('fetch', mockaFetch({ kvotOk: false }).fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', 't'), res)
    expect(svar().status).toBe(429)
  })
})

describe('tavling-historik — dagslistan och medaljtabellen', () => {
  test('frusna dagar ur daily_standings med din placering; ofrusna räknas i farten', async () => {
    const { fn, resultatAnrop } = mockaFetch()
    vi.stubGlobal('fetch', fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', 't'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    const dagar = body.dagar!
    expect(dagar.map((d) => d.dag)).toEqual(['2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09', '2026-09-08'])
    // Frusen dag 1: a tvåa bakom boten, tre spelare.
    const dag1 = dagar.find((d) => d.nummer === 1)!
    expect(dag1).toEqual({ dag: '2026-09-08', nummer: 1, storlek: 12, antalSpelare: 3, slutlig: true, du: { placering: 2, snitt: 55.25, spelade: 12 } })
    // Ofrusen dag 5: räknad i farten — a etta, (200 + 40 × 10) / 12 = 50.
    const dag5 = dagar.find((d) => d.nummer === 5)!
    expect(dag5.slutlig).toBe(false)
    expect(dag5.antalSpelare).toBe(2)
    expect(dag5.du).toEqual({ placering: 1, snitt: 50, spelade: 2 })
    // Ofrusen dag 4 utan inskick: 0 spelare, du null.
    const dag4 = dagar.find((d) => d.nummer === 4)!
    expect(dag4).toEqual({ dag: '2026-09-11', nummer: 4, storlek: 12, antalSpelare: 0, slutlig: false, du: null })
    // Bara de ofrusna dagarna slog i daily_results (två stycken).
    expect(resultatAnrop).toHaveLength(2)
  })

  test('medaljtabellen: bottarna uteslutna men placeringarna räknas som de var; ensam dag ger inget; ingen is_bot i svaret', async () => {
    vi.stubGlobal('fetch', mockaFetch().fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', 't'), res)
    const { body, text } = svar()
    // a: guld dag 2 + dag 3 (delad), silver dag 1 → 2/1/0. b: guld dag 3, brons dag 1 → 1/0/1.
    expect(body.medaljer).toEqual([
      { namn: 'Green', guld: 2, silver: 1, brons: 0, jag: true },
      { namn: 'Anna', guld: 1, silver: 0, brons: 1, jag: false },
    ])
    expect(text).not.toContain('Gunnar52')
    expect(text).not.toContain('is_bot')
  })

  test('daily_standings saknas (migration 0012 ej körd): dagslistan kommer ändå, medaljtabellen tom', async () => {
    vi.stubGlobal('fetch', mockaFetch({ standingsFinns: false }).fn)
    const { res, svar } = fakeRes()
    await handler(fakeReq('GET', 't'), res)
    const { status, body } = svar()
    expect(status).toBe(200)
    expect(body.medaljer).toEqual([])
    // Max tre dagar räknas i farten; resten listas utan siffror.
    const dagar = body.dagar!
    expect(dagar.filter((d) => d.antalSpelare !== null)).toHaveLength(3)
    expect(dagar[4]).toEqual({ dag: '2026-09-08', nummer: 1, storlek: 12, antalSpelare: null, slutlig: false, du: null })
  })
})
