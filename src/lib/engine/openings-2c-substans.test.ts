// 2♣-ÖVERSYNEN steg 1 (ägarbeslut 2026-08-31, "Regel B"): FACIT FÖRE FIX.
//
// Gammal regel: distributionell 2♣ på PLATT ≥8½ spelstick oavsett färg.
// Ny regel (källförankrad: Karen Walker/bridgebum/Lawrence + ägarens domar):
//   distributionell 2♣ (hp<22) kräver
//     A) färgmodulerade spelstick — ≥9 om längsta färgen är HÖG, ≥9½ LÅG —
//        OCH minst 3 spelfasta stick (quick tricks: försvarsstyrka,
//        stoppar spärrtypshänder från att låtsas vara starka), ELLER
//     B) valven: ≥8½ spelstick OCH ≥4 spelfasta stick (räddar honnörs-/
//        esstunga händer som faller på stickräkningen, t.ex. tre-ess-händer).
//
// Ägarens fixpunkter (2026-08-26): frö 20261050 "verkligen en 2♣";
// frö 20260220 "gillar att låga poäng med fördelning öppnas på 1-läget".
// Mätunderlag: tvaklover-oversyn.probe.test.ts (20 000 givar: 2♣-frekvensen
// 1,6 % → 1,1 %; verkligheten ~1 %).
import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { classifyOpening } from './openings'
import { dealFromSeed } from './revisor'
import type { Seat } from '../../types/bridge'

const openFromSeed = (seed: number, seat: Seat) =>
  classifyOpening(dealFromSeed(seed).hands[seat]).call

describe('2♣-substanskraven (Regel B) — ägarens fixpunkter', () => {
  it('frö 20261050: 21 hp, tre ess, 5 spelfasta stick → 2♣ via valven ("verkligen en 2♣")', () => {
    // ♠AKJ ♥AJT985 ♦A ♣A53 — 8½ spelstick (faller på stickräkningen) men
    // 5 spelfasta stick → valven håller kvar den.
    expect(openFromSeed(20261050, 'S')).toBe('2C')
  })

  it('frö 20260220: 13 hp 6-5 i högfärgerna, 2½ spelfasta stick → 1♠ (1-läget)', () => {
    // ♠KQJT94 ♥AQJ98 ♦98 ♣— — formstark minimihand; både Baze-artikeln och
    // standard-2/1 öppnar den på 1-läget. Längsta färgen spader → 1♠.
    expect(openFromSeed(20260220, 'S')).toBe('1S')
  })

  it('frö 20260474: 19 hp, FYRA ess, löpande klöver → 2♣ via valven', () => {
    // ♠A5 ♥A42 ♦A ♣AQJT765 — 4½ spelfasta stick; en oviktad kontrollräknare
    // hade felflippat den (4 ess = "bara" 4 kontroller). QT-valven räddar den.
    expect(openFromSeed(20260474, 'S')).toBe('2C')
  })
})

describe('2♣-substanskraven — spärrtypshänder öppnar inte 2♣ (QT ≥ 3 på stick-vägen)', () => {
  it('frö 20267070: 9 hp, 9-korts spader, 2 spelfasta stick → INTE 2♣', () => {
    // ♠AKQ986432 ♥8 ♦9 ♣T2 — 9 spelstick men ingen försvarsstyrka: en
    // spärrhand, ingen stark öppning. (Walkers minimum: 3 spelfasta stick.)
    expect(openFromSeed(20267070, 'S')).not.toBe('2C')
  })

  it('frö 20265154: 10 hp, 8-korts hjärter, 2 spelfasta stick → INTE 2♣', () => {
    // ♠A965 ♥KQJT9742 ♦— ♣8 — samma princip.
    expect(openFromSeed(20265154, 'S')).not.toBe('2C')
  })
})

describe('2♣-substanskraven — kända frön som byter öppning (regressionsvakt)', () => {
  it('frö 20261107: 13 hp 6♠-5♦, 2½ spelfasta stick → 1♠ (var 2♣ i slamfacit)', () => {
    // ♠KJT872 ♥9 ♦AKQ64 ♣5 — fortsättningsfacit i auction-2c-slam.test.ts
    // matar auktionen explicit och påverkas inte; ÖPPNINGEN blir 1♠.
    expect(openFromSeed(20261107, 'E')).toBe('1S')
  })

  it('frö 20261885: 16 hp 6♠-6♣, 2½ spelfasta stick → 1♠ (var 2♣ i strain-facit)', () => {
    // ♠K98653 ♥— ♦K ♣AKQJ53 — klarar stickgolvet (9½) men inte QT ≥ 3.
    // Lågfärgs-tvåfärgare på 1-läget är dessutom expertlinjen.
    expect(openFromSeed(20261885, 'S')).toBe('1S')
  })
})

describe('2♣-substanskraven — vakter (beteende som INTE ska ändras)', () => {
  it('stark 22+ obalanserad öppnar fortfarande 2♣ (poängvägen orörd)', () => {
    expect(classifyOpening(parseHand('S:AKQJT98 H:AK D:AKQ C:4')).call).toBe('2C')
  })

  it('8½-stickare MED 4+ spelfasta stick öppnar fortfarande 2♣ (valven)', () => {
    // ♠AK ♥AKQJ98 ♦K2 ♣432 — 20 hp, 4½ QT: gamla facittestets hand står kvar.
    expect(classifyOpening(parseHand('S:AK H:AKQJ98 D:K2 C:432')).call).toBe('2C')
  })

  it('enfärgad HÖGfärgshand med 9 spelstick och 3 QT öppnar 2♣ (stick-vägen)', () => {
    // ♠AKQJT843 ♥A32 ♦2 ♣2 — 14 hp: 8 löpande spader + ess = 9 stick, 3 QT.
    expect(classifyOpening(parseHand('S:AKQJT843 H:A32 D:2 C:2')).call).toBe('2C')
  })

  it('LÅGfärgshand på exakt 9 stick öppnar INTE 2♣ (lågfärg kräver 9½)', () => {
    // ♠A32 ♥2 ♦2 ♣AKQJT843 — spegeln av handen ovan med klöver som färg:
    // 9 stick < 9½-golvet för lågfärg → 1♣ (söker hellre 3NT via 1-läget).
    expect(classifyOpening(parseHand('S:A32 H:2 D:2 C:AKQJT843')).call).toBe('1C')
  })

  it('under 8½ spelstick öppnar 1 i färg precis som förr', () => {
    expect(classifyOpening(parseHand('S:AK H:AKQJ98 D:32 C:432')).call).toBe('1H')
  })
})
