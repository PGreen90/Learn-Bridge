// FACIT — felrapport #129, #131 och Tyck till #130 (2026-11-22). Hp räknade
// med kod (hcp/parseHand), summa 40 och 13 kort per hand.
//
// #129 (Dagens MP% nr 107, giv 9, Nord giv, ÖV i zon): "Motorn väljer att passa
//   både på nord och syd helt fel utgång. Värden är visade."
//     Nord   Öst    Syd    Väst
//     1♣     pass   2♣     2♥        ← 2♣ = inverterad höjning (krav)
//     pass   pass   pass ???         ← 32 hp och elva klöver säljs ut i 2♥
//   Hålet: efter 1m–2m–(inkliv) fanns ingen rad alls. ÄGARSTRUKTUR 2026-11-22
//   (öppnaren efter inklivet på 2-läget):
//     pass  = svagast (12–13): ingen stopp, ingen ny fyrkortsfärg, inte styrka
//             att bjuda om färgen — KRAV, frågar svararen efter stopp
//     X     = samma handtyp men starkare (14–15) — inte straff
//     2NT   = stopp, 12–15 · 3NT = stopp, 16+
//     ny färg = naturlig fyrkortsfärg, fem i lågfärgen, krav en rond
//     3m    = fem kort, 12–15, ej krav
//     3 i deras färg = utgångskrav, 16+, 5+ i lågfärgen
//     hopp i ny färg = kontrollbud (kortfärg), 16+, lång lågfärg, slamintresse
//   Svararen efter pass/X: med stopp 2NT (10–12) / 3NT (13+); utan stopp 3m
//   (minimum) / 3 i deras färg (13+). Rapportens Nord (16 hp, sju klöver,
//   ruterrenons) hoppar till 4♦.
//
// #131 (Dagens MP% nr 111, giv 8, Väst giv, ingen i zon): "Jag bjuder utanför
//   motorn, försöker bjuda minor suite men bot tolkar som spader."
//     Väst   Nord   Öst    Syd
//     1♥     1NT    pass   2♠        ← 2♠ = Minor Suit Stayman (systems on, §7.1)
//     3♥     4♠ ???                  ← Nord ♠KJT3 ♥A9 ♦AKT5 ♣932 (15 hp)
//   Felet: budförklaringen läste 2♠ rätt (MSS), men när Väst klev in med 3♥
//   tappade Nords beslut betydelsen — "tävla till fiten" höjde partnerns
//   "spader" till 4♠. Ägarens besked: "Nord bör bjuda 3NT som slutbud … vi vet
//   inte tillräckligt om Syds styrka för att gå upp i lågfärger."
//   Dessutom: ett KONSTGJORT systemsvar på 1NT-inklivet (Stayman, överföring,
//   MSS) är aldrig en färg att höja "med fit".
//
// #130 (Tyck till, Dagens IMP nr 109, giv 3, Syd giv, ÖV i zon): "Br 3 dagens
//   imp är helgalen. Ingendera av robbarna kan passa på 4 ru x."
//     Syd    Väst   Nord   Öst
//     2♦     X      3♦     4♦        ← Östs 4♦ = cue i DERAS färg (krav)
//     X      pass ???                ← Väst ♠AQ53 ♥AJ98 ♦76 ♣Q82 (13 hp)
//   Väst, Nord och Öst passade — Ö/V spelade 4♦ dubblat i motståndarnas färg.
//   Principen är redan ägarbeslut (#107, 2026-10-31): ett cue-bud är krav ÄVEN
//   när motståndaren dubblar det. Här saknades den i sista kravvakten.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall, decideCallTraced } from './auction-live'
import { meaningOf } from './auction-meaning'
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
const sista = (dealer: Seat, a: string) => { const h = H(dealer, a); return meaningOf(h, h.length - 1) }

