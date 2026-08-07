// F4 (D9): TP till §7-inkliven. FACIT FÖRE FIX.
//
// §7-lagret räknade rå HP — TP (form/fördelning) nådde aldrig dit. F4 låter
// inklivsgolven läsa `max(hp, startpoäng)` (nedgradera aldrig, TP-steg E-måttet)
// och advancerns fit-trösklar läsa stödpoäng — ADDITIVT ovanpå "låna en kung"
// (sits-spaken −3 i balansering), inte som ersättare.
//
//   - enkelt inkliv: golv 8 (bal. 5) läser startpoäng → en formstark 7:a kliver in
//   - upplysnings-X: golv 12/10 (bal. 9/7) läser startpoäng
//   - VAKT: spärrmaterial (6+ färg, rå 6–10 hp) TP-lyfts INTE — hoppinklivet
//     ska förbli spärr, inte ätas upp av ett "konstruktivt" inkliv
//   - RÅ HP BEHÅLLS: 1NT-fönstren (sang), taket 16 och 17+-styrningen, hoppinkliv
//   - advancern: cue (11+) och fit-jump (10+) läser stödpoäng (som raiseWithFit live)
import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { advanceOvercall, overcall } from './overcalls'
import { decideCall } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}

describe('F4 — enkelt inkliv läser startpoäng (max(hp, TP))', () => {
  // 7 hp men 9 startp. (längd +1, kvalitetsfärg KQJT9 +1) → kliver in direkt.
  const shapely7 = parseHand('S:KQJT9 H:J653 D:753 C:8')
  it('formstark 7:a (9 startp.): 1♠ över 1♥ i DIREKT sits (förr pass)', () => {
    expect(overcall(shapely7, '1H', false).call).toBe('1S')
  })

  // 4 hp men 6 startp. (längd +1, kvalitet KJT98 +1): balanseringsgolvet 5
  // nås på TP — additivt ovanpå den lånade kungen. Direkt sits (golv 8): pass.
  const shapely4 = parseHand('S:KJT98 H:9653 D:753 C:8')
  it('balansering additiv: 4 hp / 6 startp. → 1♠ i balansering, pass direkt', () => {
    expect(overcall(shapely4, '1H', true).call).toBe('1S')
    expect(overcall(shapely4, '1H', false).call).toBe('P')
  })

  // KVALITETSVAKTEN: 6 hp / 8 startp. (två längdpoäng på 5-5) men QJ975 är
  // INGEN kvalitetsfärg (bara 2 av topp-5) — "färgkvalitet går före poäng",
  // lyftet gäller inte skräpfärger. Riktiga Öst-handen ur frö 20261020, där
  // inklivet störde sönder 6NT-auktionen i auction-3nt-stopp.test.ts.
  const junk55 = parseHand('S:QJ975 H:5 D:K9764 C:76')
  it('kvalitetsvakt: 6 hp / 8 startp. utan kvalitetsfärg → pass (inte 1♠)', () => {
    expect(overcall(junk55, '1C', false).call).toBe('P')
  })

  // VAKTEN: 6 hp med 6-korts KQJT98 vore 9 startp. — men spärrmaterial
  // (6+ färg, rå 6–10) ska FORTFARANDE hoppinkliva, inte lyftas till 1♠.
  const preempt = parseHand('S:KQJT98 H:653 D:753 C:8')
  it('vakt: 6 hp 6-korts färg förblir svagt hoppinkliv 2♠ (inte TP-lyft 1♠)', () => {
    const r = overcall(preempt, '1H', false)
    expect(r.call).toBe('2S')
    expect(r.rule).toBe('hoppinkliv')
  })
})

describe('F4 — upplysnings-X läser startpoäng', () => {
  // 9 hp men 10 startp. (kvalitetsfärg KQT9 +1), 4441 kort i deras hjärter,
  // stöd i alla objudna → X i direkt sits (förr pass: 9 < 10).
  const takeout9 = parseHand('S:KQT9 H:8 D:AT96 C:8653')
  it('9 hp / 10 startp. med perfekt form → X i direkt sits (förr pass)', () => {
    expect(overcall(takeout9, '1H', false).call).toBe('X')
  })
})

describe('F4 — rå HP behålls där TP inte hör hemma', () => {
  // 15 hp / 18 startp.: 17+-styrningen (X först) läser RÅ hp — handen ska
  // fortfarande bjuda ett enkelt inkliv, inte TP-lyftas in i den starka X:en.
  const strong15 = parseHand('S:AKQJ9 H:432 D:KQT9 C:5')
  it('15 hp / 18 startp. → fortfarande enkelt inkliv 1♠ (17+-styrningen läser rå hp)', () => {
    const r = overcall(strong15, '1H', false)
    expect(r.call).toBe('1S')
    expect(r.rule).toBe('enkelt inkliv')
  })
})

describe('F4 — advancerns fit-trösklar läser stödpoäng', () => {
  // Partnerns 1♠-inkliv över 1♦. 9 hp men 12 stödp. (4-stöd + singel ruter +3)
  // → cue 2♦ (limithöjning+), förr bara konkurrenshöjning 2♠.
  const cueHand = parseHand('S:KT84 H:A853 D:7 C:QT53')
  it('9 hp / 12 stödp. med 4-stöd + singel → cue 2♦ (förr 2♠)', () => {
    const r = advanceOvercall(cueHand, 'spades', 'diamonds')
    expect(r.call).toBe('2D')
    expect(r.rule).toContain('cue')
  })

  // Platt hand utan formlyft (8 hp, 4333, 3-stöd): stödpoängen lyfter inget
  // (7 sp golvas till 8 hp) → höjningen är oförändrad.
  const flat8 = parseHand('S:K84 H:K853 D:753 C:Q53')
  it('platt 8 hp utan lyft → konkurrenshöjning 2♠ som förr', () => {
    expect(advanceOvercall(flat8, 'spades', 'diamonds').call).toBe('2S')
  })
})

// ---- Integration: TP-inklivet nås LIVE via decideCall (maybeOvercall) --------
describe('F4 — live via decideCall i direkt sits', () => {
  const deal: Deal = {
    id: 'test-f4', dealer: 'W', vulnerability: 'none', board: 1,
    hands: {
      W: parseHand('S:642 H:AKQ87 D:A42 C:96'),   // 13 hp, 5-korts hjärter → 1♥
      N: parseHand('S:KQJT9 H:J653 D:753 C:8'),   // 7 hp / 9 startp. → TP-inkliv
      E: parseHand('S:A87 H:T94 D:KQJ C:AK75'),
      S: parseHand('S:53 H:2 D:T986 C:QJT432'),
    },
  }
  it('1♥–(N): Nord kliver in 1♠ på 7 hp / 9 startp. (förr pass)', () => {
    const bid = decideCall(deal, [call('W', '1H')], 'N')
    expect(bid.bid).toBe('1S')
  })
})
