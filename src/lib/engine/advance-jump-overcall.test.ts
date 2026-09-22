// ADVANCERN ÖVER PARTNERNS SVAGA HOPPINKLIV (sunt förnuft-lagret hål 1, ägarbeslut
// 2026-09-22; docs/sunt-fornuft-plan.md). Hoppinklivet lovar 6+ kort och 6–10 hp.
// Förr: utan stöd pass utan regel oavsett styrka; med 3+ stöd ALLTID spärrhöjning
// (4♣ på 18 hp med stopp). Ägarens struktur:
//   • 3NT med 15+ hp och stopp i deras färg (går före höjningen);
//   • ny färg: EJ krav, lovar 5+ kort och 15+ hp;
//   • 3+ stöd → spärrhöjningen som förr; annars pass (med motivering).

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall, decideCallTraced } from './auction-live'
import { meaningOf } from './auction-meaning'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid } as ResolvedCall)
const TOM = 'S:- H:- D:- C:-'
const giv = (N: string): Deal =>
  ({ id: 't', board: 1, dealer: 'E', vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(TOM), S: parseHand(TOM), W: parseHand(TOM) } } as Deal)
/** Öst öppnar 1♠, Syd hoppinkliver 3♣, Väst passar, Nord är advancer. */
const H = [call('E', '1S'), call('S', '3C'), call('W', 'P')]
const adv = (N: string, h = H) => decideCall(giv(N), h, 'N')

describe('advancern över (1♠)–3♣–(P)', () => {
  it('15+ hp och stopp i deras färg → 3NT, även med stöd (förr 4♣)', () => {
    expect(adv('S:K8 H:AQ2 D:KQJ7 C:A853')).toMatchObject({ bid: '3NT', rule: 'advance hoppinkliv: 3NT' })
    expect(adv('S:AJ3 H:Q9 D:AKJ985 C:K5')).toMatchObject({ bid: '3NT', rule: 'advance hoppinkliv: 3NT' })
  })
  it('15+ hp utan stopp men egen 5+ färg → ny färg, ej krav (förr pass utan regel)', () => {
    expect(adv('S:85 H:AKJ94 D:AKJ3 C:86')).toMatchObject({ bid: '3H', rule: 'advance hoppinkliv: ny färg' })
  })
  it('14 hp → ingen ny färg, ingen 3NT: pass med motivering — även med 3+ stöd (ingen höjning utan utgångsintresse)', () => {
    expect(adv('S:98 H:QJ62 D:AK7 C:Q853')).toMatchObject({ bid: 'P', rule: 'pass med fit' })
    const t = decideCallTraced(giv('S:98652 H:QJ62 D:AK7 C:Q'), H, 'N')
    expect(t.call.bid).toBe('P')
    expect(t.källa).not.toBe('pass (ingen regel)')
  })
  it('15+ med 5+ i DERAS färg (spader) → ingen ny färg där; utan stopp → pass', () => {
    expect(adv('S:AQJ92 H:K6 D:KJ7 C:Q85').bid).toBe('3NT') // AQJ92 är stopp
    expect(adv('S:T9832 H:AK D:KQJ7 C:K8').bid).toBe('P') // 15 hp, inget stopp, inget stöd
  })
})

describe('bjuder motståndarna 3♠ tävlar advancern 4♣ med stödet (ägarbeslut 2026-09-22)', () => {
  it('(1♠)–3♣–(3♠)–? med 3+ stöd → 4♣', () => {
    expect(adv('S:98 H:QJ62 D:K97 C:Q853', [call('E', '1S'), call('S', '3C'), call('W', '3S')]).bid).toBe('4C')
    expect(adv('S:98 H:QJ62 D:K97 C:Q853', [...H, call('N', 'P'), call('E', '3S'), call('S', 'P'), call('W', 'P')]).bid).toBe('4C')
  })
})

describe('över (1♦)–2♠–(P): hoppinkliv i högfärg', () => {
  const h = [call('E', '1D'), call('S', '2S'), call('W', 'P')]
  it('15+ och stopp → 3NT · 15+ med femkorts hjärter → 3♥ (ej krav)', () => {
    expect(adv('S:K8 H:AQ2 D:KQJ7 C:A853', h).bid).toBe('3NT')
    expect(adv('S:A5 H:KJT94 D:K3 C:AQ86', h).bid).toBe('3NT') // stopp finns → 3NT före ny färg
    expect(adv('S:A5 H:KJT94 D:432 C:AKQ', h)).toMatchObject({ bid: '3H', rule: 'advance hoppinkliv: ny färg' })
  })
})

describe('inklivaren efter advancerns svar', () => {
  it('3NT är avslut → pass · ny färg är ej krav → rättelse till egen färg med ≤2 stöd, höjning med 3+ stöd', () => {
    const S = 'S:5 H:Q3 D:942 C:KQJ9843'
    const giv2 = (S: string): Deal => ({ ...giv(TOM), hands: { ...giv(TOM).hands, S: parseHand(S) } } as Deal)
    expect(decideCall(giv2(S), [...H, call('N', '3NT'), call('E', 'P')], 'S').bid).toBe('P')
    expect(decideCall(giv2(S), [...H, call('N', '3H'), call('E', 'P')], 'S')).toMatchObject({ bid: '4C', rule: 'rättelse till inklivsfärgen' })
    expect(decideCall(giv2('S:5 H:Q73 D:94 C:KQJ984'), [...H, call('N', '3H'), call('E', 'P')], 'S').bid).toBe('4H')
  })
})

describe('budförklaringarna', () => {
  it('3NT och ny färg förklaras ur läget', () => {
    expect(meaningOf([...H, call('N', '3NT')], 3).text).toMatch(/15\+/)
    const m = meaningOf([...H, call('N', '3H')], 3)
    expect(m.text).toMatch(/15\+/)
    expect(m.text).toMatch(/ej krav/i)
  })
})
