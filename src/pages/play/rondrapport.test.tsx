// @vitest-environment jsdom
// Rondgenomgången (etapp 2): vyn visar tre hopfällbara kapitel — Budgivningen,
// Spelföringen, Resultatet — där Resultatet är öppet som default (domen först,
// fördjupning på begäran). Texterna kommer ur motormodulen rond-rapport.ts
// (facittestad för sig i rond-rapport.test.ts) — här testas att vyn renderar
// dem, att botmotiveringar visas vid tryck på kortet, och att reviewing-
// tillståndet i usePlayTable fungerar. Seedad giv, tider ur tempo.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { Card, Rank, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import type { Contract, PlayResult, Trick } from '../../lib/engine/play'
import { adjudicateClaim, autoClaimAvailable } from '../../lib/engine/claim'
import { dealFromSeed } from '../../lib/engine/revisor'
import { RondRapportView } from './RondRapport'
import { usePlayTable } from './usePlayTable'
import { ms } from './tempo'

vi.mock('../../lib/engine/claim', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/engine/claim')>()
  return {
    ...mod,
    adjudicateClaim: vi.fn(() => ({ verdict: 'godkänd' })),
    autoClaimAvailable: vi.fn(() => false),
  }
})

// DD-domen styrs per test (riktiga hooken testas i useDdAnalys.test.tsx —
// vyfixturens stick är inte spelbara ur den seedade given).
const ddMock = vi.hoisted(() => ({
  value: { analys: null as import('../../lib/engine/rond-dd').DdAnalys | null, running: false },
}))
vi.mock('./useDdAnalys', () => ({ useDdAnalys: () => ddMock.value }))

beforeEach(() => {
  vi.mocked(adjudicateClaim).mockClear()
  vi.mocked(autoClaimAvailable).mockReturnValue(false)
  ddMock.value = { analys: null, running: false }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.removeItem('learnbridge:playSpeed')
})

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank })

// 4♠ av Syd; ett stick där Öst stjäl. Förklaringstexterna hålls symbolfria i
// fixturen så att textletandet inte snubblar på SuitTexts symbol-spans.
const CONTRACT: Contract = { declarer: 'S', strain: 'spades', level: 4 }
const CALLS: ResolvedCall[] = [
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: 'P' },
  { seat: 'S', bid: '1S', rule: 'öppning', explanation: 'Öppning ett i spader, 12+ hp.' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: 'P' },
]
const TRICK_RUFF: Trick = {
  leader: 'W',
  cards: [
    { seat: 'W', card: c('hearts', '5') },
    { seat: 'N', card: c('hearts', 'A') },
    { seat: 'E', card: c('spades', '3') },
    { seat: 'S', card: c('hearts', '2') },
  ],
  winner: 'E',
}
const RESULT: PlayResult = { declarerTricks: 10, needed: 10, made: true, diff: 0 }

function renderVyn(over: Partial<Parameters<typeof RondRapportView>[0]> = {}) {
  return render(
    <RondRapportView
      deal={dealFromSeed(1)}
      contract={CONTRACT}
      calls={CALLS}
      tricks={[TRICK_RUFF]}
      result={RESULT}
      score={{ side: 'NS', points: 420, label: 'N/S +420' }}
      claimed={null}
      botReasons={{}}
      onBack={() => {}}
      onNewGame={() => {}}
      {...over}
    />,
  )
}

