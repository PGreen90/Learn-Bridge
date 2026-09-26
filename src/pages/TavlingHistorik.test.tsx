// @vitest-environment jsdom
// Facit för tävlingshistoriken (Påbyggnad 3, etapp D3): listvyn (medaljtabell
// topp 5 + dagar med din placering), dagvyn (?dag= → ställning + brickor),
// och kedjan bricka → traveller → spelare → "Så spelade X given". Auth och
// hämtarna är hånade — vi provar sidans egen logik.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import type { DagensTavling as TavlingData } from '../lib/backend/tavling'
import { gameFromSeed } from './play/useGame'

const auth = vi.hoisted(() => ({ loading: false, signedIn: true }))
vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ ...auth, session: null, user: null, profile: null }),
}))

const historikMock = vi.hoisted(() => vi.fn())
const tavlingMock = vi.hoisted(() => vi.fn())
const topplistaMock = vi.hoisted(() => vi.fn())
const givResultatMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/backend/tavling', async (importActual) => {
  const actual = await importActual<typeof import('../lib/backend/tavling')>()
  return {
    ...actual,
    fetchTavlingHistorik: historikMock,
    fetchDagensTavling: tavlingMock,
    fetchTopplista: topplistaMock,
    fetchGivResultat: givResultatMock,
  }
})

import { kortDatum, placeringText, TavlingHistorik } from './TavlingHistorik'

function giv(board: number) {
  const base = gameFromSeed(100 + board).deal
  return { deal: { ...base, id: `tavling-41-${board}`, board }, playSeed: board }
}
const DAG: TavlingData = { nummer: 41, dag: '2026-09-11', storlek: 2, givar: [giv(1), giv(2)] }

function renderSida(start = '/spela-kort/tavling/historik') {
  return render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/spela-kort/tavling/historik" element={<TavlingHistorik />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.signedIn = true
  historikMock.mockReset()
  historikMock.mockResolvedValue({
    status: 'ok',
    data: {
      dagar: [
        { dag: '2026-09-12', nummer: 42, storlek: 12, antalSpelare: 5, slutlig: true, du: { placering: 2, snitt: 55.3, spelade: 12 } },
        { dag: '2026-09-11', nummer: 41, storlek: 12, antalSpelare: 4, slutlig: true, du: { placering: 1, snitt: 61, spelade: 12 } },
        { dag: '2026-09-10', nummer: 40, storlek: 12, antalSpelare: 3, slutlig: false, du: null },
      ],
      medaljer: [
        { namn: 'Anna', guld: 3, silver: 1, brons: 0, jag: false },
        { namn: 'Green', guld: 2, silver: 2, brons: 1, jag: true },
      ],
    },
  })
  tavlingMock.mockReset()
  tavlingMock.mockResolvedValue({ status: 'ok', tavling: DAG })
  topplistaMock.mockReset()
  topplistaMock.mockResolvedValue({
    status: 'ok',
    data: {
      nummer: 41,
      storlek: 2,
      poängsattaGivar: 2,
      minPerGiv: 2,
      provisoriskProcent: 40,
      dag: '2026-09-11',
      idag: false,
      slutlig: true,
      topplista: [
        { namn: 'Green', snitt: 61, antalGivar: 2, spelade: 2, jag: true },
        { namn: 'Anna', snitt: 39, antalGivar: 2, spelade: 2, jag: false },
      ],
      du: { placering: 1, snitt: 61, antalGivar: 2, spelade: 2 },
      dinaGivar: [{ board: 1, mp: 1, max: 1, procent: 100, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 } }],
      dinaInskick: [{ board: 1, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 } }],
    },
  })
  givResultatMock.mockReset()
  const utspel = DAG.givar[0].deal.hands.W[0]
  givResultatMock.mockResolvedValue({
    status: 'ok',
    data: {
      board: 1,
      resultat: [
        { namn: 'Green', jag: true, kontrakt: { level: 4, strain: 'spades', declarer: 'S', diff: 0 }, nsScore: 420, procent: 100, history: [{ seat: 'S', bid: '4S' }, { seat: 'W', bid: 'P' }, { seat: 'N', bid: 'P' }, { seat: 'E', bid: 'P' }], plays: [utspel], declarerTricks: 10 },
        { namn: 'Anna', jag: false, kontrakt: { level: 3, strain: 'NT', declarer: 'S', diff: 0 }, nsScore: 400, procent: 0, history: [{ seat: 'S', bid: '3NT' }, { seat: 'W', bid: 'P' }, { seat: 'N', bid: 'P' }, { seat: 'E', bid: 'P' }], plays: [utspel], declarerTricks: 9 },
      ],
    },
  })
})
afterEach(() => cleanup())

