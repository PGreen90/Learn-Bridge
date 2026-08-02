// @vitest-environment jsdom
// Syd som träkarl (felrapport 2026-08-02): när NORD vinner budgivningen är du
// (Syd) träkarl — men enligt spelmodellen styr du BÅDA NS-händerna (controls i
// common.tsx), så Nords öppna hand MÅSTE ritas och gå att spela precis som när
// Nord är träkarl. Faceliften pass 2 (2026-07-31) bytte `northOpen=isFaceUp('N')`
// mot `dummyAtTop = dummy==='N'` och tappade fallet → Nords hand ritades aldrig,
// ingen bot spelade åt Nord och given frös på Nords tur. Samma refaktorering
// tappade claim-revealens "alla händer läggs upp" (V/Ö-högarna ritades bara för
// själva träkarlen). Facit-testerna här skrevs FÖRE fixen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { dealFromSeed } from '../../lib/engine/revisor'
import type { Contract } from '../../lib/engine/play'
import { autoClaimAvailable } from '../../lib/engine/claim'
import { PlayTable } from '../Play'
import { ms } from './tempo'

// Auto-claim-detektorn mockas styrbart (claim-DOMEN testas i claim.test.ts);
// stickräkningen i claim-modulen behålls äkta.
vi.mock('../../lib/engine/claim', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../lib/engine/claim')>()
  return { ...mod, autoClaimAvailable: vi.fn(() => false) }
})

// Nord spelar 2♣ → Öst (bot) spelar ut, SYD är träkarl men du styr både S och N.
const DEAL = { ...dealFromSeed(1), dealer: 'N' as const }
const CONTRACT: Contract = { declarer: 'N', strain: 'clubs', level: 2 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(autoClaimAvailable).mockReturnValue(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.removeItem('learnbridge:playSpeed')
  localStorage.removeItem('learnbridge:autoClaim')
})

async function advance(msToRun: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(msToRun)
  })
}

function renderTable() {
  return render(
    <PlayTable
      deal={DEAL}
      contract={CONTRACT}
      calls={[]}
      onNewGame={() => {}}
      bidHelp={false}
      onToggleBidHelp={() => {}}
    />,
  )
}

/** Spelbara kort = PlayingCard-knappar; namnet är korttexten (t.ex. "9♣♣"). */
const CARD_NAME = /^(10|[AKQJ2-9])[♠♥♦♣]/
const playableCards = () => screen.queryAllByRole('button', { name: CARD_NAME })

/** Spela översta spelbara kortet via två-trycks-flödet (andra trycket = spela;
 *  en singelton spelas redan på första trycket och behöver inget andra). */
function playTopCard() {
  const btn = playableCards()[0]
  const label = btn.textContent
  fireEvent.click(btn)
  const again = playableCards().find((b) => b.textContent === label)
  if (again) fireEvent.click(again)
}

describe('Syd träkarl — Nord spelförare styrs av dig och given fastnar inte', () => {
  it('Nords kort ligger uppe, går att spela och första sticket bokförs', async () => {
    renderTable()

    // Öst (bot) spelar ut på sin timer.
    await advance(ms('botDelay', 'normal'))
    expect(screen.getByRole('button', { name: /Varför spelade Öst/ })).toBeInTheDocument()

    // Syd (träkarlen — men din hand): kort ska vara spelbara.
    expect(playableCards().length).toBeGreaterThan(0)
    playTopCard()

    // Väst (bot) följer.
    await advance(ms('botDelay', 'normal'))
    expect(screen.getByRole('button', { name: /Varför spelade Väst/ })).toBeInTheDocument()

    // FACIT (buggen): nu är det NORDS tur. Ingen bot spelar åt Nord (du styr
    // båda NS-händerna) → Nords öppna hand MÅSTE ritas med spelbara kort,
    // annars fryser given här för alltid.
    expect(playableCards().length).toBeGreaterThan(0)
    playTopCard()

    // Fjärde kortet lades → sticket är bokfört (NS + ÖV = 1).
    const strip = screen.getByText(/NS:\d+ ÖV:\d+/).textContent ?? ''
    const [, ns, ev] = strip.match(/NS:(\d+) ÖV:(\d+)/) ?? []
    expect(Number(ns) + Number(ev)).toBe(1)
  })

  it('claim-revealen lägger upp ÄVEN de dolda motståndarhänderna (V+Ö-högarna)', async () => {
    // Auto-claim slår till direkt → pendingClaim → ALLA händer ska ligga uppe:
    // Nord upptill, Syd nertill och BÅDA motståndarhögarna på sina sidor
    // (vridna kort = rotate-90/-rotate-90 finns bara i sidohögarna).
    vi.mocked(autoClaimAvailable).mockReturnValue(true)
    const { container } = renderTable()
    await advance(0)

    expect(screen.getByText(/korten ligger uppe/)).toBeInTheDocument()
    expect(container.querySelectorAll('.rotate-90, .-rotate-90').length).toBe(26)
  })
})
