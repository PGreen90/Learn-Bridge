// Facit för anropskvoten (etapp 4A): RPC-omslagets utfall, inklusive den
// medvetet FELÖPPNA hållningen (kvoten är ett skydd — går RPC:n sönder ska
// borden inte sluta fungera).

import { describe, test, expect, vi, afterEach } from 'vitest'
import { KVOTER, kvotOk } from './kvot'

const BAS = 'https://exempel.supabase.co'

afterEach(() => {
  vi.unstubAllGlobals()
})

function svara(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body, text: async () => '' }))
}

describe('kvotOk', () => {
  test('true när RPC:n säger att anropet ryms', async () => {
    const fetchMock = svara(true)
    vi.stubGlobal('fetch', fetchMock)
    expect(await kvotOk(BAS, 'nyckel', 'user-1', 'skapa')).toBe(true)
    // RPC:n ska få handlingens fönster och tak ur KVOTER.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    const kropp = JSON.parse(init.body)
    expect(kropp).toMatchObject({
      p_user: 'user-1',
      p_endpoint: 'skapa',
      p_fonster_sek: KVOTER.skapa.fonsterSek,
      p_tak: KVOTER.skapa.tak,
    })
  })

  test('false när taket är nått', async () => {
    vi.stubGlobal('fetch', svara(false))
    expect(await kvotOk(BAS, 'nyckel', 'user-1', 'drag')).toBe(false)
  })

  test('felöppen: RPC-fel (icke-ok-svar) släpper igenom anropet', async () => {
    vi.stubGlobal('fetch', svara(null, false, 500))
    expect(await kvotOk(BAS, 'nyckel', 'user-1', 'hjartslag')).toBe(true)
  })

  test('felöppen: nätverksfel släpper igenom anropet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('nätet nere')
      }),
    )
    expect(await kvotOk(BAS, 'nyckel', 'user-1', 'lista')).toBe(true)
  })
})