describe('felrapport #131 – stört Minor Suit Stayman efter vårt 1NT-inkliv', () => {
  const D = giv('fr131', 'W', 'none', 'S:KJT3 H:A9 D:AKT5 C:932', 'S:A7652 H:87 D:J96 C:Q84', 'S:Q4 H:T D:8432 C:AJT765', 'S:98 H:KQJ65432 D:Q7 C:K')
  const medNord = (n: string): Deal => ({ ...D, hands: { ...D.hands, N: parseHand(n) } })
  it('händerna räknade med kod: 15 · 7 · 7 · 11 = 40', () => hpKoll(D, [15, 7, 7, 11]))

  it('auktionen fram till felet som i rapporten: 1♥ – 1NT – pass', () => {
    expect(decideCall(D, [], 'W').bid).toBe('1H')
    expect(decideCall(D, H('W', '1H'), 'N').bid).toBe('1NT')
    expect(decideCall(D, H('W', '1H 1NT'), 'E').bid).toBe('P')
  })

  it('Nord efter 1♥–1NT–P–2♠–(3♥): 3NT med stopp — aldrig 4♠', () => {
    const t = decideCallTraced(D, H('W', '1H 1NT P 2S 3H'), 'N')
    expect(t.källa).toBe('tabell:inkliv2')
    expect(t.call).toMatchObject({ bid: '3NT', rule: 'stört MSS efter 1NT-inkliv: 3NT' })
  })

  it('även när de klev in i en annan färg som Nord stoppar (3♣)', () => {
    // ♣ stoppad (K-x-x) → 3NT.
    const n = medNord('S:KJT3 H:A9 D:AT54 C:K32')
    expect(hcp(n.hands.N)).toBe(15)
    expect(decideCall(n, H('W', '1H 1NT P 2S 3C'), 'N').bid).toBe('3NT')
  })

  it('ett konstgjort systemsvar höjs aldrig "med fit": inte 4♠ över MSS, inte 4♥ över överföringen', () => {
    // MSS + deras 3♣ utan klöverstopp: ingen 3NT — men heller aldrig spader.
    const utanStopp = decideCall(D, H('W', '1H 1NT P 2S 3C'), 'N').bid
    expect(utanStopp).not.toBe('4S')
    expect(utanStopp).not.toBe('3S')
    // Överföringen 2♥ (= spader) + deras 3♣: tre hjärter är inget hjärterstöd.
    const tre = medNord('S:KJ3 H:A96 D:AKT5 C:932')
    expect(hcp(tre.hands.N)).toBe(15)
    const b = decideCall(tre, H('W', '1D 1NT P 2H 3C'), 'N').bid
    expect(b).not.toBe('4H')
    expect(b).not.toBe('3H')
  })
})

describe('Tyck till #130 – partnerns cue i deras färg är krav även dubblat', () => {
  const D = giv('tt130', 'S', 'ew', 'S:72 H:T64 D:QT93 C:A754', 'S:KJ96 H:KQ52 D:8 C:KJT9', 'S:T84 H:73 D:AKJ542 C:63', 'S:AQ53 H:AJ98 D:76 C:Q82')
  it('händerna räknade med kod: 6 · 13 · 8 · 13 = 40', () => hpKoll(D, [6, 13, 8, 13]))

  it('auktionen fram till felet: 2♦ – X – 3♦ – 4♦ (cue)', () => {
    expect(decideCall(D, [], 'S').bid).toBe('2D')
    expect(decideCall(D, H('S', '2D'), 'W').bid).toBe('X')
    expect(decideCall(D, H('S', '2D X'), 'N').bid).toBe('3D')
    expect(decideCall(D, H('S', '2D X 3D'), 'E').bid).toBe('4D')
  })

  it('odubblat svarar Väst 4♥ (som förut)', () => {
    expect(decideCall(D, H('S', '2D X 3D 4D P'), 'W').bid).toBe('4H')
  })

  it('dubblat: Väst passar ALDRIG ut cue-budet — samma svar, 4♥', () => {
    const t = decideCallTraced(D, H('S', '2D X 3D 4D X'), 'W')
    expect(t.call.bid).toBe('4H')
  })

  it('ett NATURLIGT kravbud som dubblas är inte samma sak — bara cue-budet tvingar', () => {
    // 1♠–(P)–2♣ (2-över-1, krav)–(X): öppnaren får passa (dubblingen ger
    // partnern en tur till). Vakten ska inte ha ändrat det läget.
    const d = giv('nat', 'N', 'none', 'S:AKJ52 H:Q73 D:K84 C:92', 'S:83 H:JT62 D:QJ72 C:Q83', 'S:Q4 H:AK4 D:T63 C:AKJT5', 'S:T976 H:985 D:A95 C:764')
    hpKoll(d, [13, 6, 17, 4])
    const fore = decideCallTraced(d, H('N', '1S P 2C X'), 'N')
    expect(fore.källa).not.toBe('tabell:krav-svar (vakt)')
  })
})

