// Felrapport #30: när VÅR MINOR-öppning höjs i en STÖRD auktion föll en stark
// jämn hand igenom till ett tyst naturligt färgbud och blev passad (Väst nådde
// bara 2♥ med 19 hp jämnt). FACIT FÖRE FIX.
//
// Ägarbeslut 2026-07-06: (1) en jämn "bra 19" (startpoäng ≥20) uppgraderar sin
// ÖPPNING till 2NT (se openings.test.ts); (2) öppnaren visar annars styrkan i
// sang i rond 2 — 3NT med 20+, 2NT-inbjudan med 18–19 — och höjaren accepterar
// inbjudan till 3NT med ett maximum.
//
// Testar via decideCall (integration) → bevisar också att verktyget NÅS live.
import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

// Syd öppnar 1♦, Väst kliver in 1♠, Nord höjer 2♦, Öst passar → Syd (öppnaren) i rond 2.
const H = [call('S', '1D'), call('W', '1S'), call('N', '2D'), call('E', 'P')]
// Fyllnadshänder för de icke-agerande platserna (decideCall läser bara Syds hand här).
const FILL = { N: 'S:T5 H:A83 D:JT84 C:K964', W: 'S:AJ976 H:T5 D:Q3 C:Q752', E: 'S:832 H:J9764 D:765 C:AT', S: 'S:KQ4 H:KQ2 D:AK92 C:J83' }

describe('Öppnarens rond-2 när vår minor höjts i konkurrens (felrapport #30)', () => {
  it('18 hp jämn med stopp i deras färg → 2NT (inbjudan)', () => {
    const deal = dealOf('S', { ...FILL, S: 'S:KQ4 H:KQ2 D:AK92 C:J83' }) // 18 hp, spaderstopp
    expect(decideCall(deal, H, 'S').bid).toBe('2NT')
  })

  it('20 hp (fördelning, 6-korts ruter) med stopp → 3NT (utgång)', () => {
    const deal = dealOf('S', { ...FILL, S: 'S:KQ H:A4 D:AKJ962 C:K3' }) // 20 hp, spaderstopp, 6 ruter
    expect(decideCall(deal, H, 'S').bid).toBe('3NT')
  })

  it('minimum (14 hp) → visar INTE sang (faller igenom, ej 2NT/3NT)', () => {
    const deal = dealOf('S', { ...FILL, S: 'S:K4 H:K32 D:AQ952 C:Q83' }) // 14 hp
    const bid = decideCall(deal, H, 'S').bid
    expect(bid).not.toBe('2NT')
    expect(bid).not.toBe('3NT')
  })

  it('stark hand UTAN stopp i deras färg → ingen sang-visning (ej 2NT/3NT)', () => {
    const deal = dealOf('S', { ...FILL, S: 'S:43 H:KQ2 D:AKJ92 C:AQ3' }) // 19 hp men ♠43 (ingen stopp)
    const bid = decideCall(deal, H, 'S').bid
    expect(bid).not.toBe('2NT')
    expect(bid).not.toBe('3NT')
  })
})

// Höjaren svarar öppnarens 2NT-inbjudan: Syd 1♦, Väst 1♠, Nord 2♦, Öst P,
// Syd 2NT, Väst P → Nord (höjaren) dömer.
const HR = [...H, call('S', '2NT'), call('W', 'P')]

describe('Höjaren svarar öppnarens 2NT-inbjudan (felrapport #30)', () => {
  it('maximum av höjningen (8 hp) → accepterar 3NT', () => {
    const deal = dealOf('S', { ...FILL, N: 'S:T5 H:A83 D:JT84 C:K964' }) // 8 hp
    expect(decideCall(deal, HR, 'N').bid).toBe('3NT')
  })

  it('minimum av höjningen (6 hp) → avböjer (pass)', () => {
    const deal = dealOf('S', { ...FILL, N: 'S:T5 H:Q83 D:QJ84 C:J964' }) // 6 hp
    expect(decideCall(deal, HR, 'N').bid).toBe('P')
  })
})
