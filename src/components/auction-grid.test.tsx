// @vitest-environment jsdom
// Förklarings-popupen i auktionsvyn: full vy (default) mot minimal vy
// (Budstöd AV, ägarbeslut 2026-07-28). Minimal = bud-chip + kort regelnamn +
// ALERT-märket (alerter finns även vid riktigt bord) — kravmärket och den
// långa förklaringstexten döljs.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AuctionGrid } from './AuctionGrid'
import type { ResolvedCall } from '../lib/bidding'

afterEach(cleanup)

// 'Jacoby 2NT' är både alertbar (alerts.ts) och utgångskrav (rules.ts) —
// perfekt för att skilja vad som ska synas i respektive läge.
const JACOBY: ResolvedCall[] = [
  { seat: 'N', bid: '1H', rule: 'öppning', explanation: 'Öppning 1 hjärter.' },
  { seat: 'E', bid: 'P' },
  { seat: 'S', bid: '2NT', rule: 'Jacoby 2NT', explanation: 'Lång testförklaring om Jacoby.' },
]

/** Klicka upp popupen för budet med chip-texten `name`. */
function openPopup(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('AuctionGrid — förklarings-popupen', () => {
  it('full (default): rubrik, kravmärke, ALERT och långa texten visas', () => {
    render(<AuctionGrid calls={JACOBY} dealer="N" />)
    openPopup('2NT')
    expect(screen.getByText(/Förklaring · Syd/)).toBeInTheDocument()
    expect(screen.getByText('Utgångskrav')).toBeInTheDocument()
    expect(screen.getByText('ALERT')).toBeInTheDocument()
    expect(screen.getByText(/Lång testförklaring/)).toBeInTheDocument()
  })

  it('minimal: regelnamnet + ALERT visas — kravmärke och lång text döljs', () => {
    render(<AuctionGrid calls={JACOBY} dealer="N" explanations="minimal" />)
    openPopup('2NT')
    expect(screen.getByText('Jacoby 2NT')).toBeInTheDocument()
    expect(screen.getByText('ALERT')).toBeInTheDocument()
    expect(screen.queryByText('Utgångskrav')).not.toBeInTheDocument()
    expect(screen.queryByText(/Lång testförklaring/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Förklaring ·/)).not.toBeInTheDocument()
  })

  it('minimal: regelnamnet versaliseras (negativ dubbling → Negativ dubbling)', () => {
    const calls: ResolvedCall[] = [
      { seat: 'N', bid: '1D', rule: 'öppning', explanation: 'Öppning.' },
      { seat: 'E', bid: '1S', rule: 'inkliv', explanation: 'Inkliv.' },
      { seat: 'S', bid: 'X', rule: 'negativ dubbling', explanation: '11 hp, 4+ hjärter → X.' },
    ]
    render(<AuctionGrid calls={calls} dealer="N" explanations="minimal" />)
    openPopup('X')
    expect(screen.getByText('Negativ dubbling')).toBeInTheDocument()
    expect(screen.queryByText(/4\+ hjärter/)).not.toBeInTheDocument()
  })

  it('minimal: bud utan regel faller tillbaka på sitsnamnet — ingen krasch', () => {
    render(<AuctionGrid calls={[{ seat: 'W', bid: 'P' }]} dealer="W" explanations="minimal" />)
    openPopup('PASS')
    // "Väst" finns redan som kolumnrubrik — popupen ger en andra förekomst.
    expect(screen.getAllByText('Väst')).toHaveLength(2)
  })

  it('minimal: eget bud visas som "Eget bud"', () => {
    const calls: ResolvedCall[] = [
      { seat: 'S', bid: '1S', rule: 'eget bud', explanation: 'Eget bud. Naturligt, spader.' },
    ]
    render(<AuctionGrid calls={calls} dealer="S" explanations="minimal" />)
    openPopup('1♠')
    expect(screen.getByText('Eget bud')).toBeInTheDocument()
    expect(screen.queryByText(/Naturligt/)).not.toBeInTheDocument()
  })
})

// Informationsläckan (granskningen 2026-08-02, lagad i Etapp C): motorns
// lagrade förklaring byggs av handens FAKTISKA värden ("8 hp, 4+ spader").
// Under en LEVANDE giv (hiddenHands) får bara Syds egna bud visa den — andras
// bud förklaras av tolkningslagret, som läser enbart auktionen (intervall,
// aldrig korten). I efterhandsvyerna (utan hiddenHands) är korten öppna och
// den äkta förklaringen är poängen — där ändras inget.
describe('AuctionGrid — dolda händer läcker inte (Etapp C)', () => {
  const LEAK: ResolvedCall[] = [
    { seat: 'E', bid: '1C', rule: 'öppning', explanation: '14 hp, 4 klöver → 1♣.' },
    { seat: 'S', bid: '1H', rule: 'inkliv', explanation: '9 hp med 5-korts hjärter → 1♥ (inkliv).' },
    { seat: 'W', bid: 'X', rule: 'negativ dubbling', explanation: '8 hp, 4+ spader → X (negativ dubbling, visar objuden högfärg).' },
  ]

  it('hiddenHands: motståndarens bud visar ALDRIG handens faktiska hp', () => {
    render(<AuctionGrid calls={LEAK} dealer="E" hiddenHands />)
    openPopup('X')
    expect(screen.queryByText(/8 hp/)).not.toBeInTheDocument()
    // ALERT och kravnivån är systemiska och ska finnas kvar.
    expect(screen.getByText(/Förklaring · Väst/)).toBeInTheDocument()
  })

  it('hiddenHands: ditt EGET bud får fortfarande sin äkta förklaring', () => {
    render(<AuctionGrid calls={LEAK} dealer="E" hiddenHands />)
    openPopup('1♥')
    expect(screen.getByText(/9 hp med 5-korts hjärter/)).toBeInTheDocument()
  })

  it('utan hiddenHands (budvisningen/efterhand): äkta förklaringen som förr', () => {
    render(<AuctionGrid calls={LEAK} dealer="E" />)
    openPopup('X')
    expect(screen.getByText(/8 hp, 4\+ spader/)).toBeInTheDocument()
  })
})
