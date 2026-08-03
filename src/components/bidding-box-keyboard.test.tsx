// @vitest-environment jsdom
// Facit för budlådans tangentbordsstyrning (granskningsputsen 2026-08-03,
// fynd #21: "tangentbord på desktop saknas helt"): siffra + färgbokstav väljer
// budet, Enter bekräftar (samma två-stegsflöde som klicken), P = pass,
// X = dubbelt, Esc rensar. Otillåtna bud och motståndarnas tur ignoreras.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { BiddingBox } from './BiddingBox'

afterEach(() => cleanup())

const LEGAL = ['1C', '1D', '1H', '1S', '1NT', '2C', 'P']

function press(key: string) {
  fireEvent.keyDown(window, { key })
}

describe('budlådans tangentbord', () => {
  it('siffra + färgbokstav väljer budet, Enter bekräftar', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={LEGAL} onBid={onBid} />)
    press('1')
    press('s')
    expect(onBid).not.toHaveBeenCalled() // först bara markerat — som ett klick
    press('Enter')
    expect(onBid).toHaveBeenCalledExactlyOnceWith('1S')
  })

  it('N = sang, R = ruter, K = klöver (svenska bokstäver)', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={LEGAL} onBid={onBid} />)
    press('1')
    press('n')
    press('Enter')
    expect(onBid).toHaveBeenCalledExactlyOnceWith('1NT')
    press('2')
    press('k')
    press('Enter')
    expect(onBid).toHaveBeenLastCalledWith('2C')
  })

  it('samma bud två gånger bekräftar direkt — som två tryck på chipet', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={LEGAL} onBid={onBid} />)
    press('1')
    press('h')
    press('1')
    press('h')
    expect(onBid).toHaveBeenCalledExactlyOnceWith('1H')
  })

  it('P väljer pass; Esc rensar ett val', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={LEGAL} onBid={onBid} />)
    press('1')
    press('s')
    press('Escape') // ångrat …
    press('Enter')
    expect(onBid).not.toHaveBeenCalled() // … så Enter har inget att bekräfta
    press('p')
    press('Enter')
    expect(onBid).toHaveBeenCalledExactlyOnceWith('P')
  })

  it('otillåtna bud ignoreras', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={LEGAL} onBid={onBid} />)
    press('7')
    press('n') // 7NT är inte lagligt här
    press('Enter')
    expect(onBid).not.toHaveBeenCalled()
  })

  it('inte din tur (ingen laglig lista) → tangenterna gör ingenting', () => {
    const onBid = vi.fn()
    render(<BiddingBox legal={[]} onBid={onBid} />)
    press('1')
    press('s')
    press('Enter')
    expect(onBid).not.toHaveBeenCalled()
  })
})
