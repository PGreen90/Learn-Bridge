// GAMBLING 3NT — facit (ägarbeslut 2026-09-14, budsystem §3.1 + §4.4).
// Skrivet FÖRE bygget. 3NT-öppningen betyder inte längre 25–27 balanserad utan
// en solid 7+ lågfärg (AKQ i topp) utan ess/kung vid sidan om (aggressiv stil);
// 25–27 balanserad flyttar in i 2♣-linjen (2♣–2♦–3NT), 28–30 blir 4NT-återbud.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand, seatAt } from '../bidding'
import { auctionComplete, decideCall } from './auction-live'
import { meaningOf } from './auction-meaning'
import { classifyOpening } from './openings'
import { openerRebidAfter2C } from './responses-2c'
import { forcingOf, isAlertRule } from './rules'
import { respondToGambling3NT, openerRebidAfterGambling3NT, isGambling3NTHand } from './gambling-3nt'
import type { ResponseResult } from './responses'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const open = (n: string, seatOrder: 1 | 2 | 3 | 4 = 1, vul = false) => classifyOpening(parseHand(n), vul, seatOrder).call
const r = (call: ResponseResult['call'], rule: string): ResponseResult => ({ call, rule, explanation: '' })

/** Giv ur två namngivna händer; resten av leken delas växelvis till de andra två stolarna. */
function dealOf(dealer: Seat, hands: Partial<Record<Seat, string>>): Deal {
  const parsed: Partial<Record<Seat, Card[]>> = {}
  for (const s of Object.keys(hands) as Seat[]) parsed[s] = parseHand(hands[s]!)
  const used = new Set(Object.values(parsed).flat().map((c) => `${c.suit}${c.rank}`))
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const rest: Card[] = []
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) for (const rank of ranks) if (!used.has(`${suit}${rank}`)) rest.push({ suit, rank })
  const others = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => !parsed[s])
  const full = { ...parsed } as Record<Seat, Card[]>
  others.forEach((s, i) => { full[s] = rest.filter((_, k) => k % others.length === i) })
  return { id: 'facit', dealer, vulnerability: 'none', board: 1, hands: full }
}

/** Bottarna bjuder given klart; buden i ordning. */
function spelaKlart(deal: Deal): string[] {
  const hist: ResolvedCall[] = []
  while (!auctionComplete(hist) && hist.length < 40) hist.push(decideCall(deal, hist, seatAt(deal.dealer, hist.length)))
  return hist.map((c) => c.bid)
}

describe('Gambling 3NT – öppningen (§3.1): solid 7+ lågfärg, inget ess/kung vid sidan om', () => {
  it('♠84 ♥Q2 ♦AKQ9763 ♣53 → 3NT (7 solida ruter, bara en dam utanför)', () => {
    expect(open('S:84 H:Q2 D:AKQ9763 C:53')).toBe('3NT')
  })
  it('♠5 ♥J83 ♦J4 ♣AKQT872 → 3NT (8 solida klöver, singel är okej)', () => {
    expect(open('S:5 H:J83 D:J4 C:AKQT872')).toBe('3NT')
  })
  it('♠A4 ♥73 ♦AKQ8752 ♣9 → 1♦ (ess utanför: för stark för Gambling)', () => {
    expect(open('S:A4 H:73 D:AKQ8752 C:9')).toBe('1D')
  })
  it('♠K4 ♥73 ♦AKQ8752 ♣9 → 1♦ (kung utanför)', () => {
    expect(open('S:K4 H:73 D:AKQ8752 C:9')).toBe('1D')
  })
  it('♠9853 ♥— ♦42 ♣AKQJ763 → inte 3NT (renons och 4-korts sidofärg)', () => {
    expect(open('S:9853 D:42 C:AKQJ763')).not.toBe('3NT')
  })
  it('♠84 ♥42 ♦73 ♣AKJT763 → inte 3NT (inte solid: damen saknas)', () => {
    expect(open('S:84 H:42 D:73 C:AKJT763')).not.toBe('3NT')
  })
  it('samma betydelse i alla sitsar: 3:e och 4:e hand öppnar också 3NT, sårbar också', () => {
    expect(open('S:84 H:Q2 D:AKQ9763 C:53', 3)).toBe('3NT')
    expect(open('S:84 H:Q2 D:AKQ9763 C:53', 4)).toBe('3NT')
    expect(open('S:84 H:Q2 D:AKQ9763 C:53', 1, true)).toBe('3NT')
  })
  it('25–27 balanserad öppnar inte längre 3NT utan 2♣', () => {
    expect(open('S:AKQ4 H:AK5 D:AQ3 C:KJ8')).toBe('2C') // 26 hp
  })
  it('isGambling3NTHand pekar ut lågfärgen', () => {
    expect(isGambling3NTHand(parseHand('S:84 H:Q2 D:AKQ9763 C:53'))).toBe('diamonds')
    expect(isGambling3NTHand(parseHand('S:5 H:J83 D:J4 C:AKQT872'))).toBe('clubs')
    expect(isGambling3NTHand(parseHand('S:A4 H:73 D:AKQ8752 C:9'))).toBeNull()
  })
})

