// Kopplar in slamverktygen (slam.ts) i en VÄXANDE auktion — ÄRLIGT.
//
// ÄGARBESLUT 2026-07-07 ("ärliga slamportar"): varje budbeslut fattas på
// bjudarens EGEN hand + vad partnern VISAT via buden (intervall/löften), ALDRIG
// på partnerns faktiska kort. Bottarna får missa eller felbedöma en slam — de
// ska följa ett korrekt mänskligt system. Kaptenen (svararen) räknar sin egen
// hand mot partnerns visade MINIMUM:
//
//   egen + visat minimum ≥ 33   → DRIV: 4NT RKC direkt
//   egen + visat minimum 31–32  → INBJUDAN (om läget har ett inbjudningsbud):
//                                 partnern accepterar med mer än blott minimum
//   annars                      → null (den vanliga auktionen står kvar)
//
// Ess-/kungsvaren är ärliga (svararens egen hand). Kaptenen HÄRLEDER partnerns
// nyckelkort ur svaret + sin egen hand. 1430-svarens inbyggda tvetydighet
// (5♣ = 1 eller 4, 5♦ = 0 eller 3) löses så här:
//   1. egen hand: omöjliga alternativ stryks (summan kan aldrig överstiga 5),
//   2. mänsklig inferens: har partnern visat 15+ antas det HÖGA alternativet
//      (en stark hand är i praktiken aldrig nyckelkortslös),
//   3. annars antas det LÅGA och kaptenen stannar i 5-trumf — partnern som
//      faktiskt satt med det höga antalet RÄTTAR då själv upp till 6
//      (klassisk mänsklig mekanik: "med 3, bjud vidare över stoppbudet").
//
// Cue-ronden (§6.2) är ÅTERINFÖRD (ägarbeslut 2026-08-03, river 2026-07-07):
// när UTGÅNG är etablerad (`SlamContext.gameForcing`) cue-bjuder motorn kontroller
// under utgång FRITT (gratis — inget att förlora), och flyttar poängomdömet till
// beslutet att gå FÖRBI utgången (4NT RKC). Ärligt: varje hand cue:ar sina EGNA
// kontroller och läser partnerns visade (ingen tjuvkiks-gate). Se cueSlamAuction.
// Cue-bud TILLKOMMER bara — saknar kaptenen en gratis cue står de gamla vägarna
// (driv 33+ / inbjudan 31–32) kvar oförändrade.

//
// MOTORBYTET etapp 3 familj 5 (2026-09-05): slamutredningen PER STOL. Varje
// tur i en slamsekvens tas ur EN hand + vad auktionen visat: `slamTurn(role,
// hand, setup, sofar)` ger nästa bud för stolen `role` givet uppsättningen
// (trumf + kaptenens kontext, allt ur auktionen) och sekvensens bud hittills.
// Beslutstabellen (`auction-decide.ts`, raden *slam*) anropar den vid bordet,
// och sedan familj 6 (2026-09-05) går även manusets ostörda linje genom
// tabellen — ingen tur ser den andra handen. `slamInvestigation`/
// `exclusionInvestigation`/`mssMinorFitContinuation` (`playSlam`) är kvar
// BARA som tvåhandsförare åt facit-testerna; ingen motorkod anropar dem.

import type { Hand, Suit } from '../../types/bridge'
import { bergenPoints, dummyPoints, wastedHonorsOppositeShortness } from './evaluation'
import { hcp, lengths } from './hand'
import {
  exclusionKeycards,
  firstRoundControl,
  hasTrumpQueen,
  keycards,
  respondToExclusion,
  respondToKingAsk,
  respondToRKC,
} from './slam'

const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const SUIT_OF_LETTER_: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/** Budets rang i stegen (1♣=0 … 7NT=34) så vi kan jämföra om ett bud är lagligt (högre). */
const STRAIN_ORDER = ['C', 'D', 'H', 'S', 'NT']
function bidRank(call: string): number {
  const m = call.match(/^([1-7])(C|D|H|S|NT)$/)
  if (!m) return -1 // Pass/X/XX – ingen nivå
  return (parseInt(m[1], 10) - 1) * 5 + STRAIN_ORDER.indexOf(m[2])
}

/** Stolen i en slamsekvens: kaptenen är alltid svararen, partnern öppnaren. */
export type SlamRole = 'öppnare' | 'svarare'
const CAPTAIN: SlamRole = 'svarare'
const other = (r: SlamRole): SlamRole => (r === 'svarare' ? 'öppnare' : 'svarare')

/** Ett extra steg i slamutredningen, med roll i stället för plats (sätts i buildAuction). */
export interface SlamTurn {
  role: SlamRole
  call: string
  rule: string
  explanation: string
}

/** Ett bud i den pågående slamsekvensen, som det syns i auktionen (bara vår sidas kontraktsbud; passen är underförstådda). */
export interface SlamBid {
  role: SlamRole
  call: string
}

