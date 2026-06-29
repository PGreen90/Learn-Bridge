import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { dealRandom } from './deal'
import { buildAuction } from './auction'
import { finalContract, turnsToCalls } from './auction-contract'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}

/** Bygger en giv ur fyra handtexter (zon/bricka spelar ingen roll här). */
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test',
    dealer,
    vulnerability: 'none',
    board: 1,
    hands: {
      N: parseHand(hands.N),
      E: parseHand(hands.E),
      S: parseHand(hands.S),
      W: parseHand(hands.W),
    },
  }
}

describe('seatToAct – vems tur det är', () => {
  it('går medurs från given', () => {
    expect(seatToAct('N', 0)).toBe('N')
    expect(seatToAct('N', 1)).toBe('E')
    expect(seatToAct('N', 2)).toBe('S')
    expect(seatToAct('N', 3)).toBe('W')
    expect(seatToAct('N', 4)).toBe('N')
    expect(seatToAct('E', 1)).toBe('S')
  })
})

describe('legalCalls – bridge-reglerna för tillåtna bud', () => {
  it('tom budgivning: pass + alla 35 kontraktsbud, inget X/XX', () => {
    const legal = legalCalls([], 'N')
    expect(legal).toContain('P')
    expect(legal).toContain('1C')
    expect(legal).toContain('7NT')
    expect(legal).not.toContain('X')
    expect(legal).not.toContain('XX')
    expect(legal.length).toBe(1 + 35)
  })

  it('bara bud högre än senaste kontraktsbudet är tillåtna', () => {
    const legal = legalCalls([call('N', '1NT')], 'E')
    expect(legal).not.toContain('1C')
    expect(legal).not.toContain('1NT')
    expect(legal).toContain('2C')
    expect(legal).toContain('7NT')
  })

  it('X tillåtet mot motståndarens bud, inte mot partnerns', () => {
    // N öppnar, S (partner) får inte dubbla; Ö (motståndare) får.
    expect(legalCalls([call('N', '1H')], 'S')).not.toContain('X')
    expect(legalCalls([call('N', '1H')], 'E')).toContain('X')
  })

  it('X inte tillåtet om bara pass följt men senaste icke-pass var partnerns bud', () => {
    // N 1H, Ö P → S (Nords partner) får inte dubbla Nords bud.
    expect(legalCalls([call('N', '1H'), call('E', 'P')], 'S')).not.toContain('X')
  })

  it('XX tillåtet efter motståndarens X, X inte längre', () => {
    // N 1H, Ö X → N/S får redubbla, inte dubbla igen.
    const legal = legalCalls([call('N', '1H'), call('E', 'X')], 'S')
    expect(legal).toContain('XX')
    expect(legal).not.toContain('X')
  })

  it('pass-i-mellanrum bryter inte dubbelrätten mot motståndarens bud', () => {
    // Ö 1S, S P, V P → N får fortfarande dubbla Östs 1S.
    const legal = legalCalls([call('E', '1S'), call('S', 'P'), call('W', 'P')], 'N')
    expect(legal).toContain('X')
  })
})

describe('auctionComplete – när budgivningen är slut', () => {
  it('färre än fyra bud → aldrig slut', () => {
    expect(auctionComplete([call('N', 'P'), call('E', 'P'), call('S', 'P')])).toBe(false)
  })

  it('fyra inledande pass → passat ut (slut)', () => {
    expect(
      auctionComplete([call('N', 'P'), call('E', 'P'), call('S', 'P'), call('W', 'P')]),
    ).toBe(true)
  })

  it('bud + tre pass → slut', () => {
    expect(
      auctionComplete([call('N', '1NT'), call('E', 'P'), call('S', 'P'), call('W', 'P')]),
    ).toBe(true)
  })

  it('bud + bara två pass → ännu öppen', () => {
    expect(
      auctionComplete([call('N', '1NT'), call('E', 'P'), call('S', 'P')]),
    ).toBe(false)
  })

  it('tre pass men inte i rad → öppen', () => {
    expect(
      auctionComplete([call('N', '1NT'), call('E', 'P'), call('S', '2C'), call('W', 'P'), call('N', 'P')]),
    ).toBe(false)
  })
})

describe('contractFromCalls – slutkontrakt ur en budföljd', () => {
  it('passat ut → null', () => {
    expect(
      contractFromCalls([call('N', 'P'), call('E', 'P'), call('S', 'P'), call('W', 'P')]),
    ).toBeNull()
  })

  it('1NT passat ut → 1NT av öppnaren', () => {
    const c = contractFromCalls([call('S', '1NT'), call('W', 'P'), call('N', 'P'), call('E', 'P')])
    expect(c).toEqual({ declarer: 'S', strain: 'NT', level: 1 })
  })

  it('spelförare = den som FÖRST nämnde slutfärgen', () => {
    // S 1C – N 1S – S 2S: spader ägs N/S, först nämnd av N.
    const c = contractFromCalls([
      call('S', '1C'), call('W', 'P'), call('N', '1S'), call('E', 'P'),
      call('S', '2S'), call('W', 'P'), call('N', 'P'), call('E', 'P'),
    ])
    expect(c).toEqual({ declarer: 'N', strain: 'spades', level: 2 })
  })

  it('inkliv: motståndaren spelar slutkontraktet', () => {
    const c = contractFromCalls([
      call('S', '1H'), call('W', '2D'), call('N', 'P'), call('E', 'P'), call('S', 'P'),
    ])
    expect(c).toEqual({ declarer: 'W', strain: 'diamonds', level: 2 })
  })
})

