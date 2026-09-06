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
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand, seatAt } from '../bidding'
import { dealFromSeed } from './revisor'
import { auctionComplete, decideCall, decideCallTraced } from './auction-live'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

/** Giv ur Nords och Syds händer; resten av leken delas växelvis till Öst/Väst. */
const dealNS = (n: string, s: string): Deal => {
  const N = parseHand(n)
  const S = parseHand(s)
  const used = new Set([...N, ...S].map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  return { id: 'facit', dealer: 'N', vulnerability: 'none', board: 1, hands: { N, S, E: rest.filter((_, i) => i % 2 === 0), W: rest.filter((_, i) => i % 2 === 1) } }
}

/** Bottarna bjuder given klart ostört; buden i ordning. */
function spelaKlart(deal: Deal): string[] {
  const hist: ResolvedCall[] = []
  while (!auctionComplete(hist) && hist.length < 40) hist.push(decideCall(deal, hist, seatAt(deal.dealer, hist.length)))
  return hist.map((c) => c.bid)
}

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

  // Bok-mot-motor-fynd 14 → §5b beslut 14 (2026-09-06): naket 4NT = essfråga i
  // senast naturligt bjudna färg — facit-blocket "§5b beslut 14" sist i filen.
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

// §5b beslut 3 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 2): höjningen av
// öppnarens andra färg efter en REVERSE (1♦–1♠–2♥) delas i fast arrival —
// billig höjning 3M = stark (egna öppningsvärden 12+, 4+ stöd, slamintresse,
// utgångskrav; öppnaren öppnar 4-läget med kontrollbud), hopp till utgång 4M =
// den svagare handen (4+ stöd, ingen slamambition). Förr: billigaste höjning
// oavsett styrka ("ej krav" i motorn, "krav" i boken), och kaptenen frågade
// 4NT / inbjöd 5M direkt över reversen. Lågfärgsreverse (1♣–1♥–2♦) rörs inte.
describe('§5b beslut 3 – fast arrival efter reverse: 3M stark (GF, cue-ronden), 4M svag (LANDAD 2026-09-05)', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  // 1♦–1♠–2♥ (reverse, 16+): Syd har 4 hjärter.
  const h = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '2H'), P('E')]

  it('4+ stöd och egna öppningsvärden (13 hp) → billig höjning 3♥ (stark, utgångskrav, slamintresse)', () => {
    expect(bud('S:KQ84 H:AJ85 D:72 C:K63', h, 'S')!.call).toMatchObject({ bid: '3H', rule: 'reverse: höjning (stark)' })
  })

  it('4+ stöd med svagare hand (8 hp) → hopp till utgång 4♥ (fast arrival, ingen slamambition)', () => {
    expect(bud('S:KJ84 H:Q985 D:72 C:Q63', h, 'S')!.call).toMatchObject({ bid: '4H', rule: 'reverse: utgång' })
  })

  it('kaptenen frågar inte 4NT direkt över reversen längre: 17 hp med 4 hjärter → 3♥ först', () => {
    expect(bud('S:KQ84 H:AJ85 D:A2 C:K63', h, 'S')!.call.bid).toBe('3H') // 16 hp
    expect(bud('S:AQ84 H:AJ85 D:A2 C:K63', h, 'S')!.call.bid).toBe('3H') // 18 hp — förr 4NT
  })

  it('öppnaren öppnar cue-ronden med billigaste kontrollbud över 3♥ (3♠ med ♠A; 4♦ i egen första färg); utan kontroll under utgång → 4♥', () => {
    const h3 = [...h, call('S', '3H'), P('W')]
    expect(bud('S:A3 H:KQ72 D:AKJ85 C:Q4', h3, 'N')!.call).toMatchObject({ bid: '3S', rule: 'cue-bid' })
    expect(bud('S:K3 H:KQ72 D:AKJ85 C:Q4', h3, 'N')!.call).toMatchObject({ bid: '4D', rule: 'cue-bid' })
    expect(bud('S:K3 H:KQ72 D:KQJ85 C:K4', h3, 'N')!.call).toMatchObject({ bid: '4H', rule: 'cue: avslut' })
  })

  it('hela sekvensen: 3♥ → 4♦ (cue) → 4NT (kaptenen 17 + 16 = 33, bara klövern okontrollerad) → 5♠ (två nyckelkort + dam) → 6♥', () => {
    const syd = 'S:AQ84 H:AJ85 D:72 C:K63' // 16 hp + dubbelton
    const nord = 'S:K3 H:KQ72 D:AKJ85 C:Q4' // 17 hp
    const h4 = [...h, call('S', '3H'), P('W'), call('N', '4D'), P('E')]
    expect(bud(syd, h4, 'S')).toMatchObject({ källa: 'tabell:slam', call: { bid: '4NT' } })
    const h5 = [...h4, call('S', '4NT'), P('W')]
    expect(bud(nord, h5, 'N')!.call.bid).toBe('5S') // ♥K ♦A = två nyckelkort MED trumfdam
    const h6 = [...h5, call('N', '5S'), P('E')]
    expect(bud(syd, h6, 'S')!.call.bid).toBe('6H')
  })

  it('kaptenen med 13 hp (29 mot visade 16) avslutar i 4♥ efter öppnarens cue; efter öppnarens 4♥-avslut passar hon', () => {
    const syd = 'S:KQ84 H:AJ85 D:72 C:K63'
    const h4 = [...h, call('S', '3H'), P('W'), call('N', '4D'), P('E')]
    expect(bud(syd, h4, 'S')!.call).toMatchObject({ bid: '4H', rule: 'cue: avslut' })
    const deal = dealNS('S:K3 H:KQ72 D:KQJ85 C:K4', syd)
    const h4b = [...h, call('S', '3H'), P('W'), call('N', '4H'), P('E')]
    expect(decideCall(deal, h4b, 'S').bid).toBe('P')
  })

  it('efter öppnarens 4♥-avslut driver kaptenen ändå med 33+ (4NT) och inbjuder med 31–32 (5♥)', () => {
    const h4b = [...h, call('S', '3H'), P('W'), call('N', '4H'), P('E')]
    expect(bud('S:AQ84 H:AJ85 D:A2 C:K63', h4b, 'S')!.call.bid).toBe('4NT') // 18 + 16 = 34
    expect(bud('S:KQ84 H:AJ85 D:Q2 C:K63', h4b, 'S')!.call.bid).toBe('5H') // 15 hp + dubbelton = 16, + 16 = 32
    const h5 = [...h4b, call('S', '5H'), P('W')]
    expect(bud('S:K3 H:KQ72 D:KQJ85 C:K4', h5, 'N')!.call.rule).toMatch(/^slaminbjudan: /) // öppnaren dömer på sina Bergenpoäng
  })

  it('betydelselagret läser 3♥ som stark höjning (utgångskrav), 4♥ som fast arrival och öppnarens 4♦ som kontrollbud', () => {
    const h3 = [...h, call('S', '3H'), P('W')]
    expect(meaningOf(h3, 6)).toMatchObject({ rule: 'reverse: höjning (stark)', forcing: 'utgangskrav' })
    expect(meaningOf([...h, call('S', '4H')], 6)).toMatchObject({ rule: 'reverse: utgång' })
    expect(meaningOf([...h3, call('N', '4D')], 8).rule).toBe('cue-bid')
  })

  it('lågfärgsreverse rörs inte: 1♣–1♥–2♦ med 4 ruter höjs billigast som förut', () => {
    const hm = [call('N', '1C'), P('E'), call('S', '1H'), P('W'), call('N', '2D'), P('E')]
    expect(bud('S:K84 H:AJ85 D:K963 C:72', hm, 'S')!.call.bid).toBe('3D')
  })
})