/** Vad kaptenen VET om partnern ur auktionen (aldrig partnerns kort). */
export interface SlamContext {
  /** Undre gränsen i partnerns visade intervall (t.ex. 12 för 1NT-återbudet, 16 för hopphöjning). */
  partnerMin: number
  /** Inbjudningsbudet i kanske-zonen (t.ex. '5H' eller '4C'). Utelämnas = ingen inbjudan möjlig i läget. */
  inviteCall?: string | null
  /** Är UTGÅNG redan etablerad (GF)? Då är cue-bud under utgång GRATIS (§6.2) —
   *  motorn cue:ar kontroller utan poänggräns och flyttar omdömet till beslutet
   *  att gå FÖRBI utgången (ägarbeslut 2026-08-03). Utelämnat/false = gammalt
   *  beteende (inbjudan/driv på poäng, ingen cue). */
  gameForcing?: boolean
  /** Golv för cue-ronden (B13, 2026-08-07): cue-bud läggs bara STRIKT ÖVER det
   *  här budet. I minorfit-lägen är golvet '3NT' — under 3NT betyder nya färger
   *  STOPP-letande (§4.2), över 3NT kontrollbud — så budspråken aldrig krockar.
   *  Utelämnat = cue direkt över senaste budet (högfärgslägena). */
  cueFloor?: string
  /**
   * Kaptenen räknar BARA hp (inte stödpoäng) mot partnerns visade minimum —
   * §5.2 "Slam efter 1NT-återbudet": trumfen är kaptenens egen 6+ högfärg
   * eller 5+ i öppnarens minor, ingen bjuden fit, så kortfärger får inte
   * lyfta värderingen (facit frö 20261317: 15 hp 6-korts spader → 4♥ via NMF,
   * inte slaminbjudan; motorbytet etapp 3 familj 4a, 2026-09-05).
   */
  hpOnly?: boolean
}

/**
 * Uppsättningen för en slamsekvens — allt ur AUKTIONEN: trumfen, budet som
 * stod när kaptenen fick ordet, kaptenens kontext (partnerns visade minimum
 * m.m.) och partnerns visade kortfärg. Kaptenen räknar sin hand mot
 * `ctx.partnerMin`; partnern dömer inbjudningar mot samma tal (det är hens
 * eget visade minimum).
 */
export interface SlamSetup {
  trump: Suit
  lastCall: string | undefined
  ctx: SlamContext
  partnerShort?: Suit
}

/**
 * Kaptenens härledning av partnerns nyckelkort ur 1430-svaret + egen hand +
 * partnerns visade styrka. `certain` = entydigt (ingen gissning kvar).
 */
function partnerKeycardsFromAnswer(
  answerCall: string,
  ownKeycards: number,
  partnerMin: number,
): { assumed: number; low: number; high: number; certain: boolean } {
  const options =
    answerCall === '5C' ? [1, 4] : answerCall === '5D' ? [0, 3] : [2, 5] // 5H/5S = 2 eller 5
  const possible = options.filter((o) => ownKeycards + o <= 5)
  if (possible.length === 1) {
    return { assumed: possible[0], low: possible[0], high: possible[0], certain: true }
  }
  const low = Math.min(...possible)
  const high = Math.max(...possible)
  // Mänsklig inferens: en visad 15+-hand är i praktiken aldrig nyckelkortslös →
  // anta det höga alternativet. (Gäller inte 2-eller-5: 5 är för extremt att anta.)
  const assumeHigh = partnerMin >= 15 && high <= 4
  return { assumed: assumeHigh ? high : low, low, high, certain: false }
}

/**
 * Spelar en slamsekvens till slut med två händer, tur för tur ur EN hand
 * (manusets förare): kaptenen börjar; sekvensen är slut när stolen i tur inte
 * har något bud (null) eller passar. null = kaptenen hade inget slamsteg alls.
 */
function playSlam(openerHand: Hand, responderHand: Hand, setup: SlamSetup): SlamTurn[] | null {
  const turns: SlamTurn[] = []
  let role: SlamRole = CAPTAIN
  for (let guard = 0; guard < 12; guard++) {
    const t = slamTurn(role, role === CAPTAIN ? responderHand : openerHand, setup, turns)
    if (!t) break
    turns.push(t)
    if (t.call === 'P') break
    role = other(role)
  }
  return turns.length ? turns : null
}

/**
 * Slamutredning efter en (tänkt) trumf — kaptenen är svararen. Returnerar de
 * extra buden (driv: 4NT → svar → placering; inbjudan: invit → partnerns svar),
 * eller null när kaptenens egen hand + partnerns visade minimum inte räcker
 * (då fortsätter den vanliga auktionen).
 */
export function slamInvestigation(
  openerHand: Hand,
  responderHand: Hand,
  trump: Suit,
  lastCall: string | undefined,
  ctx: SlamContext,
  partnerShortSuit?: Suit,
): SlamTurn[] | null {
  return playSlam(openerHand, responderHand, { trump, lastCall, ctx, partnerShort: partnerShortSuit })
}

/**
 * NÄSTA bud i slamsekvensen för stolen `role`, ur `hand` + uppsättningen +
 * sekvensens bud hittills (`sofar`, bara vår sidas kontraktsbud). null =
 * inget bud i sekvensen för den stolen just nu (sekvensen är slut, eller det
 * är inte stolens tur) — då tar den vanliga auktionen vid (pass).
 *
 * Faserna läses ur `sofar`:
 *  · tomt → kaptenens första steg (`slamCaptainFirstStep`);
 *  · kaptenens 4NT finns → essfrågan (§6.1): svar, placering, 5NT-kungfråga,
 *    stoppbudet och partnerns rättelse;
 *  · första budet är inbjudningsbudet → partnern dömer (§5.2);
 *  · annars cue-ronden (§6.2): båda visar billigaste nya kontroll under utgång,
 *    kaptenen avgör (4NT / utgång / pass), partnern stannar i utgång.
 */
