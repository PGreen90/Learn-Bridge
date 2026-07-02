import { describe, expect, it } from 'vitest'
import { isAlertRule as oldIsAlertRule } from './alerts'
import { FORCING_LABEL, forcingOf, isAlertRule, knownForcingRules, ruleInfo } from './rules'

// Den KOMPLETTA uppsättningen regelnamn som budmotorn faktiskt producerar
// (utvunnen ur `rule: '...'` i src/lib/engine, exkl. testfiler). Hålls i synk
// med koden – ett nytt regelnamn ska läggas till här OCH i registret.
const ALL_ENGINE_RULES: string[] = [
  '1430 RKC', '1NT (12–14)', '1NT', '1NT-inkliv', '2-över-1 GF',
  '2NT (15–18)', '2NT (18–19)', '2NT inbjudan', '2NT', '2NT-inkliv (15–18)',
  '2♣-positivt', '2♦ väntebud', '3NT direkt (förnekar stopp)', '3NT till spel',
  '3NT', '4NT kvantitativ', '5-korts högfärg', '6NT till spel', 'Bergen game try',
  'game try: kortfärg', 'game try: accepterar', 'game try: signoff',
  'Bergen konstruktiv', 'Bergen limit', 'Bergen spärr', 'DONT 2♠ (spader)',
  'DONT X (enfärg)', 'DONT relä', 'DONT tvåfärg', 'Drury', 'Drury: lätt öppning',
  'Drury: riktig öppning', 'Drury: utgångsförsök', 'Exclusion', 'Gerber kungfråga',
  'Gerber', 'Gerber: stannar', 'Jacoby 2NT', 'Jacoby-transfer', 'Jacoby: 3NT',
  'Jacoby: kortfärg', 'Jacoby: minimum', 'Jacoby: sidofärg', 'Jacoby: slamintresse',
  'Jordan 2NT',
  'Lebensohl 2NT (slow → 3NT, visar stopp)', 'Lebensohl 2NT (svag)',
  'Lebensohl cue (Stayman, krav)', 'Lebensohl direkt 3-läge (krav)', 'MSS-svar',
  'Mathe 1NT (minorer)', 'Mathe X (högfärger)', 'Michaels', 'Minor Suit Stayman',
  'Minor Suit Stayman: höjning',
  'NT med stopp', 'NT-svar', 'Ogust', 'Ogust: max/bra', 'Ogust: max/dålig',
  'Ogust: max/utmärkt', 'Ogust: min/bra', 'Ogust: min/dålig', 'Sjöberg 5NT',
  'Smolen', 'Stayman (2NT)', 'Stayman', 'Stayman-svar', 'Texas (2NT)', 'Texas',
  'X (stark/takeout)', 'accepterar inbjudan', 'accepterar slaminbjudan', 'accepterar',
  'andra negativa', 'cue (krav)', 'cue (limithöjning+)', 'cue (stark tvåfärg)',
  'cue-bid', 'enkel höjning', 'enkelt inkliv', 'fjärde färg krav', 'fullföljd Texas',
  'fullföljd transfer', 'färgbud', 'gap-hand 1NT', 'hopp i egen färg (inbjudan)',
  'hoppbud (inbjudan)', 'hoppinkliv', 'höjning (GF)', 'höjning av minor',
  'höjning till utgång', 'höjning', 'inbjudan (limithöjning)', 'inbjudan',
  'inverterad minor', 'inverterad minor, svag', 'inverterad: 2NT', 'inverterad: 3NT',
  'inverterad: minimum', 'inverterad: stopp-visning', 'konkurrenshöjning', 'krav-svar',
  'minor-regeln', 'minorfråga (2NT)', 'minorsvar', 'naturligt inkliv', 'negativ dubbling',
  'ny färg (1-läget)', 'ny färg (2-läget)', 'ny färg (GF)', 'ny färg (krav)', 'ny färg',
  'oklart', 'ovanlig 2NT', 'pass', 'preferens (GF)', 'preferens', 'rebid: 2NT (18–19)',
  'rebid: 2NT (22–24)', 'rebid: 3NT (28–30)', 'rebid: 3NT (GF)', 'rebid: 3NT',
  'rebid: egen färg (GF)', 'rebid: egen färg', 'rebid: feature', 'rebid: hopp (inbjudan)', 'rebid: hoppskift',
  'rebid: krav-färg', 'rebid: ny färg', 'rebid: pass', 'rebid: reverse', 'rebid: signoff',
  'rebid: stanna', 'rebid: stöd (GF)', 'rebid: stöd', 'rebid: utgång', 'rebjuden färg',
  'redubbling', 'responsiv dubbling', 'reverse', 'semi-forcing 1NT', 'slamavslut',
  'splinter-relä', 'splinter: kortfärg', 'spärr till utgång', 'spärr', 'spärr-pass', 'spärrhöjning',
  'stark 2♣', 'stöddubbling', 'superaccept', 'svag tvåa', 'svagt hoppskift',
  'svararens pass', 'svararens signoff', 'till spel', 'transfer (2NT)',
  'trumfdam: ja + kung', 'trumfdam: ja, ingen sidokung', 'trumfdam: nej',
  'tvetydig splinter', 'upplysningsdubbling', 'utgång',
]

