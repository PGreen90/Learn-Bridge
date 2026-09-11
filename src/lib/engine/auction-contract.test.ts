import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-contract'

// `finalContract`/`turnsToCalls`/`dealForPlay` revs i motorbytets etapp 5 session B
// (2026-09-11) — de var det gamla manuslagrets brygga. Kontrakthärledningen bor kvar
// i `contractFromCalls` (används av budlådan), och fallen nedan testar den direkt.
const c = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('contractFromCalls – slutkontrakt ur en budföljd', () => {
  it('saknar kontraktsbud (bara passar) → null', () => {
    expect(contractFromCalls([c('S', 'P')])).toBeNull()
  })

  it('1NT passat ut → 1 NT av öppnaren', () => {
    expect(contractFromCalls([c('S', '1NT'), c('N', 'P')])).toEqual({ declarer: 'S', strain: 'NT', level: 1 })
  })

  it('spelförare = den som FÖRST nämnde slutfärgen (svararen)', () => {
    // S 1C – N 1S – S 2S (höjning): spader ägs av N/S, först nämnd av N.
    expect(contractFromCalls([c('S', '1C'), c('N', '1S'), c('S', '2S'), c('N', 'P')]))
      .toEqual({ declarer: 'N', strain: 'spades', level: 2 })
  })

  it('inkliv: motståndaren spelar slutkontraktet', () => {
    // S 1H – V 2D (inkliv) – passat ut: 2D av Väst (Ö/V).
    expect(contractFromCalls([c('S', '1H'), c('W', '2D'), c('N', 'P')]))
      .toEqual({ declarer: 'W', strain: 'diamonds', level: 2 })
  })

  it('dubbling gäller sista kontraktsbudet', () => {
    expect(contractFromCalls([c('S', '4H'), c('W', 'X'), c('N', 'P'), c('E', 'P'), c('S', 'P')]))
      .toEqual({ declarer: 'S', strain: 'hearts', level: 4, doubled: 'X' })
  })
})
