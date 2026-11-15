// LÖSARBYTET I MONTE-CARLO (ägarbeslut 2026-11-15, "bottarna tänker för länge").
// Röstningen räknade förr varje lagligt kort på varje utdelat läge med appens
// egen TS-lösare (nodbudget, sekunder vid 7–8 kort). Med en registrerad SNABB
// lösare (bridge-dds: alla korts värde i ETT anrop per läge) ska röstningen
//   • ge EXAKT samma kort, poäng och lägesantal som TS-vägen där den hinner klart,
//   • anropa lösaren en gång per läge (inte per kort),
//   • hoppa över ett läge lösaren vägrar, och ge null om inget läge gick att lösa,
//   • vara oförändrad (TS-vägen) när ingen snabb lösare är registrerad.
// Mätningen bakom: betanketid-losare.probe.test.ts (387 s → 3,7 s på 30 givar).

import { afterEach, describe, expect, it } from 'vitest'
import { contractFromCalls } from './auction-contract'
import { shownVoids } from './card-counting'
import { mulberry32 } from './deal'
import { buildHandModel } from './hand-model'
import { laddaSnabbLosare } from './mc-losare'
import { anvandSnabbLosare, chooseCardMonteCarlo, harSnabbLosare, type AllaKortLosare } from './monte-carlo'
import { isComplete, legalCards, playCard, startPlay, type PlayState } from './play'
import { botCard, botCardSmart } from './play-bot'
import { botAuction, dealFromSeed } from './revisor'
import { getDds, solveAllCards } from './revisor-dds'
import type { ResolvedCall } from '../bidding'

afterEach(() => anvandSnabbLosare(null))

/** Riktiga slutspel: spela slumpgivar med tumregeln ner till `kort` kort kvar. */
function slutspel(fron: number[], kort: number): Array<{ state: PlayState; calls: ResolvedCall[] }> {
  const ut: Array<{ state: PlayState; calls: ResolvedCall[] }> = []
  for (const fro of fron) {
    const deal = dealFromSeed(fro)
    const calls = botAuction(deal)
    const contract = calls && contractFromCalls(calls)
    if (!calls || !contract) continue
    let st = startPlay(deal, contract)
    while (!isComplete(st) && !(st.currentTrick.length === 0 && st.hands[st.toAct].length <= kort)) {
      st = playCard(st, botCard(st, st.toAct))
    }
    if (!isComplete(st)) ut.push({ state: st, calls })
  }
  return ut
}

describe('Monte-Carlo med snabb lösare', () => {
  it('ger exakt samma kort, poäng och lägesantal som TS-lösaren (hela slutspelet, alla stolar)', async () => {
    const dds = await getDds()
    const snabb: AllaKortLosare = (st) => solveAllCards(dds, st, true)
    let jamforda = 0
    for (const { state, calls } of slutspel([20261115, 20261116, 20261117, 20261118, 20261119, 20261120], 6)) {
      let st = state
      while (!isComplete(st)) {
        const seat = st.toAct
        if (legalCards(st, seat).length > 1) {
          const model = buildHandModel(calls, { voids: shownVoids(st) })
          const fro = 1000 + jamforda
          anvandSnabbLosare(null)
          const ts = chooseCardMonteCarlo(st, seat, model, { samples: 12, maxNodes: Infinity, rng: mulberry32(fro) })
          anvandSnabbLosare(snabb)
          const wasm = chooseCardMonteCarlo(st, seat, model, { samples: 12, maxNodes: Infinity, rng: mulberry32(fro) })
          expect(wasm, `läge ${jamforda}`).toEqual(ts)
          jamforda++
        }
        st = playCard(st, botCard(st, seat))
      }
    }
    expect(jamforda).toBeGreaterThan(40)
  })

  it('anropar lösaren en gång per utdelat läge — inte en gång per kort', async () => {
    const dds = await getDds()
    const [{ state, calls }] = slutspel([20261115], 7)
    let anrop = 0
    anvandSnabbLosare((st) => {
      anrop++
      return solveAllCards(dds, st, true)
    })
    const model = buildHandModel(calls, { voids: shownVoids(state) })
    const val = chooseCardMonteCarlo(state, state.toAct, model, { samples: 10, rng: mulberry32(7) })
    expect(val).not.toBeNull()
    expect(legalCards(state, state.toAct).length).toBeGreaterThan(1)
    expect(anrop).toBe(val!.samples)
    expect(anrop).toBeLessThanOrEqual(10)
  })

  it('hoppar över ett läge lösaren vägrar; vägrar den alla blir svaret null', async () => {
    const dds = await getDds()
    const [{ state, calls }] = slutspel([20261116], 6)
    const model = buildHandModel(calls, { voids: shownVoids(state) })
    let n = 0
    anvandSnabbLosare((st) => {
      if (n++ === 0) throw new Error('lösarfel')
      return solveAllCards(dds, st, true)
    })
    const val = chooseCardMonteCarlo(state, state.toAct, model, { samples: 8, rng: mulberry32(3) })
    expect(val).not.toBeNull()
    expect(val!.samples).toBe(n - 1)

    anvandSnabbLosare(() => {
      throw new Error('lösarfel')
    })
    expect(chooseCardMonteCarlo(state, state.toAct, model, { samples: 8, rng: mulberry32(3) })).toBeNull()
  })

  it('laddaSnabbLosare registrerar lösaren, och bot-hjärnans kortval är reproducerbart med den', async () => {
    expect(harSnabbLosare()).toBe(false)
    expect(await laddaSnabbLosare()).toBe(true)
    expect(harSnabbLosare()).toBe(true)
    const [{ state, calls }] = slutspel([20261117], 8)
    const a = botCardSmart(state, state.toAct, calls, { rng: mulberry32(11) })
    const b = botCardSmart(state, state.toAct, calls, { rng: mulberry32(11) })
    expect(a).toEqual(b)
    expect(legalCards(state, state.toAct)).toContainEqual(a)
  })
})
