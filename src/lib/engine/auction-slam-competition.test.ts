import { describe, expect, it } from 'vitest'
import { botAuction, dealFromSeed } from './revisor'
import { contractFromCalls } from './auction-contract'

// =============================================================================
// ETAPP 7 HÅL D — SLAM EFTER MOTSTÅNDARNAS INKLIV (steg 1: kontroll-komplett 4NT).
//
// Systemrevisorns förskanning (docs/systemrevisorn.md Fynd 3, mönster E) pekade
// ut 19 givar där vår sida hittar en fit GENOM konkurrens (negativ/upplysnings-
// dubbling + höjning, cue-höjning), når utgång 4M — och sedan PASSAR den starka
// kaptenen naket (regellöst pass, Fynd 1). Cue-maskineriet (slam-auction.ts)
// finns bara i det kanoniska lagret (Jacoby 2NT / NMF); i konkurrenslagret
// (auction-live.ts) saknas slaminvit-väg.
//
// Ägarbeslut 2026-08-05: bygg slaminvit i konkurrenslagret, men BARA för äkta
// extra (17+ startpoäng, eller 16 med 3 kontroller) + etablerad högfärgsfit.
// STEG 1 (byggt): kontroll-komplett 4NT — kaptenen har förstarundskontroll i
// ALLA sidofärger och frågar direkt (competitiveSlamTry/competitiveRKCPlace i
// auction-live.ts). I konkurrens läcker cue-bud info till motståndarna → cue:a
// inte när du har alla kontroller själv.
//
// FACITHISTORIK (ägarbeslut 2026-08-06/07, se docs/senare.md + historik.md):
// - 20260947 FLYTTAD till splinterregelns facit (auction-splinter-block.test.ts):
//   Västs hand är en hederlig Jacoby 2NT — felet var att motorn splintrade en
//   singel-KUNG, inte att konkurrenslagret saknade en väg. Hör hemma i det
//   kanoniska Jacoby-spåret.
// - 20261274 STRUKEN: premissen stale — 2/1-regeln (5-korts klöver före 4-korts
//   högfärg över 1♦, 2026-08-06) gör att Syd bjuder 2♣ i stället för 1♠, så
//   stöddubblingsvägen uppstår inte längre.
// - 20261272 PARKERAD med steg 2 (cue-frontend för kontroll-OFULLSTÄNDIGA
//   händer — Nord saknar ♣-kontroll): ägarbeslut 2026-08-07, kvarvarande ärlig
//   kärna för liten för regressionsrisken. Se docs/senare.md.
// - DD-smicker-givarna (20260846 6NT på misspass, 20261201 vild tvåfärg)
//   lämnades MEDVETET utanför facit redan vid förskanningen.
// =============================================================================

describe('hål D – konkurrens-slam: den starka kaptenen bjuder slam i stället för naket pass', () => {
  it('frö 20260877: S 19 bal (♠KJT ♥A73 ♦AK97 ♣A95) + spaderfit efter upplysningsdubbling → 6♠', () => {
    // N P, E 1H, S X(stark), W 2H, N 3S(fritt svar), S höjde till 4S och passade.
    // Med 19 bal + känd spaderfit + partnerns FRIA 3S ska S driva slam.
    const calls = botAuction(dealFromSeed(20260877))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    expect(contract!.level).toBe(6)
    expect(contract!.strain).toBe('spades')
  })
})
