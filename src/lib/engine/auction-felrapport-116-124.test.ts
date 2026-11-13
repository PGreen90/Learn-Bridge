// FACIT FÖRE FIX — felrapporterna #116, #120 och #124 (2026-11-12/13).
// Hp räknade med kod (hcp/parseHand), summa 40 och 13 kort per hand.
//
// #116 (Dagens IMP nr 103, giv 12, Väst giv, NS i zon): "Öst eller Väst måste
//   agera. Det är helt fel att låta två spader spelas redubbelt."
//     Väst   Nord   Öst    Syd
//     1♥     1♠     pass   2♥
//     pass   2♠     pass   pass
//     X      XX     pass ???       ← Öst ♠A ♥965432 ♦543 ♣654 passade
//   Hålet: svaret på partnerns återöppningsdubbling krävde "bara pass efter
//   X:et" — deras XX stängde regeln och stolen föll till ett regellöst pass.
//   Rätt: XX ändrar ingenting, Öst svarar 3♥ (preferens, sex kort).
//
// #120 (bricka 6, Öst giv, ÖV i zon): "Dubbel är fel för Syd. Jag har lång
//   ruter och ska bjuda om den."
//     Öst    Syd    Väst   Nord
//     pass   1♦     1♥     X
//     3♥     X ???                 ← Syd ♠— ♥Q76 ♦AJT876 ♣A963
//   Hålet: öppningsfärgen fick bara bjudas om på 3-läget; på 4-läget föll
//   handen till X med förklaringen "varken … eller 5+ i öppningsfärgen" —
//   osann med sex ruter. Rätt (ägarens facit): 4♦.
//
// #124 (Dagens MP% nr 104, giv 4, Väst giv, alla i zon): "Dubblingen från Öst
//   beskrivs som minst 4 hjärter (stämmer inte) och att det inte är en
//   straffdubbling, men Väst passar ändå."
//     Väst   Nord   Öst    Syd
//     1♠     X      XX     2♣
//     pass   pass   X              ← förklarades som NEGATIV dubbling
//   Budet var rätt (straff, §7.8 b) — förklaringen var fel: XX är inget
//   kontraktsbud, så betydelselagret trodde att X:et var svararens första aktion.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { interpretCall } from './auction-interpret'
import { decideCall } from './auction-live'
import { hcp } from './hand'

const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const c = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return c })
}
type Zon = Deal['vulnerability']
const giv = (id: string, dealer: Seat, vulnerability: Zon, n: string, e: string, s: string, w: string): Deal =>
  ({ id, board: 1, dealer, vulnerability, hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) } })
const hpKoll = (d: Deal, facit: number[]) => {
  const hp = ORDER.map((s) => hcp(d.hands[s]))
  expect(hp).toEqual(facit)
  expect(hp.reduce((a, b) => a + b, 0)).toBe(40)
  for (const s of ORDER) expect(d.hands[s]).toHaveLength(13)
}

describe('felrapport #116 – deras XX på partnerns återöppningsdubbling: svaret står kvar', () => {
  const D = giv('fr116', 'W', 'ns', 'S:J9762 H:A D:QJ82 C:Q98', 'S:A H:965432 D:543 C:654', 'S:KT854 H:J D:AT96 C:JT2', 'S:Q3 H:KQT87 D:K7 C:AK73')
  it('händerna räknade med kod: 10 · 4 · 9 · 17 = 40', () => hpKoll(D, [10, 4, 9, 17]))

  it('Väst återöppnar med X som i rapporten', () => {
    expect(decideCall(D, H('W', '1H 1S P 2H P 2S P P'), 'W').bid).toBe('X')
  })

  it('Öst efter XX: 3♥ (preferens till partnerns färg), aldrig pass', () => {
    const c = decideCall(D, H('W', '1H 1S P 2H P 2S P P X XX'), 'E')
    expect(c.bid).toBe('3H')
    expect(c.rule).toBe('svar på återöppningsdubbling')
  })

  it('samma svar som utan redubblingen', () => {
    expect(decideCall(D, H('W', '1H 1S P 2H P 2S P P X P'), 'E').bid).toBe('3H')
  })

  it('motvikt: längd med honnörer i deras färg → straffpass även redubblat', () => {
    const falla = { ...D, hands: { ...D.hands, E: parseHand('S:KJ98 H:65 D:5432 C:654') } }
    const c = decideCall(falla, H('W', '1H 1S P 2H P 2S P P X XX'), 'E')
    expect(c.bid).toBe('P')
    expect(c.rule).toBe('straffpass (återöppningsdubbling)')
  })
})

