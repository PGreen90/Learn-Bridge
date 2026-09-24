// @vitest-environment jsdom
// Regressionsfacit (2026-09-24, tävling #54 giv 4): en giv som först avvisades och
// sedan godkändes i efterhand (rättad i databasen) ska visa serverns MP% — inte ✗.
// Telefonens sparade "avvisad"-lapp får inte vinna över serverns besked.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { GivResultat, TopplistaResultat } from '../../lib/backend/tavling'
import { Resultattabell } from './TavlingDelar'

const giv = (inskickStatus: GivResultat['inskickStatus']): GivResultat =>
  ({ board: 4, myTricks: 10, win: true, headline: '', scoreLabel: null, inskickStatus }) as GivResultat

const topplista = (dinaGivar: { board: number; procent: number }[]): TopplistaResultat =>
  ({ status: 'ok', data: { topplista: [], du: null, dinaGivar, dinaInskick: [] } }) as unknown as TopplistaResultat

describe('Resultattabell — serverns MP% vinner över en gammal avvisad-lapp', () => {
  afterEach(cleanup)
  it('avvisad lokalt men poängsatt på servern → procenten visas', () => {
    render(<Resultattabell klara={[giv('avvisad')]} topplista={topplista([{ board: 4, procent: 55 }])} onÖppna={() => {}} />)
    expect(screen.getByText('55 %')).toBeTruthy()
    expect(screen.queryByText('✗')).toBeNull()
  })

  it('avvisad och ingen MP% på servern → ✗ som förut', () => {
    render(<Resultattabell klara={[giv('avvisad')]} topplista={topplista([])} onÖppna={() => {}} />)
    expect(screen.getByText('✗')).toBeTruthy()
  })
})
