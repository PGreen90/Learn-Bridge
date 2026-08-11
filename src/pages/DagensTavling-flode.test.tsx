// @vitest-environment jsdom
// Regressionsfacit (2026-08-11, ägarrapport): en spelad tävlingsgiv ska bokföras
// i samma stund den blir klar — INTE först på "Nästa giv"-klicket. Annars tappas
// framsteget om spelaren i stället går till översikten för att se sina resultat
// (den buggen: bocken dök upp först efter att NÄSTA giv spelats).
//
// Spelskärmen (Play) stubbas: stubben anropar onResultat när given "blir klar"
// (mount-effekt), och har knappar för onNästa/onÖversikt. Testet provar alltså
// STATE-flödet i DagensTavling, inte spelmotorn.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import type { DagensTavling as TavlingData, TavlingsResultat } from '../lib/backend/tavling'
import type { TavlingSpel } from './play/tavling-mode'

const auth = vi.hoisted(() => ({ loading: false, signedIn: true }))
vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ ...auth, session: null, user: null, profile: null }),
}))

const fetchMock = vi.hoisted(() => vi.fn())
const submitMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/backend/tavling', async (importActual) => {
  const actual = await importActual<typeof import('../lib/backend/tavling')>()
  return {
    ...actual,
    fetchDagensTavling: fetchMock,
    submitTavlingGiv: submitMock,
    fetchTopplista: vi.fn().mockResolvedValue({ status: 'ingen' }),
  }
})

// Stubbad spelskärm: bokför resultatet på mount (som en klar giv), plus knappar
// för att gå vidare / till översikten.
vi.mock('./Play', async () => {
  const React = await import('react')
  return {
    Play: ({ tavling }: { tavling: TavlingSpel }) => {
      React.useEffect(() => {
        tavling.onResultat(
          { board: tavling.board, myTricks: 1, win: true, headline: 'x', scoreLabel: null },
          { board: tavling.board, history: [], plays: [], declarerTricks: 1 },
        )
      }, [tavling.board])
      return React.createElement(
        'div',
        null,
        React.createElement('button', { onClick: tavling.onNästa }, `NÄSTA-${tavling.board}`),
        React.createElement('button', { onClick: tavling.onÖversikt }, `ÖVERSIKT-${tavling.board}`),
      )
    },
  }
})

import { DagensTavling } from './DagensTavling'

function giv(board: number) {
  return {
    deal: { id: `t-9-${board}`, hands: {} as never, dealer: 'N' as const, vulnerability: 'none' as const, board },
    playSeed: board,
  }
}
const TÄVLING: TavlingData = { nummer: 9, dag: '2026-08-11', storlek: 2, givar: [giv(1), giv(2)] }
const ok = (): TavlingsResultat => ({ status: 'ok', tavling: TÄVLING })

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(ok())
  submitMock.mockReset().mockResolvedValue({ status: 'godkand', nsScore: 0 })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

function starta() {
  return render(
    <MemoryRouter>
      <DagensTavling />
    </MemoryRouter>,
  )
}

describe('Dagens tävling — framsteget bokförs när given blir klar', () => {
  it('giv 1 klar → översikten visar "1 av 2 klara" även om man går dit direkt (inte via Nästa)', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    // giv 1 blir klar (stubbens onResultat), spelaren går till ÖVERSIKTEN.
    fireEvent.click(await screen.findByRole('button', { name: 'ÖVERSIKT-1' }))
    expect(await screen.findByText(/1 av 2 klara/)).toBeInTheDocument()
    expect(submitMock).toHaveBeenCalledTimes(1)
  })

  it('efter en giv landar man på ÖVERSIKTEN (inte rakt in i nästa giv)', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    // giv 1 klar → "Nästa"-knappen tar till översikten, inte till giv 2.
    fireEvent.click(await screen.findByRole('button', { name: 'NÄSTA-1' }))
    expect(await screen.findByText(/1 av 2 klara/)).toBeInTheDocument()
    // Därifrån startar man nästa giv själv med "Fortsätt – giv 2".
    expect(screen.getByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
  })

  it('spela båda givarna via översikten → allt-klart-vyn', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    // giv 1 → översikt → Fortsätt giv 2 → giv 2 → översikt (allt klart).
    fireEvent.click(await screen.findByRole('button', { name: 'NÄSTA-1' }))
    fireEvent.click(await screen.findByRole('button', { name: /Fortsätt – giv 2/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'NÄSTA-2' }))
    expect(await screen.findByText(/Alla 2 givar spelade/)).toBeInTheDocument()
  })
})
