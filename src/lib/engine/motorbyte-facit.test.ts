// MOTORBYTETS FACIT-KÖ (docs/motorbyte-plan.md, grind 0 2026-09-04).
//
// Under motorbytet lappas inte manuset/detektorkedjan. Ett fel som hittas
// under tiden får sitt facit HÄR som `it.todo` — med frö, budföljd och det bud
// boken kräver — och lagas i det NYA lagret när familjen kommer (etapp 3/4).
// När familjen landar byts `it.todo` mot `it` och testet ska gå grönt.
//
// Facit-buden nedan är Claudes förslag ur boken; ägaren bekräftar dem vid
// familjens grind (mänsklig input i konkreta budsituationer hör dit).
//
// Återskapa en giv: $env:DUMP='<frö>'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { dealFromSeed } from './revisor'
import { decideCall } from './auction-live'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

// Fynd ur etapp 3 familj 1 (2026-09-04): manuset skrev öppningen för den FÖRSTA
// stol som klassades som öppnare; passade människan den handen ("skulle" ha
// öppnat) fanns ingen regel för nästa stol och given passades ut. Med tabellen
// bjuder varje stol i öppningsposition ur egen hand + passen hittills.
describe('etapp 3 familj 1 – öppningen per stol (LANDAD 2026-09-04)', () => {
  it('frö 20270021: Syd (12 hp, skulle öppna 1♣) passar → Väst (♠KJ98 ♥AK3 ♦QJ ♣QJ76, 17 hp) öppnar 1NT — inte pass', () => {
    const deal = dealFromSeed(20270021)
    expect(decideCall(deal, [call('S', 'P')], 'W').bid).toBe('1NT')
  })

  it('frö 20270018: Nord (7 hp, skulle spärra 3♥) passar → Öst (♠KQT42 ♥QJ ♦84 ♣AKQT, 17 hp) öppnar 1♠ — inte pass', () => {
    const deal = dealFromSeed(20270018)
    expect(decideCall(deal, [call('N', 'P')], 'E').bid).toBe('1S')
  })

  it('frö 20270003: Öst (15 hp, skulle öppna 1NT) passar, Syd passar → Syd i 3:e hand (♠AQT973 ♥AJ7 ♦762 ♣8, 11 hp) öppnar 1♠', () => {
    const deal = dealFromSeed(20270003)
    expect(decideCall(deal, [call('E', 'P'), call('S', 'P')], 'W').bid).toBe('P')
    expect(decideCall(deal, [call('E', 'P')], 'S').bid).toBe('1S')
  })
})

// Bifynd under familj 1 (2026-09-04): öppnar människan en hand som motorn inte
// klassar som öppning, och ingen annan stol heller gör det, finns inget manus
// alls ('ingen öppning') — partnern svarar aldrig. Familj 2 (svaret) ska svara
// på det bud som FAKTISKT bjöds, ur egen hand.
describe('etapp 3 familj 2 – svaret: partnern svarar på det bud som bjöds (LANDAD 2026-09-04)', () => {
  it('frö 20271606: Syd öppnar 1♠ (♠A852 ♥Q7 ♦AJ93 ♣985, 11 hp – motorn hade passat); Nord (♠J63 ♥A863 ♦Q752 ♣AT, 11 hp, 3-korts stöd) svarar 1NT (semi-forcing) — inte pass', () => {
    const deal = dealFromSeed(20271606)
    expect(decideCall(deal, [call('S', '1S'), call('W', 'P')], 'N').bid).toBe('1NT')
  })
})

// Familj A-slamporten efter öppnarens 1NT-återbud (12–14) räknade kaptenen med
// stödpoäng: en 6-5-hand med två kortfärger lyftes från 10 hp till slam-
// inbjudan (5♠) och öppnaren accepterade till 6♠. Porten fanns live för vanliga
// 1NT-återbud; familj 4a gjorde den synlig även efter "oklart"-1NT. Lagad
// 2026-09-05: §5.2 räknar hp mot det visade intervallet (facit frö 20261317
// 2026-08-07: 15 hp → 4♥, inte slam).
describe('etapp 3 familj 4a – familj A-slamporten räknar hp mot 1NT-återbudet (§5.2) (LANDAD 2026-09-05)', () => {
  it('frö 20272122: 1♣–1♠–1NT: Väst (♠AQJ973 ♥2 ♦KT975 ♣T, 10 hp) bjuder INTE 5♠ (slaminbjudan)', () => {
    const deal = dealFromSeed(20272122)
    const hist = [call('N', 'P'), call('E', '1C'), call('S', 'P'), call('W', '1S'), call('N', 'P'), call('E', '1NT'), call('S', 'P')]
    expect(decideCall(deal, hist, 'W').bid).not.toBe('5S')
  })
})

