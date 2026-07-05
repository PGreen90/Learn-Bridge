import { describe, it, expect } from 'vitest'
import type { ResolvedCall } from '../bidding'
import { interpretCall, interpretLastCall } from './auction-interpret'
import { ruleInfo } from './rules'

// Facit för tolkningslagret (arbetsregel A). Kärnlöftet: ALDRIG tom förklaring.
// Vi testar betydelse via nyckelord (robustare än exakt textmatchning).

function h(...calls: Array<[ResolvedCall['seat'], string] | [ResolvedCall['seat'], string, string, string]>): ResolvedCall[] {
  return calls.map(([seat, bid, rule, explanation]) => ({
    seat,
    bid,
    ...(rule ? { rule } : {}),
    ...(explanation ? { explanation } : {}),
  }))
}

describe('interpretCall – kärnlöftet: alltid en förklaring', () => {
  it('ger aldrig tom text, oavsett bud', () => {
    const histories: ResolvedCall[][] = [
      h(['N', '1H'], ['S', '4S']),
      h(['W', '1H'], ['N', '2H'], ['E', '3H'], ['S', '4S']),
      h(['N', '1C'], ['S', '1D'], ['N', '1NT'], ['S', '3NT']),
      h(['E', '1S'], ['S', 'X']),
      h(['N', '1NT'], ['S', '2C']),
      h(['S', 'P'], ['W', 'P'], ['N', 'P'], ['E', 'P']),
    ]
    for (const hist of histories) {
      const last = interpretLastCall(hist)!
      expect(last.text.length).toBeGreaterThan(0)
      expect(last.text).not.toMatch(/utanför systemlinjen/i)
    }
  })
})

describe('skärmdumpen: 1♥ – 2♥(Michaels) – 3♥ – 4♠', () => {
  const hist = h(['W', '1H'], ['N', '2H'], ['E', '3H'], ['S', '4S'])

  it('tolkar Syds 4♠ som utgångshöjning i spader (partnern visade spader)', () => {
    const r = interpretCall(hist, 3)
    expect(r.text).toMatch(/spader/i)
    expect(r.text).toMatch(/utgång/i)
    expect(r.forcing).toBe('avslut')
    expect(r.confidence).toBe('trolig')
  })

  it('nämner konkurrensen (tar budet från motståndarna)', () => {
    const r = interpretCall(hist, 3)
    expect(r.text).toMatch(/konkurrens/i)
  })

  it('fungerar även när 2♥ bär motorns Michaels-regel', () => {
    const withRule = h(['W', '1H'], ['N', '2H', 'Michaels', 'Michaels: spader + en minor'], ['E', '3H'], ['S', '4S'])
    const r = interpretCall(withRule, 3)
    expect(r.text).toMatch(/spader/i)
    expect(r.text).toMatch(/utgång/i)
  })
})

