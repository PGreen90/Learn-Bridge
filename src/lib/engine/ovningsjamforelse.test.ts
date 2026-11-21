// Övningsomspelets fiktiva jämförelse (ägarönskemål 2026-11-21) — FACIT FÖRE
// BYGGET. När en tävlingsgiv spelas om i övningsläge ställs övningsresultatet
// fiktivt mot fältets riktiga resultat ("om du hade spelat så här från
// början": övningen ERSÄTTER din egen rad) och jämförs med ditt riktiga tal.
// Alla tävlingsformer: MP%, cross-IMP och stjärntävlingen (räknas som MP).
import { describe, expect, it } from 'vitest'
import { fiktivJamforelse, nsScoreUrKontrakt } from './ovningsjamforelse'

describe('fiktivJamforelse — övningen ersätter din rad i fältet', () => {
  const FALT_MP = [
    { jag: false, nsScore: 450, tal: 100 },
    { jag: false, nsScore: 420, tal: 50 },
    { jag: false, nsScore: 420, tal: 50 },
    { jag: true, nsScore: -50, tal: 0 },
  ]

  it('MP: delad topp mot fältet, jämfört med din riktiga botten', () => {
    // 450 mot [450, 420, 420]: 2 vinster + 1 delad = 2,5 av 3.
    const j = fiktivJamforelse(FALT_MP, 450, 'mp')!
    expect(j.ovning).toBeCloseTo((2.5 / 3) * 100, 6)
    expect(j.tavling).toBe(0)
    expect(j.diff).toBeCloseTo((2.5 / 3) * 100, 6)
    expect(j.andra).toBe(3)
  })

  it('MP: ditt gamla resultat räknas INTE som en motståndare', () => {
    // Samma resultat som förr (−50) ska ge samma tal som förr (0 %), inte
    // en delning med det egna gamla jaget.
    const j = fiktivJamforelse(FALT_MP, -50, 'mp')!
    expect(j.ovning).toBe(0)
    expect(j.diff).toBe(0)
  })

  it('stjärntävlingen räknas som MP', () => {
    expect(fiktivJamforelse(FALT_MP, 450, 'guld')!.ovning).toBeCloseTo((2.5 / 3) * 100, 6)
  })

  it('IMP: cross-IMP mot fältet, skillnad i IMP', () => {
    const falt = [
      { jag: false, nsScore: 420, tal: 5 },
      { jag: false, nsScore: 420, tal: 5 },
      { jag: true, nsScore: -50, tal: -10 },
    ]
    // 420 mot [420, 420] = 0 IMP; riktiga talet var −10.
    const j = fiktivJamforelse(falt, 420, 'imp')!
    expect(j.ovning).toBe(0)
    expect(j.tavling).toBe(-10)
    expect(j.diff).toBe(10)
    // 620 mot [420, 420]: 200 poäng = 5 IMP mot var och en.
    expect(fiktivJamforelse(falt, 620, 'imp')!.ovning).toBe(5)
  })

  it('utan egen rad (en dag du inte spelade): bara det fiktiva talet', () => {
    const falt = FALT_MP.filter((r) => !r.jag)
    const j = fiktivJamforelse(falt, 430, 'mp')!
    expect(j.ovning).toBeCloseTo((2 / 3) * 100, 6)
    expect(j.tavling).toBeNull()
    expect(j.diff).toBeNull()
  })

  it('egen rad utan tal (given inte poängsatt än): ingen skillnad visas', () => {
    const falt = [
      { jag: false, nsScore: 420 },
      { jag: true, nsScore: -50 },
    ]
    const j = fiktivJamforelse(falt, 420, 'mp')!
    expect(j.ovning).toBe(50)
    expect(j.tavling).toBeNull()
  })

  it('ingen annan har spelat given: ingen jämförelse', () => {
    expect(fiktivJamforelse([{ jag: true, nsScore: 420, tal: 100 }], 450, 'mp')).toBeNull()
    expect(fiktivJamforelse([], 450, 'imp')).toBeNull()
  })
})

describe('nsScoreUrKontrakt — N/S-poängen ur det kompakta kontraktet', () => {
  it('hemgången utgång i ozon, N/S respektive Ö/V som spelförare', () => {
    expect(nsScoreUrKontrakt({ level: 4, strain: 'spades', declarer: 'S', diff: 0 }, 'none')).toBe(420)
    expect(nsScoreUrKontrakt({ level: 4, strain: 'spades', declarer: 'E', diff: 0 }, 'none')).toBe(-420)
  })
  it('zonen och straffen följer med', () => {
    expect(nsScoreUrKontrakt({ level: 4, strain: 'spades', declarer: 'S', diff: 1 }, 'ns')).toBe(650)
    expect(nsScoreUrKontrakt({ level: 3, strain: 'NT', declarer: 'W', diff: -2, doubled: 'X' }, 'ew')).toBe(500)
  })
  it('utpassad giv = 0', () => {
    expect(nsScoreUrKontrakt(null, 'all')).toBe(0)
  })
})
