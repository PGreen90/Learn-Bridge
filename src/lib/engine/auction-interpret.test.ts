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

// Systems on efter naturligt 2NT-återbud (§5.2): heuristiken (regel-lösa
// MÄNSKLIGA bud, t.ex. vänner-bordet) måste läsa checkbacken som konvention.
describe('systems on efter 2NT-återbud – regel-lösa bud (heuristik)', () => {
  it('3♣ efter 1♣–1♠–2NT = checkback (dold hjärter/3-stöd), INTE naturlig klöver', () => {
    const r = interpretLastCall(h(['N', '1C'], ['S', '1S'], ['N', '2NT'], ['S', '3C']))!
    expect(r.text).toMatch(/checkback/i)
    expect(r.text).toMatch(/hjärter/i)
    expect(r.text).not.toMatch(/naturlig klöver|klöverstöd|höjning i klöver/i)
  })

  it('öppnarens 3♥ på checkbacken = visar dold 4-korts hjärter (4-4)', () => {
    const r = interpretLastCall(h(['N', '1C'], ['S', '1S'], ['N', '2NT'], ['S', '3C'], ['N', '3H']))!
    expect(r.text).toMatch(/hjärter/i)
    expect(r.text).toMatch(/4-4|checkback/i)
  })

  it('direkt 3♥ efter 1♣–1♥–2NT = 5-korts hjärter söker 5-3', () => {
    const r = interpretLastCall(h(['N', '1C'], ['S', '1H'], ['N', '2NT'], ['S', '3H']))!
    expect(r.text).toMatch(/5-3|5-korts/i)
    expect(r.text).toMatch(/hjärter/i)
  })

  it('öppnarens 4♥ på direkt 3♥ = höjer 5-3-fiten till utgång', () => {
    const r = interpretLastCall(h(['N', '1C'], ['S', '1H'], ['N', '2NT'], ['S', '3H'], ['N', '4H']))!
    expect(r.text).toMatch(/utgång|5-3/i)
    expect(r.forcing).toBe('avslut')
  })

  it('3NT efter 1♣–1♥–2NT = placering (ingen högfärg att jaga)', () => {
    const r = interpretLastCall(h(['N', '1C'], ['S', '1H'], ['N', '2NT'], ['S', '3NT']))!
    expect(r.text).toMatch(/till spel|placering/i)
  })

  it('bot-budet (med motor-regel) tolkas säkert ur regeln, inte heuristiken', () => {
    const r = interpretLastCall(h(
      ['N', '1C'], ['S', '1S'], ['N', '2NT'],
      ['S', '3C', '2NT-checkback', '5+ spader + 4 hjärter → 3♣ (checkback).'],
    ))!
    expect(r.confidence).toBe('säker')
    expect(r.text).toMatch(/checkback/i)
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

// Ägarrapport 2026-08-05 (giv 20261272, hål D-arbetet): med en ETABLERAD 8-korts
// högfärgsfit är trumf redan bestämd. Ett 4-läges FÄRGBUD som inte är trumfen är
// då ett rent KONTROLLBUD (cue), inte en färghöjning. Motorn läste 4♣ som "stark
// höjning av partnerns RUTER" (via cue-i-deras-färg-grenen) – fel, spader var trumf.
describe('etablerad högfärgsfit: 4-läges sidobud = kontrollbud (ej färghöjning)', () => {
  // S öppnade 1♦, V hoppinkliv 3♣, N X (neg. dbl → båda högfärgerna), S valde
  // spader (3♠) → 8-korts spaderfit. Nu cue:ar N på 4-läget. (Sett från N-sätet
  // roterat till Syd i appen: partnern öppnade 1♦, jag dubblade, partnern bjöd 3♠.)
  const base: Array<[ResolvedCall['seat'], string]> = [
    ['W', 'P'], ['N', '1D'], ['E', '3C'], ['S', 'X'], ['W', 'P'], ['N', '3S'], ['E', 'P'],
  ]

  it('4♣ läses som kontrollbud i klöver med spader som trumf – INTE ruterhöjning', () => {
    const r = interpretCall(h(...base, ['S', '4C']), 7)
    expect(r.text).toMatch(/kontrollbud/i)
    expect(r.text).toMatch(/spader/i)
    expect(r.text).not.toMatch(/ruter/i)
    expect(r.text).not.toMatch(/höjning/i)
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('4♦ (äkta kontroll) läses också som kontrollbud, inte höjning', () => {
    const r = interpretCall(h(...base, ['S', '4D']), 7)
    expect(r.text).toMatch(/kontrollbud/i)
    expect(r.text).toMatch(/spader/i)
    expect(r.text).not.toMatch(/höjning/i)
  })

  it('4♠ förblir en vanlig utgångshöjning (trumfen själv, inte ett cue)', () => {
    const r = interpretCall(h(...base, ['S', '4S']), 7)
    expect(r.text).not.toMatch(/kontrollbud/i)
    expect(r.text).toMatch(/spader/i)
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

// Felrapport #52 (github.com/PGreen90/Learn-Bridge/issues/52): ett DIREKT
// 1NT-inkliv över motståndarens öppning förklarades som ett svagt svar
// (6–11 hp, "saknar bättre bud"). Fel: 1NT-inklivet visar 15–18 balanserad med
// stopp i motståndarnas färg (kör 1NT-systemet); i balansering 11–14. Facit i
// overcalls.ts (rule '1NT-inkliv') + budsystem.md §7.
describe('felrapport #52 – direkt 1NT-inkliv = 15–18 balanserad med stopp', () => {
  it('E 1♣ – S 1NT: 15–18, balanserad, stopp i klöver (INTE 6–11 svarshand)', () => {
    const r = interpretCall(h(['E', '1C'], ['S', '1NT']), 1)
    expect(r.text).toMatch(/15–18/)
    expect(r.text).toMatch(/balanserad/i)
    expect(r.text).toMatch(/stopp/i)
    expect(r.text).toMatch(/klöver/i)
    expect(r.text).not.toMatch(/6–11/)
  })

  it('balansering (1♣) P P – 1NT = lättare 11–14, fortfarande stopp', () => {
    // W öppnar 1♣, N pass, E pass, S balanserar med 1NT.
    const r = interpretCall(h(['W', '1C'], ['N', 'P'], ['E', 'P'], ['S', '1NT']), 3)
    expect(r.text).toMatch(/11–14/)
    expect(r.text).toMatch(/stopp/i)
    expect(r.text).not.toMatch(/6–11/)
  })
})

// Felrapport #53 (github.com/PGreen90/Learn-Bridge/issues/53): 2♣ över partnerns
// 1NT-inkliv förklarades "naturligt, minst 4 kort i klöver". Fel: mot en naturlig
// 1NT (öppning ELLER inkliv) är 2♣ Stayman – frågar efter 4-korts högfärg, säger
// inget om klöver (systems on).
describe('felrapport #53 – 2♣ över partnerns natur-1NT = Stayman', () => {
  it('P 1♦ 1NT P – S 2♣: Stayman, frågar efter högfärg (ej naturlig klöver)', () => {
    const r = interpretCall(h(['S', 'P'], ['W', '1D'], ['N', '1NT'], ['E', 'P'], ['S', '2C']), 4)
    expect(r.text).toMatch(/Stayman/i)
    expect(r.text).toMatch(/högfärg/i)
    expect(r.text).not.toMatch(/naturligt|minst 4 kort i klöver/i)
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('över partnerns 1NT-ÖPPNING är 2♣ också Stayman', () => {
    const r = interpretCall(h(['N', '1NT'], ['S', '2C']), 1)
    expect(r.text).toMatch(/Stayman/i)
  })

  it('men 2♣ efter partnerns 1NT-ÅTERBUD (öppnat färg först) är INTE Stayman', () => {
    const r = interpretCall(h(['N', '1C'], ['S', '1D'], ['N', '1NT'], ['S', '2C']), 3)
    expect(r.text).not.toMatch(/Stayman/i)
  })

  it('2♦ över partnerns natur-1NT = Jacoby-transfer till hjärter', () => {
    const r = interpretCall(h(['S', 'P'], ['W', '1D'], ['N', '1NT'], ['E', 'P'], ['S', '2D']), 4)
    expect(r.text).toMatch(/transfer/i)
    expect(r.text).toMatch(/hjärter/i)
    expect(r.text).not.toMatch(/naturligt|minst 4 kort i ruter/i)
  })

  it('2♥ över partnerns natur-1NT = Jacoby-transfer till spader', () => {
    const r = interpretCall(h(['N', '1NT'], ['S', '2H']), 1)
    expect(r.text).toMatch(/transfer/i)
    expect(r.text).toMatch(/spader/i)
  })

  it('2♠ över partnerns natur-1NT = Minor Suit Stayman', () => {
    const r = interpretCall(h(['N', '1NT'], ['S', '2S']), 1)
    expect(r.text).toMatch(/Minor Suit Stayman/i)
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

// FYND 3 (budförklarings-revisionen, 2026-08-19): i motståndarvyn (dolda händer)
// plattades ALLA dubblingar till "straffdubbling (gissning)". Fel — och mot
// ägarprincipen "inga gissningar i bridge". Betydelsen ska härledas ur auktionen.
// Varje kategori får nu ett eget, härlett svar; ingen dubbling får bli 'gissning'.
describe('Fynd 3 – dubblingar tolkas ur auktionen, aldrig som gissning', () => {
  it('negativ dubbling: partnern öppnade, motståndaren klev in, svararen X:ar', () => {
    // N 1♦ (partner) – E 1♠ (inkliv) – S X = negativ, visar objuden högfärg (hjärter).
    const r = interpretCall(h(['N', '1D'], ['E', '1S'], ['S', 'X']), 2)
    expect(r.text).toMatch(/negativ/i)
    expect(r.text).toMatch(/hjärter/i)
    expect(r.text).not.toMatch(/straffdubbling/i)
    expect(r.confidence).not.toBe('gissning')
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('stöddubbling: öppnaren X:ar motståndarens inkliv efter partnerns färgsvar', () => {
    // S 1♦ – W P – N 1♠ (svar) – E 2♥ (inkliv) – S X = stöd, exakt 3-korts spader.
    const r = interpretCall(h(['S', '1D'], ['W', 'P'], ['N', '1S'], ['E', '2H'], ['S', 'X']), 4)
    expect(r.text).toMatch(/stöddubbling/i)
    expect(r.text).toMatch(/spader/i)
    expect(r.text).toMatch(/3/)
    expect(r.confidence).not.toBe('gissning')
  })

  it('återöppningsdubbling: öppnaren återöppnar efter partnerns pass', () => {
    // S 1♥ – W 2♣ – N P – E P – S X = återöppning (takeout).
    const r = interpretCall(h(['S', '1H'], ['W', '2C'], ['N', 'P'], ['E', 'P'], ['S', 'X']), 4)
    expect(r.text).toMatch(/återöppning/i)
    expect(r.text).not.toMatch(/^Straffdubbling/i)
    expect(r.confidence).not.toBe('gissning')
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('direkt upplysningsdubbling: ingen egen budgivning, låg motståndarfärg', () => {
    const r = interpretCall(h(['E', '1S'], ['S', 'X']), 1)
    expect(r.text).toMatch(/upplysning/i)
    expect(r.text).not.toMatch(/straff/i)
    expect(r.confidence).not.toBe('gissning')
    expect(r.forcing).toBe('krav-1-rond')
  })

  it('straffdubbling av 1NT: styrka, inte takeout', () => {
    const r = interpretCall(h(['E', '1NT'], ['S', 'X']), 1)
    expect(r.text).toMatch(/straff/i)
    expect(r.text).toMatch(/sang/i)
    expect(r.confidence).not.toBe('gissning')
  })

  it('straffdubbling av utgång: motståndarna offrar/når spel', () => {
    // N 1♠ – E P – S 4♠ – W P – N P – E 5♣ – S X = straff mot deras 5♣.
    const r = interpretCall(
      h(['N', '1S'], ['E', 'P'], ['S', '4S'], ['W', 'P'], ['N', 'P'], ['E', '5C'], ['S', 'X']),
      6,
    )
    expect(r.text).toMatch(/straff/i)
    expect(r.text).toMatch(/bet/i)
    expect(r.confidence).not.toBe('gissning')
  })

  it('utgångsförsök (maximal): fit finns, motståndarna trängde upp budet', () => {
    // N 1♥ – E 2♣ – S 2♥ (fit) – W 3♣ – N X = game-try-dubbling i hjärterfiten.
    const r = interpretCall(h(['N', '1H'], ['E', '2C'], ['S', '2H'], ['W', '3C'], ['N', 'X']), 4)
    expect(r.text).toMatch(/utgångsförsök|game/i)
    expect(r.text).toMatch(/hjärter/i)
    expect(r.confidence).not.toBe('gissning')
  })

  it('kooperativ dubbling: låg dubbling utan fit där båda sidor bjudit', () => {
    // N 1♣ – E 1♥ – S 1♠ – W 3♥ – N X: högt inkliv, ingen stöddubbling, ingen fit.
    const r = interpretCall(h(['N', '1C'], ['E', '1H'], ['S', '1S'], ['W', '3H'], ['N', 'X']), 4)
    expect(r.text).toMatch(/kooperativ/i)
    expect(r.confidence).not.toBe('gissning')
  })
})
