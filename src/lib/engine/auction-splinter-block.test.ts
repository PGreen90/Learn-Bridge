import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { responderRevealSplinterShortness } from './responder-rebids'
import { respondToMajor } from './responses'

// =============================================================================
// SPLINTERREGELN: SINGEL A/K ÄR INGEN SPLINTERFÄRG (ägarregel 2026-08-06,
// byggd 2026-08-07). Facit FÖRE fix.
//
// En splinter säger till partnern "räkna inte med stick hos mig i färgen —
// devalvera dina honnörer där, räkna ruffvärden". Med en singel-A/K är det
// budskapet FALSKT: honnören drar (nästan alltid) ett stick, och partnerns
// K/Q-värdering i färgen blir fel åt båda hållen. Källor: bridgebum
// (splinters.php: "avoid … if your singleton is a high honor", "a singleton
// king is an even worse holding than a singleton ace" → föredra Jacoby 2NT)
// + BBO-expertkonsensus. Singel-DAM får däremot splintras (drar sällan ett
// stick själv → budskapet är nästan sant) — ägarbeslut 2026-08-07 efter
// källgenomgång. Renons splintras alltid.
//
// Motivgiven: frö 20260947 (ur hål D-facitstädningen) — Väst ♠K ♥AJ942 ♦A653
// ♣KQ6 (17 hp, 5-korts hjärterstöd) splintrade 3♠ på singel-KUNGEN i stället
// för en hederlig Jacoby 2NT. Boken §4.1 + §9.
// =============================================================================

describe('splinterregeln – singel A/K blockerar splinter (→ Jacoby 2NT)', () => {
  it('singel KUNG splintras inte: Västs 947-hand svarar 2NT (Jacoby), inte 3♠', () => {
    const r = respondToMajor(parseHand('S:K H:AJ942 D:A653 C:KQ6'), 'hearts')
    expect(r.call).toBe('2NT')
    expect(r.rule).toBe('Jacoby 2NT')
  })

  it('singel ESS splintras inte: 2NT (Jacoby)', () => {
    const r = respondToMajor(parseHand('S:A H:KQ742 D:K653 C:Q64'), 'hearts')
    expect(r.call).toBe('2NT')
    expect(r.rule).toBe('Jacoby 2NT')
  })

  it('singel DAM får splintras (drar sällan ett stick): 3♠ som förr', () => {
    const r = respondToMajor(parseHand('S:Q H:KQ73 D:A842 C:K842'), 'hearts')
    expect(r.call).toBe('3S')
    expect(r.rule).toBe('tvetydig splinter')
  })

  it('liten singel splintras som förr', () => {
    const r = respondToMajor(parseHand('S:KQ95 H:KQ73 D:8 C:K842'), 'hearts')
    expect(r.call).toBe('3S')
    expect(r.rule).toBe('tvetydig splinter')
  })

  it('renons splintras alltid – även med singel-K i en annan färg', () => {
    // 4-8-0-1: renons ruter (splintervärdig) + singel ♣K (ej splintervärdig).
    const r = respondToMajor(parseHand('S:AJ84 H:Q8765432 D:- C:K'), 'spades')
    expect(r.call).toBe('3H')
    expect(r.rule).toBe('tvetydig splinter')
  })

  it('reveal pekar på RENONSEN, inte singel-kungen', () => {
    // Samma hand: kortfärgsvisningen efter relät ska visa ruterrenonsen (4♦),
    // inte klöverns singel-K (4♣) — reveal och splinterbeslut delar predikat.
    const call = responderRevealSplinterShortness(parseHand('S:AJ84 H:Q8765432 D:- C:K'), 'spades')
    expect(call).not.toBeNull()
    expect(call!.call).toBe('4D')
  })
})

describe('kanoniska linjen: blockerad splinter går Jacoby-vägen hela vägen', () => {
  // Konstruerad TYST giv (motivgiven 20260947:s verkliga bord har ett
  // Michaels-inkliv och går i konkurrenslagret — Västs hand där låses som
  // unit-facit ovan). Här: Syd har GF-höjning med singel-♥K → förr 3♥
  // (tvetydig splinter), nu 2NT (Jacoby) → öppnarens återbud → cue-ronden
  // tar vid i spader. Motståndarna är för svaga för att agera.
  const deal: Deal = {
    id: 'splinter-block-jacoby',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: {
      N: parseHand('S:AQJ65 H:862 D:AK4 C:32'),
      E: parseHand('S:97 H:97543 D:J63 C:764'),
      S: parseHand('S:K843 H:K D:Q752 C:AKQ5'),
      W: parseHand('S:T2 H:AQJT D:T98 C:JT98'),
    },
  }

  it('Syd svarar 2NT (Jacoby), inte 3♥ → cue-rond → 6♠', () => {
    const auction = buildAuction(deal)
    expect(auction).not.toBeNull()
    const sResponse = auction!.turns.find((t) => t.seat === 'S' && t.call !== 'P')
    expect(sResponse).toBeDefined()
    expect(sResponse!.call).toBe('2NT')
    expect(sResponse!.rule).toBe('Jacoby 2NT')
    // Hela den kanoniska vägen: Jacoby → öppnarens 3NT (14–15 bal) → cue 4♣/4♦
    // → 4NT RKC → 5♠ (2 nyckelkort + trumfdam) → 6♠ (♥A saknas → inte storslam).
    expect(auction!.turns.map((t) => t.call)).toEqual(['1S', '2NT', '3NT', '4C', '4D', '4NT', '5S', '6S'])
  })
})
