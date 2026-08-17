// @vitest-environment jsdom
// Facit för dukens toner (etapp 4A): den gröna klubbduken är orörd standard,
// och den vinröda vänner-duken (ägarbeslut 2026-08-17) väljs bara via
// tone-propen — allt befintligt (spel, budträning, budvisning, omspelning)
// renderar utan tone och ska därför förbli exakt som förut.

import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Felt, FELT_TONER } from './Felt'

describe('Felt-tonerna', () => {
  test('klubbduken är grön och vänner-duken vinröd (färgstoppen ligger fast)', () => {
    expect(FELT_TONER.club.bakgrund).toContain('#178a66')
    expect(FELT_TONER.club.bakgrund).toContain('#0a4438')
    expect(FELT_TONER.vanner.bakgrund).toContain('#8a2b3a')
    expect(FELT_TONER.vanner.bakgrund).toContain('#451724')
    // Samma ljusstruktur i båda: väv-brus + radialgradient med ljusare centrum.
    expect(FELT_TONER.vanner.bakgrund).toContain('radial-gradient(ellipse at 50% 32%')
    expect(FELT_TONER.vanner.bakgrund).toContain('feTurbulence')
  })

  test('utan tone renderas den gröna ramen (standard = club, inget befintligt ändras)', () => {
    const { container } = render(<Felt>hej</Felt>)
    const duk = container.firstElementChild as HTMLElement
    expect(duk.className).toContain('border-emerald-950/40')
    expect(duk.className).not.toContain('border-red-950/40')
  })

  test('tone="vanner" renderas med den vinröda ramen', () => {
    const { container } = render(<Felt tone="vanner">hej</Felt>)
    const duk = container.firstElementChild as HTMLElement
    expect(duk.className).toContain('border-red-950/40')
    expect(duk.className).not.toContain('border-emerald-950/40')
  })
})