describe('hjälpare', () => {
  it('kortDatum och placeringText', () => {
    expect(kortDatum('2026-09-12')).toBe('12 sep')
    expect(kortDatum('2026-01-03')).toBe('3 jan')
    expect(placeringText(1)).toBe('1:a')
    expect(placeringText(2)).toBe('2:a')
    expect(placeringText(3)).toBe('3:e')
    expect(placeringText(11)).toBe('11:e')
  })
})

describe('tävlingshistoriken', () => {
  it('utloggad: kräver konto', async () => {
    auth.signedIn = false
    renderSida()
    expect(await screen.findByText(/kräver ett konto/)).toBeInTheDocument()
    expect(historikMock).not.toHaveBeenCalled()
  })

  it('listvyn: medaljtabellen (din rad markerad, datorspelare-noten) + dagarna med din placering', async () => {
    renderSida()
    expect(await screen.findByText('Medaljtabellen')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Green')).toBeInTheDocument()
    expect(screen.getByText('(du)')).toBeInTheDocument()
    expect(screen.getByText(/datorspelare räknas inte i medaljtabellen/)).toBeInTheDocument()
    // Dagarna: #42 tvåa av 5, #41 etta (🥇), #40 spelade inte + provisorisk.
    expect(screen.getByTitle('Visa tävling #42')).toHaveTextContent('2:a')
    expect(screen.getByTitle('Visa tävling #42')).toHaveTextContent('av 5')
    expect(screen.getByTitle('Visa tävling #42')).toHaveTextContent('55.3 %')
    expect(screen.getByTitle('Visa tävling #41')).toHaveTextContent('🥇')
    expect(screen.getByTitle('Visa tävling #40')).toHaveTextContent('spelade inte')
    expect(screen.getByTitle('Visa tävling #40')).toHaveTextContent('provisorisk')
  })

  it('dagvyn (klick på en dag): hämtar den dagen, visar ställningen (slutlig) och alla brickor', async () => {
    renderSida()
    fireEvent.click(await screen.findByTitle('Visa tävling #41'))
    expect(await screen.findByText('Ställningen')).toBeInTheDocument()
    expect(tavlingMock).toHaveBeenCalledWith('2026-09-11', 'mp')
    expect(topplistaMock).toHaveBeenCalledWith('2026-09-11', 'mp')
    expect(screen.getByText(/slutlig/)).toBeInTheDocument()
    // Bricklistan: giv 1 spelad (kontrakt ♠), giv 2 "spelade inte" — båda klickbara.
    expect(screen.getByText('Givarna')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
    expect(screen.getByText('spelade inte')).toBeInTheDocument()
    expect(screen.getAllByTitle('Visa fältets resultat')).toHaveLength(2)
  })

  it('djuplänk ?dag= öppnar dagvyn direkt; bricka → traveller (med dag) → spelare → "Så spelade X"', async () => {
    renderSida('/spela-kort/tavling/historik?dag=2026-09-11')
    expect(await screen.findByText('Givarna')).toBeInTheDocument()
    expect(historikMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByTitle('Visa fältets resultat')[0])
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()
    expect(givResultatMock).toHaveBeenCalledWith(1, '2026-09-11', 'mp')

    fireEvent.click(screen.getByTitle('Se hur Anna spelade given'))
    expect(await screen.findByText('Så spelade Anna giv 1')).toBeInTheDocument()
    expect(screen.getByText('Bricka 1')).toBeInTheDocument()

    // Tillbaka hela vägen till listvyn.
    fireEvent.click(screen.getByText('← Tillbaka'))
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()
    fireEvent.click(screen.getByText('← Tillbaka till översikten'))
    expect(await screen.findByText('Givarna')).toBeInTheDocument()
    fireEvent.click(screen.getByText('← Alla tävlingsdagar'))
    expect(await screen.findByText('Medaljtabellen')).toBeInTheDocument()
  })
})
