// MOTORBYTET ETAPP 4 FAMILJ 1 — inkliv och advance i beslutstabellen
// (docs/motorbyte-plan.md, 2026-09-08). Facit för det som är NYTT i familjen;
// det som flyttade oförändrat (inklivarens/advancerns fortsättningar) har
// sina gamla facit-filer kvar (auction-advancer*.test.ts, overcall-*.test.ts,
// auction-inklivaren-svarar-cue.test.ts, auction-1nt-overcall-systemson.test.ts)
// och körs nu genom tabellen.
//
// Nytt i familjen:
//   · raden *inkliv* svarar i direkt sits och balansering — även med pass;
//   · advancern svarar på ett 2-LÄGESINKLIV med §7.1-tabellen (cue = limit+,
//     höjning från 6 stödpoäng, ny färg 5+ på billigaste nivån, 2NT 11+);
//   · advancerns nya färg över ett 1-lägesinkliv på BILLIGASTE nivån;
//   · tvåfärgspreferens även när motståndarna höjt sin egen färg — med
//     spelrum för pass på 4-/5-läget;
//   · tvåfärgsinklivarens egen fortsättning (flykt när dubblad, bjuder vidare
//     i den starka zonen);
//   · konkurrens-slaminvitet är en tabellrad med samma företräde som förut.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { CONTESTED_DETECTORS, FORCED_DETECTORS, decideCall, decideCallTraced } from './auction-live'
import { dealFromSeed } from './revisor'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>, vul: Deal['vulnerability'] = 'none'): Deal {
  return { id: 'f1', dealer, vulnerability: vul, board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
}
const FYLL = { N: 'S:2345 H:234 D:234 C:234', E: 'S:2345 H:234 D:234 C:234', S: 'S:2345 H:234 D:234 C:234', W: 'S:2345 H:234 D:234 C:234' }
/** Giv där bara `seat`s hand spelar roll (de andra är godtyckliga — tabellen läser dem aldrig). */
function ensam(seat: Seat, hand: string, dealer: Seat = 'N'): Deal {
  const rest = ['S:AKQJ H:AKQ D:AKQ C:AKQ', 'S:T987 H:JT9 D:JT9 C:JT9', 'S:6543 H:876 D:876 C:876']
  const hands = { ...FYLL } as Record<Seat, string>
  let k = 0
  for (const s of ['N', 'E', 'S', 'W'] as Seat[]) hands[s] = s === seat ? hand : rest[k++]
  return dealOf(dealer, hands)
}

describe('raden *inkliv*: inklivssitsen ur tabellen', () => {
  it('direkt sits: enkelt inkliv, källa tabell:inkliv', () => {
    const t = decideCallTraced(ensam('E', 'S:AQJ84 H:K3 D:983 C:762'), [call('N', '1H')], 'E')
    expect(t.källa).toBe('tabell:inkliv')
    expect(t.call).toMatchObject({ bid: '1S', rule: 'enkelt inkliv' })
  })
  it('passet är också ett beslut ur tabellen (inte "pass utan regel")', () => {
    const t = decideCallTraced(ensam('E', 'S:9874 H:K3 D:9832 C:762'), [call('N', '1H')], 'E')
    expect(t.källa).toBe('tabell:inkliv')
    expect(t.call.bid).toBe('P')
  })
  it('balansering: samma hand som passar direkt kliver in i utpassningsläget ("låna en kung"), med noten i förklaringen', () => {
    const hand = 'S:KQJ84 H:73 D:983 C:762' // 6 hp – under golvet 8 direkt, över golvet 5 i balansering
    expect(decideCallTraced(ensam('E', hand), [call('N', '1H')], 'E').call.bid).toBe('P')
    const bal = decideCallTraced(ensam('W', hand), [call('N', '1H'), call('E', 'P'), call('S', 'P')], 'W')
    expect(bal.källa).toBe('tabell:inkliv')
    expect(bal.call.bid).toBe('1S')
    expect(bal.call.explanation).toContain('balansering')
  })
  it('över deras 1NT / svaga tvåa tiger raden (andra familjer)', () => {
    expect(decideCallTraced(ensam('E', 'S:AQJ84 H:K3 D:983 C:762'), [call('N', '1NT')], 'E').källa).not.toBe('tabell:inkliv')
    expect(decideCallTraced(ensam('E', 'S:AQJ84 H:K3 D:983 C:762'), [call('N', '2H')], 'E').källa).not.toBe('tabell:inkliv')
  })
  it('vår sida har redan agerat → inte inklivssitsen', () => {
    expect(decideCallTraced(ensam('W', 'S:AQJ84 H:K3 D:983 C:762'), [call('N', '1H'), call('E', 'X'), call('S', 'P')], 'W').källa).not.toBe('tabell:inkliv')
  })
})

describe('raden *advance*: advancern svarar på partnerns 2-lägesinkliv med §7.1-tabellen', () => {
  const adv = (hand: string) => decideCallTraced(ensam('N', hand, 'E'), [call('E', '1H'), call('S', '2C'), call('W', 'P')], 'N')
  it('3-korts stöd + 6 stödpoäng → 3♣ (höjning); bust med 3-korts stöd → pass', () => {
    expect(adv('S:JT52 H:K96 D:87 C:Q84').call).toMatchObject({ bid: '3C', rule: 'höjning' })
    expect(adv('S:JT52 H:JT96 D:87 C:T84').call.bid).toBe('P')
    expect(adv('S:JT52 H:K96 D:87 C:Q84').källa).toBe('tabell:advance')
  })
  it('3+ stöd och 11+ stödpoäng → cue 2♥ (limithöjning+, krav)', () => {
    expect(adv('S:A52 H:K96 D:Q87 C:Q84').call).toMatchObject({ bid: '2H', rule: 'cue (limithöjning+)' })
  })
  it('egen 5+ färg över partnerns, 8+ hp → 2♠ (naturlig, ej krav); aldrig deras färg', () => {
    expect(adv('S:KQ543 H:2 D:J432 C:K3').call).toMatchObject({ bid: '2S', rule: 'ny färg' })
    expect(adv('S:32 H:KQ543 D:J43 C:K32').call.bid).not.toBe('2H') // hjärter är deras — cue kräver stöd
  })
  it('jämn hand med stopp: 2NT från 11 hp; 8–10 utan stöd → pass (1NT finns inte)', () => {
    expect(adv('S:KQ54 H:A32 D:KJ43 C:J2').call).toMatchObject({ bid: '2NT', rule: 'NT-svar' })
    expect(adv('S:K954 H:A32 D:JT43 C:92').call.bid).toBe('P')
  })
  it('hoppinkliv lämnas åt det gamla lagret (spärrhöjningen)', () => {
    expect(decideCallTraced(ensam('N', 'S:K95 H:A2 D:J43 C:T9432', 'E'), [call('E', '1C'), call('S', '2S'), call('W', 'P')], 'N').källa).not.toBe('tabell:advance')
  })
  it('1-lägesinkliv: advancerns nya färg på billigaste nivån (1♠ över 1♥), källa tabell:advance', () => {
    const t = decideCallTraced(ensam('N', 'S:KQ543 H:2 D:432 C:K432', 'E'), [call('E', '1D'), call('S', '1H'), call('W', 'P')], 'N')
    expect(t.källa).toBe('tabell:advance')
    expect(t.call).toMatchObject({ bid: '1S', rule: 'ny färg' })
  })
  it('svararen bjöd något → inte advancerns lugna läge (det gamla lagret / advance2)', () => {
    expect(decideCallTraced(ensam('N', 'S:JT52 H:K96 D:87 C:Q84', 'E'), [call('E', '1H'), call('S', '2C'), call('W', '2H')], 'N').källa).not.toBe('tabell:advance')
  })
})

describe('raden *advance*: tvåfärgspreferens även när de höjt sin färg — med spelrum för pass', () => {
  it('frö 20262021: 1♠–(2NT)–3♠: Öst (12 hp, ♣AQT3) ger preferens 4♣', () => {
    const t = decideCallTraced(dealFromSeed(20262021), [call('S', '1S'), call('W', '2NT'), call('N', '3S')], 'E')
    expect(t.källa).toBe('tabell:advance')
    expect(t.call).toMatchObject({ bid: '4C', rule: 'advance tvåfärg (preferens)' })
  })
  it('frö 20270138: 1♥–(2NT)–4♥: Nord (10 hp, ♣Q2 ♦9) passar — preferens på 5-läget kräver 4+ kort OCH 8+ hp', () => {
    const t = decideCallTraced(dealFromSeed(20270138), [call('E', '1H'), call('S', '2NT'), call('W', '4H')], 'N')
    expect(t.källa).toBe('tabell:advance')
    expect(t.call.bid).toBe('P')
  })
  it('frö 20270064: 1♣–(2NT)–5♣: Öst (1 hp, fem hjärter) passar — inte 5♥', () => {
    const t = decideCallTraced(dealFromSeed(20270064), [call('N', 'P'), call('E', 'P'), call('S', '1C'), call('W', '2NT'), call('N', '5C')], 'E')
    expect(t.call.bid).toBe('P')
  })
  it('ostört: aldrig pass (som förut) — 1♦–(2♦ Michaels)–P → högfärgspreferens', () => {
    const t = decideCallTraced(ensam('N', 'S:K95 H:J82 D:J43 C:T943', 'E'), [call('E', '1D'), call('S', '2D'), call('W', 'P')], 'N')
    expect(t.källa).toBe('tabell:advance')
    expect(t.call).toMatchObject({ bid: '2S', rule: 'advance tvåfärg (preferens)' })
  })
})

describe('raden *inkliv2*: tvåfärgsinklivarens egen fortsättning', () => {
  it('frö 20261162: 1♥–(2NT)–4♥–P–P: Nord (20 hp, 6-5) bjuder vidare 5♣ i den starka zonen', () => {
    const t = decideCallTraced(dealFromSeed(20261162), [call('W', '1H'), call('N', '2NT'), call('E', '4H'), call('S', 'P'), call('W', 'P')], 'N')
    expect(t.källa).toBe('tabell:inkliv2')
    expect(t.call).toMatchObject({ bid: '5C', rule: 'tvåfärgsinkliv: bjuder vidare (stark)' })
  })
  it('svag zon: samma läge med 9 hp 5-5 → uttryckligt pass', () => {
    const t = decideCallTraced(ensam('N', 'S:2 H:3 D:KJ864 C:QJT73', 'W'), [call('W', '1H'), call('N', '2NT'), call('E', '4H'), call('S', 'P'), call('W', 'P')], 'N')
    expect(t.källa).toBe('tabell:inkliv2')
    expect(t.call.bid).toBe('P')
  })
  it('dubblat utan preferens → flykt till längsta visade färgen (felrapport #7)', () => {
    const t = decideCallTraced(ensam('N', 'S:2 H:3 D:KJ8642 C:QJT73', 'W'), [call('W', '1H'), call('N', '2NT'), call('E', 'X'), call('S', 'P'), call('W', 'P')], 'N')
    expect(t.källa).toBe('tabell:inkliv2')
    expect(t.call).toMatchObject({ bid: '3D', rule: 'tvåfärgsinkliv: flykt' })
  })
})

describe('raden *inkliv2*: inklivaren svarar fit-jumpen och Michaels-svaret på pass-eller-rätta', () => {
  it('frö 20270356: 1♠–(2♥)–P–(4♦ fit-jump)–P: Öst (♥AJ752, 9 hp = minimum) återgår 4♥ — inte 5♦', () => {
    const t = decideCallTraced(dealFromSeed(20270356), [call('N', '1S'), call('E', '2H'), call('S', 'P'), call('W', '4D'), call('N', 'P')], 'E')
    expect(t.källa).toBe('tabell:inkliv2')
    expect(t.call).toMatchObject({ bid: '4H', rule: 'inklivaren svarar fit-jump (minimum)' })
  })
  it('1-lägesinkliv: 1♦–(1♥)–P–(2♠ fit-jump)–P: minimum → 3♥, extra (12+) → 4♥', () => {
    const hist = [call('E', '1D'), call('S', '1H'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    expect(decideCallTraced(ensam('S', 'S:32 H:KQJ84 D:983 C:762', 'E'), hist, 'S').call).toMatchObject({ bid: '3H', rule: 'inklivaren svarar fit-jump (minimum)' })
    expect(decideCallTraced(ensam('S', 'S:32 H:KQJ84 D:A83 C:K62', 'E'), hist, 'S').call).toMatchObject({ bid: '4H', rule: 'inklivaren svarar fit-jump (utgång)' })
  })
  it('frö 20272323: 1♠–(2♠ Michaels)–3♠–(4♣ p/c)–P: Nord (♣J9854 ♦KJ) passar — inte 5♣; med ruter rättas till 4♦', () => {
    const hist = [call('W', '1S'), call('N', '2S'), call('E', '3S'), call('S', '4C'), call('W', 'P')]
    const t = decideCallTraced(dealFromSeed(20272323), hist, 'N')
    expect(t.källa).toBe('tabell:inkliv2')
    expect(t.call).toMatchObject({ bid: 'P', rule: 'tvåfärgsinkliv: passar pass-eller-rätta' })
    expect(decideCallTraced(ensam('N', 'S:K H:J5432 D:J9854 C:KJ', 'W'), hist, 'N').call).toMatchObject({ bid: '4D', rule: 'tvåfärgsinkliv: rättar till ruter' })
  })
})

describe('det gamla lagret: familjens detektorer är rivna (dubblingsfamiljens revs i familj 2)', () => {
  it('inklivsdetektorerna finns inte längre i CONTESTED_DETECTORS', () => {
    const ids = new Set(CONTESTED_DETECTORS.map((d) => d.id))
    for (const gone of ['maybeOvercall', 'partnerTwoSuiterToAnswer', 'ownDoubledTwoSuiterRescue', 'overcallerRaiseAdvance', 'overcallerCompetesAfterCueRaise', 'overcallerAnswersCueRaise', 'advancerPrefersOvercallSuit', 'advancerRespondsTo1NTOvercall', 'overcallerAnswersAdvance']) {
      expect(ids.has(gone), gone).toBe(false)
    }
    // Familj 2 (2026-09-08) rev dubblarens vakter och den tunna "tävla till fiten"-detektorn.
    expect(ids.has('advancerCompetesToFit')).toBe(false)
    expect(FORCED_DETECTORS.some((d) => d.id === 'doublerRaisesAdvance')).toBe(false)
  })
  it('med X på vår sida tiger tabellens advance2-rad — frö 20260811 går som förut till 4♠ (sedan familj 2 ur raden x-dubblaren)', () => {
    const d = dealOf('N', {
      N: 'S:T98762 H:KT854 D:8 C:3',
      E: 'S:Q4 H:J3 D:A97532 C:Q92',
      S: 'S:AKJ H:A762 D:K6 C:AJ75',
      W: 'S:53 H:Q9 D:QJT4 C:KT864',
    }, 'ns')
    const hist = [call('N', 'P'), call('E', '2D'), call('S', 'X'), call('W', '3D'), call('N', '3S'), call('E', 'P')]
    const t = decideCallTraced(d, hist, 'S')
    expect(t.källa).toBe('tabell:x-dubblaren')
    expect(decideCall(d, hist, 'S').bid).toBe('4S')
  })
})

describe('raden *konkurrens-slam*: samma företräde som steget hade i det gamla lagret', () => {
  it('kaptenens 4NT i konkurrens kommer ur tabellen (källa tabell:konkurrens-slam)', () => {
    // Partnern hoppade till 3♠ (inbjudande advance) över deras 1♦; jag har 18 sp,
    // kontroll i alla sidofärger och 5-korts spader → 4NT (1430 RKC).
    const d = dealOf('E', {
      E: 'S:2 H:J93 D:KQJ87 C:QT62',
      S: 'S:AKJ98 H:A5 D:A4 C:A873',
      W: 'S:63 H:KQ8742 D:9652 C:9',
      N: 'S:QT754 H:T6 D:T3 C:KJ54',
    })
    const hist = [call('E', '1D'), call('S', '1S'), call('W', '2H'), call('N', '3S'), call('E', 'P')]
    const t = decideCallTraced(d, hist, 'S')
    expect(t.call.bid).toBe('4NT')
    expect(t.källa).toBe('tabell:konkurrens-slam')
  })
})
