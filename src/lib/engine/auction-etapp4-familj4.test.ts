// MOTORBYTET ETAPP 4 FAMILJ 4 — öppnarens och svararens fortsättning när de
// stört vår öppning, i beslutstabellen (docs/motorbyte-plan.md, 2026-09-08).
// Facit för det som är NYTT i familjen; det som flyttade oförändrat (§5.4
// maximal dubbling, §5.8 rond två, §5.9 återöppningen, §5.10 sangen efter
// minorhöjning, felrapport #55:s fria bud, svaret på cue-höjningen) har sina
// gamla facit-filer kvar (auction-live.test.ts, auction-fritt-bud-minor.test.ts,
// auction-opener-reopen-passed.test.ts, auction-inklivaren-svarar-cue.test.ts
// m.fl.) och körs nu genom tabellen.
//
// Nytt i familjen:
//   · raden *inkliv-över-svaret*: RHO:s naturliga inkliv över vårt 1-lägessvar
//     bjuds ur RHO:s egen hand (sandwich-sitsen: bara enkla inkliv i en objuden
//     färg, 10+ på 1-läget, 11+ på 2-läget) — manuset lägger det, och
//     öppnarens återbud kommer ur tabellen i stället för det gamla lagrets
//     catch-all (4♠ på 13 hp, reverse på 14, cue som passades);
//   · raden *öppnaren-stört*: öppnarens återbud efter partnerns fria bud UTAN
//     fit (egen 6+, sang med stopp, ny färg utan reverse, sist egen 5-korts);
//     svaret på partnerns cue (negativ-dubblarens 13+-cue);
//   · raden *svararen-stört*: svararens fortsättning efter sitt fria bud när
//     öppnaren inte höjde (egen 6+ före 3-korts fit, facit 20262632), svaret
//     på öppnarens cue (§5.8 — förr passades det), negativ-dubblarens ojämna
//     13+ utan stopp → cue (utgångskrav).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideCall, decideCallTraced } from './auction-live'
import { dealFromSeed } from './revisor'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
function dealOf(dealer: Seat, hands: Record<Seat, string>, vul: Deal['vulnerability'] = 'none'): Deal {
  return { id: 'f4', dealer, vulnerability: vul, board: 1, hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) } }
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

describe('raden *inkliv-över-svaret*: RHO:s naturliga inkliv över vårt 1-lägessvar (sandwich)', () => {
  const hist = [call('N', '1D'), call('E', 'P'), call('S', '1H')]
  it('5-korts kvalitetsfärg i en objuden färg, 10+ → enkelt inkliv ur tabellen', () => {
    const t = decideCallTraced(ensam('W', 'S:AQJ85 H:63 D:K92 C:T74'), hist, 'W')
    expect(t.källa).toBe('tabell:inkliv-över-svaret')
    expect(t.call).toMatchObject({ bid: '1S', rule: 'enkelt inkliv' })
  })
  it('2-läget kräver 11+ och 6+ (eller 5 bra): ♣KQJ85 med 11 → 2♣; ♣J8532 med 11 → pass', () => {
    expect(decideCallTraced(ensam('W', 'S:K63 H:A4 D:92 C:KQJ85'), hist, 'W').call).toMatchObject({ bid: '2C', rule: 'enkelt inkliv' })
    expect(decideCallTraced(ensam('W', 'S:K63 H:A4 D:Q9 C:J8532'), hist, 'W').call).toMatchObject({ bid: 'P' })
  })
  it('deras färger inklivs aldrig, och svag hand passar ur tabellen (inte det gamla lagret)', () => {
    expect(decideCallTraced(ensam('W', 'S:63 H:A4 D:KQJ85 C:T742'), hist, 'W').call).toMatchObject({ bid: 'P' })
    const t = decideCallTraced(ensam('W', 'S:QJ852 H:63 D:92 C:T743'), hist, 'W')
    expect(t.källa).toBe('tabell:inkliv-över-svaret')
    expect(t.call.bid).toBe('P')
  })
  it('4-4 i de objudna dubblar först (raden *dubbling*), 17+ med egen färg dubblar (stark)', () => {
    expect(decideCallTraced(ensam('W', 'S:AQ85 H:63 D:92 C:KQ74'), hist, 'W').källa).toBe('tabell:dubbling')
    expect(decideCallTraced(ensam('W', 'S:AKQ85 H:63 D:A2 C:KQ74'), hist, 'W').call).toMatchObject({ bid: 'X', rule: 'upplysningsdubbling (stark)' })
  })
  it('manuset lägger inklivet ur RHO:s egen hand och lämnar auktionen öppen', () => {
    const d = dealOf('N', {
      N: 'S:K72 H:Q3 D:AQ843 C:J32', // 12 hp → 1♦
      E: 'S:T64 H:874 D:T85 C:J865', // pass
      S: 'S:83 H:AKJ65 D:962 C:Q74', // 1♥
      W: 'S:AQJ975 H:T9 D:A7 C:KT9', // 13 hp, 6 spader → 1♠ (sandwich)
    })
    const b = buildAuction(d)!
    expect(b.turns.slice(0, 3).map((t) => t.call)).toEqual(['1D', '1H', '1S'])
    expect(b.turns[2]).toMatchObject({ seat: 'W', role: 'motståndare', rule: 'enkelt inkliv' })
  })
})

