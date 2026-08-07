// F2 (E1) – KEDJEVAKTEN. Detektorkedjan i decideCall är ordningskänslig:
// flera detektorer MÅSTE ligga före andra (t.ex. före det generella
// off-book-svaret, som annars läser ett konstgjort relä/cue som en naturlig
// färg). Tidigare bodde de kraven bara i kommentarer – ingen märkte om en
// omflyttning bröt dem. Nu är kedjan DATA: varje detektor har ett unikt `id`
// och sina före-krav i `before`. Det här testet gör sviten röd om:
//   1. två detektorer har samma id,
//   2. ett före-krav pekar på ett id som inte finns i samma kedja,
//   3. den faktiska listordningen bryter ett före-krav.
// Flyttar man en detektor eller lägger till en ny ska man alltså ange dess
// före-krav – vakten säger direkt om placeringen är fel.

import { describe, expect, it } from 'vitest'
import { CONTESTED_DETECTORS, FORCED_DETECTORS } from './auction-live'
import type { LiveDetector } from './auction-live'

function checkChain(name: string, chain: readonly LiveDetector[]) {
  describe(name, () => {
    it('alla id:n är unika', () => {
      const seen = new Set<string>()
      for (const d of chain) {
        expect(seen.has(d.id), `dubblerat id: ${d.id}`).toBe(false)
        seen.add(d.id)
      }
    })

    it('varje före-krav pekar på en detektor som finns i kedjan', () => {
      const ids = new Set(chain.map((d) => d.id))
      for (const d of chain) {
        for (const target of d.before ?? []) {
          expect(ids.has(target), `${d.id} kräver "före ${target}" men ${target} finns inte i kedjan`).toBe(true)
        }
      }
    })

    it('listordningen uppfyller alla före-krav', () => {
      const index = new Map(chain.map((d, i) => [d.id, i]))
      for (const d of chain) {
        for (const target of d.before ?? []) {
          const me = index.get(d.id)!
          const them = index.get(target)!
          expect(me < them, `${d.id} (plats ${me}) måste ligga FÖRE ${target} (plats ${them})`).toBe(true)
        }
      }
    })
  })
}

checkChain('F2 kedjevakten – tvingande svar (forcedAnswers)', FORCED_DETECTORS)
checkChain('F2 kedjevakten – konkurrenskedjan (contestedAnswers)', CONTESTED_DETECTORS)

describe('F2 kedjevakten – kedjans slutvakter', () => {
  it('offBookResponse ligger näst sist och honorForce sist i konkurrenskedjan', () => {
    // Grundarkitekturen: alla specifika detektorer före det GENERELLA
    // off-book-svaret, och sist den absoluta vakten "krav får aldrig passas".
    const ids = CONTESTED_DETECTORS.map((d) => d.id)
    expect(ids[ids.length - 2]).toBe('offBookResponse')
    expect(ids[ids.length - 1]).toBe('honorForce')
  })
})
