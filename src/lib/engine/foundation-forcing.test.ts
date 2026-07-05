import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall } from './auction-live'

// =============================================================================
// FACIT-GIVAR: "Budsystemets grunder — varför de faller"  (2026-07-05)
// -----------------------------------------------------------------------------
// Dessa fyra givar blottar EN gemensam rot: off-book-lagret (auction-live.ts)
// har inget minne av auktionens tillstånd. Det vet inte "vi är i krav" eller
// "vi är redan lovade en nivå" — det bestämmer varje bud från den egna handens
// poäng och passar som säkert standardval.
//
// ✅ BYGGT 2026-07-05 (facit före fix – alla fyra var röda innan). Fungerar via
//    auctionForce/honorForce (krav A–C) + raiseWithFit minorutgång (nivå D) i
//    auction-live.ts. Detta är nu ett REGRESSIONSLÅS – rörs de röda igen har en
//    grundregel fallit.
//
// A–C = "krav får aldrig passas" (tre NYA otäckta krav, ej samma som #26/#27).
// D   = "rätt nivå med fit" (minorfit + utgångsvärden stannar under game).
//
// ⚠️ KÄND LUCKA (måste-fix, ej steg 1): auctionForce täcker BARA ostörda
//    auktioner. Bevisat 2026-07-05 att krav faller i KONKURRENS:
//      - 1♦–(1♠)–2♣–(P): öppnaren PASSAR partnerns fria kravbud.
//      - 1♣–1♥–(1♠)–2♦: svararen PASSAR reversen.
//    (1♠–(2♦)–2♥–(P)–2♠ överlevde bara p.g.a. en tillfällig fit, inte kravlogik.)
//    Störd semantik skiljer sig (2/1 ej självklart 100% GF i konkurrens; fria bud
//    krav på annat sätt) → eget steg. Se CLAUDE.md 🟢 NÄST.
// =============================================================================

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

/** Är budet minst utgång (3NT, 5-läges minor, eller slam)? */
function isGameOrHigher(bid: string): boolean {
  if (bid === '3NT') return true
  const m = /^([1-7])(NT|C|D|H|S)$/.exec(bid)
  if (!m) return false
  const level = Number(m[1])
  const strain = m[2]
  if (strain === 'NT') return level >= 3
  if (strain === 'H' || strain === 'S') return level >= 4
  return level >= 5 // minor
}

describe('FACIT (regressionslås): budsystemets grunder — krav & nivå', () => {
  // A) 2/1 = utgångskrav. N öppnar 1♠, S svarar 2♦ (2/1 GF), N rebjuder 2♠.
  //    Syd (15 hp) MÅSTE bära till utgång. Motorn passar idag. (Systerlucka till
  //    #27, som bara täckte fallet där öppnaren HÖJDE svararens färg.)
  it('A: 2/1-svararen får aldrig passa när öppnaren rebjöd egen färg', () => {
    const deal = dealOf('N', {
      N: 'S:AK984 H:K5 D:73 C:Q642',
      S: 'S:5 H:AQ76 D:AKQ82 C:J83',
      E: 'S:QJ76 H:JT93 D:64 C:AK5',
      W: 'S:T932 H:842 D:JT95 C:T7',
    })
    const history = [call('N', '1S'), call('E', 'P'), call('S', '2D'), call('W', 'P'), call('N', '2S'), call('E', 'P')]
    const c = decideCall(deal, history, 'S')
    expect(c.bid).not.toBe('P') // utgångskrav — pass förbjudet
    expect(isGameOrHigher(c.bid) || /^3/.test(c.bid)).toBe(true) // minst en kravfortsättning mot utgång
  })

  // B) Ny färg = rondkrav. N öppnar 1♦, S svarar 1♠ (ny färg, krav). Öppnaren
  //    MÅSTE rebjuda — 2♦ (6-korts färg, minimum). Motorn passar idag (linjen
  //    hade Öst inkliva 1NT; Öst passade → off-book → tråden tappas).
  it('B: öppnaren får aldrig passa partnerns nya färg (rondkrav)', () => {
    const deal = dealOf('N', {
      N: 'S:73 H:A5 D:KQJ842 C:Q62',
      S: 'S:AKJ96 H:K73 D:5 C:9842',
      E: 'S:Q84 H:QJ92 D:A93 C:AK5',
      W: 'S:T52 H:T864 D:T76 C:JT3',
    })
    const history = [call('N', '1D'), call('E', 'P'), call('S', '1S'), call('W', 'P')]
    const c = decideCall(deal, history, 'N')
    expect(c.bid).not.toBe('P') // rondkrav — pass förbjudet
    expect(c.bid).toBe('2D') // naturligt minimirebud i 6-korts färgen
  })

  // C) Reverse = krav (en rond). N öppnar 1♣, S 1♥, N 2♦ (reverse, visar extra).
  //    Svararen MÅSTE svara. Motorn passar idag.
  it('C: svararen får aldrig passa öppnarens reverse (krav)', () => {
    const deal = dealOf('N', {
      N: 'S:A5 H:73 D:KQ84 C:AKJ92',
      S: 'S:K873 H:QJ642 D:5 C:Q83',
      E: 'S:QJT9 H:AK9 D:JT93 C:T5',
      W: 'S:642 H:T85 D:A762 C:764',
    })
    const history = [call('N', '1C'), call('E', 'P'), call('S', '1H'), call('W', 'P'), call('N', '2D'), call('E', 'P')]
    const c = decideCall(deal, history, 'S')
    expect(c.bid).not.toBe('P') // krav — pass förbjudet
  })

  // D) Rätt nivå med fit. Syd öppnar off-book 1♦, Nord har 15 hp + 5-korts
  //    ruterfit → utgång (3NT/5♦) är rätt. Motorn kapar till 3♦ (inbjudan) för
  //    att den ALDRIG blåser ut en minorutgång off-book. (Jfr auction-live.test.ts
  //    rad ~344 som låser 3♦ som "rätt" — det taket är just det som faller här.)
  it('D: minorfit + utgångsvärden ska nå utgång, inte stanna på 3♦', () => {
    const deal = dealOf('S', {
      S: 'S:KQ4 H:AQ5 D:K843 C:QJ2', // 17 balanced → linjen öppnar 1NT; vi matar 1♦
      N: 'S:A2 H:KQ5 D:KJ982 C:Q83', // 15 hp, 5-korts ruterfit
      W: 'S:865 H:J983 D:T6 C:T954',
      E: 'S:JT973 H:T762 D:A7 C:A7',
    })
    const c = decideCall(deal, [call('S', '1D'), call('W', 'P')], 'N')
    expect(isGameOrHigher(c.bid)).toBe(true) // minst utgång — inte 3♦-inbjudan
  })
})
