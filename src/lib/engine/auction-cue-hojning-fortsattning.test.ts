// HÅL D STEG 2 — cue-höjningens fortsättning i högfärg (ägarens struktur och
// exempelrunda 2026-09-28, systembok §7.8 c). Läget: 1♥–(2♦)–3♦ (cue = limit-
// höjning eller bättre, krav), motståndarna tiger. Öppnarens styrka är INTE
// avgörande — hen ger partnern chansen att fortsätta beskriva:
//   ≤12 → 3♥ · 14–15 bal. med stopp → 3NT · 13+ → kontrollbud (ess, singel,
//   renons, K+Q) · 13+ utan kontroll → 4♥ · aldrig hopp till 4♥ över ett cue.
// Höjaren cue:ar sin egen kontroll oavsett styrka; 16+ frågar 4NT när alla
// sidofärger är kontrollerade mellan oss. Alla hp räknas med kod (regeln
// "händer räknas med kod", 2026-09-28). Facit skrevs FÖRE bygget.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { botAuction } from './revisor'
import { decideCallTraced } from './auction-live'
import { meaningOf } from './auction-meaning'
import { hcp } from './hand'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const FYLL = { N: 'S:2345 H:234 D:234 C:234', E: 'S:2345 H:234 D:234 C:234', S: 'S:2345 H:234 D:234 C:234', W: 'S:2345 H:234 D:234 C:234' }
/** Giv där bara `seat`s hand spelar roll (tabellen läser aldrig de andra). */
function ensam(seat: Seat, hand: string, dealer: Seat = 'N'): Deal {
  const hands = { ...FYLL } as Record<Seat, string>
  hands[seat] = hand
  return { id: 'cue-hojning', dealer, vulnerability: 'none', board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return { id: 'cue-hojning-giv', dealer, vulnerability: 'none', board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}

// 1♥–(2♦)–3♦–(P), Nord ska bjuda.
const CUE = [call('N', '1H'), call('E', '2D'), call('S', '3D'), call('W', 'P')]
const bjud = (seat: Seat, hand: string, history: ResolvedCall[]) => decideCallTraced(ensam(seat, hand), history, seat).call

describe('Hål D steg 2 — öppnarens svar på cue-höjningen i högfärg (ägarens exempel 2026-09-28)', () => {
  it('≤12 hp → 3♥ (minimum, avslag): ♠K85 ♥AQ964 ♦K73 ♣84', () => {
    const hand = 'S:K85 H:AQ964 D:K73 C:84'
    expect(hcp(parseHand(hand))).toBe(12)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '3H', rule: 'svar på cue-höjning' })
  })

  it('14–15 balanserad med stopp i deras färg → 3NT (att föredra): ♠KQ5 ♥AJ964 ♦KT3 ♣Q4', () => {
    // Ägarens exempelhand ♠KQ5 ♥AQ964 ♦KJ3 ♣Q4 är 17 hp med kod (inte 15) — den
    // cue:ar 3♠; här en äkta 15:a.
    const hand = 'S:KQ5 H:AJ964 D:KT3 C:Q4'
    expect(hcp(parseHand(hand))).toBe(15)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '3NT', rule: 'svar på cue-höjning: 3NT (14–15)' })
  })

  it('13–14 hp → kontrollbud 3♠ (♠AQ5 är kontroll, ♣K4 ensam kung är det inte): ♠AQ5 ♥KQ964 ♦872 ♣K4', () => {
    // Ägarens exempelhand är 14 hp med kod (inte 13); en äkta 13:a bjuder likadant.
    const hand = 'S:AQ5 H:KQ964 D:872 C:K4'
    expect(hcp(parseHand(hand))).toBe(14)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '3S', rule: 'svar på cue-höjning: kontrollbud' })
    const tretton = 'S:AQ5 H:KJ964 D:872 C:K4'
    expect(hcp(parseHand(tretton))).toBe(13)
    expect(bjud('N', tretton, CUE)).toMatchObject({ bid: '3S', rule: 'svar på cue-höjning: kontrollbud' })
  })

  it('17 hp → 3♠, aldrig 4♥ direkt när ett kontrollbud under utgång finns: ♠AQ85 ♥AKJ64 ♦3 ♣K84', () => {
    const hand = 'S:AQ85 H:AKJ64 D:3 C:K84'
    expect(hcp(parseHand(hand))).toBe(17)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '3S', rule: 'svar på cue-höjning: kontrollbud' })
  })

  it('13+ utan äkta kontroll (bara ensamma kungar, ojämn utan 3NT-väg) → 4♥: ♠KJ54 ♥AQ964 ♦73 ♣KJ', () => {
    const hand = 'S:KJ54 H:AQ964 D:73 C:KJ'
    expect(hcp(parseHand(hand))).toBe(14)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '4H', rule: 'svar på cue-höjning: utgång (ingen kontroll)' })
  })

  it('14–15 jämn men UTAN stopp i deras färg → kontrollbud, inte 3NT: ♠AQ5 ♥AJT96 ♦83 ♣K42', () => {
    const hand = 'S:AQ5 H:AJT96 D:83 C:K42'
    expect(hcp(parseHand(hand))).toBe(14)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '3S', rule: 'svar på cue-höjning: kontrollbud' })
  })

  it('16+ balanserad med stopp cue:ar ändå (3NT är bara för 14–15): ♠AQ5 ♥AQ964 ♦KJ3 ♣Q4', () => {
    const hand = 'S:AQ5 H:AQ964 D:KJ3 C:Q4'
    expect(hcp(parseHand(hand))).toBe(18)
    expect(bjud('N', hand, CUE)).toMatchObject({ bid: '3S', rule: 'svar på cue-höjning: kontrollbud' })
  })
})

