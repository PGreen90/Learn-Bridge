// Direktskicket: submitFelrapport POST:ar rapporten till GitHubs API med den
// sparade nyckeln. Testerna låser (a) att rätt begäran byggs (adress, nyckel,
// titel/body/etikett = samma som felrapportUrl) och (b) att felkoder blir
// begripliga svenska meddelanden så dialogen kan visa dem.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseHand, type ResolvedCall } from './bidding'
import type { Contract } from './engine/play'
import { buildIssueBody, buildIssueTitle, submitFelrapport, type FelrapportInput } from './felrapport'

const deal = {
  id: 'test-giv',
  board: 5,
  dealer: 'N' as const,
  vulnerability: 'ns' as const,
  hands: {
    N: parseHand('S:AKQ4 H:32 D:QJ2 C:T987'),
    E: parseHand('S:JT9 H:QJT9 D:T98 C:654'),
    S: parseHand('S:8765 H:AK54 D:AK7 C:AK'),
    W: parseHand('S:32 H:876 D:6543 C:QJ32'),
  },
}

const calls: ResolvedCall[] = [
  { seat: 'N', bid: '1NT' },
  { seat: 'E', bid: 'P' },
  { seat: 'S', bid: '3NT' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: 'P' },
]

const contract: Contract = { declarer: 'N', strain: 'NT', level: 3 }

const input: FelrapportInput = {
  deal,
  calls,
  contract,
  tricks: [],
  category: 'Felaktig budgivning',
  description: 'Nord borde inte öppnat 1NT.',
}

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    status,
    json: async () => body,
  })) as unknown as typeof fetch
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('submitFelrapport', () => {
  it('POST:ar till repo-API:t med nyckeln och hela rapporten, och ger tillbaka issue-adressen', async () => {
    const fetchFn = mockFetch(201, { html_url: 'https://github.com/PGreen90/Learn-Bridge/issues/42' })

    const result = await submitFelrapport(input, 'github_pat_HEMLIG')

    expect(result.issueUrl).toBe('https://github.com/PGreen90/Learn-Bridge/issues/42')

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/PGreen90/Learn-Bridge/issues')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer github_pat_HEMLIG')

    const sent = JSON.parse(init.body)
    expect(sent.title).toBe(buildIssueTitle(input))
    expect(sent.body).toBe(buildIssueBody(input))
    expect(sent.labels).toEqual(['felrapport'])
  })

  it('401 → begripligt meddelande om utgången nyckel', async () => {
    mockFetch(401, {})
    await expect(submitFelrapport(input, 'x')).rejects.toThrow(/godtogs inte/)
  })

  it('404 → meddelande om saknad behörighet till repot', async () => {
    mockFetch(404, {})
    await expect(submitFelrapport(input, 'x')).rejects.toThrow(/behörighet/)
  })

  it('nätverksfel (fetch kastar) → meddelande om internetanslutning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(submitFelrapport(input, 'x')).rejects.toThrow(/internetanslutning/)
  })
})
