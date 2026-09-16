// Puppet Stayman över 2NT (ägardirektiv 2026-09-15, plan `docs/puppet-stayman-plan.md`).
// FACIT FÖRE FIX. Ägarens grindbeslut 2026-09-15:
//   1) 3♣ kräver bara en 3-korts högfärg (och utgångsvärden) — ingen 4333-undantag.
//   2) 5-4 i högfärgerna: 5♥4♠ via transfer + 3♠, 5♠4♥ via 3♣ + 4♦ (Smolen över 2NT bort).
//   3) samma struktur efter 2♣–2♦–2NT (22–24). 4) slamport efter Puppet-fit.
//   5) öppnaren med 4-4 efter 4♦/4♣ bjuder sin bättre högfärg (lika → 4♥).
//   6) 4♣ = båda högfärgerna + slamintresse byggs nu. 7) systems on även över
//   vårt 2NT-inkliv (15–18) med lägre trösklar. 8) ingen Muppet.
import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideFromTable } from './auction-decide'
import { auctionFacts } from './auction-facts'
import { meaningOf } from './auction-meaning'
import { openerRebidAfter2NTResponse, respondTo2NT } from './responses-2nt'
import { responderRebidIn2NTAuction } from './responder-rebids'
import { openerChoosesAfterSystemsOn } from './strong-2nt-systemson'
import { forcingOf, isAlertRule } from './rules'
import type { ResponseResult } from './responses'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
const P = (s: Seat) => call(s, 'P')
const bud = (hand: string, hist: ResolvedCall[], seat: Seat) => decideFromTable(parseHand(hand), auctionFacts(hist, seat), false)?.call
/** Ostörd N/S-sekvens: N, S, N, S … med pass från Ö/V emellan. */
const seq = (...bids: string[]): ResolvedCall[] => {
  const out: ResolvedCall[] = []
  bids.forEach((b, i) => {
    out.push(call(i % 2 === 0 ? 'N' : 'S', b))
    out.push(P(i % 2 === 0 ? 'E' : 'W'))
  })
  return out
}
const rr = (call: string, rule: string): ResponseResult => ({ call, rule, explanation: '' })
const PUPPET = rr('3C', 'Puppet Stayman')

describe('Puppet Stayman – svararens första bud över 2NT (respondTo2NT)', () => {
  const r = (n: string, min = 20) => respondTo2NT(parseHand(n), min)
  it('4-korts högfärg → 3♣ (Puppet Stayman)', () => {
    expect(r('S:KJ43 H:Q4 D:K543 C:432')).toMatchObject({ call: '3C', rule: 'Puppet Stayman' })
  })
  it('bara 3-korts högfärg (3-3-4-3) → 3♣ — letar partnerns 5-korts (beslut 1)', () => {
    expect(r('S:K43 H:Q42 D:K543 C:432')).toMatchObject({ call: '3C', rule: 'Puppet Stayman' })
  })
  it('3-2-5-3 → 3♣', () => {
    expect(r('S:Q73 H:J7 D:K6542 C:Q83').call).toBe('3C')
  })
  it('ingen 3-korts högfärg (2-2-5-4) → 3NT direkt', () => {
    expect(r('S:Q3 H:J7 D:KJ654 C:Q853')).toMatchObject({ call: '3NT', rule: '3NT till spel' })
  })
  it('5♠ + 4♥ → 3♣ (beslut 2: hybriden)', () => {
    expect(r('S:KJ432 H:Q543 D:K4 C:43')).toMatchObject({ call: '3C', rule: 'Puppet Stayman' })
  })
  it('5♥ + 4♠ → 3♦ transfer (visar spadern i nästa vända)', () => {
    expect(r('S:Q543 H:KJ432 D:K4 C:43')).toMatchObject({ call: '3D', rule: 'transfer (2NT)' })
  })
  it('5-5 i högfärgerna → 3♥ transfer till spader', () => {
    expect(r('S:KJ432 H:QJ543 D:K4 C:4')).toMatchObject({ call: '3H', rule: 'transfer (2NT)' })
  })
  it('svag 5-4 → transfer till 5-färgen (signoff), inte 3♣', () => {
    expect(r('S:J9432 H:Q543 D:4 C:432').call).toBe('3H')
  })
  it('för svag för utgång utan 5-korts högfärg → pass', () => {
    expect(r('S:432 H:543 D:6432 C:765').call).toBe('P')
  })
  it('minorfrågan (5-4 lågfärger, slamvärden) går före 3-korts-Puppet', () => {
    expect(r('S:432 H:K D:AQ43 C:KQ432')).toMatchObject({ call: '3S', rule: 'minorfråga (2NT)' })
  })
  it('mot 22–24 (systems on): 3 hp med 3-korts högfärg räcker för 3♣', () => {
    expect(r('S:K43 H:542 D:6543 C:432', 22).call).toBe('3C')
  })
})

describe('Puppet Stayman – öppnarens svar på 3♣', () => {
  const o = (n: string) => openerRebidAfter2NTResponse(PUPPET, parseHand(n))
  it('5 hjärter → 3♥', () => {
    expect(o('S:AK H:AQJ43 D:KQ4 C:K32')).toMatchObject({ call: '3H', rule: 'Puppet-svar' })
  })
  it('5 spader → 3♠', () => {
    expect(o('S:AQJ43 H:AK D:KQ4 C:K32')).toMatchObject({ call: '3S', rule: 'Puppet-svar' })
  })
  it('4-korts högfärg, ingen 5-korts → 3♦', () => {
    expect(o('S:AQ43 H:AK4 D:KQ4 C:K32')).toMatchObject({ call: '3D', rule: 'Puppet-svar' })
  })
  it('varken 4- eller 5-korts högfärg → 3NT', () => {
    expect(o('S:AKQ H:AQ4 D:KQ43 C:K32')).toMatchObject({ call: '3NT', rule: 'Puppet-svar: ingen högfärg' })
  })
})

