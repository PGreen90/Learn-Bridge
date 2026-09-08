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

describe('etapp 4 familj 1 – inkliv och advance: tvåfärgsinklivarens fortsättning (LANDAD 2026-09-08)', () => {
  it('frö 20261162: 1♥–(2NT)–4♥–P–P: Nord (♠A ♥K ♦A8643 ♣AKT732, 20 hp, 6-5) bjuder 5♣ — inte pass', () => {
    const deal = dealFromSeed(20261162)
    const hist = [call('W', '1H'), call('N', '2NT'), call('E', '4H'), call('S', 'P'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('5C')
  })

  it('frö 20262021: 1♠–(2NT)–3♠: Öst (♠T832 ♥J2 ♦KQJ ♣AQT3, 12 hp, stöd i båda lågfärgerna) bjuder 4♣ — inte pass', () => {
    const deal = dealFromSeed(20262021)
    const hist = [call('S', '1S'), call('W', '2NT'), call('N', '3S')]
    expect(decideCall(deal, hist, 'E').bid).toBe('4C')
  })
})

// Motorfynd ur betydelsesvepet (etapp 1, 2026-09-04): motorn bjuder ett bud vars
// systembetydelse (läst ur auktionen) är en annan än den hand motorn har.

describe('etapp 3 familj 4 – svararens andra bud efter stark 2♣ (§4.4)', () => {
  it('frö 20271509: 2♣–2♦–2♠: Syd (♠63 ♥654 ♦876 ♣A9543, 5 hp) bjuder 3♣ som NATURLIG klöver — §5b beslut 6 (2026-09-07) gjorde 3♣ naturligt (0–7, 5+) och flyttade andra negativa till 2NT; tvetydigheten är borta', () => {
    const deal = dealFromSeed(20271509)
    const hist = [call('E', 'P'), call('S', 'P'), call('W', 'P'), call('N', '2C'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    const c = decideCall(deal, hist, 'S')
    expect(c).toMatchObject({ bid: '3C', rule: 'ny färg (GF)' })
    expect(meaningOf([...hist, c], 9).rule).toBe('ny färg (GF)')
  })
})

describe('etapp 3 familj 3 – öppnarens återbud efter svag tvåa (§4.5) (LANDAD 2026-09-05)', () => {
  it('frö 20271048: 2♠–3♥ (krav): Öst (♠KJ9653 ♥A98 ♦5 ♣JT2) höjer till 4♥, inte 5♥ — utgången är 4♥ och 5♥ är ingen slaminbjudan med svag tvåa', () => {
    const deal = dealFromSeed(20271048)
    const hist = [call('N', 'P'), call('E', '2S'), call('S', 'P'), call('W', '3H'), call('N', 'P')]
    expect(decideCall(deal, hist, 'E').bid).toBe('4H')
  })
})

// Fynd ur etapp 4 familj 1 (2026-09-08): det gamla lagrets tvåfärgsläsare
// tog partnerns 2NT/cue EFTER vår egen upplysningsdubbling för ett
// tvåfärgsinkliv och "gav preferens". Tabellen läser rätt (ingen tvåfärg),
// men dubblarens fortsättning efter advancerns fria 2NT / cue saknar regel
// → facit åt familj 2.
describe('etapp 4 familj 2 – dubblarens fortsättning efter advancerns fria svar (LANDAD 2026-09-08)', () => {
  it('frö 20270004: 1♠–(X)–2♠–(2NT)–P: Syd (♠54 ♥AJ54 ♦AJ6 ♣KJ98, 14 hp) höjer partnerns fria 2NT (10–12) till 3NT — inte pass', () => {
    const deal = dealFromSeed(20270004)
    const hist = [call('N', 'P'), call('E', '1S'), call('S', 'X'), call('W', '2S'), call('N', '2NT'), call('E', 'P')]
    expect(decideCall(deal, hist, 'S').bid).toBe('3NT')
  })
  it('frö 20270461: 1♥–(X)–2♥–(X responsiv)–P–(3♥ cue)–P: Väst (♠5432 ♥T ♦J974 ♣AK86) svarar partnerns cue med 3♠ — inte pass', () => {
    const deal = dealFromSeed(20270461)
    const hist = [call('N', '1H'), call('E', 'X'), call('S', '2H'), call('W', 'X'), call('N', 'P'), call('E', '3H'), call('S', 'P')]
    expect(decideCall(deal, hist, 'W').bid).toBe('3S')
  })
})

describe('etapp 4 familj 6 – försvar mot 1NT: DONT-dubblarens fortsättning', () => {
  it.todo('frö 20272187: 1NT–(X DONT)–2♦–P–3♣–?: Syd (♠KQT763 ♥K9 ♦AQ ♣KJ2, 19 hp) visar sin enfärg 3♠ — inte pass (förr gav det starka X-flödet 3♠ av misstag; familj 2 kräver deras FÄRGöppning)', () => {
    const deal = dealFromSeed(20272187)
    const hist = [call('N', 'P'), call('E', '1NT'), call('S', 'X'), call('W', '2D'), call('N', 'P'), call('E', '3C')]
    expect(decideCall(deal, hist, 'S').bid).toBe('3S')
  })
})

describe('etapp 4 familj 4 – svararens fortsättning i konkurrens', () => {
  // Pliktsvepet K2, fynd ur etapp 4 familj 1 (2026-09-08): advancerns nya färg bjuds nu
  // billigast (1♠), så sekvensen 1♦–(1♥)–P–(1♠)–X–P–P–(2♣)–P uppstår — inklivaren ska ge
  // preferens till advancerns FÖRSTA färg (5+) med 3-3, inte passa (K2 = familj 4:s facit).
  it.todo('frö 20263370: 1♦–(1♥)–P–(1♠)–X–P–P–(2♣)–P: Nord (♠KT9 ♥AT876 ♦73 ♣J87) ger preferens 2♠ — inte pass', () => {
    const deal = dealFromSeed(20263370)
    const hist = [call('W', '1D'), call('N', '1H'), call('E', 'P'), call('S', '1S'), call('W', 'X'), call('N', 'P'), call('E', 'P'), call('S', '2C'), call('W', 'P')]
    expect(decideCall(deal, hist, 'N').bid).toBe('2S')
  })
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

// §5b beslut 2 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 1): fjärde färg efter
// en REVERSE (1♦–1♠–2♥–3♣) är KONSTLAD — en håll-/beskrivningsfråga, inte
// naturlig klöver. Reversen gör auktionen utgångskrav redan, men håll-frågan
// till 3NT är verklig. Boken §6.6 undantog reversen (rättad); motorn spelade
// redan så. Nytt i det nya lagret: öppnarens SVAR på fjärde färgen på 3-läget
// (förr det gamla lagrets "krav – rebjuder egen färg" oavsett hand, och 5♣ på
// fyra klöver).
describe('§5b beslut 2 – fjärde färg efter reverse är konstlad; öppnaren svarar ur tabellen', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const h = [call('N', '1D'), P('E'), call('S', '1S'), P('W'), call('N', '2H'), P('E')]
  const h3 = [...h, call('S', '3C'), P('W')]

  it('svararen med utgångsvärden utan klöverhåll och utan naturligt bud bjuder 3♣ = fjärde färg krav (konstlat, alert)', () => {
    expect(bud('S:KQ874 H:53 D:Q9 C:J864', h, 'S')!.call.bid).not.toBe('3C') // 9 hp → preferens, inte fjärde färg
    expect(bud('S:KQJ74 H:K3 D:Q9 C:J864', h, 'S')!.call).toMatchObject({ bid: '3C', rule: 'fjärde färg krav' }) // 12 hp (KQJ=6, K=3, Q=2, J=1), inget klöverhåll
    expect(meaningOf(h3, 6)).toMatchObject({ rule: 'fjärde färg krav', forcing: 'utgangskrav', alert: true })
  })

  it('öppnaren beskriver ur tabellen: 3-stöd i spader → 3♠; klöverhåll → 3NT; 6+ ruter → 3♦; 5-5 → 3♥; fyra klöver utan håll → 4♣', () => {
    expect(bud('S:A32 H:AKJ5 D:AKJ85 C:4', h3, 'N')!.call).toMatchObject({ bid: '3S', rule: 'svar på fjärde färg' })
    expect(bud('S:A3 H:AKJ5 D:AKJ85 C:K4', h3, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'svar på fjärde färg' })
    expect(bud('S:32 H:AKJ5 D:AKJ865 C:4', h3, 'N')!.call).toMatchObject({ bid: '3D', rule: 'svar på fjärde färg' })
    expect(bud('S:3 H:AKJ52 D:AKJ85 C:74', h3, 'N')!.call).toMatchObject({ bid: '3H', rule: 'svar på fjärde färg' })
    expect(bud('S:32 H:AKJ5 D:AKJ8 C:T643', h3, 'N')!.call).toMatchObject({ bid: '4C', rule: 'svar på fjärde färg' })
    expect(decideCallTraced(dealNS('S:32 H:AKJ5 D:AKJ8 C:T643', 'S:KQJ74 H:K3 D:Q9 C:J864'), h3, 'N').källa).toBe('tabell:tredje')
  })

  it('svararen placerar efter beskrivningen: 3♠ → 4♠, 3♦ → 3NT; hela auktionen 1♦–1♠–2♥–3♣–3♠–4♠', () => {
    expect(bud('S:KQJ74 H:K3 D:Q9 C:J864', [...h3, call('N', '3S'), P('W')], 'S')!.call.bid).toBe('4S')
    expect(bud('S:KQJ74 H:K3 D:Q9 C:J864', [...h3, call('N', '3D'), P('W')], 'S')!.call.bid).toBe('3NT')
    expect(spelaKlart(dealNS('S:A32 H:AKJ5 D:AKJ85 C:4', 'S:KQJ74 H:K3 D:Q9 C:J864')).slice(0, 12)).toEqual(['1D', 'P', '1S', 'P', '2H', 'P', '3C', 'P', '3S', 'P', '4S', 'P'])
  })
})

// §5b beslut 13 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 13): fjärde färg
// finns INTE när 2/1 är satt — "det räcker med game force en gång". Svararens
// nya färg efter 2/1 (1♠–2♣–2♦–2♥, 1♥–2♣–2♦–2♠, 1♠–2♥–3♣–3♦) är naturlig
// (4+ kort); utan håll och utan naturligt bud bjuds preferens/egen färg, och
// öppnaren — som vet att kravet står — bjuder sang med håll, höjer med fyra,
// visar egen längd eller ger preferens. Förr: spärren "fjärde färg har
// konventionell mening" höll svararen från sin 4-kortshögfärg, betydelselagret
// läste budet som konstgjort, och öppnarens svar låg i det gamla lagret.
describe('§5b beslut 13 – ingen fjärde färg efter 2/1: svararens nya färg är naturlig, öppnaren svarar ur tabellen', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const h = [call('N', '1S'), P('E'), call('S', '2C'), P('W'), call('N', '2D'), P('E')] // 1♠–2♣–2♦
  const h2H = [...h, call('S', '2H'), P('W')]

  it('svararen med 4 hjärter utan håll och utan stöd bjuder 2♥ naturligt (förr preferens — spärrat som "fjärde färg"); med håll går 3NT före; betydelselagret läser naturligt, ej alert', () => {
    expect(bud('S:K5 H:J972 D:83 C:AKQ64', h, 'S')!.call).toMatchObject({ bid: '2H', rule: '2/1: fortsättning' })
    expect(bud('S:K5 H:AQ72 D:83 C:KQJ64', h, 'S')!.call.bid).toBe('3NT') // hjärterhåll → sangen före (öppnaren nekade 4 hjärter)
    expect(meaningOf(h2H, 6)).toMatchObject({ forcing: 'utgangskrav', alert: false })
    expect(meaningOf(h2H, 6).rule).not.toBe('fjärde färg krav')
  })

  it('utan naturligt bud och utan håll i den objudna färgen: preferens/egen färg, aldrig ett konstgjort bud', () => {
    // ♠K5 ♥J73 ♦83 ♣KQJ642: inget hjärterhåll, 6 klöver → rebjuder 3♣.
    expect(bud('S:K5 H:J73 D:83 C:KQJ642', h, 'S')!.call.bid).toBe('3C')
    // ♠K52 ♥J73 ♦83 ♣KQJ64: 3-stöd → försenat stöd (fast arrival 4♠ med minimum).
    expect(bud('S:K52 H:J73 D:83 C:KQJ64', h, 'S')!.call.bid).toBe('4S')
  })

  it('öppnaren svarar ur tabellen på den naturliga 2♥: fyra hjärter → höjning; jämn hand → 2NT; 6+ spader → 2♠; ojämn med 3 klöver → preferens 3♣', () => {
    expect(bud('S:AQ864 H:KJ73 D:AQ4 C:5', h2H, 'N')!.call).toMatchObject({ bid: '3H', rule: '2/1: svar på ny färg' })
    expect(bud('S:AQ864 H:K3 D:AQ42 C:75', h2H, 'N')!.call).toMatchObject({ bid: '2NT', rule: '2/1: svar på ny färg' })
    expect(bud('S:AQJ864 H:53 D:AQ42 C:7', h2H, 'N')!.call).toMatchObject({ bid: '2S', rule: '2/1: svar på ny färg' })
    expect(bud('S:AQ864 H:5 D:AQ42 C:K72', h2H, 'N')!.call).toMatchObject({ bid: '3C', rule: '2/1: svar på ny färg' })
    expect(decideCallTraced(dealNS('S:AQ864 H:KJ73 D:AQ4 C:5', 'S:K5 H:J972 D:83 C:AKQ64'), h2H, 'N').källa).toBe('tabell:tredje')
  })

  it('samma i 2♥-formen: 1♠–2♥–3♣–3♦ är naturlig ruter (4+), inte fjärde färg', () => {
    const h3 = [call('N', '1S'), P('E'), call('S', '2H'), P('W'), call('N', '3C'), P('E')]
    expect(bud('S:5 H:AQJ72 D:J983 C:K64', h3, 'S')!.call.bid).toBe('3D')
    expect(meaningOf([...h3, call('S', '3D')], 6).rule).not.toBe('fjärde färg krav')
  })

  it('även efter öppnarens rebud av egen färg (1♥–2♦–2♥–3♣): öppnaren svarar 3♥ med 6+, svararen placerar 4♥ med 3-stöd i den rebjudna färgen; efter öppnarens HÖJNING (1♠–2♣–3♣–3♥) tiger raden (ny färg är cue/håll, inte naturlig)', () => {
    const hR = [call('N', '1H'), P('E'), call('S', '2D'), P('W'), call('N', '2H'), P('E'), call('S', '3C'), P('W')]
    expect(bud('S:K5 H:AQ9763 D:T7 C:A4', hR, 'N')!.call).toMatchObject({ bid: '3H', rule: '2/1: svar på ny färg' })
    expect(bud('S:KT8 H:K73 D:AKQJ C:J532', [...hR, call('N', '3H'), P('E')], 'S')!.call).toMatchObject({ bid: '4H', rule: '2/1: placerar utgång' })
    const hS = [call('N', '1S'), P('E'), call('S', '2D'), P('W'), call('N', '2H'), P('E'), call('S', '3C'), P('W'), call('N', '3H'), P('E')]
    expect(bud('S:Q9 H:KT9 D:AQ92 C:J972', hS, 'S')!.call.bid).toBe('4H') // frö 20270257: 3-stöd i öppnarens rebjudna andrafärg
    const hRaise = [call('N', '1S'), P('E'), call('S', '2C'), P('W'), call('N', '3C'), P('E'), call('S', '3H'), P('W')]
    expect(bud('S:K8632 H:KT8 D:A C:T732', hRaise, 'N')?.call.rule).not.toBe('2/1: svar på ny färg')
  })

  it('hela auktionen bot mot bot: 1♠–2♣–2♦–2♥ (naturlig) – 2NT (ingen fit, ingen extra längd) → 3NT', () => {
    const kontrakt = spelaKlart(dealNS('S:AQ864 H:KQ7 D:AQ42 C:5', 'S:K5 H:J972 D:83 C:AKQ64')).filter((b) => b !== 'P')
    expect(kontrakt.slice(0, 5)).toEqual(['1S', '2C', '2D', '2H', '2NT'])
    expect(kontrakt[kontrakt.length - 1]).toBe('3NT')
  })
})

// §5b beslut 4 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 3): kortfärgssvaret
// på splinterreläet efter 1♠–3♥–3♠ går i RENA STEG — kort ♣ → 3NT, kort ♦ → 4♣,
// kort ♥ → 4♦ (lägst möjligt hela vägen = mest rum för kontrollbud, samma logik
// som beslut 3). Förr: motorn 4♣/4♦/4♥ ("bjud din korta färg"), boken
// 3NT/4♣/4♥ (överhopp) — en auktion, tre tolkningar. 1♥–3♠–3NT-tabellen
// (4♣ = ♣, 4♦ = ♦, 4♥ = ♠) är redan rena steg och lämnas.
describe('§5b beslut 4 – rena steg i splinterreläet efter 1♠–3♥–3♠', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const hS = [call('N', '1S'), P('E'), call('S', '3H'), P('W'), call('N', '3S'), P('E')]
  const hH = [call('N', '1H'), P('E'), call('S', '3S'), P('W'), call('N', '3NT'), P('E')]

  it('1♠–3♥–3♠: kort klöver → 3NT, kort ruter → 4♣, kort hjärter → 4♦ (rena steg)', () => {
    expect(bud('S:KQ74 H:AJ85 D:K43 C:3', hS, 'S')!.call).toMatchObject({ bid: '3NT', rule: 'splinter: kortfärg' })
    expect(bud('S:KQ74 H:AJ85 D:3 C:K432', hS, 'S')!.call).toMatchObject({ bid: '4C', rule: 'splinter: kortfärg' })
    expect(bud('S:KQ74 H:3 D:AJ85 C:K432', hS, 'S')!.call).toMatchObject({ bid: '4D', rule: 'splinter: kortfärg' })
  })

  it('1♥–3♠–3NT lämnas: kort klöver → 4♣, kort ruter → 4♦, kort spader → 4♥', () => {
    expect(bud('S:K43 H:KQ74 D:AJ85 C:3', hH, 'S')!.call.bid).toBe('4C')
    expect(bud('S:K43 H:KQ74 D:3 C:AJ852', hH, 'S')!.call.bid).toBe('4D')
    expect(bud('S:3 H:KQ74 D:AJ85 C:K432', hH, 'S')!.call.bid).toBe('4H')
  })

  it('betydelselagret läser stegen: 3NT = kort klöver, 4♣ = kort ruter, 4♦ = kort hjärter (alert); efter 1♥ som förut', () => {
    expect(meaningOf([...hS, call('S', '3NT')], 6)).toMatchObject({ rule: 'splinter: kortfärg', alert: true })
    expect(meaningOf([...hS, call('S', '3NT')], 6).text).toContain('klöver')
    expect(meaningOf([...hS, call('S', '4C')], 6).text).toContain('ruter')
    expect(meaningOf([...hS, call('S', '4D')], 6).text).toContain('hjärter')
    expect(meaningOf([...hH, call('S', '4H')], 6).text).toContain('spader')
  })

  it('öppnaren fortsätter ur tabellen efter kortfärgssvaret: billigaste kontrollbud under 4♠ (4♦ med ♦A), 4♠ med honnörer mittemot kortheten; kaptenen avslutar/driver', () => {
    const h3NT = [...hS, call('S', '3NT'), P('W')] // kort klöver
    expect(bud('S:AJ9853 H:K4 D:AQ2 C:75', h3NT, 'N')).toMatchObject({ källa: 'tabell:slam', call: { bid: '4D', rule: 'cue-bid' } })
    expect(bud('S:AJ9853 H:74 D:Q52 C:KQ', h3NT, 'N')!.call).toMatchObject({ bid: '4S', rule: 'utgång' }) // ♣KQ mittemot singel = slöseri
    // Kaptenen (♠KQ74 ♥AJ85 ♦K43 ♣3: 16 stödpoäng mot visade 12 = 28) cue:ar ♥A gratis, sedan avslut 4♠.
    const h4D = [...h3NT, call('N', '4D'), P('E')]
    expect(bud('S:KQ74 H:AJ85 D:K43 C:3', h4D, 'S')!.call).toMatchObject({ bid: '4H', rule: 'cue-bid' })
    const h4H = [...h4D, call('S', '4H'), P('W')]
    expect(bud('S:AJ9853 H:K4 D:AQ2 C:75', h4H, 'N')!.call).toMatchObject({ bid: '4S', rule: 'cue: avslut' }) // inga fler kontroller under utgång (cue-ronden pågår)
    expect(bud('S:KQ74 H:AJ85 D:K43 C:3', [...h4H, call('N', '4S'), P('E')], 'S')!.call.bid).toBe('P') // 28 mot visade 12 → utgången står
  })

  it('efter 1♥–3♠–3NT–4♦ (kort ruter): inga kontrollbud ryms mellan 4♦ och 4♥ → öppnaren avslutar 4♥ (även med kontroll); kaptenen fortsätter över avslutet', () => {
    const h4D = [...hH, call('S', '4D'), P('W')]
    expect(bud('S:A4 H:AQJ85 D:K72 C:K53', h4D, 'N')!.call).toMatchObject({ bid: '4H', rule: 'utgång' }) // ♦K mittemot kort ruter = slöseri, 15 − 2 < 14
    expect(bud('S:AK4 H:AQJ85 D:752 C:K3', h4D, 'N')!.call.bid).toBe('4H') // inga kontrollbud mellan 4♦ och 4♥ → avslut; kaptenen fortsätter
    // Kortfärgssvaret 4♥ (kort spader) ÄR utgången: öppnaren passar (förr olagligt "4♥" → pass utan regel).
    expect(bud('S:AK4 H:AQJ85 D:752 C:K3', [...hH, call('S', '4H'), P('W')], 'N')!.call).toMatchObject({ bid: 'P', rule: 'utgång' })
  })
})

// §5b beslut 5 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 4): PASSAD HAND i
// minor. Del A: semi-forcing 1NT av passad hand behålls (naturligt, ej krav,
// öppnaren får passa) — limithöjningen gick via Drury, så 1NT döljer ingen.
// Del B: inverterat är AV för passad hand — `pass–…–1♦–2♦` = 6–11, 4+ stöd,
// ingen 4-korts högfärg, ENKEL HÖJNING (ej krav); öppnaren avgör om budgivningen
// går vidare (12–14 pass · 15–17 jämn 2NT-inbjudan · 18+ 3NT · 15+ ojämn
// stopp-visning, krav 1 rond). 3♦ kvar för den svaga formstarka höjningen
// (5+ ruter, under 6). Förr: motorn spelade inverterat även av passad hand
// (2♦ = 10+ krav, 7–9 med stöd → "gap-hand 1NT").
describe('§5b beslut 5 – passad hand: semi-forcing 1NT behålls, minorhöjningen är enkel (inverterat AV)', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const passadDeal = (n: string, s: string): Deal => ({ ...dealNS(n, s), dealer: 'S' })

  it('Del A: passad hands 1NT över 1♠ är semi-forcing som förut (naturligt, ej krav); läsaren säger passad hand; öppnaren med jämn minimum passar ur tabellen', () => {
    const hS = [P('S'), P('W'), call('N', '1S'), P('E')] // Syd passade, Nord öppnade 1♠ i tredje hand
    expect(bud('S:84 H:K973 D:Q752 C:J93', hS, 'S')!.call).toMatchObject({ bid: '1NT', rule: 'semi-forcing 1NT' })
    const m = meaningOf([...hS, call('S', '1NT')], 4)
    expect(m.rule).toBe('semi-forcing 1NT')
    expect(m.text).toContain('passad hand')
    const h1NT = [...hS, call('S', '1NT'), P('W')]
    expect(bud('S:AQ752 H:J4 D:K83 C:Q75', h1NT, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' })
    expect(decideCallTraced(passadDeal('S:AQ752 H:J4 D:K83 C:Q75', 'S:84 H:K973 D:Q752 C:J93'), h1NT, 'N').källa).toBe('tabell:återbud')
  })

  const h = [P('S'), P('W'), call('N', '1D'), P('E')] // Syd passade, Nord öppnade 1♦ i tredje hand

  it('Del B: passad hand med 4+ ruter utan 4-korts högfärg höjer 2♦ med 6–11 (förr 7–9 → "gap-hand 1NT", 10–11 → inverterad 2♦ krav); 3♦ bara under 6 hp med 5+; högfärgen går före; utan stöd 1NT som förut', () => {
    expect(bud('S:K84 H:J73 D:KQ75 C:T92', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'enkel höjning' }) // 9 hp
    expect(bud('S:K84 H:Q73 D:KQ75 C:J92', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'enkel höjning' }) // 11 hp
    expect(bud('S:84 H:973 D:KJ752 C:Q93', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'enkel höjning' }) // 6 hp, 5 ruter → inte 3♦
    expect(bud('S:84 H:973 D:KJ752 C:J93', h, 'S')!.call).toMatchObject({ bid: '3D', rule: 'inverterad minor, svag' }) // 5 hp, 5 ruter
    expect(bud('S:K843 H:J7 D:KQ75 C:T92', h, 'S')!.call.bid).toBe('1S') // 4-korts högfärg först
    expect(bud('S:K84 H:J73 D:Q75 C:KJ92', h, 'S')!.call).toMatchObject({ bid: '1NT', rule: '1NT' }) // bara 3 ruter
  })

  it('betydelselagret: passad hands 2♦ = enkel höjning (ej krav, ingen alert); opassad hands 2♦ är fortfarande inverterad', () => {
    expect(meaningOf([...h, call('S', '2D')], 4)).toMatchObject({ rule: 'enkel höjning', forcing: 'ej-krav', alert: false })
    expect(meaningOf([call('N', '1D'), P('E'), call('S', '2D')], 2).rule).toBe('inverterad minor')
  })

  const h2 = [...h, call('S', '2D'), P('W')] // pass–P–1♦–P–2♦–P

  it('öppnaren avgör: 12–14 passar; 15–17 jämn → 2NT (inbjudan); 18+ med håll överallt → 3NT; 15+ ojämn → billigaste äkta stopp (krav 1 rond)', () => {
    expect(bud('S:A73 H:K84 D:AJ82 C:Q75', h2, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 13 jämn
    expect(bud('S:K73 H:5 D:AQ842 C:KJ52', h2, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 13 ojämn (14 startpoäng — gränsen 15 mäts i startpoäng golvade vid hp)
    expect(bud('S:753 H:5 D:AKJ84 C:AQ85', h2, 'N')!.call).toMatchObject({ bid: '3C', rule: 'passad höjning: stopp-visning' }) // 14 hp men 16 startpoäng → går vidare
    expect(bud('S:AQ3 H:K84 D:AJ82 C:Q75', h2, 'N')!.call).toMatchObject({ bid: '2NT', rule: 'passad höjning: 2NT' }) // 16 jämn
    expect(bud('S:AQ3 H:KQ4 D:AJ82 C:KJ5', h2, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'passad höjning: 3NT' }) // 19 jämn
    expect(bud('S:AQ H:K5 D:AKJ842 C:A85', h2, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'passad höjning: 3NT' }) // 19 ojämn, alla sidofärger hållna
    expect(bud('S:AQ3 H:5 D:AKJ84 C:K853', h2, 'N')!.call).toMatchObject({ bid: '2S', rule: 'passad höjning: stopp-visning' }) // 17 ojämn: ♥ ohållen, ♠ först
    expect(decideCallTraced(passadDeal('S:AQ3 H:5 D:AKJ84 C:K853', 'S:K84 H:J73 D:Q975 C:T92'), h2, 'N').källa).toBe('tabell:återbud')
    expect(meaningOf([...h2, call('N', '2NT')], 6)).toMatchObject({ rule: 'passad höjning: 2NT', forcing: 'inbjudan' })
    expect(meaningOf([...h2, call('N', '2S')], 6)).toMatchObject({ rule: 'passad höjning: stopp-visning', forcing: 'krav-1-rond' })
  })

  it('svararen: på 2NT → 3NT med 9+, annars pass; på stopp-visningen → 3NT med 10+ och håll i resten, annars 3♦ (broms, ej krav); öppnarens 3NT passas', () => {
    const h2NT = [...h2, call('N', '2NT'), P('E')]
    expect(bud('S:K84 H:Q73 D:KQ75 C:J92', h2NT, 'S')!.call).toMatchObject({ bid: '3NT', rule: '3NT till spel' }) // 11
    expect(bud('S:K84 H:J73 D:Q975 C:T92', h2NT, 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' }) // 7
    const h2S = [...h2, call('N', '2S'), P('E')]
    expect(bud('S:K84 H:J73 D:KQ75 C:T92', h2S, 'S')!.call).toMatchObject({ bid: '3D', rule: 'passad höjning: broms' }) // 9
    expect(bud('S:K84 H:QJ3 D:KQ75 C:Q92', h2S, 'S')!.call).toMatchObject({ bid: '3NT', rule: '3NT till spel' }) // 11, ♥ och ♣ hållna
    expect(bud('S:K84 H:J73 D:KQ75 C:QJ2', h2S, 'S')!.call).toMatchObject({ bid: '3D', rule: 'passad höjning: broms' }) // 10 men ♥ ohållen
    expect(bud('S:K84 H:J73 D:KQ75 C:T92', [...h2, call('N', '3NT'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
    expect(meaningOf([...h2S, call('S', '3D')], 8)).toMatchObject({ rule: 'passad höjning: broms', forcing: 'ej-krav' })
  })

  it('öppnarens tredje bud efter bromsen: 15–17 passar; 18+ driver — andra stopp-visning under 3NT om den ryms, annars 5♦; svararen täcker resten med 3NT', () => {
    const h3D = [...h2, call('N', '2S'), P('E'), call('S', '3D'), P('W')]
    expect(bud('S:AQ3 H:5 D:AKJ84 C:K853', h3D, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 16
    expect(bud('S:AQ3 H:5 D:AKJ84 C:AK85', h3D, 'N')!.call).toMatchObject({ bid: '5D', rule: 'höjning till utgång' }) // 19, ♥ går inte att visa
    const h3D2 = [...h2, call('N', '2H'), P('E'), call('S', '3D'), P('W')] // öppnaren visade ♥-håll först
    expect(bud('S:AQ3 H:K5 D:AKQ842 C:85', h3D2, 'N')!.call).toMatchObject({ bid: '3S', rule: 'passad höjning: stopp-visning' }) // 18, ♣ ohållen → visar ♠
    const h3S = [...h3D2, call('N', '3S'), P('E')]
    expect(bud('S:K84 H:J73 D:J975 C:Q92', h3S, 'S')!.call).toMatchObject({ bid: '3NT', rule: '3NT till spel' }) // ♣Q92 täcker resten
    expect(bud('S:K84 H:J73 D:J975 C:T92', h3S, 'S')!.call).toMatchObject({ bid: '5D', rule: 'höjning till utgång' })
  })

  it('hela auktionen bot mot bot (Syd giv med 10 hp, passar): P–P–1♦–P–2♦–P–2♠–P–3NT', () => {
    // Alla fyra händerna givna så motståndarna (5 resp. 8 hp, inga inkliv) inte stör.
    const deal: Deal = { ...passadDeal('S:AQ3 H:5 D:AKJ84 C:K853', 'S:K42 H:QJ3 D:Q975 C:QT2'), hands: { N: parseHand('S:AQ3 H:5 D:AKJ84 C:K853'), S: parseHand('S:K42 H:QJ3 D:Q975 C:QT2'), E: parseHand('S:8765 H:AK42 D:2 C:J964'), W: parseHand('S:JT9 H:T9876 D:T63 C:A7') } }
    const kontrakt = spelaKlart(deal).filter((b) => b !== 'P')
    expect(kontrakt).toEqual(['1D', '2D', '2S', '3NT'])
  })
})

// §5b beslut 9 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 9): PASSAD HAND över
// 1♥/1♠ spelar Jacoby AV och Bergen AV — Drury tar alla limithöjningar.
// Strukturen efter pass: 2♣/2♦ Drury = 10–12 STÖDPOÄNG (3 resp. 4+ trumf);
// 2M = 6–9 med 3+ stöd; 3M = spärr, 4+ stöd under 6; 2NT = naturlig inbjudan
// ~11 hp balanserad utan 3-stöd (öppnaren 3NT med 14+, annars pass); 3♣/3♦ =
// naturliga, 6+ färg, ej krav. Förr föll passad hand utanför Drury-fönstret
// tillbaka på det vanliga svarsschemat (Bergen 3♣/3♦, Jacoby 2NT, splinter).
describe('§5b beslut 9 – passad hand över 1♥/1♠: Jacoby/Bergen AV, Drury på stödpoäng, 2NT naturlig inbjudan', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const passadDeal = (n: string, s: string): Deal => ({ ...dealNS(n, s), dealer: 'S' })
  const h = [P('S'), P('W'), call('N', '1H'), P('E')] // Syd passade, Nord öppnade 1♥ i tredje hand

  it('stödsvaren: Drury 2♦/2♣ på 10–12 stödpoäng (även 8 hp + singel med 4 trumf, även 12 hp + kortfärg — aldrig splinter/Jacoby); 2♥ = 6–9 med 3+ (förr Bergen 3♣); 3♥ = under 6 med 4+; 4♥ = 5+ trumf, svag, formstark', () => {
    expect(bud('S:K4 H:Q842 D:KJ95 C:Q43', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'Drury' }) // 11 hp, 4 trumf
    expect(bud('S:K43 H:Q84 D:KJ95 C:Q43', h, 'S')!.call).toMatchObject({ bid: '2C', rule: 'Drury' }) // 11 hp, 3 trumf
    expect(bud('S:5 H:Q842 D:KJ95 C:Q843', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'Drury' }) // 8 hp men singel → 10 stödpoäng
    expect(bud('S:5 H:Q842 D:AKJ5 C:J843', h, 'S')!.call).toMatchObject({ bid: '2D', rule: 'Drury' }) // 11 hp + singel (15 stödpoäng): förr tvetydig splinter
    expect(bud('S:43 H:Q842 D:K975 C:K43', h, 'S')!.call).toMatchObject({ bid: '2H', rule: 'enkel höjning' }) // 8 hp, 4 trumf, platt: förr Bergen 3♣ (frö 20272394-mönstret)
    expect(bud('S:K43 H:Q84 D:9752 C:J43', h, 'S')!.call).toMatchObject({ bid: '2H', rule: 'enkel höjning' }) // 6 hp, 3 trumf
    expect(bud('S:J5 H:Q8642 D:T975 C:43', h, 'S')!.call).toMatchObject({ bid: '3H', rule: 'spärrhöjning' }) // 3 hp, 5 trumf
    expect(bud('S:J5 H:Q8642 D:K975 C:43', h, 'S')!.call).toMatchObject({ bid: '4H', rule: 'spärr till utgång' }) // 6 hp, 5 trumf, under 10 stödpoäng (med singel blir det Drury — tröskeln går på stödpoäng)
  })

  it('utan stöd: 2NT = naturlig inbjudan (11 hp balanserad, högst 2 trumf); 3♣/3♦ = 6+ färg, svag, ej krav; annars semi-forcing 1NT / 1♠ som förut', () => {
    expect(bud('S:K43 H:Q8 D:KJ95 C:QJ43', h, 'S')!.call).toMatchObject({ bid: '2NT', rule: 'inbjudan' }) // 11 jämn
    expect(bud('S:43 H:8 D:K5 C:KJT9742', h, 'S')!.call).toMatchObject({ bid: '3C', rule: 'ny färg' }) // 7 hp, 7 klöver
    expect(bud('S:K43 H:Q8 D:J952 C:J843', h, 'S')!.call).toMatchObject({ bid: '1NT', rule: 'semi-forcing 1NT' }) // 7 jämn
    expect(bud('S:K843 H:Q8 D:J952 C:J43', h, 'S')!.call.bid).toBe('1S') // 4 spader först
  })

  it('betydelselagret: passad hands 3♣ är naturlig (ej krav, ingen alert — förr Bergen), 3♥ = spärrhöjning, 2NT = inbjudan; opassad 3♣ är fortfarande Bergen', () => {
    expect(meaningOf([...h, call('S', '3C')], 4)).toMatchObject({ rule: 'ny färg', forcing: 'ej-krav', alert: false })
    expect(meaningOf([...h, call('S', '3H')], 4)).toMatchObject({ rule: 'spärrhöjning', forcing: 'avslut' })
    expect(meaningOf([...h, call('S', '2NT')], 4)).toMatchObject({ rule: 'inbjudan', forcing: 'inbjudan', alert: false })
    expect(meaningOf([call('N', '1H'), P('E'), call('S', '3C')], 2).rule).toBe('Bergen konstruktiv')
  })

  const h2NT = [...h, call('S', '2NT'), P('W')]

  it('öppnaren på passad hands 2NT: 14+ → 3NT (4♥ med 6+ hjärter), minimum → pass, minimum med 6+ hjärter → 3♥ (avböjer); svararen passar sedan', () => {
    expect(bud('S:A5 H:AKJ62 D:Q43 C:432', h2NT, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'accepterar inbjudan' }) // 14
    expect(bud('S:A5 H:AKJ632 D:Q43 C:43', h2NT, 'N')!.call).toMatchObject({ bid: '4H', rule: 'accepterar inbjudan' }) // 14, 6 hjärter
    expect(bud('S:K5 H:AK962 D:Q43 C:432', h2NT, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 12
    expect(bud('S:K5 H:AK9632 D:Q43 C:43', h2NT, 'N')!.call).toMatchObject({ bid: '3H', rule: 'rebid: stanna' }) // 12, 6 hjärter
    expect(decideCallTraced(passadDeal('S:A5 H:AKJ62 D:Q43 C:432', 'S:K43 H:Q8 D:KJ95 C:QJ43'), h2NT, 'N').källa).toBe('tabell:återbud')
    expect(meaningOf([...h2NT, call('N', '3H')], 6)).toMatchObject({ rule: 'rebid: stanna', forcing: 'avslut' })
    expect(bud('S:K43 H:Q8 D:KJ95 C:QJ43', [...h2NT, call('N', '3H'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
    expect(bud('S:K43 H:Q8 D:KJ95 C:QJ43', [...h2NT, call('N', '3NT'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
  })

  it('öppnaren på passad hands 3♥ (spärr): 18+ → 4♥, annars pass; på 3♣ (6+ klöver, svag): pass med minimum, 3NT med 16+ jämn, 4♥ med 16+ och 6+ hjärter', () => {
    const h3H = [...h, call('S', '3H'), P('W')]
    expect(bud('S:AK5 H:AK962 D:A43 C:43', h3H, 'N')!.call).toMatchObject({ bid: '4H', rule: 'rebid: utgång' }) // 18
    expect(bud('S:K5 H:AK962 D:Q43 C:K32', h3H, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 14
    const h3C = [...h, call('S', '3C'), P('W')]
    expect(bud('S:K5 H:AK962 D:Q43 C:K32', h3C, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 14
    expect(bud('S:AQ5 H:AKJ62 D:Q43 C:43', h3C, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'rebid: 3NT' }) // 16 jämn
    expect(bud('S:AQ H:AKJ632 D:Q43 C:43', h3C, 'N')!.call).toMatchObject({ bid: '4H', rule: 'rebid: utgång' }) // 16, 6 hjärter
    expect(bud('S:K5 H:AKJ632 D:Q432 C:-', h3C, 'N')!.call).toMatchObject({ bid: '3H', rule: 'rebid: egen färg' }) // 13, 6 hjärter, renons i partnerns klöver → egen färg hellre än 3♣
    expect(bud('S:K5 H:AKJ632 D:Q43 C:2', [...h, call('S', '3D'), P('W')], 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' }) // 3 ruter hos öppnaren → 3♦ står
    expect(bud('S:43 H:8 D:K5 C:KJT9742', [...h3C, call('N', '3NT'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
  })

  it('hela auktionen bot mot bot (Syd giv, passar med 8 hp och 4 trumf): P–P–1♥–P–2♥ … (förr 3♣ Bergen)', () => {
    const deal: Deal = { ...passadDeal('S:AK5 H:AKJ62 D:Q43 C:J5', 'S:43 H:Q842 D:K975 C:K43'), hands: { N: parseHand('S:AK5 H:AKJ62 D:Q43 C:J5'), S: parseHand('S:43 H:Q842 D:K975 C:K43'), E: parseHand('S:QT97 H:T9 D:AJ8 C:T986'), W: parseHand('S:J862 H:753 D:T62 C:AQ72') } }
    const kontrakt = spelaKlart(deal).filter((b) => b !== 'P')
    expect(kontrakt.slice(0, 2)).toEqual(['1H', '2H'])
    expect(kontrakt[kontrakt.length - 1]).toBe('4H') // 17 + 8 med fyra trumf: game try → utgång
  })
})

// §5b beslut 6 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 5): efter 2♣–2♦–2M är
// hela svarsstrukturen NATURLIG — 3♣ = 0–7 hp, 5+ klöver; 3♦ = 0–7, 5+ ruter;
// 5-korts högfärg visas naturligt; 3+ stöd → 4M; den konstlade "jag har inget"-
// varningen (0–3, ingen 5-kortsfärg, ingen fit) FLYTTAR till 2NT. Öppnarens
// fortsättning efter 2NT ligger nu i tabellen (raden tredje): 6+ trumf → 3M
// (ej krav) eller 4M med 24+, andra 4+-färg → 3x naturligt (ej krav), annars 3M;
// svararen passar eller ger preferens/höjer (raden svar3). Förr: 3♣ = andra
// negativa (0–3), men motorn bjöd 3♣ naturligt med 4+ hp — samma bud, två
// betydelser (frö 20271509); öppnarens tredje bud låg i det gamla lagret.
describe('§5b beslut 6 – naturliga 3♣/3♦ efter 2♣–2♦–2M, andra negativa = 2NT', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const h = [call('N', '2C'), P('E'), call('S', '2D'), P('W'), call('N', '2S'), P('E')] // 2♣–2♦–2♠

  it('svararens andra bud: 5+ klöver → 3♣ naturligt även med 0–3 (frö 20271509-handen: 5 hp), 5+ ruter → 3♦, 5+ hjärter → 3♥, 3+ stöd → 4♠; bottenhand utan fit och utan 5-kortsfärg → 2NT (andra negativa); 4–7 utan fit → 3NT', () => {
    expect(bud('S:63 H:654 D:876 C:A9543', h, 'S')!.call).toMatchObject({ bid: '3C', rule: 'ny färg (GF)' }) // 5 hp — förr 3♣ men läst som andra negativa
    expect(bud('S:63 H:654 D:8762 C:J9543', h, 'S')!.call).toMatchObject({ bid: '3C', rule: 'ny färg (GF)' }) // 1 hp — förr andra negativa
    expect(bud('S:63 H:65 D:J8762 C:9543', h, 'S')!.call).toMatchObject({ bid: '3D', rule: 'ny färg (GF)' })
    expect(bud('S:63 H:Q8654 D:876 C:943', h, 'S')!.call).toMatchObject({ bid: '3H', rule: 'ny färg (GF)' })
    expect(bud('S:Q73 H:9842 D:7532 C:64', h, 'S')!.call).toMatchObject({ bid: '4S', rule: 'höjning (GF)' })
    expect(bud('S:73 H:9842 D:7532 C:J64', h, 'S')!.call).toMatchObject({ bid: '2NT', rule: 'andra negativa' })
    expect(bud('S:73 H:K842 D:Q532 C:J64', h, 'S')!.call).toMatchObject({ bid: '3NT', rule: 'till spel' })
  })

  it('betydelselagret: 2NT över 2♠ = andra negativa (ej krav), 3♣ = naturlig klöver (utgångskravet står); 2♣–2♦–2♥–3♣ likaså', () => {
    expect(meaningOf([...h, call('S', '2NT')], 6)).toMatchObject({ rule: 'andra negativa', forcing: 'ej-krav' })
    expect(meaningOf([...h, call('S', '3C')], 6)).toMatchObject({ rule: 'ny färg (GF)', forcing: 'utgangskrav', alert: false })
    const hH = [call('N', '2C'), P('E'), call('S', '2D'), P('W'), call('N', '2H'), P('E')]
    expect(meaningOf([...hH, call('S', '3C')], 6).rule).toBe('ny färg (GF)')
    expect(meaningOf([...hH, call('S', '2NT')], 6).rule).toBe('andra negativa')
  })

  const h2NT = [...h, call('S', '2NT'), P('W')]

  it('öppnaren efter 2NT (tabellen, raden tredje): 6+ trumf och 24+ → 4♠; 6+ trumf → 3♠ (ej krav); 5 trumf + andra 4-kortsfärg → 3♥ naturligt (ej krav)', () => {
    expect(bud('S:AKQJ86 H:AK5 D:A4 C:K3', h2NT, 'N')!.call).toMatchObject({ bid: '4S', rule: 'utgång' }) // 24
    expect(bud('S:AKQJ86 H:K5 D:A4 C:KQ3', h2NT, 'N')!.call).toMatchObject({ bid: '3S', rule: 'rebid: egen färg' }) // 22
    expect(bud('S:AKQ86 H:AKQ5 D:A4 C:K3', h2NT, 'N')!.call).toMatchObject({ bid: '3H', rule: 'rebid: ny färg' }) // 25, 5-4
    expect(bud('S:AKQJ765 H:K7 D:K C:KQJ', h2NT, 'N')!.call).toMatchObject({ bid: '4S', rule: 'utgång' }) // 22 hp men 9½ spelstick → utgången på egen hand
    // Öppnarens FJÄRDE bud efter partnerns preferens: pass (raden fjärde — förr drev gamla lagret till 4M).
    const hPref = [call('N', '2C'), P('E'), call('S', '2D'), P('W'), call('N', '2H'), P('E'), call('S', '2NT'), P('W'), call('N', '3D'), P('E'), call('S', '3H'), P('W')]
    expect(bud('S:AK H:K7432 D:AKT87 C:Q', hPref, 'N')!.call).toMatchObject({ bid: 'P', rule: 'rebid: pass' })
    expect(decideCallTraced(dealNS('S:AK H:K7432 D:AKT87 C:Q', 'S:J962 H:J85 D:Q95 C:986'), hPref, 'N').källa).toBe('tabell:fjärde')
    expect(decideCallTraced(dealNS('S:AKQJ86 H:K5 D:A4 C:KQ3', 'S:73 H:9842 D:7532 C:J64'), h2NT, 'N').källa).toBe('tabell:tredje')
    expect(meaningOf([...h2NT, call('N', '3S')], 8)).toMatchObject({ rule: 'rebid: egen färg', forcing: 'ej-krav' })
    expect(meaningOf([...h2NT, call('N', '3H')], 8)).toMatchObject({ rule: 'rebid: ny färg', forcing: 'ej-krav' })
  })

  it('svararen efter öppnarens fortsättning (raden svar3): passar 3♠ med bottenhanden, höjer 4♠ med 3 trumf och 2+ hp; på 3♥ passar med 4+ hjärter, annars preferens 3♠; 4♠ passas', () => {
    const h3S = [...h2NT, call('N', '3S'), P('E')]
    expect(bud('S:73 H:9842 D:7532 C:J64', h3S, 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
    expect(bud('S:973 H:9842 D:Q532 C:64', h3S, 'S')!.call).toMatchObject({ bid: '4S', rule: 'höjning' }) // människans 2NT med 3 trumf: höjer med 2+ hp
    const h3H = [...h2NT, call('N', '3H'), P('E')]
    expect(bud('S:73 H:9842 D:7532 C:J64', h3H, 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
    expect(bud('S:73 H:98 D:J75432 C:J64', h3H, 'S')!.call).toMatchObject({ bid: '3S', rule: 'preferens' })
    expect(bud('S:73 H:9842 D:7532 C:J64', [...h2NT, call('N', '4S'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
  })

  it('hela auktionen bot mot bot: 2♣–2♦–2♠–2NT (andra negativa)–4♠ (6+ trumf, 24 hp) → 4♠', () => {
    const deal: Deal = { ...dealNS('S:AKQJ86 H:AK5 D:A4 C:K3', 'S:73 H:9842 D:7532 C:J64'), hands: { N: parseHand('S:AKQJ86 H:AK5 D:A4 C:K3'), S: parseHand('S:73 H:9842 D:7532 C:J64'), E: parseHand('S:T95 H:QJ7 D:KJT9 C:Q75'), W: parseHand('S:42 H:T63 D:Q86 C:AT982') } }
    const kontrakt = spelaKlart(deal).filter((b) => b !== 'P')
    expect(kontrakt).toEqual(['2C', '2D', '2S', '2NT', '4S'])
  })
})

// §5b beslut 11 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 11): svararens NYA
// FÄRG PÅ 3-LÄGET efter semi-forcing 1NT och öppnarens 2-lägesåterbud
// (1♠–1NT–2♠–3♥, 1♠–1NT–2♣–3♦, 1♥–1NT–2♦–3♣) = 6+ kort, 10–11 hp, inbjudan,
// ej krav, förnekar 3-korts stöd. Svagare 6+-händer bjuder färgen på 2-läget om
// den ryms (#59), annars preferens/pass. Öppnaren: pass = minimum med tolerans
// (2+ kort); 3M = 6+ egen färg utan tolerans; 4 i svararens högfärg = maximum
// (14–15) med 3-korts stöd eller bra dubbelton; 3NT = maximum med håll runtom.
// Förr: regeln saknades — boten bjöd 2NT/pass med 6-kortsfärgen, betydelselagret
// returnerade null och öppnarens svar låg i det gamla lagret.
describe('§5b beslut 11 – ny färg på 3-läget efter 1M–1NT–2x: 6+ kort, 10–11, inbjudan', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const hS = [call('N', '1S'), P('E'), call('S', '1NT'), P('W'), call('N', '2S'), P('E')] // 1♠–1NT–2♠
  const hC = [call('N', '1S'), P('E'), call('S', '1NT'), P('W'), call('N', '2C'), P('E')] // 1♠–1NT–2♣
  const hD = [call('N', '1H'), P('E'), call('S', '1NT'), P('W'), call('N', '2D'), P('E')] // 1♥–1NT–2♦

  it('svararen: 6+ hjärter och 10–11 utan 3-korts spaderstöd → 3♥ (inbjudan) efter 2♠ och efter 2♣ (hoppet — 2♥ är den svaga); 6+ ruter → 3♦; efter 1♥–1NT–2♦ → 3♣; med 3 trumf går limithöjningen 3M före; svagare 6-kortsfärg bjuds på 2-läget som förut', () => {
    expect(bud('S:5 H:KQJ973 D:Q42 C:K43', hS, 'S')!.call).toMatchObject({ bid: '3H', rule: 'inbjudan (ny färg)' }) // 10 hp
    expect(bud('S:5 H:KQJ973 D:Q42 C:K43', hC, 'S')!.call).toMatchObject({ bid: '3H', rule: 'inbjudan (ny färg)' })
    expect(bud('S:Q3 H:J4 D:KQJ973 C:Q43', hC, 'S')!.call).toMatchObject({ bid: '3D', rule: 'inbjudan (ny färg)' }) // 11 hp, 6 ruter
    expect(bud('S:Q43 H:53 D:Q4 C:KQJ973', hD, 'S')!.call).toMatchObject({ bid: '3C', rule: 'inbjudan (ny färg)' }) // 10 hp, 6 klöver
    expect(bud('S:Q53 H:KQJ973 D:Q4 C:43', hS, 'S')!.call.bid).toBe('3S') // 3-korts limithöjning går före
    expect(bud('S:53 H:J4 D:KJ9873 C:Q43', hC, 'S')!.call).toMatchObject({ bid: '2D', rule: 'ny färg efter 1NT' }) // 8 hp: svag, 2-läget
    expect(bud('S:5 H:KJ9873 D:Q42 C:J43', hS, 'S')!.call.bid).toBe('P') // 8 hp, 6 hjärter men inget 2-lägesbud ryms över 2♠ → pass som förut
  })

  it('betydelselagret: 3♥ efter 1♠–1NT–2♠ läses som inbjudan med 6+ kort (ej alert), likaså 3♦ efter 2♣ och 3♣ efter 1♥–1NT–2♦; förr null', () => {
    expect(meaningOf([...hS, call('S', '3H')], 6)).toMatchObject({ rule: 'inbjudan (ny färg)', forcing: 'inbjudan', alert: false })
    expect(meaningOf([...hC, call('S', '3D')], 6)).toMatchObject({ rule: 'inbjudan (ny färg)', forcing: 'inbjudan' })
    expect(meaningOf([...hD, call('S', '3C')], 6)).toMatchObject({ rule: 'inbjudan (ny färg)', forcing: 'inbjudan' })
  })

  const h3H = [...hS, call('S', '3H'), P('W')]

  it('öppnaren (raden tredje): minimum med tolerans → pass; 6+ spader utan tolerans → 3♠; maximum (14–15) med 3 hjärter eller bra dubbelton → 4♥; maximum med håll runtom → 3NT', () => {
    expect(bud('S:AKJ873 H:Q5 D:K73 C:52', h3H, 'N')!.call).toMatchObject({ bid: 'P', rule: 'pass' }) // 12, ♥Q5 = tolerans
    expect(bud('S:AKJ873 H:5 D:K73 C:A52', h3H, 'N')!.call).toMatchObject({ bid: '3S', rule: 'rebid: egen färg' }) // 15 men singel ♥ → rättelse
    expect(bud('S:AKJ873 H:T52 D:K7 C:QJ', h3H, 'N')!.call).toMatchObject({ bid: '4H', rule: 'accepterar inbjudan' }) // 14, 3 hjärter
    expect(bud('S:AQJ873 H:K5 D:Q73 C:K2', h3H, 'N')!.call).toMatchObject({ bid: '4H', rule: 'accepterar inbjudan' }) // 15, bra dubbelton ♥K5
    expect(bud('S:AQJ983 H:75 D:KQ C:Q32', h3H, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'accepterar inbjudan' }) // 14, tolerans, håll i ♦ och ♣
    expect(decideCallTraced(dealNS('S:AKJ873 H:T52 D:K7 C:QJ', 'S:5 H:KQJ973 D:Q42 C:K43'), h3H, 'N').källa).toBe('tabell:tredje')
    expect(meaningOf([...h3H, call('N', '3S')], 8)).toMatchObject({ rule: 'rebid: egen färg', forcing: 'ej-krav' })
    expect(meaningOf([...h3H, call('N', '4H')], 8)).toMatchObject({ rule: 'accepterar inbjudan' })
  })

  it('öppnaren på 3♦ efter 1♠–1NT–2♣: maximum med håll runtom → 3NT; maximum med 4-korts stöd utan håll → 5♦; minimum med tolerans → pass; svararen passar öppnarens svar (raden svar3)', () => {
    const h3D = [...hC, call('S', '3D'), P('W')]
    expect(bud('S:AKJ83 H:Q52 D:K7 C:KJ2', h3D, 'N')!.call).toMatchObject({ bid: '3NT', rule: 'accepterar inbjudan' }) // 15, håll i ♥ och ♣
    expect(bud('S:AKJ83 H:52 D:KQ74 C:KJ', h3D, 'N')!.call).toMatchObject({ bid: '5D', rule: 'accepterar inbjudan' }) // 15, 4 ruter, ♥ ohållet
    expect(bud('S:AKJ83 H:Q52 D:73 C:QJ2', h3D, 'N')!.call).toMatchObject({ bid: 'P', rule: 'pass' }) // 12
    expect(bud('S:5 H:KQJ973 D:Q42 C:K43', [...h3H, call('N', '3S'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
    expect(bud('S:5 H:KQJ973 D:Q42 C:K43', [...h3H, call('N', '4H'), P('E')], 'S')!.call).toMatchObject({ bid: 'P', rule: 'svararens pass' })
  })

  it('hela auktionen bot mot bot: 1♠–1NT–2♠–3♥–4♥ (maximum med 3 hjärter)', () => {
    const deal: Deal = { ...dealNS('S:AKJ873 H:T52 D:K7 C:QJ', 'S:5 H:KQJ973 D:Q42 C:K43'), hands: { N: parseHand('S:AKJ873 H:T52 D:K7 C:QJ'), S: parseHand('S:5 H:KQJ973 D:Q42 C:K43'), E: parseHand('S:T96 H:64 D:JT65 C:9872'), W: parseHand('S:Q42 H:A8 D:A983 C:AT65') } }
    const kontrakt = spelaKlart(deal).filter((b) => b !== 'P')
    expect(kontrakt).toEqual(['1S', '1NT', '2S', '3H', '4H'])
  })
})

// §5b beslut 12 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 12): svararens HOPP
// till 4m efter 1m–2m'–2NT (1♦–2♣–2NT–4♦, 1♣–2♦–2NT–4♣) = trumf satt + slamdriv
// förbi 3NT — 4+ stöd, 33+ mot visat minimum 12, ingen sanghand. Öppnaren
// svarar som i cue-ronden (§6.2): billigaste kontrollbud under 5m, annars 5m;
// kaptenen (svararen) frågar 4NT när den vill. Boten själv fortsätter bjuda
// det billiga 3m (#58) — beslutet är en läsregel + öppnarens svar. Förr: 4m
// lästes som "stöd i kravet", öppnaren hade inget svar (kravvaktens 5m).
describe('§5b beslut 12 – hopp till 4m efter 1m–2m′–2NT = trumf satt + slamdriv; öppnaren öppnar cue-ronden', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  const hD = [call('N', '1D'), P('E'), call('S', '2C'), P('W'), call('N', '2NT'), P('E'), call('S', '4D'), P('W')] // 1♦–2♣–2NT–4♦
  const hC = [call('N', '1C'), P('E'), call('S', '2D'), P('W'), call('N', '2NT'), P('E'), call('S', '4C'), P('W')] // 1♣–2♦–2NT–4♣

  it('betydelselagret: 4♦ läses som trumfsättning med slamdriv (inte "stöd i kravet"); det billiga 3♦ är fortfarande försenat stöd', () => {
    expect(meaningOf(hD, 6)).toMatchObject({ rule: '2/1: hopphöjning (slamdriv)', forcing: 'slamintresse' })
    expect(meaningOf(hC, 6).rule).toBe('2/1: hopphöjning (slamdriv)')
    expect(meaningOf([call('N', '1D'), P('E'), call('S', '2C'), P('W'), call('N', '2NT'), P('E'), call('S', '3D')], 6).rule).toBe('2/1: försenat stöd')
  })

  it('öppnaren (raden slam, partnern öppnar cue-ronden): billigaste kontrollbud under 5♦ — 4♥ med ♥A, 4♠ med ♠A men inte ♥A; utan kontroll att visa → 5♦', () => {
    expect(bud('S:K43 H:A73 D:KQ85 C:Q63', hD, 'N')!.call.bid).toBe('4H')
    expect(bud('S:A43 H:K73 D:KQ85 C:Q63', hD, 'N')!.call.bid).toBe('4S')
    expect(bud('S:K43 H:Q73 D:KQ85 C:KJ6', hD, 'N')!.call.bid).toBe('5D')
    expect(decideCallTraced(dealNS('S:K43 H:A73 D:KQ85 C:Q63', 'S:A H:KQ D:AJ763 C:AKQ52'), hD, 'N').källa).toBe('tabell:slam')
    // Öppnarens kontrollbud läses som cue (alert), 5♦ som avslut.
    expect(meaningOf([...hD, call('N', '4H')], 8).alert).toBe(true)
    expect(meaningOf([...hD, call('N', '4H')], 8).rule).toMatch(/cue/)
  })

  it('samma i klöverformen: 1♣–2♦–2NT–4♣ → öppnaren cue:ar 4♦/4♥/4♠ billigast, annars 5♣', () => {
    expect(bud('S:K43 H:Q73 D:A85 C:KQ63', hC, 'N')!.call.bid).toBe('4D')
    expect(bud('S:K43 H:A73 D:Q85 C:KQ63', hC, 'N')!.call.bid).toBe('4H')
    expect(bud('S:K43 H:Q73 D:K85 C:KQ63', hC, 'N')!.call.bid).toBe('5C')
  })

  it('kaptenen fortsätter efter öppnarens cue: med slamvärden frågar hon vidare (cue/4NT) ur slamraden; öppnarens 5♦ utan slamvärden passas', () => {
    const h4H = [...hD, call('N', '4H'), P('E')]
    const t = decideCallTraced(dealNS('S:K43 H:A73 D:KQ85 C:Q63', 'S:A H:KQ D:AJ763 C:AKQ52'), h4H, 'S')
    expect(t.källa).toBe('tabell:slam')
    expect(['4S', '4NT']).toContain(t.call.bid)
    expect(bud('S:5 H:K4 D:AJ763 C:AKJ52', [...hD, call('N', '5D'), P('E')], 'S')!.call.bid).toBe('P')
  })
})

// §5b beslut 16 (ägarbeslut 2026-09-05, bok-mot-motor-fynd 16): 5m efter
// partnerns 4m ÄR utgången (till spel); inbjudan i lågfärgsfit är
// KONTROLLBUDET. Med trumf satt i utgångskrav är cue under utgång gratis (§6.2):
// kaptenen med 31–32 visar billigaste kontroll (4♥/4♠ över 4♦), partnern cue:ar
// tillbaka med extra eller bjuder 5m med minimum; 33+ frågar 4NT direkt; handen
// utan billig kontroll bjuder 5m — systemriktig miss. Inget bud ändras: blocket
// LÅSER linjen (bok + facit). Enda kodtillägget: partnerns uttryckliga pass ur
// slamraden när kaptenen avslutar direkt i 5m (förr gamla lagret).
describe('§5b beslut 16 – lågfärgsfit i utgångskrav: 5m är utgången, inbjudan är kontrollbudet (låsning)', () => {
  const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)
  const P = (seat: Seat) => call(seat, 'P')
  // 1♦–2♣–2NT–3♦ (försenat stöd) – 4♦ (öppnaren: kravet står, ingen sang) — kaptenen (Syd) mot visade 12.
  const h4D = [call('N', '1D'), P('E'), call('S', '2C'), P('W'), call('N', '2NT'), P('E'), call('S', '3D'), P('W'), call('N', '4D'), P('E')]

  it('kaptenen med 31–32 visar billigaste kontroll över 4♦ (4♥ med ♥A, 4♠ med ♠A); utan första-rondskontroll → 5♦ (systemriktig miss); 33+ frågar 4NT direkt', () => {
    expect(bud('S:K54 H:A43 D:KQ76 C:AQJ', h4D, 'S')!.call).toMatchObject({ bid: '4H', rule: 'cue-bid' }) // 19 jämn → 31
    expect(bud('S:A54 H:K43 D:KQ76 C:AQJ', h4D, 'S')!.call).toMatchObject({ bid: '4S', rule: 'cue-bid' })
    expect(bud('S:KQ4 H:KQJ D:KQ76 C:QJT', h4D, 'S')!.call).toMatchObject({ bid: '5D', rule: 'höjning till utgång' }) // 19 men inga ess
    expect(bud('S:A54 H:AJ3 D:KQ76 C:AQJ', h4D, 'S')!.call).toMatchObject({ bid: '4NT', rule: '1430 RKC' }) // 21 → 33
  })

  it('partnern (öppnaren) efter kaptenens 4♥-cue: extra → cue tillbaka (4♠), minimum → 5♦ (avslut); efter kaptenens 5♦ passar hon ur slamraden', () => {
    const h4H = [...h4D, call('S', '4H'), P('W')]
    expect(bud('S:A43 H:J73 D:AJ85 C:K6', h4H, 'N')!.call).toMatchObject({ bid: '4S', rule: 'cue-bid' }) // 13 med ♠A
    expect(bud('S:Q43 H:J73 D:AJ85 C:K6', h4H, 'N')!.call).toMatchObject({ bid: '5D', rule: 'cue: avslut' }) // 10-11: inget att visa
    const h5D = [...h4D, call('S', '5D'), P('W')]
    expect(bud('S:A43 H:J73 D:AJ85 C:K6', h5D, 'N')!.call).toMatchObject({ bid: 'P', rule: 'pass' })
    expect(decideCallTraced(dealNS('S:A43 H:J73 D:AJ85 C:K6', 'S:KQ4 H:KQJ D:KQ76 C:QJT'), h5D, 'N').källa).toBe('tabell:slam')
  })

  it('betydelselagret: 4♥ över 4♦ med satt ruter = kontrollbud (alert), 5♦ = utgång — inte inbjudan', () => {
    expect(meaningOf([...h4D, call('S', '4H')], 10)).toMatchObject({ rule: 'cue-bid', alert: true })
    expect(meaningOf([...h4D, call('S', '5D')], 10)).toMatchObject({ rule: 'utgång', forcing: 'avslut' })
  })
})
