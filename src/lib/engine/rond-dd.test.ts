// Facit för rondgenomgångens DD-dom (etapp 3). Skrivet FÖRE koden.
//
// analyzeDd spelar upp de bokförda sticken till varje stickgräns och frågar
// facitlösaren (doubleDummyDeclarerRemaining) hur många stick spelföraren
// totalt når därifrån med perfekt spel. Gränserna räknas BAKIFRÅN (billigast
// först); första ställning som spränger nodbudgeten avbryter — tidigare
// gränser blir ärligt null i stället för att frysa. Sjunkande facit över ett
// stick = spelförarsidan tappade; stigande = motspelet släppte.
//
// Lösarens egen korrekthet testas i dds.test.ts — här testas bokföringen,
// budgetdegraderingen, claim-fallet och textraderna.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { contractResult, isComplete, legalCards, playCard, startPlay } from './play'
import type { Contract, PlayState } from './play'
import { botAuction, dealFromSeed } from './revisor'
import { analyzeDd, ddForStick, ddResultatRader, type DdAnalys } from './rond-dd'

/** Första seedade giv (frö 1..20) vars botauktion landar i ett kontrakt. */
function seedadGiv(): { deal: Deal; contract: Contract; state: PlayState } {
  let found: { deal: Deal; contract: Contract } | null = null
  for (let seed = 1; seed <= 20 && !found; seed++) {
    const deal = dealFromSeed(seed)
    const calls: ResolvedCall[] | null = botAuction(deal)
    const contract = calls && contractFromCalls(calls)
    if (contract) found = { deal, contract }
  }
  let state = startPlay(found!.deal, found!.contract)
  while (!isComplete(state)) state = playCard(state, legalCards(state, state.toAct)[0])
  return { ...found!, state }
}

describe('analyzeDd — bokföringen', () => {
  it('gränserna bildar null-prefix + värden, och sista gränsen är det spelade utfallet', () => {
    const { deal, contract, state } = seedadGiv()
    const analys = analyzeDd(deal, contract, state.completedTricks, 200_000)

    expect(analys.boundaries).toHaveLength(14)
    // Sista gränsen: alla kort spelade → facit = det faktiska utfallet.
    expect(analys.boundaries[13]).toBe(contractResult(state).declarerTricks)
    // Nullen ligger alltid FÖRST (avbrott bakifrån) — aldrig hål i mitten.
    const first = analys.fromBoundary
    expect(first).not.toBeNull()
    for (let k = 0; k < 14; k++) {
      if (k < first!) expect(analys.boundaries[k]).toBeNull()
      else {
        expect(analys.boundaries[k]).not.toBeNull()
        expect(analys.boundaries[k]!).toBeGreaterThanOrEqual(0)
        expect(analys.boundaries[k]!).toBeLessThanOrEqual(13)
      }
    }
  })

  it('tappade/vunna är exakt deltana mellan beräknade grannGränser', () => {
    const { deal, contract, state } = seedadGiv()
    const analys = analyzeDd(deal, contract, state.completedTricks, 200_000)

    const tappade: { trick: number; antal: number }[] = []
    const vunna: { trick: number; antal: number }[] = []
    for (let k = 1; k < analys.boundaries.length; k++) {
      const a = analys.boundaries[k - 1]
      const b = analys.boundaries[k]
      if (a === null || b === null) continue
      if (b < a) tappade.push({ trick: k, antal: a - b })
      if (b > a) vunna.push({ trick: k, antal: b - a })
    }
    expect(analys.tappade).toEqual(tappade)
    expect(analys.vunna).toEqual(vunna)
  })

  it('minimal budget: bara slutgränsen (0 kort kvar) beräknas, resten null — ingen krasch', () => {
    const { deal, contract, state } = seedadGiv()
    const analys = analyzeDd(deal, contract, state.completedTricks, 1)
    expect(analys.boundaries[13]).toBe(contractResult(state).declarerTricks)
    expect(analys.boundaries.slice(0, 13).every((b) => b === null)).toBe(true)
    expect(analys.fromBoundary).toBe(13)
    expect(analys.tappade).toEqual([])
    expect(analys.vunna).toEqual([])
  })

  it('claim: färre spelade stick → färre gränser, sista från claimläget', () => {
    const { deal, contract, state } = seedadGiv()
    const spelade = state.completedTricks.slice(0, 8) // claim efter 8 stick
    const analys = analyzeDd(deal, contract, spelade, 500_000)
    expect(analys.boundaries).toHaveLength(9)
    // Läget efter 8 stick (5 kort/hand) är billigt — sista gränsen ska ha värde.
    expect(analys.boundaries[8]).not.toBeNull()
  })
})

