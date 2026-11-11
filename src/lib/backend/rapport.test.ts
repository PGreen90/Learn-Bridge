// skickaRapport: rätt begäran till /api/rapport, och felkoder blir begripliga
// svenska meddelanden som dialogen kan visa rakt av.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { skickaRapport, type Rapport } from './rapport'

const rapport: Rapport = { typ: 'felrapport', titel: 'Felrapport: Annat (bricka 1, utpassad)', text: 'Hej' }

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(status: number) {
  const fn = vi.fn(async () => ({ ok: status >= 200 && status < 300, status }))
  vi.stubGlobal('fetch', fn as unknown as typeof fetch)
  return fn
}

describe('skickaRapport', () => {
  it('POST:ar hela rapporten som JSON till /api/rapport — utan nyckel eller inloggning', async () => {
    const fn = mockFetch(200)
    await skickaRapport(rapport)
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/rapport')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(rapport)
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i)
  })

  it('429 → be användaren vänta', async () => {
    mockFetch(429)
    await expect(skickaRapport(rapport)).rejects.toThrow(/vänta några minuter/)
  })

  it('annat serverfel → felkoden syns', async () => {
    mockFetch(502)
    await expect(skickaRapport(rapport)).rejects.toThrow(/felkod 502/)
  })

  it('nätverksfel (fetch kastar) → meddelande om internetanslutning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(skickaRapport(rapport)).rejects.toThrow(/internetanslutning/)
  })
})
