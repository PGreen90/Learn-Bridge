// Facit för nattgranskningens VERSIONSMEDVETNA dom (systemkontrollen 2026-09-20).
//
// Buggen: granskningen spelade om gårdagens inskick med den motor som låg på
// main NÄR GRANSKNINGEN KÖRDE. Inskick spelade före en spelmotor-deploy samma
// dag (bottarnas nattspel, tidiga människor) avvek då från den NYA motorn och
// flyttades felaktigt till 'granskning' — 29 ärliga inskick på fyra dagar
// (09-12/13/17/18, exakt dagarna med spelmotor-commits).
//
// Lagningen: ett inskick flaggas bara om INGEN motorversion som varit live
// (stämpeln i inskicket först, sedan de senaste versionerna på main) skulle ha
// lagt de spelade botkorten.

import { describe, expect, it } from 'vitest'
import type { Card, Seat } from '../../types/bridge'
import { contractFromCalls } from './auction-live'
import { botAuction } from './revisor'
import { dealFromSeed, mulberry32 } from './deal'
import { legalCards, playCard, startPlay, type PlayState } from './play'
import { botCardSmart } from './play-bot'
import { botDecisionSeed, playIndexOf } from './play-seed'
import {
  botAvvikelser,
  domOverVersioner,
  giltigMotorstampel,
  type GranskadPayload,
  type Omprovsinskick,
  type Versionsprov,
} from './tavlingsgranskning'

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
const SHA_C = 'c'.repeat(40)

/** Början av en botspelad giv: auktionen + de sex första korten, lagda av den
 *  riktiga motorn på exakt nattgranskningens vis (frö per beslutsindex). Bara
 *  sex kort — hela givar med riktiga motorn är för tungt för deploygrinden. */
let cachad: { givSeed: number; inskick: GranskadPayload } | null = null
function botspeladGiv() {
  if (cachad) return cachad
  for (let givSeed = 20260920; givSeed < 20260960; givSeed++) {
    const deal = dealFromSeed(givSeed, 1)
    const history = botAuction(deal)
    const contract = history && contractFromCalls(history)
    if (!history || !contract) continue
    let state = startPlay(deal, contract)
    const plays: Card[] = []
    for (let i = 0; i < 6; i++) {
      const index = playIndexOf(state.completedTricks.length, state.currentTrick.length)
      const rng = mulberry32(botDecisionSeed(777, index))
      const kort = botCardSmart(state, state.toAct, history, { rng })
      plays.push(kort)
      state = playCard(state, kort)
    }
    return (cachad = { givSeed, inskick: { history, plays } })
  }
  throw new Error('hittade ingen botbudad giv med kontrakt')
}

describe('botAvvikelser — omspelningen mot EN motor', () => {
  it('motorns egna kort ger inga avvikelser', () => {
    const { givSeed, inskick } = botspeladGiv()
    const deal = dealFromSeed(givSeed, 1)
    expect(botAvvikelser(deal, 777, inskick, botCardSmart)).toEqual([])
  })

  it('en ANNAN motor (versionsbyte) ger avvikelser på botsätena', () => {
    const { givSeed, inskick } = botspeladGiv()
    const deal = dealFromSeed(givSeed, 1)
    // "Äldre motor": lägger alltid det sista lagliga kortet.
    const annanMotor = (state: PlayState, seat: Seat): Card => {
      const lagliga = legalCards(state, seat)
      return lagliga[lagliga.length - 1]
    }
    const avvikelser = botAvvikelser(deal, 777, inskick, annanMotor)
    expect(avvikelser.length).toBeGreaterThan(0)
    expect(avvikelser[0]).toMatch(/^kort \d+ \([NESW]\): spelat .+, motorn .+$/)
  })

  it('trasig payload rapporteras, kraschar inte', () => {
    const deal = dealFromSeed(20260920, 1)
    expect(botAvvikelser(deal, 777, null, botCardSmart)).toEqual([
      'payload saknas/trasig — kan inte spelas om',
    ])
  })
})

