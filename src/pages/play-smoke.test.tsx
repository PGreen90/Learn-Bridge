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
  localStorage.clear()
  window.location.hash = ''
})

/** Låt datorbuden (700 ms-timern) ticka fram ett steg. */
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
}

/** Budlådans PASS-chip (h-12-rutan) — INTE auktionsrutnätets PASS-chips.
 *  (Budknapparna förstorades 40 → 48 px = h-12 i faceliften 2026-07-31.) */
function boxPassChip(): HTMLButtonElement {
  const chip = screen
    .getAllByRole('button', { name: 'PASS' })
    .find((b) => b.className.includes('h-12'))
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

  // Rundpass (ägarönskemål 2026-08-03): när given passas ut ska "Spela om
  // given" finnas där bredvid "Ny giv" — så man kan testa samma giv igen (t.ex.
  // öppna budgivningen själv). Frö 705 passas ut deterministiskt (dealer Syd).
  it('rundpass: "Spela om given" finns och startar om samma giv', async () => {
    window.location.hash = '#/spela-kort?giv=705'
    render(<Play />)

    // Kör auktionen till slut — Syd passar, datorbuden tickar. Given passas ut.
    let ended = false
    for (let i = 0; i < 60 && !ended; i++) {
      if (screen.queryByText(/passades ut/)) {
        ended = true
        break
      }
      const pass = boxPassChip()
      if (!pass.disabled) {
        fireEvent.click(pass)
        fireEvent.click(screen.getByRole('button', { name: 'OK' }))
      } else {
        await tick()
      }
    }
    expect(screen.getByText(/passades ut/)).toBeInTheDocument()

    // BÅDE omspel OCH ny giv erbjuds nu (förr fanns bara "Ny giv").
    expect(screen.getByRole('button', { name: 'Spela om given' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ny giv/ })).toBeInTheDocument()

    // Klick på "Spela om given" → samma giv från början: budfasen igen
    // (OK-knappen synlig) och passades-ut-dialogen är borta.
    fireEvent.click(screen.getByRole('button', { name: 'Spela om given' }))
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.queryByText(/passades ut/)).not.toBeInTheDocument()
  })

  // Budstöd-toggeln (ägarbeslut 2026-07-28): sitter i ⋮-menyn, sparas i
  // localStorage och överlever en omladdning (ny render).
  it('Budstöd kan stängas av i ⋮-menyn och valet minns', () => {
    render(<Play />)
    fireEvent.click(screen.getByRole('button', { name: 'Meny' }))
    const toggle = screen.getByRole('button', { name: 'Budstöd' })
    expect(toggle).toHaveTextContent('På')
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('Av')
    expect(localStorage.getItem('learnbridge:bidHelp')).toBe('false')

    // "Omladdad sida": ny render läser valet ur lagringen.
    cleanup()
    render(<Play />)
    fireEvent.click(screen.getByRole('button', { name: 'Meny' }))
    expect(screen.getByRole('button', { name: 'Budstöd' })).toHaveTextContent('Av')
  })
})