export function slamTurn(role: SlamRole, hand: Hand, setup: SlamSetup, sofar: SlamBid[]): SlamTurn | null {
  const { trump, ctx } = setup
  if (sofar.length === 0) {
    return role === CAPTAIN ? slamCaptainFirstStep(hand, trump, setup.lastCall, ctx, setup.partnerShort) : null
  }
  if (sofar[sofar.length - 1].role === role) return null // inte min tur i sekvensen
  const floor = role === CAPTAIN ? captainFloor(hand, trump, ctx, setup.partnerShort) : 0
  const askIdx = sofar.findIndex((b) => b.role === CAPTAIN && b.call === '4NT')
  if (askIdx >= 0) return rkcPhaseTurn(role, hand, trump, ctx, floor, sofar.slice(askIdx + 1))
  if (sofar[0].role === CAPTAIN && !!ctx.inviteCall && sofar[0].call === ctx.inviteCall) {
    return sofar.length === 1 && role !== CAPTAIN ? inviteAnswer(hand, trump, ctx) : null
  }
  return cuePhaseTurn(role, hand, setup, floor, sofar)
}

/**
 * Kaptenens EGEN värdering mot partnerns visade minimum: stödpoäng golvade vid
 * hp (ägarens TP-princip: form får LYFTA men aldrig sänka under hp). Har
 * partnern VISAT en kortfärg (Jacoby-kortfärgsrebud) nedvärderas egna K/D där —
 * det är ärlig information (kortheten är BJUDEN), FAS 4 punkt 18.
 */
function captainFloor(responderHand: Hand, trump: Suit, ctx: SlamContext, partnerShortSuit?: Suit): number {
  const wasted = partnerShortSuit ? wastedHonorsOppositeShortness(responderHand, partnerShortSuit) : 0
  const captain = (ctx.hpOnly ? hcp(responderHand) : Math.max(hcp(responderHand), dummyPoints(responderHand, trump).dummyPoints)) - wasted
  return captain + ctx.partnerMin
}

const cueTurn = (role: SlamRole, cue: { call: string; suit: Suit }): SlamTurn => ({
  role,
  call: cue.call,
  rule: 'cue-bid',
  explanation: `första-rondskontroll i ${SYM[cue.suit]} → ${cue.call[0]}${SYM[cue.suit]}.`,
})
const rkcAskTurn = (ctx: SlamContext): SlamTurn => ({
  role: 'svarare',
  call: '4NT',
  rule: '1430 RKC',
  explanation: `Slamzon mot partnerns visade ${ctx.partnerMin}+ → 4NT (frågar nyckelkort).`,
})
const inviteTurn = (invite: string, trump: Suit): SlamTurn => ({
  role: 'svarare',
  call: invite,
  rule: 'slaminbjudan',
  explanation: `Slaminbjudningszon (slam bara om partnern har extra) → ${invite[0]}${SYM[trump]} (inbjuder slam).`,
})

/** Kaptenens första gratis cue: billigaste första-rondskontroll över `lastCall` (och cue-golvet) under utgång. */
function captainFirstCue(responderHand: Hand, trump: Suit, lastCall: string | undefined, ctx: SlamContext): { call: string; suit: Suit } | null {
  const gameRank = bidRank(gameCallFor(trump))
  let lastRank = lastCall ? bidRank(lastCall) : -1
  if (ctx.cueFloor) lastRank = Math.max(lastRank, bidRank(ctx.cueFloor))
  return cheapestFreeCue(responderHand, trump, lastRank, gameRank, new Set())
}

/**
 * Kaptenens (svararens) FÖRSTA slambud ur EGEN hand + partnerns visade minimum
 * (`ctx.partnerMin`) — beslutstabellens rad för svararens andra bud läser den
 * här; `slamInvestigation` börjar med samma bud. Portarna (ägarbeslut
 * 2026-07-07 "ärliga slamportar" + cue-ronden 2026-08-03 + B13 2026-08-07):
 *  • GF + trumf klar + floor ≥ 30 → billigaste gratis cue under utgång (utom i
 *    minortrumf i klar drivzon, där 4NT går direkt: cue-utrymmet är trångt);
 *  • floor ≥ 33 → 4NT RKC;  • floor 31–32 → slaminbjudan (`ctx.inviteCall`);
 *  • annars null (ingen slamhand → den vanliga kedjan).
 */
export function slamCaptainFirstStep(
  responderHand: Hand,
  trump: Suit,
  lastCall: string | undefined,
  ctx: SlamContext,
  partnerShortSuit?: Suit,
): SlamTurn | null {
  const floor = captainFloor(responderHand, trump, ctx, partnerShortSuit)
  const lastRank = lastCall ? bidRank(lastCall) : -1
  if (ctx.gameForcing && floor >= 30) {
    const tightSpace = bidRank(gameCallFor(trump)) > bidRank('4NT')
    const clearDrive = tightSpace && floor >= 33 && bidRank('4NT') > lastRank
    if (!clearDrive) {
      const cue = captainFirstCue(responderHand, trump, lastCall, ctx)
      if (cue) return cueTurn('svarare', cue)
    }
  }
  if (floor >= 33 && bidRank('4NT') > lastRank) return rkcAskTurn(ctx)
  if (floor >= 31 && ctx.inviteCall && bidRank(ctx.inviteCall) > lastRank) return inviteTurn(ctx.inviteCall, trump)
  return null
}

