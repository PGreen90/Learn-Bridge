// @vitest-environment jsdom
// Röktest för spelvyn (etapp 4B): bud- och spelfasen ska rendera ur ett
// serverläge (mockat backend-lager). Spelmotoriken vaktas av bord-motor.test.ts
// (servern) och bord-projektion.test.ts (klienten) — här verifieras att vyn
// faktiskt monterar med de riktiga presentationskomponenterna, eftersom bordet
// inte kan provspelas lokalt (serverfunktionerna finns bara i molnet).

import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Card, Seat } from '../../types/bridge'
import type { BordHandelse } from '../../lib/backend/bord'
import { dealFromSeed } from '../../lib/engine/revisor'
import { isComplete, legalCards, playCard, startPlay, type Contract } from '../../lib/engine/play'

const kort = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

/** 13 giltiga kort till min hand. */
const MIN_HAND: Card[] = [
  kort('spades', 'A'),
  kort('spades', 'K'),
  kort('spades', '7'),
  kort('hearts', 'Q'),
  kort('hearts', '8'),
  kort('hearts', '3'),
  kort('diamonds', 'J'),
  kort('diamonds', '9'),
  kort('diamonds', '4'),
  kort('clubs', '10'),
  kort('clubs', '6'),
  kort('clubs', '5'),
  kort('clubs', '2'),
]

let seq = 0
const h = (typ: string, seat: Seat | null, data: unknown, giv = 1): BordHandelse => ({
  seq: ++seq,
  giv,
  typ,
  seat,
  data: data as Record<string, unknown>,
})

/** Det mockade serverläget — sätts per test före render. */
let svarEvents: BordHandelse[] = []
let svarBegaranden: Array<{ stol: Seat; slag: 'paus' | 'lamna'; namn: string | null }> = []

vi.mock('../../lib/backend/bord', () => ({
  hamtaBordLage: vi.fn(async () => ({
    ok: true,
    meta: {
      id: 'bord-id',
      kod: 'ABC234',
      status: 'spelar',
      spelform: 'full',
      givar: 4,
      tempo: 'normal',
      privat: false,
      aktuellGiv: 1,
      duArAgare: true,
      dinStol: 'S',
    },
    stolar: (['N', 'E', 'S', 'W'] as Seat[]).map((stol) => ({
      stol,
      typ: stol === 'S' ? 'manniska' : 'bot',
      namn: stol === 'S' ? 'Patrik' : null,
      status: 'aktiv',
    })),
    events: svarEvents,
    senasteSeq: svarEvents.length ? svarEvents[svarEvents.length - 1].seq : 0,
    dinHand: MIN_HAND,
    stallning: { ns: 0, ew: 0 },
    givStartSeq: 1,
    begaranden: svarBegaranden,
  })),
  bordHjartslag: vi.fn(async () => ({ ok: true, senasteSeq: 0, events: [] })),
  skickaDrag: vi.fn(async () => ({ ok: true, events: [], senasteSeq: 0 })),
  prenumereraBordHandelser: vi.fn(() => () => {}),
}))

import { BordSpel } from './BordSpel'

afterEach(() => {
  cleanup()
  svarBegaranden = []
})

function rendera() {
  return render(
    <MemoryRouter>
      <BordSpel kod="ABC234" minStol="S" tempo="normal" givar={4} />
    </MemoryRouter>,
  )
}

