import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import {
  respondToRKC,
  respondToQueenAsk,
  cheapestCueBid,
  respondToKingAsk,
  respondToGerber,
  respondToGerberKingAsk,
  respondToExclusion,
  keycards,
  hasTrumpQueen,
  firstRoundControl,
} from './slam'

const h = (n: string) => parseHand(n)

describe('§6.1 1430 RKC Blackwood – svar på 4NT', () => {
  it('0 nyckelkort → 5♦', () => {
    expect(respondToRKC(h('S:Q32 H:KQ2 D:KQ2 C:KQ32'), 'spades').call).toBe('5D')
  })
  it('1 nyckelkort → 5♣', () => {
    expect(respondToRKC(h('S:432 H:A32 D:432 C:5432'), 'spades').call).toBe('5C')
  })
  it('2 nyckelkort utan trumfdam → 5♥', () => {
    expect(respondToRKC(h('S:432 H:A32 D:A432 C:432'), 'spades').call).toBe('5H')
  })
  it('2 nyckelkort med trumfdam → 5♠', () => {
    expect(respondToRKC(h('S:Q432 H:A32 D:A432 C:32'), 'spades').call).toBe('5S')
  })
  it('3 nyckelkort (2 ess + trumfkung) → 5♦', () => {
    expect(respondToRKC(h('S:K32 H:A32 D:A32 C:5432'), 'spades').call).toBe('5D')
  })
  it('4 ess → 5♣', () => {
    expect(respondToRKC(h('S:A32 H:A32 D:A32 C:A432'), 'spades').call).toBe('5C')
  })
  it('5+ trumf räknas som trumfdam', () => {
    expect(hasTrumpQueen(h('S:J6543 H:A32 D:A2 C:432'), 'spades')).toBe(true)
  })
  it('keycards räknar ess + trumfkung', () => {
    expect(keycards(h('S:K32 H:A32 D:A32 C:5432'), 'spades')).toBe(3)
  })
})

describe('§6.1 Trumfdam-fråga', () => {
  it('ingen dam → tillbaka till trumf', () => {
    expect(respondToQueenAsk(h('S:32 H:A32 D:A32 C:A5432'), 'spades').call).toBe('5S')
  })
  it('dam + billigaste sidokung (klöver, under trumf → 6-läget)', () => {
    expect(respondToQueenAsk(h('S:Q32 H:32 D:32 C:KA432'), 'spades').call).toBe('6C')
  })
  it('dam + sidokung över trumf (spader över hjärter → 5-läget)', () => {
    expect(respondToQueenAsk(h('S:K32 H:Q32 D:32 C:A5432'), 'hearts').call).toBe('5S')
  })
  it('dam utan sidokung → 5NT', () => {
    expect(respondToQueenAsk(h('S:Q432 H:A32 D:Q32 C:Q32'), 'spades').call).toBe('5NT')
  })
})

describe('§6.2 Cue-bid', () => {
  it('billigaste första-rondskontroll (klöveress) → 4♣', () => {
    expect(cheapestCueBid(h('S:KQ32 H:32 D:KQ2 C:A432'), 'spades')!.call).toBe('4C')
  })
  it('renons räknas som första-rondskontroll → 4♦', () => {
    expect(cheapestCueBid(h('S:KQ432 H:Q432 D:- C:Q432'), 'spades')!.call).toBe('4D')
  })
  it('hoppar över redan visad färg (aboveSuit)', () => {
    expect(cheapestCueBid(h('S:KQ32 H:A32 D:32 C:A432'), 'spades', 'clubs')!.call).toBe('4H')
  })
  it('ingen kontroll att visa → null', () => {
    expect(cheapestCueBid(h('S:KQ32 H:Q32 D:Q32 C:Q32'), 'spades')).toBeNull()
  })
  it('firstRoundControl: ess', () => {
    expect(firstRoundControl(h('S:KQ32 H:32 D:32 C:A5432'), 'clubs')).toBe(true)
  })
})

