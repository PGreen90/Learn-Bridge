// Regressionsvakt för försvarsmarkeringar (markeringar Steg 1–3). Ägarbeslut
// 2026-07-29: botarna markerar RIKTIGT (fulla §8-signaler, som vid ett bord).
// En signal KAN kosta ett stick när partnerns dolda kort gör spotkortet
// värdefullt, och flera markeringar i samma giv kan summera – det är ärlig
// bridge. Steg 5 (läsningen) ska göra markeringarna lönsamma NETTO (mätt i
// play-quality.probe, gatad). Uppmätt encode-kostnad över 239 seedade givar:
// ~1190 markeringar (5/giv), netto +10 stick åt spelföraren (~0,04/giv),
// värst +4 på en enskild giv, 4 givar där försvaret t.o.m. blev bättre.
//
// Vad DEN HÄR vakten säkrar (billigt, i vanliga sviten, seedat):
//   (a) INGEN enskild markering är en grov blunder – ingen giv tappar 5+ stick
//       (så återfångas t.ex. buggen där en count-signal blottade hela garden på
//       en lång färg, som gav +5 innan gardregeln).
//   (b) Netto-kostnaden hålls BUNDEN – skenar den har något gått sönder.
// Skruvas markeringarna om ska siffrorna kontrollmätas (play-quality.probe).

import { describe, expect, it } from 'vitest'
import { botCardReasoned } from './play-bot'
import { contractResult, isComplete, playCard, startPlay, type Contract } from './play'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import type { Deal } from '../../types/bridge'

/** Spela hela given med rena tumregler; returnera spelförarsidans antal stick. */
function declarerTricks(deal: Deal, contract: Contract, signals: boolean): number {
  let st = startPlay(deal, contract)
  let guard = 0
  while (!isComplete(st) && guard++ < 60) {
    st = playCard(st, botCardReasoned(st, st.toAct, { signals }).card)
  }
  return contractResult(st).declarerTricks
}

describe('försvarsmarkeringar: bunden kostnad, inga grova blundrar', () => {
  it('över frö 1–120: netto liten och ingen giv tappar 5+ stick', () => {
    let net = 0
    let maxWorse = 0
    let spelade = 0
    for (let seed = 1; seed <= 120; seed++) {
      const deal = dealFromSeed(seed)
      const calls = botAuction(deal)
      const contract = calls && contractFromCalls(calls)
      if (!contract) continue
      spelade++
      const diff = declarerTricks(deal, contract, true) - declarerTricks(deal, contract, false)
      net += diff
      if (diff > maxWorse) maxWorse = diff
    }
    expect(spelade).toBeGreaterThan(20)
    // (a) ingen enskild grov blunder (5+ stick på en giv = spare-/gardbugg):
    expect(maxWorse).toBeLessThan(5)
    // (b) netto bunden (uppmätt ~+6 över 120; headroom mot regression):
    expect(net).toBeLessThanOrEqual(12)
  })
})
