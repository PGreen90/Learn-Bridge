// Systems on efter ett naturligt 2NT-inkliv över deras svaga tvåa/spärr
// (live-prov etapp 6, 2026-09-11, bricka 12). Efter 2♠–2NT(15–18) är
// advancerns svar Stayman/transfers som över en 2NT-öppning, men med UPPSKJUTNA
// poängtrösklar (inklivet är 15–18, inte 20–21) och en super-accept när
// inklivaren är max. Ägarens spec:
//   Syd:  3♣ Stayman · 3♦→hjärter · 3♥→spader · 3NT till spel · pass svag
//   Nord (fullföljer 3♦): 3♥ = 15–16 (min); 4♥ = 17–18 + 3-korts stöd (super-accept)
//   Syd efter 3♥: pass (~6–8) · 3NT (~9–10, lovar spaderstopp → Nord väljer) · 4♥ (6 hjärter)
// FACIT FÖRE FIX.

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const P = (seat: Seat) => call(seat, 'P')
// NS i zon (som brickan); vul påverkar inte transfers men vi speglar given.
const bud = (hand: string, hist: ResolvedCall[], seat: Seat) =>
  decideFromTable(parseHand(hand), auctionFacts(hist, seat), true)

// 2♠(Väst, svag två) – 2NT(Nord, naturligt 15–18) – P(Öst) – Syd.
const h = [call('W', '2S'), call('N', '2NT'), P('E')]

describe('systems on efter 2NT-inkliv – Syds svar', () => {
  it('bricka 12: Syd (♠J3 ♥QT764 ♦76 ♣KJ94, 7 hp, 5♥) bjuder 3♦ = transfer till hjärter, inte naturlig ruter/pass', () => {
    expect(bud('S:J3 H:QT764 D:76 C:KJ94', h, 'S')!.call.bid).toBe('3D')
  })
  it('Syd med 5 spader (♠QT764 ♥J3 ♦76 ♣KJ94) bjuder 3♥ = transfer till spader', () => {
    expect(bud('S:QT764 H:J3 D:76 C:KJ94', h, 'S')!.call.bid).toBe('3H')
  })
})

describe('systems on efter 2NT-inkliv – Nord fullföljer transfern', () => {
  const h3d = [...h, call('S', '3D'), P('W')]
  it('Nord minimum (♠KQ5 ♥A83 ♦KJ64 ♣Q92, 15 hp, 3♥) fullföljer enkelt 3♥', () => {
    expect(bud('S:KQ5 H:A83 D:KJ64 C:Q92', h3d, 'N')!.call.bid).toBe('3H')
  })
  it('Nord max med 3-korts stöd (♠KQ5 ♥AK3 ♦KJ64 ♣Q92, 18 hp, 3♥) super-accept 4♥', () => {
    expect(bud('S:KQ5 H:AK3 D:KJ64 C:Q92', h3d, 'N')!.call.bid).toBe('4H')
  })
  it('Nord max men bara 2 hjärter (♠KQ5 ♥A3 ♦KJ64 ♣KJ92, 17 hp) fullföljer enkelt 3♥ (ingen super-accept)', () => {
    expect(bud('S:KQ5 H:A3 D:KJ64 C:KJ92', h3d, 'N')!.call.bid).toBe('3H')
  })
})

describe('systems on efter 2NT-inkliv – Syds rebud efter enkel fullföljning 3♥', () => {
  const h3h = [...h, call('S', '3D'), P('W'), call('N', '3H'), P('E')]
  it('svag (bricka 12-handen, 7 hp) passar 3♥ – vinner budgivningen', () => {
    const r = bud('S:J3 H:QT764 D:76 C:KJ94', h3h, 'S')
    expect(r === null || r.call.bid === 'P').toBe(true)
  })
  it('inbjudan (♠KJ3 ♥QT764 ♦Q6 ♣J94, 9 hp, spaderstopp) bjuder 3NT', () => {
    expect(bud('S:KJ3 H:QT764 D:Q6 C:J94', h3h, 'S')!.call.bid).toBe('3NT')
  })
  it('6 hjärter (♠3 ♥QT7642 ♦KQ6 ♣J94, 8 hp) hoppar 4♥', () => {
    expect(bud('S:3 H:QT7642 D:KQ6 C:J94', h3h, 'S')!.call.bid).toBe('4H')
  })
})

describe('systems on efter 2NT-inkliv – tolkning', () => {
  it('meaningOf läser Syds 3♦ som transfer till hjärter, inte naturlig ruter', () => {
    const m = meaningOf([...h, call('S', '3D')], 3)
    expect(m.text.toLowerCase()).toContain('transfer')
    expect(m.text.toLowerCase()).toContain('hjärter')
  })
})