// === §6.2 Cue-ronden — kontrollbud FÖRE 1430 RKC (GF-lägen) ==================
//
// När utgång är etablerad är en cue under utgång GRATIS: visar en hand en
// kontroll och partnern har inget extra sjunker paret bara tillbaka till
// utgången. Därför ingen poänggräns för att cue:a — grinden ligger på beslutet
// att gå FÖRBI utgången (4NT). Ärligt: varje hand cue:ar sina EGNA kontroller
// (billigaste första-rondskontroll uppåt) och läser partnerns VISADE — aldrig
// partnerns kort. Att hoppa över en sidofärg förnekar första-rondskontroll där.

const gameLevelFor = (trump: Suit) => (trump === 'hearts' || trump === 'spades' ? 4 : 5)
const gameCallFor = (trump: Suit) => `${gameLevelFor(trump)}${LETTER[trump]}`

/** Billigaste lagliga bud i en färg strikt över `lastRank` (spader över 3H → 3S). */
function cheapestBidInSuit(suit: Suit, lastRank: number): string | null {
  for (let lvl = 1; lvl <= 7; lvl++) {
    const call = `${lvl}${LETTER[suit]}`
    if (bidRank(call) > lastRank) return call
  }
  return null
}

/** Billigaste GRATIS cue: första-rondskontroll i en sidofärg vars bud ligger
 *  över `lastRank` men UNDER utgång (`gameRank`). Redan visade färger (`shown`)
 *  hoppas över — ingen re-cue:ar en kontroll. null = ingen gratis cue. */
function cheapestFreeCue(
  hand: Hand,
  trump: Suit,
  lastRank: number,
  gameRank: number,
  shown: Set<Suit>,
): { call: string; suit: Suit } | null {
  let best: { call: string; suit: Suit } | null = null
  for (const s of RANK_ORDER) {
    if (s === trump || shown.has(s)) continue
    if (!firstRoundControl(hand, s)) continue
    const call = cheapestBidInSuit(s, lastRank)
    if (!call || bidRank(call) >= gameRank) continue // saknas eller når/passerar utgång
    if (!best || bidRank(call) < bidRank(best.call)) best = { call, suit: s }
  }
  return best
}

/** Är `call` ett kontrollbud i sekvensen: sidofärg (inte trumf, inte sang) under utgång? */
function isCueCall(call: string, trump: Suit): boolean {
  const m = call.match(/^([1-7])(C|D|H|S)$/)
  if (!m) return false
  const suit = SUIT_OF_LETTER_[m[2]]
  return suit !== trump && bidRank(call) < bidRank(gameCallFor(trump))
}

/**
 * Cue-ronden, en tur i taget: kaptenen (svararen) och partnern (öppnaren) visar
 * i tur och ordning billigaste NYA första-rondskontroll under utgång. När en
 * hand inte har fler gratis-cue:ar avgör kaptenen: högst EN sidofärg utan
 * första-rondskontroll + värden (floor ≥ 31) → 4NT RKC; annars avslut i utgång
 * (pass om partnern redan bjudit utgången). Partnern utan fler kontroller
 * stannar i utgång — kaptenen får ordet igen och kan ändå driva 4NT över det.
 * Ronden finns bara i utgångskrav (`ctx.gameForcing`) och bara när sekvensen
 * BÖRJADE med ett kontrollbud; annars null.
 */
function cuePhaseTurn(role: SlamRole, hand: Hand, setup: SlamSetup, floor: number, sofar: SlamBid[]): SlamTurn | null {
  const { trump, ctx } = setup
  if (!ctx.gameForcing) return null
  if (sofar[0].role !== CAPTAIN || !isCueCall(sofar[0].call, trump)) return null
  const gameRank = bidRank(gameCallFor(trump))
  const controlled = new Set<Suit>()
  for (const b of sofar) {
    const m = b.call.match(/^([1-7])(C|D|H|S)$/)
    if (m && isCueCall(b.call, trump)) controlled.add(SUIT_OF_LETTER_[m[2]])
  }
  const lastRank = bidRank(sofar[sofar.length - 1].call)

  const cue = cheapestFreeCue(hand, trump, lastRank, gameRank, controlled)
  if (cue) return cueTurn(role, cue)

  const game = gameCallFor(trump)
  if (role === CAPTAIN) {
    // Kaptenen avgör: driv förbi utgången eller avslut. Okontrollerad sidofärg
    // = varken visad (av någon) eller kontrollerad på kaptenens EGEN hand.
    const uncontrolled = RANK_ORDER.filter((s) => s !== trump && !controlled.has(s) && !firstRoundControl(hand, s))
    if (floor >= 31 && uncontrolled.length <= 1 && bidRank('4NT') > lastRank) return rkcAskTurn(ctx)
    return bidRank(game) > lastRank
      ? { role: 'svarare', call: game, rule: 'cue: avslut', explanation: `otillräckligt för slam → utgång (${game[0]}${SYM[trump]}).` }
      : { role: 'svarare', call: 'P', rule: 'cue: avslut', explanation: `otillräckligt för slam → passar (${game} står).` }
  }
  // Partnern (öppnaren) har inga fler kontroller under utgång → avslutar i
  // utgång; kaptenen får ordet igen och kan ändå driva 4NT över det.
  if (bidRank(game) > lastRank) {
    return { role: 'öppnare', call: game, rule: 'cue: avslut', explanation: `inga fler kontroller under utgång → ${game[0]}${SYM[trump]}.` }
  }
  return null
}

