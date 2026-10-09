// UPPREPAD UPPLYSNINGSDUBBLING + DUBBLING ÖVER DERAS SPÄRRHÖJNING (ägarbeslut
// 2026-10-08, provspel av stödsvepets frön 20275065 och 20272831).
//
// Läge 1 — den starka dubblaren efter partnerns påtvingade svar och DERAS rebud
// (1♠–X–P–2♥–2♠–?): dubblaren får inte sälja given. X igen = upprepad
// upplysningsdubbling: lovar egen öppning (13+ hp) och trolig fördelning (kort i
// deras färg, högst två). Partnern får inte passa: med två lika långa objudna
// färger bjuds NÄSTA färg, med fem kort i den första bjuds den igen (visar 5),
// med en längre annan objuden färg bjuds den. Ingen sang.
//
// Läge 2 — dubblingen över deras spärrhöjning (2♦–P–3♦–X) är starkare: bra 13+
// MED fördelning (startpoäng) och högst två kort i deras färg. Svararen med
// 5+ högfärg, 7+ hp och KONTROLL i deras färg (förlorar högst ett stick: A, K,
// D, singel eller renons) hoppar direkt till 4M — konkurrens, vi släpper inte
// deras 4♦.
import { describe, expect, it } from 'vitest'
import type { Card, Deal, Hand, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'
import { dealFromSeed, botAuction } from './revisor'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

/** Giv där `seat` har `hand`; resten av leken delas runt (bara `seat` bjuder i testet). */
function dealWith(seat: Seat, hand: string, dealer: Seat): Deal {
  const mine: Hand = parseHand(hand)
  const used = new Set(mine.map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  const others = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => s !== seat)
  const hands = { N: [] as Hand, E: [] as Hand, S: [] as Hand, W: [] as Hand }
  hands[seat] = mine
  others.forEach((s, i) => { hands[s] = rest.filter((_, k) => k % 3 === i) })
  return { id: 'facit', dealer, vulnerability: 'none', board: 1, hands }
}

function auktion(seed: number) {
  const hist = botAuction(dealFromSeed(seed))
  expect(hist).not.toBeNull()
  return hist!
}
const bids = (h: ResolvedCall[], upto: number) => h.slice(0, upto).map((c) => c.bid)

describe('läge 1 – upprepad upplysningsdubbling efter deras rebud', () => {
  it('frö 20275065: 1♠–X–P–2♥–2♠, Öst ♠A8 ♥AT2 ♦AKT9 ♣AQ43 (21 hp) → X igen; Väst ♠J63 ♥J8753 ♦J3 ♣J62 bjuder 3♥ (fem kort), inte pass', () => {
    const h = auktion(20275065)
    expect(bids(h, 6)).toEqual(['P', '1S', 'X', 'P', '2H', '2S'])
    expect(h[6].seat).toBe('E')
    expect(h[6].bid).toBe('X')
    expect(h[6].rule).toBe('upprepad upplysningsdubbling')
    expect(h[7].bid).toBe('P')
    expect(h[8].seat).toBe('W')
    expect(h[8].bid).toBe('3H')
    expect(h[8].rule).toBe('svar på upprepad dubbling')
  })

  it('dubblaren med 13 hp och två kort i deras färg dubblar igen (lovar bara öppning + form)', () => {
    const d = dealWith('E', 'S:84 H:KQ9 D:AJ84 C:K753', 'N') // 13 hp, tre hjärter (4+ = höjningens väg)
    const hist = [call('N', '1S'), call('E', 'X'), call('S', 'P'), call('W', '2H'), call('N', '2S')]
    expect(decideCall(d, hist, 'E').bid).toBe('X')
  })

  it('dubblaren med 12 hp passar deras rebud (under öppningsstyrka)', () => {
    const d = dealWith('E', 'S:84 H:KQ9 D:AJ84 C:J753', 'N') // 12 hp, tre hjärter
    const hist = [call('N', '1S'), call('E', 'X'), call('S', 'P'), call('W', '2H'), call('N', '2S')]
    expect(decideCall(d, hist, 'E').bid).toBe('P')
  })

  it('dubblaren med tre kort i deras färg dubblar inte igen', () => {
    const d = dealWith('E', 'S:Q84 H:KQ9 D:AJ8 C:K753', 'N') // 14 hp, tre spader, tre hjärter
    const hist = [call('N', '1S'), call('E', 'X'), call('S', 'P'), call('W', '2H'), call('N', '2S')]
    expect(decideCall(d, hist, 'E').bid).not.toBe('X')
  })

  const second = [call('N', '1S'), call('E', 'X'), call('S', 'P'), call('W', '2H'), call('N', '2S'), call('E', 'X'), call('S', 'P')]
  it('svaret på den upprepade dubblingen: 4-4 i hjärter och ruter → nästa färg 3♦', () => {
    const d = dealWith('W', 'S:J6 H:J875 D:J873 C:J62', 'N')
    const r = decideCall(d, second, 'W')
    expect(r.bid).toBe('3D')
    expect(r.rule).toBe('svar på upprepad dubbling')
  })
  it('svaret på den upprepade dubblingen: fem hjärter → 3♥ igen', () => {
    const d = dealWith('W', 'S:J6 H:J8753 D:J87 C:J62', 'N')
    expect(decideCall(d, second, 'W').bid).toBe('3H')
  })
  it('svaret på den upprepade dubblingen: fyra hjärter, fem klöver → 3♣ (den längre)', () => {
    const d = dealWith('W', 'S:J6 H:J875 D:J8 C:J7632', 'N')
    expect(decideCall(d, second, 'W').bid).toBe('3C')
  })
  it('svaret på den upprepade dubblingen är aldrig pass, inte ens med noll poäng', () => {
    const d = dealWith('W', 'S:96 H:8753 D:9873 C:862', 'N')
    expect(decideCall(d, second, 'W').bid).toBe('3D')
  })

  // Vakter ur auktionsdiffen 2026-10-08: partnerns andra X är INTE en upprepad
  // upplysning när partnerns första bud var ett inkliv och X:et straffar deras
  // 4♠, eller när ett starkt återbud ligger mellan dubblingarna.
  it('frö 20261885: partnerns straff-X av 4♠ efter eget 2♥-inkliv besvaras inte med 5♣ — pass', () => {
    const h = auktion(20261885)
    expect(bids(h, 13)).toEqual(['P', 'P', '1S', '2H', 'P', '3H', '3S', 'X', '4S', 'P', 'P', 'X', 'P'])
    expect(h[13].seat).toBe('E')
    expect(h[13].bid).toBe('P')
  })
  it('frö 20276239: X – 2♣ (starkt återbud) – X är ingen upprepad upplysning; advancern stödhöjer 4♣ som förut', () => {
    const h = auktion(20276239)
    expect(bids(h, 13)).toEqual(['1D', 'P', '1H', 'X', '1NT', 'P', 'P', '2C', 'P', '3C', '3D', 'X', 'P'])
    expect(h[13].seat).toBe('S')
    expect(h[13].bid).toBe('4C')
  })
})

describe('läge 2 – dubbling över deras spärrhöjning och svaret med kontroll', () => {
  it('frö 20272831: (2♦)–P–(3♦)–X–P, Syd ♠QT2 ♥97652 ♦A8 ♣J53 (7 hp, ♦A = kontroll) → 4♥ direkt, inte 3♥', () => {
    const h = auktion(20272831)
    expect(bids(h, 5)).toEqual(['2D', 'P', '3D', 'X', 'P'])
    expect(h[5].seat).toBe('S')
    expect(h[5].bid).toBe('4H')
  })

  const raised = [call('W', '2D'), call('N', 'P'), call('E', '3D')]
  it('dubblingen över spärrhöjningen: 13 hp med två ruter → X (bra 13+ med fördelning)', () => {
    const d = dealWith('S', 'S:KJ84 H:AQ93 D:65 C:K75', 'W') // 13 hp
    expect(decideCall(d, raised, 'S').bid).toBe('X')
  })
  it('dubblingen över spärrhöjningen: 13 hp men tre ruter → inte X', () => {
    const d = dealWith('S', 'S:KJ84 H:AQ93 D:654 C:K7', 'W') // 13 hp, tre ruter
    expect(decideCall(d, raised, 'S').bid).not.toBe('X')
  })
  it('dubblingen över spärrhöjningen: 10 hp jämnt → pass', () => {
    const d = dealWith('S', 'S:KJ84 H:QJ93 D:65 C:K75', 'W') // 10 hp
    expect(decideCall(d, raised, 'S').bid).toBe('P')
  })

  const answer = [call('W', '2D'), call('N', 'P'), call('E', '3D'), call('S', 'X'), call('W', 'P')]
  it('svaret: fem hjärter, 7 hp och singel ruter → 4♥', () => {
    const d = dealWith('N', 'S:QJ2 H:K9765 D:5 C:J843', 'W') // 7 hp
    expect(decideCall(d, answer, 'N').bid).toBe('4H')
  })
  it('svaret: fem hjärter, 7 hp men ♦J8 (ingen kontroll) → 3♥ (påtvingat)', () => {
    const d = dealWith('N', 'S:QT2 H:K9765 D:J8 C:Q43', 'W') // 7 hp
    expect(decideCall(d, answer, 'N').bid).toBe('3H')
  })
  it('svaret: fem hjärter, ♦Q-kontroll men bara 5 hp → 3♥ (påtvingat)', () => {
    const d = dealWith('N', 'S:J72 H:K9765 D:Q8 C:843', 'W') // 5 hp
    expect(decideCall(d, answer, 'N').bid).toBe('3H')
  })
})