describe('Gambling 3NT – svaren (§3.1): pass med håll, annars 4♣ pass-eller-rätta, 4M naturligt, 5♣ med utgångsvärden', () => {
  const svar = (n: string) => respondToGambling3NT(parseHand(n)).call

  it('håll i båda högfärgerna + en lågfärg, ≤3 kort i den andra (partnerns) → pass', () => {
    expect(svar('S:A73 H:K85 D:Q952 C:J86')).toBe('P')
  })
  it('håll i alla fyra färgerna → pass', () => {
    expect(svar('S:A73 H:K85 D:Q95 C:KJ86')).toBe('P')
  })
  it('utan håll i högfärgerna → 4♣ (pass eller rätta)', () => {
    expect(svar('S:973 H:85 D:Q952 C:J864')).toBe('4C')
  })
  it('12 hp men hjärtern öppen → 4♣ (aggressiv stil: ett ostoppat hål räcker)', () => {
    expect(svar('S:KQ3 H:J8 D:AJ74 C:Q875')).toBe('4C')
  })
  it('4+ kort i den ostoppade lågfärgen (knappast partnerns) → 4♣', () => {
    expect(svar('S:A73 H:K85 D:9752 C:Q86')).toBe('4C')
  })
  it('bra 6+ högfärg utan håll runt om → 4♠ till spel', () => {
    expect(svar('S:AKJ975 H:85 D:932 C:74')).toBe('4S')
  })
  it('3+ i båda lågfärgerna, 3 spelfasta stick, högfärgerna öppna → 5♣ (pass eller rätta)', () => {
    expect(svar('S:A H:853 D:J854 C:AK742')).toBe('5C')
  })
})

describe('Gambling 3NT – öppnarens rättelse', () => {
  const rebid = (resp: ResponseResult, n: string) => openerRebidAfterGambling3NT(resp, parseHand(n))!.call
  const fourC = r('4C', 'Gambling: 4♣ pass eller rätta')
  const fiveC = r('5C', 'Gambling: 5♣ pass eller rätta')

  it('4♣ med klöver → pass; med ruter → 4♦', () => {
    expect(rebid(fourC, 'S:84 H:Q2 D:53 C:AKQ9763')).toBe('P')
    expect(rebid(fourC, 'S:84 H:Q2 D:AKQ9763 C:53')).toBe('4D')
  })
  it('5♣ med klöver → pass; med ruter → 5♦', () => {
    expect(rebid(fiveC, 'S:84 H:Q2 D:53 C:AKQ9763')).toBe('P')
    expect(rebid(fiveC, 'S:84 H:Q2 D:AKQ9763 C:53')).toBe('5D')
  })
  it('partnerns 4♠ till spel → pass', () => {
    expect(rebid(r('4S', 'Gambling: 4M till spel'), 'S:84 H:Q2 D:AKQ9763 C:53')).toBe('P')
  })
})