// Familj 5 (2026-09-05): slamsekvenserna byggdes bara i manuset — vid bordet
// (människan i kaptenstolen, eller boten efter människans öppning) passades
// nyckelkortssvaret bort, Gerber-svaret likaså, och Gerber-stoppet 4NT lästes
// som en essfråga. Avvikelsedumpen (§3) visade fallen; tabellraden *slam* tar
// varje tur ur egen hand.
describe('etapp 3 familj 5 – slamutredningen per stol (LANDAD 2026-09-05)', () => {
  it('frö 20270017: 2♣–3♦–4♦–4NT–5♦: Väst (♠A5 ♥AJ7 ♦AKQ97 ♣Q97) placerar 6♦ på nyckelkortssvaret — inte pass', () => {
    const deal = dealFromSeed(20270017)
    const hist = [call('W', 'P'), call('N', 'P'), call('E', '2C'), call('S', 'P'), call('W', '3D'), call('N', 'P'), call('E', '4D'), call('S', 'P'), call('W', '4NT'), call('N', 'P'), call('E', '5D'), call('S', 'P')]
    expect(decideCall(deal, hist, 'W').bid).toBe('6D')
  })

  it('frö 20270043: 1NT–4♣ (Gerber)–4♠: Väst (♠763 ♥AQJT52 ♦8 ♣T84 hade människan; boten i stolen räknar ess) placerar — 6NT med två egna ess + två visade', () => {
    const deal = dealFromSeed(20270043)
    const hist = [call('N', 'P'), call('E', '1NT'), call('S', 'P'), call('W', '4C'), call('N', 'P'), call('E', '4S'), call('S', 'P')]
    expect(decideCall(deal, hist, 'W').bid).not.toBe('P')
  })

  it('frö 20270139: 2NT–4♣–4♦–4NT (Gerber: stannar, två ess saknas): Nord passar — 4NT är inget RKC', () => {
    const deal = dealFromSeed(20270139)
    const hist = [call('S', 'P'), call('W', 'P'), call('N', '2NT'), call('E', 'P'), call('S', '4C'), call('W', 'P'), call('N', '4D'), call('E', 'P'), call('S', '4NT'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('P')
  })

  // Familj 6 (2026-09-05): efter 2♣–positivt–3y läser öppnaren 4NT som essfrågan
  // i y (senast bjudna färg, samma regel som det gamla lagrets `slamAskTrump`);
  // kaptenen som menade sin EGEN självbärande färg (§4.4 "utan trumf") får sin
  // avsikt via captainIntent — de två kan skilja sig åt (frö 20271008: Nord
  // svarar 5♦ = tre nyckelkort i hjärter, Syd frågade för spader och placerar
  // ändå 6♠). Efter reverse/hoppskift tiger öppnarens läsning helt; kaptenen
  // placerar via captainOwnSituation (frö 20272351: 1♣–1♠–2♥–4NT–5♦ → 6♥).
  it.todo('bok-mot-motor-fynd 14: 1♦–1♠–2♥–4NT (reverse) och 2♣–2♠–3♥–4NT — 4NT utan bjuden fit är tvetydigt (vilken färg är trumf?); kaptenen ska sätta trumfen (eller inbjuda i den) före essfrågan', () => {
    const reverse = [call('N', '1D'), call('E', 'P'), call('S', '1S'), call('W', 'P'), call('N', '2H'), call('E', 'P'), call('S', '4NT'), call('W', 'P')]
    expect(decideCall(dealFromSeed(20270001), reverse, 'N').rule).toBe('1430 RKC')
  })
})

// Pliktsvepets två rester (pausat 2026-09-04, docs/bevaka.md 2026-09-02).

describe('etapp 4 familj 1 – inkliv och advance: tvåfärgsinklivarens fortsättning', () => {
  it.todo('frö 20261162: 1♥–(2NT)–4♥–P–P: Nord (♠A ♥K ♦A8643 ♣AKT732, 20 hp, 6-5) bjuder 5♣ — inte pass', () => {
    const deal = dealFromSeed(20261162)
    const hist = [call('W', '1H'), call('N', '2NT'), call('E', '4H'), call('S', 'P'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('5C')
  })

  it.todo('frö 20262021: 1♠–(2NT)–3♠: Öst (♠T832 ♥J2 ♦KQJ ♣AQT3, 12 hp, stöd i båda lågfärgerna) bjuder 4♣ — inte pass', () => {
    const deal = dealFromSeed(20262021)
    const hist = [call('S', '1S'), call('W', '2NT'), call('N', '3S')]
    expect(decideCall(deal, hist, 'E').bid).toBe('4C')
  })
})

// Motorfynd ur betydelsesvepet (etapp 1, 2026-09-04): motorn bjuder ett bud vars
// systembetydelse (läst ur auktionen) är en annan än den hand motorn har.

describe('etapp 3 familj 4 – svararens andra bud efter stark 2♣ (§4.4)', () => {
  it.todo('frö 20271509: 2♣–2♦–2♠: Syd (♠63 ♥654 ♦876 ♣A9543, 5 hp) får inte bjuda 3♣ som naturlig klöver — 3♣ ÄR andra negativa (0–3 hp); med 4+ hp och 5 klöver bjuds något annat (t.ex. 3♠-stöd/2NT enligt boken)', () => {
    const deal = dealFromSeed(20271509)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '2C'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    const c = decideCall(deal, hist, 'S')
    expect(c.bid === '3C' && c.rule !== 'andra negativa').toBe(false)
  })
})

describe('etapp 3 familj 4/5 – stark 2♣: en auktionsform, en betydelse', () => {
  it.todo('frö 20271084: 2♣–3♦–3♥–4♦ måste betyda samma sak som 2♣–3♦–3♠–4♦ (frö 20271411, manuset: cue-bid) — idag naturlig rebud via kravsteget', () => {
    const deal = dealFromSeed(20271084)
    const hist = [call('W', 'P'), call('N', '2C'), call('E', 'P'), call('S', '3D'), call('W', 'P'), call('N', '3H'), call('E', 'P')]
    const c = decideCall(deal, hist, 'S')
    // En namngiven regel ur tabellen — aldrig kravstegets "auktionen är krav"-fallback.
    expect(c.rule?.startsWith('krav – ')).toBe(false)
  })
})

describe('etapp 3 familj 3 – öppnarens återbud efter svag tvåa (§4.5) (LANDAD 2026-09-05)', () => {
  it('frö 20271048: 2♠–3♥ (krav): Öst (♠KJ9653 ♥A98 ♦5 ♣JT2) höjer till 4♥, inte 5♥ — utgången är 4♥ och 5♥ är ingen slaminbjudan med svag tvåa', () => {
    const deal = dealFromSeed(20271048)
    const hist = [call('N', 'P'), call('E', '2S'), call('S', 'P'), call('W', '3H'), call('N', 'P')]
    expect(decideCall(deal, hist, 'E').bid).toBe('4H')
  })
})

describe('etapp 4 familj 4 – svararens fortsättning i konkurrens', () => {
  it.todo('frö 20262632: 1♦–(1♠)–2♥–P–3♦–P: Nord (♠A ♥AKJ87542 ♦T97 ♣7) bjuder 4♥ — den egna 8-korts färgen vinner över 3-korts ♦-fit (inte 5♦)', () => {
    const deal = dealFromSeed(20262632)
    const hist = [call('E', 'P'), call('S', '1D'), call('W', '1S'), call('N', '2H'), call('E', 'P'), call('S', '3D'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('4H')
  })
})

// §5b beslut 1 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 6 + 15): över
// öppnarens 1NT-återbud (12–14) är 4♣ Gerber BARA för den jämna handen utan
// färg att visa (räknar 33 mot visade 12 → Gerber; 31–32 → kvantitativ 4NT).
// Har svararen en färg — 6+ egen högfärg eller 5+ i öppnarens lågfärg — går
// den via New Minor Forcing: efter öppnarens svar rebjuds högfärgen (3M = 6+,
// slamintresse, utgångskrav) eller höjs lågfärgen (3m = 5+ stöd, slamintresse),
// och slammen frågas med 4NT RKC i den SATTA trumfen. Slam med känd färg går
// aldrig via 4♣/4NT direkt; inbjudan 5M/4♦ direkt över 1NT finns inte längre.
describe('§5b beslut 1 – 4♣ över 1NT-återbudet är Gerber bara utan färg att visa; färgen går via NMF (LANDAD 2026-09-05)', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  // 1♣–1♠–1NT: Nord ♠32 ♥A54 ♦A65 ♣KJT94 (12), Syd ♠AKQJ97 ♥KQ ♦KQJ ♣32 (21).
  const nord = 'S:32 H:A54 D:A65 C:KJT94'
  const syd = 'S:AKQJ97 H:KQ D:KQJ C:32'
  const h1 = [call('N', '1C'), P('E'), call('S', '1S'), P('W'), call('N', '1NT'), P('E')]

  it('6-korts spader + 21 hp över 1NT → 2♦ New Minor Forcing, inte 4♣ (Gerber är den jämna handen utan färg)', () => {
    expect(bud(syd, h1, 'S')!.call).toMatchObject({ bid: '2D', rule: 'New Minor Forcing' })
  })

  it('efter öppnarens 2NT rebjuder svararen 3♠ (6+, slamintresse, utgångskrav); öppnaren sätter trumfen med 4♠; kaptenen frågar 4NT och placerar 6♠', () => {
    expect(bud(nord, [...h1, call('S', '2D'), P('W')], 'N')!.call.bid).toBe('2NT')
    const h2 = [...h1, call('S', '2D'), P('W'), call('N', '2NT'), P('E')]
    expect(bud(syd, h2, 'S')!.call).toMatchObject({ bid: '3S', rule: 'NMF: rebjuder egen högfärg' })
    const h3 = [...h2, call('S', '3S'), P('W')]
    expect(bud(nord, h3, 'N')!.call).toMatchObject({ bid: '4S', rule: 'NMF: trumfen satt' })
    const h4 = [...h3, call('N', '4S'), P('E')]
    expect(bud(syd, h4, 'S')).toMatchObject({ källa: 'tabell:slam', call: { bid: '4NT' } })
    const h5 = [...h4, call('S', '4NT'), P('W')]
    expect(bud(nord, h5, 'N')!.call.bid).toBe('5H') // två nyckelkort (♥A ♦A) utan trumfdam
    const h6 = [...h5, call('N', '5H'), P('E')]
    expect(bud(syd, h6, 'S')!.call.bid).toBe('6S')
  })

  it('6-korts högfärg med utgångsvärden (13–18) efter NMF utan stöd → 4M, inte 3NT', () => {
    const h2 = [...h1, call('S', '2D'), P('W'), call('N', '2NT'), P('E')]
    expect(bud('S:AQJ976 H:K4 D:K52 C:32', h2, 'S')!.call.bid).toBe('4S') // 13 hp
  })

  it('frö 20270949: 1♣–1♥–1NT: Nord (♠A98 ♥AKQT72 ♦AQT9 ♣–, 20 hp) bjuder 2♦ NMF — inte 5♥; sedan 3♥, Syd 4♥, Nord inbjuder 5♥ (20+12 = 32)', () => {
    const deal = dealFromSeed(20270949)
    const h = [P('E'), call('S', '1C'), P('W'), call('N', '1H'), P('E'), call('S', '1NT'), P('W')]
    expect(decideCall(deal, h, 'N').bid).toBe('2D')
    const h2 = [...h, call('N', '2D'), P('E')]
    expect(decideCall(deal, h2, 'S').bid).toBe('2NT') // ♠K2 stopp, minimum
    const h3 = [...h2, call('S', '2NT'), P('W')]
    expect(decideCall(deal, h3, 'N').bid).toBe('3H')
    const h4 = [...h3, call('N', '3H'), P('E')]
    expect(decideCall(deal, h4, 'S').bid).toBe('4H')
    const h5 = [...h4, call('S', '4H'), P('W')]
    expect(decideCall(deal, h5, 'N').bid).toBe('5H')
  })

  it('5+ kort i öppnarens lågfärg + slamvärden (19+) → NMF, sedan 3♦ (stöd, slamintresse); öppnaren beskriver (3NT-förslag / 4♦); kaptenen cue:ar över 4♦', () => {
    const h = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '1NT'), P('E')]
    const syd2 = 'S:AKQ4 H:A6 D:KQ863 C:J2' // 19 hp, 5 ruter mot öppnarens 3+
    expect(bud(syd2, h, 'S')!.call).toMatchObject({ bid: '2C', rule: 'New Minor Forcing' })
    const nord2 = 'S:J7 H:KQ3 D:AT72 C:QJ42' // 13 hp
    const h2 = [...h, call('S', '2C'), P('W')]
    expect(bud(nord2, h2, 'N')!.call.bid).toBe('2NT')
    const h3 = [...h2, call('N', '2NT'), P('E')]
    expect(bud(syd2, h3, 'S')!.call).toMatchObject({ bid: '3D', rule: 'NMF: höjer öppnarens lågfärg' })
    const h4 = [...h3, call('S', '3D'), P('W')]
    expect(bud(nord2, h4, 'N')!.call.bid).toBe('4D') // ♠J7 otäckt → inget 3NT-förslag
    const h5 = [...h4, call('N', '4D'), P('E')]
    const k = bud(syd2, h5, 'S')
    expect(k?.källa).toBe('tabell:slam')
    expect(['4H', '4S', '4NT']).toContain(k!.call.bid) // 19+12 = 31: cue-ronden över 4♦
  })

  it('frö 20261109 (fynd 15): 1♣–1♠–1NT: Syd (♠AKQ4 ♥A6 ♦J2 ♣KQ863, 19 hp, 5 klöver) går NMF 2♦ — inte 4♣ — och höjer klövern: 2♥ (Nords 4-korts hjärter) → 3♣ → 4♣ → cue 4♥', () => {
    const deal = dealFromSeed(20261109) // Nord ♠J7 ♥QJ32 ♦AT7 ♣AJ42 öppnade 1♣ och rebjöd 1NT; förr accepterade manuset en "klöverinbjudan 4♣"
    const h = [call('W', 'P'), call('N', '1C'), P('E'), call('S', '1S'), P('W'), call('N', '1NT'), P('E')]
    expect(decideCall(deal, h, 'S')).toMatchObject({ bid: '2D', rule: 'New Minor Forcing' })
    const h2 = [...h, call('S', '2D'), P('W')]
    expect(decideCall(deal, h2, 'N').bid).toBe('2H')
    const h3 = [...h2, call('N', '2H'), P('E')]
    expect(decideCall(deal, h3, 'S')).toMatchObject({ bid: '3C', rule: 'NMF: höjer öppnarens lågfärg' })
    const h4 = [...h3, call('S', '3C'), P('W')]
    expect(decideCall(deal, h4, 'N')).toMatchObject({ bid: '4C', rule: 'NMF: höjning (GF)' }) // ♠J7 otäckt
    const h5 = [...h4, call('N', '4C'), P('E')]
    expect(decideCall(deal, h5, 'S')).toMatchObject({ bid: '4H', rule: 'cue-bid' }) // 19+12 = 31: cue-ronden över 4♣
  })

  it('jämn hand utan färg: 22 hp → 4♣ Gerber, 20 → kvantitativ 4NT, 5-korts högfärg → NMF (aldrig Gerber)', () => {
    const h = [call('N', '1C'), P('E'), call('S', '1H'), P('W'), call('N', '1NT'), P('E')]
    expect(bud('S:AK2 H:AK75 D:K64 C:AJ2', h, 'S')!.call).toMatchObject({ bid: '4C', rule: 'Gerber' }) // 22 hp
    expect(bud('S:A32 H:AK75 D:A64 C:AJ2', h, 'S')!.call).toMatchObject({ bid: '4NT', rule: 'kvantitativ 4NT' }) // 20 hp
    expect(bud('S:AK2 H:AK753 D:K6 C:AJ2', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'New Minor Forcing' }) // 22 hp, 5 hjärter
  })
})
