// FAKTALAGRETS FACIT (motorbytet etapp 2, docs/motorbyte-plan.md §2 steg 2).
//
// `auctionFacts(history, seat)` räknar auktionsläget EN gång per beslut, ur
// auktionen ensam (aldrig en hand). Facit-fallen nedan är hjälparnas
// dokumenterade beteende i `auction-live.ts` FÖRE flytten — etapp 2 ändrar
// inget bud, bara var sanningen räknas (auktionsdiffen är domaren).

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { auctionFacts } from './auction-facts'

/** "N:1H E:P S:1S W:P" → budföljd. Regel kan hängas på med '=' ("W:2H=naturligt inkliv (1NT)"). */
function h(spec: string): ResolvedCall[] {
  if (!spec.trim()) return []
  return spec.trim().split(/\s+/).map((tok) => {
    const [seatBid, rule] = tok.split('=')
    const [seat, bid] = seatBid.split(':')
    return rule ? { seat: seat as Seat, bid: bid as ResolvedCall['bid'], rule } : { seat: seat as Seat, bid: bid as ResolvedCall['bid'] }
  })
}

describe('auctionFacts – grundläge och roller', () => {
  it('tom auktion: ingen öppning, ingen roll, inget krav', () => {
    const f = auctionFacts([], 'N')
    expect(f.opening).toBeNull()
    expect(f.weOpened).toBe(false)
    expect(f.role).toBeNull()
    expect(f.contractBids).toEqual([])
    expect(f.lastNonPass).toBeNull()
    expect(f.passOut).toBe(false)
    expect(f.force).toBeNull()
    expect(f.opponentsHaveBid).toBe(false)
  })

  it('öppningen är första kontraktsbudet, med plats i historiken', () => {
    const f = auctionFacts(h('N:P E:P S:1H W:P'), 'N')
    expect(f.opening).toEqual({ seat: 'S', level: 1, strain: 'H', index: 2 })
    expect(f.weOpened).toBe(true)
    expect(f.opener).toBe('S')
    expect(f.responder).toBe('N')
  })

  it('rollerna: öppnare · svarare · inklivare · advancer', () => {
    const hist = h('N:1H E:1S S:2H W:P')
    expect(auctionFacts(hist, 'N').role).toBe('öppnare')
    expect(auctionFacts(hist, 'S').role).toBe('svarare')
    expect(auctionFacts(hist, 'E').role).toBe('inklivare')
    expect(auctionFacts(hist, 'W').role).toBe('advancer')
  })

  it('motståndarsidan innan någon agerat: den som är i tur räknas som inklivare', () => {
    expect(auctionFacts(h('N:1H'), 'E').role).toBe('inklivare')
    expect(auctionFacts(h('N:1H E:P S:1S'), 'W').role).toBe('inklivare')
  })

  it('en upplysningsdubbling gör dubblaren till inklivare och partnern till advancer', () => {
    const hist = h('N:1H E:X S:P')
    expect(auctionFacts(hist, 'W').role).toBe('advancer')
    expect(auctionFacts(hist, 'E').role).toBe('inklivare')
  })

  it('passad hand: stolens första bud var pass', () => {
    const f = auctionFacts(h('N:P E:P S:1H W:P N:1S'), 'S')
    expect(f.passedHand.N).toBe(true)
    expect(f.passedHand.E).toBe(true)
    expect(f.passedHand.S).toBe(false)
    expect(f.passedHand.W).toBe(true)
  })
})

