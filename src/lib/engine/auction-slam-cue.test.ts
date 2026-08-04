import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { slamInvestigation } from './slam-auction'

// =============================================================================
// CUE-BUD ÅTERINFÖRDA (ägarbeslut 2026-08-03, river 2026-07-07). När UTGÅNG är
// etablerad (GF) + trumf klar cue-bjuder motorn kontroller UNDER utgång — gratis,
// ingen poänggräns. Poängomdömet flyttar till beslutet att gå FÖRBI utgången
// (4NT RKC / slam). Testerna låser: driv via cue, minimum som cue:ar men landar
// i utgång (skadar inte), och att kontroll-gapet stoppar även en stark hand.
// Facit-först: skrivna FÖRE cueSlamAuction implementerades.
// =============================================================================

describe('slamInvestigation – GF cue-rond (frö 20260932: 1♣–1♥–1NT–2♦–3♥)', () => {
  // Slamsidan i frö 20260932. Öppnaren (Nord) visade fördröjt 3-kortsstöd (3♥);
  // svararen (Syd, 18) captainar. Hjärter är trumf. Cue: Syd ♠A (3♠), Nord ♦A
  // (4♦, förnekar klöver genom att hoppa över den), Syd vet att bara klöver
  // saknar första-rondskontroll → 4NT RKC; Nord 1 nyckelkort (♦A) → 5♣; 4 av 5
  // nyckelkort ihop, bara ♣A saknas → 6♥.
  const opener = parseHand('S:K74 H:JT5 D:AK2 C:K542') // Nord, 13
  const responder = parseHand('S:AQ5 H:AKQ72 D:QJ9 C:T3') // Syd, 18

  it('cue-driv → 6♥ via 3♠–4♦–4NT–5♣–6♥', () => {
    const turns = slamInvestigation(opener, responder, 'hearts', '3H', {
      partnerMin: 13,
      gameForcing: true,
    })!
    expect(turns).not.toBeNull()
    expect(turns.map((t) => t.call)).toEqual(['3S', '4D', '4NT', '5C', '6H'])
    expect(turns[0].rule).toBe('cue-bid')
    expect(turns[1].rule).toBe('cue-bid')
    expect(turns[2].rule).toBe('1430 RKC')
    expect(turns[turns.length - 1].call).toBe('6H')
  })
})

describe('slamInvestigation – GF cue-rond: minimum cue:ar men LANDAR i utgång (skadar inte)', () => {
  // Kaptenen har slaminget men bara EN sidokontroll (♥A) och partnern förnekar
  // resten → två sidofärger utan första-rondskontroll → ingen slam, tillbaka
  // till utgången paret ändå skulle spela.
  const opener = parseHand('S:AT97 H:K54 D:K32 C:KQ2') // Nord, 15, ingen sido-första-rondskontroll
  const responder = parseHand('S:KQJ5 H:A32 D:K32 C:Q32') // Syd, 16, bara ♥A som sidokontroll

  it('cue 4♥, öppnaren avslutar 4♠, kaptenen passar (klöver+ruter okontrollerade)', () => {
    const turns = slamInvestigation(opener, responder, 'spades', '3S', {
      partnerMin: 15,
      gameForcing: true,
    })!
    expect(turns).not.toBeNull()
    // En cue gjordes...
    expect(turns.some((t) => t.rule === 'cue-bid')).toBe(true)
    // ...men slutbudet är utgång, aldrig 4NT/slam.
    expect(turns.some((t) => t.call === '4NT')).toBe(false)
    const contract = turns.map((t) => t.call).filter((c) => c !== 'P').pop()
    expect(contract).toBe('4S')
  })
})

describe('buildAuction – NMF-support-slam växer fram (hål C, frö 20260932)', () => {
  it('1♣–1♥–1NT–2♦–3♥–3♠–4♦–4NT–5♣–6♥: 5-3-fit agreed → cue-slam on-book', () => {
    const deal: Deal = {
      id: 'nmf-slam-932',
      dealer: 'N',
      vulnerability: 'ew',
      board: 1,
      hands: {
        N: parseHand('S:K74 H:JT5 D:AK2 C:K542'), // 14 → 1♣, 1NT-återbud, max 3-korts hjärterstöd → 3♥
        E: parseHand('S:T86 H:9643 D:T743 C:96'),
        S: parseHand('S:AQ5 H:AKQ72 D:QJ9 C:T3'), // 18, 5-korts hjärter → NMF, captain
        W: parseHand('S:J932 H:8 D:865 C:AQJ87'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1C', '1H', '1NT', '2D', '3H', '3S', '4D', '4NT', '5C', '6H'])
    expect(a.turns.filter((t) => t.rule === 'cue-bid').map((t) => t.call)).toEqual(['3S', '4D'])
    expect(a.open).toBe(false)
  })
})

describe('slamInvestigation – icke-GF oförändrat (gameForcing utelämnat)', () => {
  // Utan gameForcing gäller den gamla ärliga porten (driv 33+): ingen cue-rond.
  const opener = parseHand('S:AKQ85 H:A43 D:KJ7 C:82')
  const responder = parseHand('S:J762 H:AQ5 D:AQ64 C:K3') // 17 + visade 16 = 33 → driv

  it('driv-zonen utan gameForcing → 4NT direkt (ingen cue)', () => {
    const turns = slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16 })!
    expect(turns[0].call).toBe('4NT')
    expect(turns.some((t) => t.rule === 'cue-bid')).toBe(false)
  })
})