describe('Puppet Stayman – svararens fortsättning (responderRebidIn2NTAuction)', () => {
  const after = (rebidCall: string, n: string, min = 20) =>
    responderRebidIn2NTAuction(PUPPET, rr(rebidCall, rebidCall === '3NT' ? 'Puppet-svar: ingen högfärg' : 'Puppet-svar'), parseHand(n), min)
  it('efter 3♦ med 4 spader → 3♥ (bjuder högfärgen jag INTE har)', () => {
    expect(after('3D', 'S:KJ43 H:Q42 D:K43 C:432')).toMatchObject({ call: '3H', rule: 'Puppet: 4 spader' })
  })
  it('efter 3♦ med 4 hjärter → 3♠', () => {
    expect(after('3D', 'S:Q42 H:KJ43 D:K43 C:432')).toMatchObject({ call: '3S', rule: 'Puppet: 4 hjärter' })
  })
  it('efter 3♦ med båda högfärgerna, utgångsvärden → 4♦', () => {
    expect(after('3D', 'S:KJ43 H:Q543 D:K4 C:432')).toMatchObject({ call: '4D', rule: 'Puppet: båda högfärgerna' })
  })
  it('efter 3♦ med 5♠4♥ → 4♦ (fit garanterad — 3♦ lovade en 4-korts)', () => {
    expect(after('3D', 'S:KJ432 H:Q543 D:K4 C:43')!.call).toBe('4D')
  })
  it('efter 3♦ med båda högfärgerna och slamintresse (31+ mot visade 20) → 4♣', () => {
    expect(after('3D', 'S:KJ43 H:QJ43 D:K4 C:K32')).toMatchObject({ call: '4C', rule: 'Puppet: båda, slamintresse' })
  })
  it('efter 3♦ utan 4-korts högfärg (letade 5-3) → 3NT', () => {
    expect(after('3D', 'S:K43 H:Q42 D:K543 C:432')).toMatchObject({ call: '3NT' })
  })
  it('efter 3♦ utan 4-korts men 11 hp → 4NT kvantitativ', () => {
    expect(after('3D', 'S:K43 H:KQ4 D:K543 C:432')).toMatchObject({ call: '4NT', rule: '4NT kvantitativ' })
  })
  it('efter 3♥ (5 hjärter) med 3-korts stöd → 4♥', () => {
    expect(after('3H', 'S:K43 H:Q42 D:K543 C:432')!.call).toBe('4H')
  })
  it('efter 3♠ (5 spader) utan stöd → 3NT', () => {
    expect(after('3S', 'S:K4 H:Q432 D:K543 C:432')!.call).toBe('3NT')
  })
  it('efter 3NT (ingen högfärg) → pass', () => {
    expect(after('3NT', 'S:K43 H:Q42 D:K543 C:432')!.call).toBe('P')
  })
  it('efter 3NT med 11 hp → 4NT kvantitativ', () => {
    expect(after('3NT', 'S:K43 H:KQ4 D:K543 C:432')!.call).toBe('4NT')
  })
  it('efter 3NT med 13 hp → 6NT', () => {
    expect(after('3NT', 'S:K43 H:KQ4 D:KQ43 C:432')!.call).toBe('6NT')
  })
  it('mot 22–24: efter 3♦ med 4 spader och 3 hp → 3♥', () => {
    expect(after('3D', 'S:K432 H:542 D:6543 C:43', 22)!.call).toBe('3H')
  })
  it('transfer 3♦–3♥ med 5♥4♠ → 3♠ (4 spader, utgångskrav, under 3NT)', () => {
    const res = responderRebidIn2NTAuction(rr('3D', 'transfer (2NT)'), rr('3H', 'fullföljd transfer'), parseHand('S:Q543 H:KJ432 D:K4 C:43'))
    expect(res).toMatchObject({ call: '3S', rule: 'transfer: 4 spader' })
  })
  it('transfer 3♥–3♠ med 5-5 → 4♥ (öppnaren väljer högfärg)', () => {
    const res = responderRebidIn2NTAuction(rr('3H', 'transfer (2NT)'), rr('3S', 'fullföljd transfer'), parseHand('S:KJ432 H:QJ543 D:K4 C:4'))
    expect(res).toMatchObject({ call: '4H', rule: 'transfer: 5 hjärter' })
  })
  it('transfer 3♦–3♥ med exakt 5 hjärter, jämn → 3NT som förut', () => {
    const res = responderRebidIn2NTAuction(rr('3D', 'transfer (2NT)'), rr('3H', 'fullföljd transfer'), parseHand('S:K3 H:KJ432 D:Q43 C:432'))
    expect(res!.call).toBe('3NT')
  })
})