// === §6.1 Essfrågan — 4NT RKC, svar, placering, 5NT, stopp och rättelse =======

/** Essfrågans faser efter kaptenens 4NT; `after` = buden efter 4NT. */
function rkcPhaseTurn(role: SlamRole, hand: Hand, trump: Suit, ctx: SlamContext, floor: number, after: SlamBid[]): SlamTurn | null {
  const signOff = `5${LETTER[trump]}`
  if (after.length === 0) {
    if (role === CAPTAIN) return null
    const answer = respondToRKC(hand, trump)
    return { role, call: answer.call, rule: answer.rule, explanation: answer.explanation }
  }
  const answer = after[0].call
  if (after.length === 1) return role === CAPTAIN ? captainPlaceAfterRKC(hand, trump, ctx, floor, answer) : null
  const place = after[1].call
  if (after.length === 2) {
    if (role === CAPTAIN) return null
    if (place === '5NT') {
      const k = respondToKingAsk(hand, trump)
      return { role, call: k.call, rule: k.rule, explanation: k.explanation }
    }
    if (place === signOff) return signoffCorrection(hand, trump, answer)
    return null
  }
  if (after.length === 3 && place === '5NT' && role === CAPTAIN) return captainAfterKingAnswer(after[2].call, trump)
  return null
}

/** Kaptenen placerar på 1430-svaret + egen hand + partnerns visade minimum. */
function captainPlaceAfterRKC(hand: Hand, trump: Suit, ctx: SlamContext, floor: number, answerCall: string): SlamTurn {
  const own = keycards(hand, trump)
  const derived = partnerKeycardsFromAnswer(answerCall, own, ctx.partnerMin)
  const total = own + derived.assumed
  // Trumfdamen: egen hand eller 5♠-svaret (2/5 MED dam). Aldrig partnerns kort.
  const queenKnown = hasTrumpQueen(hand, trump) || answerCall === '5S'
  const signOff = `5${LETTER[trump]}`

  if (total >= 4) {
    // Storslam kräver visshet: entydigt alla fem nyckelkort + dam + storslamszon
    // mot partnerns visade MINIMUM (aldrig hopp om att partnern har maximum).
    if (floor >= 37 && derived.certain && total === 5 && queenKnown) {
      return { role: 'svarare', call: '5NT', rule: 'Sjöberg 5NT', explanation: `alla fem nyckelkort + trumfdam, storslamszon → 5NT (frågar kungar).` }
    }
    const why = derived.certain
      ? total === 4
        ? `ett nyckelkort saknas → 6${SYM[trump]} (lillslam).`
        : `alla fem nyckelkort men ingen säker storslamszon → 6${SYM[trump]} (lillslam).`
      : `svaret visar ${derived.low} eller ${derived.high}; partnerns visade ${ctx.partnerMin}+ talar för ${derived.assumed} → 6${SYM[trump]}.`
    return { role: 'svarare', call: `6${LETTER[trump]}`, rule: 'slamavslut', explanation: why }
  }

  // För få nyckelkort (räknat lågt) → stanna i 5-trumf.
  if (bidRank(signOff) > bidRank(answerCall)) {
    return {
      role: 'svarare',
      call: signOff,
      rule: 'RKC: stopp',
      explanation: derived.certain
        ? `två nyckelkort saknas → stannar i 5${SYM[trump]}.`
        : `svaret visar ${derived.low} eller ${derived.high}; jag räknar lågt → stannar i 5${SYM[trump]}.`,
    }
  }
  // Svaret gick förbi 5-trumf (t.ex. 5♠ över hjärtertrumf, eller 5♦ över
  // klövertrumf): inget stoppbud finns. Var svaret 5-trumf → passa: kontraktet
  // står redan på stoppnivån. Annars måste kaptenen välja på stående fot —
  // räkna med det höga alternativet (mänskligt dilemma, kan bli fel).
  if (answerCall === signOff) {
    return { role: 'svarare', call: 'P', rule: 'RKC: stopp', explanation: `för få nyckelkort → passar; kontraktet står i 5${SYM[trump]}.` }
  }
  return {
    role: 'svarare',
    call: `6${LETTER[trump]}`,
    rule: 'slamavslut',
    explanation: `svaret (${derived.low} eller ${derived.high}) gick förbi stoppnivån 5${SYM[trump]} → räknar med det höga antalet → 6${SYM[trump]}.`,
  }
}

/** Efter kungsvaret på 5NT: kung visad → storslam; 6/7 i trumf var redan svaret (ingen tur). */
function captainAfterKingAnswer(kingAnswerCall: string, trump: Suit): SlamTurn | null {
  if (kingAnswerCall === `6${LETTER[trump]}` || kingAnswerCall === `7${LETTER[trump]}`) return null
  return { role: 'svarare', call: `7${LETTER[trump]}`, rule: 'slamavslut', explanation: `kung visad → storslam (7${SYM[trump]}).` }
}

/**
 * Partnerns RÄTTELSE över stoppbudet (§6.1, felrapport #60): mitt svar 5♣/5♦
 * var tvetydigt (1 eller 4 / 0 eller 3), kaptenen räknade lågt och stannade i
 * 5-trumf — sitter jag med det HÖGA antalet lyfter jag själv till 6.
 */
