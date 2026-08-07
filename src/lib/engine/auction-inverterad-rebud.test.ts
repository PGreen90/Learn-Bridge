import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { openerRebidAfterInvertedMinor } from './rebids'
import { responderRebidAfterInvertedMinor } from './responder-rebids'

// =============================================================================
// B13 (2026-08-07): öppnarens återbud efter inverterad minorhöjning förfinas.
// Facit-först: skrivna FÖRE fixen. Tre hål lagas:
//   1. "Stopp" var bara LÄNGD (4+ kort) — nu motorns äkta honnörsstopp
//      (A / Kx / Qxx / J10xx), samma test som resten av motorn.
//   2. En stark hand (15+) utan 4-korts sidofärg dog i 3m ("minimum", ej krav)
//      → utgångar på 27+ hp missades. Nu bjuder 15+ ALLTID krav.
//   3. Svararen bjöd ALLTID utgång efter en stopp-visning (även 10 mot 12).
//      Nu bromsar 10–12 med 3m; öppnaren passar 12–14 och driver 15+.
// Dessutom: cue-ronden (§6.2) inkopplad för minorfiten — nya färger UNDER 3NT
// är stopp-letande, ÖVER 3NT kontrollbud — och i 2♣-grenen (GF given).
// =============================================================================

const stoppVisning = (call: string) => ({ call, rule: 'inverterad: stopp-visning', explanation: '' })

describe('öppnarens återbud efter 1m–2m — äkta stopp, graderad styrka (B13)', () => {
  it('längd utan honnör är INGET stopp: ♠9642 visas aldrig som spaderstopp', () => {
    // 16 hp, 5♣. Gamla koden bjöd 2♠ på ♠9642 ("4+ kort = stopp") → svararen
    // litade på beskedet och 3NT föll på spaderutspel. Äkta stopp: ♦K5 (Kx).
    const opener = parseHand('S:9642 H:AK D:K5 C:AQ743')
    const r = openerRebidAfterInvertedMinor(opener, 'clubs', true)
    expect(r.call).toBe('2D')
    expect(r.rule).toBe('inverterad: stopp-visning')
  })

  it('B13-kärnfallet: 17 hp + 6♦ dör ALDRIG i 3♦ — kravbud (2♥, stopp)', () => {
    // Gamla koden: ingen 4-korts sidofärg → "3♦ minimum, ej krav" → svararen
    // med 10–12 passade och utgången på 27+ hp försvann.
    const opener = parseHand('S:A2 H:K93 D:KQJT74 C:A5')
    const r = openerRebidAfterInvertedMinor(opener, 'diamonds', true)
    expect(r.call).toBe('2H')
    expect(r.rule).toBe('inverterad: stopp-visning')
  })

  it('äkta minimum utan stopp → 3m (strikt 12–14)', () => {
    // 14 hp, inga sidostopp (QJ-dubbel är inget stopp, J52 inte heller).
    const opener = parseHand('S:QJ H:J52 D:AKQJ76 C:87')
    const r = openerRebidAfterInvertedMinor(opener, 'diamonds', true)
    expect(r.call).toBe('3D')
    expect(r.rule).toBe('inverterad: minimum')
  })

  it('minimum MED stopp visar stoppen (2♠ på AQ2 — inte 3♦ som förr)', () => {
    // 12 hp: gamla koden krävde 4+ kort och föll till 3♦; äkta stopp AQ2 visas.
    const opener = parseHand('S:AQ2 H:864 D:KQJ976 C:8')
    const r = openerRebidAfterInvertedMinor(opener, 'diamonds', true)
    expect(r.call).toBe('2S')
    expect(r.rule).toBe('inverterad: stopp-visning')
  })

  it('stark hand HELT utan sidostopp bjuder ändå krav ("fantomstoppen")', () => {
    // 17 hp men singel-K/QJ-dubbel/J43 — inget äkta stopp någonstans. Får ändå
    // aldrig dö i 3♦: bästa sidofärgen bjuds som VANLIG stopp-visning (samma
    // bud, samma regel — partnern kan inte och SKA inte kunna skilja dem åt,
    // ärliga portar). Styrkan visas i nästa bud: öppnaren driver förbi bromsen.
    const opener = parseHand('S:K H:QJ D:AKQJT82 C:J43')
    const r = openerRebidAfterInvertedMinor(opener, 'diamonds', true)
    expect(r.call).toBe('3C')
    expect(r.rule).toBe('inverterad: stopp-visning')
  })
})

describe('svararens broms 10–12 efter stopp-visningen (B13)', () => {
  it('10 hp → 3♦ (broms, ej krav) i stället för tvingad utgång', () => {
    const responder = parseHand('S:K85 H:762 D:A983 C:QJ4') // 10 hp
    const r = responderRebidAfterInvertedMinor(responder, 'diamonds', stoppVisning('2H'))!
    expect(r.call).toBe('3D')
    expect(r.rule).toBe('inverterad: broms')
  })

  it('13+ fortsätter mot utgång som förr (3NT när resten är täckt)', () => {
    const responder = parseHand('S:K85 H:76 D:A983 C:AQJ4') // 14 hp
    const r = responderRebidAfterInvertedMinor(responder, 'diamonds', stoppVisning('2H'))!
    expect(r.call).toBe('3NT')
  })
})

