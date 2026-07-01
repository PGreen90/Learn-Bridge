import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { bergenPoints, classifyFit, deferredShortness, dummyPoints, playingTricks, startingPoints, wastedHonorsOppositeShortness } from './evaluation'

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

describe('classifyFit – gemensam fitklassificering (FAS 3 punkt 11)', () => {
  const cf = (n: string, trump: Parameters<typeof classifyFit>[1]) => classifyFit(parseHand(n), trump)

  it('0–1 trumf = ingen fit', () => {
    // singel spader
    const e = cf('S:5 H:AK43 D:KQ54 C:Q543', 'spades')
    expect(e.fit).toBe('none')
    expect(e.hasFit).toBe(false)
    expect(e.hasFourPlus).toBe(false)
  })

  it('2 trumf = two (dubbelton-stöd, ingen höjning på egen hand)', () => {
    const e = cf('S:54 H:AK43 D:KQ54 C:Q54', 'spades')
    expect(e.fit).toBe('two')
    expect(e.hasFit).toBe(false)
  })

  it('platt 3 trumf utan honnör = three', () => {
    // ♠432 (inga trumfhonnörer), 4-3-3-3-ish utan singel/renons
    const e = cf('S:432 H:KJ3 D:Q542 C:K54', 'spades')
    expect(e.fit).toBe('three')
    expect(e.hasFit).toBe(true)
    expect(e.hasFourPlus).toBe(false)
  })

  it('3 trumf MED trumfhonnör = good-three', () => {
    // ♠K32 – kung i trumf lyfter till bra 3-stöd
    expect(cf('S:K32 H:KJ3 D:Q542 C:K54', 'spades').fit).toBe('good-three')
  })

  it('3 trumf med kort sidofärg (singel) = good-three även utan trumfhonnör', () => {
    // ♠432 (inga honnörer) men singel hjärter → ruffvärde
    expect(cf('S:432 H:6 D:KQ542 C:K543', 'spades').fit).toBe('good-three')
  })

  it('3 trumf med bara en dubbelton (ingen honnör/singel) räknas INTE som bra', () => {
    // ♠432, kortaste sidofärg = dubbelton → förblir platt three
    expect(cf('S:432 H:65 D:KQ542 C:K54', 'spades').fit).toBe('three')
  })

  it('exakt 4 trumf = four', () => {
    const e = cf('S:5432 H:AK3 D:K542 C:54', 'spades')
    expect(e.fit).toBe('four')
    expect(e.hasFourPlus).toBe(true)
  })

  it('5+ trumf = five-plus', () => {
    expect(cf('S:76543 H:AK3 D:K54 C:54', 'spades').fit).toBe('five-plus')
    expect(cf('S:765432 H:AK D:K54 C:54', 'spades').fit).toBe('five-plus')
  })
})

describe('FAS 4 punkt 17 – stödvärderingens tre komponenter', () => {
  // Bergens asymmetri: LÅNGTRUMF-handen (öppnaren, bergenPoints) räknar
  // fitpoäng + distributionsvärde + kortfärger; STÖDHANDEN (svararen, dummyPoints)
  // räknar kortfärger. Här isoleras varje komponent.

  describe('fitpoäng – extra trumflängd (öppnarens bergenPoints.extraTrump)', () => {
    it('5 trumf ger 0, 6 ger +1, 7 ger +2', () => {
      expect(bergenPoints(parseHand('S:AK654 H:K5 D:Q543 C:53'), 'spades').extraTrump).toBe(0)
      expect(bergenPoints(parseHand('S:AK7654 H:K5 D:Q54 C:53'), 'spades').extraTrump).toBe(1)
      expect(bergenPoints(parseHand('S:AK76543 H:K5 D:Q5 C:53'), 'spades').extraTrump).toBe(2)
    })
  })

  describe('distributionsvärde – sidofärger (bergenPoints.sideSuits)', () => {
    it('+1 per 4-/5-korts sidofärg', () => {
      // ♠ trumf + en 4-korts ruter → 1 sidofärg.
      expect(bergenPoints(parseHand('S:AK654 H:K5 D:Q543 C:53'), 'spades').sideSuits).toBe(1)
      // ♠ trumf + 4-korts ruter + 5-korts klöver → 2 sidofärger.
      expect(bergenPoints(parseHand('S:AK65 H:5 D:Q543 C:5432'), 'spades').sideSuits).toBe(2)
    })
  })

  describe('kortfärger – korthet (bergenPoints.shortSuit / dummyPoints.shortness)', () => {
    it('öppnaren: singel +2, renons +4, två dubbletonger +1', () => {
      expect(bergenPoints(parseHand('S:AK654 H:5 D:Q5432 C:53'), 'spades').shortSuit).toBe(2) // singel ♥
      expect(bergenPoints(parseHand('S:AK654 H:- D:Q5432 C:532'), 'spades').shortSuit).toBe(4) // renons ♥
      expect(bergenPoints(parseHand('S:AK543 H:54 D:Q5 C:5432'), 'spades').shortSuit).toBe(1) // 2 dubbletonger (♥,♦)
    })
    it('stödhanden: singel +2 (3 trumf) men +3 (4 trumf), renons = antal trumf', () => {
      // singel ♥ med 3 spader → +2
      expect(dummyPoints(parseHand('S:K54 H:5 D:Q5432 C:5432'), 'spades').shortness).toBe(2)
      // singel ♥ med 4 spader → +3
      expect(dummyPoints(parseHand('S:K543 H:5 D:Q543 C:5432'), 'spades').shortness).toBe(3)
      // renons ♥ med 4 spader → 4 (= antal trumf)
      expect(dummyPoints(parseHand('S:K543 H:- D:Q5432 C:5432'), 'spades').shortness).toBe(4)
    })
  })

  it('sanningskarta: LTC finns inte – motorn värderar bara på HP + TP', () => {
    // Regressionsvakt för FAS 4 punkt 16-beslutet: ingen förlorarräkning smyger in.
    // (Rent dokumenterande – evaluation.ts exponerar inga LTC-fält.)
    const e = dummyPoints(parseHand('S:K543 H:5 D:Q543 C:5432'), 'spades')
    expect(Object.keys(e)).not.toContain('losers')
    expect(Object.keys(e)).not.toContain('ltc')
  })
})