function signoffCorrection(hand: Hand, trump: Suit, answerCall: string): SlamTurn | null {
  const high = answerCall === '5C' ? 4 : answerCall === '5D' ? 3 : null
  if (high === null || keycards(hand, trump) !== high) return null
  const low = high - 3
  return {
    role: 'öppnare',
    call: `6${LETTER[trump]}`,
    rule: 'RKC: rättelse',
    explanation: `mitt svar visade ${low} ELLER ${high} — jag har ${high} → lyfter till 6${SYM[trump]}.`,
  }
}

/** Kanske-zonen: partnern dömer kaptenens inbjudan på SIN hand mot sitt eget visade intervall — mer än blott minimum → accepterar. */
function inviteAnswer(hand: Hand, trump: Suit, ctx: SlamContext): SlamTurn {
  const invite = ctx.inviteCall!
  // Omvärderad med fit: Bergenpoäng, aldrig under hp.
  const partnerPts = Math.max(hcp(hand), bergenPoints(hand, trump).bergenPoints)
  if (partnerPts >= ctx.partnerMin + 1) {
    return { role: 'öppnare', call: `6${LETTER[trump]}`, rule: 'slaminbjudan: accept', explanation: `Mer än blott minimum → accepterar, 6${SYM[trump]}.` }
  }
  if (invite.startsWith('4')) {
    return { role: 'öppnare', call: `5${LETTER[trump]}`, rule: 'slaminbjudan: avböjer', explanation: `blott minimum → avböjer, 5${SYM[trump]} (utgång).` }
  }
  return { role: 'öppnare', call: 'P', rule: 'slaminbjudan: avböjer', explanation: `blott minimum → avböjer, passar ${invite[0]}${SYM[trump]}.` }
}

/**
 * Trumfval för en OBALANSERAD slamhand efter öppnarens 1NT-återbud (F1 familj A)
 * — på SVARARENS EGEN hand + vad öppningen lovat (aldrig öppnarens kort):
 *  1. egen 6+ högfärg (självförsörjande trumf),
 *  2. 5+ kort i öppnarens öppnade MINOR (1♣/1♦ lovar 3+ → 8-korts fit garanterad).
 * En gömd 4-4-fit hittas INTE längre här (den kräver kikande eller checkback —
 * ärlig väg är New Minor Forcing i den vanliga kedjan). null = ingen säker fit.
 */
export function familyAFitTrump(
  responder: Hand,
  openedSuit: Suit | null,
  responderSuit: Suit | null,
): Suit | null {
  const lr = lengths(responder)
  if (responderSuit && (responderSuit === 'hearts' || responderSuit === 'spades') && lr[responderSuit] >= 6) {
    return responderSuit
  }
  if (openedSuit && (openedSuit === 'clubs' || openedSuit === 'diamonds') && lr[openedSuit] >= 5) {
    return openedSuit
  }
  return null
}

// === §6.5 Exclusion Blackwood efter splinter + relä ==========================
//
// Öppnaren visade slamintresse (splinter-relä, visar ~15+). Svararen (kaptenen)
// gate:ar på SIN hand + det visade minimumet, hoppar till 5 i renonsfärgen och
// frågar nyckelkort UTOM esset där; öppnaren svarar ärligt i steg; kaptenen
// placerar på svaret. null = ingen sidorenons eller för svagt → vanlig auktion.

/** Kaptenens Exclusion-hopp ur EGEN hand: sidorenons + slamzon mot partnerns visade minimum. null = inget. */
export function exclusionFirstStep(responderHand: Hand, trump: Suit, partnerMin: number): SlamTurn | null {
  const len = lengths(responderHand)
  const voidSuit = RANK_ORDER.find((s) => s !== trump && len[s] === 0)
  if (!voidSuit) return null
  const captain = Math.max(hcp(responderHand), dummyPoints(responderHand, trump).dummyPoints)
  if (captain + partnerMin < 33) return null
  return {
    role: 'svarare',
    call: `5${LETTER[voidSuit]}`,
    rule: 'Exclusion',
    explanation: `renons i ${SYM[voidSuit]}, slamzon ihop → 5${SYM[voidSuit]} (Exclusion: frågar nyckelkort utom esset där).`,
  }
}

/**
 * Exclusion-sekvensen en tur i taget ur EN hand: kaptenens hopp (tomt `sofar`),
 * öppnarens stegsvar, kaptenens placering. Renonsfärgen läses ur hoppet.
 */
