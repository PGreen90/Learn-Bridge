// @vitest-environment jsdom
// Röktest (UI-overhaul steg 5) för budlådan: två-stegsvalet (klick väljer,
// OK bekräftar), att otillåtna bud är avstängda och att motorns
// rekommendation markeras med sin äkta förklaring.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { BiddingBox } from './BiddingBox'

afterEach(cleanup)

describe('BiddingBox', () => {
  it('otillåtna bud är avstängda, tillåtna klickbara', () => {
    render(<BiddingBox legal={['P', '1C']} onBid={() => {}} />)
    expect(screen.getByRole('button', { name: '1♣' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '1♥' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled()
  })

  it('OK är avstängd tills ett bud valts; klick + OK skickar budet', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={['P', '1C']} onBid={onBid} />)
    const ok = screen.getByRole('button', { name: 'OK' })
    expect(ok).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '1♣' }))
    expect(ok).toBeEnabled()
    fireEvent.click(ok)
    expect(onBid).toHaveBeenCalledWith('1C')
  })

  it('andra trycket på samma bud bekräftar det (två tryck = OK)', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={['P', '1C']} onBid={onBid} />)
    const chip = screen.getByRole('button', { name: '1♣' })
    fireEvent.click(chip) // tryck 1: väljer
    fireEvent.click(chip) // tryck 2: bekräftar
    expect(onBid).toHaveBeenCalledWith('1C')
  })

  it('motorns rekommendation får märket MOTORNS BUD + sin äkta förklaring', () => {
    render(
      <BiddingBox
        legal={['P', '1C']}
        onBid={() => {}}
        recommendation={{ seat: 'S', bid: '1C', rule: 'öppning', explanation: 'Testförklaringen.' }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '1♣' }))
    expect(screen.getByText('MOTORNS BUD')).toBeInTheDocument()
    expect(screen.getByText(/Testförklaringen/)).toBeInTheDocument()
  })

  it('ett eget bud (ej rekommendationen) får en tolkad förklaring — aldrig tomt', () => {
    render(
      <BiddingBox
        legal={['P', '1C', '1H']}
        onBid={() => {}}
        recommendation={{ seat: 'S', bid: '1C', rule: 'öppning', explanation: 'Testförklaringen.' }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '1♥' }))
    // Tolkningsraden finns och visar dessutom vad motorn hade valt.
    expect(screen.queryByText('MOTORNS BUD')).not.toBeInTheDocument()
    expect(screen.getByText(/Motorn hade valt/)).toBeInTheDocument()
  })

  // Budstöd AV (ägarbeslut 2026-07-28): ALL hjälp döljs — pricken, motorns
  // förklaring och "Motorn hade valt". Man bjuder helt utan facit.
  it('showHelp av: pricken, MOTORNS BUD och förklaringen döljs', () => {
    render(
      <BiddingBox
        legal={['P', '1C']}
        onBid={() => {}}
        recommendation={{ seat: 'S', bid: '1C', rule: 'öppning', explanation: 'Testförklaringen.' }}
        showHelp={false}
      />,
    )
    expect(screen.queryByTitle('Motorns rekommenderade bud')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1♣' }))
    expect(screen.queryByText('MOTORNS BUD')).not.toBeInTheDocument()
    expect(screen.queryByText(/Testförklaringen/)).not.toBeInTheDocument()
  })

  it('showHelp av: "Motorn hade valt" visas inte vid eget bud', () => {
    render(
      <BiddingBox
        legal={['P', '1C', '1H']}
        onBid={() => {}}
        recommendation={{ seat: 'S', bid: '1C', rule: 'öppning', explanation: 'Testförklaringen.' }}
        showHelp={false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '1♥' }))
    expect(screen.queryByText(/Motorn hade valt/)).not.toBeInTheDocument()
  })
})