describe('buildAuction — hela kedjor: broms + öppnarens andra växel (B13)', () => {
  it('1♦–2♦–2♥–3♦(broms)–3NT: öppnaren 17 driver förbi bromsen', () => {
    // Nord 17 hp (B13-kärnhanden, håller alla sidofärger), Syd 11 med broms.
    // Gamla systemet: 3♦ passades ut på 28 hp ihop.
    const deal: Deal = {
      id: 'b13-andra-vaxeln',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:A2 H:K93 D:KQJT74 C:A5'), // 17, 6♦ → 1♦
        E: parseHand('S:QT974 H:QT84 D:65 C:32'),
        S: parseHand('S:K85 H:762 D:A983 C:KJ4'), // 11, 4♦, ingen 4-korts hf → 2♦
        W: parseHand('S:J63 H:AJ5 D:2 C:QT98765'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1D', '2D', '2H', '3D', '3NT'])
    expect(a.turns[3].rule).toBe('inverterad: broms')
    expect(a.open).toBe(false)
  })

  it('1♣–2♣–2♦–3♣(broms)–3♠(andra stoppen)–3NT: stoppen pusslas ihop', () => {
    // Nord 16 (stopp ♦ och ♠, inte ♥), Syd 11 med hjärterhållet. Öppnaren
    // driver med en ANDRA stopp-visning under 3NT; svararen täcker resten.
    const deal: Deal = {
      id: 'b13-tva-stopp',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AQ4 H:9 D:KJ52 C:AQ763'), // 17, obalanserad, 5♣ → 1♣
        E: parseHand('S:KJT9 H:JT865 D:43 C:J9'),
        S: parseHand('S:852 H:KQ2 D:QT6 C:KT84'), // 10, 4♣, ingen 4-korts hf → 2♣
        W: parseHand('S:763 H:A743 D:A987 C:52'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1C', '2C', '2D', '3C', '3S', '3NT'])
    expect(a.open).toBe(false)
  })
})

describe('buildAuction — cue-ronden i minorfiten: under 3NT stopp, över 3NT cue (B13)', () => {
  it('1♦–2♦–2♥–4♣(cue)–4♥(cue)–4NT–5♠–6♦: slam via kontrollbud', () => {
    // Syd 19 hp med 5♦ captainar i KANSKE-zonen (golv 32): 4♣ = ♣A (ALDRIG
    // 3-läges-cue — de betyder stopp), Nord cue:ar ♥A, spader okontrollerad men
    // bara EN lucka → 4NT. Nord 2 nyckelkort + trumfdam (5♠) → 4 av 5 → 6♦.
    // (I KLAR drivzon, 33+, hoppas cue-ronden över i minortrumf — 5m ligger
    // över 4NT och cue:andet får inte äta upp frågeutrymmet.)
    const deal: Deal = {
      id: 'b13-minor-cue',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:K5 H:A965 D:KQJ96 C:Q4'), // 15 → 1♦, 2♥ (stopp)
        E: parseHand('S:T9876 H:JT8 D:T5 C:965'),
        S: parseHand('S:QJ3 H:KQ2 D:A8732 C:AK'), // 19, 5♦ → 2♦, captain
        W: parseHand('S:A42 H:743 D:4 C:JT8732'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1D', '2D', '2H', '4C', '4H', '4NT', '5S', '6D'])
    expect(a.turns.filter((t) => t.rule === 'cue-bid').map((t) => t.call)).toEqual(['4C', '4H'])
    expect(a.open).toBe(false)
  })
})

describe('buildAuction — cue-ronden i 2♣-grenen (trumf agreed, GF given)', () => {
  it('2♣–2♠–3♠–4♦(cue)–4♥(cue)–4NT–5♦–6♠', () => {
    // Nord 25 med spaderstöd sätter trumf (GF). Syd cue:ar ♦A, Nord ♥A;
    // bara klövern okontrollerad → 4NT; Nords svar 0/3 läses som 3 (visade
    // 22+) → 6♠. Förr: ingen cue-rond alls i 2♣-grenen.
    const deal: Deal = {
      id: 'b13-2c-cue',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:A42 H:AKQ D:Q32 C:AK43'), // 22 → 2♣
        E: parseHand('S:T97 H:JT98 D:JT9 C:QJT'),
        S: parseHand('S:KQJ85 H:52 D:A54 C:652'), // 10, 5♠ → 2♠ (positivt)
        W: parseHand('S:63 H:7643 D:K876 C:987'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['2C', '2S', '3S', '4D', '4H', '4NT', '5D', '6S'])
    expect(a.turns.filter((t) => t.rule === 'cue-bid').map((t) => t.call)).toEqual(['4D', '4H'])
    expect(a.open).toBe(false)
  })
})
