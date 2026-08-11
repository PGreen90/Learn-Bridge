// @vitest-environment jsdom
// Facit för "Dagens tävling"-sidan (Beslut B etapp 2, klientfasen): konto-grinden,
// hämtningens tre utfall och översiktens progress. Auth och serverhämtningen är
// hånade — vi provar sidans EGEN logik (grind, laddning, framsteg), inte
// nätverket eller spelmotorn.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import type { DagensTavling as TavlingData, TavlingsResultat } from '../lib/backend/tavling'
import { gameFromSeed } from './play/useGame'

// Hånad auth: en muterbar rigg som varje test ställer in före render.
const auth = vi.hoisted(() => ({ loading: false, signedIn: false }))
vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ ...auth, session: null, user: null, profile: null }),
}))

// Hånad serverhämtning: testet bestämmer utfallet.
const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/backend/tavling', async (importActual) => {
  const actual = await importActual<typeof import('../lib/backend/tavling')>()
  return { ...actual, fetchDagensTavling: fetchMock }
})

import { DagensTavling } from './DagensTavling'

/** En tävlingsgiv med bricknummer `board` (giltig giv ur ett klientfrö). */
function giv(board: number) {
  const base = gameFromSeed(100 + board).deal
  return { deal: { ...base, id: `tavling-9-${board}`, board }, playSeed: board }
}
const TÄVLING: TavlingData = {
  nummer: 9,
  dag: '2026-08-11',
  storlek: 2,
  givar: [giv(1), giv(2)],
}
const ok = (): TavlingsResultat => ({ status: 'ok', tavling: TÄVLING })

beforeEach(() => {
  auth.loading = false
  auth.signedIn = false
  fetchMock.mockReset()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Dagens tävling — konto-grinden', () => {
  it('utloggad: visar logga-in-rutan, hämtar aldrig', () => {
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Logga in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skapa konto' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Dagens tävling — hämtningens utfall (inloggad)', () => {
  beforeEach(() => {
    auth.signedIn = true
  })

  it('ok: översikten visar progress och startknapp', async () => {
    fetchMock.mockResolvedValue(ok())
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/0 av 2 klara/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Starta tävlingen/ })).toBeInTheDocument()
    // Nedräkningen till nästa tävling syns på översikten.
    expect(screen.getByText(/Nästa tävling om/)).toBeInTheDocument()
  })

  it('ingen tävling idag: visar vänligt meddelande', async () => {
    fetchMock.mockResolvedValue({ status: 'ingen' })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/inte klara än/)).toBeInTheDocument()
  })

  it('fel: visar felmeddelandet', async () => {
    fetchMock.mockResolvedValue({ status: 'fel', fel: 'Kunde inte nå servern.' })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Kunde inte nå servern.')).toBeInTheDocument()
  })

  it('framsteg minns klara givar (samma tävlingsnummer)', async () => {
    localStorage.setItem(
      'learnbridge:tavling-framsteg',
      JSON.stringify({ nummer: 9, klara: [{ board: 1, myTricks: 9, win: true, headline: '', scoreLabel: null }] }),
    )
    fetchMock.mockResolvedValue(ok())
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/1 av 2 klara/)).toBeInTheDocument()
    // Nästa ospelade är giv 2 → knappen "Fortsätt".
    expect(screen.getByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
  })

  it('resultattabellen visar kontrakt, resultat och (i väntan på poäng) "väntar"', async () => {
    localStorage.setItem(
      'learnbridge:tavling-framsteg',
      JSON.stringify({
        nummer: 9,
        klara: [
          {
            board: 1,
            myTricks: 11,
            win: true,
            headline: '',
            scoreLabel: null,
            kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 1 },
          },
        ],
      }),
    )
    fetchMock.mockResolvedValue(ok())
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    // Tabellrubriken + kontraktet (4♠) och resultatet (+1) för giv 1.
    expect(await screen.findByText('Dina givar')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    // Utan topplistedata (fetchTopplista hånas ej → 'fel') väntar MP%:et.
    expect(screen.getByText('väntar')).toBeInTheDocument()
  })

  it('gårdagens framsteg (annat nummer) återupptas inte', async () => {
    localStorage.setItem(
      'learnbridge:tavling-framsteg',
      JSON.stringify({ nummer: 8, klara: [{ board: 1, myTricks: 9, win: true, headline: '', scoreLabel: null }] }),
    )
    fetchMock.mockResolvedValue(ok())
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/0 av 2 klara/)).toBeInTheDocument()
  })
})