describe('auctionFacts – kontraktsbud, sidor och senaste bud', () => {
  it('kontraktsbuden delas per sida; X/XX/pass räknas inte', () => {
    const f = auctionFacts(h('N:1D E:1H S:X W:2H N:P E:P'), 'S')
    expect(f.contractBids.map((c) => c.bid)).toEqual(['1D', '1H', '2H'])
    expect(f.ourContractBids.map((c) => c.bid)).toEqual(['1D'])
    expect(f.theirContractBids.map((c) => c.bid)).toEqual(['1H', '2H'])
    expect(f.opponentsHaveBid).toBe(true)
    expect([...f.theirStrains]).toEqual(['H'])
    expect([...f.ourStrains]).toEqual(['D'])
  })

  it('senaste icke-pass och senaste kontraktsbud', () => {
    const f = auctionFacts(h('N:1S E:P S:2C W:X N:P'), 'E')
    expect(f.lastNonPass?.bid).toBe('X')
    expect(f.lastContract?.bid).toBe('2C')
    expect(f.quietSinceLastContract).toBe(false) // X:et kom efter 2♣
  })

  it('utpassningssitsen: två pass ligger på ett bud, mitt pass avslutar', () => {
    expect(auctionFacts(h('N:1S E:P S:P'), 'W').passOut).toBe(true)
    expect(auctionFacts(h('N:1S E:P'), 'S').passOut).toBe(false)
    expect(auctionFacts(h('N:P E:P'), 'S').passOut).toBe(false) // inget bud än – fyra pass krävs
  })
})

describe('auctionFacts – partnerns färg och trumf', () => {
  it('partnerns senast visade naturliga färg med nivå', () => {
    expect(auctionFacts(h('N:1H E:P S:1S W:P'), 'N').partnerLastSuit).toEqual({ strain: 'S', level: 1 })
    expect(auctionFacts(h('N:1H E:P S:1S W:P N:2C E:P'), 'S').partnerLastSuit).toEqual({ strain: 'C', level: 2 })
  })

  it('cue i motståndarnas färg och konstgjorda sangsvar är inga färger', () => {
    // Partnerns 2♦ är cue i deras ruter → ingen färg att stödja.
    expect(auctionFacts(h('S:1D W:1H N:P E:2D S:P'), 'W').partnerLastSuit).toBeNull()
    // Stayman 2♣ över eget 1NT är ingen klöverfärg.
    expect(auctionFacts(h('N:1NT E:P S:2C W:P'), 'N').partnerLastSuit).toBeNull()
    // Jacoby-överföring 2♦ över eget 1NT är ingen ruterfärg.
    expect(auctionFacts(h('N:1NT E:P S:2D W:P'), 'N').partnerLastSuit).toBeNull()
  })

  it('överenskommen trumf = en färg båda bjudit (senast bjudna om flera)', () => {
    expect(auctionFacts(h('N:1H E:P S:3H W:P'), 'N').agreedTrump).toBe('hearts')
    expect(auctionFacts(h('N:1H E:P S:1S W:P'), 'N').agreedTrump).toBeNull()
  })

  it('Jacoby 2NT sätter öppnarens högfärg som trumf fast ingen bjudit den två gånger', () => {
    const f = auctionFacts(h('N:1S E:P S:2NT W:P'), 'N')
    expect(f.agreedTrump).toBeNull()
    expect(f.jacobyTrump).toBe('spades')
    // Ett motståndarbud mellan öppning och 2NT → 2NT är något annat.
    expect(auctionFacts(h('N:1S E:2H S:2NT W:P'), 'N').jacobyTrump).toBeNull()
  })
})

