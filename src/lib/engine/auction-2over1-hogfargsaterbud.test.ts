import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { responderRebidIn2over1Auction } from './responder-rebids'
import { botAuction } from './revisor'

// =============================================================================
// SVARARENS ÅTERBUD EFTER 2♣ GF: VISA HÖGFÄRGEN (facit FÖRE fix).
//
// 2/1-regeln 2026-08-06 (§4.2): utgångskravshand med 5-korts klöver + 4-korts
// högfärg bjuder 2♣ över 1♦ FÖRE högfärgen. §9-posten lovade: "Svararens
// ÅTERBUD efter 2♣ (visa högfärgen) tas separat" — det infrias här.
// `responderRebidIn2over1Auction` hade ingen gren som visar en egen 4-korts
// högfärg: handen gick rakt på 3NT (eller preferens) och 4-4-fiten begravdes.
//
// Ny gren: egen 4-korts högfärg bjuds naturligt under 3NT (GF). Prioritet
// (ägarbeslut 2026-08-07): det FÖRSENADE STÖDET i öppnarens högfärg går före
// (känd 5-3-fit slår hypotetisk 4-4), högfärgsvisningen före 3NT.
// =============================================================================

const rebid2D = { call: '2D', rule: 'rebid: egen färg (GF)', explanation: '' }

describe('svararens återbud i 2/1 GF – egen 4-korts högfärg', () => {
  it('1♦–2♣–2♦: 5♣ + 4♠ visar spadern (2♠, GF), inte 3NT/preferens', () => {
    const r = responderRebidIn2over1Auction(parseHand('S:AQ52 H:K3 D:72 C:AKJ52'), 'diamonds', 'clubs', rebid2D)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('2S')
  })

  it('1♦–2♣–2♦: 5♣ + 4♥ visar hjärtern (2♥)', () => {
    const r = responderRebidIn2over1Auction(parseHand('S:K3 H:AQ52 D:72 C:AKJ52'), 'diamonds', 'clubs', rebid2D)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('2H')
  })

  it('prioritet: försenat stöd i öppnarens högfärg går FÖRE egen 4-korts högfärg', () => {
    // 1♠–2♣–2♦ med 3-korts spaderstöd + 4 hjärter → stödet (fast arrival 4♠).
    const r = responderRebidIn2over1Auction(parseHand('S:A32 H:QJ42 D:72 C:KQJ52'), 'spades', 'clubs', rebid2D)
    expect(r).not.toBeNull()
    expect(r!.call).toBe('4S')
  })
})

describe('kanoniska linjen: 1♦–2♣–2♦–2♠ når rätt utgång', () => {
  // Öppnaren har 6 ruter utan 4-korts högfärg; svararen 16 hp med 5♣ + 4♠.
  // Motståndarna är döda. Svararens 2♠ ska synas i auktionen.
  const deal: Deal = {
    id: '2over1-hogfarg',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: {
      N: parseHand('S:K84 H:A5 D:AQJ965 C:84'),
      E: parseHand('S:J93 H:JT86 D:83 C:Q963'),
      S: parseHand('S:AQ52 H:K3 D:72 C:AKJ52'),
      W: parseHand('S:T76 H:Q9742 D:KT4 C:T7'),
    },
  }

  it('svararen visar 2♠ efter 2♦ och bordet når utgång', () => {
    const calls = botAuction(deal)!
    const bids = calls.map((c) => c.bid)
    expect(bids).toContain('2S')
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBeGreaterThanOrEqual(3)
  })
})