describe('Gambling 3NT – hela auktionen stol för stol (decideCall)', () => {
  it('3NT – P – 4♣ – P – 4♦ (rättelse) och sedan pass runt', () => {
    const deal = dealOf('N', { N: 'S:84 H:Q2 D:AKQ9763 C:53', S: 'S:973 H:85 D:52 C:JT8642' })
    expect(spelaKlart(deal)).toEqual(['3NT', 'P', '4C', 'P', '4D', 'P', 'P', 'P'])
  })
  it('3NT – P – 4♣ – P – P (klöver är lågfärgen)', () => {
    const deal = dealOf('N', { N: 'S:84 H:Q2 D:53 C:AKQ9763', S: 'S:973 H:85 D:JT8642 C:52' })
    expect(spelaKlart(deal)).toEqual(['3NT', 'P', '4C', 'P', 'P', 'P'])
  })
  it('3NT – P – 5♣ – P – 5♦ (rättelse på 5-läget)', () => {
    const deal = dealOf('N', { N: 'S:84 H:Q2 D:AKQ9763 C:53', S: 'S:A H:853 D:J854 C:AK742' })
    expect(spelaKlart(deal)).toEqual(['3NT', 'P', '5C', 'P', '5D', 'P', 'P', 'P'])
  })
  it('3NT – P – P (svararen har håll) – P', () => {
    const deal = dealOf('N', { N: 'S:84 H:Q2 D:AKQ9763 C:53', S: 'S:A73 H:K85 D:J52 C:KJ86' })
    expect(spelaKlart(deal)).toEqual(['3NT', 'P', 'P', 'P'])
  })
})

describe('Gambling 3NT – 25–27 balanserad flyttar in i 2♣-linjen (§4.4)', () => {
  const rebid = (n: string) => openerRebidAfter2C(parseHand(n), r('2D', '2♦ väntebud')).call

  it('2♣–2♦–3NT = 25–27 balanserad', () => {
    expect(rebid('S:AKQ4 H:AK5 D:AQ3 C:KJ8')).toBe('3NT') // 26 hp
  })
  it('2♣–2♦–4NT = 28–30 balanserad', () => {
    expect(rebid('S:AKQ4 H:AKQ D:AK3 C:A32')).toBe('4NT') // 29 hp
  })
  it('hela auktionen: 26 mittemot 4 → 2♣–2♦–3NT, pass (30 ihop)', () => {
    const deal = dealOf('N', { N: 'S:AKQ4 H:AK5 D:AQ3 C:KJ8', S: 'S:J82 H:Q73 D:J74 C:9652' })
    expect(spelaKlart(deal)).toEqual(['2C', 'P', '2D', 'P', '3NT', 'P', 'P', 'P'])
  })
  it('hela auktionen: 26 mittemot 7 → 2♣–2♦–3NT, pass (räknar mot visat minimum 25: 32 — hellre systemriktig miss)', () => {
    const deal = dealOf('N', { N: 'S:AKQ4 H:AK5 D:AQ3 C:KJ8', S: 'S:J82 H:Q73 D:KJ4 C:9652' })
    expect(spelaKlart(deal)).toEqual(['2C', 'P', '2D', 'P', '3NT', 'P', 'P', 'P'])
  })
  it('hela auktionen: 26 mittemot 8 balanserad → 2♣–2NT (positivt), öppnaren vet 33+ → 6NT', () => {
    const deal = dealOf('N', { N: 'S:AKQ4 H:AK5 D:AQ3 C:KJ8', S: 'S:J82 H:Q73 D:KJ4 C:Q652' })
    expect(spelaKlart(deal)).toEqual(['2C', 'P', '2NT', 'P', '6NT', 'P', 'P', 'P'])
  })
  it('hela auktionen: 29 mittemot 8 balanserad → 2♣–2NT, 7NT (37 ihop)', () => {
    const deal = dealOf('N', { N: 'S:AKQ4 H:AKQ D:AK3 C:A32', S: 'S:J82 H:J73 D:QJ4 C:KJ65' })
    expect(spelaKlart(deal)).toEqual(['2C', 'P', '2NT', 'P', '7NT', 'P', 'P', 'P'])
  })
  it('hela auktionen: 29 mittemot 5 → 2♣–2♦–4NT, 6NT (34 ihop)', () => {
    const deal = dealOf('N', { N: 'S:AKQ4 H:AKQ D:AK3 C:A32', S: 'S:J82 H:J73 D:QJ4 C:9654' })
    expect(spelaKlart(deal)).toEqual(['2C', 'P', '2D', 'P', '4NT', 'P', '6NT', 'P', 'P', 'P'])
  })
  it('hela auktionen: 29 mittemot 2 → 2♣–2♦–4NT, pass', () => {
    const deal = dealOf('N', { N: 'S:AKQ4 H:AKQ D:AK3 C:A32', S: 'S:J82 H:J73 D:984 C:9654' })
    expect(spelaKlart(deal)).toEqual(['2C', 'P', '2D', 'P', '4NT', 'P', 'P', 'P'])
  })
})

