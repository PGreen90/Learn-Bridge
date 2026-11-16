// REDUBBLINGENS BETYDELSE (ägarstruktur 2026-11-16, förslag #128 — bricka 2 i
// Veckans stjärntävling nr 1). Tre lägen:
//   • XX på 3-läget och uppåt = styrka, "vi spelar här" → partnern PASSAR.
//   • 1♥/1♠–(X)–XX = EXAKT tre stöd, 8+ → öppnaren 2M svag / 3M 14–15 / 4M 16+.
//   • 1♣/1♦–(X)–XX = 8+ UTAN fyrkorts högfärg (med en sådan bjuds 1♥/1♠).
//   • 1x–(P)–1M–(X)–XX = stödredubbling (exakt tre, som stöddubblingen).
// Förr saknades regeln för 3-läget+: partnern föll till kravstegets "auktionen
// är krav" och höjde 4♠XX → 5♠ → 6♠ → 7♠ (#128).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'

const TOM = 'S:- H:- D:- C:-'
const seats: Seat[] = ['N', 'E', 'S', 'W']
/** Budföljd från `dealer`, t.ex. '1H 2D P 3S'. */
function auktion(dealer: Seat, bud: string): ResolvedCall[] {
  const start = seats.indexOf(dealer)
  return bud.split(' ').map((bid, i) => ({ seat: seats[(start + i) % 4], bid } as ResolvedCall))
}
function giv(dealer: Seat, hands: Partial<Record<Seat, string>>): Deal {
  return {
    id: 't', board: 2, dealer, vulnerability: 'ns',
    hands: Object.fromEntries(seats.map((s) => [s, parseHand(hands[s] ?? TOM)])),
  } as Deal
}

describe('XX på 3-läget och uppåt = vi spelar här → partnern passar (#128)', () => {
  const NORD = 'S:Q9832 H:Q D:J942 C:AJ5'

  it('#128: (1♥)–2♦–(P)–3♠–(4♥)–4♠–(P)–P–(X)–XX–(P)–? → Nord passar (förr 5♠)', () => {
    const h = auktion('E', '1H 2D P 3S 4H 4S P P X XX P')
    expect(decideCall(giv('E', { N: NORD }), h, 'N')).toMatchObject({ bid: 'P', rule: 'pass på partnerns redubbling' })
  })

  it('3NT redubblat står: 1NT–(P)–3NT–(X)–XX–(P)–? → pass', () => {
    const h = auktion('N', '1NT P 3NT X XX P')
    expect(decideCall(giv('N', { S: 'S:K32 H:Q52 D:KJ4 C:Q932' }), h, 'S').bid).toBe('P')
  })

  it('3-läget: 1♠–(P)–3♠–(X)–XX–(P)–? → pass', () => {
    const h = auktion('N', '1S P 3S X XX P')
    expect(decideCall(giv('N', { S: 'S:K932 H:A52 D:Q74 C:J32' }), h, 'S').bid).toBe('P')
  })

  it('bjuder de vidare över XX är läget fritt (raden tiger)', () => {
    const h = auktion('E', '1H 2D P 3S 4H 4S P P X XX 5H')
    expect(decideCall(giv('E', { N: NORD }), h, 'N').rule).not.toBe('pass på partnerns redubbling')
  })
})

/** Budet (och regeln) för `seat` med handen `hand` efter budföljden `bud` (Nord ger). */
function bjuder(bud: string, seat: Seat, hand: string) {
  const r = decideCall(giv('N', { [seat]: hand }), auktion('N', bud), seat)
  return { bid: r.bid, rule: r.rule }
}