describe('Puppet Stayman – öppnarens val (openerChoosesAfterSystemsOn)', () => {
  const choose = (n: string, resp: ResponseResult, place: ResponseResult) => openerChoosesAfterSystemsOn(parseHand(n), resp, place)
  const fourSp = rr('3H', 'Puppet: 4 spader')
  const fourHe = rr('3S', 'Puppet: 4 hjärter')
  it('svararen visar 4 spader (3♥): 4 spader → 4♠', () => {
    expect(choose('S:AQ43 H:AK4 D:KQ4 C:K32', PUPPET, fourSp)).toMatchObject({ call: '4S', rule: 'väljer utgång efter Puppet' })
  })
  it('svararen visar 4 spader (3♥): bara 4 hjärter → 3NT', () => {
    expect(choose('S:AK4 H:AQ43 D:KQ4 C:K32', PUPPET, fourSp)!.call).toBe('3NT')
  })
  it('svararen visar 4 hjärter (3♠): 4 hjärter → 4♥', () => {
    expect(choose('S:AK4 H:AQ43 D:KQ4 C:K32', PUPPET, fourHe)!.call).toBe('4H')
  })
  it('4♦ (båda): öppnaren med 4-4 bjuder sin bättre högfärg — hjärter AK43 före spader AQ43', () => {
    expect(choose('S:AQ43 H:AK43 D:KQ C:K32', PUPPET, rr('4D', 'Puppet: båda högfärgerna'))!.call).toBe('4H')
  })
  it('4♦ (båda): öppnaren med 4-4 och bättre spader → 4♠', () => {
    expect(choose('S:AK43 H:QJ43 D:AK C:K32', PUPPET, rr('4D', 'Puppet: båda högfärgerna'))!.call).toBe('4S')
  })
  it('4♣ (båda + slamintresse): öppnaren bjuder sin högfärg på 4-läget', () => {
    expect(choose('S:AQ42 H:AK5 D:AQ3 C:Q54', PUPPET, rr('4C', 'Puppet: båda, slamintresse'))!.call).toBe('4S')
  })
  const trH = rr('3D', 'transfer (2NT)')
  const trS = rr('3H', 'transfer (2NT)')
  it('transfer + 3♠ (5♥4♠): 4 spader → 4♠', () => {
    expect(choose('S:AK92 H:A6 D:AQ53 C:QJ4', trH, rr('3S', 'transfer: 4 spader'))!.call).toBe('4S')
  })
  it('transfer + 3♠ (5♥4♠): 3 hjärter, inga 4 spader → 4♥ (5-3)', () => {
    expect(choose('S:AK9 H:A62 D:AQ53 C:KJ4', trH, rr('3S', 'transfer: 4 spader'))!.call).toBe('4H')
  })
  it('transfer + 3♠ (5♥4♠): 2 hjärter, 3 spader → 3NT', () => {
    expect(choose('S:AK4 H:K4 D:AQ43 C:AK32', trH, rr('3S', 'transfer: 4 spader'))!.call).toBe('3NT')
  })
  it('transfer + 4♥ (5-5): fler spader än hjärter → 4♠', () => {
    expect(choose('S:AQ9 H:K8 D:AQ53 C:AQ54', trS, rr('4H', 'transfer: 5 hjärter'))!.call).toBe('4S')
  })
  it('transfer + 4♥ (5-5): fler hjärter → pass (4♥ står)', () => {
    expect(choose('S:A9 H:K82 D:AQ53 C:AQ54', trS, rr('4H', 'transfer: 5 hjärter'))!.call).toBe('P')
  })
})

describe('Puppet Stayman – hela sekvenser ur EN hand (beslutstabellen)', () => {
  it('2NT–3♣–3♥–4♥: öppnarens 5-korts hjärter mot svararens 3-korts stöd (5-3 hittad)', () => {
    const N = 'S:AK H:AQJ43 D:KQ4 C:K32' // 21
    const S = 'S:K72 H:K84 D:J653 C:J43' // 8, 3 hjärter
    expect(bud(S, seq('2NT'), 'S')).toMatchObject({ bid: '3C', rule: 'Puppet Stayman' })
    expect(bud(N, seq('2NT', '3C'), 'N')).toMatchObject({ bid: '3H', rule: 'Puppet-svar' })
    expect(bud(S, seq('2NT', '3C', '3H'), 'S')).toMatchObject({ bid: '4H' })
    const n4 = bud(N, seq('2NT', '3C', '3H', '4H'), 'N')
    expect(n4 === undefined || n4.bid === 'P').toBe(true)
  })
  it('4-4-fiten spelas av öppnaren: 2NT–3♣–3♦–3♥(4 spader)–4♠', () => {
    const N = 'S:AQ42 H:AK5 D:AQ3 C:Q54' // 21, 4 spader
    const S = 'S:KJ43 H:Q42 D:K43 C:432' // 8
    expect(bud(N, seq('2NT', '3C'), 'N')!.bid).toBe('3D')
    expect(bud(S, seq('2NT', '3C', '3D'), 'S')).toMatchObject({ bid: '3H', rule: 'Puppet: 4 spader' })
    expect(bud(N, seq('2NT', '3C', '3D', '3H'), 'N')).toMatchObject({ bid: '4S' })
    const s4 = bud(S, seq('2NT', '3C', '3D', '3H', '4S'), 'S')
    expect(s4 === undefined || s4.bid === 'P').toBe(true)
  })
  it('öppnaren med bara 4 hjärter mot svararens 3♥ (4 spader) → 3NT', () => {
    expect(bud('S:AK4 H:AQ43 D:KQ4 C:K32', seq('2NT', '3C', '3D', '3H'), 'N')!.bid).toBe('3NT')
  })
  it('4♦ (båda högfärgerna) → öppnaren väljer, svararen passar', () => {
    const S = 'S:KJ43 H:Q543 D:K4 C:432' // 8
    expect(bud(S, seq('2NT', '3C', '3D'), 'S')!.bid).toBe('4D')
    expect(bud('S:AK4 H:AQ43 D:KQ4 C:K32', seq('2NT', '3C', '3D', '4D'), 'N')!.bid).toBe('4H')
    const s4 = bud(S, seq('2NT', '3C', '3D', '4D', '4H'), 'S')
    expect(s4 === undefined || s4.bid === 'P').toBe(true)
  })
  it('5♠4♥: 3♣, efter 3NT (ingen högfärg) → pass', () => {
    const S = 'S:KJ432 H:Q543 D:K4 C:43'
    expect(bud(S, seq('2NT'), 'S')!.bid).toBe('3C')
    const s = bud(S, seq('2NT', '3C', '3NT'), 'S')
    expect(s === undefined || s.bid === 'P').toBe(true)
  })
  it('5♥4♠: 2NT–3♦–3♥–3♠ → öppnaren 4♠ med 4 spader / 4♥ med 3 hjärter', () => {
    const S = 'S:Q543 H:KJ432 D:K4 C:43'
    expect(bud(S, seq('2NT'), 'S')!.bid).toBe('3D')
    expect(bud(S, seq('2NT', '3D', '3H'), 'S')).toMatchObject({ bid: '3S', rule: 'transfer: 4 spader' })
    expect(bud('S:AK92 H:A6 D:AQ53 C:QJ4', seq('2NT', '3D', '3H', '3S'), 'N')!.bid).toBe('4S')
    expect(bud('S:AK9 H:A62 D:AQ53 C:KJ4', seq('2NT', '3D', '3H', '3S'), 'N')!.bid).toBe('4H')
  })
  it('5-5: 2NT–3♥–3♠–4♥ → öppnaren väljer 4♠ med fler spader (luckan från sonden stängd)', () => {
    const S = 'S:KJ432 H:QJ543 D:K4 C:4'
    expect(bud(S, seq('2NT', '3H', '3S'), 'S')).toMatchObject({ bid: '4H', rule: 'transfer: 5 hjärter' })
    expect(bud('S:AQ9 H:K8 D:AQ53 C:AQ54', seq('2NT', '3H', '3S', '4H'), 'N')!.bid).toBe('4S')
    const n = bud('S:A9 H:K82 D:AQ53 C:AQ54', seq('2NT', '3H', '3S', '4H'), 'N')
    expect(n === undefined || n.bid === 'P').toBe(true)
  })
  it('systems on 2♣–2♦–2NT: 3 hp med 3-korts hjärter → 3♣, öppnaren 3♥ (5), svararen 4♥', () => {
    const N = 'S:AQ H:AQJ43 D:KQ4 C:AQ2' // 24
    const S = 'S:K43 H:542 D:6543 C:432' // 3
    expect(bud(S, seq('2C', '2D', '2NT'), 'S')!.bid).toBe('3C')
    expect(bud(N, seq('2C', '2D', '2NT', '3C'), 'N')!.bid).toBe('3H')
    expect(bud(S, seq('2C', '2D', '2NT', '3C', '3H'), 'S')!.bid).toBe('4H')
  })
})

