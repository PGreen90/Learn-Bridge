// Felrapport #109 (2026-11-03, Dagens IMP bricka 12, Väst giv, NS i zon):
//
//   Väst  Nord  Öst  Syd
//   P     2♣    P    2♠
//   P     3♣    P    3♠
//   P     4♣    P    5♣ ← motorn (ingen regel: "inbjudande hopp med fit")
//   P     P     P
//
// Nord ♠3 ♥AKQ5 ♦K ♣AKQ8753 (21) · Syd ♠AQ864 ♥J7 ♦A974 ♣JT (12). Öppnaren
// rebjöd sin klöver två gånger (6+) efter Syds positiva svar och egen rebud;
// Syd har två klöver → 8+ kända trumf, 12 + 22 = 34 → kaptensregeln (§4.4,
// §5.2) kräver 4NT. Hålet: svararens tredje bud (`responderThirdDecision`)
// hade bara raden "solid egen färg" i 2♣-linjen; klövern som trumf efter två
// rebud fanns varken i tabellen eller i slamgrenens läsare. Hp räknade med kod.
import { describe, expect, it } from 'vitest'
import { parseHand, type ResolvedCall } from '../bidding'
import { auctionComplete, contractFromCalls, decideCall, seatToAct } from './auction-live'
import { meaningOf } from './auction-meaning'
import { hcp } from './hand'
import type { Deal, Seat } from '../../types/bridge'

const ORDER: Seat[] = ['W', 'N', 'E', 'S']
const RAPPORT: Deal = { id: 'fr109', board: 12, dealer: 'W', vulnerability: 'ns', hands: {
  N: parseHand('S:3 H:AKQ5 D:K C:AKQ8753'), E: parseHand('S:JT92 H:863 D:QJ82 C:92'),
  S: parseHand('S:AQ864 H:J7 D:A974 C:JT'), W: parseHand('S:K75 H:T942 D:T653 C:64') } }
const H = (s: string): ResolvedCall[] => s.split(' ').map((bid, i) => ({ seat: ORDER[i % 4], bid }) as ResolvedCall)
const FORE = 'P 2C P 2S P 3C P 3S P 4C P'
/** Hela auktionen där Syds mänskliga bud ges i ordning; alla andra stolar bjuder med motorn. */
const helaMed = (d: Deal, sydsBud: string[]): ResolvedCall[] => {
  const h: ResolvedCall[] = []
  let guard = 0
  const syd = [...sydsBud]
  while (!auctionComplete(h) && guard++ < 30) {
    const seat = seatToAct(d.dealer, h.length)
    if (seat === 'S' && syd.length) h.push({ seat, bid: syd.shift()! } as ResolvedCall)
    else h.push(decideCall(d, h, seat))
  }
  return h
}
const budrad = (h: ResolvedCall[]) => h.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)

