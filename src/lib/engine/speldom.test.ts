// Facit för speldomen (Speldiagnosen steg 3). DD-spåren är HANDBYGGDA (inget
// WASM) — testet låser attributionen: rätt säte/stick/roll, teckenlogiken
// (spelförarsidans kort kan bara sänka, försvarets bara höja), att "omöjliga"
// rörelser kostar 0, och att helhetsdomens dekomponering summerar.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Seat } from '../../types/bridge'
import type { Contract, Trick } from './play'
import type { DealVerdict } from './revisor'
import { bedomSpel, helDom } from './speldom'

// Kortidentiteten är likgiltig för domen — bara SÄTET i spelordningen räknas.
const KORT: Card = { suit: 'spades', rank: '2' }

/** Bygg stick ur en sätesföljd (4 säten per stick, i lagd ordning). */
function stickFrom(seats: Seat[]): Trick[] {
  const tricks: Trick[] = []
  for (let i = 0; i < seats.length; i += 4) {
    const four = seats.slice(i, i + 4)
    tricks.push({ leader: four[0], cards: four.map((seat) => ({ seat, card: KORT })), winner: four[0] })
  }
  return tricks
}

// Spelförare N (sidan NS), utspelare Ö → spelordning Ö,S,V,N per stick.
const CONTRACT: Contract = { declarer: 'N', strain: 'NT', level: 3 }
const TVASTICK = stickFrom(['E', 'S', 'W', 'N', 'E', 'S', 'W', 'N'])

describe('bedomSpel', () => {
  it('utspelet som släpper stick: roll=utspel, försvarets tapp', () => {
    // Kort 1 (Ö:s utspel) höjer spelförarens DD 7→8 = försvaret släppte 1.
    const dom = bedomSpel(CONTRACT, [7, 8, 8, 8, 8, 8, 8, 8, 8], TVASTICK)
    expect(dom.fel).toEqual([{ kortIndex: 1, trick: 1, seat: 'E', roll: 'utspel', kostnad: 1 }])
    expect(dom.forsvarstapp).toBe(1)
    expect(dom.spelforartapp).toBe(0)
    expect(dom.ddTricks).toBe(7)
    expect(dom.actualTricks).toBe(8)
  })

  it('spelförarsidans kort som sänker DD: roll=spelforare (träkarlen inräknad)', () => {
    // Kort 2 (S = träkarlen på spelförarsidan) sänker 8→7.
    const dom = bedomSpel(CONTRACT, [8, 8, 7, 7, 7, 7, 7, 7, 7], TVASTICK)
    expect(dom.fel).toEqual([{ kortIndex: 2, trick: 1, seat: 'S', roll: 'spelforare', kostnad: 1 }])
    expect(dom.spelforartapp).toBe(1)
    expect(dom.forsvarstapp).toBe(0)
  })

  it('försvarskort EFTER utspelet: roll=forsvar, rätt sticknummer', () => {
    // Kort 5 (Ö, andra sticket) höjer 8→9.
    const dom = bedomSpel(CONTRACT, [8, 8, 8, 8, 8, 9, 9, 9, 9], TVASTICK)
    expect(dom.fel).toEqual([{ kortIndex: 5, trick: 2, seat: 'E', roll: 'forsvar', kostnad: 1 }])
  })

  it('"omöjlig" riktning (försvarskort som sänker DD) kostar 0 — inget fel', () => {
    const dom = bedomSpel(CONTRACT, [8, 7, 7, 7, 7, 7, 7, 7, 7], TVASTICK)
    expect(dom.fel).toEqual([])
    expect(dom.spelforartapp).toBe(0)
    expect(dom.forsvarstapp).toBe(0)
  })

  it('invariant: actual = dd + försvarstapp − spelförartapp (utan omöjliga hopp)', () => {
    // Kort 1 (Ö) +1, kort 6 (S) −1 → netto 0.
    const dom = bedomSpel(CONTRACT, [7, 8, 8, 8, 8, 8, 7, 7, 7], TVASTICK)
    expect(dom.forsvarstapp).toBe(1)
    expect(dom.spelforartapp).toBe(1)
    expect(dom.actualTricks).toBe(dom.ddTricks + dom.forsvarstapp - dom.spelforartapp)
    expect(dom.fel.map((f) => f.kortIndex)).toEqual([1, 6])
  })

  it('flerstegshopp ger hela kostnaden på ett kort', () => {
    // Kort 2 (S) sänker 10→8 = 2 stick på en gång.
    const dom = bedomSpel(CONTRACT, [10, 10, 8, 8, 8, 8, 8, 8, 8], TVASTICK)
    expect(dom.fel).toEqual([{ kortIndex: 2, trick: 1, seat: 'S', roll: 'spelforare', kostnad: 2 }])
    expect(dom.spelforartapp).toBe(2)
  })
})

// ---- Helhetsdomen -----------------------------------------------------------

const TOM_GIV: Deal = {
  id: 'tom',
  board: 1,
  dealer: 'N',
  vulnerability: 'none',
  hands: { N: [], E: [], S: [], W: [] },
}

function verdictMed(contract: Contract | null, loss: number): DealVerdict {
  return {
    seed: 42,
    category: 'ratt',
    loss,
    achievedNS: 0,
    optimumNS: 0,
    ownerSide: null,
    ownerBest: null,
    contract,
    tricks: null,
    auction: [],
  }
}

describe('helDom', () => {
  it('NS-spelförare som tappar mot DD: negativt spelDeltaNS (4♠: 420 → −50 = −470)', () => {
    const contract: Contract = { declarer: 'N', strain: 'spades', level: 4 }
    const spelDom = { ddTricks: 10, actualTricks: 9, fel: [], spelforartapp: 1, forsvarstapp: 0 }
    const dom = helDom(TOM_GIV, verdictMed(contract, 30), spelDom)
    expect(dom.spelDeltaNS).toBe(-470)
    expect(dom.budtapp).toBe(30)
    expect(dom.budKategori).toBe('ratt')
  })

  it('ÖV-spelförare som vinner stick mot DD: negativt för N/S (3NT: 400 → 430)', () => {
    const contract: Contract = { declarer: 'E', strain: 'NT', level: 3 }
    const spelDom = { ddTricks: 9, actualTricks: 10, fel: [], spelforartapp: 0, forsvarstapp: 1 }
    const dom = helDom(TOM_GIV, verdictMed(contract, 0), spelDom)
    expect(dom.spelDeltaNS).toBe(-30)
  })

  it('utpassad giv: ingen speldom, spelDeltaNS = 0', () => {
    const dom = helDom(TOM_GIV, verdictMed(null, 140), null)
    expect(dom.spelDom).toBeNull()
    expect(dom.spelDeltaNS).toBe(0)
  })
})