describe('auctionFacts – kravläget (auctionForce flyttad ordagrant)', () => {
  it('ostört: partnerns nya färg är rondkrav för öppnaren', () => {
    expect(auctionFacts(h('N:1H E:P S:1S W:P'), 'N').force).toEqual({ kind: 'round' })
  })

  it('ostört: 2-över-1 är utgångskrav tills utgång nåtts – för båda', () => {
    expect(auctionFacts(h('N:1S E:P S:2C W:P'), 'N').force).toEqual({ kind: 'game' })
    expect(auctionFacts(h('N:1S E:P S:2C W:P N:2H E:P'), 'S').force).toEqual({ kind: 'game' })
    expect(auctionFacts(h('N:1S E:P S:2C W:P N:2H E:P S:4S W:P'), 'N').force).toBeNull() // utgång nådd
  })

  it('ostört: passad svarare gör inte 2/1 till utgångskrav – men den nya färgen är rondkrav', () => {
    expect(auctionFacts(h('S:P W:P N:1S E:P S:2C W:P'), 'N').force).toEqual({ kind: 'round' })
  })

  it('ostört: öppnarens reverse är rondkrav för svararen', () => {
    expect(auctionFacts(h('N:1D E:P S:1S W:P N:2H E:P'), 'S').force).toEqual({ kind: 'round' })
  })

  it('ostört: svararens egen färg efter 1NT-svaret är till spel (felrapport #59)', () => {
    expect(auctionFacts(h('N:1S E:P S:1NT W:P N:2C E:P S:2D W:P'), 'N').force).toBeNull()
  })

  it('ostört: stark 2♣ är utgångskrav utom efter 2♣–2♦–2NT', () => {
    expect(auctionFacts(h('N:2C E:P S:2D W:P N:2H E:P'), 'S').force).toEqual({ kind: 'game' })
    expect(auctionFacts(h('N:2C E:P S:2D W:P N:2NT E:P'), 'S').force).toBeNull()
  })

  it('stört: svararens fria nya färg är rondkrav (aldrig utgångskrav)', () => {
    expect(auctionFacts(h('N:1H E:1S S:2C W:P'), 'N').force).toEqual({ kind: 'round' })
  })

  it('stört: negativ dubbling före färgen gör färgen till ombud, inte krav', () => {
    expect(auctionFacts(h('N:1H E:1S S:X W:P N:2C E:P S:2D W:P'), 'N').force).toBeNull()
  })

  it('stört: cue i deras färg är höjning, inte ny färg', () => {
    expect(auctionFacts(h('N:1H E:1S S:2S W:P'), 'N').force).toBeNull()
  })

  it('stört: motståndarnas öppning ger inget krav på vår sida', () => {
    expect(auctionFacts(h('E:1D S:1H W:P N:2C E:P'), 'S').force).toBeNull()
  })
})

describe('auctionFacts – fria budet och den starka dubblingen', () => {
  it('fritt bud (§5.5): svararens billigaste nya färg över deras inkliv', () => {
    const f = auctionFacts(h('N:1D E:1H S:1S W:P'), 'N')
    expect(f.freeBid).toMatchObject({ opener: 'N', responder: 'S', free: { strain: 'S', level: 1 } })
    expect(f.freeBid?.contracts.length).toBe(3)
  })

  it('ett hopp eller en negativ dubbling först är inget fritt bud', () => {
    expect(auctionFacts(h('N:1D E:1H S:2S W:P'), 'N').freeBid).toBeNull()
    expect(auctionFacts(h('N:1D E:1H S:X W:P N:2C E:P S:2S W:P'), 'N').freeBid).toBeNull()
  })

  it('den starka dubblingen: X + egen objuden färg, sett från båda stolarna', () => {
    const hist = h('N:1D E:X S:P W:1S N:P E:2H S:P')
    const adv = auctionFacts(hist, 'W').strongDouble
    expect(adv).toMatchObject({ role: 'advancer', doubler: 'E', advancer: 'W', openStrain: 'D', doublerSuit: 'hearts' })
    expect(adv?.doublerBids).toEqual([{ level: 2, strain: 'H' }])
    expect(adv?.advancerBids).toEqual([{ level: 1, strain: 'S' }])
    expect(auctionFacts(hist, 'E').strongDouble?.role).toBe('doubler')
  })

  it('dubblarens höjning av advancerns färg är inget starkt återbud', () => {
    expect(auctionFacts(h('N:1D E:X S:P W:1S N:P E:2S S:P'), 'W').strongDouble).toBeNull()
  })
})

describe('auctionFacts – betydelserna finns att läsa per bud', () => {
  it('meaning(i) ger budets systembetydelse (ur regeln när den finns, annars härledd)', () => {
    const f = auctionFacts(h('N:1S=öppning:1S E:P S:2C W:P'), 'N')
    expect(f.meaning(0).källa).toBe('regel')
    expect(f.meaning(2).källa).toBe('härledd')
    expect(f.meaning(2).text.length).toBeGreaterThan(0)
    expect(f.meaning(2)).toBe(f.meaning(2)) // memoiserad
  })
})
