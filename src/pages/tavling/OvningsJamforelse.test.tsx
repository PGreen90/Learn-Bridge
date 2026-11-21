// @vitest-environment jsdom
// Övningsomspelets fiktiva jämförelse i gränssnittet (ägarönskemål
// 2026-11-21): texterna i resultatdialogens ruta, rutan själv (hämtar fältet)
// och den fiktiva raden "Du (övning)" i givens resultatlista.
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { GivResultatSvar } from '../../lib/backend/tavling'

const givResultatMock = vi.hoisted(() => vi.fn())
vi.mock('../../lib/backend/tavling', async (importActual) => {
  const actual = await importActual<typeof import('../../lib/backend/tavling')>()
  return { ...actual, fetchGivResultat: givResultatMock }
})

import { jamforelseText, OvningsJamforelseRuta } from './OvningsJamforelse'
import { TravellerTabell } from './TavlingDelar'

const K = (level: number, diff: number) => ({ level, strain: 'spades' as const, declarer: 'S' as const, diff })
const FALT: GivResultatSvar = {
  board: 3,
  form: 'mp',
  resultat: [
    { namn: 'Emma03', jag: false, kontrakt: K(4, 1), nsScore: 450, form: 'mp', tal: 100, procent: 100 },
    { namn: 'Lasse68', jag: false, kontrakt: K(4, 0), nsScore: 420, form: 'mp', tal: 50, procent: 50 },
    { namn: 'Gunnar52', jag: false, kontrakt: K(4, 0), nsScore: 420, form: 'mp', tal: 50, procent: 50 },
    { namn: 'Jag', jag: true, kontrakt: K(4, -1), nsScore: -50, form: 'mp', tal: 0, procent: 0 },
  ],
}

afterEach(cleanup)

describe('jamforelseText', () => {
  it('MP: hela procent, skillnaden i procentenheter på de visade talen', () => {
    const t = jamforelseText({ ovning: 83.333, tavling: 30.6, diff: 52.733, andra: 3 }, 'mp')
    expect(t).toEqual({ tavling: '31 %', ovning: '83 %', skillnad: '52 procentenheter bättre', riktning: 'upp' })
  })
  it('MP: sämre, och singular vid en enhet', () => {
    expect(jamforelseText({ ovning: 49, tavling: 50, diff: -1, andra: 3 }, 'guld').skillnad).toBe(
      '1 procentenhet sämre',
    )
  })
  it('IMP: en decimal och tecken', () => {
    const t = jamforelseText({ ovning: 5.5, tavling: -3, diff: 8.5, andra: 2 }, 'imp')
    expect(t).toEqual({ tavling: '−3.0 IMP', ovning: '+5.5 IMP', skillnad: '8.5 IMP bättre', riktning: 'upp' })
  })
  it('samma tal = "Samma resultat"', () => {
    expect(jamforelseText({ ovning: 50, tavling: 50, diff: 0, andra: 3 }, 'mp').skillnad).toBe('Samma resultat')
  })
  it('utan riktigt tal: bara övningens', () => {
    expect(jamforelseText({ ovning: 66.7, tavling: null, diff: null, andra: 3 }, 'mp')).toEqual({
      tavling: null,
      ovning: '67 %',
      skillnad: null,
      riktning: null,
    })
  })
})

describe('OvningsJamforelseRuta', () => {
  beforeEach(() => givResultatMock.mockReset())

  it('visar tävlingen → övningen och skillnaden mot fältet', async () => {
    givResultatMock.mockResolvedValue({ status: 'ok', data: FALT })
    render(<OvningsJamforelseRuta board={3} form="mp" nsScore={450} />)
    const ruta = await screen.findByRole('region', { name: 'Fiktiv jämförelse mot fältet' })
    expect(ruta).toHaveTextContent('Tävlingen 0 %')
    expect(ruta).toHaveTextContent('Övningen 83 %')
    expect(ruta).toHaveTextContent('83 procentenheter bättre')
    expect(ruta).toHaveTextContent('Mot 3 andra spelare')
    expect(givResultatMock).toHaveBeenCalledWith(3, undefined, 'mp')
  })

  it('historiken: hämtar rätt dags fält', async () => {
    givResultatMock.mockResolvedValue({ status: 'ok', data: FALT })
    render(<OvningsJamforelseRuta board={3} dag="2026-11-10" form="mp" nsScore={420} />)
    await screen.findByRole('region', { name: 'Fiktiv jämförelse mot fältet' })
    expect(givResultatMock).toHaveBeenCalledWith(3, '2026-11-10', 'mp')
  })

  it('ritar ingenting när fältet inte går att hämta', async () => {
    givResultatMock.mockResolvedValue({ status: 'fel', fel: 'Inte inloggad.' })
    const { container } = render(<OvningsJamforelseRuta board={3} form="mp" nsScore={450} />)
    await Promise.resolve()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('TravellerTabell — raden "Du (övning)"', () => {
  it('skjuts in på den plats talet hade gett, fältets tal orörda', () => {
    const { container } = render(
      <TravellerTabell data={FALT} onVälj={() => {}} form="mp" övning={{ kontrakt: K(4, 0), nsScore: 420 }} />,
    )
    // 420 mot [450, 420, 420] = 1 av 3 = 33 % → efter 50 %-raderna, före din 0 %.
    // (De klickbara raderna har role="button" → läs raderna ur tbody.)
    const rader = [...container.querySelectorAll<HTMLElement>('tbody tr')]
    expect(rader.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Emma03'),
      expect.stringContaining('Lasse68'),
      expect.stringContaining('Gunnar52'),
      expect.stringContaining('Du (övning)'),
      expect.stringContaining('Jag (du)'),
    ])
    expect(within(rader[3]).getByText('33 %')).toBeInTheDocument()
    expect(within(rader[4]).getByText('0 %')).toBeInTheDocument()
  })

  it('sämst av alla hamnar sist; utan övning ingen rad', () => {
    const { container, unmount } = render(
      <TravellerTabell data={FALT} onVälj={() => {}} form="mp" övning={{ kontrakt: K(4, -3), nsScore: -150 }} />,
    )
    const rader = [...container.querySelectorAll<HTMLElement>('tbody tr')]
    expect(rader).toHaveLength(5)
    expect(rader[rader.length - 1]).toHaveTextContent('Du (övning)')
    unmount()
    render(<TravellerTabell data={FALT} onVälj={() => {}} form="mp" />)
    expect(screen.queryByText('Du (övning)')).not.toBeInTheDocument()
  })
})