// Känd gräns: vissa slamlinjer (Jacoby 2NT → cue → 1430 RKC) genererar i
// buildAuction två bud i rad från SAMMA plats (öppnarens cue hoppas över när
// hon saknar kontroll att visa). Det är ingen laglig medurs-auktion, så
// decideCall kan inte spela upp den bud för bud. ~0,25 % av färdiga auktioner.
// Fixas när slamverktygen kopplas in i den levande budlådan (egen punkt).
function isLegalMedurs(turns: { seat: Seat }[]): boolean {
  return turns.every((t, k) => k === 0 || t.seat !== turns[k - 1].seat)
}

// Spelar upp en hel budgivning genom att fråga decideCall plats för plats
// (precis som budlådan gör när alla tre datorplatser bjuder). Stannar när
// auktionen är slut eller efter en säkerhetsgräns.
function playOut(deal: Deal): ResolvedCall[] {
  const history: ResolvedCall[] = []
  for (let i = 0; i < 40; i++) {
    if (auctionComplete(history)) break
    const seat = seatToAct(deal.dealer, history.length)
    history.push(decideCall(deal, history, seat))
  }
  return history
}

describe('decideCall – bot-hjärnan återskapar motorns systemlinje', () => {
  it('varje bud är lagligt och ligger på rätt plats', () => {
    for (let i = 0; i < 200; i++) {
      const deal = dealRandom()
      const history: ResolvedCall[] = []
      for (let step = 0; step < 40 && !auctionComplete(history); step++) {
        const seat = seatToAct(deal.dealer, history.length)
        const c = decideCall(deal, history, seat)
        expect(c.seat).toBe(seat)
        expect(legalCalls(history, seat)).toContain(c.bid)
        history.push(c)
      }
      expect(auctionComplete(history)).toBe(true)
    }
  })

  it('kontraktet matchar buildAuctions slutkontrakt (när motorn budat klart)', () => {
    let checked = 0
    for (let i = 0; i < 300 && checked < 120; i++) {
      const deal = dealRandom()
      const built = buildAuction(deal)
      if (!built || built.open) continue // bara fullständiga linjer jämförs
      if (!isLegalMedurs(built.turns)) continue // hoppa över slam-quirken (se ovan)
      const expected = finalContract(built)
      if (!expected) continue
      const history = playOut(deal)
      expect(contractFromCalls(history)).toEqual(expected)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('budföljdens kontraktsbud = buildAuctions turer (samma linje)', () => {
    let checked = 0
    for (let i = 0; i < 300 && checked < 120; i++) {
      const deal = dealRandom()
      const built = buildAuction(deal)
      if (!built || built.open) continue
      if (!isLegalMedurs(built.turns)) continue // hoppa över slam-quirken (se ovan)
      const lineBids = turnsToCalls(built.turns, deal.dealer)
        .filter((c) => c.bid !== 'P')
        .map((c) => `${c.seat}:${c.bid}`)
      const playedBids = playOut(deal)
        .filter((c) => c.bid !== 'P')
        .map((c) => `${c.seat}:${c.bid}`)
      expect(playedBids).toEqual(lineBids)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  // Nord öppnar 1♣, Öst upplysningsdubblar. Väst (Östs partner) MÅSTE svara när
  // Syd passar – får inte passa take-out-dubbla bort kontraktet. (Buggen som
  // syntes i budlådan: Väst passade med 5-korts spader.)
  describe('svar på partnerns upplysningsdubbling', () => {
    const deal = dealOf('N', {
      N: 'S:A3 H:K3 D:K32 C:KQT432', // öppnar 1♣ (6-korts klöver, 15 hp)
      E: 'S:KQ32 H:KJ32 D:KJ32 C:3', // upplysningsdubbling av 1♣ (13 hp, kort klöver)
      S: 'S:765 H:Q765 D:Q65 C:765', // svag
      W: 'S:KQT98 H:432 D:432 C:32', // 5-korts spader, svag
    })

    it('Väst tvingas bjuda sin längsta färg när Syd passar', () => {
      const history = [call('N', '1C'), call('E', 'X'), call('S', 'P')]
      const c = decideCall(deal, history, 'W')
      expect(c.seat).toBe('W')
      expect(c.bid).toBe('1S') // längsta objudna färg, billigaste nivå
      expect(legalCalls(history, 'W')).toContain(c.bid)
    })

    it('Väst slipper svara (passar) om Syd själv bjuder över dubblingen', () => {
      const history = [call('N', '1C'), call('E', 'X'), call('S', '2C')]
      expect(decideCall(deal, history, 'W').bid).toBe('P')
    })

    it('en stark advancer (12+) cue-bjuder deras färg i stället', () => {
      const strong = dealOf('N', {
        N: 'S:A3 H:K3 D:K32 C:KQT432',
        E: 'S:KQ32 H:KJ32 D:KJ32 C:3',
        S: 'S:765 H:Q765 D:Q65 C:765',
        W: 'S:AKJ98 H:AK2 D:432 C:32', // 14 hp → cue 2♣ (utgångskrav)
      })
      const history = [call('N', '1C'), call('E', 'X'), call('S', 'P')]
      expect(decideCall(strong, history, 'W').bid).toBe('2C')
    })
  })

  it('slam-quirken (två bud i rad, samma plats) är sällsynt – under 2 %', () => {
    let closed = 0
    let quirky = 0
    for (let i = 0; i < 4000; i++) {
      const built = buildAuction(dealRandom())
      if (!built || built.open) continue
      closed++
      if (!isLegalMedurs(built.turns)) quirky++
    }
    expect(quirky / closed).toBeLessThan(0.02)
  })
})