describe('1♥/1♠–(X): XX = exakt tre stöd, 8+ (ägarstruktur 2026-11-16)', () => {
  it('svararen: tre stöd och 8+ → XX; fyra stöd 10+ → Jordan; stöd med mindre → 2M', () => {
    expect(bjuder('1H X', 'S', 'S:K52 H:Q42 D:A873 C:J52')).toEqual({ bid: 'XX', rule: 'redubbling (tre stöd)' }) // 10 hp
    expect(bjuder('1H X', 'S', 'S:K52 H:Q842 D:A73 C:J52').rule).toBe('Jordan 2NT') // 10 hp, fyra stöd
    expect(bjuder('1H X', 'S', 'S:K52 H:Q42 D:8732 C:J52').bid).toBe('2H') // 6 hp
  })

  it('utan stöd bjuds naturligt, som om dubblingen inte fanns — aldrig XX', () => {
    expect(bjuder('1H X', 'S', 'S:KJ52 H:42 D:Q873 C:J52')).toEqual({ bid: '1S', rule: 'ny färg över X' }) // 7 hp
    expect(bjuder('1H X', 'S', 'S:K52 H:42 D:AQ873 C:J52')).toEqual({ bid: '2D', rule: 'ny färg över X' }) // 10 hp
    expect(bjuder('1H X', 'S', 'S:K52 H:42 D:Q873 C:K852')).toEqual({ bid: '1NT', rule: '1NT över X' }) // 8 hp
  })

  it('öppnarens trappa: 2M svag, 3M 14–15, 4M 16+', () => {
    expect(bjuder('1H X XX P', 'N', 'S:A2 H:KQ873 D:K73 C:852')).toEqual({ bid: '2H', rule: 'efter XX: minimum' }) // 12 hp
    expect(bjuder('1H X XX P', 'N', 'S:A2 H:KQ873 D:KQ3 C:J52')).toEqual({ bid: '3H', rule: 'efter XX: inbjudan' }) // 15 hp
    expect(bjuder('1H X XX P', 'N', 'S:A2 H:AKQ73 D:KQ3 C:J52')).toEqual({ bid: '4H', rule: 'efter XX: utgång' }) // 19 hp
  })

  it('samma trappa när de flyr — ingen straffdubbling med känd fit', () => {
    expect(bjuder('1H X XX 1S', 'N', 'S:A2 H:KQ873 D:K73 C:852').bid).toBe('2H')
    expect(bjuder('1H X XX 2C', 'N', 'S:A2 H:AKQ73 D:KQ3 C:J52').bid).toBe('4H')
    // 2♥ går inte längre: den svaga handen passar, partnern känner fiten.
    expect(bjuder('1H X XX 2S', 'N', 'S:A2 H:KQ873 D:K73 C:852').bid).toBe('P')
  })

  it('redubblaren väger öppnarens besked', () => {
    expect(bjuder('1H X XX P 2H P', 'S', 'S:K94 H:K32 D:8432 C:Q52').bid).toBe('P') // 8 hp
    expect(bjuder('1H X XX P 2H P', 'S', 'S:K94 H:K32 D:A432 C:Q52').bid).toBe('3H') // 12 hp
    expect(bjuder('1H X XX P 2H P', 'S', 'S:K94 H:K32 D:A432 C:K52').bid).toBe('4H') // 13 hp
    expect(bjuder('1H X XX P 3H P', 'S', 'S:K94 H:K32 D:A432 C:852').bid).toBe('4H') // 10 hp
    expect(bjuder('1H X XX 2S P P', 'S', 'S:K94 H:K32 D:A432 C:852').bid).toBe('3H') // tävlar i fiten
  })

  it('efter 1x–(X)–1y fortsätter den vanliga linjen (X:et läses som pass)', () => {
    expect(bjuder('1D X 1S P', 'N', 'S:K942 H:A5 D:KQ87 C:J52').bid).toBe('2S') // förr 4♠ på 13 hp
    expect(bjuder('1H X 1S P', 'N', 'S:A2 H:KQ873 D:K73 C:852').bid).toBe('1NT')
  })
})

describe('1♣/1♦–(X): XX = 8+ utan fyrkorts högfärg (ägarstruktur 2026-11-16)', () => {
  it('svararen: högfärgen först, annars XX med 8+', () => {
    expect(bjuder('1D X', 'S', 'S:KJ52 H:42 D:Q73 C:J852')).toEqual({ bid: '1S', rule: 'ny färg över X' }) // 7 hp (förr pass)
    expect(bjuder('1D X', 'S', 'S:K52 H:Q42 D:K73 C:J852')).toEqual({ bid: 'XX', rule: 'redubbling' }) // 9 hp (förr pass)
  })

  it('öppnaren: de passade → pass (de måste fly)', () => {
    expect(bjuder('1D X XX P', 'N', 'S:K92 H:A52 D:KQ87 C:J52').bid).toBe('P')
  })

  it('öppnaren över flykten: straff-X, sang med stopp, ny färg, egen färg, annars kravpass', () => {
    expect(bjuder('1D X XX 1S', 'N', 'S:KQ92 H:A52 D:KQ87 C:52')).toEqual({ bid: 'X', rule: 'efter XX: straffdubbling' })
    expect(bjuder('1D X XX 1S', 'N', 'S:K92 H:A52 D:KQ87 C:J52').bid).toBe('1NT')
    expect(bjuder('1D X XX 1S', 'N', 'S:92 H:A5 D:KQ873 C:KJ52').bid).toBe('2C')
    expect(bjuder('1D X XX 1S', 'N', 'S:9 H:A5 D:KQJ8753 C:973').bid).toBe('2D') // 10 hp, sju ruter (förr pass)
    expect(bjuder('1D X XX 1S', 'N', 'S:962 H:AJ5 D:KQ87 C:K52').bid).toBe('P')
  })

  it('frö 20262689: redubblaren passar aldrig ut deras flykt (förr 1♠ utpassat med 22 hp)', () => {
    expect(bjuder('1D X XX 1S P P', 'S', 'S:K94 H:K32 D:843 C:QJ52').bid).toBe('1NT') // 9 hp, spaderstopp
    expect(bjuder('1D X XX 1S P P', 'S', 'S:94 H:K32 D:8432 C:AQ52').bid).toBe('2D') // 9 hp, fyra ruter
  })

  it('öppnaren i utpassningssitsen säljer inte heller ut', () => {
    expect(bjuder('1D X XX P P 1S P P', 'N', 'S:962 H:AJ5 D:KQ87 C:K52').bid).not.toBe('P')
  })

  it('redubblarens X är straff → öppnaren passar', () => {
    expect(bjuder('1D X XX 1S P P X P', 'N', 'S:962 H:AJ5 D:KQ87 C:K52').bid).toBe('P')
  })
})

