// @vitest-environment jsdom
// Facit för 404-sidan (konkurrensplanen Fas 0 c): en adress som INTE finns i
// route-tabellen ska landa på NotFound-sidan med en väg hem — inte på en tom
// sida. Testet renderar hela <App/> (den riktiga HashRouter-tabellen) och pekar
// hashen på en påhittad adress, så det vaktar den faktiska routen, inte bara
// komponenten.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../App'

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('404 — okänd adress', () => {
  it('en adress utanför tabellen visar NotFound med en länk hem', async () => {
    window.location.hash = '#/en-adress-som-inte-finns'
    render(<App />)

    // Sidorna laddas lat (kod-uppdelning) → invänta att 404-chunken löser sig.
    // Sidan säger att adressen inte finns …
    expect(await screen.findByRole('heading', { name: /hittades inte/i })).toBeInTheDocument()
    // … och erbjuder en väg tillbaka till startsidan.
    const home = screen.getByRole('link', { name: /till start/i })
    expect(home).toHaveAttribute('href', '#/')
  })

  it('en riktig adress visar INTE 404-sidan', async () => {
    window.location.hash = '#/budtraning'
    render(<App />)
    // Vänta in att den riktiga sidan (Budträning) laddat, kolla sedan att
    // 404-rubriken aldrig dök upp. Budträning är en liten lat-chunk (~2 kB) och
    // vald med flit: Budsystem-boken (345 kB) laddar för långsamt i jsdom när
    // hela sviten kör parallellt (CPU-svält, se vite.config.ts) → falsk timeout.
    // Generös timeout för säkerhets skull — testet vaktar routen, inte farten.
    await screen.findByRole('heading', { name: /budträning/i }, { timeout: 10_000 })
    expect(screen.queryByRole('heading', { name: /hittades inte/i })).not.toBeInTheDocument()
  })
})
