import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { bergenPoints, deferredShortness, dummyPoints, startingPoints } from './evaluation'

// Faciten kommer från PDF:en "Hand Evaluation – Adjust-3 Method" (se
// docs/handvardering.md). 13 av 16 facit-händer stämmer exakt med reglerna;
// de 3 som källan räknar fel på (flathet glöms / off-by-one) är dokumenterade
// där och utelämnas medvetet ur de strikta totalsummorna.

describe('startingPoints – Nivå 1 (PDF Hand 1–5)', () => {
  const sp = (n: string) => startingPoints(parseHand(n)).startingPoints

  it('Hand 1: AKQT5 / T982 / 6 / J67 = 12', () => {
    expect(sp('S:AKQT5 H:T982 D:6 C:J67')).toBe(12)
  })
  it('Hand 2: AKT / KJ3 / JT52 / 567 = 11 (flat 4-3-3-3 → −1)', () => {
    expect(sp('S:AKT H:KJ3 D:JT52 C:567')).toBe(11)
  })
  it('Hand 3: A67 / KQ54 / Q7 / J678 = 11 (Dx dubbleton → −1)', () => {
    expect(sp('S:A67 H:KQ54 D:Q7 C:J678')).toBe(11)
  })
  it('Hand 4: AT4 / T543 / KJ67 / KT = 12 (Adjust-3 +1)', () => {
    expect(sp('S:AT4 H:T543 D:KJ67 C:KT')).toBe(12)
  })
  it('Hand 5: K78 / AQ9852 / AT9 / A = 20 (Adjust-3 +1, längd +2)', () => {
    expect(sp('S:K78 H:AQ9852 D:AT9 C:A')).toBe(20)
  })
})

describe('startingPoints – delarna i detalj', () => {
  it('Adjust-3 drar ifrån när damer/knektar dominerar', () => {
    // ♠QJ6 ♥QJ7 ♦KQ73 ♣KJ2 (PDF:ens Hand BB): 15 Hp, 0 ess/tior, 6 D/kn
    // → diff 6 → −2 (regeln "6+ → 2 poäng"). Därför svagare än 15 Hp antyder.
    const e = startingPoints(parseHand('S:QJ6 H:QJ7 D:KQ73 C:KJ2'))
    expect(e.hp).toBe(15)
    expect(e.adjust3).toBe(-2)
  })

  it('kvalitetsfärg kräver 4+ kort (AK10 på 3 kort ger ingen poäng)', () => {
    expect(startingPoints(parseHand('S:AKT H:KJ3 D:JT52 C:567')).suitQuality).toBe(0)
    // 6-korts AK10xxx ger kvalitet
    expect(startingPoints(parseHand('S:AKT432 H:KJ3 D:J5 C:67')).suitQuality).toBe(1)
  })

  it('AK och AQ är inte tvivelaktiga dubbletonger, men KQ/Qx/Jx är det', () => {
    expect(startingPoints(parseHand('S:AK H:K543 D:K543 C:543')).dubiousHonors).toBe(0)
    expect(startingPoints(parseHand('S:KQ H:A543 D:A543 C:543')).dubiousHonors).toBe(-1)
  })
})

describe('deferredShortness – uppskjuten kortfärg (bara visning)', () => {
  it('dubbleton +1, singel +2, renons +3', () => {
    // ♠T4 ♥6 ♦AKJ9862 ♣A72: dubbel spader +1, singel hjärter +2 = 3
    expect(deferredShortness(parseHand('S:T4 H:6 D:AKJ9862 C:A72'))).toBe(3)
    // renons + singel
    expect(deferredShortness(parseHand('S:AJ62 H:6542 D:- C:AK987'))).toBe(3)
    // balanserad utan korthet = 0
    expect(deferredShortness(parseHand('S:AQ5 H:KJ7 D:Q842 C:K93'))).toBe(0)
  })

  it('räknas INTE in i startpoängen (TP rör sig inte)', () => {
    const e = startingPoints(parseHand('S:T4 H:6 D:AKJ9862 C:A72'))
    expect(e.startingPoints).toBe(16) // 12 Hp + 3 längd + 1 kvalitet, ingen korthet
  })
})

describe('dummyPoints – Nivå 2 (PDF Hand A–E, partner öppnar 1♠)', () => {
  const dp = (n: string) => dummyPoints(parseHand(n), 'spades').dummyPoints

  it('Hand A: AJ62 / 6542 / void / AK987 = 17 (renons = 4 trumf)', () => {
    expect(dp('S:AJ62 H:6542 D:- C:AK987')).toBe(17)
  })
  it('Hand B: AQ67 / 678 / AKT432 / void = 20', () => {
    expect(dp('S:AQ67 H:678 D:AKT432 C:-')).toBe(20)
  })
  it('Hand C: KQJ32 / T98 / 7 / J987 = 12 (singel m. 5 trumf → +3)', () => {
    expect(dp('S:KQJ32 H:T98 D:7 C:J987')).toBe(12)
  })
  it('Hand D: 9876 / AK / 75 / AQT84 = 17 (två dubbletonger → +1 var)', () => {
    // PDF-texten säger "add 2 points" (15+2) men summerar fel till 16; metodens
    // egen regel "dubbleton 1 poäng var" ger 17. Vi följer regeln.
    expect(dp('S:9876 H:AK D:75 C:AQT84')).toBe(17)
  })
  it('Hand E: T986 / K / 753 / Q9432 = 8 (singel kung −1 i start, +3 stöd)', () => {
    expect(dp('S:T986 H:K D:753 C:Q9432')).toBe(8)
  })
})

describe('bergenPoints – Nivå 3 (PDF facit-händer)', () => {
  it('Hand 1: AT / AK7652 / 3 / AJT9, hjärterfit = 20 start, 24 Bergen', () => {
    const e = bergenPoints(parseHand('S:AT H:AK7652 D:3 C:AJT9'), 'hearts')
    expect(e.startingPoints).toBe(20)
    expect(e.bergenPoints).toBe(24) // +1 sjätte trumf, +1 sidofärg, +2 singel
  })
  it('Hand 3: AJ4 / KQ872 / AQT93 / void, hjärterfit = 19 start, 24 Bergen', () => {
    const e = bergenPoints(parseHand('S:AJ4 H:KQ872 D:AQT93 C:-'), 'hearts')
    expect(e.startingPoints).toBe(19)
    expect(e.bergenPoints).toBe(24) // +4 renons, +1 femkorts sidofärg
  })
  it('Hand 5: K97654 / AK5 / 985 / 5, spaderfit = 12 start, 15 Bergen', () => {
    const e = bergenPoints(parseHand('S:K97654 H:AK5 D:985 C:5'), 'spades')
    expect(e.startingPoints).toBe(12)
    expect(e.bergenPoints).toBe(15) // +1 sjätte trumf, +2 singel
  })

  it('det stora exemplet: AK42 / KQ632 / AK109 / void = 21 startpoäng', () => {
    // PDF räknar Bergen 26 men missar en sidofärg (regeln "+1 per sidofärg" ger 27).
    const e = bergenPoints(parseHand('S:AK42 H:KQ632 D:AKT9 C:-'), 'hearts')
    expect(e.startingPoints).toBe(21)
  })

  it('i sang räknas ingen kortfärg, bara trumflängd + sidofärger', () => {
    const e = bergenPoints(parseHand('S:AK42 H:KQ632 D:AKT9 C:-'), 'hearts', { notrump: true })
    expect(e.shortSuit).toBe(0)
  })
})