// §5b beslut 7 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 7): efter 2♣–3♦–3M
// är 4♦ NATURLIGT i båda fallen (rebud av egen färg: 6+ eller bra 5 utan
// 3-stöd, utgångskravet står). Stöd visas i stället: 3+ stöd + slamintresse →
// kontrollbud i NY färg på 4-läget (4♣ över 3♥/3♠, 4♥ över 3♠) som sätter
// öppnarens högfärg; 3+ stöd utan kontrollbud att visa → 4M direkt (fast
// arrival, samma logik som beslut 3). Förr: 4♦ = cue i 3♠-fallet (frö 20271411)
// men naturlig rebud via kravsteget i 3♥-fallet (frö 20271084) — en auktion,
// två betydelser. Ny färg på 3-läget (2♣–3♦–3♥–3♠) är naturlig, inte cue.
describe('§5b beslut 7 – 4♦ naturligt efter 2♣–3♦–3M; kontrollbud i ny färg sätter öppnarens högfärg', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const hH = [call('N', '2C'), P('E'), call('S', '3D'), P('W'), call('N', '3H'), P('E')]
  const hS = [call('N', '2C'), P('E'), call('S', '3D'), P('W'), call('N', '3S'), P('E')]

  it('frö 20271084: Syd (♠K95 ♥8 ♦KQJ82 ♣J964) rebjuder 4♦ ur TABELLEN — bra 5 utan 3-stöd, naturligt, utgångskravet står', () => {
    const deal = dealFromSeed(20271084)
    const hist = [P('W'), call('N', '2C'), P('E'), call('S', '3D'), P('W'), call('N', '3H'), P('E')]
    expect(decideCallTraced(deal, hist, 'S')).toMatchObject({ källa: 'tabell:svar2', call: { bid: '4D', rule: '2♣: rebud egen färg (GF)' } })
  })

  it('frö 20271411: Syd (♠J75 ♥J53 ♦AK942 ♣T9) bjuder 4♠ direkt — 3-stöd utan kontrollbud i ny färg = fast arrival, inte cue 4♦; 4♠ blir slutbudet', () => {
    const deal = dealFromSeed(20271411)
    const hist = [call('N', '2C'), P('E'), call('S', '3D'), P('W'), call('N', '3S'), P('E')]
    expect(decideCall(deal, hist, 'S').bid).toBe('4S')
    const kontrakt = spelaKlart(deal).filter((b) => b !== 'P')
    expect(kontrakt[kontrakt.length - 1]).toBe('4S')
  })

  it('3-stöd + slamintresse: kontrollbud i NY färg — 4♣ över 3♥ och 3♠ (♣A), 4♥ över 3♠ (♥A); den egna rutern cue:as aldrig', () => {
    expect(bud('S:J75 H:J53 D:AK942 C:A9', hS, 'S')!.call).toMatchObject({ bid: '4C', rule: 'cue-bid' })
    expect(bud('S:J75 H:J53 D:AK942 C:A9', hH, 'S')!.call).toMatchObject({ bid: '4C', rule: 'cue-bid' })
    expect(bud('S:J75 H:A53 D:KQ942 C:T9', hS, 'S')!.call).toMatchObject({ bid: '4H', rule: 'cue-bid' })
    expect(bud('S:J75 H:J53 D:AK942 C:T9', hH, 'S')!.call.bid).toBe('4H') // ♦A är i egen färg → ingen cue → 4♥
  })

  it('ny färg på 3-läget är naturlig, inte cue: med ♠A och 3 hjärter över 3♥ (32 mot visade 22) bjuds 4♥ (fast arrival), aldrig 3♠ som kontrollbud', () => {
    expect(bud('S:A75 H:J53 D:KJ942 C:T9', hH, 'S')!.call.bid).toBe('4H')
  })

  it('33+ mot visade 22 utan kontrollbud i ny färg → 4NT direkt (essfråga i öppnarens färg)', () => {
    expect(bud('S:KQ5 H:KJ3 D:KQJ92 C:Q9', hS, 'S')!.call).toMatchObject({ bid: '4NT', rule: '1430 RKC' }) // 17 + 22 = 39
  })

  it('utan 3-stöd: 6+ egen färg → 4♦; 5 med sidokorthet → 4♦; bra 5 i 5-3-3-2 → 3NT (sangen ligger under rebuden); tunn 5 utan korthet → 3NT', () => {
    expect(bud('S:K5 H:8 D:QJ8632 C:J964', hS, 'S')!.call).toMatchObject({ bid: '4D', rule: '2♣: rebud egen färg (GF)' })
    expect(bud('S:T H:QJ8 D:KT964 C:KJ82', hS, 'S')!.call.bid).toBe('4D') // singel i partnerns färg, 5-kortsfärg
    expect(bud('S:JT H:K94 D:KQJT8 C:T43', hS, 'S')!.call.bid).toBe('3NT') // frö 20271242: 5-3-3-2 med bra ruter
    expect(bud('S:KJ5 H:82 D:KJ862 C:Q94', hH, 'S')!.call.bid).toBe('3NT')
  })

  it('öppnaren rättar partnerns 3NT till 4♠ med 6+ spader (frö 20271242); med 5 står 3NT', () => {
    const deal = dealFromSeed(20271242)
    const hist = [P('E'), call('S', '2C'), P('W'), call('N', '3D'), P('E'), call('S', '3S'), P('W'), call('N', '3NT'), P('E')]
    expect(decideCall(deal, hist, 'S')).toMatchObject({ bid: '4S', rule: 'rättelse till högfärg' })
    const h3 = [...hS, call('S', '3NT'), P('W')]
    expect(bud('S:AKQ97 H:T6 D:92 C:AKQ2', h3, 'N')).toBeNull()
  })

  it('betydelselagret: 4♦ = naturlig rebud (utgångskrav) i båda fallen, 4♣ = kontrollbud som sätter högfärgen, 3♠ över 3♥ = naturlig, öppnarens cue i svararens färg läses som cue', () => {
    expect(meaningOf([...hS, call('S', '4D')], 6)).toMatchObject({ rule: '2♣: rebud egen färg (GF)', forcing: 'utgangskrav' })
    expect(meaningOf([...hH, call('S', '4D')], 6)).toMatchObject({ rule: '2♣: rebud egen färg (GF)', forcing: 'utgangskrav' })
    expect(meaningOf([...hS, call('S', '4C')], 6).rule).toBe('cue-bid')
    expect(meaningOf([...hH, call('S', '4C')], 6).rule).toBe('cue-bid')
    expect(meaningOf([...hH, call('S', '3S')], 6).rule).not.toBe('cue-bid')
    expect(meaningOf([...hS, call('S', '4S')], 6).rule).not.toBe('cue-bid')
    expect(meaningOf([...hH, call('S', '4C'), P('W'), call('N', '4D')], 8).rule).toBe('cue-bid')
  })

  it('hela sekvensen bot mot bot: 2♣–3♦–3♠–4♣ (cue, spader satt) → … → 6♠', () => {
    const deal = dealNS('S:AKT84 H:KQ D:T C:AK753', 'S:J75 H:J53 D:AK942 C:A9')
    const bud = spelaKlart(deal)
    expect(bud.slice(0, 8)).toEqual(['2C', 'P', '3D', 'P', '3S', 'P', '4C', 'P'])
    const kontrakt = bud.filter((b) => b !== 'P')
    expect(kontrakt[kontrakt.length - 1]).toBe('6S')
  })
})

