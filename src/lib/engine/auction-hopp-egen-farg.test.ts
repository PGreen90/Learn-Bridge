// FACIT FÖRE FIX — kontrollbud före essfrågan, steg 4: efter öppnarens hopp i
// egen lågfärg (1m–1M–3m, visade 16–18 med 6+). Ägarbeslut 2026-10-07:
//
//  • "Kontrollbud före essfrågan" gäller i ALLA sammanhang — båda är skyldiga
//    varandra att visa kontroller. Det betyder inte att vi ska till slam, men vi
//    skall visa vår hand.
//  • Att hoppa från 4 till 6 utan att fråga ess är förbjudet.
//  • 4m efter 1m–1M–3m = TRÄFF i trumf och föredrar färgen före sang (öppnaren har
//    visat 16+ och sex kort). Efter 4m: kontrollbud, 4NT, eller 5m utan
//    kontroller och inget mer att visa.
//
// Förr: 15–16 stödpoäng → 4m som INBJUDAN, och öppnaren accepterade med hopp
// rakt till 6m utan ess- eller kontrollkoll; 17+ → 4NT direkt utan kontrollbud.
// Hp räknade med kod (hcp/parseHand), summa 40 per giv.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { botAuction } from './revisor'

const giv = (dealer: Seat, n: string, e: string, s: string, w: string): Deal => ({
  id: 'facit', board: 1, dealer, vulnerability: 'all',
  hands: { N: parseHand(n), E: parseHand(e), S: parseHand(s), W: parseHand(w) },
})
const bud = (d: Deal): string[] => botAuction(d)!.filter((c) => c.bid !== 'P').map((c) => `${c.seat}:${c.bid}`)

describe('kontrollbud före essfrågan, steg 4: 4m efter hopp i egen lågfärg sätter trumfen', () => {
  // Frö 20407890 (giv N, alla i zon): Nord ♠KT ♥AK98 ♦Q97643 ♣K (15 hp), Syd
  // ♠AQ63 ♥T4 ♦AK85 ♣J43 (14 hp, 15 stödpoäng). Förr: 1♦–1♠–3♦–4♦–6♦.
  const d90 = giv('N', 'S:KT H:AK98 D:Q97643 C:K', 'S:7 H:Q753 D:J2 C:QT9852', 'S:AQ63 H:T4 D:AK85 C:J43', 'S:J98542 H:J62 D:T C:A76')
  it('15–16 stödpoäng: 4♦ sätter trumfen och öppnaren visar sin billigaste kontroll (4♥), hoppar aldrig till 6♦', () => {
    const b = bud(d90)
    expect(b.slice(0, 5)).toEqual(['N:1D', 'S:1S', 'N:3D', 'S:4D', 'N:4H'])
    const slut = contractFromCalls(botAuction(d90)!)
    if (slut && slut.level >= 6) expect(b).toContain('S:4NT')
  })

  // Frö 20408430 (giv S, alla i zon): Väst ♠8 ♥AQ7 ♦KQ7543 ♣AJT (16 hp), Öst
  // ♠AKJ763 ♥T6 ♦AT9 ♣Q7 (14 hp, 17 stödpoäng). Förr: 1♦–1♠–3♦–4NT direkt.
  const d30 = giv('S', 'S:Q952 H:983 D:2 C:K9652', 'S:AKJ763 H:T6 D:AT9 C:Q7', 'S:T4 H:KJ542 D:J86 C:843', 'S:8 H:AQ7 D:KQ7543 C:AJT')
  it('17+ stödpoäng: 4♦ först, öppnarens kontrollbud, sedan essfrågan → 6♦ på fem nyckelkort', () => {
    expect(bud(d30)).toEqual(['W:1D', 'E:1S', 'W:3D', 'E:4D', 'W:4H', 'E:4NT', 'W:5D', 'E:6D'])
  })

  // Frö 20415620 (giv E, alla i zon): Syd ♠AK2 ♥T ♦85 ♣AQ97432 (13 hp), Nord
  // ♠7 ♥QJ84 ♦AJT62 ♣KJ8 (12 hp, 16 stödpoäng). Förr: 1♣–1♥–3♣–4♣–6♣.
  const d20 = giv('E', 'S:7 H:QJ84 D:AJT62 C:KJ8', 'S:T9843 H:AK92 D:Q9 C:T6', 'S:AK2 H:T D:85 C:AQ97432', 'S:QJ65 H:7653 D:K743 C:5')
  it('klöver: 4♣ sätter trumfen, öppnaren visar singelhjärtern (4♥) — ingen 6♣ utan essfråga', () => {
    const b = bud(d20)
    expect(b.slice(0, 5)).toEqual(['S:1C', 'N:1H', 'S:3C', 'N:4C', 'S:4H'])
    const slut = contractFromCalls(botAuction(d20)!)
    if (slut && slut.level >= 6) expect(b).toContain('N:4NT')
  })
})