describe('Hål D steg 2 — höjaren efter öppnarens kontrollbud', () => {
  const EFTER_3S = [...CUE, call('N', '3S'), call('E', 'P')]

  it('cue:ar sin egen kontroll oavsett styrka: ♠K84 ♥Q73 ♦A6 ♣QJ965 (12 hp) → 4♦, inte 4♥', () => {
    const hand = 'S:K84 H:Q73 D:A6 C:QJ965'
    expect(hcp(parseHand(hand))).toBe(12)
    expect(bjud('S', hand, EFTER_3S)).toMatchObject({ bid: '4D', rule: 'kontrollbud efter cue-höjning' })
  })

  it('billigaste kontrollen först: ♠K84 ♥KQ7 ♦A6 ♣AJ965 (17 hp) → 4♣ (inte 4NT direkt)', () => {
    const hand = 'S:K84 H:KQ7 D:A6 C:AJ965'
    expect(hcp(parseHand(hand))).toBe(17)
    expect(bjud('S', hand, EFTER_3S)).toMatchObject({ bid: '4C', rule: 'kontrollbud efter cue-höjning' })
  })

  it('ingen ny kontroll att visa, under 16 → 4♥ (till spel): ♠A84 ♥Q73 ♦K65 ♣QJ96', () => {
    const hand = 'S:A84 H:Q73 D:K65 C:QJ96'
    expect(hcp(parseHand(hand))).toBe(12)
    expect(bjud('S', hand, EFTER_3S)).toMatchObject({ bid: '4H', rule: 'cue-höjning: stannar i utgång' })
  })

  it('öppnarens 4♥ efter höjarens cue = inget mer att visa (♠AQ5 ♥KQ964 ♦872 ♣K4 över 4♦)', () => {
    const hand = 'S:AQ5 H:KQ964 D:872 C:K4'
    const history = [...EFTER_3S, call('S', '4D'), call('W', 'P')]
    expect(bjud('N', hand, history)).toMatchObject({ bid: '4H', rule: 'cue-höjning: inget mer att visa' })
  })

  it('öppnaren visar nästa kontroll över höjarens cue: ♠AQ85 ♥AKJ64 ♦3 ♣K84 över 4♣ → 4♦ (singel)', () => {
    const hand = 'S:AQ85 H:AKJ64 D:3 C:K84'
    const history = [...EFTER_3S, call('S', '4C'), call('W', 'P')]
    expect(bjud('N', hand, history)).toMatchObject({ bid: '4D', rule: 'kontrollbud efter cue-höjning' })
  })

  it('16+ och alla sidofärger kontrollerade mellan oss → 4NT efter öppnarens 4♥: ♠K84 ♥KQ7 ♦A6 ♣AJ965', () => {
    const hand = 'S:K84 H:KQ7 D:A6 C:AJ965'
    const history = [...EFTER_3S, call('S', '4C'), call('W', 'P'), call('N', '4H'), call('E', 'P')]
    expect(bjud('S', hand, history)).toMatchObject({ bid: '4NT', rule: 'konkurrens-slaminvit (RKC)' })
  })

  it('16+ men en sidofärg okontrollerad → pass på öppnarens 4♥: ♠K84 ♥KQ7 ♦K6 ♣AJ965', () => {
    const hand = 'S:K84 H:KQ7 D:K6 C:AJ965'
    expect(hcp(parseHand(hand))).toBe(16)
    const history = [...EFTER_3S, call('S', '4C'), call('W', 'P'), call('N', '4H'), call('E', 'P')]
    expect(bjud('S', hand, history)).toMatchObject({ bid: 'P' })
  })

  it('under 16 → pass på öppnarens 4♥ även med kontroll överallt: ♠K84 ♥Q73 ♦A6 ♣AJ965', () => {
    const hand = 'S:K84 H:Q73 D:A6 C:AJ965'
    expect(hcp(parseHand(hand))).toBe(14)
    const history = [...EFTER_3S, call('S', '4C'), call('W', 'P'), call('N', '4H'), call('E', 'P')]
    expect(bjud('S', hand, history)).toMatchObject({ bid: 'P' })
  })
})

