// Avgör om ett bud är KONSTGJORT (konventionellt) och därmed ska "alertas" – dvs
// inte betyder sin naturliga färg/innebörd. Används av auktionsvyn för att sätta
// ett litet blått "A" på sådana bud. Bedömningen görs på budmotorns regelnamn
// (`rule`). Listan är pedagogisk: vi flaggar de konventioner en nybörjare lätt
// missförstår (transfers, Stayman, splinter, Jacoby 2NT, Bergen, RKC/Blackwood-
// familjen, cue-bud, Drury, Michaels, ovanlig 2NT, DONT, Lebensohl, Ogust,
// Smolen, fjärde färg krav, Gerber, Exclusion, konventionella dubblingar m.m.).
//
// Saknas en regel i listan ritas bara inget A – det är aldrig fel, bara en
// utelämnad markering. Lägg till nya konventioner här när motorn växer.

/** Regelnamn (eller prefix på dem) som motsvarar konstgjorda/alertpliktiga bud. */
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
  'Bergen', // Bergen-höjningar
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
  'cue', // cue-bid / cue (krav) / cue (limithöjning+) / cue (stark tvåfärg)
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
