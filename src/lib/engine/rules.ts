// Regelregistret (FAS 1). EN sanningskälla för det som hör ihop med ett bud men
// inte är själva budvalet: dess KRAVNIVÅ (forcing, §2) och om det är ett
// KONSTGJORT bud som ska ALERTAS. Budmotorns funktioner sätter `rule` (budets
// stabila identitet); registret slår upp den.
//
// Tidigare låg kravnivån bara som prosa i `explanation` och alerten i en egen
// fil (`alerts.ts`). Här samlas båda så att samma regel styr budval, förklaring,
// kravstatus och alert.
//
// `forcing` är en KARTA över systembokens kravnivåer. Den kan förfinas under en
// facit-driven granskning (arbetsregel A) – testerna i `rules.test.ts` låser
// fast nyckelfallen så ändringar inte sker av misstag.

import type { Forcing } from '../../types/bridge'

// === Alert: vilka regler är konstgjorda (alertpliktiga)? ====================
// Flyttad hit från alerts.ts (oförändrad lista → oförändrat beteende). Matchas
// som PREFIX på regelnamnet, så hela en konventions undersekvens fångas av ett
// namn (t.ex. "Stayman" täcker "Stayman-svar").

const ALERT_RULE_PREFIXES: string[] = [
  'tvetydig splinter',
  'splinter-relä',
  'Jacoby 2NT',
  'Jacoby-transfer',
  'transfer', // "transfer (2NT)"
  'Texas',
  'Stayman', // ask + svar (hela Stayman-sekvensen)
  'Minor Suit Stayman',
  'minorfråga (2NT)',
  'Bergen',
  'semi-forcing 1NT',
  'inverterad minor',
  'inverterad: stopp',
  'Drury',
  'Smolen',
  'fjärde färg krav',
  '2♦ väntebud',
  'stark 2♣',
  // Slamverktyg (konstgjorda frågor/svar)
  '1430 RKC',
  'Sjöberg',
  'Gerber',
  'Exclusion',
  'cue',
  'trumfdam',
  // Konkurrens / försvar
  'Michaels',
  'ovanlig 2NT',
  'upplysningsdubbling',
  'negativ dubbling',
  'responsiv dubbling',
  'stöddubbling',
  'Lebensohl',
  'DONT',
  'Mathe',
  'Ogust',
  'X (stark/takeout)',
]

/** Sant om budets regel motsvarar ett konstgjort (alertpliktigt) bud. */
export function isAlertRule(rule: string | undefined): boolean {
  if (!rule) return false
  return ALERT_RULE_PREFIXES.some((p) => rule.startsWith(p))
}

// === Kravnivå (forcing) per regel ===========================================
// Nyckeln är det EXAKTA regelnamnet motorn sätter. Värdet är budets kravnivå
// enligt systembokens §2 (+ "semi-krav" för semi-forcing 1NT, §4.1).

