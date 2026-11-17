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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
const givResultatMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/backend/tavling', async (importActual) => {
  const actual = await importActual<typeof import('../lib/backend/tavling')>()
  return {
    ...actual,
    fetchDagensTavling: fetchMock,
    submitTavlingGiv: submitMock,
    fetchGivResultat: givResultatMock,
    fetchTopplista: vi.fn().mockResolvedValue({ status: 'ingen' }),
  }
})

// Stubbad spelskärm: bokför resultatet på mount (som en klar giv), plus knappar
// för att gå vidare / till översikten.
vi.mock('./Play', async () => {
  const React = await import('react')
  const { GivBubbla } = await import('../components/PlayReplay')
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
        // Spelskärmen ritar bubblan ur tavling.historia (den riktiga komponenten).
        tavling.historia ? React.createElement(GivBubbla, tavling.historia) : null,
      )
    },
  }
})

import { DagensTavling } from './DagensTavling'
import { saveTavlingFramsteg } from '../lib/backend'

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
  givResultatMock.mockReset().mockResolvedValue({ status: 'ok', data: { board: 1, resultat: [] } })
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
  it('giv 1 klar → framsteget syns på översikten (Fortsätt giv 2) även om man går dit direkt', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    // giv 1 blir klar (stubbens onResultat), spelaren går till ÖVERSIKTEN.
    fireEvent.click(await screen.findByRole('button', { name: 'ÖVERSIKT-1' }))
    // Bokförd direkt → nästa ospelade är giv 2 ("Fortsätt – giv 2").
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
    expect(submitMock).toHaveBeenCalledTimes(1)
  })

  it('efter en giv landar man på ÖVERSIKTEN (inte rakt in i nästa giv)', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    // giv 1 klar → "Nästa"-knappen tar till översikten, inte till giv 2.
    fireEvent.click(await screen.findByRole('button', { name: 'NÄSTA-1' }))
    // Man landar på översikten och startar nästa giv själv med "Fortsätt – giv 2".
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
  })

  it('spela båda givarna → ingen knapp kvar, bara resultatet', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    // giv 1 → översikt → Fortsätt giv 2 → giv 2 → översikt (allt klart).
    fireEvent.click(await screen.findByRole('button', { name: 'NÄSTA-1' }))
    fireEvent.click(await screen.findByRole('button', { name: /Fortsätt – giv 2/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'NÄSTA-2' }))
    // Allt spelat: ingen ospelad giv kvar → ingen Starta/Fortsätt-knapp; sidan
    // visar bara resultatet ("Dina givar").
    expect(await screen.findByText('Dina givar')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Starta tävlingen|Fortsätt – giv/ }),
    ).not.toBeInTheDocument()
  })
})

// 2026-09-13 (ägarrapport "403 / givar registreras ej"): ett inskick som aldrig
// kom fram låg kvar för evigt som spelad lokalt utan att servern hade given.
// Nu skickas det om när sidan öppnas — exakt samma inskick — och raden får
// serverns status.
describe('Dagens tävling — tappade inskick skickas om när sidan öppnas', () => {
  it("en giv med status 'fel' skickas om vid start och blir inne (Fortsätt giv 2 kvar)", async () => {
    saveTavlingFramsteg({
      nummer: 9,
      klara: [{
        board: 1, myTricks: 9, win: true, headline: 'x', scoreLabel: null,
        inskickStatus: 'fel', history: [], plays: [], declarerTricks: 9,
      }],
    })
    starta()
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    // Formen går med i omsändningen (Dagens IMP, 2026-09-26): MP-sidan skickar 'mp'.
    expect(submitMock).toHaveBeenCalledWith({ board: 1, history: [], plays: [], declarerTricks: 9, form: 'mp' })
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('ej inskickad')).not.toBeInTheDocument())
  })
  it('en godkänd giv skickas INTE om', async () => {
    saveTavlingFramsteg({
      nummer: 9,
      klara: [{ board: 1, myTricks: 9, win: true, headline: 'x', scoreLabel: null, inskickStatus: 'godkand', history: [], plays: [], declarerTricks: 9 }],
    })
    starta()
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
    expect(submitMock).not.toHaveBeenCalled()
  })
})

// 2026-11-16 (ägarönskan): givens historia ska komma upp som en pratbubbla
// DIREKT efter given — på spelskärmens resultat, innan man valt att gå till
// översikten. Alla öppnar inte fältets resultat, och då missar de det roliga.
// Servern lämnar bara ut texten till den som spelat given → hämtas först när
// inskicket landat.
describe('Dagens tävling — givens historia som pratbubbla direkt efter given', () => {
  const TEXT = 'EM 1974. Tony Priday hade din hand och hoppade till 5♣.'
  const medHistoria = () =>
    givResultatMock.mockResolvedValue({ status: 'ok', data: { board: 1, berattelse: TEXT, resultat: [] } })

  it('given har en historia → spelskärmen får den som bubbla, vägen vidare står kvar', async () => {
    medHistoria()
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    const bubbla = await screen.findByRole('dialog', { name: 'Givens historia' })
    expect(bubbla).toHaveTextContent(/Tony Priday hade din hand/)
    // Hämtad för just den här given, först efter inskicket.
    expect(submitMock).toHaveBeenCalledTimes(1)
    expect(givResultatMock).toHaveBeenCalledWith(1, undefined, 'mp')
    // Spelskärmens egna val ligger kvar bakom bubblan.
    expect(screen.getByRole('button', { name: 'NÄSTA-1' })).toBeInTheDocument()
  })

  it('krysset stänger bubblan — spelskärmen står kvar', async () => {
    medHistoria()
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    await screen.findByRole('dialog', { name: 'Givens historia' })
    fireEvent.click(screen.getByRole('button', { name: 'Stäng' }))
    expect(screen.queryByRole('dialog', { name: 'Givens historia' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'NÄSTA-1' })).toBeInTheDocument()
  })

  it('en giv utan historia visar ingen bubbla', async () => {
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    await waitFor(() => expect(givResultatMock).toHaveBeenCalled())
    expect(screen.queryByRole('dialog', { name: 'Givens historia' })).not.toBeInTheDocument()
  })

  it('inskicket kom inte fram → ingen hämtning (servern hade ändå svarat 403)', async () => {
    medHistoria()
    submitMock.mockResolvedValue({ status: 'fel' })
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    await screen.findByRole('button', { name: 'NÄSTA-1' })
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1))
    expect(givResultatMock).not.toHaveBeenCalled()
  })

  it('bubblan följer inte med till översikten', async () => {
    medHistoria()
    starta()
    fireEvent.click(await screen.findByRole('button', { name: /Starta tävlingen/ }))
    await screen.findByRole('dialog', { name: 'Givens historia' })
    fireEvent.click(screen.getByRole('button', { name: 'NÄSTA-1' }))
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Givens historia' })).not.toBeInTheDocument()
  })
})