describe('Gambling 3NT – bottarnas försvar mot DERAS 3NT (v1: pass eller naturlig 4M)', () => {
  it('bra 6+ spader med öppningsstyrka → 4♠', () => {
    const deal = dealOf('E', { E: 'S:84 H:Q2 D:AKQ9763 C:53', S: 'S:AKJ975 H:K85 D:J2 C:74' })
    expect(decideCall(deal, [call('E', '3NT')], 'S').bid).toBe('4S')
  })
  it('jämn hand utan lång högfärg → pass', () => {
    const deal = dealOf('E', { E: 'S:84 H:Q2 D:AKQ9763 C:53', S: 'S:KJ5 H:K85 D:J82 C:A974' })
    expect(decideCall(deal, [call('E', '3NT')], 'S').bid).toBe('P')
  })
  it('också i balanseringssitsen (3NT – P – P – ?)', () => {
    const deal = dealOf('N', { N: 'S:84 H:Q2 D:AKQ9763 C:53', W: 'S:AKJ975 H:K85 D:J2 C:74' })
    expect(decideCall(deal, [call('N', '3NT'), call('E', 'P'), call('S', 'P')], 'W').bid).toBe('4S')
  })
})

describe('Gambling 3NT – betydelselagret + kravnivåer', () => {
  it('3NT som öppning förklaras som Gambling (alertpliktig)', () => {
    const m = meaningOf([call('N', '3NT')], 0)
    expect(m.rule).toBe('Gambling 3NT')
    expect(m.text).toMatch(/solid/i)
    expect(m.alert).toBe(true)
  })
  it('4♣ över Gambling 3NT = pass eller rätta; 4♦ = öppnarens rättelse', () => {
    const h = [call('N', '3NT'), call('E', 'P'), call('S', '4C'), call('W', 'P'), call('N', '4D')]
    expect(meaningOf(h, 2).rule).toBe('Gambling: 4♣ pass eller rätta')
    expect(meaningOf(h, 4).rule).toBe('Gambling: rättelse')
  })
  it('5♣ över Gambling 3NT = pass eller rätta; 4♠ = naturligt till spel', () => {
    const h = [call('N', '3NT'), call('E', 'P'), call('S', '5C')]
    expect(meaningOf(h, 2).rule).toBe('Gambling: 5♣ pass eller rätta')
    expect(meaningOf([call('N', '3NT'), call('E', 'P'), call('S', '4S')], 2).rule).toBe('Gambling: 4M till spel')
  })
  it('2♣–2♦–3NT förklaras som 25–27, 4NT som 28–30', () => {
    const h = [call('N', '2C'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '3NT')]
    expect(meaningOf(h, 4).rule).toBe('rebid: 3NT (25–27)')
    const h2 = [call('N', '2C'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '4NT')]
    expect(meaningOf(h2, 4).rule).toBe('rebid: 4NT (28–30)')
  })
  it('kravnivåerna finns i registret', () => {
    expect(forcingOf('Gambling 3NT')).toBe('ej-krav')
    expect(forcingOf('Gambling: 4♣ pass eller rätta')).toBe('ej-krav')
    expect(forcingOf('Gambling: 5♣ pass eller rätta')).toBe('ej-krav')
    expect(forcingOf('Gambling: 4M till spel')).toBe('avslut')
    expect(forcingOf('Gambling: rättelse')).toBe('avslut')
    expect(forcingOf('rebid: 3NT (25–27)')).toBe('ej-krav')
    expect(forcingOf('rebid: 4NT (28–30)')).toBe('ej-krav')
    expect(isAlertRule('Gambling: 4♣ pass eller rätta')).toBe(true)
  })
})