// §5b beslut 14 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 14): ett NAKET 4NT
// utan satt trumf är essfrågan i den SENAST naturligt bjudna färgen ("last bid
// suit"): 1♦–1♠–2♥–4NT = hjärter (reverse), 1♦–1♠–3♥–4NT = hjärter (hoppskift),
// 2♣–2♠–3♥–4NT = hjärter, 1♠–2♣–2♦–4NT = ruter. Över partnerns sangbud är 4NT
// kvantitativt (beslut 1, §5.7). Förr: öppnarens läsning teg efter reverse/
// hoppskift (kaptenen fick placera själv), betydelselagret läste frågarens EGEN
// senaste färg, och boten kunde fråga naket 4NT för en annan färg än den
// senast bjudna (öppnarens första färg efter reverse, egen solid färg efter 2♣).
// Nu sätter boten alltid trumfen först — naket 4NT frågar bara i senast bjudna
// färg — så tvetydigheten uppstår bara efter en människas bud.
describe('§5b beslut 14 – naket 4NT = essfråga i senast bjudna färg', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const reverse = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '2H'), P('E'), call('S', '4NT'), P('W')]
  const hoppskift = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '3H'), P('E'), call('S', '4NT'), P('W')]
  const tvaKlover = [call('N', '2C'), P('E'), call('S', '2S'), P('W'), call('N', '3H'), P('E'), call('S', '4NT'), P('W')]

  it('öppnaren svarar ur TABELLEN på 4NT efter sin reverse — nyckelkorten räknas med hjärter som trumf (♥K är nyckelkort, ♠K inte)', () => {
    // ♠K3 ♥KQ72 ♦AKJ85 ♣Q4: nyckelkort i hjärter = ♥K + ♦A = 2 (utan ♥Q? ♥Q finns → 5♠); i spader vore det ♠K + ♦A.
    expect(bud('S:K3 H:KQ72 D:AKJ85 C:Q4', reverse, 'N')).toMatchObject({ källa: 'tabell:slam', call: { bid: '5S', rule: '1430 RKC' } })
    // ♠A3 ♥J972 ♦AKJ85 ♣Q4: ♠A + ♦A = 2 nyckelkort utan trumfdam → 5♥ (i spader hade ♠A räknats lika, men ♥-damen saknas).
    expect(bud('S:A3 H:J972 D:AKJ85 C:Q4', reverse, 'N')!.call).toMatchObject({ bid: '5H', rule: '1430 RKC' })
    expect(decideCallTraced(dealFromSeed(20270001), reverse, 'N').källa).toBe('tabell:slam')
  })

  it('samma regel efter hoppskift (1♦–1♠–3♥–4NT = hjärter) och efter 2♣–2♠–3♥ (hjärter)', () => {
    expect(bud('S:K3 H:KQ72 D:AKJ85 C:Q4', hoppskift, 'N')!.call).toMatchObject({ bid: '5S', rule: '1430 RKC' })
    expect(bud('S:K3 H:AKQ72 D:AK5 C:AQ4', tvaKlover, 'N')!.call).toMatchObject({ bid: '5C', rule: '1430 RKC' }) // ♥A ♥K ♦A ♣A = 4 nyckelkort → 5♣
  })

  it('betydelselagret: 4NT efter reverse/hoppskift/2♣-färg = essfråga i den senast bjudna färgen, över sang-återbudet kvantitativt', () => {
    expect(meaningOf(reverse, 6).text).toContain('hjärter som trumf')
    expect(meaningOf(hoppskift, 6).text).toContain('hjärter som trumf')
    expect(meaningOf(tvaKlover, 6).text).toContain('hjärter som trumf')
    const tvaOverEtt = [call('N', '1S'), P('E'), call('S', '2C'), P('W'), call('N', '2D'), P('E'), call('S', '4NT'), P('W')]
    expect(meaningOf(tvaOverEtt, 6).text).toContain('ruter som trumf')
    const overNT = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '1NT'), P('E'), call('S', '4NT'), P('W')]
    expect(meaningOf(overNT, 6).rule).toBe('4NT kvantitativ')
  })

  it('boten frågar aldrig naket 4NT för en ANNAN färg än den senast bjudna: fit bara i öppnarens första färg efter reverse → inget nakent 4NT', () => {
    const h = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '2H'), P('E')]
    const c = bud('S:AKJ84 H:3 D:KQ96 C:A52', h, 'S') // 17 hp, 4 ruter, singel hjärter
    expect(c?.call.bid).not.toBe('4NT')
    const h2c = [call('N', '2C'), P('E'), call('S', '2S'), P('W'), call('N', '3H'), P('E')]
    const c2 = bud('S:AKQJ74 H:3 D:K96 C:Q52', h2c, 'S') // solid spader, 14 hp, ingen hjärterfit
    expect(c2?.call.bid).not.toBe('4NT')
  })
})