export function exclusionTurn(role: SlamRole, hand: Hand, trump: Suit, partnerMin: number, sofar: SlamBid[]): SlamTurn | null {
  if (sofar.length === 0) return role === CAPTAIN ? exclusionFirstStep(hand, trump, partnerMin) : null
  if (sofar[sofar.length - 1].role === role) return null
  const ask = sofar[0]
  if (ask.role !== CAPTAIN || !/^5[CDHS]$/.test(ask.call)) return null
  const voidSuit = SUIT_OF_LETTER_[ask.call[1]]
  if (voidSuit === trump) return null
  if (sofar.length === 1) {
    if (role === CAPTAIN) return null
    const answer = respondToExclusion(hand, trump, voidSuit)
    return { role, call: answer.call, rule: answer.rule, explanation: answer.explanation }
  }
  if (sofar.length !== 2 || role !== CAPTAIN) return null

  // Kaptenen härleder ur STEGET + egen hand (pool = 4: tre sidoess + trumfkung).
  const answerCall = sofar[1].call
  const step = exclusionStep(ask.call, answerCall)
  if (step === null) return null
  const own = exclusionKeycards(hand, trump, voidSuit)
  const stepOptions = step === 1 ? [1, 4] : step === 2 ? [0, 3] : [2] // steg 3/4 = exakt 2
  const possible = stepOptions.filter((o) => own + o <= 4)
  const certain = possible.length === 1
  const assumed = certain ? possible[0] : partnerMin >= 15 ? Math.max(...possible) : Math.min(...possible)
  const missing = 4 - (own + assumed)

  const target = missing <= 0 && certain ? `7${LETTER[trump]}` : missing <= 1 ? `6${LETTER[trump]}` : `5${LETTER[trump]}`
  if (bidRank(target) <= bidRank(answerCall)) {
    // Öppnarens stegsvar satte redan (minst) målnivån → kaptenen passar.
    return { role: 'svarare', call: 'P', rule: 'slamavslut', explanation: `öppnarens svar (${answerCall}) satte redan nivån → pass.` }
  }
  const why = missing <= 0
    ? `inget nyckelkort saknas (renons-esset borträknat) → storslam 7${SYM[trump]}.`
    : missing === 1
      ? `ett nyckelkort saknas → lillslam 6${SYM[trump]}.`
      : `två+ nyckelkort saknas → stannar i 5${SYM[trump]}.`
  return { role: 'svarare', call: target, rule: missing >= 2 ? 'Exclusion: stopp' : 'slamavslut', explanation: why }
}

/** Budstege på 5-läget och uppåt: vilket steg (1–4) över Exclusion-hoppet svaret är. */
const LADDER = ['5C', '5D', '5H', '5S', '5NT', '6C', '6D', '6H', '6S', '6NT', '7C', '7D', '7H', '7S', '7NT']
function exclusionStep(askCall: string, answerCall: string): number | null {
  const d = LADDER.indexOf(answerCall) - LADDER.indexOf(askCall)
  return d >= 1 && d <= 4 ? d : null
}

export function exclusionInvestigation(
  openerHand: Hand,
  responderHand: Hand,
  trump: Suit,
  partnerMin: number,
): SlamTurn[] | null {
  const turns: SlamTurn[] = []
  let role: SlamRole = CAPTAIN
  for (let guard = 0; guard < 4; guard++) {
    const t = exclusionTurn(role, role === CAPTAIN ? responderHand : openerHand, trump, partnerMin, turns)
    if (!t) break
    turns.push(t)
    if (t.call === 'P') break
    role = other(role)
  }
  return turns.length ? turns : null
}

// === MSS-slam (FAS 8): slamfortsättning efter Minor Suit Stayman-minorfit ====
//
// Efter 1NT–2♠–3♣/3♦ har svararen (kaptenen) 5-4+ i minorerna och GF/slam; en
// minorfit är garanterad när öppnaren visat en minor. Öppnaren VISADE 15–17
// med sin 1NT-öppning — kaptenen räknar sin egen hand mot det (aldrig öppnarens
// kort). Ägarbeslut 2026-07-01: **NT om säkert, annars minor** — men "säkert"
// döms nu på kaptenens EGEN hand: en högfärg där kaptenen är renons, eller
// kort (≤2) utan topphonnör, är en varningsflagga → färgslam-spåret. Mittemot
// en balanserad sanghand litar kaptenen annars på täckning (mänsklig standard).

const OPENER_1NT_MIN = 15 // 1NT-öppningen visade 15–17

const MAJORS: Suit[] = ['hearts', 'spades']
const hasTopHonor = (hand: Hand, suit: Suit) =>
  hand.some((c) => c.suit === suit && (c.rank === 'A' || c.rank === 'K' || c.rank === 'Q'))

/** NT osäkert — dömt på kaptenens EGEN hand: renons eller kort utan topphonnör i en högfärg. */
function ntUnsafe(responderHand: Hand): boolean {
  const rl = lengths(responderHand)
  return MAJORS.some((m) => rl[m] === 0 || (rl[m] <= 2 && !hasTopHonor(responderHand, m)))
}

const mssSlamCtx = (minor: Suit): SlamContext => ({ partnerMin: OPENER_1NT_MIN, inviteCall: `4${LETTER[minor]}` })
/** Uppsättningen för MSS-slammen ur auktionen: minorn är trumf, kaptenen räknar mot 15. */
export const mssSetup = (minor: Suit, openerRebidCall: string): SlamSetup => ({ trump: minor, lastCall: openerRebidCall, ctx: mssSlamCtx(minor) })

/**
 * Kaptenens FÖRSTA bud efter 1NT–2♠–3m (MSS, minorfit funnen) ur EGEN hand:
 * NT-osäker (högfärgslucka) → slamsteg i minorn eller 5m; annars 3NT under
 * slamzonen, 4NT RKC i slamzonen. `mssMinorFitContinuation` börjar med samma bud.
 */
