import { afterEach, describe, expect, it, vi } from 'vitest'
import { restGet, restGetAlla, restPost } from './supabase-rest'

const svar = (status: number, body = '') =>
  ({ ok: status >= 200 && status < 300, status, json: async () => (body ? JSON.parse(body) : null), text: async () => body }) as Response

afterEach(() => vi.restoreAllMocks())

describe('supabase restGet — omförsök på transienta fel', () => {
  it('returnerar direkt på 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svar(200, '[{"id":"x"}]'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await restGet('http://b', 'k', 'daily_sets?select=id')).toEqual([{ id: 'x' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('försöker om på 504 och lyckas på andra försöket', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(svar(504, 'Gateway Timeout')).mockResolvedValueOnce(svar(200, '[1]'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await restGet('http://b', 'k', 'x', 3)).toEqual([1])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('försöker om på nätfel (fetch kastar) och lyckas sedan', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(svar(200, 'null'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await restGet('http://b', 'k', 'x', 3)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('kastar direkt på 4xx (äkta fel, inget omförsök)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svar(400, 'bad'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(restGet('http://b', 'k', 'x', 3)).rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('kastar efter sista försöket vid ihållande 503', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svar(503, 'down'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(restGet('http://b', 'k', 'x', 3)).rejects.toThrow(/503/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('supabase restGetAlla — paginerad läsning (Påbyggnad 3)', () => {
  it('läser sida för sida med Range-headers tills en sida är kortare än sidstorleken', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(svar(206, '[1,2,3]'))
      .mockResolvedValueOnce(svar(206, '[4,5,6]'))
      .mockResolvedValueOnce(svar(200, '[7]'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await restGetAlla('http://b', 'k', 'daily_standings?select=set_id', 3)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const ranges = fetchMock.mock.calls.map((c) => (c[1] as { headers: Record<string, string> }).headers.Range)
    expect(ranges).toEqual(['0-2', '3-5', '6-8'])
  })

  it('exakt full sista sida → ett tomt extra anrop, sedan klart', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(svar(206, '[1,2]')).mockResolvedValueOnce(svar(200, '[]'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await restGetAlla('http://b', 'k', 'x', 2)).toEqual([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('supabase restPost — omförsök på transienta fel, 4xx lämnas till kallaren (inskicket 2026-09-13)', () => {
  it('försöker om på 503 och returnerar 201 på andra försöket', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(svar(503, 'down')).mockResolvedValueOnce(svar(201))
    vi.stubGlobal('fetch', fetchMock)
    const r = await restPost('http://b', 'k', 'daily_results', [{ x: 1 }], 3)
    expect(r.status).toBe(201)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '[{"x":1}]' })
  })
  it('409 (unik-krock: första försöket landade) returneras direkt utan omförsök', async () => {
    const fetchMock = vi.fn().mockResolvedValue(svar(409, 'duplicate'))
    vi.stubGlobal('fetch', fetchMock)
    expect((await restPost('http://b', 'k', 'daily_results', {}, 3)).status).toBe(409)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('kastar efter sista försöket vid nätfel', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(restPost('http://b', 'k', 'x', {}, 2)).rejects.toThrow(/ECONNRESET/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