describe('rondgenomgången — vyn', () => {
  it('tre kapitel; Resultatet är öppet som default, de andra stängda', () => {
    const { container } = renderVyn()
    expect(screen.getByText('Rondgenomgång')).toBeTruthy()
    expect(screen.getByText('Budgivningen (6 bud)')).toBeTruthy()
    expect(screen.getByText('Spelföringen (1 stick)')).toBeTruthy()
    expect(screen.getByText('Resultatet')).toBeTruthy()

    // Kapitel-<details> i dokumentordning: bud, spel, resultat.
    const kapitel = Array.from(container.querySelectorAll(':scope > div > details'))
    expect(kapitel).toHaveLength(3)
    expect(kapitel.map((d) => (d as HTMLDetailsElement).open)).toEqual([false, false, true])
  })

  it('budkapitlet visar motorns förklaring och markerar Syds rad som "du"', () => {
    renderVyn()
    expect(screen.getByText('Öppning ett i spader, 12+ hp.')).toBeTruthy()
    expect(screen.getByText('Syd (du)')).toBeTruthy()
  })

  it('spelföringen visar stickrubriken och raderna ur motormodulen', () => {
    const { container } = renderVyn()
    expect(container.textContent).toContain('Stick 1 — Öst stal med 3')
    expect(container.textContent).toContain('Öst saknade hjärter och trumfade med 3')
    expect(container.textContent).toContain('Ställning: NS 0 – ÖV 1.')
  })

  it('tryck på ett botkort visar motiveringen; samma kort igen stänger', () => {
    renderVyn({
      botReasons: { spades3: { seat: 'E' as Seat, reason: 'Renons — trumfar in sticket.' } },
    })
    expect(screen.queryByText('Renons — trumfar in sticket.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Varför 3?' }))
    expect(screen.getByText('Renons — trumfar in sticket.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Varför 3?' }))
    expect(screen.queryByText('Renons — trumfar in sticket.')).toBeNull()
  })

  it('resultatet visar domen och poängraden', () => {
    const { container } = renderVyn()
    expect(container.textContent).toContain('hemma, exakt bud.')
    expect(container.textContent).toContain('Poäng: N/S +420.')
  })

  it('claim: spelföringen får en notis om att resten bokfördes', () => {
    const { container } = renderVyn({
      claimed: { total: 11, auto: false },
      result: { declarerTricks: 11, needed: 10, made: true, diff: 1 },
    })
    expect(container.textContent).toContain('Resten av sticken spelades aldrig')
    expect(container.textContent).toContain('Claim godkänd efter stick 1')
  })

  it('DD-domen under beräkning: "beräknas"-raden syns, inga facitrader', () => {
    ddMock.value = { analys: null, running: true }
    const { container } = renderVyn()
    expect(container.textContent).toContain('Facit-analysen beräknas')
    expect(container.textContent).not.toContain('Facit:')
  })

  it('DD-domen klar: ⚠ på tappade sticket och facitrad i resultatet', () => {
    ddMock.value = {
      running: false,
      analys: {
        boundaries: [11, 10],
        fromBoundary: 0,
        tappade: [{ trick: 1, antal: 1 }],
        vunna: [],
      },
    }
    const { container } = renderVyn()
    expect(container.textContent).toContain('⚠ Facit: här tappade er sida ett stick.')
    expect(container.textContent).toContain('med perfekt spel fanns 11 stick')
  })

  it('Tillbaka och Ny giv anropar sina callbacks', () => {
    const onBack = vi.fn()
    const onNewGame = vi.fn()
    renderVyn({ onBack, onNewGame })
    fireEvent.click(screen.getByRole('button', { name: '← Tillbaka' }))
    expect(onBack).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Ny giv →' }))
    expect(onNewGame).toHaveBeenCalledOnce()
  })
})

describe('rondgenomgången — reviewing-tillståndet i usePlayTable', () => {
  it('av som default; slås på/av med setReviewing när given är klar', async () => {
    vi.useFakeTimers()
    const deal = { ...dealFromSeed(1), dealer: 'W' as const }
    const contract: Contract = { declarer: 'W', strain: 'clubs', level: 1 }
    const { result } = renderHook(() => usePlayTable(deal, contract, []))

    expect(result.current.reviewing).toBe(false)

    // Avsluta given via claim-vägen (domen mockas som godkänd).
    act(() => result.current.onClaim(9))
    act(() => result.current.finishClaimReveal())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms('resultOutro', 'normal'))
    })
    expect(result.current.showResult).toBe(true)

    act(() => result.current.setReviewing(true))
    expect(result.current.reviewing).toBe(true)
    act(() => result.current.setReviewing(false))
    expect(result.current.reviewing).toBe(false)
  })
})