describe('Puppet Stayman – slamporten efter fit (beslut 4 + 6) — sondens fynd 2026-09-15: 4NT över ett Puppet-svar är KVANTITATIVT, slam med stöd går via trumfsättningen', () => {
  it('14 hp + 3 spader mot 2NT–3♣–3♠ (5 spader): 34 ≥ 31 → 4♥ = spader satt, slamintresse (inte 4NT, inte 4♠)', () => {
    const S = 'S:AQ4 H:K43 D:K432 C:K32'
    expect(bud(S, seq('2NT', '3C', '3S'), 'S')).toMatchObject({ bid: '4H', rule: 'Puppet: trumf satt, slamintresse' })
  })
  it('efter trumfsättningen öppnar öppnaren cue-ronden eller stannar i 4♠; kaptenen frågar 4NT över 4♠ med 33+', () => {
    const N = 'S:KJT98 H:AQ D:AQ2 C:AQ4' // 21, inga kontrollbud under 4♠ möjliga → 4♠
    const n = bud(N, seq('2NT', '3C', '3S', '4H'), 'N')
    expect(n && ['4S', '4NT'].includes(n.bid)).toBe(true)
    if (n?.bid === '4S') expect(bud('S:AQ4 H:K43 D:K432 C:K32', seq('2NT', '3C', '3S', '4H', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
  })
  it('13 hp med 3 hjärter mot 3♥ (5 hjärter) → 3♠ = hjärter satt, slamintresse; öppnaren cue:ar 4♣ (klöveress) under utgång', () => {
    expect(bud('S:K43 H:Q42 D:A543 C:K32', seq('2NT', '3C', '3H'), 'S')).toMatchObject({ bid: '3S', rule: 'Puppet: trumf satt, slamintresse' })
    const n = bud('S:AQ H:AKJ43 D:KQ4 C:A32', seq('2NT', '3C', '3H', '3S'), 'N')
    expect(n && ['4C', '4D', '4H', '4NT'].includes(n.bid)).toBe(true)
  })
  it('8 hp med 3 hjärter mot 3♥ → bara 4♥ (under slamzonen)', () => {
    expect(bud('S:K43 H:Q42 D:J543 C:432', seq('2NT', '3C', '3H'), 'S')).toMatchObject({ bid: '4H' })
  })
  it('sondens frö 20265815: 2NT–3♣–3♦–4NT är kvantitativt — öppnaren med 20 passar (förr svarade hen 5♦ som på en essfråga)', () => {
    // N ♠KQ54 ♥Q4 ♦AKQ ♣A953 (20) – S ♠A98 ♥A7 ♦T76 ♣QJ642 (11, 3 spader, ingen 4-korts)
    expect(bud('S:A98 H:A7 D:T76 C:QJ642', seq('2NT', '3C', '3D'), 'S')).toMatchObject({ bid: '4NT', rule: '4NT kvantitativ' })
    const n = bud('S:KQ54 H:Q4 D:AKQ C:A953', seq('2NT', '3C', '3D', '4NT'), 'N')
    expect(n === undefined || n.bid === 'P').toBe(true)
  })
  it('sondens frö 20271194: 2NT–3♣–3♥–4NT utan stöd är kvantitativt — öppnaren med 21 bjuder 6NT (förr 5♦ → 6♥ på 5-2)', () => {
    // W ♠Q5 ♥AKQ82 ♦QJ6 ♣AK7 (21) – E ♠JT6 ♥73 ♦AK432 ♣QJ8 (11)
    expect(bud('S:JT6 H:73 D:AK432 C:QJ8', seq('2NT', '3C', '3H'), 'S')).toMatchObject({ bid: '4NT', rule: '4NT kvantitativ' })
    expect(bud('S:Q5 H:AKQ82 D:QJ6 C:AK7', seq('2NT', '3C', '3H', '4NT'), 'N')!.bid).toBe('6NT')
    expect(bud('S:Q5 H:AKQ82 D:QJ6 C:AK7', seq('2NT', '3C', '3H', '4NT', '6NT'), 'S')?.bid ?? 'P').toBe('P')
  })
  it('4NT efter 3NT-svaret är kvantitativt: 21 → 6NT, 20 → pass', () => {
    expect(bud('S:AKQ H:AJ4 D:KQ43 C:Q32', seq('2NT', '3C', '3NT', '4NT'), 'N')!.bid).toBe('6NT') // 21
    const n = bud('S:AKQ H:AJ4 D:KQ43 C:J32', seq('2NT', '3C', '3NT', '4NT'), 'N') // 20
    expect(n === undefined || n.bid === 'P').toBe(true)
  })
  it('4♣ (båda + slamintresse) → öppnarens 4♠ → svararen 4NT RKC (13 + 20 = 33)', () => {
    const S = 'S:KJ43 H:QJ43 D:K4 C:K32' // 13
    const N = 'S:AQ42 H:AK5 D:AQ3 C:Q54' // 21
    expect(bud(S, seq('2NT', '3C', '3D'), 'S')!.bid).toBe('4C')
    expect(bud(N, seq('2NT', '3C', '3D', '4C'), 'N')!.bid).toBe('4S')
    expect(bud(S, seq('2NT', '3C', '3D', '4C', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
  })
  it('4♣ med 11 hp (31 mot 20) → efter öppnarens 4♠ inbjudan 5♠; öppnaren med maximum går till 6♠', () => {
    const S = 'S:KJ43 H:QJ43 D:K4 C:Q32' // 11
    expect(bud(S, seq('2NT', '3C', '3D'), 'S')!.bid).toBe('4C')
    expect(bud(S, seq('2NT', '3C', '3D', '4C', '4S'), 'S')!.bid).toBe('5S')
    expect(bud('S:AQ42 H:AK5 D:AQ3 C:K54', seq('2NT', '3C', '3D', '4C', '4S', '5S'), 'N')!.bid).toBe('6S') // 21
    expect(bud('S:AQ42 H:AK5 D:AQ3 C:J54', seq('2NT', '3C', '3D', '4C', '4S', '5S'), 'N')!.bid).toBe('P') // 20
  })
  it('systems on 2♣–2♦–2NT: 3-korts stöd + 11 hp mot 3♥ (33 mot 22) → 3♠ = trumf satt', () => {
    expect(bud('S:K43 H:Q42 D:A543 C:K32', seq('2C', '2D', '2NT', '3C', '3H'), 'S')).toMatchObject({ bid: '3S', rule: 'Puppet: trumf satt, slamintresse' })
  })
})

describe('Puppet Stayman – betydelser (budförklaringar läses ur budet)', () => {
  const m = (hist: ResolvedCall[]) => meaningOf(hist, hist.length - 2)
  it('3♣ över 2NT = Puppet Stayman, frågar efter 5-korts', () => {
    const r = m(seq('2NT', '3C'))
    expect(r.rule).toBe('Puppet Stayman')
    expect(r.text).toMatch(/5-korts/)
  })
  it('öppnarens 3♦ = minst en 4-korts, ingen 5-korts', () => {
    const r = m(seq('2NT', '3C', '3D'))
    expect(r.rule).toBe('Puppet-svar')
    expect(r.text).toMatch(/4-korts/)
    expect(r.text).toMatch(/ingen 5-korts/)
  })
  it('öppnarens 3♥ = 5 hjärter', () => {
    expect(m(seq('2NT', '3C', '3H')).text).toMatch(/5 hjärter/)
  })
  it('öppnarens 3NT = varken 4- eller 5-korts högfärg', () => {
    expect(m(seq('2NT', '3C', '3NT')).rule).toBe('Puppet-svar: ingen högfärg')
  })
  it('svararens 3♥ efter 3♦ = 4 spader (inte hjärter!)', () => {
    const r = m(seq('2NT', '3C', '3D', '3H'))
    expect(r.rule).toBe('Puppet: 4 spader')
    expect(r.text).toMatch(/4 spader/)
  })
  it('svararens 4♦ = båda högfärgerna, 4♣ = båda + slamintresse', () => {
    expect(m(seq('2NT', '3C', '3D', '4D')).rule).toBe('Puppet: båda högfärgerna')
    expect(m(seq('2NT', '3C', '3D', '4C')).rule).toBe('Puppet: båda, slamintresse')
  })
  it('öppnarens 4♠ efter 3♥ (4 spader) = placerar 4-4-fiten', () => {
    expect(m(seq('2NT', '3C', '3D', '3H', '4S')).rule).toBe('väljer utgång efter Puppet')
  })
  it('transfer + 3♠ = 4 spader (5♥4♠); transfer + 4♥ = 5 hjärter (5-5)', () => {
    expect(m(seq('2NT', '3D', '3H', '3S')).rule).toBe('transfer: 4 spader')
    expect(m(seq('2NT', '3H', '3S', '4H')).rule).toBe('transfer: 5 hjärter')
  })
  it('svararens 3♠ efter 2NT–3♣–3♥ (5 hjärter) = hjärter satt med slamintresse; öppnarens 4♦ därefter = kontrollbud', () => {
    expect(m(seq('2NT', '3C', '3H', '3S')).rule).toBe('Puppet: trumf satt, slamintresse')
    expect(m(seq('2NT', '3C', '3H', '3S', '4D')).rule).toBe('cue-bid')
    expect(m(seq('2NT', '3C', '3S', '4H')).rule).toBe('Puppet: trumf satt, slamintresse')
  })
  it('4NT direkt över ett Puppet-svar är kvantitativt (3♦, 3♥, 3NT) — inte essfråga', () => {
    expect(m(seq('2NT', '3C', '3D', '4NT')).rule).toBe('4NT kvantitativ')
    expect(m(seq('2NT', '3C', '3H', '4NT')).rule).toBe('4NT kvantitativ')
    expect(m(seq('2NT', '3C', '3NT', '4NT')).rule).toBe('4NT kvantitativ')
  })
  it('4NT över öppnarens 4♠ (4-4-fiten efter 3♦–3♥) är essfråga i spader', () => {
    expect(m(seq('2NT', '3C', '3D', '3H', '4S', '4NT')).rule).toBe('1430 RKC')
  })
  it('samma struktur efter 2♣–2♦–2NT', () => {
    expect(m(seq('2C', '2D', '2NT', '3C')).rule).toBe('Puppet Stayman')
    expect(m(seq('2C', '2D', '2NT', '3C', '3D', '3S')).rule).toBe('Puppet: 4 hjärter')
  })
})

describe('Puppet Stayman – slamvägarna kompletta (ägardirektiv 2026-09-15 kväll: "gör klart slamvägar")', () => {
  // ---- 2♣–2♦–2NT (22–24): samma vägar som över 2NT-öppningen, mot 22 ----
  it('2♣-vägen: 4♣ (båda + slam) → öppnarens 4♠ → 4NT RKC (11 + 22 = 33)', () => {
    const S = 'S:KJ43 H:QJ43 D:K4 C:Q32' // 11
    const N = 'S:AQ42 H:AK5 D:AQ3 C:KQ4' // 24
    expect(bud(S, seq('2C', '2D', '2NT', '3C', '3D'), 'S')!.bid).toBe('4C')
    expect(bud(N, seq('2C', '2D', '2NT', '3C', '3D', '4C'), 'N')!.bid).toBe('4S')
    expect(bud(S, seq('2C', '2D', '2NT', '3C', '3D', '4C', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
  })
  it('2♣-vägen: 3♥ (4 spader) → öppnarens 4♠ → 4NT med 33, pass med 30', () => {
    expect(bud('S:KJ43 H:Q42 D:K43 C:Q32', seq('2C', '2D', '2NT', '3C', '3D', '3H', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
    const s = bud('S:KJ43 H:J42 D:K43 C:432', seq('2C', '2D', '2NT', '3C', '3D', '3H', '4S'), 'S') // 8 → 30
    expect(s === undefined || s.bid === 'P').toBe(true)
  })
  it('2♣-vägen: trumfsättning 3♠ efter 3♥ → öppnaren cue:ar eller stannar, kaptenen fortsätter', () => {
    const n = bud('S:AQ H:AQJ43 D:KQ4 C:AQ2', seq('2C', '2D', '2NT', '3C', '3H', '3S'), 'N')
    expect(n && ['4C', '4D', '4H'].includes(n.bid)).toBe(true)
  })
  // ---- Efter öppnarens 3NT på min högfärgsvisning: sangtrappan ----
  it('2NT–3♣–3♦–3♥–3NT (ingen fit): 11 hp → 4NT kvantitativ; öppnaren 21 → 6NT, 20 → pass; 13 hp → 6NT; 8 → pass', () => {
    expect(bud('S:KJ43 H:KQ4 D:K43 C:432', seq('2NT', '3C', '3D', '3H', '3NT'), 'S')).toMatchObject({ bid: '4NT', rule: '4NT kvantitativ' })
    expect(bud('S:AK4 H:AJ43 D:AQ4 C:K32', seq('2NT', '3C', '3D', '3H', '3NT', '4NT'), 'N')!.bid).toBe('6NT') // 21
    const n = bud('S:AK4 H:AJ43 D:AQ4 C:Q32', seq('2NT', '3C', '3D', '3H', '3NT', '4NT'), 'N') // 20
    expect(n === undefined || n.bid === 'P').toBe(true)
    expect(bud('S:KJ43 H:KQ4 D:KQ43 C:432', seq('2NT', '3C', '3D', '3H', '3NT'), 'S')!.bid).toBe('6NT')
    const s = bud('S:KJ43 H:Q42 D:K43 C:432', seq('2NT', '3C', '3D', '3H', '3NT'), 'S')
    expect(s === undefined || s.bid === 'P').toBe(true)
  })
  it('2♣-vägen efter öppnarens 3NT: 9 hp (31 mot 22) → 4NT kvantitativ; öppnaren 23 → 6NT, 22 → pass', () => {
    expect(bud('S:KJ43 H:KQ4 D:643 C:432', seq('2C', '2D', '2NT', '3C', '3D', '3H', '3NT'), 'S')).toMatchObject({ bid: '4NT', rule: '4NT kvantitativ' })
    expect(bud('S:AK4 H:AJ43 D:AQ4 C:AJ2', seq('2C', '2D', '2NT', '3C', '3D', '3H', '3NT', '4NT'), 'N')!.bid).toBe('6NT') // 23
    const n = bud('S:AK4 H:AJ43 D:AQ4 C:A32', seq('2C', '2D', '2NT', '3C', '3D', '3H', '3NT', '4NT'), 'N') // 22
    expect(n === undefined || n.bid === 'P').toBe(true)
  })
  // ---- Transfervägarna ----
  it('6+ högfärg med slamvärden → Texas, sedan 4NT RKC över fullföljningen; öppnaren svarar', () => {
    const S = 'S:AQ8432 H:K3 D:A3 C:K32' // 16
    expect(bud(S, seq('2NT'), 'S')).toMatchObject({ bid: '4H', rule: 'Texas (2NT)' })
    expect(bud('S:KJ5 H:AQ4 D:KQ42 C:AQ4', seq('2NT', '4H'), 'N')!.bid).toBe('4S')
    expect(bud(S, seq('2NT', '4H', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
    const n = bud('S:KJ5 H:AQ4 D:KQ42 C:AQ4', seq('2NT', '4H', '4S', '4NT'), 'N')
    expect(n && ['5C', '5D', '5H', '5S'].includes(n.bid)).toBe(true)
  })
  it('6+ högfärg med 11–12 → Texas och pass över fullföljningen (fast arrival)', () => {
    const S = 'S:KQ8432 H:K3 D:43 C:K32' // 11
    expect(bud(S, seq('2NT'), 'S')!.bid).toBe('4H')
    const s = bud(S, seq('2NT', '4H', '4S'), 'S')
    expect(s === undefined || s.bid === 'P').toBe(true)
  })
  it('exakt 5-korts, 11–12 → transfer och 4NT kvantitativ; öppnaren med max + 3-korts stöd → 6♥, max utan stöd → 6NT, min → pass', () => {
    const S = 'S:K3 H:KJ432 D:Q43 C:K32' // 11
    expect(bud(S, seq('2NT', '3D', '3H'), 'S')).toMatchObject({ bid: '4NT', rule: '4NT kvantitativ' })
    expect(bud('S:AQ4 H:Q43 D:AK43 C:AQ2', seq('2NT', '3D', '3H', '4NT'), 'N')!.bid).toBe('6H') // 21, 3 hjärter
    expect(bud('S:AQ43 H:Q4 D:AK43 C:AQ2', seq('2NT', '3D', '3H', '4NT'), 'N')!.bid).toBe('6NT') // 21, 2 hjärter
    const n = bud('S:AQ43 H:Q4 D:AK43 C:AJ2', seq('2NT', '3D', '3H', '4NT'), 'N') // 20
    expect(n === undefined || n.bid === 'P').toBe(true)
  })
  it('exakt 5-korts, 13+ → transfer och 6NT', () => {
    expect(bud('S:K3 H:KJ432 D:K43 C:K32', seq('2NT', '3D', '3H'), 'S')!.bid).toBe('6NT')
  })
  it('5♥4♠ med 13: transfer, 3♠, öppnarens 4♠ → 4NT RKC; med 8 → pass', () => {
    expect(bud('S:Q543 H:KJ432 D:A4 C:K3', seq('2NT', '3D', '3H', '3S', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
    const s = bud('S:Q543 H:KJ432 D:K4 C:43', seq('2NT', '3D', '3H', '3S', '4S'), 'S')
    expect(s === undefined || s.bid === 'P').toBe(true)
  })
  it('5-5 med 13: transfer, 4♥, öppnarens 4♠ → 4NT RKC', () => {
    expect(bud('S:KJ432 H:AJ543 D:A4 C:4', seq('2NT', '3H', '3S', '4H', '4S'), 'S')).toMatchObject({ bid: '4NT', rule: '1430 RKC' })
  })
  // ---- 2NT-inklivet: inga färgslamvägar (bara kvantitativt) ----
  it('över 2NT-inklivet: 17 hp med 3 hjärter mot 3♥ → 4♥ (ingen trumfsättning där), båda högfärgerna → 4♦ (aldrig 4♣)', () => {
    const h = [call('W', '2S'), call('N', '2NT'), P('E'), call('S', '3C'), P('W')]
    expect(bud('S:K98 H:Q84 D:AK6 C:AJ94', [...h, call('N', '3H'), P('E')], 'S')!.bid).toBe('4H')
    expect(bud('S:KJ98 H:QJ84 D:AK6 C:A9', [...h, call('N', '3D'), P('E')], 'S')!.bid).toBe('4D')
  })
})

describe('Puppet Stayman – betydelser för slamvägarna', () => {
  const m = (hist: ResolvedCall[]) => meaningOf(hist, hist.length - 2)
  it('4NT över transferns fullföljning = kvantitativt (exakt 5-korts); 4NT över Texas-fullföljningen = essfråga i högfärgen', () => {
    expect(m(seq('2NT', '3D', '3H', '4NT')).rule).toBe('4NT kvantitativ')
    expect(m(seq('2NT', '4H', '4S', '4NT')).rule).toBe('1430 RKC')
    expect(m(seq('2NT', '4H', '4S', '4NT')).text).toMatch(/spader/)
  })
  it('öppnarens 6♥ på den kvantitativa 4NT efter transfer = accepterar med stöd', () => {
    expect(m(seq('2NT', '3D', '3H', '4NT', '6H')).rule).toBe('accepterar slaminbjudan')
  })
  it('4NT efter öppnarens 3NT på min högfärgsvisning = kvantitativt', () => {
    expect(m(seq('2NT', '3C', '3D', '3H', '3NT', '4NT')).rule).toBe('4NT kvantitativ')
    expect(m(seq('2C', '2D', '2NT', '3C', '3D', '3H', '3NT', '4NT')).rule).toBe('4NT kvantitativ')
  })
  it('4NT över öppnarens 4♠ i 2♣-vägen = essfråga i spader', () => {
    expect(m(seq('2C', '2D', '2NT', '3C', '3D', '4C', '4S', '4NT')).rule).toBe('1430 RKC')
  })
})

describe('Puppet Stayman – regelregistret', () => {
  it('3♣ är krav och alertpliktigt; svaren likaså (3NT-svaret ej krav)', () => {
    expect(forcingOf('Puppet Stayman')).toBe('krav-1-rond')
    expect(isAlertRule('Puppet Stayman')).toBe(true)
    expect(forcingOf('Puppet-svar')).toBe('krav-1-rond')
    expect(isAlertRule('Puppet-svar')).toBe(true)
    expect(forcingOf('Puppet-svar: ingen högfärg')).toBe('ej-krav')
    expect(forcingOf('Puppet: 4 spader')).toBe('krav-1-rond')
    expect(forcingOf('Puppet: båda högfärgerna')).toBe('krav-1-rond')
    expect(forcingOf('Puppet: båda, slamintresse')).toBe('slamintresse')
    expect(forcingOf('transfer: 4 spader')).toBe('krav-1-rond')
    expect(forcingOf('transfer: 5 hjärter')).toBe('ej-krav')
  })
})

describe('Puppet Stayman – systems on över vårt 2NT-inkliv (beslut 7, 15–18 mittemot)', () => {
  // 2♠(Väst, svag två) – 2NT(Nord, 15–18) – P(Öst) – Syd.
  const h = [call('W', '2S'), call('N', '2NT'), P('E')]
  it('advancern med 9 hp och 3-korts hjärter bjuder 3♣ (Puppet)', () => {
    expect(bud('S:K983 H:Q84 D:76 C:KJ94', h, 'S')).toMatchObject({ bid: '3C', rule: 'Puppet Stayman' })
  })
  it('advancern med 6 hp passar (för svagt mot 15–18)', () => {
    const s = bud('S:J983 H:Q84 D:76 C:J984', h, 'S')
    expect(s === undefined || s.bid === 'P').toBe(true)
  })
  it('inklivaren svarar 3♥ med 5 hjärter, advancern höjer till 4♥', () => {
    const h3c = [...h, call('S', '3C'), P('W')]
    expect(bud('S:AQ5 H:AKJ32 D:964 C:Q2', h3c, 'N')).toMatchObject({ bid: '3H', rule: 'Puppet-svar' })
    expect(bud('S:K983 H:Q84 D:76 C:KJ94', [...h3c, call('N', '3H'), P('E')], 'S')!.bid).toBe('4H')
  })
  it('inklivaren med 4 spader svarar 3♦; advancern 3♥ (4 spader); inklivaren 4♠', () => {
    const h3c = [...h, call('S', '3C'), P('W')]
    expect(bud('S:AQ54 H:AK3 D:964 C:Q32', h3c, 'N')!.bid).toBe('3D')
    const h3d = [...h3c, call('N', '3D'), P('E')]
    expect(bud('S:K983 H:Q84 D:76 C:KJ94', h3d, 'S')!.bid).toBe('3H')
    expect(bud('S:AQ54 H:AK3 D:964 C:Q32', [...h3d, call('S', '3H'), P('W')], 'N')!.bid).toBe('4S')
  })
  it('betydelsen läses: 3♣ över 2NT-inklivet = Puppet Stayman', () => {
    expect(meaningOf([...h, call('S', '3C')], 3).rule).toBe('Puppet Stayman')
  })
})

// Felrapport #62 (bricka 1, 2026-09-09): ägaren "3 ruter skall betyda minst en
// 4 korts högfärg". Auktionen var 2♣–2♦–2NT(22–24)–3♣–3♦ med den öppnande handen
// ♠AK3 ♥AKJ ♦AJ64 ♣K63 (3-3-4-3, INGEN 4-korts högfärg). Rapporten skrevs FÖRE
// Puppet Stayman byggdes (§4.3b, 2026-09-15): då kördes vanlig Stayman där
// 3♦ = ingen högfärg, så öppnaren bjöd 3♦. Med Puppet (systems on över 2♣–2♦–2NT)
// visar 3♦ minst en 4-korts högfärg — så öppnaren utan högfärg bjuder nu 3NT, och
// den betydelse ägaren efterfrågade är den som gäller. Detta låser resolutionen.
describe('felrapport #62 – Puppet över 2♣–2♦–2NT: 3♦ lovar en 4-korts högfärg', () => {
  const h = [
    call('N', 'P'), call('E', 'P'), call('S', 'P'), call('W', '2C'),
    call('N', 'P'), call('E', '2D'), call('S', 'P'), call('W', '2NT'),
    call('N', 'P'), call('E', '3C'), call('S', 'P'),
  ]
  it('öppnaren utan 4-korts högfärg (♠AK3 ♥AKJ ♦AJ64 ♣K63) bjuder 3NT, inte 3♦', () => {
    expect(bud('S:AK3 H:AKJ D:AJ64 C:K63', h, 'W')).toMatchObject({ bid: '3NT', rule: 'Puppet-svar: ingen högfärg' })
  })
  it('3♦-svaret lovar minst en 4-korts högfärg (betydelsen ägaren efterfrågade)', () => {
    const with3D = [...h, call('W', '3D')]
    expect(meaningOf(with3D, with3D.length - 1).text).toMatch(/minst en 4-korts högfärg/)
  })
})

// Felrapport #67 (bricka 1, 2026-09-09): samma som #62 men över en 2NT-ÖPPNING.
// Öst öppnar 2NT med ♠AK5 ♥642 ♦AKQ6 ♣A64 (3-3 i högfärgerna = ingen 4-korts),
// Väst 3♣ Puppet. Rapporten skrevs före Puppet-bygget; nu bjuder öppnaren utan
// högfärg 3NT och 3♦ lovar en 4-korts högfärg.
describe('felrapport #67 – Puppet över 2NT-öppning: 3♦ lovar en 4-korts högfärg', () => {
  const h = [call('N', 'P'), call('E', '2NT'), call('S', 'P'), call('W', '3C'), call('S', 'P')]
  it('öppnaren utan 4-korts högfärg (♠AK5 ♥642 ♦AKQ6 ♣A64) bjuder 3NT, inte 3♦', () => {
    expect(bud('S:AK5 H:642 D:AKQ6 C:A64', h, 'E')).toMatchObject({ bid: '3NT', rule: 'Puppet-svar: ingen högfärg' })
  })
  it('3♦-svaret lovar minst en 4-korts högfärg', () => {
    const with3D = [...h, call('E', '3D')]
    expect(meaningOf(with3D, with3D.length - 1).text).toMatch(/minst en 4-korts högfärg/)
  })
})
