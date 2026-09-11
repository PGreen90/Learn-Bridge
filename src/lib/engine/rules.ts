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
  'splinter: kortfärg',
  'game try: kortfärg',
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
  'passad höjning: stopp', // ny färg = stopp, inte längd (§4.2 "Passad hand")
  'Drury',
  'Smolen',
  'fjärde färg krav',
  'New Minor Forcing', // konstgjord fråga (§5.7)
  '2NT-checkback', // konstgjord fråga (§5.2)
  '2♦ väntebud',
  'stark 2♣',
  // Slamverktyg (konstgjorda frågor/svar)
  '1430 RKC',
  'Sjöberg',
  'Gerber',
  'Exclusion',
  // Cue-buden är konstlade; deras NATURLIGA fortsättningar/avslut ('cue-höjningens
  // fortsättning', 'cue: avslut') är det inte — därför de exakta prefixen i stället
  // för det breda 'cue' (familj 9: registret alertade fortsättningarna av misstag).
  'cue-bid',
  'cue (',
  // Övriga cue-BUD i konkurrens är också konstlade och alertpliktiga (familj 9:
  // registret alertade dem inte tidigare). Deras SVAR ('svar på … cue') och
  // FORTSÄTTNINGAR ('cue-höjningens fortsättning') är naturliga → alertas inte.
  'öppnarens cue',
  'negativ-dubblarens cue',
  'stöd-cue',
  'fritt bud: cue',
  'trumfdam',
  // Konkurrens / försvar
  'Michaels',
  'ovanlig 2NT',
  '2NT-inkliv: transfer', // systems on efter vårt 2NT-inkliv (konstgjord transfer)
  'upplysningsdubbling',
  'negativ dubbling',
  'responsiv dubbling',
  'stöddubbling',
  'Jordan 2NT',
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
  lättöppning: 'ej-krav',
  'regeln om 15': 'ej-krav',
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
  'RKC: rättelse': 'avslut',
  // Öppnaren avböjer svararens 2NT-inbjudan och rättar till en känd fit / egen
  // 6-korts högfärg under utgång (1NT–2M(transfer)–2M–2NT–3M, 1M–1NT–2M–2NT–3M).
  // Ett AVSLUT: partnern får passa — annars återöppnas en avgjord auktion
  // (motorbytet slutkärnan 2026-09-11). Skild från `preferens` (levande) som
  // gäller andra svar.
  'avböjer inbjudan: rättelse': 'avslut',
  'fullföljd Texas': 'avslut',
  oklart: 'ej-krav',

  // ---- Inbjudningar ----
  inbjudan: 'inbjudan',
  'inbjudan (limithöjning)': 'inbjudan',
  'inbjudan (ny färg)': 'inbjudan', // ny färg på 3-läget efter 1M–1NT–2x: 6+ kort, 10–11 (§5.1, §5b beslut 11)
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
  'ny färg efter 1NT': 'ej-krav',
  'rebid: ny färg': 'ej-krav',
  'rebjuden färg': 'ej-krav',
  'rebid: egen färg': 'ej-krav',
  'rebid: stöd': 'ej-krav',
  'rebid: feature': 'ej-krav',
  'NT med stopp': 'ej-krav',
  'NT-svar': 'ej-krav',
  'andra negativa': 'ej-krav',
  'fullföljd transfer': 'ej-krav',
  färgbud: 'ej-krav',
  superaccept: 'inbjudan', // hoppet till 3M inbjuder utgång (§4.3); var felaktigt 'ej-krav' (rättat 2026-09-04)
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
  // Öppnarens §5.3-återbud efter 2/1 (felrapport #58: saknade kravnivå).
  'rebid: ny färg (GF)': 'utgangskrav',
  'rebid: 2NT (GF)': 'utgangskrav',
  '2/1: hopphöjning (slamdriv)': 'slamintresse', // 1m–2m′–2NT–4m: trumf satt + slamdriv (§5.3, §5b beslut 12)
  // 2/1 med försenat lågfärgsstöd (ägarbeslut 2026-09-03): 3m sätter trumf i
  // krav; öppnarens 3NT är ett förslag kaptenen får passa, 4m håller kravet.
  '2/1: försenat stöd': 'utgangskrav',
  '2/1: sangförslag': 'ej-krav',
  '2/1: höjning (GF)': 'utgangskrav',
  'rebid: hoppskift': 'utgangskrav',
  hoppskift: 'utgangskrav',
  'rebid: egen färg (GF)': 'utgangskrav',
  // Svararens andra bud efter 2♣–positivt–öppnarens egen färg (§5b beslut 7),
  // och öppnarens rättelse av partnerns 3NT med 6+ i egen högfärg.
  '2♣: rebud egen färg (GF)': 'utgangskrav',
  'rättelse till högfärg': 'avslut',
  // Öppnarens svar på svararens naturliga nya färg efter 2/1 (§5b beslut 13).
  '2/1: svar på ny färg': 'utgangskrav',
  '2/1: placerar utgång': 'avslut',
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
  'splinter: kortfärg': 'slamintresse',
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
  'game try: kortfärg': 'inbjudan',
  'game try: accepterar': 'avslut',
  'game try: signoff': 'avslut',
  'semi-forcing 1NT': 'semi-krav',
  'inverterad minor': 'krav-1-rond',
  'inverterad minor, svag': 'avslut',
  'inverterad: stopp-visning': 'krav-1-rond',
  'inverterad: 2NT': 'ej-krav',
  'inverterad: 3NT': 'avslut',
  'inverterad: minimum': 'ej-krav',
  'inverterad: broms': 'ej-krav', // B13: svararens 3m = "bara minimum 10–12"
  // Passad hands enkla minorhöjning (§4.2 "Passad hand", §5b beslut 5): svaret
  // heter 'enkel höjning' (ej krav, nedan); öppnarens fortsättning:
  'passad höjning: 2NT': 'inbjudan',
  'passad höjning: stopp-visning': 'krav-1-rond',
  'passad höjning: 3NT': 'avslut',
  'passad höjning: broms': 'ej-krav',

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
  'Minor Suit Stayman: höjning': 'slamintresse',
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
  'fritt bud': 'krav-1-rond',
  'höjning av fritt bud': 'ej-krav',
  'höjning av fritt bud (inbjudan)': 'inbjudan',
  'höjning av fritt bud (utgång)': 'avslut',
  'inbjudan efter höjt fritt bud': 'inbjudan',
  'utgång efter höjt fritt bud': 'avslut',
  'preferens till inklivsfärgen': 'ej-krav',
  // Inkliv och advance (etapp 4 familj 1, 2026-09-08)
  'fit-jump': 'inbjudan',
  'advance tvåfärg (preferens)': 'ej-krav',
  'advance tvåfärg (pass-eller-rätta minor)': 'ej-krav',
  'tvåfärgsinkliv: flykt': 'ej-krav',
  'tvåfärgsinkliv: bjuder vidare (stark)': 'ej-krav',
  'stöd åt advancern': 'ej-krav',
  'inklivaren svarar cue-höjning (utgång)': 'avslut',
  'inklivaren svarar cue-höjning (minimum)': 'ej-krav',
  'inklivaren svarar fit-jump (utgång)': 'avslut',
  'inklivaren svarar fit-jump (minimum)': 'ej-krav',
  'tvåfärgsinkliv: passar pass-eller-rätta': 'avslut',
  'tvåfärgsinkliv: rättar till ruter': 'ej-krav',
  'överklivaren tävlar (cue-höjning)': 'ej-krav',
  'advancern tävlar till fiten (lagen om totala stick)': 'ej-krav',
  'advancern bjuder utgång med fit (konkurrens)': 'avslut',
  'cue-höjningens fortsättning': 'avslut',
  'cue-höjningens fortsättning (limit stannar)': 'avslut',
  'konkurrens-slaminvit (RKC)': 'slamintresse',
  'konkurrens-slam: placering': 'avslut',
  'konkurrens-slam: stopp': 'avslut',
  // Dubblingsfamiljen (etapp 4 familj 2, 2026-09-08)
  'dubblaren höjer till 3NT': 'avslut',
  'svar på dubblarens cue': 'utgangskrav',
  'cue (krav)': 'utgangskrav',
  'Jordan 2NT': 'inbjudan',
  'cue (stark tvåfärg)': 'ej-krav',
  upplysningsdubbling: 'krav-1-rond',
  'negativ dubbling': 'krav-1-rond',
  'responsiv dubbling': 'krav-1-rond',
  stöddubbling: 'ej-krav',
  'X (stark/takeout)': 'krav-1-rond',
  // Öppnarens och svararens fortsättning när de stört (etapp 4 familj 4, 2026-09-08)
  'svar på cue-höjning': 'ej-krav',
  'öppnaren bjuder utgång i konkurrens': 'avslut',
  'öppnaren bjuder 3NT i konkurrens': 'avslut',
  'maximal dubbling (game try)': 'inbjudan',
  'öppnaren konkurrerar (6:e trumfen)': 'ej-krav',
  'öppnaren passar i konkurrens': 'ej-krav',
  'accepterar game-try': 'avslut',
  'avböjer game-try': 'avslut',
  'avböjer sanginbjudan': 'avslut',
  'öppnarens 3NT i konkurrens': 'avslut',
  'öppnarens 2NT-inbjudan i konkurrens': 'inbjudan',
  'öppnarens cue (utgångskrav i konkurrens)': 'utgangskrav',
  'öppnarens cue (extra i konkurrens)': 'krav-1-rond',
  'öppnarens inbjudande höjning (konkurrens)': 'inbjudan',
  'öppnarens höjning (konkurrens)': 'ej-krav',
  'öppnaren tävlar (egen 6+ färg)': 'ej-krav',
  'öppnaren tävlar (stödjer partnern)': 'ej-krav',
  'öppnaren tävlar efter partnerns pass (egen 6+ färg)': 'ej-krav',
  'öppnarens återöppningsdubbling (partnern passade)': 'krav-1-rond',
  'öppnarens återöppningsdubbling (utpassningssits)': 'krav-1-rond',
  'öppnaren tävlar i utpassningssits (egen 6+ färg)': 'ej-krav',
  'öppnarens återöppningsdubbling (extra, utpassningssits)': 'krav-1-rond',
  'återbud i konkurrens: egen 6+ färg': 'ej-krav',
  'återbud i konkurrens: sang': 'ej-krav',
  'återbud i konkurrens: sang (18–19)': 'inbjudan',
  'återbud i konkurrens: ny färg': 'ej-krav',
  'återbud i konkurrens: reverse': 'krav-1-rond',
  'återbud i konkurrens: egen färg (minimum)': 'ej-krav',
  'svar på partnerns cue': 'krav-1-rond',
  'fritt bud: utgång i egen färg': 'avslut',
  'fritt bud: rebjuder egen färg': 'inbjudan',
  'fritt bud: utgång med fit': 'avslut',
  'fritt bud: utgång i sang': 'avslut',
  'fritt bud: stannar': 'ej-krav',
  'fritt bud: cue (utgångskrav)': 'utgangskrav',
  'svar på återöppningsdubbling': 'ej-krav',
  'svar på återöppningsdubbling (utgång)': 'avslut',
  'straffpass (återöppningsdubbling)': 'avslut',
  'fritt bud: inbjudande höjning': 'inbjudan',
  'negativ-dubblarens cue (utgångskrav)': 'utgangskrav',
  // När de stör vår öppning (etapp 4 familj 3, 2026-09-08)
  'negativ-dubblarens utgång': 'avslut',
  'negativ-dubblarens invit-fortsättning': 'inbjudan',
  'negativ-dubblarens preferens': 'ej-krav',
  'höjning efter negativ dubbling (utgång)': 'avslut',
  'höjning efter negativ dubbling (inbjudan)': 'inbjudan',
  'höjning efter negativ dubbling (enkel)': 'ej-krav',
  straffdubbling: 'ej-krav',
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
  // Systems on efter vårt 2NT-inkliv (live-prov 2026-09-11): advancerns
  // transfer (krav 1 rond), inklivarens fullföljning, super-accept och
  // advancerns rebud.
  '2NT-inkliv: transfer': 'krav-1-rond',
  '2NT-inkliv: fullföljd transfer': 'ej-krav',
  '2NT-inkliv: super-accept': 'avslut',
  '2NT-inkliv: till spel': 'avslut',
  '2NT-inkliv: inbjudan': 'ej-krav',
  '2NT-inkliv: utgång': 'avslut',
  '2NT-inkliv: stannar': 'avslut',
  // Ogust (ask = krav, stegsvar = beskriver)
  Ogust: 'krav-1-rond',
  'Ogust: min/dålig': 'ej-krav',
  'Ogust: min/bra': 'ej-krav',
  'Ogust: max/dålig': 'ej-krav',
  'Ogust: max/bra': 'ej-krav',
  'Ogust: max/utmärkt': 'ej-krav',

  // ---- Regler som saknade kravnivå (betydelsesvepet, motorbytet etapp 1) ----
  // Ostörda sekvenser: NMF (§5.7), checkback (§5.2), fjärde färg (§6.6),
  // 2/1-fortsättningar (§5.3), inbjudningar, slaminbjudan (§5.2), kravsteget.
  'New Minor Forcing': 'krav-1-rond',
  'svar på New Minor Forcing': 'ej-krav',
  'placering efter NMF': 'avslut',
  // §5b beslut 1 (2026-09-05): färgvisningen efter NMF utan stöd — svararens
  // 3M/3m (slamintresse, utgångskrav) och öppnarens svar (4M / 3NT-förslag / 4m).
  'NMF: rebjuder egen högfärg': 'utgangskrav',
  'NMF: höjer öppnarens lågfärg': 'utgangskrav',
  'NMF: trumfen satt': 'ej-krav',
  'NMF: sangförslag': 'ej-krav',
  'NMF: höjning (GF)': 'utgangskrav',
  // §5b beslut 3 (2026-09-05): fast arrival efter reverse i högfärg.
  'reverse: höjning (stark)': 'utgangskrav',
  'reverse: utgång': 'avslut',
  '2NT-checkback': 'krav-1-rond',
  'svar på 2NT-checkback': 'ej-krav',
  'placering efter 2NT-checkback': 'avslut',
  '2NT-återbud (5-3-jakt)': 'krav-1-rond',
  'svar på 2NT-återbud (5-3-jakt)': 'avslut',
  'svar på fjärde färg': 'utgangskrav',
  'fjärde färg: placerar utgång': 'avslut',
  'fjärde färg: utgång i fit': 'avslut',
  '2/1: fortsättning': 'utgangskrav',
  '2/1 utgångskrav': 'avslut', // svararen sätter utgång efter öppnarens höjning av 2/1-högfärgen (felrapport #27; beslutstabellen familj 4a)
  'rebjuden färg (inbjudan)': 'inbjudan',
  'hopphöjning (inbjudan)': 'inbjudan',
  'inbjudan antagen': 'avslut',
  'accepterar sanginbjudan': 'avslut',
  'väljer högfärgsutgång': 'avslut',
  'väljer utgång efter Smolen': 'avslut',
  'Drury: accepterar utgångsförsök': 'avslut',
  slaminbjudan: 'slamintresse',
  'slaminbjudan: accept': 'avslut',
  'slamtrevare efter 3NT': 'slamintresse',
  'cue: avslut': 'avslut',
  // Kravstegets tvångsbud ("auktionen är krav – jag får inte passa"): kravet
  // som tvingar är i ostörda auktioner utgångskravet (2♣, 2/1, fjärde färg).
  'krav – rebjuder egen färg': 'utgangskrav',
  'krav – stödjer partnern': 'utgangskrav',
  'krav – ny färg': 'utgangskrav',
  'krav – sang': 'utgangskrav',
  'stöd-cue (slamintresse)': 'slamintresse',
  'RKC: stopp': 'avslut',

  // ---- Störda regler som saknade kravnivå (betydelsesvepet, etapp 4 familj 9) ----
  // Konkurrens/försvar-fortsättningar som motorn producerade men registret inte
  // bar kravnivå för. Värdena speglar systemets mening; betydelselagret läser
  // samma nivå ur den nakna auktionen (auction-meaning.probe.test.ts vaktar).
  // Dubblingsfamiljen:
  'svar på negativ dubbling': 'ej-krav',
  'upplysningsdubbling (stark)': 'krav-1-rond',
  'fritt svar på upplysningsdubbling': 'ej-krav',
  'straff/värden': 'ej-krav',
  'öppnarens svar på värde-X': 'ej-krav',
  'svar på öppnarens värde-X-fortsättning': 'ej-krav',
  'redubbling (värden)': 'krav-1-rond',
  'svar på stöddubbling': 'ej-krav',
  'dubblaren höjer (inbjudan)': 'inbjudan',
  'dubblaren accepterar inbjudan': 'avslut',
  'dubblaren bjuder utgång': 'avslut',
  'dubblarens svar på cue': 'utgangskrav',
  'starkt återbud': 'krav-1-rond',
  'starkt återbud (lägsta)': 'krav-1-rond',
  'tvångssvar (utan stöd)': 'krav-1-rond',
  'svar på tvåfärgs-cue': 'utgangskrav',
  // Naturliga inkliv / höjningar / avslut:
  'naturligt (to play)': 'ej-krav',
  'naturligt inkliv (1NT)': 'ej-krav',
  '2NT-inkliv (12–15)': 'ej-krav',
  'stödhöjning – utgång': 'avslut',
  'stödhöjning – enkel höjning (minimum)': 'ej-krav',
  'stödhöjning – hopphöjning (inbjudan)': 'inbjudan',
  'accepterar (minimum)': 'avslut',
  'accepterar utgång': 'avslut',
  'placerar utgång efter öppnarens 2NT': 'avslut',
  'cue-advancerns dom (3NT)': 'avslut',
  // Jordan-fortsättningar:
  'Jordan: utgång': 'avslut',
  'Jordan: minimum': 'ej-krav',
  'Jordan: höjning till utgång': 'avslut',
  // DONT-fortsättningar:
  'DONT pass-eller-rätta': 'ej-krav',
  'DONT: rättelse (tvåfärg)': 'ej-krav',
  'DONT: rättelse': 'ej-krav',
  // Lebensohl-fortsättningar (över deras inkliv av vårt 1NT):
  'Lebensohl 3NT (utgång)': 'avslut',
  'Lebensohl 3NT (öppnaren väljer utgång)': 'avslut',
  'Lebensohl 3♣ (tvunget relä-svar)': 'ej-krav',
  'Lebensohl 3-läge (svag, rättar)': 'ej-krav',
  'Lebensohl naturligt 2-läge': 'ej-krav',
}

/** Kravnivå (§2) för ett bud givet dess regel, eller undefined om okänd. */
export function forcingOf(rule: string | undefined): Forcing | undefined {
  return rule ? FORCING_BY_RULE[rule] : undefined
}

/**
 * Visningstext för kravnivån (FAS 12 punkt 56): det UI:t skriver ut när det
 * visar ett buds kravstatus. Ligger här (inte i komponenten) så att etiketten
 * hör till samma regelregister som kravnivån själv – Record<Forcing, string>
 * tvingar en etikett för varje nivå när typen växer.
 */
export const FORCING_LABEL: Record<Forcing, string> = {
  avslut: 'Avslut',
  'ej-krav': 'Ej krav',
  'semi-krav': 'Semi-krav',
  inbjudan: 'Inbjudan',
  'krav-1-rond': 'Krav 1 rond',
  utgangskrav: 'Utgångskrav',
  slamintresse: 'Slamintresse',
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