describe('stödredubbling: 1x–(P)–1M–(X)–XX = exakt tre stöd (ägarstruktur 2026-11-16)', () => {
  it('öppnaren: exakt tre → XX; fyra → höjer; två → vanligt återbud', () => {
    expect(bjuder('1C P 1H X', 'N', 'S:A2 H:K73 D:K73 C:Q9852')).toEqual({ bid: 'XX', rule: 'stödredubbling' })
    expect(bjuder('1C P 1H X', 'N', 'S:A2 H:K873 D:K7 C:Q9852').bid).toBe('2H')
    expect(bjuder('1C P 1H X', 'N', 'S:A82 H:K7 D:K73 C:Q9852').bid).toBe('1NT')
  })

  it('gäller också när de klev in före svaret', () => {
    expect(bjuder('1C 1D 1S X', 'N', 'S:A82 H:K7 D:K73 C:Q9852').bid).toBe('XX')
  })

  it('svararen med fem kort: 2M / 3M / 4M efter styrka', () => {
    expect(bjuder('1C P 1H X XX P', 'S', 'S:K94 H:QJ532 D:843 C:K2').bid).toBe('2H') // 9 hp
    expect(bjuder('1C P 1H X XX P', 'S', 'S:K94 H:QJ532 D:A43 C:Q2').bid).toBe('3H') // 12 hp
    expect(bjuder('1C P 1H X XX P', 'S', 'S:K94 H:QJ532 D:A43 C:K2').bid).toBe('4H') // 13 hp
  })

  it('svararen med bara fyra kort spelar inte 4-3 i onödan', () => {
    expect(bjuder('1C P 1H X XX P', 'S', 'S:K94 H:QJ32 D:8432 C:K2').bid).toBe('1NT') // 9 hp, jämn
    expect(bjuder('1C P 1H X XX P', 'S', 'S:9 H:QJ32 D:8432 C:K762').bid).toBe('2C') // 6 hp, tillbaka till klövern
    expect(bjuder('1C P 1H X XX P', 'S', 'S:K94 H:QJ32 D:A432 C:K2').bid).toBe('3NT') // 13 hp
  })

  it('stödredubblaren väger svaret', () => {
    expect(bjuder('1C P 1H X XX P 2H P', 'N', 'S:A2 H:K73 D:K73 C:Q9852').bid).toBe('P') // 12 hp
    expect(bjuder('1C P 1H X XX P 2H P', 'N', 'S:A2 H:K73 D:AK3 C:KJ852').bid).toBe('3H') // 18 hp
  })
})

describe('budförklaringen läser redubblingen ur auktionen', () => {
  const text = (bud: string) => { const h = auktion('N', bud); return meaningOf(h, h.length - 1) }
  it('1♥–(X)–XX = exakt tre stöd, 8+', () => {
    expect(text('1H X XX')).toMatchObject({ rule: 'redubbling (tre stöd)' })
    expect(text('1H X XX').text).toContain('exakt tre kort i hjärter och 8+ hp')
  })
  it('1♦–(X)–XX = 8+ utan fyrkorts högfärg', () => {
    expect(text('1D X XX').text).toContain('8+ hp utan fyrkorts högfärg')
  })
  it('1♣–(P)–1♥–(X)–XX = stödredubbling', () => {
    expect(text('1C P 1H X XX')).toMatchObject({ rule: 'stödredubbling' })
    expect(text('1C 1D 1S X XX')).toMatchObject({ rule: 'stödredubbling' })
  })
})
