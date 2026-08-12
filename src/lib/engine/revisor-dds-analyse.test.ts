// Låser AnalysePlayPBN-adapterns konventioner (Speldiagnosen steg 2) — de är
// odokumenterade i bridge-dds typer, så de spikas EMPIRISKT här innan speldomen
// (steg 3) får bygga på dem:
//   • trace-formatet: 2 tecken/kort utan separatorer, tian = "T",
//   • tricks[0] = DD-stick för SPELFÖRARSIDAN i utgångsläget (== tabellcellen),
//   • tricks[i] = DD-stick efter att kort i lagts; full giv → 49 värden
//     (DDS analyserar t.o.m. kort 48 — sista sticket är tvunget),
//   • tricks[48] = spelförarsidans FAKTISKT tagna stick (resten är forcerat).
// Körs i vanliga sviten — en trivial + en seedad giv, tumregelsbottar (inget MC).

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import { analyseSpel, dealToAnalysePbn, getDds, playTraceToPbn } from './revisor-dds'
import { spelaHelGiv } from './spela-giv'
import type { Contract, Trick } from './play'

// Billiga bottar: tumregler hela vägen (inget Monte-Carlo) → deterministiskt, ms.
const BILLIG = { maxCardsForMC: 0 }

/** Samma solida giv som revisor-dds.test.ts: N tar 13 topstick i NT. */
const SOLID: Deal = {
  id: 'solid',
  board: 1,
  dealer: 'E',
  vulnerability: 'none',
  hands: {
    N: parseHand('S:AKQJ H:AKQ D:AKQ C:AKQ'),
    E: parseHand('S:T987 H:J87 D:J87 C:J87'),
    S: parseHand('S:6543 H:T96 D:T96 C:T96'),
    W: parseHand('S:2 H:5432 D:5432 C:5432'),
  },
}

describe('AnalysePlayPBN-adaptern (revisor-dds-analyse)', () => {
  it('playTraceToPbn: 2 tecken per kort, ingen separator, tian = T', () => {
    const trick: Trick = {
      leader: 'E',
      cards: [
        { seat: 'E', card: { suit: 'spades', rank: 'A' } },
        { seat: 'S', card: { suit: 'hearts', rank: '10' } },
        { seat: 'W', card: { suit: 'diamonds', rank: '3' } },
        { seat: 'N', card: { suit: 'clubs', rank: 'Q' } },
      ],
      winner: 'E',
    }
    expect(playTraceToPbn([trick])).toBe('SAHTD3CQ')
  })

  it('dealToAnalysePbn: trumf-index, utspelaren = sätet efter spelföraren', () => {
    const contract: Contract = { declarer: 'N', strain: 'NT', level: 7 }
    const pbn = dealToAnalysePbn(SOLID, contract)
    expect(pbn.trump).toBe(4) // NT
    expect(pbn.first).toBe(1) // Ö (spelföraren N → utspelaren Ö)
    expect(pbn.currentTrickSuit).toEqual([])
    expect(pbn.remainCards.startsWith('N:AKQJ.AKQ.AKQ.AKQ ')).toBe(true)
  })

  it('solid giv (7NT av N): alla 49 värden är 13 — inga falska tapp', async () => {
    const dds = await getDds()
    const contract: Contract = { declarer: 'N', strain: 'NT', level: 7 }
    const res = spelaHelGiv(SOLID, contract, [], { smart: BILLIG })
    expect(res.declarerTricks).toBe(13)
    const trace = analyseSpel(dds, SOLID, contract, res.tricks)
    expect(trace).toHaveLength(49)
    expect(trace.every((t) => t === 13)).toBe(true)
  })

  it('seedad riktig giv: tricks[0] == tabellcellen, tricks[48] == faktiska sticken', async () => {
    const dds = await getDds()
    // Första fröet från M-seriens bas vars auktion landar i ett kontrakt.
    let deal: Deal | undefined, calls: ReturnType<typeof botAuction>, contract: Contract | null = null
    for (let seed = 20260721; !contract; seed++) {
      deal = dealFromSeed(seed)
      calls = botAuction(deal)
      contract = calls && contractFromCalls(calls)
    }
    const res = spelaHelGiv(deal!, contract, calls!, { smart: BILLIG })
    const trace = analyseSpel(dds, deal!, contract, res.tricks)
    expect(trace).toHaveLength(49)
    // Orientering + nollpunkt: startvärdet är exakt DD-tabellens cell för kontraktet.
    const { computeOracle } = await import('./revisor-dds')
    expect(trace[0]).toBe(computeOracle(dds, deal!).solve(contract.declarer, contract.strain))
    // Off-by-one + orientering i slutet: efter kort 48 är resten forcerat → DD = utfallet.
    expect(trace[48]).toBe(res.declarerTricks)
    expect(trace.every((t) => t >= 0 && t <= 13)).toBe(true)
  })
})