describe('felrapport #129 – störd inverterad lågfärgshöjning', () => {
  const D = giv('fr129', 'N', 'ew', 'S:J64 H:AKJ D:- C:AK97643', 'S:Q9732 H:53 D:T9654 C:8', 'S:AT8 H:T2 D:AKQ3 C:QJT5', 'S:K5 H:Q98764 D:J872 C:2')
  const medNord = (n: string, hp: number): Deal => {
    const d = { ...D, hands: { ...D.hands, N: parseHand(n) } }
    expect(hcp(d.hands.N)).toBe(hp)
    expect(d.hands.N).toHaveLength(13)
    return d
  }
  const medSyd = (sy: string, hp: number): Deal => {
    const d = { ...D, hands: { ...D.hands, S: parseHand(sy) } }
    expect(hcp(d.hands.S)).toBe(hp)
    expect(d.hands.S).toHaveLength(13)
    return d
  }
  const A = '1C P 2C 2H'
  it('händerna räknade med kod: 16 · 2 · 16 · 6 = 40', () => hpKoll(D, [16, 2, 16, 6]))

  it('auktionen fram till inklivet: 1♣ – pass – 2♣ (inverterad, krav)', () => {
    expect(decideCall(D, [], 'N').bid).toBe('1C')
    expect(decideCall(D, H('N', '1C P'), 'S')).toMatchObject({ bid: '2C', rule: 'inverterad minor' })
  })

  describe('öppnaren efter 1♣–2♣–(2♥)', () => {
    it('rapportens Nord (16, sju klöver, ruterrenons): hopp till 4♦ = kontrollbud', () => {
      const t = decideCallTraced(D, H('N', A), 'N')
      expect(t.källa).toBe('tabell:störd-inverterad-öppnaren')
      expect(t.call).toMatchObject({ bid: '4D', rule: 'störd inverterad: kontrollhopp' })
    })
    it('16+ med stopp, ingen kortfärg → 3NT', () => {
      expect(decideCall(medNord('S:K64 H:AQ3 D:K2 C:AJ943', 17), H('N', A), 'N')).toMatchObject({ bid: '3NT', rule: 'störd inverterad: sang' })
    })
    it('12–15 med stopp → 2NT', () => {
      expect(decideCall(medNord('S:Q64 H:KJ3 D:K72 C:AJ94', 14), H('N', A), 'N')).toMatchObject({ bid: '2NT', rule: 'störd inverterad: sang' })
    })
    it('16+ med fem klöver, ingen stopp, ingen kortfärg → 3♥ (utgångskrav)', () => {
      expect(decideCall(medNord('S:AK4 H:762 D:K2 C:AQJ94', 17), H('N', A), 'N')).toMatchObject({ bid: '3H', rule: 'störd inverterad: utgångskrav' })
    })
    it('fyrkorts sidofärg + fem klöver, ingen stopp → 2♠ (naturligt, krav)', () => {
      expect(decideCall(medNord('S:KQ74 H:62 D:K2 C:AJ943', 13), H('N', A), 'N')).toMatchObject({ bid: '2S', rule: 'störd inverterad: ny färg' })
    })
    it('fem klöver, 12–15, inget annat att visa → 3♣ (ej krav)', () => {
      expect(decideCall(medNord('S:K74 H:62 D:K82 C:AQJ94', 13), H('N', A), 'N')).toMatchObject({ bid: '3C', rule: 'störd inverterad: minimum' })
    })
    it('14–15 utan stopp och utan femte klövern → X (inte straff)', () => {
      expect(decideCall(medNord('S:AK4 H:762 D:K82 C:KJ94', 14), H('N', A), 'N')).toMatchObject({ bid: 'X', rule: 'störd inverterad: dubbling' })
    })
    it('12–13 samma handtyp → pass som är KRAV (uttryckligt pass, inte "ingen regel")', () => {
      const t = decideCallTraced(medNord('S:AK4 H:762 D:Q82 C:KJ94', 13), H('N', A), 'N')
      expect(t.källa).toBe('tabell:störd-inverterad-öppnaren')
      expect(t.call).toMatchObject({ bid: 'P', rule: 'störd inverterad: pass' })
    })
  })

  describe('svararen efter öppnarens pass eller X — passar aldrig', () => {
    for (const [namn, a] of [['pass', `${A} P P`], ['X', `${A} X P`]] as const) {
      it(`efter ${namn}: rapportens Syd (16, ingen hjärterstopp) → 3♥`, () => {
        const t = decideCallTraced(D, H('N', a), 'S')
        expect(t.källa).toBe('tabell:störd-inverterad-svararen')
        expect(t.call).toMatchObject({ bid: '3H', rule: 'störd inverterad: svararen utan stopp (13+)' })
      })
      it(`efter ${namn}: stopp och 10–12 → 2NT; stopp och 13+ → 3NT`, () => {
        expect(decideCall(medSyd('S:K82 H:QJ4 D:K63 C:Q852', 11), H('N', a), 'S').bid).toBe('2NT')
        expect(decideCall(medSyd('S:K82 H:KJ4 D:A63 C:Q852', 13), H('N', a), 'S').bid).toBe('3NT')
      })
      it(`efter ${namn}: ingen stopp, minimum → 3♣`, () => {
        expect(decideCall(medSyd('S:K82 H:742 D:A6 C:QJ852', 10), H('N', a), 'S')).toMatchObject({ bid: '3C', rule: 'störd inverterad: svararen utan stopp (minimum)' })
      })
    }
  })

  describe('öppnarens tredje tur', () => {
    const svag = medNord('S:AK4 H:762 D:Q82 C:KJ94', 13)
    const mellan = medNord('S:AK4 H:762 D:K82 C:KJ94', 14)
    it('efter pass + svararens 2NT (10–12): pass', () => {
      expect(decideCall(svag, H('N', `${A} P P 2NT P`), 'N').bid).toBe('P')
    })
    it('efter X (14–15) + svararens 2NT: 3NT', () => {
      expect(decideCall(mellan, H('N', `${A} X P 2NT P`), 'N').bid).toBe('3NT')
    })
    it('efter svararens 3♣ (minimum, ingen stopp): pass', () => {
      expect(decideCall(svag, H('N', `${A} P P 3C P`), 'N').bid).toBe('P')
      expect(decideCall(mellan, H('N', `${A} X P 3C P`), 'N').bid).toBe('P')
    })
  })

  describe('budförklaringarna', () => {
    it('passet är krav och säger vad det frågar efter', () => {
      const m = sista('N', `${A} P`)
      expect(m.rule).toBe('störd inverterad: pass')
      expect(m.forcing).toBe('krav-1-rond')
      expect(m.text).toMatch(/stopp/)
    })
    it('dubblingen är inte straff', () => {
      const m = sista('N', `${A} X`)
      expect(m.rule).toBe('störd inverterad: dubbling')
      expect(m.text).toMatch(/inte straff/i)
    })
    it('hoppet är ett kontrollbud, 3♥ är utgångskrav', () => {
      expect(sista('N', `${A} 4D`)).toMatchObject({ rule: 'störd inverterad: kontrollhopp' })
      expect(sista('N', `${A} 3H`)).toMatchObject({ rule: 'störd inverterad: utgångskrav', forcing: 'utgangskrav' })
    })
  })

  describe('efter kontrollhoppet 4♦ (ägarens budgång: 4♠ – 4NT – svar – slam)', () => {
    const B = `${A} 4D P`
    it('Syd höjer ALDRIG kortfärgen — visar billigaste kontrollen: 4♠', () => {
      const t = decideCallTraced(D, H('N', B), 'S')
      expect(t.källa).toBe('tabell:störd-inverterad-kontrollsvar')
      expect(t.call).toMatchObject({ bid: '4S', rule: 'svar på kontrollhopp: kontrollbud' })
    })
    it('Syd utan kontroll i spader och hjärter → 5♣', () => {
      expect(decideCall(medSyd('S:QT8 H:T2 D:KQJ3 C:QJT5', 11), H('N', B), 'S')).toMatchObject({ bid: '5C', rule: 'svar på kontrollhopp: ingen kontroll' })
    })
    it('Nord har resten kontrollerat → 4NT (essfråga, klöver trumf)', () => {
      const t = decideCallTraced(D, H('N', `${B} 4S P`), 'N')
      expect(t.källa).toBe('tabell:störd-inverterad-essfråga')
      expect(t.call.bid).toBe('4NT')
      expect(sista('N', `${B} 4S P 4NT`).text).toMatch(/klöver som trumf/)
    })
    it('Nord utan hjärterkontroll → 5♣ (Syd nekade hjärter med 4♠)', () => {
      expect(decideCall(medNord('S:AK4 H:Q63 D:- C:AKJ9764', 17), H('N', `${B} 4S P`), 'N').bid).toBe('5C')
    })
    it('Syd svarar 5♠ (två nyckelkort + trumfdam) och Nord bjuder slam', () => {
      expect(decideCall(D, H('N', `${B} 4S P 4NT P`), 'S').bid).toBe('5S')
      const slam = decideCall(D, H('N', `${B} 4S P 4NT P 5S P`), 'N').bid
      expect(['6C', '5NT']).toContain(slam)
    })
  })

  it('passad hand: höjningen är inte inverterad → strukturen gäller inte', () => {
    // P–P–1♣–P–2♣ är en enkel höjning (§4.2 "Passad hand").
    const t = decideCallTraced(D, H('S', 'P P 1C P 2C 2H'), 'N')
    expect(t.källa).not.toBe('tabell:störd-inverterad-öppnaren')
  })
})