describe('felrapport #109 – 2♣–2♠–3♣–3♠–4♣: öppnarens färg två gånger är trumf, kaptenen frågar 4NT (inte 5♣)', () => {
  it('händerna räknade med kod: V 3 · N 21 · Ö 4 · S 12 = 40 hp, 13 kort var', () => {
    const hp = ORDER.map((s) => hcp(RAPPORT.hands[s]))
    expect(hp).toEqual([3, 21, 4, 12])
    expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
    for (const s of ORDER) expect(RAPPORT.hands[s]).toHaveLength(13)
  })

  it('betydelsen av 4♣: öppnaren rebjuder egen klöver (6+), utgångskravet står', () => {
    expect(meaningOf(H(FORE), 9).rule).toBe('rebid: egen färg (GF)')
  })

  it('Syd på 4♣: 12 + visade 22 = 34 → 4NT (1430 RKC med klöver som trumf), inte 5♣', () => {
    const c = decideCall(RAPPORT, H(FORE), 'S')
    expect(c.bid).toBe('4NT')
    expect(c.rule).toBe('1430 RKC')
    expect(c.explanation).toMatch(/♣ som trumf/)
  })

  it('Nord svarar 5♦ (0 eller 3) på 4NT – tre nyckelkort ♥A ♣A ♣K', () => {
    const c = decideCall(RAPPORT, H(`${FORE} 4NT P`), 'N')
    expect(c.bid).toBe('5D')
    expect(c.rule).toBe('1430 RKC')
  })

  it('hela given med motorn i alla stolar: 4NT–5♦ och minst lillslam i klöver (aldrig 5♣)', () => {
    const h = helaMed(RAPPORT, [])
    expect(budrad(h).slice(0, 7)).toEqual(['N:2C', 'S:2S', 'N:3C', 'S:3S', 'N:4C', 'S:4NT', 'N:5D'])
    const k = contractFromCalls(h)
    expect(k).toMatchObject({ strain: 'clubs', declarer: 'N' })
    expect(k!.level).toBeGreaterThanOrEqual(6)
  })

  it('människan Syd bjuder 4NT själv: Nord svarar 5♦, Syd (motorn) går till slam', () => {
    const h = helaMed(RAPPORT, ['2S', '3S', '4NT'])
    expect(budrad(h).slice(0, 7)).toEqual(['N:2C', 'S:2S', 'N:3C', 'S:3S', 'N:4C', 'S:4NT', 'N:5D'])
    expect(contractFromCalls(h)!.level).toBeGreaterThanOrEqual(6)
  })

  // Ägarbeslut 2026-11-03: fem nyckelkort → alltid 5NT; storslam med tre av fyra
  // kungar i paret (trumfkungen inräknad). Händerna nedan räknas med kod (40 hp).
  const medHander = (h: Partial<Record<Seat, string>>): Deal => ({ ...RAPPORT, hands: { ...RAPPORT.hands, ...Object.fromEntries(Object.entries(h).map(([s, v]) => [s, parseHand(v!)])) } })
  const summa40 = (d: Deal) => { expect(ORDER.reduce((a, s) => a + hcp(d.hands[s]), 0)).toBe(40); for (const s of ORDER) expect(d.hands[s]).toHaveLength(13) }

  it('rapportens giv: 4NT–5♦–5NT–7♣ — Nord har ♥K ♦K (två sidokungar) och svarar 7♣ direkt', () => {
    const h = helaMed(RAPPORT, [])
    expect(budrad(h)).toEqual(['N:2C', 'S:2S', 'N:3C', 'S:3S', 'N:4C', 'S:4NT', 'N:5D', 'S:5NT', 'N:7C'])
    expect(h.find((c) => c.bid === '5NT')!.rule).toBe('Sjöberg 5NT')
    expect(contractFromCalls(h)).toMatchObject({ level: 7, strain: 'clubs', declarer: 'N' })
  })

  it('variant: Nord ♥AQJ5, Syd ♥K7 — Nord visar ♦K (6♦), Syd har ♥K själv → tre kungar i paret → 7♣', () => {
    const d = medHander({ N: 'S:3 H:AQJ5 D:K C:AKQ8753', S: 'S:AQ864 H:K7 D:A974 C:JT' })
    summa40(d)
    const h = helaMed(d, [])
    expect(budrad(h).slice(5)).toEqual(['S:4NT', 'N:5D', 'S:5NT', 'N:6D', 'S:7C'])
  })

  it('variant: ♥K hos Öst — Nord visar bara ♦K och Syd har ingen sidokung → två kungar räcker inte; 6♦ ligger över 6♣ → 6NT', () => {
    const d = medHander({ N: 'S:3 H:AQ85 D:K C:AKQ8753', E: 'S:JT92 H:K63 D:QJ82 C:92' })
    summa40(d)
    const h = helaMed(d, [])
    expect(budrad(h).slice(5)).toEqual(['S:4NT', 'N:5D', 'S:5NT', 'N:6D', 'S:6NT'])
  })
})