describe('Hål D steg 2 — höjaren efter öppnarens 3NT (14–15 med stopp)', () => {
  const EFTER_3NT = [...CUE, call('N', '3NT'), call('E', 'P')]

  it('jämn hand med trekortsstöd, under 16 → pass (3NT står): ♠A84 ♥K73 ♦Q62 ♣J965', () => {
    const hand = 'S:A84 H:K73 D:Q62 C:J965'
    expect(hcp(parseHand(hand))).toBe(10)
    expect(bjud('S', hand, EFTER_3NT)).toMatchObject({ bid: 'P', rule: 'cue-höjning: passar 3NT' })
  })

  it('4+ trumf → 4♥: ♠A84 ♥K732 ♦Q6 ♣J965', () => {
    const hand = 'S:A84 H:K732 D:Q6 C:J965'
    expect(bjud('S', hand, EFTER_3NT)).toMatchObject({ bid: '4H', rule: 'cue-höjning: rättar till trumf' })
  })

  it('16+ → kontrollbud (slamintresse): ♠A84 ♥K73 ♦A6 ♣AJ965 → 4♣', () => {
    const hand = 'S:A84 H:K73 D:A6 C:AJ965'
    expect(hcp(parseHand(hand))).toBe(16)
    expect(bjud('S', hand, EFTER_3NT)).toMatchObject({ bid: '4C', rule: 'kontrollbud efter cue-höjning' })
  })
})

describe('Hål D steg 2 — hela auktionen med motorn i alla fyra stolar', () => {
  // Nord 14 · Syd 17 · Öst 9 · Väst 0 = 40 hp (räknas nedan).
  const GIV = dealOf('N', {
    N: 'S:AQ5 H:AJT96 D:83 C:K42',
    E: 'S:J3 H:85 D:KQJT97 C:Q83',
    S: 'S:K84 H:KQ7 D:A6 C:AJ965',
    W: 'S:T9762 H:432 D:542 C:T7',
  })

  it('händerna summerar till 40 hp och 13 kort var', () => {
    const hp = (['N', 'E', 'S', 'W'] as Seat[]).map((s) => hcp(GIV.hands[s]))
    expect(hp).toEqual([14, 9, 17, 0])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ['N', 'E', 'S', 'W'] as Seat[]) expect(GIV.hands[s]).toHaveLength(13)
  })

  it('1♥–(2♦)–3♦ · 3♠ · 4♣ · 4♥ · 4NT · 5♥ · 6♥ — kontrollbudsrond, essfråga och lillslam', () => {
    const history = botAuction(GIV)!
    expect(history).not.toBeNull()
    const bids = history.map((c) => c.bid)
    expect(bids.slice(0, 4)).toEqual(['1H', '2D', '3D', 'P'])
    expect(bids).toEqual(['1H', '2D', '3D', 'P', '3S', 'P', '4C', 'P', '4H', 'P', '4NT', 'P', '5H', 'P', '6H', 'P', 'P', 'P'])
  })

  it('betydelselagret förklarar människans bud ur auktionen (kontrollbud, 3NT, 4♥, 4NT = RKC)', () => {
    const h = [...CUE, call('N', '3S'), call('E', 'P'), call('S', '4D'), call('W', 'P'), call('N', '4H'), call('E', 'P'), call('S', '4NT')]
    expect(meaningOf(h, 4)).toMatchObject({ rule: 'svar på cue-höjning: kontrollbud', forcing: 'utgangskrav', alert: true })
    expect(meaningOf(h, 6)).toMatchObject({ rule: 'kontrollbud efter cue-höjning', forcing: 'utgangskrav' })
    expect(meaningOf(h, 8)).toMatchObject({ rule: 'cue-höjning: inget mer att visa', forcing: 'avslut' })
    expect(meaningOf(h, 10).rule).toBe('1430 RKC')
    expect(meaningOf(h, 10).text).toContain('hjärter')
    const nt = [...CUE, call('N', '3NT')]
    expect(meaningOf(nt, 4)).toMatchObject({ rule: 'svar på cue-höjning: 3NT (14–15)', forcing: 'ej-krav' })
    const min = [...CUE, call('N', '3H')]
    expect(meaningOf(min, 4)).toMatchObject({ rule: 'svar på cue-höjning', forcing: 'ej-krav' })
  })
})
