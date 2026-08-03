// @vitest-environment jsdom
// Facit för felfångaren (Etapp A ur granskningen 2026-08-02): ett fel i en
// komponent ska ge felskärmen med en "Ladda om"-knapp — inte en tom sida.
// Chunk-fel (trasig lat-laddning efter deploy) ska ladda om automatiskt en gång.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ErrorBoundary, isChunkLoadError } from './ErrorBoundary'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

function Bomb({ message }: { message: string }): never {
  throw new Error(message)
}

// React loggar fångade fel till konsolen — tysta bruset i testet.
function muteConsoleError() {
  vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('felfångaren', () => {
  it('friska barn renderas som vanligt', () => {
    render(
      <ErrorBoundary>
        <p>allt väl</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('allt väl')).toBeInTheDocument()
  })

  it('ett vanligt fel visar felskärmen med Ladda om-knapp och väg hem', () => {
    muteConsoleError()
    render(
      <ErrorBoundary>
        <Bomb message="något oväntat" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: /något gick fel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ladda om/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /till startsidan/i })).toHaveAttribute('href', '#/')
  })

  it('ett chunk-fel laddar om sidan automatiskt — men bara en gång', () => {
    muteConsoleError()
    // jsdom tillåter inte riktig omladdning — byt ut reload mot en spion.
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    })

    render(
      <ErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: /assets/Play-abc123.js" />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('learnbridge:chunk-reloaded')).toBe('1')

    // Samma fel IGEN (omladdningen hjälpte inte) → ingen ny omladdning,
    // felskärmen visas i stället för en evig loop.
    cleanup()
    render(
      <ErrorBoundary>
        <Bomb message="Failed to fetch dynamically imported module: /assets/Play-abc123.js" />
      </ErrorBoundary>,
    )
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: /något gick fel/i })).toBeInTheDocument()

    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })

  it('isChunkLoadError skiljer chunk-fel från vanliga fel', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: x'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 42 failed'))).toBe(true)
    expect(isChunkLoadError(new Error('kortet finns inte i handen'))).toBe(false)
  })
})