describe('BordSpel — röktest', () => {
  test('budfasen renderar: budlådan, min hand och namnraden', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
    ]
    rendera()
    expect(await screen.findByText('PASS')).toBeTruthy() // budlådan
    expect(screen.getByText(/Giv 1 av 4/)).toBeTruthy() // givbrickan
    expect(screen.getByText('HCP 10')).toBeTruthy() // ess+kung+dam+knekt i MIN_HAND
    // 2026-09-24 ("borden = tävlingen"): ingen namnrad på duken — budfasen har
    // exakt spelbordets placeringar. Vem som sitter var bor i ⋮-menyn, där
    // också budstödet finns (samma val som spelbordet).
    expect(screen.queryByText(/Patrik \(du\)/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Meny'))
    expect(screen.getByText(/Patrik \(du\)/)).toBeTruthy()
    expect(screen.getByText('Budstöd')).toBeTruthy()
  })

  test('budfasen: "[Stol] tänker …" när en bot är i tur och loggen står still (2026-09-24)', async () => {
    seq = 0
    // Nord (bot) är giv och har inte bjudit än — servern räknar / hjärtslaget driver.
    svarEvents = [h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' })]
    rendera()
    expect(await screen.findByText(/Nord tänker …/)).toBeTruthy()
  })

  test('budfasen: ingen tänker-bricka när det är MIN tur', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
    ]
    rendera()
    expect((await screen.findAllByText('PASS')).length).toBeGreaterThan(0) // budlådan + Östs pass i auktionen
    expect(screen.queryByText(/tänker …/)).toBeNull()
  })

  test('4C: ägaren ser godkännande-bannern för en väntande begäran', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
    ]
    svarBegaranden = [{ stol: 'E', slag: 'paus', namn: 'Anna' }]
    rendera()
    expect(await screen.findByText(/ber om paus/)).toBeTruthy()
    expect(screen.getByText('Godkänn')).toBeTruthy()
    expect(screen.getByText('Neka')).toBeTruthy()
  })

  test('spelfasen renderar: stickräknaren och min klickbara hand', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
    ]
    const { container } = rendera()
    expect(await screen.findByText(/Stick: Ni 0 – De 0/)).toBeTruthy()
    expect(screen.getByText(/Giv 1\/4/)).toBeTruthy()
    // 2026-09-24: spelfasen ritas genom spelbordets ram — hörnknapparna ⋮ och i,
    // bricka/zon-hörnet och Syd-listen är samma som på spelbordet.
    expect(screen.getByLabelText('Meny')).toBeTruthy()
    expect(screen.getByText(/Bricka 1/)).toBeTruthy()
    expect(container.querySelector('[data-bordsmeny-ankare]')).not.toBeNull()
    // Vem som sitter var: i ⓘ-overlayen (som auktionen och förra sticket).
    fireEvent.click(screen.getByLabelText('Budgivningen och förra sticket'))
    expect(screen.getByText(/Patrik \(du\)/)).toBeTruthy()
  })

  test('spelfasen: "◀ Alla färger" när en färg är lyft — samma tvåtrycksväg som spelbordet', async () => {
    seq = 0
    // Jag (Syd) spelför 1♠; Väst ska spela ut — men här är det redan MIN tur
    // (Väst spelade ut, träkarlen lagd) så mina kort är klickbara.
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'S', vulnerability: 'none' }),
      h('bud', 'S', { bid: '1S' }),
      h('bud', 'W', { bid: 'P' }),
      h('bud', 'N', { bid: 'P' }),
      h('bud', 'E', { bid: 'P' }),
      h('kort', 'W', { card: kort('hearts', 'K') }),
      h('trakarl', 'N', { hand: MIN_HAND }),
    ]
    const { container } = rendera()
    await screen.findByText(/Stick: Ni 0 – De 0/)
    expect(screen.queryByText('◀ Alla färger')).toBeNull()
    const spelbart = container.querySelector<HTMLButtonElement>('[data-spelbart]')
    expect(spelbart).not.toBeNull()
    fireEvent.click(spelbart!)
    expect(await screen.findByText('◀ Alla färger')).toBeTruthy()
    fireEvent.click(screen.getByText('◀ Alla färger'))
    expect(screen.queryByText('◀ Alla färger')).toBeNull()
  })

  test('4D läge 1: facit-genomgången renderar jämförelsen + nästa giv', async () => {
    seq = 0
    const hands = { N: MIN_HAND, E: MIN_HAND, S: MIN_HAND, W: MIN_HAND }
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('facit', null, {
        hands,
        contract: { declarer: 'N', strain: 'spades', level: 1 },
        // En avvikande systemlinje → jämförelsepanelen ska visas.
        systemlinje: [
          { seat: 'N', bid: '1NT' },
          { seat: 'E', bid: 'P' },
          { seat: 'S', bid: 'P' },
          { seat: 'W', bid: 'P' },
        ],
      }),
    ]
    rendera()
    expect(await screen.findByText('Er budgivning')).toBeTruthy()
    expect(screen.getByText('Motorns linje')).toBeTruthy()
    expect(screen.getByText('Nästa giv →')).toBeTruthy()
  })

  test('giv-klar renderar reveal + nästa giv-knappen', async () => {
    seq = 0
    const hands = { N: MIN_HAND, E: MIN_HAND, S: MIN_HAND, W: MIN_HAND }
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('giv-klar', null, {
        hands,
        contract: { declarer: 'N', strain: 'spades', level: 1 },
        passadUt: false,
        declarerTricks: 8,
        nsScore: 110,
        stallning: { ns: 110, ew: 0 },
      }),
    ]
    rendera()
    expect(await screen.findByText('Nästa giv →')).toBeTruthy()
    expect(screen.getByText(/8 stick/)).toBeTruthy()
    expect(screen.getByText(/Ni \+110/)).toBeTruthy()
    // Felrapporten (ägarönskemål 2026-08-17) nås från giv-klar-vyn.
    expect(screen.getByText(/Rapportera given/)).toBeTruthy()
    // Utan spelade kort finns ingen genomgång att öppna.
    expect(screen.queryByText(/Genomgång av given/)).toBeNull()
  })

  test('etapp 3: claim-förslaget ger mig dialogen, "Spela klart" skickar nej', async () => {
    seq = 0
    // Öst spelför 1♠ (träkarl Väst) → jag (Syd) är motspelare på utspel: jag ska svara.
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: 'P' }),
      h('bud', 'E', { bid: '1S' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('bud', 'N', { bid: 'P' }),
      h('claim-forslag', 'E', { total: 13, stol: 'E' }),
    ]
    rendera()
    // Icke-modal fråga med väderstrecket (2026-09-19) — jag är alltid Syd visuellt.
    expect(await screen.findByText(/Öst gör anspråk på resten \(13 stick\)/)).toBeTruthy()
    const { skickaDrag } = await import('../../lib/backend/bord')
    fireEvent.click(screen.getByText('Spela klart'))
    expect(vi.mocked(skickaDrag)).toHaveBeenCalledWith('ABC234', expect.any(Number), { typ: 'claim-svar', ok: false })
  })

  test('etapp 3: har jag svarat visas väntanraden, och giv-klar efter claim visar notisen', async () => {
    seq = 0
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: 'P' }),
      h('bud', 'E', { bid: '1S' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('bud', 'N', { bid: 'P' }),
      h('claim-forslag', 'E', { total: 13, stol: 'E' }),
      h('claim-svar', 'S', { ok: true }),
    ]
    rendera()
    expect(await screen.findByText(/Öst gör anspråk på resten \(13 stick\) — väntar på att alla svarar/)).toBeTruthy()
    expect(screen.queryByText('Spela klart')).toBeNull()
    cleanup()

    seq = 0
    const hands = { N: MIN_HAND, E: MIN_HAND, S: MIN_HAND, W: MIN_HAND }
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: 'P' }),
      h('bud', 'E', { bid: '1S' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('bud', 'N', { bid: 'P' }),
      h('claim-forslag', 'E', { total: 13, stol: 'E' }),
      h('claim-svar', 'S', { ok: true }),
      h('giv-klar', null, {
        hands,
        contract: { declarer: 'E', strain: 'spades', level: 1 },
        passadUt: false,
        declarerTricks: 13,
        nsScore: -260,
        stallning: { ns: 0, ew: 260 },
        claim: { total: 13, stol: 'E' },
      }),
    ]
    rendera()
    expect(await screen.findByText(/Claim: spelföraren tog resten av sticken utan spel \(13 stick totalt\)/)).toBeTruthy()
  })

  test('Syd träkarl (2026-09-15): min hand ligger som färgkolumner som Nords, utan klickbara kort', async () => {
    seq = 0
    // Nord spelför 1♠ → jag (Syd) är träkarl; Öst har spelat ut och träkarlen
    // är upplagd. Ägarönskemål: Syd-träkarlen ska se ut som Nord-träkarlen
    // (färgkolumner), inte som en kortrad — och partnern spelar korten, så
    // inget av dem får vara klickbart hos mig.
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: '1S' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: 'P' }),
      h('bud', 'W', { bid: 'P' }),
      h('kort', 'E', { card: kort('hearts', 'K') }),
      h('trakarl', 'S', { hand: MIN_HAND }),
    ]
    const { container } = rendera()
    expect(await screen.findByText(/Du är träkarl/)).toBeTruthy()
    expect(container.querySelector('[data-kolumner="S"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-spelbart]').length).toBe(0)
  })

  test('etapp 1 (2026-09-14): genomgången av given nås från giv-klar-vyn och går att stänga', async () => {
    seq = 0
    const deal = { ...dealFromSeed(7), dealer: 'N' as const }
    const contract: Contract = { declarer: 'N', strain: 'NT', level: 3 }
    svarEvents = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'ns' }),
      h('bud', 'N', { bid: '1NT' }),
      h('bud', 'E', { bid: 'P' }),
      h('bud', 'S', { bid: '3NT' }),
      h('bud', 'W', { bid: 'P' }),
      h('bud', 'N', { bid: 'P' }),
      h('bud', 'E', { bid: 'P' }),
    ]
    let st = startPlay(deal, contract)
    while (!isComplete(st)) {
      const card = legalCards(st, st.toAct)[0]
      svarEvents.push(h('kort', st.toAct, { card }))
      st = playCard(st, card)
    }
    svarEvents.push(
      h('giv-klar', null, {
        hands: deal.hands,
        contract,
        passadUt: false,
        declarerTricks: st.tricksNS,
        nsScore: 400,
        stallning: { ns: 400, ew: 0 },
        // Etapp 2: serverns DD-facit följer med giv-klar.
        dd: { tabell: [[7, 6, 7, 6], [8, 5, 8, 5], [6, 7, 6, 7], [5, 8, 5, 8], [9, 4, 9, 4]], parNS: 400, parKontrakt: ['3N-NS'] },
      }),
    )
    rendera()
    const knapp = await screen.findByText(/Genomgång av given/)
    // DD-jämförelsen i giv-klar-vyn: facit 9 stick i 3NT av N, par 3NT NS.
    expect(screen.getByText(/Facit \(perfekt spel\)/)).toBeTruthy()
    expect(screen.getByText(/9 stick/)).toBeTruthy()
    expect(screen.getByText(/Par: 3NT NS \(NS \+400\)/)).toBeTruthy()
    fireEvent.click(knapp)
    expect(await screen.findByText(/Genomgång av giv 1 av/)).toBeTruthy()
    expect(screen.getByText(/Par: 3NT NS/)).toBeTruthy()
    expect(screen.getByText(/Stega sticken med pilarna/)).toBeTruthy()
    fireEvent.click(screen.getByText('← Tillbaka'))
    expect(await screen.findByText(/Genomgång av given/)).toBeTruthy()
    expect(screen.getByText(/Rapportera given/)).toBeTruthy()
  })
})
