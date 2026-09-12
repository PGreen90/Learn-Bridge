// PROVSPELS-FYND (systemrevisorn 1000 givar, 2026-09-12). Två systemfel ur
// bot-mot-bot-mätningen mot DD-facit. Facit FÖRE fix.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { seatAt, type ResolvedCall } from '../bidding'
import { auctionComplete, decideCall } from './auction-live'
import { dealFromSeed } from './revisor'

const call = (seat: 'N' | 'E' | 'S' | 'W', bid: string): ResolvedCall => ({ seat, bid })

/** Bottarna bjuder given klart ostört; buden i ordning. */
function spelaKlart(deal: Deal): string[] {
  const hist: ResolvedCall[] = []
  while (!auctionComplete(hist) && hist.length < 40) hist.push(decideCall(deal, hist, seatAt(deal.dealer, hist.length)))
  return hist.map((c) => c.bid)
}

// FYND 1 — öppnaren rebjuder sin egen 6-korts HÖGFÄRG före sang efter partnerns
// negativa dubbling. Frö 20260797: 1♥–(2♦)–X–P, öppnaren (Väst) ♠7 ♥AJT865 ♦KQ
// ♣AQJ9 (17 hp, 6 hjärter, singel i partnerns spader). Motorn bjöd 2NT (sang
// med stopp prövades FÖRE 6-korts-återbudet) → dog i 2NT fast 4♥ är kall. En
// 6-korts högfärg ska rebjudas före sang, hoppande med extra (16+).
describe('Fynd 1: 6-korts högfärg rebjuds före sang efter negativ dubbling', () => {
  const HIST = [call('W', '1H'), call('N', '2D'), call('E', 'X'), call('S', 'P')]

  it('frö 20260797: Väst bjuder 3♥ (inte 2NT) med 17 hp och 6 hjärter', () => {
    const deal = dealFromSeed(20260797)
    expect(decideCall(deal, HIST, 'W').bid).toBe('3H')
  })
})

// FYND 2 — inverterad minor: öppnaren rebjuder 2NT UTAN stopp i den objudna
// färgen. Frö 20260955: 1♣–2♣(inv)–2NT, öppnaren (Väst) ♠J5 ♥A87 ♦762 ♣AQJ54 —
// ingen ruterstopp (762). Paret hamnar i 3NT (bet) fast 5♣ är kall. Öppnarens
// 2NT-rebud efter inverterad höjning måste kräva stopp i ALLA objudna färger;
// saknas en stoppar öppnaren i 3♣ (minimum) i stället.
describe('Fynd 2: inverterad minor – 2NT-rebudet kräver stopp i objudna färger', () => {
  const HIST = [call('W', '1C'), call('N', 'P'), call('E', '2C'), call('S', 'P')]

  it('frö 20260955: Väst bjuder INTE 2NT utan ruterstopp', () => {
    const deal = dealFromSeed(20260955)
    expect(decideCall(deal, HIST, 'W').bid).not.toBe('2NT')
  })

  it('frö 20260955: Väst visar hjärterstoppen (2♥), inte falsk 2NT', () => {
    const deal = dealFromSeed(20260955)
    expect(decideCall(deal, HIST, 'W').bid).toBe('2H')
  })

  it('frö 20260955: hela auktionen landar i klöver, inte i 3NT-bet', () => {
    const deal = dealFromSeed(20260955)
    const bud = spelaKlart(deal)
    expect(bud).not.toContain('3NT')
    expect(bud[bud.length - 4]).toBe('3C') // slutkontraktet (följt av tre pass)
  })
})