// Tre lås ur auktionsdiffen (50 000 givar, 34 ändrade) när steg 4 byggdes:
describe('steg 4 — sidofynd ur auktionsdiffen', () => {
  // Frö 20304787: 1♦–1NT–3♦–4♦ är den SVAGA sangsvararens höjning (6–10) — inte
  // trumfsättning. Betydelselagret läste 4♦ som "sätter trumfen (krav)" och
  // kravvakten tvingade öppnaren till 5♦ (bet). Nord ♠KQ4 ♥K76 ♦954 ♣J963 (9 hp).
  it('1m–1NT–3m–4m är ingen trumfsättning: öppnaren passar 4♦', () => {
    const d = giv('N', 'S:KQ4 H:K76 D:954 C:J963', 'S:JT632 H:A32 D:KJ72 C:Q', 'S:A5 H:Q D:AQT863 C:A742', 'S:987 H:JT9854 D:- C:KT85')
    expect(bud(d)).toEqual(['S:1D', 'N:1NT', 'S:3D', 'N:4D'])
  })

  // Frö 20342042: Västs kontrollbud 4♥ räknades av facts-lagret som ett bjudet
  // hjärterbud → "båda har bjudit hjärter" → efter kaptenens 5♦-stopp svarade
  // Väst 5♥ på en inbillad damfråga i hjärter. Ett kontrollbud är ingen bjuden
  // färg. Väst ♠Q ♥4 ♦QT9875 ♣AKQT4 (13 hp), Öst ♠AK4 ♥KQJ9532 ♦K64 ♣– (16 hp).
  it('ett kontrollbud är ingen bjuden färg: efter 5♦-stoppet bjuds inget 5♥', () => {
    const d = giv('S', 'S:32 H:T876 D:A3 C:J9653', 'S:AK4 H:KQJ9532 D:K64 C:-', 'S:JT98765 H:A D:J2 C:872', 'S:Q H:4 D:QT9875 C:AKQT4')
    expect(bud(d)).toEqual(['W:1D', 'E:1H', 'W:3D', 'E:4D', 'W:4H', 'E:4NT', 'W:5C', 'E:5D'])
  })

  // Frö 20317097: kaptenen på 31–32 med högst en okontrollerad sidofärg frågar
  // 4NT i stället för kontrollbudet 4♠, som lämnade partnern bara 5♣ och
  // stängde ute frågan (förr 4♥–4♠–5♣–5♦ med 12 stick). Ägarens regel
  // 2026-10-04: kontrollbuden får aldrig stänga ute essfrågan.
  // Nord ♠98 ♥AJ2 ♦AKJT865 ♣9 (13 hp), Syd ♠AKQ32 ♥Q96 ♦Q74 ♣Q4 (15 hp, 15 stödp).
  it('kaptenen frågar 4NT hellre än ett 4♠ som stänger ute frågan — även på 31–32', () => {
    const d = giv('N', 'S:98 H:AJ2 D:AKJT865 C:9', 'S:65 H:K84 D:93 C:J87632', 'S:AKQ32 H:Q96 D:Q74 C:Q4', 'S:JT74 H:T753 D:2 C:AKT5')
    expect(bud(d)).toEqual(['N:1D', 'S:1S', 'N:3D', 'S:4D', 'N:4H', 'S:4NT', 'N:5D', 'S:6D'])
  })
})