describe('FAS 4 punkt 18 – slamvärdering: nedvärdera K/D mot partnerns kortfärg', () => {
  // Partnern är kort i ♥; vi räknar hur mycket av VÅRA honnörer där som är dött.
  const w = (n: string) => wastedHonorsOppositeShortness(parseHand(n), 'hearts')

  it('kung i kortfärgen = −2', () => {
    expect(w('S:A54 H:K32 D:Q543 C:53')).toBe(2)
  })
  it('KD i kortfärgen = −4', () => {
    expect(w('S:A54 H:KQ2 D:Q54 C:53')).toBe(4)
  })
  it('KDkn i kortfärgen = −5', () => {
    expect(w('S:A54 H:KQJ D:Q54 C:53')).toBe(5)
  })
  it('esset behålls (kontroll) – A ensam = 0', () => {
    expect(w('S:A54 H:A32 D:Q543 C:53')).toBe(0)
  })
  it('EKD → esset kvar, K+D dras = −4', () => {
    expect(w('S:54 H:AKQ D:Q5432 C:53')).toBe(4)
  })
  it('inga honnörer i kortfärgen = 0', () => {
    expect(w('S:A54 H:432 D:KQ54 C:K3')).toBe(0)
  })
})

describe('playingTricks – spelstick (nära utgång på egen hand)', () => {
  const pt = (n: string) => playingTricks(parseHand(n))

  it('lång löpande färg: EKD + långa kort = längden', () => {
    // ♠AKQ432: AKD = 3 topp + 3 långa (utöver 3) = 6, inga andra stick.
    expect(pt('S:AKQ432 H:765 D:76 C:76')).toBe(6)
  })

  it('ägarens exempel-form: 6-korts högfärg + EK vid sidan ≈ 8', () => {
    // ♥AKQJ98 = 6, ♠AK = 2 → 8 spelstick (~ en 20-hp-hand nära utgång själv).
    expect(pt('S:AK H:AKQJ98 D:32 C:432')).toBe(8)
  })

  it('garderad kung ger ett halvt spelstick → 8½', () => {
    // Samma som ovan men ♦K2 (garderad kung) lyfter till 8½ – 2♣-gränsen.
    expect(pt('S:AK H:AKQJ98 D:K2 C:432')).toBe(8.5)
  })

  it('platt honnörshand tar få spelstick trots hyfsad HP', () => {
    // ♠AQ5 ♥KJ7 ♦Q842 ♣K93 = 15 HP men bara ~2½ spelstick (inga långa färger).
    expect(pt('S:AQ5 H:KJ7 D:Q842 C:K93')).toBe(2.5)
  })

  it('långa kort ger stick bara med en topphonnör att etablera med', () => {
    // ♦8765432 (7 hackor) räknas som 0 spelstick – ingen honnör att köra hem den på.
    expect(pt('S:A2 H:A2 D:8765432 C:A2')).toBe(3) // bara de tre essen
  })
})
