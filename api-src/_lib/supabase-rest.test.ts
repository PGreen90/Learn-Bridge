import { afterEach, describe, expect, it, vi } from 'vitest'
import { restGet } from './supabase-rest'

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