describe('felrapport #120 – svar på negativ dubbling: sex kort i öppningsfärgen bjuds om även på 4-läget', () => {
  const D = giv('fr120', 'E', 'ew', 'S:K632 H:8 D:KQ52 C:KJ72', 'S:AQ854 H:T943 D:4 C:Q84', 'S:- H:Q76 D:AJT876 C:A963', 'S:JT97 H:AKJ52 D:93 C:T5')
  const AUKTION = 'P 1D 1H X 3H'
  it('händerna räknade med kod: 12 · 8 · 11 · 9 = 40', () => hpKoll(D, [12, 8, 11, 9]))

  it('motorn bjuder som i rapporten fram till felet', () => {
    expect(decideCall(D, H('E', 'P 1D 1H'), 'N').bid).toBe('X')
    expect(decideCall(D, H('E', 'P 1D 1H X'), 'E').bid).toBe('3H')
  })

  it('Syd med ♦AJT876: 4♦, inte X', () => {
    const c = decideCall(D, H('E', AUKTION), 'S')
    expect(c.bid).toBe('4D')
    expect(c.rule).toBe('svar på negativ dubbling')
    expect(c.explanation).toMatch(/6 kort i ♦/)
  })

  it('motvikt: bara FEM ruter på 4-läget → X som förut, med en sann förklaring', () => {
    const fem = { ...D, hands: { ...D.hands, S: parseHand('S:4 H:Q76 D:AJT87 C:A963') } }
    const c = decideCall(fem, H('E', AUKTION), 'S')
    expect(c.bid).toBe('X')
    expect(c.explanation).not.toMatch(/eller 5\+ i öppningsfärgen/)
  })

  it('betydelselagret lovar inte längre "inte 5+ i öppningsfärgen" om X:et', () => {
    const h = H('E', AUKTION + ' X')
    expect(interpretCall(h, h.length - 1).text).not.toMatch(/eller 5\+ i öppningsfärgen/)
  })
})

describe('felrapport #124 – redubblarens X på deras flykt förklaras som STRAFF', () => {
  const D = giv('fr124', 'W', 'all', 'S:JT H:QJ95 D:K95 C:KJ62', 'S:63 H:84 D:AQJT2 C:AQ94', 'S:AK4 H:732 D:743 C:T873', 'S:Q98752 H:AKT6 D:86 C:5')
  const AUKTION = '1S X XX 2C P P X'
  it('händerna räknade med kod: 11 · 13 · 7 · 9 = 40', () => hpKoll(D, [11, 13, 7, 9]))

  it('motorn bjuder som i rapporten: Öst dubblar för straff och Väst passar', () => {
    const x = decideCall(D, H('W', '1S X XX 2C P P'), 'E')
    expect(x.bid).toBe('X')
    expect(x.rule).toBe('redubblaren: straffdubbling')
    expect(decideCall(D, H('W', AUKTION + ' P'), 'W').bid).toBe('P')
  })

  it('förklaringen härledd UR AUKTIONEN (utan motorns regel): straff, inte negativ dubbling', () => {
    const h = H('W', AUKTION)
    const t = interpretCall(h, h.length - 1).text
    expect(t).toMatch(/Straffdubbling/)
    expect(t).not.toMatch(/Negativ dubbling|hjärter/)
  })

  it('motvikt: en vanlig negativ dubbling förklaras som förut', () => {
    const h = H('W', '1S 2C X')
    expect(interpretCall(h, h.length - 1).text).toMatch(/Negativ dubbling/)
  })
})
