// Facit för mästerskapsgivarnas poängsättare (testbygget 2026-11-11). Snabba,
// utan WASM: poängsättaren matas med HANDSKRIVNA DD-tabeller, så varje signal
// prövas isolerat — den slår till på en konstruerad giv och inte på en platt.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat, Vulnerability } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import type { Strain } from '../engine/play'
import {
  fordelningsVarde,
  kandidatGiv,
  poangsattGiv,
  summakoll,
  valjTavling,
  vildhet,
  vildhetSumma,
  VIKTER,
  type DdTabell,
  type GivTyp,
  type Kandidat,
  type SignalId,
} from './masterskapsgiv'

// ---------- Byggklossar ----------

function giv(hander: Record<Seat, string>, vulnerability: Vulnerability = 'none'): Deal {
  const deal: Deal = {
    id: 'facit',
    hands: { N: parseHand(hander.N), E: parseHand(hander.E), S: parseHand(hander.S), W: parseHand(hander.W) },
    dealer: 'N',
    vulnerability,
    board: 1,
  }
  // Summakoll med kod (ägarkrav): 13 kort per hand, 52 olika, 40 hp.
  expect(summakoll(deal).ok).toBe(true)
  return deal
}

/** DD-tabell: samma stick för sidans båda spelförare om inget annat anges. */
function dd(ns: Partial<Record<Strain, number>>, ew: Partial<Record<Strain, number>>, grund = 6): DdTabell {
  const rad = (o: Partial<Record<Strain, number>>) => ({
    spades: grund, hearts: grund, diamonds: grund, clubs: grund, NT: grund, ...o,
  })
  return { N: rad(ns), S: rad(ns), E: rad(ew), W: rad(ew) }
}

/** Auktion: buden i tur och ordning från N. */
function auktion(...bud: string[]): ResolvedCall[] {
  const seats: Seat[] = ['N', 'E', 'S', 'W']
  return bud.map((bid, i) => ({ seat: seats[i % 4], bid }))
}

// PLATT: alla 4-3-3-3, 10/10/11/9 hp, ingen har något.
const PLATT = () =>
  giv({
    N: 'S:A432 H:K32 D:Q32 C:J32',
    E: 'S:K65 H:A654 D:J54 C:Q54',
    S: 'S:Q87 H:Q87 D:A876 C:K76',
    W: 'S:JT9 H:JT9 D:KT9 C:AT98',
  })
const PLATT_UNDERLAG = () => ({
  deal: PLATT(),
  dd: dd({ NT: 7 }, {}),
  parNS: 90,
  auktion: auktion('1NT', 'P', 'P', 'P'),
})

// STRIDSGIV: N/S har nio spader och 26 hp, Ö/V har tio hjärter och 14 hp.
const STRIDSGIV = (vul: Vulnerability = 'none') =>
  giv(
    {
      N: 'S:AK765 H:2 D:K43 C:8765',
      E: 'S:T9 H:AKJ65 D:J76 C:QJ4',
      S: 'S:QJ43 H:43 D:AQ5 C:AK32',
      W: 'S:82 H:QT987 D:T982 C:T9',
    },
    vul,
  )

const FYRA_SPADER = auktion('1S', 'P', '4S', 'P', 'P', 'P')

function del(u: Parameters<typeof poangsattGiv>[0], signal: SignalId) {
  return poangsattGiv(u).delar.find((d) => d.signal === signal)!
}

// ---------- Poängsättaren ----------

