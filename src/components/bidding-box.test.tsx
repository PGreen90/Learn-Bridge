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

  it('ett valt bud kan väljas bort igen (toggle) → OK stängs av', () => {
    render(<BiddingBox legal={['P', '1C']} onBid={() => {}} />)
    const chip = screen.getByRole('button', { name: '1♣' })
    fireEvent.click(chip)
    fireEvent.click(chip)
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled()
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
})
