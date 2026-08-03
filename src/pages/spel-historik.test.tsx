// @vitest-environment jsdom
// Facit för frispelets resultathistorik-sida (granskningsputsen 2026-08-03):
// bokförda givar listas med resultat och en "Spela om"-länk som bär fröet;
// korrupt sparning ger tomläget i stället för en krasch.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { SpelHistorik } from './SpelHistorik'
import App from '../App'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  window.location.hash = ''
})

const ENTRIES = [
  {
    seed: 42,
    when: new Date(2026, 7, 3, 14, 2).getTime(),
    bid: '4S',
    doubled: '',
    declarer: 'S',
    myTricks: 10,
    win: true,
    headline: 'Hemgång!',
    scoreLabel: 'NS +420',
  },
  {
    seed: 7,
    when: new Date(2026, 7, 2, 20, 30).getTime(),
    bid: '3NT',
    doubled: 'X',
    declarer: 'W',
    myTricks: 5,
    win: false,
    headline: 'De gick hem',
    scoreLabel: 'ÖV +550',
  },
]

describe('frispelets resultathistorik', () => {
  it('listar bokförda givar med resultat och omspelslänk med fröet', () => {
    localStorage.setItem('learnbridge:spel-historik', JSON.stringify(ENTRIES))
    render(
      <MemoryRouter>
        <SpelHistorik />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /dina senaste givar/i })).toBeInTheDocument()
    expect(screen.getByText('Hemgång!')).toBeInTheDocument()
    expect(screen.getByText('De gick hem')).toBeInTheDocument()
    // Omspelslänken bär fröet — samma kort igen, exakt.
    const links = screen.getAllByRole('link', { name: /spela om/i })
    expect(links[0]).toHaveAttribute('href', '/spela-kort?giv=42')
    expect(links[1]).toHaveAttribute('href', '/spela-kort?giv=7')
  })

  it('korrupt sparning ger tomläget, ingen krasch', () => {
    localStorage.setItem('learnbridge:spel-historik', JSON.stringify({ inte: 'en lista' }))
    render(
      <MemoryRouter>
        <SpelHistorik />
      </MemoryRouter>,
    )
    expect(screen.getByText(/inga spelade givar ännu/i)).toBeInTheDocument()
  })

  it('rutten #/spela-kort/historik visar sidan', async () => {
    window.location.hash = '#/spela-kort/historik'
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: /dina senaste givar/i }, { timeout: 10_000 }),
    ).toBeInTheDocument()
  })
})
