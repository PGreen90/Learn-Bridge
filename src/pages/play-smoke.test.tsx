// @vitest-environment jsdom
// Röktest (UI-overhaul steg 5) för NYCKELFLÖDET Spela kort: budfasen ritas,
// Syd kan lägga bud via budlådan (klick + OK), datorbuden tickar in på sina
// timers och auktionen landar ANTINGEN i kontraktsbekräftelsen (→ spelbordet
// ritas) ELLER i "passades ut"-dialogen. Given är slumpad — testet vaktar
// flödet, inte ett visst kontrakt. Bottarnas KORTSPEL startas inte (vi rör
// inga timers efter bekräftelsen), så testet är snabbt och deterministiskt.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Play } from './Play'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Låt datorbuden (700 ms-timern) ticka fram ett steg. */
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
}

/** Budlådans PASS-chip (h-10-rutan) — INTE auktionsrutnätets PASS-chips. */
function boxPassChip(): HTMLButtonElement {
  const chip = screen
    .getAllByRole('button', { name: 'PASS' })
    .find((b) => b.className.includes('h-10'))
  if (!chip) throw new Error('Budlådans PASS-chip saknas')
  return chip as HTMLButtonElement
}

describe('Spela kort — nyckelflödet budgivning → kortspel', () => {
  it('budfas → Syd passar → auktionen avslutas → spelbord eller utpassad giv', async () => {
    render(<Play />)

    // Budfasen ritas: budlådan (OK-knappen), auktionsplattan och målväljaren.
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mål:/ })).toBeInTheDocument()

    // Kör auktionen till slut: Syd passar varje gång det är Syds tur,
    // annars får datorns budtimer ticka. (Taket 60 varv räcker med marginal —
    // en auktion är sällan över ~20 bud.)
    let ended = false
    for (let i = 0; i < 60 && !ended; i++) {
      if (screen.queryByText('Bekräfta') || screen.queryByText(/passades ut/)) {
        ended = true
        break
      }
      const pass = boxPassChip()
      if (!pass.disabled) {
        fireEvent.click(pass) // välj PASS …
        fireEvent.click(screen.getByRole('button', { name: 'OK' })) // … och bekräfta
      } else {
        await tick() // datorns tur
      }
    }
    expect(ended).toBe(true)

    if (screen.queryByText(/passades ut/)) {
      // Alla passade: dialogen erbjuder en ny giv.
      expect(screen.getByRole('button', { name: /Ny giv/ })).toBeInTheDocument()
      return
    }

    // Kontrakt bjudet: bekräfta → spelbordet ritas (ställningslisten + Facit).
    fireEvent.click(screen.getByText('Bekräfta'))
    expect(screen.getByText(/NS:0 ÖV:0/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Facit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Budgivningen' })).toBeInTheDocument()
  })
})
