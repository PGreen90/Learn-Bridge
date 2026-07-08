// @vitest-environment jsdom
// Röktest (UI-overhaul steg 5) för den DELADE dialogen/klick-utanför-ytan
// (steg 2). Vaktar kontraktet alla overlays bygger på: onClose satt → klick
// utanför OCH Escape stänger; klick INUTI kortet stänger aldrig; utan onClose
// stänger varken klick eller Escape.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ClickAway, Dialog } from './Dialog'

afterEach(cleanup)

describe('Dialog (delad modal)', () => {
  it('visar innehållet i ett panelkort', () => {
    render(<Dialog onClose={() => {}}>Hej dialog</Dialog>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hej dialog')).toBeInTheDocument()
  })

  it('klick på backdropen stänger, klick i kortet gör det inte', () => {
    const onClose = vi.fn()
    render(<Dialog onClose={onClose}>Innehåll</Dialog>)
    fireEvent.click(screen.getByText('Innehåll')) // i kortet
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog')) // backdropen
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape stänger när onClose är satt', () => {
    const onClose = vi.fn()
    render(<Dialog onClose={onClose}>Innehåll</Dialog>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('utan onClose stänger varken backdrop-klick eller Escape (inget kraschar)', () => {
    render(<Dialog>Skyddat innehåll</Dialog>)
    fireEvent.click(screen.getByRole('dialog'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('Skyddat innehåll')).toBeInTheDocument()
  })
})

describe('ClickAway (klick utanför meny)', () => {
  it('klick på ytan anropar onClose', () => {
    const onClose = vi.fn()
    render(<ClickAway onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { hidden: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