const FORCING_BY_RULE: Record<string, Forcing> = {
  // ---- Öppningar ----
  '1NT': 'ej-krav',
  '2NT': 'ej-krav',
  '3NT': 'avslut',
  'stark 2♣': 'utgangskrav',
  '5-korts högfärg': 'ej-krav',
  'minor-regeln': 'ej-krav',
  spärr: 'avslut',
  'svag tvåa': 'ej-krav',

  // ---- Generiska avslut / pass ----
  pass: 'avslut',
  'rebid: pass': 'avslut',
  'svararens pass': 'avslut',
  'spärr-pass': 'avslut',
  'till spel': 'avslut',
  utgång: 'avslut',
  'rebid: utgång': 'avslut',
  'rebid: signoff': 'avslut',
  'rebid: stanna': 'avslut',
  'svararens signoff': 'avslut',
  accepterar: 'avslut',
  'accepterar inbjudan': 'avslut',
  'accepterar slaminbjudan': 'avslut',
  'höjning till utgång': 'avslut',
  'spärr till utgång': 'avslut',
  spärrhöjning: 'avslut',
  'svagt hoppskift': 'avslut',
  '3NT till spel': 'avslut',
  '6NT till spel': 'avslut',
  slamavslut: 'avslut',
  'fullföljd Texas': 'avslut',
  oklart: 'ej-krav',

  // ---- Inbjudningar ----
  inbjudan: 'inbjudan',
  'inbjudan (limithöjning)': 'inbjudan',
  '2NT inbjudan': 'inbjudan',
  '2NT (18–19)': 'inbjudan',
  'rebid: 2NT (18–19)': 'inbjudan',
  'rebid: hopp (inbjudan)': 'inbjudan',
  'hopp i egen färg (inbjudan)': 'inbjudan',
  'hoppbud (inbjudan)': 'inbjudan',

  // ---- Naturliga, ej krav ----
  '1NT (12–14)': 'ej-krav',
  'gap-hand 1NT': 'ej-krav',
  'rebid: 2NT (22–24)': 'ej-krav',
  'rebid: 3NT (28–30)': 'ej-krav',
  'enkel höjning': 'ej-krav',
  'höjning av minor': 'ej-krav',
  höjning: 'ej-krav',
  konkurrenshöjning: 'ej-krav',
  preferens: 'ej-krav',
  'ny färg': 'ej-krav',
  'ny färg (2-läget)': 'ej-krav',
  'rebid: ny färg': 'ej-krav',
  'rebjuden färg': 'ej-krav',
  'rebid: egen färg': 'ej-krav',
  'rebid: stöd': 'ej-krav',
  'NT med stopp': 'ej-krav',
  'NT-svar': 'ej-krav',
  'andra negativa': 'ej-krav',
  'fullföljd transfer': 'ej-krav',
  färgbud: 'ej-krav',
  superaccept: 'ej-krav',
  minorsvar: 'ej-krav',

  // ---- Krav 1 rond ----
  'ny färg (1-läget)': 'krav-1-rond',
  'ny färg (krav)': 'krav-1-rond',
  reverse: 'krav-1-rond',
  'rebid: reverse': 'krav-1-rond',
  'rebid: krav-färg': 'krav-1-rond',
  'krav-svar': 'krav-1-rond',
  redubbling: 'krav-1-rond',

  // ---- Utgångskrav (GF) ----
  '2-över-1 GF': 'utgangskrav',
  'ny färg (GF)': 'utgangskrav',
  'rebid: hoppskift': 'utgangskrav',
  'rebid: egen färg (GF)': 'utgangskrav',
  'rebid: stöd (GF)': 'utgangskrav',
  'rebid: 3NT (GF)': 'avslut',
  'rebid: 3NT': 'avslut',
  'höjning (GF)': 'utgangskrav',
  'preferens (GF)': 'utgangskrav',
  '2♣-positivt': 'utgangskrav',
  '2♦ väntebud': 'utgangskrav',
  'fjärde färg krav': 'utgangskrav',

  // ---- Konventionella höjningar / svar (§4.1) ----
  'tvetydig splinter': 'utgangskrav',
  'splinter-relä': 'slamintresse',
  'Jacoby 2NT': 'utgangskrav',
  'Jacoby: sidofärg': 'utgangskrav',
  'Jacoby: kortfärg': 'utgangskrav',
  'Jacoby: 3NT': 'utgangskrav',
  'Jacoby: slamintresse': 'slamintresse',
  'Jacoby: minimum': 'avslut',
  'Bergen konstruktiv': 'inbjudan',
  'Bergen limit': 'inbjudan',
  'Bergen spärr': 'avslut',
  'Bergen game try': 'krav-1-rond',
  'semi-forcing 1NT': 'semi-krav',
  'inverterad minor': 'krav-1-rond',
  'inverterad minor, svag': 'avslut',
  'inverterad: stopp-visning': 'krav-1-rond',
  'inverterad: 2NT': 'ej-krav',
  'inverterad: 3NT': 'avslut',
  'inverterad: minimum': 'ej-krav',

  // ---- NT-konventioner (§4.3) ----
  Stayman: 'krav-1-rond',
  'Stayman-svar': 'ej-krav',
  'Stayman (2NT)': 'krav-1-rond',
  'Jacoby-transfer': 'krav-1-rond',
  'transfer (2NT)': 'krav-1-rond',
  Texas: 'krav-1-rond',
  'Texas (2NT)': 'krav-1-rond',
  Smolen: 'utgangskrav',
  'Minor Suit Stayman': 'utgangskrav',
  'MSS-svar': 'utgangskrav',
  'minorfråga (2NT)': 'slamintresse',
  '4NT kvantitativ': 'slamintresse',

  // ---- Drury (§6.7) ----
  Drury: 'inbjudan',
  'Drury: lätt öppning': 'avslut',
  'Drury: riktig öppning': 'avslut',
  'Drury: utgångsförsök': 'inbjudan',

  // ---- Slamverktyg (§6) ----
  '1430 RKC': 'slamintresse',
  'cue-bid': 'slamintresse',
  'Sjöberg 5NT': 'slamintresse',
  Gerber: 'slamintresse',
  'Gerber kungfråga': 'slamintresse',
  'Gerber: stannar': 'avslut',
  Exclusion: 'slamintresse',
  'trumfdam: nej': 'slamintresse',
  'trumfdam: ja, ingen sidokung': 'slamintresse',
  'trumfdam: ja + kung': 'slamintresse',

  // ---- Försvar / konkurrens (§7) ----
  'enkelt inkliv': 'ej-krav',
  hoppinkliv: 'ej-krav',
  '1NT-inkliv': 'ej-krav',
  Michaels: 'ej-krav',
  'ovanlig 2NT': 'ej-krav',
  'naturligt inkliv': 'ej-krav',
  'cue (limithöjning+)': 'krav-1-rond',
  'cue (krav)': 'utgangskrav',
  'cue (stark tvåfärg)': 'ej-krav',
  upplysningsdubbling: 'krav-1-rond',
  'negativ dubbling': 'krav-1-rond',
  'responsiv dubbling': 'krav-1-rond',
  stöddubbling: 'ej-krav',
  'X (stark/takeout)': 'krav-1-rond',
  // Lebensohl
  'Lebensohl 2NT (svag)': 'ej-krav',
  'Lebensohl direkt 3-läge (krav)': 'utgangskrav',
  'Lebensohl cue (Stayman, krav)': 'utgangskrav',
  'Lebensohl 2NT (slow → 3NT, visar stopp)': 'utgangskrav',
  '3NT direkt (förnekar stopp)': 'avslut',
  // DONT
  'DONT tvåfärg': 'ej-krav',
  'DONT 2♠ (spader)': 'ej-krav',
  'DONT X (enfärg)': 'ej-krav',
  'DONT relä': 'ej-krav',
  // Mathe / Multi / svaga
  'Mathe X (högfärger)': 'ej-krav',
  'Mathe 1NT (minorer)': 'ej-krav',
  '2NT-inkliv (15–18)': 'ej-krav',
  '2NT (15–18)': 'ej-krav',
  // Ogust (ask = krav, stegsvar = beskriver)
  Ogust: 'krav-1-rond',
  'Ogust: min/dålig': 'ej-krav',
  'Ogust: min/bra': 'ej-krav',
  'Ogust: max/dålig': 'ej-krav',
  'Ogust: max/bra': 'ej-krav',
  'Ogust: max/utmärkt': 'ej-krav',
}

/** Kravnivå (§2) för ett bud givet dess regel, eller undefined om okänd. */
export function forcingOf(rule: string | undefined): Forcing | undefined {
  return rule ? FORCING_BY_RULE[rule] : undefined
}

/** Strukturerad bild av den VALDA regeln bakom ett bud (grund för regelspårning). */
export interface RuleInfo {
  rule: string | undefined
  forcing: Forcing | undefined
  alert: boolean
}

/**
 * Den valda regelns kravnivå + alert i ETT objekt – så att budval, kravstatus
 * och alert alltid läses ur samma regel. Lättviktsgrunden för FAS 1 punkt 2
 * (regelspårning); den tunga "matchande/avvisade regler"-loggningen byggs senare.
 */
export function ruleInfo(rule: string | undefined): RuleInfo {
  return { rule, forcing: forcingOf(rule), alert: isAlertRule(rule) }
}

/** Alla regelnamn som registret känner till en kravnivå för (för tester). */
export function knownForcingRules(): string[] {
  return Object.keys(FORCING_BY_RULE)
}