describe('§6.3 Sjöbergs 5NT – kungfråga (vilken kung)', () => {
  it('ingen sidokung → 6 i trumf', () => {
    expect(respondToKingAsk(h('S:Q432 H:A32 D:A32 C:A32'), 'spades').call).toBe('6S')
  })
  it('exakt en sidokung → 6 i den färgen', () => {
    expect(respondToKingAsk(h('S:Q432 H:K32 D:A32 C:A32'), 'spades').call).toBe('6H')
  })
  it('två sidokungar → 7 i trumf', () => {
    expect(respondToKingAsk(h('S:Q432 H:K32 D:K32 C:A32'), 'spades').call).toBe('7S')
  })
})

describe('§6.4 Gerber – ess- och kungfråga', () => {
  it('0 ess → 4♦', () => {
    expect(respondToGerber(h('S:K432 H:K32 D:K32 C:Q32')).call).toBe('4D')
  })
  it('1 ess → 4♥', () => {
    expect(respondToGerber(h('S:A432 H:K32 D:K32 C:Q32')).call).toBe('4H')
  })
  it('2 ess → 4♠', () => {
    expect(respondToGerber(h('S:A432 H:A32 D:K32 C:Q32')).call).toBe('4S')
  })
  it('3 ess → 4NT', () => {
    expect(respondToGerber(h('S:A432 H:A32 D:A32 C:Q32')).call).toBe('4NT')
  })
  it('kungfråga 5♣: 0 kungar → 5♦', () => {
    expect(respondToGerberKingAsk(h('S:Q432 H:Q32 D:Q32 C:Q32')).call).toBe('5D')
  })
  it('kungfråga 5♣: 1 kung → 5♥', () => {
    expect(respondToGerberKingAsk(h('S:K432 H:Q32 D:Q32 C:Q32')).call).toBe('5H')
  })
  it('kungfråga 5♣: 2 kungar → 5♠', () => {
    expect(respondToGerberKingAsk(h('S:K432 H:K32 D:Q32 C:Q32')).call).toBe('5S')
  })
  it('kungfråga 5♣: 3 kungar → 5NT', () => {
    expect(respondToGerberKingAsk(h('S:K432 H:K32 D:K32 C:Q32')).call).toBe('5NT')
  })
  it('kungfråga 5♣: 4 kungar → 5♦ (tvetydigt med 0)', () => {
    expect(respondToGerberKingAsk(h('S:K432 H:K32 D:K32 C:K32')).call).toBe('5D')
  })
})

describe('§6.5 Exclusion Blackwood', () => {
  it('1 nyckelkort (esset i renonsfärgen borträknat) → steg 1 (5♦)', () => {
    // void = klöver; klöveresset räknas bort, kvar trumfkung = 1
    expect(respondToExclusion(h('S:K32 H:32 D:32 C:A65432'), 'spades', 'clubs').call).toBe('5D')
  })
  it('3 nyckelkort → steg 2 (5♥)', () => {
    // void = klöver; HA + DA = 2 ess (klöveress bort) + trumfkung = 3
    expect(respondToExclusion(h('S:K32 H:A32 D:A2 C:A5432'), 'spades', 'clubs').call).toBe('5H')
  })
  it('2 nyckelkort utan trumfdam → steg 3 (5♠)', () => {
    // void = klöver; HA + DA = 2 ess, ingen trumfkung, ingen spaderdam, <5 spader
    expect(respondToExclusion(h('S:J432 H:A5432 D:A432 C:-'), 'spades', 'clubs').call).toBe('5S')
  })
  it('2 nyckelkort med trumfdam → steg 4 (5NT)', () => {
    // void = klöver; HA + DA = 2 ess, ingen trumfkung, spaderdam finns
    expect(respondToExclusion(h('S:Q432 H:A5432 D:A432 C:-'), 'spades', 'clubs').call).toBe('5NT')
  })
})