describe('giltigMotorstampel', () => {
  it('godtar bara en hel commit-SHA (40 hex, gemener)', () => {
    expect(giltigMotorstampel(SHA_A)).toBe(true)
    expect(giltigMotorstampel('037403b')).toBe(false)
    expect(giltigMotorstampel('dev')).toBe(false)
    expect(giltigMotorstampel('A'.repeat(40))).toBe(false)
    expect(giltigMotorstampel(`${'a'.repeat(39)};`)).toBe(false)
    expect(giltigMotorstampel(undefined)).toBe(false)
    expect(giltigMotorstampel(42)).toBe(false)
  })
})

describe('domOverVersioner — flaggas bara om INGEN live-version lagt korten', () => {
  const inskick = (id: string, motor?: string): Omprovsinskick => ({
    id,
    board: 3,
    headAvvikelser: ['kort 3 (W): spelat JS, motorn 8S'],
    motor,
  })

  /** Provare: `matchar[sha]` = de inskick-id:n vars kort den versionen lagt. */
  const provare = (matchar: Record<string, string[]>, havererar: string[] = []) => {
    const provade: string[] = []
    const prova: Versionsprov = async (sha, lista) => {
      provade.push(sha)
      if (havererar.includes(sha)) return 'fel'
      return Object.fromEntries(
        lista.map((i) => [i.id, (matchar[sha] ?? []).includes(i.id) ? [] : ['kort 3 (W): avviker']]),
      )
    }
    return { prova, provade }
  }

  it('BUGGEN: spelat med äldre motor (stämplad) → frias, flyttas INTE', async () => {
    const { prova, provade } = provare({ [SHA_A]: ['x'] })
    const dom = await domOverVersioner([inskick('x', SHA_A)], [SHA_B], new Set([SHA_A, SHA_B]), prova)
    expect(dom.flytta).toEqual([])
    expect(dom.friade).toEqual([{ id: 'x', sha: SHA_A }])
    // Stämpeln prövas FÖRST — kandidaterna behövdes aldrig.
    expect(provade).toEqual([SHA_A])
  })

  it('ostämplat inskick (äldre klient/historik) frias av en kandidatversion', async () => {
    const { prova } = provare({ [SHA_B]: ['x'] })
    const dom = await domOverVersioner([inskick('x')], [SHA_A, SHA_B], new Set([SHA_A, SHA_B]), prova)
    expect(dom.flytta).toEqual([])
    expect(dom.friade).toEqual([{ id: 'x', sha: SHA_B }])
  })

  it('ingen version lade korten → flyttas (riktig avvikelse)', async () => {
    const { prova } = provare({})
    const dom = await domOverVersioner([inskick('x', SHA_A)], [SHA_B], new Set([SHA_A, SHA_B]), prova)
    expect(dom.flytta.map((f) => f.id)).toEqual(['x'])
    expect(dom.flytta[0].provade).toBe(2)
  })

  it('påhittad stämpel (inte en commit på main) ger ingen genväg förbi granskningen', async () => {
    const { prova, provade } = provare({})
    const dom = await domOverVersioner([inskick('x', SHA_C)], [SHA_B], new Set([SHA_B]), prova)
    expect(provade).toEqual([SHA_B])
    expect(dom.flytta.map((f) => f.id)).toEqual(['x'])
  })

  it('havererat omprov → "ej jämförbart" i rapporten, aldrig en flytt på osäker grund', async () => {
    const { prova } = provare({}, [SHA_A])
    const dom = await domOverVersioner([inskick('x', SHA_A)], [], new Set([SHA_A]), prova)
    expect(dom.flytta).toEqual([])
    expect(dom.ejJamforbara.map((e) => e.id)).toEqual(['x'])
  })

  it('taket på antal versioner hålls (nattjobbets tidsbudget)', async () => {
    const kandidater = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => c.repeat(40))
    const { prova, provade } = provare({})
    await domOverVersioner([inskick('x')], kandidater, new Set(kandidater), prova, 4)
    expect(provade).toEqual(kandidater.slice(0, 4))
  })

  it('friade inskick prövas inte om mot fler versioner', async () => {
    const listor: string[][] = []
    const prova: Versionsprov = async (sha, lista) => {
      listor.push(lista.map((i) => i.id))
      return Object.fromEntries(lista.map((i) => [i.id, sha === SHA_A && i.id === 'x' ? [] : ['avviker']]))
    }
    await domOverVersioner([inskick('x'), inskick('y')], [SHA_A, SHA_B], new Set([SHA_A, SHA_B]), prova)
    expect(listor).toEqual([['x', 'y'], ['y']])
  })
})