export function mssFirstStep(responderHand: Hand, minor: Suit, openerRebidCall: string): SlamTurn {
  if (ntUnsafe(responderHand)) {
    const slam = slamCaptainFirstStep(responderHand, minor, openerRebidCall, mssSlamCtx(minor))
    if (slam) return slam
    return {
      role: 'svarare',
      call: `5${LETTER[minor]}`,
      rule: 'MSS: minorutgång',
      explanation: `NT osäkert (högfärgslucka på egen hand), för svagt för slam → 5${SYM[minor]} (minorutgång).`,
    }
  }
  if (hcp(responderHand) + OPENER_1NT_MIN < 33) {
    return {
      role: 'svarare',
      call: '3NT',
      rule: 'till spel',
      explanation: `Balanserad utgång mot visade 15–17 → 3NT (ej slamzon).`,
    }
  }
  return {
    role: 'svarare',
    call: '4NT',
    rule: '1430 RKC',
    explanation: `Slamzon, NT-säker minorfit → 4NT (frågar nyckelkort inför NT-slam).`,
  }
}

/**
 * MSS-fortsättningen en tur i taget ur EN hand. Öppnarens turer (RKC-svar,
 * kungsvar, inbjudans dom, rättelse) är de vanliga (`slamTurn`); kaptenens
 * väg beror på egen hand: NT-osäker → den vanliga slamsekvensen i minorn,
 * NT-säker → 3NT/4NT och placering i SANG (6NT/7NT) på nyckelkortssvaret.
 */
export function mssTurn(role: SlamRole, hand: Hand, minor: Suit, openerRebidCall: string, sofar: SlamBid[]): SlamTurn | null {
  const setup = mssSetup(minor, openerRebidCall)
  if (sofar.length === 0) return role === CAPTAIN ? mssFirstStep(hand, minor, openerRebidCall) : null
  if (sofar[sofar.length - 1].role === role) return null
  const first = sofar[0]
  if (first.role !== CAPTAIN) return null
  if (first.call === '3NT' || first.call === `5${LETTER[minor]}`) return null // placerat
  if (role !== CAPTAIN || ntUnsafe(hand)) return slamTurn(role, hand, setup, sofar)

  // NT-säkra vägen: 4NT → svar → 6NT / 5m / 6m; 5NT → kungsvar → 6NT / 7NT.
  if (first.call !== '4NT') return null
  const after = sofar.slice(1)
  if (after.length === 1) {
    const answerCall = after[0].call
    const floor = hcp(hand) + OPENER_1NT_MIN
    const own = keycards(hand, minor)
    const derived = partnerKeycardsFromAnswer(answerCall, own, OPENER_1NT_MIN)
    const total = own + derived.assumed
    const queenKnown = hasTrumpQueen(hand, minor) || answerCall === '5S'
    if (total <= 3) {
      // För få nyckelkort → tillbaka till den agreade minoren (5m = utgång).
      const escape = `5${LETTER[minor]}`
      if (answerCall === escape) return { role: 'svarare', call: 'P', rule: 'RKC: stopp', explanation: `för få nyckelkort → passar; 5${SYM[minor]} står.` }
      if (bidRank(escape) > bidRank(answerCall)) return { role: 'svarare', call: escape, rule: 'RKC: stopp', explanation: `för få nyckelkort → stannar i 5${SYM[minor]} (minorutgång).` }
      return { role: 'svarare', call: `6${LETTER[minor]}`, rule: 'slamavslut', explanation: `svaret gick förbi 5${SYM[minor]} → tvunget 6${SYM[minor]} (räknar högt).` }
    }
    // Storslamszon mot visat minimum + entydigt alla fem + dam → kungfråga.
    if (floor >= 37 && derived.certain && total === 5 && queenKnown) {
      return { role: 'svarare', call: '5NT', rule: 'Sjöberg 5NT', explanation: `alla fem nyckelkort + trumfdam, storslamszon → 5NT (frågar kungar).` }
    }
    const why = derived.certain
      ? total === 4
        ? `ett nyckelkort saknas → 6NT (lillslam).`
        : `alla fem nyckelkort men ingen säker storslamszon → 6NT (lillslam).`
      : `svaret visar ${derived.low} eller ${derived.high}; visade 15–17 talar för ${derived.assumed} → 6NT.`
    return { role: 'svarare', call: '6NT', rule: 'slamavslut', explanation: why }
  }
  if (after.length === 3 && after[1].call === '5NT') {
    const noKing = after[2].call === `6${LETTER[minor]}`
    return { role: 'svarare', call: noKing ? '6NT' : '7NT', rule: 'slamavslut', explanation: noKing ? 'ingen sidokung → 6NT.' : 'sidokung visad → storslam 7NT.' }
  }
  return null
}

/**
 * Svararens fortsättning efter 1NT–2♠–3♣/3♦ (minorfit funnen). Returnerar hela
 * placeringen (asksekvens + slutbud), aldrig tom – en fit finns alltid.
 */
export function mssMinorFitContinuation(
  openerHand: Hand,
  responderHand: Hand,
  minor: Suit, // 'clubs' | 'diamonds'
  openerRebidCall: string, // '3C' | '3D'
): SlamTurn[] {
  const turns: SlamTurn[] = []
  let role: SlamRole = CAPTAIN
  for (let guard = 0; guard < 12; guard++) {
    const t = mssTurn(role, role === CAPTAIN ? responderHand : openerHand, minor, openerRebidCall, turns)
    if (!t) break
    turns.push(t)
    if (t.call === 'P') break
    role = other(role)
  }
  return turns
}
