// @vitest-environment jsdom
// Nyhetslistan bakom versionsnumret (ägarönskan 2026-11-17): bara SENASTE
// uppdateringen står utfälld — äldre är rubrikrader som fälls ut en i taget.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NYHETER } from '../lib/nyheter'
import { VersionsKnapp } from './Nyheter'

afterEach(cleanup)

const [senaste, förra, ...äldre] = NYHETER

function öppna() {
  render(<VersionsKnapp version={senaste.version} />)
  fireEvent.click(screen.getByRole('button', { name: /visa nyheter/ }))
}

describe('nyhetslistan: en uppdatering utfälld i taget', () => {
  it('visar bara senaste uppdateringens text — äldre är stängda rubrikrader', () => {
    öppna()
    expect(screen.getByText(senaste.punkter[0].text)).toBeTruthy()
    expect(screen.queryByText(förra.punkter[0].text)).toBeNull()
    // Varje version har sin rubrikrad, och bara den senaste är utfälld.
    for (const n of NYHETER) {
      const rad = screen.getByRole('button', { name: new RegExp(`Uppdatering v${n.version.replace(/\./g, '\\.')}$`) })
      expect(rad.getAttribute('aria-expanded')).toBe(n === senaste ? 'true' : 'false')
    }
  })

  it('tryck på en äldre fäller ut den och stänger den som var öppen', () => {
    öppna()
    fireEvent.click(screen.getByRole('button', { name: `Uppdatering v${förra.version}` }))
    expect(screen.getByText(förra.punkter[0].text)).toBeTruthy()
    expect(screen.queryByText(senaste.punkter[0].text)).toBeNull()
    if (äldre[0]) expect(screen.queryByText(äldre[0].punkter[0].text)).toBeNull()
  })

  it('tryck på den öppna fäller ihop den', () => {
    öppna()
    fireEvent.click(screen.getByRole('button', { name: `Uppdatering v${senaste.version}` }))
    expect(screen.queryByText(senaste.punkter[0].text)).toBeNull()
  })
})
