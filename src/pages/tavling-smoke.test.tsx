// @vitest-environment jsdom
// Röktest för TÄVLINGSLÄGET (Beslut B etapp 2, klientfasen): spelskärmen (Play)
// körd med en `tavling`-prop ska (1) visa tävlingsbrickan i stället för
// målväljaren, och (2) vid en klar giv erbjuda "Nästa giv →" som lämnar ett
// resultat till onKlar — aldrig "Ny giv" eller den fria historiken. Frö 705
// passas ut deterministiskt (dealer Syd), vilket ger oss en klar giv snabbt
// utan att spela 13 stick.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Play } from './Play'
import { gameFromSeed } from './play/useGame'
import type { TavlingSpel } from './play/tavling-mode'
import type { GivResultat } from '../lib/backend/tavling'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  window.location.hash = ''
})

async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
}

function boxPassChip(): HTMLButtonElement {
  const chip = screen
    .getAllByRole('button', { name: 'PASS' })
    .find((b) => b.className.includes('h-12'))
  if (!chip) throw new Error('Budlådans PASS-chip saknas')
  return chip as HTMLButtonElement
}

/** Bygg en tävlingsgiv ur ett klientfrö (räcker för UI-flödet — servern levererar
 *  den riktiga given live). onKlar/onÖversikt är spioner testet kan granska. */
function tavlingsSpel(
  seed: number,
  board: number,
  total: number,
  sista: boolean,
  onKlar: (r: GivResultat) => void = () => {},
  onÖversikt: () => void = () => {},
): TavlingSpel {
  const deal = gameFromSeed(seed).deal
  return { giv: { deal, playSeed: 42 }, nummer: 9, board, total, sista, onKlar, onÖversikt }
}

describe('Spela kort — tävlingsläget', () => {
  it('visar tävlingsbrickan i stället för målväljaren', () => {
    render(<Play tavling={tavlingsSpel(705, 3, 12, false)} />)
    // Guldbrickan "Tävling · Giv 3/12" ersätter "Mål:"-knappen.
    expect(screen.getByText(/Tävling · Giv 3\/12/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mål:/ })).not.toBeInTheDocument()
  })

  it('utpassad giv erbjuder "Nästa giv →" och lämnar ett resultat till onKlar', async () => {
    const onKlar = vi.fn()
    const spel = tavlingsSpel(705, 1, 12, false, onKlar)
    // Resultatets board = seriepositionen (tavling.board), inte den slumpade
    // brickan i testfröet. I skarp drift sammanfaller de (server-givar 1..12).
    const board = spel.board
    render(<Play tavling={spel} />)

    // Kör auktionen till utpassning (Syd passar, datorbuden tickar).
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

    // Tävling: "Nästa giv →" i stället för "Ny giv"/"Spela om given".
    expect(screen.getByRole('button', { name: /Nästa giv/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ny giv/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Spela om given' })).not.toBeInTheDocument()

    // Klick → resultatet lämnas till onKlar (utpassad = 0 stick).
    fireEvent.click(screen.getByRole('button', { name: /Nästa giv/ }))
    expect(onKlar).toHaveBeenCalledTimes(1)
    // Två argument: resultatet (för framsteget) + inskicket (för valideringen).
    expect(onKlar).toHaveBeenCalledWith(
      expect.objectContaining({ board, myTricks: 0, headline: 'Given passades ut' }),
      expect.objectContaining({ board, plays: [] }),
    )
  })

  it('sista given säger "Se ställningen →" i stället för "Nästa giv →"', async () => {
    render(<Play tavling={tavlingsSpel(705, 12, 12, true)} />)
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
    expect(screen.getByRole('button', { name: /Se ställningen/ })).toBeInTheDocument()
  })
})