describe('heuristiska grundfall', () => {
  it('stöd i partnerns färg under utgång = höjning', () => {
    const r = interpretCall(h(['N', '1H'], ['S', '2H']), 1)
    expect(r.text).toMatch(/hjärter/i)
    expect(r.text).toMatch(/stöd|höjning/i)
  })

  it('direkt cue i deras öppningsfärg, vi objudna = Michaels (ej stöd)', () => {
    const r = interpretCall(h(['E', '1S'], ['S', '2S']), 1)
    expect(r.text).toMatch(/Michaels/i)
    expect(r.text).toMatch(/hjärter/i) // över 1♠ visar Michaels hjärter + en lågfärg
    expect(r.text).not.toMatch(/stöd/i)
  })

  it('äkta cue i deras färg, partnern har öppnat = stark höjning (krav)', () => {
    // N öppnar 1♥, Ö kliver in 2♣, S cue:ar 3♣ = stark hjärterhöjning.
    const r = interpretCall(h(['N', '1H'], ['E', '2C'], ['S', '3C']), 2)
    expect(r.text).toMatch(/stark höjning/i)
    expect(r.text).toMatch(/hjärter/i)
    expect(r.text).toMatch(/kontrollbud/i)
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('off-book hopp i ny färg = lång färg, begränsad styrka, inbjudan', () => {
    const r = interpretCall(h(['N', '1C'], ['S', '3H']), 1)
    expect(r.text).toMatch(/lång/i)
    expect(r.text).toMatch(/klöver/i) // ofta kort i partnerns klöver
    expect(r.confidence).toBe('trolig')
    expect(r.forcing).toBe('inbjudan')
  })

  it('öppningsbud i färg känns igen', () => {
    const r = interpretCall(h(['N', '1S']), 0)
    expect(r.text).toMatch(/öppningsbud/i)
    expect(r.text).toMatch(/spader/i)
  })

  it('1NT-öppning beskrivs som balanserad 15–17', () => {
    const r = interpretCall(h(['N', '1NT']), 0)
    expect(r.text).toMatch(/balanserad/i)
    expect(r.text).toMatch(/15–17/)
  })

  it('lågt upplysnings-X känns igen', () => {
    const r = interpretCall(h(['E', '1S'], ['S', 'X']), 1)
    expect(r.text).toMatch(/upplysning/i)
    expect(r.forcing).toBe('krav-1-rond')
  })
})

// Felrapport #9 (github.com/PGreen90/Learn-Bridge/issues/9): efter partnerns
// negativa dubbling (visar 4+ i objuden högfärg) tolkades öppnarens 3♥/4♥ som
// "spärrliknande bud" (lång egen färg, svagt). Fel: de är graderade SVAR på
// dubblingen. Och 4NT med överenskommen trumf tolkades som "till spel" –
// odiskutabel essfråga (1430 RKC).
describe('felrapport #9 – svar på negativ dubbling + 4NT-essfrågan', () => {
  // 1♦ (S) – 1♠ (V) – X (N, negativ) – P: Syd väljer nu sitt svar.
  const base: Array<[ResolvedCall['seat'], string]> = [
    ['S', '1D'], ['W', '1S'], ['N', 'X'], ['E', 'P'],
  ]

  it('2♥ = minimisvar som väljer partnerns visade högfärg', () => {
    const r = interpretCall(h(...base, ['S', '2H']), 4)
    expect(r.text).toMatch(/negativa dubbling/i)
    expect(r.text).not.toMatch(/lång färg|spärr/i)
  })

  it('3♥ = inbjudande hopp med extra styrka – INTE en egen spärr', () => {
    const r = interpretCall(h(...base, ['S', '3H']), 4)
    expect(r.text).toMatch(/negativa dubbling/i)
    expect(r.text).not.toMatch(/lång färg|spärr/i)
    expect(r.forcing).toBe('inbjudan')
  })

  it('4♥ = utgångssvar på dubblingen', () => {
    const r = interpretCall(h(...base, ['S', '4H']), 4)
    expect(r.text).toMatch(/negativa dubbling/i)
    expect(r.text).toMatch(/utgång/i)
    expect(r.forcing).toBe('avslut')
  })

  it('4NT med överenskommen trumf (båda bjudit hjärter) = essfråga 1430 RKC', () => {
    const hist = h(
      ['S', '1D'], ['W', '1S'], ['N', 'X'], ['E', 'P'],
      ['S', '2H'], ['W', 'P'], ['N', '4H'], ['E', 'P'],
      ['S', '4NT'],
    )
    const r = interpretCall(hist, 8)
    expect(r.text).toMatch(/essfråga/i)
    expect(r.text).toMatch(/1430/)
    expect(r.text).not.toMatch(/till spel/i)
    expect(r.forcing).toBe('krav-1-rond')
  })
})

// Felrapport #10 (github.com/PGreen90/Learn-Bridge/issues/10): 4NT direkt på
// partnerns 3♠-spärr tolkades som "till spel" (ingen ÖVERENSKOMMEN trumf –
// bara Nord hade bjudit spader). Standardregeln: 4NT är essfråga när sidans
// senaste naturliga bud var en FÄRG (kvantitativt bara över sang) – trumfen
// är den färgen.
describe('felrapport #10 – 4NT på partnerns spärröppning tolkas som essfråga', () => {
  it('P–3♠–P–4NT = essfråga 1430 RKC med spader som trumf', () => {
    const hist = h(['W', 'P'], ['N', '3S'], ['E', 'P'], ['S', '4NT'])
    const r = interpretCall(hist, 3)
    expect(r.text).toMatch(/essfråga/i)
    expect(r.text).toMatch(/1430/)
    expect(r.text).toMatch(/spader/i)
    expect(r.text).not.toMatch(/till spel/i)
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('1NT–4NT förblir kvantitativt/naturligt (INTE essfråga)', () => {
    const hist = h(['S', '1NT'], ['W', 'P'], ['N', '4NT'])
    const r = interpretCall(hist, 2)
    expect(r.text).not.toMatch(/essfråga/i)
  })
})

// Felrapport #24 (github.com/PGreen90/Learn-Bridge/issues/24): "gillar inte hur
// 1NT förklaras." Given: E dealer, W öppnar 1♣, N kliver in 1♠, E negativ X,
// W återbjuder 1NT. Heuristiken kallade det "svag balanserad hand" – fel: ett
// 1NT-ÅTERBUD av öppnaren (efter öppning i färg) visar en balanserad MINIMIHAND
// ~12–14 hp (15–17 hade öppnat 1NT), stopp i motståndarnas färg. Facit i
// budsystem.md §5.2 ("1NT (1♣–1♥–1NT) | 12–14, balanserad").
describe('felrapport #24 – öppnarens 1NT-återbud beskrivs som 12–14, inte "svag"', () => {
  // P – P – 1♣(W) – 1♠(N) – X(E) – P – 1NT(W) – P – P – P. W:s 1NT = index 6.
  const hist = h(
    ['E', 'P'], ['S', 'P'], ['W', '1C'], ['N', '1S'],
    ['E', 'X'], ['S', 'P'], ['W', '1NT'],
  )

  it('kallar det ett återbud och sätter rätt styrka (12–14), inte "svag"', () => {
    const r = interpretCall(hist, 6)
    expect(r.text).not.toMatch(/svag/i)
    expect(r.text).toMatch(/återbud/i)
    expect(r.text).toMatch(/12–14/)
    expect(r.text).toMatch(/balanserad/i)
    expect(r.confidence).toBe('trolig')
  })

  it('nämner stopp i motståndarnas färg (konkurrens)', () => {
    const r = interpretCall(hist, 6)
    expect(r.text).toMatch(/stopp/i)
  })

  it('svararens egna 1NT-svar (ostört) beskrivs fortfarande som begränsat, ej "svag balanserad"', () => {
    // 1♣(N) – 1♥(S)? nej: rent svarsfall 1♦(N) – P – ... enklast: N öppnar 1♦, S svarar 1NT.
    const r = interpretCall(h(['N', '1D'], ['S', '1NT']), 1)
    expect(r.text).toMatch(/6–1[01]|balanserad/i)
    expect(r.text).not.toMatch(/återbud/i)
  })
})

describe('motorns egen regel går före heuristiken (säker)', () => {
  it('använder budets explanation och kravnivå ur registret', () => {
    const hist = h(['N', '1H'], ['S', '2C', '2-över-1 GF', 'Tvåöver ett: utgångskrav, naturligt klöver'])
    const r = interpretCall(hist, 1)
    expect(r.confidence).toBe('säker')
    expect(r.text).toMatch(/utgångskrav/i)
    expect(r.forcing).toBe('utgangskrav')
  })
})

// SKYDDSNÄT (R2-fynd #2): motorn och heuristiken är två läsare av budbetydelsen.
// Bottarnas bud bär alltid en motor-`rule`; interpretCall MÅSTE deferra till den
// (säker tolkning + SAMMA kravnivå som regelregistret). Detta test låser fast att
// de två källorna inte glider isär – ett bud med regel tolkas alltid ur regeln,
// aldrig ur heuristikens gissning. Lägger vi en ny konvention med en ny regel bör
// dess namn läggas till här (och forcingOf i rules.ts kunna svara på den).
describe('skyddsnät: ett bud MED motor-regel tolkas alltid ur regeln', () => {
  const ruledCalls: Array<{ rule: string; explanation?: string }> = [
    { rule: '5-korts högfärg' },
    { rule: 'fjärde färg krav' },
    { rule: 'fullföljd transfer' },
    { rule: 'negativ dubbling' },
    { rule: 'enkelt inkliv' },
    { rule: 'till spel', explanation: 'Motorns egen förklaring: väljer utgång.' },
  ]

  for (const { rule, explanation } of ruledCalls) {
    it(`"${rule}" → säker tolkning med regelns kravnivå`, () => {
      const call: ResolvedCall = { seat: 'S', bid: '2H', rule, ...(explanation ? { explanation } : {}) }
      const hist: ResolvedCall[] = [{ seat: 'N', bid: '1H' }, call]
      const r = interpretCall(hist, 1)
      // Deferrar till motorn, inte heuristiken:
      expect(r.confidence).toBe('säker')
      expect(r.text.length).toBeGreaterThan(0)
      // Kravnivån kommer ur SAMMA källa som motorn (regelregistret):
      expect(r.forcing).toBe(ruleInfo(rule).forcing)
      // När motorn gav en egen förklaring används den ordagrant:
      if (explanation) expect(r.text).toBe(explanation)
    })
  }
})
