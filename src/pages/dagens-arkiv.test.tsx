// @vitest-environment jsdom
// Facit för kalenderarkivet (granskningsputsen 2026-08-03): spelade dagar visar
// resultatet ur loggen, missade dagar är spelbara i efterhand via ?dag=N, och
// framtida dagar är låsta (morgondagens giv förblir en överraskning).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import { DagensArkiv } from './DagensArkiv'
import App from '../App'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  window.location.hash = ''
})

// Fryst "i dag": 5 augusti 2026 = giv #4 (premiären 2 aug = #1).
const NOW = new Date(2026, 7, 5)

describe('kalenderarkivet', () => {
  it('spelade dagar visar resultatet, missade är spelbara, framtiden är låst', () => {
    localStorage.setItem(
      'learnbridge:daily-log',
      JSON.stringify({ 1: { myTricks: 8 }, 3: { myTricks: 5, late: true } }),
    )
    render(
      <MemoryRouter>
        <DagensArkiv now={NOW} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /kalenderarkivet/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /augusti 2026/i })).toBeInTheDocument()

    // Spelad dag (#1 = 2 aug): resultatet syns och länken pekar på rätt giv.
    const played = screen.getByTitle(/Giv #1 — 8 av 13 stick/)
    expect(played).toHaveAttribute('href', '/spela-kort/dagens?dag=1')
    // Efterhandsspelet (#3) är märkt som spelat i efterhand.
    expect(screen.getByTitle(/Giv #3 — 5 av 13 stick \(spelad i efterhand\)/)).toBeInTheDocument()
    // Missad dag (#2) är spelbar i efterhand.
    expect(screen.getByTitle('Giv #2 — ospelad')).toHaveAttribute('href', '/spela-kort/dagens?dag=2')
    // Framtida dagar (6 aug = #5 och framåt) är inga länkar — ingen förtitt.
    expect(screen.queryByTitle(/Giv #5/)).not.toBeInTheDocument()
  })

  it('bläddringen är klampad till premiärmånaden och nuvarande månad', () => {
    render(
      <MemoryRouter>
        <DagensArkiv now={NOW} />
      </MemoryRouter>,
    )
    // Augusti 2026 är både premiärmånad och "nu" → båda pilarna låsta.
    expect(screen.getByRole('button', { name: /föregående månad/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /nästa månad/i })).toBeDisabled()
  })

  it('rutten #/spela-kort/dagens/arkiv visar arkivsidan', async () => {
    window.location.hash = '#/spela-kort/dagens/arkiv'
    render(<App />)
    // Sidan laddas lat (kod-uppdelning) → invänta chunken.
    expect(
      await screen.findByRole('heading', { name: /kalenderarkivet/i }, { timeout: 10_000 }),
    ).toBeInTheDocument()
  })
})
