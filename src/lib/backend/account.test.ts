// Facit för kontolagret (Påbyggnad 3, 2026-09-13): "Spelade givar" räknas ur de
// EGNA raderna (RLS "läs egen") i daily_results (godkända + under granskning —
// avvisade är ingen giv) och daily_log; och dataexporten (GDPR) tar med
// tävlingsresultaten, dagsloggen och placeringarna. Supabase-klienten är
// hånad: vi provar VILKA frågor som ställs och hur svaren sätts ihop.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Fraga = { tabell: string; kolumner: string; opts?: { count?: string; head?: boolean }; filter: string[] }
const frågor: Fraga[] = []
/** Svar per tabell — count för head-frågor, data för vanliga. */
const svar: Record<string, { count?: number; data?: unknown[]; error?: { message: string } }> = {}

function byggare(f: Fraga) {
  const b = {
    eq: (k: string, v: unknown) => {
      f.filter.push(`eq ${k}=${String(v)}`)
      return b
    },
    in: (k: string, v: unknown[]) => {
      f.filter.push(`in ${k}=${v.join(',')}`)
      return b
    },
    order: (k: string) => {
      f.filter.push(`order ${k}`)
      return b
    },
    then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => {
      const s = svar[f.tabell] ?? {}
      return Promise.resolve({ data: s.data ?? null, count: s.count ?? null, error: s.error ?? null }).then(res, rej)
    },
  }
  return b
}

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-a', email: 'a@x.se', created_at: '2026-08-10T00:00:00Z' } } }),
    },
    from: (tabell: string) => ({
      select: (kolumner: string, opts?: { count?: string; head?: boolean }) => {
        const f: Fraga = { tabell, kolumner, opts, filter: [] }
        frågor.push(f)
        return byggare(f)
      },
    }),
  }),
}))
vi.mock('./auth', () => ({
  fetchProfile: async () => ({ id: 'user-a', display_name: 'Green', is_13_plus: true, created_at: 'x' }),
}))

import { exportMyData, fetchSpeladeGivar } from './account'

beforeEach(() => {
  frågor.length = 0
  for (const k of Object.keys(svar)) delete svar[k]
})

describe('fetchSpeladeGivar', () => {
  it('räknar egna tävlingsgivar (godkand + granskning) + Dagens giv-loggen', async () => {
    svar.daily_results = { count: 120 }
    svar.daily_log = { count: 22 }
    const r = await fetchSpeladeGivar()
    expect(r).toEqual({ tavling: 120, dagensGiv: 22, totalt: 142 })

    const tavling = frågor.find((f) => f.tabell === 'daily_results')!
    expect(tavling.opts).toEqual({ count: 'exact', head: true })
    expect(tavling.filter).toContain('eq user_id=user-a')
    expect(tavling.filter).toContain('in status=godkand,granskning')
    const logg = frågor.find((f) => f.tabell === 'daily_log')!
    expect(logg.opts).toEqual({ count: 'exact', head: true })
    expect(logg.filter).toContain('eq user_id=user-a')
  })

  it('saknat count (null) räknas som 0; ett fel kastas vidare', async () => {
    svar.daily_results = { count: 3 }
    svar.daily_log = {}
    expect(await fetchSpeladeGivar()).toEqual({ tavling: 3, dagensGiv: 0, totalt: 3 })
    svar.daily_log = { error: { message: 'nere' } }
    await expect(fetchSpeladeGivar()).rejects.toThrow('nere')
  })
})

describe('exportMyData (GDPR-portabilitet)', () => {
  it('tar med kontot, profilen, tävlingsresultaten, dagsloggen och placeringarna', async () => {
    svar.daily_results = { data: [{ board: 1, status: 'godkand', payload: { plays: [] } }] }
    svar.daily_log = { data: [{ giv_nummer: 5, my_tricks: 9 }] }
    svar.daily_standings = { data: [{ placering: 2, snitt: 55.5 }] }
    const d = await exportMyData()
    expect(d.konto).toEqual({ id: 'user-a', epost: 'a@x.se', skapad: '2026-08-10T00:00:00Z' })
    expect((d.profil as { display_name: string }).display_name).toBe('Green')
    expect(d.tavlingsresultat).toEqual([{ board: 1, status: 'godkand', payload: { plays: [] } }])
    expect(d.dagensGivLogg).toEqual([{ giv_nummer: 5, my_tricks: 9 }])
    expect(d.tavlingsplaceringar).toEqual([{ placering: 2, snitt: 55.5 }])
    // Bara egna rader efterfrågas (RLS skyddar ändå, men frågan ska vara ärlig).
    for (const f of frågor) expect(f.filter).toContain('eq user_id=user-a')
  })

  it('placeringstabellen saknas ännu (migration 0012 ej körd) → exporten fungerar ändå', async () => {
    svar.daily_results = { data: [] }
    svar.daily_log = { data: [] }
    svar.daily_standings = { error: { message: 'relation "daily_standings" does not exist' } }
    const d = await exportMyData()
    expect(d.tavlingsresultat).toEqual([])
    expect(d.tavlingsplaceringar).toBeNull()
  })
})