describe('poängsättaren', () => {
  it('vikterna summerar till 100', () => {
    expect(Object.values(VIKTER).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('en platt giv får noll på alla signaler', () => {
    const p = poangsattGiv(PLATT_UNDERLAG())
    expect(p.delar.map((d) => d.varde)).toEqual([0, 0, 0, 0, 0, 0])
    expect(p.total).toBe(0)
    expect(p.delar.every((d) => d.forklaring === '')).toBe(true)
  })

  it('nivå: utgång ger utslag, slam mer, och Ö/V:s slam räknas ned', () => {
    const utgang = { deal: STRIDSGIV(), dd: dd({ spades: 11 }, {}), parNS: 450, auktion: FYRA_SPADER }
    const slam = { ...utgang, dd: dd({ spades: 12 }, {}), parNS: 980 }
    const ovSlam = { ...utgang, dd: dd({}, { hearts: 12 }), parNS: -980 }
    expect(del(utgang, 'niva').varde).toBe(0.4)
    expect(del(slam, 'niva').varde).toBe(0.85)
    expect(del(slam, 'niva').forklaring).toContain('lillslam')
    expect(del(ovSlam, 'niva').varde).toBeCloseTo(0.85 * 0.6)
    expect(poangsattGiv(slam).typ).toBe('slam')
    expect(del(PLATT_UNDERLAG(), 'niva').varde).toBe(0)
  })

  it('knivsegg: utgången går precis hem — men inte med ett stick till godo', () => {
    const precis = { deal: STRIDSGIV(), dd: dd({ spades: 10 }, {}), parNS: 420, auktion: FYRA_SPADER }
    const bekvam = { ...precis, dd: dd({ spades: 11 }, {}), parNS: 450 }
    expect(del(precis, 'knivsegg').varde).toBe(0.7)
    expect(del(precis, 'knivsegg').forklaring).toContain('4♠ går precis hem')
    // 11 stick på 26 hp: slammen är ett stick bort men lockar ingen → bara ett litet utslag.
    expect(del(bekvam, 'knivsegg').varde).toBe(0.15)
  })

  it('knivsegg: utgången som lockar (26 hp) går precis en bet; slam precis hem ger fullt', () => {
    const bet = { deal: STRIDSGIV(), dd: dd({ spades: 9, NT: 7 }, {}), parNS: 140, auktion: FYRA_SPADER }
    const slam = { ...bet, dd: dd({ spades: 12 }, {}), parNS: 980 }
    expect(del(bet, 'knivsegg').varde).toBe(0.8)
    expect(del(bet, 'knivsegg').forklaring).toContain('precis en bet')
    expect(del(slam, 'knivsegg').varde).toBe(1)
  })

  it('knivsegg: tunn utgång (Ö/V:s 14 hp) väger fullt före nedräkningen', () => {
    const tunn = { deal: STRIDSGIV(), dd: dd({}, { hearts: 10 }), parNS: -420, auktion: auktion('P', 'P', 'P', 'P') }
    expect(del(tunn, 'knivsegg').varde).toBeCloseTo(1 * 0.6)
    expect(del(tunn, 'knivsegg').forklaring).toContain('tunn')
  })

  it('strid: båda sidor har stöd och ett kontrakt — värdet följer den svagare sidan', () => {
    const u = (nsSpader: number, ewHjarter: number) =>
      del({ deal: STRIDSGIV(), dd: dd({ spades: nsSpader }, { hearts: ewHjarter }), parNS: 0, auktion: FYRA_SPADER }, 'strid')
    expect(u(10, 7).varde).toBe(0) // Ö/V gör bara 1♥
    expect(u(10, 8).varde).toBe(0.4)
    expect(u(10, 9).varde).toBe(0.7)
    expect(u(10, 10).varde).toBe(1) // dubbel utgångssväng
    expect(u(10, 9).forklaring).toBe('N/S gör 4♠, Ö/V gör 3♥')
    // Den platta given har inget trumfstöd alls → ingen strid ens med stick.
    expect(del({ ...PLATT_UNDERLAG(), dd: dd({ spades: 9 }, { hearts: 9 }) }, 'strid').varde).toBe(0)
  })

  it('fördelning: 4-3-3-3 runt bordet = 0, lagom ojämnt ger fullt, vilt faller tillbaka', () => {
    expect([0, 2, 4, 8, 10, 12, 18].map(fordelningsVarde)).toEqual([0, 0.5, 1, 1, 0.5, 0, 0])
    expect(vildhet(parseHand('S:A432 H:K32 D:Q32 C:J32'))).toBe(0)
    expect(vildhet(parseHand('S:AK765 H:2 D:K43 C:8765'))).toBe(2) // 5-4-3-1
    expect(vildhet(parseHand('S:AKQ7654 H:- D:K43 C:876'))).toBe(5) // 7-3-3-0
    const d = del({ deal: STRIDSGIV(), dd: dd({}, {}), parNS: 0, auktion: [] }, 'fordelning')
    expect(d.varde).toBe(1) // vildhet 2 + 1 + 0 + 1 = 4
    expect(d.forklaring).toContain('N 5-4-3-1')
    expect(del(PLATT_UNDERLAG(), 'fordelning').varde).toBe(0)
  })

  it('svår att bjuda: bottarna stannar i delkontrakt när utgången går hem', () => {
    const miss = {
      deal: STRIDSGIV('all'),
      dd: dd({ spades: 10 }, {}),
      parNS: 620,
      auktion: auktion('1S', 'P', '2S', 'P', 'P', 'P'),
    }
    const p = poangsattGiv(miss)
    expect(p.botNS).toBe(170)
    // 620 − 170 = 450 → 10 IMP av taket 12.
    expect(del(miss, 'botmiss').varde).toBeCloseTo(10 / 12)
    const traff = { ...miss, auktion: FYRA_SPADER }
    expect(del(traff, 'botmiss').varde).toBe(0)
  })

  it('svår att bjuda: en utpassad giv där par är ett delkontrakt räknas', () => {
    const u = { deal: STRIDSGIV(), dd: dd({ spades: 9 }, {}), parNS: 140, auktion: auktion('P', 'P', 'P', 'P') }
    expect(poangsattGiv(u).botKontrakt).toBeNull()
    expect(del(u, 'botmiss').varde).toBeCloseTo(4 / 12) // 140 → 4 IMP
  })

  it('rätt benämning: 3NT går hem men inte 4♠ på nio trumf', () => {
    const fel = { deal: STRIDSGIV(), dd: dd({ spades: 9, NT: 9 }, {}), parNS: 400, auktion: FYRA_SPADER }
    const d = del(fel, 'svang')
    // 3NT = 400 mot 4♠ en bet = −50 → 450 → 10 IMP av taket 12.
    expect(d.varde).toBeCloseTo(10 / 12)
    expect(d.forklaring).toBe('N/S: 3NT går hem men inte 4♠ (10 IMP)')
    // Går båda hem är det inget beslut.
    const bada = { ...fel, dd: dd({ spades: 10, NT: 9 }, {}), parNS: 420 }
    expect(del(bada, 'svang').varde).toBe(0)
    // Samma mönster hos Ö/V på 14 hp är inget benämningsbeslut — ingen bjuder utgång där.
    const tunn = { ...fel, dd: dd({}, { hearts: 9, NT: 9 }), parNS: -400 }
    expect(del(tunn, 'svang').varde).toBe(0)
  })

  it('rätt benämning: hamnar bottarna själva i 3NT är valet inte svårt', () => {
    const u = {
      deal: STRIDSGIV(),
      dd: dd({ spades: 9, NT: 9 }, {}),
      parNS: 400,
      auktion: auktion('1NT', 'P', '3NT', 'P', 'P', 'P'),
    }
    expect(del(u, 'svang').varde).toBe(0)
  })

  it('spelbara benämningar: sjukorts högfärg och bottarnas egen benämning räknas, sexkorts lågfärg inte', () => {
    // Den platta given: N/S har sju spader (4-3) och sex klöver (3-3).
    const pass = auktion('P', 'P', 'P', 'P')
    const spader = { deal: PLATT(), dd: dd({ spades: 11 }, {}), parNS: 450, auktion: pass }
    const klover = { deal: PLATT(), dd: dd({ clubs: 12 }, {}), parNS: 920, auktion: pass }
    const kloverBjuden = { ...klover, auktion: auktion('1C', 'P', '5C', 'P', 'P', 'P') }
    expect(del(spader, 'niva').varde).toBe(0.4)
    // 11 stick i 4♠ = ett stick till godo → ingen knivsegg på utgången.
    expect(del(spader, 'knivsegg').forklaring).not.toContain('precis hem')
    expect(del(klover, 'niva').varde).toBe(0)
    expect(del(kloverBjuden, 'niva').varde).toBe(0.85)
  })

  it('rätt hand: utgången går bara hem från den ena handen (räknas till hälften)', () => {
    const tabell = dd({ spades: 10 }, {})
    tabell.S = { ...tabell.S, spades: 9 }
    const d = del({ deal: STRIDSGIV(), dd: tabell, parNS: 420, auktion: FYRA_SPADER }, 'svang')
    // 420 mot −50 = 470 → 10 IMP, halverat = 5 av taket 12.
    expect(d.varde).toBeCloseTo(5 / 12)
    expect(d.forklaring).toBe('N/S: 4♠ går bara hem från N (10 mot 9 stick)')
  })

  it('typen är signalen som bidrog mest; totalen är summan av delpoängen', () => {
    const u = { deal: STRIDSGIV(), dd: dd({ spades: 10 }, { hearts: 10 }), parNS: 420, auktion: FYRA_SPADER }
    const p = poangsattGiv(u)
    expect(p.total).toBeCloseTo(p.delar.reduce((a, d) => a + d.poang, 0))
    expect(p.typ).toBe('strid') // 20 poäng strid mot 17,5 knivsegg
    expect(p.typEtikett).toContain('Strid')
  })
})

// ---------- Urvalet ----------

function kandidat(index: number, board: number, total: number, typ: GivTyp, deal: Deal = PLATT()): Kandidat {
  return {
    index,
    deal: { ...deal, board },
    poang: { total, delar: [], typ, typEtikett: typ, botKontrakt: null, botNS: 0 },
  }
}

describe('urvalet', () => {
  it('tar bästa giv per bricka och returnerar i brickordning', () => {
    const k = [kandidat(0, 2, 10, 'strid'), kandidat(1, 1, 50, 'knivsegg'), kandidat(2, 2, 70, 'svang'), kandidat(3, 1, 20, 'strid')]
    const valda = valjTavling(k, { brickor: 2, maxSlam: 2, maxPerTyp: 3, maxOvStarka: 5, maxVilda: 3, golv: 45 })
    expect(valda.map((v) => v.index)).toEqual([1, 2])
  })

  it('kvoterna ger variation: högst två slamgivar, högst fyra per typ', () => {
    const k: Kandidat[] = []
    let i = 0
    for (let board = 1; board <= 12; board++) {
      k.push(kandidat(i++, board, 90, 'slam'))
      k.push(kandidat(i++, board, 80, 'knivsegg'))
      k.push(kandidat(i++, board, 70, 'strid'))
      k.push(kandidat(i++, board, 60, 'botmiss'))
      k.push(kandidat(i++, board, 50, 'svang'))
    }
    const valda = valjTavling(k)
    const antal = (t: GivTyp) => valda.filter((v) => v.poang.typ === t).length
    expect(valda).toHaveLength(12)
    expect(new Set(valda.map((v) => v.deal.board)).size).toBe(12)
    expect(antal('slam')).toBe(2)
    expect(antal('knivsegg')).toBe(4)
    expect(antal('strid')).toBe(4)
    expect(antal('botmiss')).toBe(2)
    expect(antal('svang')).toBe(0)
  })

  it('Ö/V-kvoten: högst fem givar där Ö/V har korten', () => {
    // I stridsgiven har N/S 26 hp; vänd på den så Ö/V får 26.
    const s = STRIDSGIV()
    const ovStark: Deal = { ...s, hands: { N: s.hands.E, E: s.hands.N, S: s.hands.W, W: s.hands.S } }
    const k: Kandidat[] = []
    let i = 0
    for (let board = 1; board <= 12; board++) {
      k.push(kandidat(i++, board, 90, (['knivsegg', 'strid', 'botmiss', 'svang'] as const)[board % 4], ovStark))
      k.push(kandidat(i++, board, 40, (['strid', 'botmiss', 'svang', 'knivsegg'] as const)[board % 4], s))
    }
    // Typkvoten släpps här (12) så bara Ö/V-kvoten prövas.
    const valda = valjTavling(k, { brickor: 12, maxSlam: 2, maxPerTyp: 12, maxOvStarka: 5, maxVilda: 3, golv: 45 })
    expect(valda).toHaveLength(12)
    expect(valda.filter((v) => v.poang.total === 90)).toHaveLength(5)
  })

  it('vild-kvoten: högst tre givar med renonser och sjukortsfärger', () => {
    const vild = giv({
      N: 'S:AKQJT98 H:- D:432 C:432',
      E: 'S:- H:AKQJT98 D:765 C:765',
      S: 'S:765432 H:- D:AK C:AKQJT',
      W: 'S:- H:765432 D:QJT98 C:98',
    })
    expect(vildhetSumma(vild)).toBe(18)
    expect(vildhetSumma(PLATT())).toBe(0)
    const k: Kandidat[] = []
    let i = 0
    for (let board = 1; board <= 12; board++) {
      k.push(kandidat(i++, board, 90, 'strid', vild))
      k.push(kandidat(i++, board, 40, 'knivsegg', PLATT()))
    }
    const valda = valjTavling(k, { brickor: 12, maxSlam: 2, maxPerTyp: 12, maxOvStarka: 12, maxVilda: 3, golv: 45 })
    expect(valda).toHaveLength(12)
    expect(valda.filter((v) => v.poang.total === 90)).toHaveLength(3)
  })

  it('golvet: typkvoten får aldrig tvinga in en svag giv när en bra finns', () => {
    // Bricka 1–4 har var sin stark knivseggsgiv; bricka 5 har en knivseggsgiv
    // på 60 och en svag stridsgiv på 20. Typkvoten (4) är full när bricka 5
    // ska väljas — men 20-poängaren ligger under golvet, så 60-poängaren tas.
    const k: Kandidat[] = []
    for (let board = 1; board <= 4; board++) k.push(kandidat(board, board, 80, 'knivsegg'))
    k.push(kandidat(10, 5, 60, 'knivsegg'), kandidat(11, 5, 20, 'strid'))
    const valda = valjTavling(k, { brickor: 5, maxSlam: 2, maxPerTyp: 4, maxOvStarka: 5, maxVilda: 3, golv: 45 })
    expect(valda.map((v) => v.index)).toEqual([1, 2, 3, 4, 10])
    // Ligger alternativet ÖVER golvet håller typkvoten.
    k[5] = kandidat(11, 5, 50, 'strid')
    const valda2 = valjTavling(k, { brickor: 5, maxSlam: 2, maxPerTyp: 4, maxOvStarka: 5, maxVilda: 3, golv: 45 })
    expect(valda2.map((v) => v.index)).toEqual([1, 2, 3, 4, 11])
  })

  it('för få kandidater: brickorna fylls ändå (kvoterna släpps)', () => {
    const k = Array.from({ length: 12 }, (_, i) => kandidat(i, i + 1, 50, 'slam'))
    expect(valjTavling(k)).toHaveLength(12)
  })

  it('kandidatGiv är deterministisk, giltig och går runt brickorna 1–12', () => {
    const a = kandidatGiv(20261111, 17)
    const b = kandidatGiv(20261111, 17)
    expect(a).toEqual(b)
    expect(a.board).toBe(6)
    expect(kandidatGiv(20261111, 18).hands).not.toEqual(a.hands)
    expect(kandidatGiv(20261112, 17).hands).not.toEqual(a.hands)
    for (let i = 0; i < 48; i++) expect(summakoll(kandidatGiv(7, i)).ok).toBe(true)
    expect(new Set(Array.from({ length: 24 }, (_, i) => kandidatGiv(7, i).board)).size).toBe(12)
  })
})
