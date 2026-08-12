// @vitest-environment jsdom
// Facit FÖRE bygget (2026-08-12, ägaren): "Spela given igen — övning" i giv-
// detaljvyn öppnar en klar tävlingsgiv i övningsläge. KORREKTHETSKRAVET som
// aldrig får brytas: ett omspel i övningsläge får INTE
//   1) skicka in given till servern (submitTavlingGiv anropas ej), och
//   2) röra det sparade framsteget (learnbridge:tavling-framsteg orört)
// → din ursprungliga MP% står kvar överallt. Play stubbas (som i flödestestet):
// stubben avslöjar `tavling.övning`-flaggan och anropar onResultat på mount som
// om övningsgiven blev klar. Testet provar alltså STATE-flödet i DagensTavling.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'
import type { DagensTavling as TavlingData, GivResultat, TavlingsResultat } from '../lib/backend/tavling'
import type { TavlingSpel } from './play/tavling-mode'
import { loadTavlingFramsteg, saveTavlingFramsteg } from '../lib/backend'

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
    fetchTopplista: vi.fn().mockResolvedValue({ status: 'ingen' }),
    fetchGivResultat: givResultatMock,
  }
})

// Stubbad spelskärm: avslöjar övningsflaggan (ÖVNING- vs TÄVLING-knapp) och
// bokför resultatet på mount (som en klar giv). "Tillbaka" = onNästa.
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
      const märke = tavling.övning ? 'ÖVNING' : 'TÄVLING'
      return React.createElement(
        'div',
        null,
        React.createElement('span', null, `${märke}-${tavling.board}`),
        React.createElement('button', { onClick: tavling.onNästa }, `TILLBAKA-${tavling.board}`),
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
const TÄVLING: TavlingData = { nummer: 9, dag: '2026-08-12', storlek: 2, givar: [giv(1), giv(2)] }
const ok = (): TavlingsResultat => ({ status: 'ok', tavling: TÄVLING })

// En redan spelad giv 1 i framsteget (så "Dina givar" visar den och detaljvyn
// går att öppna). inskickStatus:'godkand' = servern har tagit emot den.
const KLAR_GIV1: GivResultat = {
  board: 1,
  myTricks: 8,
  win: true,
  headline: 'Du vann',
  scoreLabel: '+620',
  inskickStatus: 'godkand',
  kontrakt: { level: 4, strain: 'hearts', declarer: 'S', diff: 0 },
  history: [],
  plays: [],
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(ok())
  submitMock.mockReset().mockResolvedValue({ status: 'godkand', nsScore: 620 })
  givResultatMock.mockReset().mockResolvedValue({
    status: 'ok',
    data: { board: 1, resultat: [] },
  })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

function starta() {
  saveTavlingFramsteg({ nummer: 9, klara: [KLAR_GIV1] })
  return render(
    <MemoryRouter>
      <DagensTavling />
    </MemoryRouter>,
  )
}

// Öppna giv 1:s detaljvy (travellern) från översikten.
async function öppnaDetalj() {
  starta()
  fireEvent.click(await screen.findByTitle('Visa fältets resultat'))
  return screen.findByRole('button', { name: /Spela given igen — övning/ })
}

describe('Tävling — spela given igen (övningsläge)', () => {
  it('övningsomspel skickar INTE in och rör INTE det sparade framsteget', async () => {
    const knapp = await öppnaDetalj()
    // Det sparade framsteget EFTER seed (giv 1 inne) — övningen får inte röra det.
    const före = JSON.stringify(loadTavlingFramsteg())
    fireEvent.click(knapp)

    // Play-stubben har mountats i övningsläge och fyrat sin onResultat.
    expect(await screen.findByText('ÖVNING-1')).toBeInTheDocument()

    // KORREKTHETSKRAVET: ingenting skickades in, framsteget står orört.
    expect(submitMock).not.toHaveBeenCalled()
    expect(JSON.stringify(loadTavlingFramsteg())).toBe(före)
  })

  it('"Tillbaka" ur övningen landar på giv-detaljvyn igen (inte översikten)', async () => {
    fireEvent.click(await öppnaDetalj())
    fireEvent.click(await screen.findByRole('button', { name: 'TILLBAKA-1' }))
    // Detaljvyns rubrik + övningsknappen ska vara tillbaka.
    expect(await screen.findByText('Hela fältets resultat')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Spela given igen — övning/ }),
    ).toBeInTheDocument()
  })
})