describe('ddForStick — stickraderna', () => {
  const analys: DdAnalys = {
    boundaries: [],
    fromBoundary: 0,
    tappade: [{ trick: 4, antal: 1 }],
    vunna: [{ trick: 7, antal: 2 }],
  }

  it('NS spelför: tappat är en läxa, upphämtat är beröm', () => {
    expect(ddForStick(analys, 4, 'NS')).toEqual({
      text: 'Facit: här tappade er sida ett stick.',
      ton: 'laxa',
    })
    expect(ddForStick(analys, 7, 'NS')).toEqual({
      text: 'Facit: motspelet släppte 2 stick här.',
      ton: 'berom',
    })
    expect(ddForStick(analys, 1, 'NS')).toBeNull()
  })

  it('ÖV spelför: samma händelser byter förtecken för användaren', () => {
    expect(ddForStick(analys, 4, 'EW')).toEqual({
      text: 'Facit: spelföraren spelade bort ett stick här.',
      ton: 'berom',
    })
    expect(ddForStick(analys, 7, 'EW')).toEqual({
      text: 'Facit: ert motspel släppte 2 stick här.',
      ton: 'laxa',
    })
  })
})

describe('ddResultatRader — domen i resultatkapitlet', () => {
  const bas = (over: Partial<DdAnalys>): DdAnalys => ({
    boundaries: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    fromBoundary: 0,
    tappade: [],
    vunna: [],
    ...over,
  })

  it('för tung analys ger en ärlig neutral rad', () => {
    const rader = ddResultatRader(bas({ fromBoundary: null }), 'NS', 10, null)
    expect(rader).toHaveLength(1)
    expect(rader[0].ton).toBe('neutral')
    expect(rader[0].text).toContain('för tung')
  })

  it('perfekt spelat (NS): beröm', () => {
    const rader = ddResultatRader(bas({}), 'NS', 10, null)
    expect(rader.some((r) => r.ton === 'berom' && r.text.includes('inget stick tappades'))).toBe(true)
  })

  it('stick tappades (NS): läxa med hänvisning till Spelföringen', () => {
    const analys = bas({
      boundaries: [11, 11, 11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      tappade: [{ trick: 3, antal: 1 }],
    })
    const rader = ddResultatRader(analys, 'NS', 10, null)
    const rad = rader.find((r) => r.ton === 'laxa')!
    expect(rad.text).toContain('med perfekt spel fanns 11 stick')
    expect(rad.text).toContain('Spelföringen')
  })

  it('motspelet släppte och ni plockade upp (NS): beröm', () => {
    const analys = bas({
      boundaries: [9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      vunna: [{ trick: 3, antal: 1 }],
    })
    const rader = ddResultatRader(analys, 'NS', 10, null)
    expect(rader.some((r) => r.ton === 'berom' && r.text.includes('mer än facit'))).toBe(true)
  })

  it('ÖV spelför och slutar under facit: beröm åt motspelet', () => {
    const analys = bas({
      boundaries: [10, 10, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      tappade: [{ trick: 2, antal: 1 }],
    })
    const rader = ddResultatRader(analys, 'EW', 9, null)
    expect(rader.some((r) => r.ton === 'berom' && r.text.includes('under sitt facit'))).toBe(true)
  })

  it('avkortad analys berättar var den når ifrån', () => {
    const analys = bas({
      boundaries: [null, null, null, null, null, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      fromBoundary: 5,
    })
    const rader = ddResultatRader(analys, 'NS', 10, null)
    expect(rader.some((r) => r.text.includes('når från stick 6'))).toBe(true)
  })

  it('manuell claim under facit: neutral upplysning', () => {
    const analys = bas({
      boundaries: [null, null, null, null, null, null, null, null, 11],
      fromBoundary: 8,
    })
    const rader = ddResultatRader(analys, 'NS', 10, { total: 10, auto: false })
    expect(
      rader.some((r) => r.ton === 'neutral' && r.text.includes('11 gick att säkra')),
    ).toBe(true)
  })
})
