// @vitest-environment jsdom
// Facit för Mitt konto (Påbyggnad 3, 2026-09-13): raden "Spelade givar" visar
// totalen + uppdelningen tävling/dagens giv, hämtad ur kontolagret. Auth och
// kontolagret är hånade — vi provar sidans egen logik (laddning, fel, rad).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

vi.mock('../../components/AuthProvider', () => ({
  useAuth: () => ({
    loading: false,
    signedIn: true,
    session: {},
    user: { email: 'a@x.se' },
    profile: { display_name: 'Green' },
    signOut: async () => {},
    refreshProfile: async () => {},
  }),
}))
const speladeMock = vi.hoisted(() => vi.fn())
vi.mock('../../lib/backend/account', () => ({
  deleteOwnAccount: vi.fn(),
  exportMyData: vi.fn(),
  fetchSpeladeGivar: speladeMock,
}))

import { Konto } from './Konto'

// OBS: ingen mockReset/mockClear i beforeEach — i vitest 4 fick det felfallet
// (avvisad mock-promise) att fallera trots sidans .catch (bisekterat 2026-09-13).
// Varje test sätter sin egen implementation.
afterEach(() => cleanup())

describe('Mitt konto — spelade givar', () => {
  it('visar totalen och uppdelningen när räkningen kommit', async () => {
    speladeMock.mockResolvedValue({ tavling: 120, dagensGiv: 22, totalt: 142 })
    render(
      <MemoryRouter>
        <Konto />
      </MemoryRouter>,
    )
    expect(screen.getByText('Green')).toBeInTheDocument()
    expect(screen.getByText('Spelade givar')).toBeInTheDocument()
    expect(await screen.findByText('142')).toBeInTheDocument()
    expect(screen.getByText('tävling 120 · dagens giv 22')).toBeInTheDocument()
  })

  it('visar "—" om räkningen misslyckas (sidan fungerar ändå)', async () => {
    speladeMock.mockImplementation(() => Promise.reject(new Error('nere')))
    render(
      <MemoryRouter>
        <Konto />
      </MemoryRouter>,
    )
    expect(await screen.findByText('—')).toBeInTheDocument()
    expect(screen.getByText('Green')).toBeInTheDocument()
  })
})