describe('regelregistret – kravnivå (forcing)', () => {
  it('känner en kravnivå för VARJE regel motorn producerar (fullständigt)', () => {
    const missing = ALL_ENGINE_RULES.filter((r) => forcingOf(r) === undefined)
    expect(missing).toEqual([])
  })

  it('har inga föräldralösa registerposter (varje post produceras av motorn)', () => {
    const known = new Set(ALL_ENGINE_RULES)
    const orphans = knownForcingRules().filter((r) => !known.has(r))
    expect(orphans).toEqual([])
  })

  it('facit: nyckelkonventionernas kravnivå', () => {
    // Utgångskrav (GF) får ALDRIG tappas (FAS 1 punkt 4).
    expect(forcingOf('2-över-1 GF')).toBe('utgangskrav')
    expect(forcingOf('Jacoby 2NT')).toBe('utgangskrav')
    expect(forcingOf('fjärde färg krav')).toBe('utgangskrav')
    expect(forcingOf('2♣-positivt')).toBe('utgangskrav')
    expect(forcingOf('Smolen')).toBe('utgangskrav')
    expect(forcingOf('Minor Suit Stayman')).toBe('utgangskrav')
    expect(forcingOf('tvetydig splinter')).toBe('utgangskrav')
    // Krav 1 rond.
    expect(forcingOf('ny färg (1-läget)')).toBe('krav-1-rond')
    expect(forcingOf('reverse')).toBe('krav-1-rond')
    expect(forcingOf('Stayman')).toBe('krav-1-rond')
    expect(forcingOf('Jacoby-transfer')).toBe('krav-1-rond')
    expect(forcingOf('negativ dubbling')).toBe('krav-1-rond')
    // Semi-krav (semi-forcing 1NT – öppnaren får passa).
    expect(forcingOf('semi-forcing 1NT')).toBe('semi-krav')
    // Inbjudan.
    expect(forcingOf('Bergen limit')).toBe('inbjudan')
    expect(forcingOf('2NT inbjudan')).toBe('inbjudan')
    expect(forcingOf('Drury')).toBe('inbjudan')
    // Slamintresse.
    expect(forcingOf('1430 RKC')).toBe('slamintresse')
    expect(forcingOf('cue-bid')).toBe('slamintresse')
    expect(forcingOf('4NT kvantitativ')).toBe('slamintresse')
    // Avslut.
    expect(forcingOf('pass')).toBe('avslut')
    expect(forcingOf('3NT till spel')).toBe('avslut')
    expect(forcingOf('höjning till utgång')).toBe('avslut')
    expect(forcingOf('Bergen spärr')).toBe('avslut')
    // Ej krav.
    expect(forcingOf('enkel höjning')).toBe('ej-krav')
    expect(forcingOf('enkelt inkliv')).toBe('ej-krav')
  })

  it('forcingOf(undefined) → undefined', () => {
    expect(forcingOf(undefined)).toBeUndefined()
  })
})

describe('regelregistret – alert (omlokaliserad från alerts.ts)', () => {
  it('ger EXAKT samma svar som gamla alerts.ts för varje regel (parity)', () => {
    for (const rule of ALL_ENGINE_RULES) {
      expect(isAlertRule(rule), rule).toBe(oldIsAlertRule(rule))
    }
  })

  it('facit: konstgjorda bud alertas, naturliga inte', () => {
    expect(isAlertRule('Jacoby 2NT')).toBe(true)
    expect(isAlertRule('Stayman-svar')).toBe(true) // prefix "Stayman"
    expect(isAlertRule('1430 RKC')).toBe(true)
    expect(isAlertRule('Ogust: max/bra')).toBe(true)
    expect(isAlertRule('enkelt inkliv')).toBe(false)
    expect(isAlertRule('pass')).toBe(false)
    expect(isAlertRule('1NT')).toBe(false)
    expect(isAlertRule(undefined)).toBe(false)
  })
})

describe('ruleInfo – strukturerad bild av vald regel (FAS 1 punkt 2)', () => {
  it('samlar regel + kravnivå + alert i ett objekt', () => {
    expect(ruleInfo('Jacoby 2NT')).toEqual({ rule: 'Jacoby 2NT', forcing: 'utgangskrav', alert: true })
    expect(ruleInfo('2-över-1 GF')).toEqual({ rule: '2-över-1 GF', forcing: 'utgangskrav', alert: false })
    expect(ruleInfo('pass')).toEqual({ rule: 'pass', forcing: 'avslut', alert: false })
    expect(ruleInfo(undefined)).toEqual({ rule: undefined, forcing: undefined, alert: false })
  })
})

describe('FORCING_LABEL – visningstext för kravnivån (FAS 12 punkt 56)', () => {
  it('har en läsbar svensk etikett för varje kravnivå', () => {
    expect(FORCING_LABEL['avslut']).toBe('Avslut')
    expect(FORCING_LABEL['ej-krav']).toBe('Ej krav')
    expect(FORCING_LABEL['semi-krav']).toBe('Semi-krav')
    expect(FORCING_LABEL['inbjudan']).toBe('Inbjudan')
    expect(FORCING_LABEL['krav-1-rond']).toBe('Krav 1 rond')
    expect(FORCING_LABEL['utgangskrav']).toBe('Utgångskrav')
    expect(FORCING_LABEL['slamintresse']).toBe('Slamintresse')
  })

  it('täcker exakt Forcing-typens alla nivåer (ingen glöms när typen växer)', () => {
    // Nyckelmängden låses – läggs en ny kravnivå till i Forcing-typen utan
    // etikett bryter TypeScript-bygget, och detta test låser antalet.
    expect(Object.keys(FORCING_LABEL).sort()).toEqual(
      ['avslut', 'ej-krav', 'inbjudan', 'krav-1-rond', 'semi-krav', 'slamintresse', 'utgangskrav'],
    )
  })
})
