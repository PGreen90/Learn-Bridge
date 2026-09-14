// FACIT för DD-facit på servern (bordens SENARE-lista etapp 2, 2026-09-14):
// bridge-dds räknar hela tabellen + par för en seedad giv, och giv-klar-
// händelsen (spelad giv) får `data.dd` — utpassad giv och övriga händelser
// lämnas orörda. Facit FÖRE kod.

import { describe, expect, it } from 'vitest'
import { dealFromSeed } from '../../src/lib/engine/revisor'
import { ddStick } from '../../src/lib/engine/dd-facit'
import { beraknaDdFacit, medDdFacit } from './dd-facit'
import type { NyHandelse } from './bord-motor'

const DEAL = dealFromSeed(7)

describe('beraknaDdFacit', () => {
  it('ger 5×4-tabellen (0–13 stick) och par för given', async () => {
    const dd = await beraknaDdFacit(DEAL)
    expect(dd).not.toBeNull()
    expect(dd!.tabell).toHaveLength(5)
    for (const rad of dd!.tabell) {
      expect(rad).toHaveLength(4)
      for (const v of rad) expect(v >= 0 && v <= 13).toBe(true)
    }
    // Samma strain: N och S (partners) har samma DD-stick, likaså Ö och V.
    for (const rad of dd!.tabell) {
      expect(rad[0]).toBe(rad[2])
      expect(rad[1]).toBe(rad[3])
    }
    expect(typeof dd!.parNS).toBe('number')
    expect(Array.isArray(dd!.parKontrakt)).toBe(true)
    // Uppslaget via den delade läsaren stämmer med tabellen (NT = rad 4, N = kolumn 0).
    expect(ddStick(dd!, 'N', 'NT')).toBe(dd!.tabell[4][0])
  })
})

describe('medDdFacit', () => {
  const givKlar: NyHandelse = {
    giv: 1,
    typ: 'giv-klar',
    data: { hands: DEAL.hands, contract: { declarer: 'N', strain: 'NT', level: 3 }, passadUt: false, declarerTricks: 9, nsScore: 400 },
  }
  const kort: NyHandelse = { giv: 1, typ: 'kort', seat: 'W', data: { card: { suit: 'spades', rank: 'A' } } }

  it('giv-klar för en spelad giv får dd; kort-händelsen lämnas orörd', async () => {
    const ut = await medDdFacit([kort, givKlar], DEAL)
    expect(ut).toHaveLength(2)
    expect(ut[0]).toBe(kort)
    const dd = (ut[1].data as { dd?: { tabell: number[][] } }).dd
    expect(dd?.tabell).toHaveLength(5)
    // Originalet muteras inte.
    expect((givKlar.data as { dd?: unknown }).dd).toBeUndefined()
  })

  it('utpassad giv får inget dd', async () => {
    const passad: NyHandelse = { giv: 1, typ: 'giv-klar', data: { hands: DEAL.hands, contract: null, passadUt: true } }
    const ut = await medDdFacit([passad], DEAL)
    expect((ut[0].data as { dd?: unknown }).dd).toBeUndefined()
  })

  it('utan giv-klar returneras listan som den är (ingen lösning körs)', async () => {
    const lista = [kort]
    expect(await medDdFacit(lista, DEAL)).toBe(lista)
  })
})