describe('raden *öppnaren-stört*: öppnarens återbud när de stört', () => {
  it('partnerns fria högfärgsbud står: 3-korts stöd höjer (flyttat, källa tabell:öppnaren-stört)', () => {
    const t = decideCallTraced(ensam('N', 'S:AJ9 H:63 D:AKJ85 C:T74'), [call('N', '1D'), call('E', '1H'), call('S', '1S'), call('W', 'P')], 'N')
    expect(t.källa).toBe('tabell:öppnaren-stört')
    expect(t.call).toMatchObject({ bid: '2S', rule: 'höjning av fritt bud' })
  })
  it('utan fit (nytt): sang med stopp 12–14 → 1NT; 18–19 → 2NT', () => {
    const hist = [call('N', '1D'), call('E', '1H'), call('S', '1S'), call('W', 'P')]
    expect(decideCallTraced(ensam('N', 'S:K6 H:KJ4 D:AQ985 C:Q74'), hist, 'N').call).toMatchObject({ bid: '1NT', rule: 'återbud i konkurrens: sang' })
    expect(decideCallTraced(ensam('N', 'S:K6 H:KJ4 D:AQJ85 C:AQ4'), hist, 'N').call).toMatchObject({ bid: '2NT', rule: 'återbud i konkurrens: sang (18–19)' })
  })
  it('utan fit (nytt): egen 6+ → rebjud; ny lägre färg → naturligt; reverse kräver 17+, annars egen 5-korts', () => {
    const hist = [call('N', '1D'), call('E', '1H'), call('S', '1S'), call('W', 'P')]
    expect(decideCallTraced(ensam('N', 'S:6 H:Q84 D:AKQJ85 C:K74'), hist, 'N').call).toMatchObject({ bid: '2D', rule: 'återbud i konkurrens: egen 6+ färg' })
    expect(decideCallTraced(ensam('N', 'S:6 H:K84 D:AQJ85 C:KJ74'), hist, 'N').call).toMatchObject({ bid: '2C', rule: 'återbud i konkurrens: ny färg' })
    // 1♣–(1♦)–1♠–(P): den högre nya färgen (hjärter) = 5-4 UTAN stopp i deras
    // ruter, öppningsstyrka (ägarregel 2026-09-12: inte längre ett 17+-reverse).
    const h2 = [call('N', '1C'), call('E', '1D'), call('S', '1S'), call('W', 'P')]
    expect(decideCallTraced(ensam('N', 'S:6 H:KQ84 D:85 C:AQJ85'), h2, 'N').call).toMatchObject({ bid: '2H', rule: 'återbud i konkurrens: 5-4 utan stopp' })
    // Med stopp i deras ruter (♦A5) men singel → varken 2NT (obalanserad) eller
    // 5-4-utan-stopp → 17+ reverse gäller fortfarande.
    expect(decideCallTraced(ensam('N', 'S:6 H:KQ84 D:A5 C:AKJ85'), h2, 'N').call).toMatchObject({ bid: '2H', rule: 'återbud i konkurrens: reverse' })
  })
  it('§5.8 flyttad: fiten mäts mot vad svaret lovade — ett OSTÖRT 1♥-svar (4+) höjs inte på tre kort, ett fritt 1♠ (5+) höjs', () => {
    // 1♦–(P)–1♥–(2♠): 1♥ är 4+, tre hjärter är ingen fit → minimum utan 6+ ruter → pass (null → gamla lagret passar)
    const ostört = [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', '2S')]
    expect(decideCall(ensam('N', 'S:63 H:K84 D:AQJ85 C:K74'), ostört, 'N').bid).toBe('P')
    // 1♦–(1♥)–1♠–(2♥): 1♠ är fritt (5+) → 3-korts stöd + minimum → 2♠ (tävlar)
    const fritt = [call('N', '1D'), call('E', '1H'), call('S', '1S'), call('W', '2H')]
    const t = decideCallTraced(ensam('N', 'S:K63 H:84 D:AQ985 C:K74'), fritt, 'N')
    expect(t.källa).toBe('tabell:öppnaren-stört')
    expect(t.call).toMatchObject({ bid: '2S', rule: 'öppnaren tävlar (stödjer partnern)' })
  })
  it('flyttat: svaret på cue-höjningen, den maximala dubblingen, återöppningen A och B', () => {
    expect(decideCallTraced(ensam('N', 'S:63 H:AQJ85 D:K84 C:K74'), [call('N', '1H'), call('E', '2D'), call('S', '3D'), call('W', 'P')], 'N').call).toMatchObject({ bid: '3H', rule: 'svar på cue-höjning' })
    expect(decideCallTraced(ensam('N', 'S:63 H:AQJ85 D:K84 C:KQ4'), [call('N', '1H'), call('E', '2D'), call('S', '2H'), call('W', '3D')], 'N').call).toMatchObject({ bid: 'X', rule: 'maximal dubbling (game try)' })
    expect(decideCallTraced(ensam('N', 'S:63 H:84 D:A5 C:AQJ854'), [call('N', '1C'), call('E', '1S'), call('S', 'P'), call('W', '2S')], 'N').call).toMatchObject({ bid: '3C', rule: 'öppnaren tävlar efter partnerns pass (egen 6+ färg)' })
    expect(decideCallTraced(ensam('N', 'S:AQJ85 H:6 D:K984 C:K74'), [call('N', '1S'), call('E', '2H'), call('S', 'P'), call('W', 'P')], 'N').call).toMatchObject({ bid: 'X', rule: 'öppnarens återöppningsdubbling (utpassningssits)' })
  })
  it('nytt: öppnaren svarar negativ-dubblarens cue — stopp → 3NT, annars egen 6+ / partnerns färg', () => {
    const hist = [call('N', '1D'), call('E', '1S'), call('S', 'X'), call('W', 'P'), call('N', '2C'), call('E', 'P'), call('S', '2S'), call('W', 'P')]
    expect(decideCallTraced(ensam('N', 'S:K63 H:84 D:AQJ85 C:K74'), hist, 'N').call).toMatchObject({ bid: '3NT', rule: 'svar på partnerns cue' })
    expect(decideCallTraced(ensam('N', 'S:63 H:84 D:AQJ985 C:K74'), hist, 'N').call).toMatchObject({ bid: '3D', rule: 'svar på partnerns cue' })
  })
})

describe('raden *svararen-stört*: svararens fortsättning när de stört', () => {
  it('frö 20262632 (facit-kön): 1♦–(1♠)–2♥–P–3♦–P → 4♥, den egna 8-korts färgen före 3-korts ♦-fit', () => {
    const deal = dealFromSeed(20262632)
    const hist = [call('E', 'P'), call('S', '1D'), call('W', '1S'), call('N', '2H'), call('E', 'P'), call('S', '3D'), call('W', 'P')]
    const t = decideCallTraced(deal, hist, 'N')
    expect(t.källa).toBe('tabell:svararen-stört')
    expect(t.call.bid).toBe('4H')
  })
  it('efter mitt fria bud och öppnarens minimum-rebud: 10–12 passar eller höjer inbjudande; 13+ → 3NT med stopp / utgång med fit / cue utan stopp', () => {
    const hist = [call('N', '1D'), call('E', '1S'), call('S', '2H'), call('W', 'P'), call('N', '3D'), call('E', 'P')]
    expect(decideCallTraced(ensam('S', 'S:K5 H:AQJ85 D:Q4 C:T874'), hist, 'S').call).toMatchObject({ bid: 'P' })
    expect(decideCallTraced(ensam('S', 'S:65 H:AQJ85 D:Q4 C:AKJ4'), hist, 'S').call).toMatchObject({ bid: '3S', rule: 'fritt bud: cue (utgångskrav)' })
    // Inbjudande höjning bara när den ryms på 3-läget: 1♣–(1♥)–1♠–P–2♣–P med 3 klöver och 12 hp → 3♣
    const h2 = [call('N', '1C'), call('E', '1H'), call('S', '1S'), call('W', 'P'), call('N', '2C'), call('E', 'P')]
    expect(decideCallTraced(ensam('S', 'S:KQ742 H:962 D:A2 C:K75'), h2, 'S').call).toMatchObject({ bid: '3C', rule: 'fritt bud: inbjudande höjning' })
    expect(decideCallTraced(ensam('S', 'S:KJ5 H:AQJ85 D:Q4 C:K74'), hist, 'S').call).toMatchObject({ bid: '3NT' })
    expect(decideCallTraced(ensam('S', 'S:65 H:AQJ85 D:KQ4 C:K74'), hist, 'S').call).toMatchObject({ bid: '5D' })
  })
  it('nytt: svaret på öppnarens cue (§5.8) — stopp → 3NT, egen 6+ högfärg → 4M, 3-korts stöd i öppnarens högfärg → 4M', () => {
    const hist = [call('N', '1C'), call('E', '1H'), call('S', '1S'), call('W', '2H'), call('N', '3H'), call('E', 'P')]
    expect(decideCallTraced(ensam('S', 'S:KQ854 H:A3 D:J74 C:T62'), hist, 'S').call).toMatchObject({ bid: '3NT', rule: 'svar på partnerns cue' })
    expect(decideCallTraced(ensam('S', 'S:KQJ854 H:63 D:J74 C:T6'), hist, 'S').call).toMatchObject({ bid: '4S', rule: 'svar på partnerns cue' })
    const h2 = [call('N', '1H'), call('E', '2D'), call('S', '2S'), call('W', '3D'), call('N', '4D'), call('E', 'P')]
    expect(decideCallTraced(ensam('S', 'S:KQ854 H:A73 D:74 C:T62'), h2, 'S').call).toMatchObject({ bid: '4H', rule: 'svar på partnerns cue' })
  })
  it('nytt: negativ-dubblarens ojämna 13+ utan stopp → cue (utgångskrav); med stopp → 3NT som förr', () => {
    const hist = [call('N', '1D'), call('E', '1S'), call('S', 'X'), call('W', 'P'), call('N', '2C'), call('E', 'P')]
    const t = decideCallTraced(ensam('S', 'S:63 H:AQJ85 D:KQ84 C:A7'), hist, 'S')
    expect(t.källa).toBe('tabell:svararen-stört')
    expect(t.call).toMatchObject({ bid: '2S', rule: 'negativ-dubblarens cue (utgångskrav)' })
    expect(decideCallTraced(ensam('S', 'S:A63 H:AQJ8 D:KQ8 C:J74'), hist, 'S').call).toMatchObject({ bid: '3NT', rule: 'negativ-dubblarens utgång' })
  })
  it('nytt: svaret på öppnarens återöppningsdubbling — straffpass med längd i deras färg, annars längsta färg, 4M med 5+ och 12+', () => {
    const utpass = [call('N', '1H'), call('E', '2D'), call('S', 'P'), call('W', 'P'), call('N', 'X'), call('E', 'P')]
    expect(decideCallTraced(ensam('S', 'S:T64 H:94 D:6532 C:K954'), utpass, 'S').call).toMatchObject({ bid: '3C', rule: 'svar på återöppningsdubbling' })
    expect(decideCallTraced(ensam('S', 'S:T64 H:94 D:KQ98 C:K954'), utpass, 'S').call).toMatchObject({ bid: 'P', rule: 'straffpass (återöppningsdubbling)' })
    expect(decideCallTraced(ensam('S', 'S:KQ854 H:94 D:63 C:AKJ4'), utpass, 'S').call).toMatchObject({ bid: '4S', rule: 'svar på återöppningsdubbling (utgång)' })
    const t = decideCallTraced(ensam('S', 'S:T64 H:K94 D:632 C:9854'), [call('N', '1C'), call('E', '1S'), call('S', 'P'), call('W', '2S'), call('N', 'X'), call('E', 'P')], 'S')
    expect(t.källa).toBe('tabell:svararen-stört')
    expect(t.call).toMatchObject({ bid: '3C', rule: 'svar på återöppningsdubbling' })
  })
  it('flyttat: accepterar game-try (4♥ med maximum), dömer sanginbjudan, går vidare efter höjt fritt bud', () => {
    expect(decideCallTraced(ensam('S', 'S:63 H:KJ85 D:Q84 C:K974'), [call('N', '1H'), call('E', '2D'), call('S', '2H'), call('W', '3D'), call('N', 'X'), call('E', 'P')], 'S').call).toMatchObject({ bid: '4H', rule: 'accepterar game-try' })
    expect(decideCallTraced(ensam('S', 'S:63 H:K85 D:QJ84 C:K974'), [call('N', '1D'), call('E', '1S'), call('S', '2D'), call('W', 'P'), call('N', '2NT'), call('E', 'P')], 'S').call).toMatchObject({ bid: '3NT', rule: 'accepterar sanginbjudan' })
    expect(decideCallTraced(ensam('S', 'S:KQ87432 H:63 D:84 C:A7'), [call('N', '1D'), call('E', '1H'), call('S', '1S'), call('W', 'P'), call('N', '2S'), call('E', 'P')], 'S').call).toMatchObject({ bid: '4S', rule: 'utgång efter höjt fritt bud' })
  })
})

describe('det rivna och familjegränsen', () => {
  // (Frånvaro-assertionen på FORCED_/CONTESTED_DETECTORS togs bort i etapp 5
  // session B, 2026-09-11: detektorkedjan är riven, inga listor kvar att pröva.)
  it('raderna gäller bara vår 1-i-färg-öppning i en störd auktion: ostört är det etapp 3:s rader', () => {
    expect(decideCallTraced(ensam('N', 'S:AJ9 H:63 D:AKJ85 C:T74'), [call('N', '1D'), call('E', 'P'), call('S', '1S'), call('W', 'P')], 'N').källa).toBe('tabell:återbud')
  })
})
