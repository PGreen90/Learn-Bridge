// FACIT — förslag #133 (2026-11-24, Dagens MP% nr 115, giv 10, Öst giv, alla i
// zon): "Förklaringen på 2hj i budgivningen säger att öppnare (jag) ska passa
// med minimum vilket jag har medan motorn tycker att jag ska lägga upp den i
// 4hj."
//     Öst    Syd    Väst   Nord
//     pass   1♥     pass   1NT
//     pass   2♣     pass   2♥        ← tre trumf, exakt 10–11
//     pass   4♥
//   Syd ♠T8 ♥AK986 ♦T3 ♣KQ64: 12 hp, men 15 med fördelning (femte hjärtern,
//   fyrkortsfärgen, två dubbeltoner) — bokens gräns för utgång (§4.1).
// ÄGARBESLUT 2026-11-24 (alternativ A): regeln står kvar, TEXTEN skrivs om.
// "Passar med minimum, utgång med 15+" lästes som hp; nu säger förklaringen
// att gränsen är 15 med fördelning. Hp räknade med kod, summa 40.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCallTraced } from './auction-live'
import { meaningOf } from './auction-meaning'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
const D: Deal = { id: 'forslag-133', board: 10, dealer: 'E', vulnerability: 'all', hands: {
  N: parseHand('S:AKJ6 H:432 D:QJ54 C:97'), E: parseHand('S:Q9542 H:Q D:A982 C:JT8'),
  S: parseHand('S:T8 H:AK986 D:T3 C:KQ64'), W: parseHand('S:73 H:JT75 D:K76 C:A532') } }

describe('Förslag #133 — 2M efter 1M–1NT–2x: gränsen för utgång är 15 MED FÖRDELNING', () => {
  it('hp räknade med kod, summa 40', () => {
    const hp = ORDER.map((s) => hcp(D.hands[s]))
    expect(hp).toEqual([11, 9, 12, 8])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(D.hands[s]).toHaveLength(13)
  })

  it('budförklaringen av 2♥ säger "15+ med fördelning", inte "passar med minimum"', () => {
    const h = H('E', 'P 1H P 1NT P 2C P 2H')
    const m = meaningOf(h, h.length - 1)
    expect(m.text).toMatch(/15\+ med fördelning/)
    expect(m.text).not.toMatch(/passar med minimum/)
  })

  it('Nords eget 2♥ förklaras med samma gräns', () => {
    const t = decideCallTraced(D, H('E', 'P 1H P 1NT P 2C P'), 'N')
    expect(t.call.bid).toBe('2H')
    expect(t.call.explanation).toMatch(/15\+ med fördelning/)
  })

  it('regeln står kvar: Syd (12 hp, 15 med fördelning) bjuder 4♥ och säger varför', () => {
    const t = decideCallTraced(D, H('E', 'P 1H P 1NT P 2C P 2H P'), 'S')
    expect(t.call.bid).toBe('4H')
    expect(t.call.explanation).toMatch(/15\+ med fördelning/)
  })

  it('motvikt: 12 hp utan fördelningsvärden (5-3-3-2) passar 2♥', () => {
    const d: Deal = { ...D, hands: { ...D.hands, S: parseHand('S:T83 H:AK986 D:T3 C:KQ6'), E: parseHand('S:Q954 H:Q D:A982 C:JT84') } }
    const t = decideCallTraced(d, H('E', 'P 1H P 1NT P 2C P 2H P'), 'S')
    expect(t.call.bid).toBe('P')
  })
})
