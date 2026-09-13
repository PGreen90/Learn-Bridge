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

  it('ok: översikten visar startknappen', async () => {
    fetchMock.mockResolvedValue(ok())
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    // Inget spelat än → "Starta tävlingen". (Progress-stapeln + rutnätet borttagna.)
    expect(await screen.findByRole('button', { name: /Starta tävlingen/ })).toBeInTheDocument()
    // Nedräkningen till nästa tävling syns på översikten (kompakt klock-pill).
    expect(screen.getByTitle('Tid kvar till nästa tävling')).toBeInTheDocument()
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
    // Nästa ospelade är giv 2 → knappen "Fortsätt" (progress-texten borttagen).
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
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
    // Översikten börjar INTE om på giv 1 — den känner igen serverns inskick
    // (nästa ospelade = giv 2).
    expect(await screen.findByRole('button', { name: /Fortsätt – giv 2/ })).toBeInTheDocument()
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

  it('godkänd men opoängsatt giv (ensam spelare) visar "väntar" (räknas som 40 % i snittet), aldrig 100 %', async () => {
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
    // Godkänd + opoängsatt → "väntar" (Påbyggnad 3: det gamla "preliminärt 100 %"
    // motsade ställningen, där given räknas som 40 %).
    const cell = screen.getByText('väntar')
    expect(cell).toBeInTheDocument()
    expect(cell).toHaveAttribute('title', expect.stringMatching(/40 %/))
    expect(screen.queryByText('100 %')).not.toBeInTheDocument()
  })

  it('Din ställning-kortet (Påbyggnad 3): "1/2 givar" + tillsvidare-snittet med 40 %-noten', async () => {
    fetchMock.mockResolvedValue(ok())
    topplistaMock.mockResolvedValue({
      status: 'ok',
      data: {
        nummer: 9,
        storlek: 2,
        poängsattaGivar: 1,
        minPerGiv: 2,
        provisoriskProcent: 40,
        topplista: [{ namn: 'Green', snitt: 70, antalGivar: 1, spelade: 1, jag: true }],
        // En spelad, poängsatt giv på 100 %: (100 + 40) / 2 = 70.
        du: { placering: 1, snitt: 70, antalGivar: 1, spelade: 1 },
        dinaGivar: [{ board: 1, mp: 1, max: 1, procent: 100 }],
        dinaInskick: [{ board: 1, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 } }],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    // 🥇 både i Din ställning och på listans första rad.
    expect((await screen.findAllByText('🥇')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1/2 givar')).toBeInTheDocument()
    expect(screen.getByText(/Ospelade givar räknas som 40 % tills du spelat dem/)).toBeInTheDocument()
    expect(screen.queryByText(/preliminär/)).not.toBeInTheDocument()
  })

  it('Ställningen visar spelade givar per spelare ("7/12") och 40 %-fotnoten', async () => {
    fetchMock.mockResolvedValue(ok())
    topplistaMock.mockResolvedValue({
      status: 'ok',
      data: {
        nummer: 9,
        storlek: 12,
        poängsattaGivar: 7,
        minPerGiv: 2,
        provisoriskProcent: 40,
        topplista: [
          { namn: 'Green', snitt: 75, antalGivar: 7, spelade: 7, jag: true },
          { namn: 'Gunnar52', snitt: 200 / 12, antalGivar: 7, spelade: 12, jag: false },
        ],
        du: { placering: 1, snitt: 75, antalGivar: 7, spelade: 7 },
        dinaGivar: [],
        dinaInskick: [],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Ställningen')).toBeInTheDocument()
    expect(screen.getByText('7/12')).toBeInTheDocument()
    expect(screen.getByText('12/12')).toBeInTheDocument()
    expect(screen.getByText(/Ospelade givar räknas som 40 % tills de spelats/)).toBeInTheDocument()
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
    // Dagens tävling → ingen dag-parameter (historiken skickar sin dag).
    expect(givResultatMock).toHaveBeenCalledWith(1, undefined)
    // Din rad markeras och motståndaren listas.
    expect(screen.getByText('Testkonto')).toBeInTheDocument()
    expect(screen.getByText(/\(du\)/)).toBeInTheDocument()
  })

  it('travellern (Påbyggnad 3): klick på en annan spelares rad → "Så spelade X given" med stegningen', async () => {
    localStorage.setItem(
      'learnbridge:tavling-framsteg',
      JSON.stringify({
        nummer: 9,
        klara: [{ board: 1, myTricks: 10, win: true, headline: '', scoreLabel: null, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 } }],
      }),
    )
    fetchMock.mockResolvedValue(ok())
    // Testkontots spelade kort: bara utspelet (Väst leder mot 4♠ av Syd) — räcker
    // för att stegningen ska byggas ur serverns payload.
    const utspel = TÄVLING.givar[0].deal.hands.W[0]
    givResultatMock.mockResolvedValue({
      status: 'ok',
      data: {
        board: 1,
        resultat: [
          { namn: 'Green', jag: true, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 }, nsScore: 420, procent: 50, history: [{ seat: 'S', bid: '4S' }, { seat: 'W', bid: 'P' }, { seat: 'N', bid: 'P' }, { seat: 'E', bid: 'P' }], plays: [utspel], declarerTricks: 10 },
          { namn: 'Testkonto', jag: false, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 }, nsScore: 420, procent: 50, history: [{ seat: 'S', bid: '4S' }, { seat: 'W', bid: 'P' }, { seat: 'N', bid: 'P' }, { seat: 'E', bid: 'P' }], plays: [utspel], declarerTricks: 10 },
          { namn: 'Utan', jag: false, kontrakt: { level: 3, strain: 'NT', declarer: 'S', diff: 0 }, nsScore: 400, procent: 0 },
        ],
      },
    })
    render(
      <MemoryRouter>
        <DagensTavling />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Dina givar')).toBeInTheDocument()
    fireEvent.click(screen.getAllByTitle('Visa fältets resultat')[0])
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()

    // Klick på Testkontos rad → genomgången i perspektivfri form (PlayReplay:
    // "Bricka 1"), ingen "du"-knapp för någon annans giv.
    fireEvent.click(screen.getByTitle('Se hur Testkonto spelade given'))
    expect(await screen.findByText('Så spelade Testkonto giv 1')).toBeInTheDocument()
    expect(screen.getByText('Bricka 1')).toBeInTheDocument()
    expect(screen.queryByText(/Rondgenomgång med förklaringar/)).not.toBeInTheDocument()

    // Tillbaka → travellern igen; egen rad → "Så spelade du" + vägen till rapporten.
    fireEvent.click(screen.getByText('← Tillbaka'))
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Se hur du spelade given'))
    expect(await screen.findByText('Så spelade du giv 1')).toBeInTheDocument()
    expect(screen.getByText(/Rondgenomgång med förklaringar/)).toBeInTheDocument()

    // Rad utan sparade kort → vänligt meddelande i stället för krasch.
    fireEvent.click(screen.getByText('← Tillbaka'))
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Se hur Utan spelade given'))
    expect(await screen.findByText(/Genomgången är inte tillgänglig/)).toBeInTheDocument()
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
    // Gårdagens framsteg ignoreras → börjar om: "Starta tävlingen".
    expect(await screen.findByRole('button', { name: /Starta tävlingen/ })).toBeInTheDocument()
  })
})
