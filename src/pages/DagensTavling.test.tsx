// @vitest-environment jsdom
// Facit för "Dagens tävling"-sidan (Beslut B etapp 2, klientfasen): konto-grinden,
// hämtningens tre utfall och översiktens progress. Auth och serverhämtningen är
// hånade — vi provar sidans EGEN logik (grind, laddning, framsteg), inte
// nätverket eller spelmotorn.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
const topplistaMock = vi.hoisted(() => vi.fn())
const givResultatMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/backend/tavling', async (importActual) => {
  const actual = await importActual<typeof import('../lib/backend/tavling')>()
  return {
    ...actual,
    fetchDagensTavling: fetchMock,
    fetchTopplista: topplistaMock,
    fetchGivResultat: givResultatMock,
  }
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
  // Standard: ingen topplistedata (som förr, då fetchTopplista gav 'fel' i jsdom).
  topplistaMock.mockReset()
  topplistaMock.mockResolvedValue({ status: 'fel', fel: 'ingen data i test' })
  givResultatMock.mockReset()
  givResultatMock.mockResolvedValue({ status: 'fel', fel: 'ingen data i test' })
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

  it('cross-device: serverns inskick känns igen även utan lokalt framsteg', async () => {
    // Tomt localStorage (ny enhet) — men servern vet att giv 1 är inskickad.
    fetchMock.mockResolvedValue(ok())
    topplistaMock.mockResolvedValue({
      status: 'ok',
      data: {
        nummer: 9,
        storlek: 2,
        poängsattaGivar: 0,
        minPerGiv: 2,
        topplista: [],
        du: null,
        dinaGivar: [],
        dinaInskick: [{ board: 1, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 } }],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    // Översikten börjar INTE om på giv 1 — den känner igen serverns inskick.
    expect(await screen.findByText(/1 av 2 klara/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
    // Given syns i "Dina givar" med kontraktet servern återskapade.
    expect(screen.getByText('Dina givar')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
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
    // Given saknar ännu serverbekräftelse (ingen inskickStatus) → MP%:et väntar.
    expect(screen.getByText('väntar')).toBeInTheDocument()
  })

  it('godkänd men opoängsatt giv (ensam spelare) visar preliminärt 100 %, inte "väntar"', async () => {
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
            inskickStatus: 'godkand',
            kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 1 },
          },
        ],
      }),
    )
    fetchMock.mockResolvedValue(ok())
    // Topplistan har inga poängsatta givar än (du är ensam) → ingen mp för given.
    topplistaMock.mockResolvedValue({
      status: 'ok',
      data: { nummer: 9, storlek: 2, poängsattaGivar: 0, minPerGiv: 2, topplista: [], du: null, dinaGivar: [], dinaInskick: [] },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Dina givar')).toBeInTheDocument()
    // Godkänd + opoängsatt → preliminärt 100 % (inte "väntar").
    expect(screen.getByText('100 %')).toBeInTheDocument()
    expect(screen.queryByText('väntar')).not.toBeInTheDocument()
  })

  it('Din ställning-kortet visar preliminärt 1:a / 100 % för ensam spelare (du null men inskick finns)', async () => {
    fetchMock.mockResolvedValue(ok())
    topplistaMock.mockResolvedValue({
      status: 'ok',
      data: {
        nummer: 9,
        storlek: 2,
        poängsattaGivar: 0,
        minPerGiv: 2,
        topplista: [],
        du: null, // ingen poängsatt giv än
        dinaGivar: [],
        dinaInskick: [
          { board: 1, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 } },
          { board: 2, kontrakt: { level: 3, strain: 'NT', declarer: 'N', diff: 1 } },
        ],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    // Preliminärt 1:a (🥇) på dina 2 inskickade givar, tydligt märkt.
    expect(await screen.findByText('🥇')).toBeInTheDocument()
    expect(screen.getByText('preliminärt')).toBeInTheDocument()
    expect(screen.getByText('2 givar inne')).toBeInTheDocument()
    expect(screen.getByText(/Preliminärt tills minst 2 spelat samma giv/)).toBeInTheDocument()
  })

  it('resultattabellen: varje spelad giv är klickbar → fältets resultat (travellern)', async () => {
    localStorage.setItem(
      'learnbridge:tavling-framsteg',
      JSON.stringify({
        nummer: 9,
        klara: [
          { board: 1, myTricks: 10, win: true, headline: '', scoreLabel: null, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 }, history: [], plays: [] },
          { board: 2, myTricks: 8, win: false, headline: '', scoreLabel: null, kontrakt: { level: 3, strain: 'NT', declarer: 'E', diff: -1 } },
        ],
      }),
    )
    fetchMock.mockResolvedValue(ok())
    // Travellern för giv 1: två spelare, din rad markerad.
    givResultatMock.mockResolvedValue({
      status: 'ok',
      data: {
        board: 1,
        resultat: [
          { namn: 'Green', jag: true, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 }, nsScore: 420, procent: 100 },
          { namn: 'Testkonto', jag: false, kontrakt: { level: 3, strain: 'NT', declarer: 'S', diff: 1 }, nsScore: 430, procent: 0 },
        ],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Dina givar')).toBeInTheDocument()
    // Båda spelade givarna är klickbara.
    const knappar = screen.getAllByTitle('Visa fältets resultat')
    expect(knappar).toHaveLength(2)

    // Klick på giv 1 → detaljvyn hämtar och visar travellern.
    fireEvent.click(knappar[0])
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()
    expect(givResultatMock).toHaveBeenCalledWith(1)
    // Din rad markeras och motståndaren listas.
    expect(screen.getByText('Testkonto')).toBeInTheDocument()
    expect(screen.getByText(/\(du\)/)).toBeInTheDocument()
  })

  it('resultattabellen fyller kontrakt/resultat från SERVERN även utan lokalt kontrakt', async () => {
    // Lokalt framsteg UTAN kontraktsfält (spelad före kontraktssparningen).
    localStorage.setItem(
      'learnbridge:tavling-framsteg',
      JSON.stringify({
        nummer: 9,
        klara: [{ board: 1, myTricks: 10, win: true, headline: '', scoreLabel: null }],
      }),
    )
    fetchMock.mockResolvedValue(ok())
    topplistaMock.mockResolvedValue({
      status: 'ok',
      data: {
        nummer: 9,
        storlek: 2,
        poängsattaGivar: 1,
        minPerGiv: 2,
        topplista: [{ namn: 'Green', snitt: 100, antalGivar: 1 }],
        du: { placering: 1, snitt: 100, antalGivar: 1 },
        dinaGivar: [
          { board: 1, mp: 1, max: 1, procent: 100, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 1 } },
        ],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Dina givar')).toBeInTheDocument()
    // Kontraktet (♠) och resultatet (+1) kommer från serverns dinaGivar.
    expect(await screen.findByText('♠')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
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
