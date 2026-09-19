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

/** Spela översta spelbara kortet via två-trycks-flödet (första trycket väljer
 *  färgen, andra trycket spelar — gäller alla kort, även singeltons). */
function playTopCard() {
  const btn = playableCards()[0]
  const label = btn.textContent
  fireEvent.click(btn)
  const again = playableCards().find((b) => b.textContent === label)!
  fireEvent.click(again)
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
    // Auto-claim aktuell → frågan efter andetaget (2026-09-19; Nord spelför =
    // DIN sida → "Du tar resten") → OK → pendingClaim → ALLA händer ska ligga
    // uppe, en i taget: Nord upptill, Syd nertill och BÅDA motståndarhögarna på
    // sina sidor (vridna kort = rotate-90/-rotate-90 finns bara i sidohögarna).
    vi.mocked(autoClaimAvailable).mockReturnValue(true)
    const { container } = renderTable()
    await advance(ms('claimBeat', 'normal'))
    expect(screen.getByText(/Du tar resten \(13 stick\) — claima\?/)).toBeInTheDocument()
    expect(screen.queryByText(/korten ligger uppe/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await advance(ms('revealStep', 'normal'))
    await advance(ms('revealStep', 'normal'))

    expect(screen.getByText(/korten ligger uppe/)).toBeInTheDocument()
    // Vem tar resten + hur många skrivs ut (ägarönskemål 2026-08-03): Nord är
    // spelförare och inget stick är spelat än → hela resten (13 stick).
    expect(screen.getByText(/Nord tar resten \(13 stick\)/)).toBeInTheDocument()
    expect(container.querySelectorAll('.rotate-90, .-rotate-90').length).toBe(26)
  })
})

describe('Träkarlen ligger som färgkolumner, spelföraren som kortrad (ägarbeslut 2026-09-15)', () => {
  // Ägarens observation: när Syd spelför ligger Nord-träkarlen i fyra lodräta
  // färgkolumner, men när Syd är träkarl låg Syds kort som en vågrät kortrad.
  // Regeln: ENDAST träkarlen ligger i kolumner, spelföraren ALLTID i kortrad —
  // Nord och Syd ligger aldrig i kolumner samtidigt (två kolumnhänder får inte
  // plats på en mobilskärm, uppmätt 2026-09-15).
  it('Nord spelför: Syd (träkarl) i kolumner, Nord i kortrad — och tvärtom', async () => {
    const { container, unmount } = renderTable()
    await advance(ms('botDelay', 'normal')) // Öst spelar ut → träkarlen läggs upp
    expect(container.querySelector('[data-kolumner="S"]')).not.toBeNull()
    expect(container.querySelector('[data-kolumner="N"]')).toBeNull()
    // Du styr fortfarande Syds kort (spelmodellen är oförändrad).
    expect(playableCards().length).toBeGreaterThan(0)
    unmount()

    // Syd spelför → Nord är träkarl (kolumner), Syd är din spelande hand (kortrad).
    const { container: c2 } = render(
      <PlayTable
        deal={DEAL}
        contract={{ ...CONTRACT, declarer: 'S' }}
        calls={[]}
        onNewGame={() => {}}
        bidHelp={false}
        onToggleBidHelp={() => {}}
      />,
    )
    await advance(ms('botDelay', 'normal')) // Väst spelar ut
    expect(c2.querySelector('[data-kolumner="N"]')).not.toBeNull()
    expect(c2.querySelector('[data-kolumner="S"]')).toBeNull()
  })
})

describe('Svävande menyknappar: ⋮/i flyttar ner under Nords kortrad när raden är för bred (ägarbeslut 2026-09-15)', () => {
  // jsdom har ingen layout — rektanglarna mockas per element: Nords kortrad
  // (`data-kortrad="N"`) och knappstapeln (`data-bordsmeny`). Måtten är de
  // uppmätta från en 375 px-skärm: raden 13→362 px bred, knapparna vid x 332.
  let radRight = 362
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const rect = (left: number, top: number, right: number, bottom: number) =>
        ({ left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top, toJSON: () => ({}) }) as DOMRect
      if (this.matches('[data-kortrad="N"]')) return rect(13, 13, radRight, 109)
      if (this.matches('[data-bordsmeny-ankare]')) return rect(332, 9, 364, 79) // knapparnas naturliga läge
      return rect(0, 0, 0, 0)
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    radRight = 362
  })
  const meny = () => document.querySelector('[data-bordsmeny]') as HTMLElement

  it('sänks under raden när raden når in under knapparna, och svävar tillbaka när handen krympt', async () => {
    renderTable() // Nord spelför → Nord i kortrad upptill
    await advance(ms('botDelay', 'normal'))
    // Raden slutar vid 362 > knapparnas vänsterkant 332 → sänkt: knapparnas
    // överkant läggs 8 px under radens underkant (109 + 8 − 9 = 108).
    expect(meny().style.transform).toBe('translateY(108px)')
    expect(meny().dataset.sankt).toBe('1')

    // Handen har krympt (raden slutar vid 290 < 332) → tillbaka upp.
    radRight = 290
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(meny().style.transform).toBe('translateY(0px)')
    expect(meny().dataset.sankt).toBeUndefined()
  })

  it('rör inte knapparna när Syd spelför (Nord-träkarlen ligger i kolumner)', async () => {
    render(
      <PlayTable
        deal={DEAL}
        contract={{ ...CONTRACT, declarer: 'S' }}
        calls={[]}
        onNewGame={() => {}}
        bidHelp={false}
        onToggleBidHelp={() => {}}
      />,
    )
    await advance(ms('botDelay', 'normal'))
    expect(meny().style.transform).toBe('translateY(0px)')
  })
})
