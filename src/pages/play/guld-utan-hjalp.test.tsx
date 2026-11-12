// Facit för "ingen budhjälp" i Veckans stjärntävling (ägarbeslut 2026-11-11):
// även den som har budstöd PÅSLAGET får varken motorns rekommendation eller
// reglaget i guld-tävlingen — men budens betydelse visas när man trycker på dem.

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { seatToAct } from '../../lib/engine/auction-live'
import { BiddingPhase } from './BiddingPhase'
import { gameFromSeed, type Game } from './useGame'
import type { TavlingSpel } from './tavling-mode'

afterEach(cleanup)

/** En giv där Syd är giv (det är din tur direkt). */
function sydsTur(): Game {
  for (let fro = 1; fro < 400; fro++) {
    const g = gameFromSeed(fro)
    if (seatToAct(g.deal.dealer, 0) === 'S') return g
  }
  throw new Error('hittade ingen giv med Syd som giv')
}

const tavling = (form: TavlingSpel['form']): TavlingSpel =>
  ({ form, nummer: 1, board: 1, total: 12, sista: false, onResultat: () => {}, onNästa: () => {}, onÖversikt: () => {} }) as unknown as TavlingSpel

function visa(form: TavlingSpel['form']) {
  const game = sydsTur()
  render(
    <BiddingPhase
      game={game}
      complete={false}
      onBid={() => {}}
      onConfirm={() => {}}
      onNewGame={() => {}}
      onPlayAgain={() => {}}
      targetLabel=""
      onOpenPicker={() => {}}
      bidHelp
      onToggleBidHelp={() => {}}
      tavling={tavling(form)}
    />,
  )
}

/** Budlådans chip för ett bud (inte auktionsrutans). */
const lada = (namn: RegExp) => screen.getAllByRole('button', { name: namn }).filter((b) => !(b as HTMLButtonElement).disabled)

describe('budfasen i guld-tävlingen', () => {
  it('ingen rekommendation, trots att budstödet är påslaget', () => {
    visa('guld')
    expect(screen.queryByTitle('Motorns rekommenderade bud')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Resonemangslagrets bud')).not.toBeInTheDocument()
  })

  it('ett valt bud förklaras — men utan "Motorn hade valt"', () => {
    visa('guld')
    fireEvent.click(lada(/^1NT$/)[0])
    // Betydelseraden under budlådan finns …
    expect(document.querySelector('p.px-1')?.textContent ?? '').not.toBe('')
    // … men den avslöjar aldrig vad motorn hade bjudit.
    expect(screen.queryByText(/Motorn hade valt/)).not.toBeInTheDocument()
    expect(screen.queryByText('MOTORNS BUD')).not.toBeInTheDocument()
  })

  it('reglaget för budstöd finns inte i menyn', () => {
    visa('guld')
    fireEvent.click(screen.getByRole('button', { name: /meny/i }))
    expect(screen.queryByText('Budstöd')).not.toBeInTheDocument()
  })

  it('i Dagens MP% är allt som förr: rekommendationen visas och reglaget finns', () => {
    visa('mp')
    expect(screen.queryByTitle('Motorns rekommenderade bud')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /meny/i }))
    expect(screen.getByText('Budstöd')).toBeInTheDocument()
  })
})
