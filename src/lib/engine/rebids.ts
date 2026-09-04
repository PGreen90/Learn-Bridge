// Budmotorns fjärde del: öppnarens återbud efter ett 1-läges färgsvar (1x–1y),
// t.ex. 1♣–1♥, 1♦–1♠, 1♥–1♠. Härlett ur systemboken §5.2. Öppnaren beskriver
// styrka och form så att svararen kan placera kontraktet.
//
// Avgränsning: bara fallet då svararen visat en NY FÄRG på 1-läget. Återbud
// efter höjningar, NT-svar, 2/1 och transfers tas i ett senare steg – då stannar
// auktionen vid två bud tills vidare.

import type { Hand, Suit } from '../../types/bridge'
import { notrumpPoints, pointsWithFloor, startingPoints } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import type { Major, ResponseResult } from './responses'
import { openerRebidAfter2C } from './responses-2c'
import { openerRebidAfterOgust, openerRebidAfterNewSuit, suitOfWeakTwo } from './responses-weak2'
import { openerRebidAfterPreemptNewSuit, preemptOf } from './responses-preempt'
import { openerRebidAfter2NTResponse, openerRebidAfter3NTResponse } from './responses-2nt'
import { openerRebidAfterDrury } from './responses-drury'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'] // stigande budrang
const rankOf = (s: Suit) => RANK.indexOf(s)
const SUIT_OF_CALL: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }

/** Färgen i ett färgbud ("2D" → diamonds, "2NT"/"P" → null). */
function suitOfCall(call: string): Suit | null {
  const m = call.match(/^\d(C|D|H|S)$/)
  return m ? SUIT_OF_CALL[m[1]] : null
}

/** Snyggt bud med färgsymbol ("3D" → "3♦"). */
function pretty(call: string): string {
  const m = call.match(/^(\d)(C|D|H|S|NT)$/)
  if (!m) return call
  return m[2] === 'NT' ? `${m[1]}NT` : `${m[1]}${SYM[SUIT_OF_CALL[m[2]]]}`
}

/** Lägsta lagliga budet i färgen `s` ovanför ett bud i färgen `above`. */
function bidSuit(s: Suit, above: Suit): string {
  const level = rankOf(s) > rankOf(above) ? 2 : 3
  return `${level}${BID[s]}`
}

/** Längre minorn med minst `min` kort; lika → klöver (billigast). */
function betterMinor(len: Record<Suit, number>, min: number): Suit | null {
  const c = len.clubs >= min
  const d = len.diamonds >= min
  if (c && d) return len.diamonds > len.clubs ? 'diamonds' : 'clubs'
  if (c) return 'clubs'
  if (d) return 'diamonds'
  return null
}

/** Öppnarens återbud efter 1x–1y (svararen visade 4+ ny färg, 6+ hp). §5.2. */
export function openerRebidAfter1LevelResponse(hand: Hand, opened: Suit, responderSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const rIsMajor = responderSuit === 'hearts' || responderSuit === 'spades'

  // 1. Stöd i svararens högfärg (4+) → höjning efter styrka.
  if (rIsMajor && len[responderSuit] >= 4) {
    if (p >= 19) return raise(responderSuit, 4, 'höjning till utgång')
    if (p >= 16) return raise(responderSuit, 3, 'hopphöjning (inbjudan)')
    return raise(responderSuit, 2, 'enkel höjning')
  }

  // 2. Visa en 4-korts högfärg billigt på 1-läget (1♣–1♦–1♥, 1♣–1♥–1♠ …).
  for (const s of ['hearts', 'spades'] as Suit[]) {
    if (s !== opened && s !== responderSuit && len[s] >= 4 && rankOf(s) > rankOf(responderSuit)) {
      return { call: `1${BID[s]}`, rule: 'ny färg (1-läget)', explanation: `4+ ${SYM[s]} → 1${SYM[s]} (ny färg, krav 1 rond).` }
    }
  }

  // 3. Reverse: 16+, en högre ny färg (4+) med längre första färg → 2 i den högre.
  // TP-steg E (ägarbeslut 2026-07-03): styrkan räknas i max(hp, startpoäng) –
  // form (längd/kvalitetsfärger) får LYFTA in i reverse-zonen, aldrig under hp.
  const sp = pointsWithFloor(hand, null, 'starting')
  if (sp.points >= 16) {
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) > rankOf(opened) && len[z] >= 4 && len[opened] > len[z]) {
        return { call: `2${BID[z]}`, rule: 'reverse', explanation: `16+, längre ${SYM[opened]} + 4+ ${SYM[z]} → 2${SYM[z]} (reverse, krav).` }
      }
    }
  }

  // 4. Balanserad utan högfärg att visa: NT-stegen (15–17 hade öppnat 1NT).
  if (bal) {
    if (p >= 18 && p <= 19) return { call: '2NT', rule: '2NT (18–19)', explanation: `Balanserad (18–19 hp) → 2NT (inbjuder 3NT).` }
    return { call: '1NT', rule: '1NT (12–14)', explanation: `Balanserad (12–14 hp) → 1NT.` }
  }

  // 4b. Hoppskift i ny LÄGRE färg (§5.2): max(hp, startpoäng) ≥ 19 → utgångskrav.
  // TP-steg E: facket saknades helt – en 19-poängare utan fit rebjöd förut
  // "2♣ (minimum, ej krav)". Högre nya färger täcks av reversen (krav) ovan.
  if (sp.points >= 19) {
    let best: Suit | null = null
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) < rankOf(opened) && len[z] >= 4) {
        if (best === null || len[z] > len[best]) best = z
      }
    }
    if (best) return { call: `3${BID[best]}`, rule: 'hoppskift', explanation: `19+, 4+ ${SYM[best]} → 3${SYM[best]} (hoppskift, utgångskrav).` }
  }

  // 5. Rebjuda egen 6-korts färg. ETAPP 7 hål 1 (missad lillslam): steget hade
  // TVÅ fel som båda fick öppnaren att kalla en stark hand för minimum.
  //  (a) TAKET SAKNADES: fönstret var `p >= 16 && p <= 18`, så en 19+-hand föll
  //      IGENOM det ned i minimibudet. Frö 20261020: 20 hp / 23 TP rebjöd
  //      "2♣ (minimum 12–15)" och svararen passade korrekt med 10 hp — 6NT
  //      fanns. Systerfunktionen `openerRebidAfterSemiForcing1NT` har haft
  //      19+-rungen hela tiden; det var ett glapp mellan två syskonstegar.
  //  (b) STEGET RÄKNADE RÅ HP: grannreglerna i samma funktion (reversen i
  //      steg 3, hoppskiftet i steg 4b) väger med `sp` = startpoäng golvade
  //      vid hp — bara suutrebidet räknade `hcp`. En 15 hp-hand med 18–19 TP
  //      (6-korts färg ger längdpoäng) kallade sig därför minimum: frön
  //      20261279, 20261661, 20261136. `pointsWithFloor` golvar vid hp, så den
  //      låsta regeln (TP får bara UPPGRADERA, aldrig nedgradera) hålls.
  // Högfärg på 19+ sätter utgången som hos syskonfunktionen; en minor stannar
  // på 3-läget — 5m är för högt att blåsa på en hand partnern inte hört om än.
  if (len[opened] >= 6) {
    const isMajor = opened === 'hearts' || opened === 'spades'
    if (sp.points >= 19 && isMajor) {
      return { call: `4${BID[opened]}`, rule: 'rebid: utgång', explanation: `19+ med 6+ ${SYM[opened]} → 4${SYM[opened]} (till spel).` }
    }
    if (sp.points >= 16) {
      const zon = sp.points >= 19 ? '19+, extra styrka' : '16–18'
      return { call: `3${BID[opened]}`, rule: 'hopp i egen färg (inbjudan)', explanation: `6+ ${SYM[opened]} → 3${SYM[opened]} (${zon}, inbjudan).` }
    }
    return { call: `2${BID[opened]}`, rule: 'rebjuden färg', explanation: `6+ ${SYM[opened]} → 2${SYM[opened]} (minimum 12–15).` }
  }

  // 6. Ny lägre färg på 2-läget (naturlig, minimum, ej reverse): längst först.
  {
    let best: Suit | null = null
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) < rankOf(opened) && len[z] >= 4) {
        if (best === null || len[z] > len[best]) best = z
      }
    }
    if (best) return { call: `2${BID[best]}`, rule: 'ny färg (2-läget)', explanation: `Naturlig 4+ ${SYM[best]} → 2${SYM[best]} (minimum, ej krav).` }
  }

  // 6b. Rebjud egen 5-korts färg hellre än en skev 1NT (systemfel #2, frö
  // 20260878): med singel/renons i SVARARENS färg ljuger 1NT om formen —
  // den egna 5-kortsfärgen är det ärliga minimibudet.
  if (len[opened] >= 5 && len[responderSuit] <= 1) {
    return { call: `2${BID[opened]}`, rule: 'rebjuden färg', explanation: `5+ ${SYM[opened]} + korthet i ${SYM[responderSuit]} → 2${SYM[opened]} (minimum; 1NT vore skev).` }
  }

  // 7. Reservfall: stöd i svararens minor, annars 1NT (flaggas som förenkling).
  if (!rIsMajor && len[responderSuit] >= 4) {
    const lvl = p >= 16 ? 3 : 2
    return { call: `${lvl}${BID[responderSuit]}`, rule: 'höjning av minor', explanation: `4+ stöd → ${lvl}${SYM[responderSuit]} (höjning).` }
  }
  return { call: '1NT', rule: 'oklart', explanation: `Motorn hittar inget tydligt återbud (förenkling).`, uncertain: true }
}

function raise(suit: Suit, level: number, rule: string): ResponseResult {
  return { call: `${level}${BID[suit]}`, rule, explanation: `4+ stöd → ${level}${SYM[suit]} (${rule}).` }
}

// === Punkt 1: återbud efter semi-forcing 1NT (1♥/1♠–1NT), §5.1 ==============

export function openerRebidAfterSemiForcing1NT(hand: Hand, M: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const lenM = len[M]
  const mBid = BID[M]
  const mSym = SYM[M]

  // 6+ enfärgshand efter styrka.
  if (lenM >= 6) {
    if (p >= 19) return { call: `4${mBid}`, rule: 'rebid: utgång', explanation: `19+ med 6+ ${SYM[M]} → 4${mSym} (till spel).` }
    if (p >= 16) return { call: `3${mBid}`, rule: 'rebid: hopp (inbjudan)', explanation: `6+ ${SYM[M]} → 3${mSym} (16–18, inbjudan).` }
    return { call: `2${mBid}`, rule: 'rebid: egen färg', explanation: `6+ ${SYM[M]} → 2${mSym} (minimum 12–15).` }
  }
  // 18–19 balanserad.
  if (bal && p >= 18 && p <= 19) return { call: '2NT', rule: 'rebid: 2NT (18–19)', explanation: `Balanserad (18–19 hp) → 2NT (inbjuder 3NT).` }
  // Stark 5-4 (16+): reverse eller hoppskift. TP-steg E (ägarbeslut 2026-07-03):
  // styrkan räknas i max(hp, startpoäng) – form lyfter, aldrig under hp.
  const sp = pointsWithFloor(hand, null, 'starting')
  if (sp.points >= 16 && lenM >= 5) {
    if (M === 'hearts' && len.spades >= 4) return { call: '2S', rule: 'rebid: reverse', explanation: `16+, 5-4 (♥-♠) → 2♠ (reverse, krav).` }
    const m4 = betterMinor(len, 4)
    if (m4) return { call: `3${BID[m4]}`, rule: 'rebid: hoppskift', explanation: `16+, 5-4 → 3${SYM[m4]} (hoppskift, krav).` }
    if (M === 'spades' && len.hearts >= 4) return { call: '3H', rule: 'rebid: hoppskift', explanation: `16+, 5-4 (♠-♥) → 3♥ (hoppskift, krav).` }
  }
  // Minimum balanserad → pass (1NT är semi-forcing).
  if (bal) return { call: 'P', rule: 'rebid: pass', explanation: `Balanserad minimum → pass (1NT är semi-forcing).` }
  // Minimum 12–15 obalanserad: naturlig ny färg.
  if (M === 'spades' && len.hearts >= 4) return { call: '2H', rule: 'rebid: ny färg', explanation: `Minimum 5-4 (♠-♥) → 2♥ (naturlig, ej krav).` }
  const m = betterMinor(len, 4) ?? betterMinor(len, 3)
  if (m) return { call: `2${BID[m]}`, rule: 'rebid: ny färg', explanation: `Minimum → 2${SYM[m]} (naturlig ny färg, 3+).` }
  return { call: 'P', rule: 'rebid: pass', explanation: `Minimum → pass (1NT är semi-forcing).` }
}

// === Punkt 2: återbud efter enkel höjning (1♥–2♥/1♠–2♠), Bergen game try =====

export function openerRebidAfterSimpleRaise(hand: Hand, M: Major): ResponseResult {
  // TP-steg C: öppnaren har en känd högfärgsfit → räkna BERGENPOÄNG (extra trumf,
  // sidofärger, korthet), men aldrig under hp ("nedgradera aldrig"). Form lyfter
  // alltså mot game try / utgång, men en platt minimihand stannar på hp-golvet.
  const { points: bp } = pointsWithFloor(hand, M, 'bergen')
  const mBid = BID[M]
  const mSym = SYM[M]
  if (bp >= 18) return { call: `4${mBid}`, rule: 'rebid: utgång', explanation: `Utgångsvärden med fiten → 4${mSym} (utgång).` }
  if (bp >= 15) return { call: '2NT', rule: 'Bergen game try', explanation: `Utgångsförsök → 2NT (game try, krav).` }
  return { call: 'P', rule: 'rebid: pass', explanation: `Minimum mittemot enkel höjning → pass (delkontrakt).` }
}

// === Punkt 3: återbud efter ett 2-över-1 GF-svar, §5.3 ======================

export function openerRebidAfter2over1(hand: Hand, opened: Suit, responder: Suit | null): ResponseResult {
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const mk = (call: string, rule: string, why: string): ResponseResult => ({ call, rule, explanation: `${why} → ${pretty(call)}.` })

  if (responder) {
    // Stöd i svararens färg.
    if (len[responder] >= 4) return mk(bidSuit(responder, responder), 'rebid: stöd (GF)', `4+ stöd, sätter trumf`)
    // Visa en ny 4-korts högfärg (billigast).
    for (const maj of ['hearts', 'spades'] as Suit[]) {
      if (maj !== opened && maj !== responder && len[maj] >= 4) return mk(bidSuit(maj, responder), 'rebid: ny färg (GF)', `naturlig 4+ ${SYM[maj]}`)
    }
    // Rebjuda egen 6-korts färg.
    if (len[opened] >= 6) return mk(bidSuit(opened, responder), 'rebid: egen färg (GF)', `6+ ${SYM[opened]}`)
    // Balanserad utan extra form.
    if (bal) return mk('2NT', 'rebid: 2NT (GF)', 'balanserad utan extra form')
    // Ny 4-korts minor.
    for (const min of ['clubs', 'diamonds'] as Suit[]) {
      if (min !== opened && min !== responder && len[min] >= 4) return mk(bidSuit(min, responder), 'rebid: ny färg (GF)', `naturlig 4+ ${SYM[min]}`)
    }
    if (len[opened] >= 5) return mk(bidSuit(opened, responder), 'rebid: egen färg (GF)', `5+ ${SYM[opened]}`)
  }
  return { call: '3NT', rule: 'rebid: 3NT (GF)', explanation: `Inget tydligt återbud → 3NT.`, uncertain: true }
}

/**
 * Öppnarens svar på svararens FÖRSENADE stöd i öppnarens lågfärg i en 2/1-
 * auktion (1m–2m'–2NT–3m, ägarbeslut 2026-09-03 / felrapport #58). Trumfen är
 * satt och auktionen är utgångskrav; svararen (kaptenen) har slamintresse och
 * räknar sedan mot 2NT:s visade 12. Öppnaren beskriver bara: alla sidofärger
 * täckta → 3NT som sangförslag (kaptenen får passa eller cue:a ovanför), annars
 * 4m (inget att tillägga, kravet står — cue-ronden ligger över 3NT, §6.2).
 */
export function openerAfterDelayedMinorSupport(hand: Hand, m: Suit): ResponseResult {
  const side = RANK.filter((s) => s !== m)
  if (side.every((s) => hasStopper(hand, s))) {
    return { call: '3NT', rule: '2/1: sangförslag', explanation: `Alla sidofärger täckta → 3NT (sangförslag; ${SYM[m]} är trumf om partnern går vidare).` }
  }
  return { call: `4${BID[m]}`, rule: '2/1: höjning (GF)', explanation: `3NT otäckt → 4${SYM[m]} (trumfen bekräftad, utgångskravet står).` }
}

// === Punkt 4: återbud efter Bergen-höjningar, §4.1 ==========================

export function openerRebidAfterBergen(hand: Hand, M: Major, rule: string): ResponseResult {
  // TP-steg C: känd 4-korts-fit → räkna Bergenpoäng (aldrig under hp). En formstark
  // minimihand (t.ex. 11 hp + singel + 5 trumf = 15 Bergenp.) accepterar nu utgång
  // mittemot en limithöjning, där rå hp förut stannade lågt. Ägarens beslut.
  const { points: bp } = pointsWithFloor(hand, M, 'bergen')
  const mBid = BID[M]
  const mSym = SYM[M]
  const game: ResponseResult = { call: `4${mBid}`, rule: 'rebid: utgång', explanation: `Utgångsvärden → 4${mSym} (utgång).` }
  const stay: ResponseResult = { call: `3${mBid}`, rule: 'rebid: stanna', explanation: `Minimum → 3${mSym} (stannar lågt).` }
  if (rule === 'Bergen konstruktiv') return bp >= 15 ? game : stay // svararen 7–10
  if (rule === 'Bergen limit') return bp >= 13 ? game : stay // svararen 10–12
  // Bergen spärr (svararen 0–6).
  return bp >= 18 ? game : { call: 'P', rule: 'rebid: pass', explanation: `Minimum mittemot spärrhöjning → pass.` }
}

// === Punkt 5: återbud efter tvetydig splinter, §4.1 =========================

export function openerRebidAfterSplinter(hand: Hand, M: Major): ResponseResult {
  // TP-steg C: splinter är redan GF, så frågan är slam. Räkna Bergenpoäng (aldrig
  // under hp) – en formstark öppnare visar slamintresse även med hp en gnutta kort.
  const { points: bp } = pointsWithFloor(hand, M, 'bergen')
  if (bp >= 15) {
    const relay = M === 'hearts' ? '3NT' : '3S' // relä som frågar efter den korta färgen
    return { call: relay, rule: 'splinter-relä', explanation: `Slamintresse → ${pretty(relay)} (relä, frågar efter kort färg).` }
  }
  return { call: `4${BID[M]}`, rule: 'rebid: signoff', explanation: `Olämplig för slam → 4${SYM[M]} (signoff).` }
}

// === Punkt 6: återbud efter Jacoby 2NT, §4.1 ================================

export function openerRebidAfterJacoby2NT(hand: Hand, M: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const mBid = BID[M]
  const mSym = SYM[M]
  // 1. 5-korts sidofärg (lägre i rang än trumf) → 4 i färgen.
  for (const s of RANK) {
    if (s !== M && rankOf(s) < rankOf(M) && len[s] >= 5) {
      return { call: `4${BID[s]}`, rule: 'Jacoby: sidofärg', explanation: `5+ ${SYM[s]} → 4${SYM[s]} (sidofärg).` }
    }
  }
  // 2. Kort färg (singleton/renons) → 3 i färgen.
  for (const s of RANK) {
    if (s !== M && len[s] <= 1) {
      return { call: `3${BID[s]}`, rule: 'Jacoby: kortfärg', explanation: `Korthet i ${SYM[s]} → 3${SYM[s]} (singleton/renons).` }
    }
  }
  // 3. 16+ slamintresse → 3 i trumf.
  if (p >= 16) return { call: `3${mBid}`, rule: 'Jacoby: slamintresse', explanation: `16+ – slamintresse → 3${mSym} (frågar vidare).` }
  // 4. 14–15 balanserad → 3NT.
  if (bal && p >= 14) return { call: '3NT', rule: 'Jacoby: 3NT', explanation: `Balanserad (14–15) → 3NT.` }
  // 5. Minimum → 4 i trumf (signoff).
  return { call: `4${mBid}`, rule: 'Jacoby: minimum', explanation: `Minimum balanserad → 4${mSym} (signoff).` }
}

// === Jordan 2NT: öppnarens fortsättning, §7.3 ===============================
// 1M–(X)–2NT är limithöjning eller bättre (10+, 4+ stöd) — öppnaren passar
// ALDRIG (systemfel #4, frö 20260739: pass med 9-korts fit och 28 hp ihop).
// Ägarbeslut 2026-08-07: bara 3M/4M (inget ny färg-utgångsförsök), tröskeln i
// STÖDPOÄNG mot den kända fiten: ≤14 → 3M (avslut), 15+ → 4M.

export function openerRebidAfterJordan2NT(hand: Hand, M: Major): ResponseResult {
  const { points: sp } = pointsWithFloor(hand, M, 'support')
  const mBid = BID[M]
  const mSym = SYM[M]
  if (sp >= 15) {
    return { call: `4${mBid}`, rule: 'Jordan: utgång', explanation: `Utgångsvärden mot limithöjningen (Jordan) → 4${mSym}.` }
  }
  return { call: `3${mBid}`, rule: 'Jordan: minimum', explanation: `Minimum → 3${mSym} (avslut; partnern går vidare med 13+).` }
}

// === Systemfel #3 delfix 4b: öppnarens svar på 3M-inviten efter egen enkel
// höjning (1m–1M–2M–3M), §5.2. Öppnarens tredje bud saknades helt i
// färgauktioner → 15 hp + 4 trumf passade inviten (frö 20260982). Ägarbeslut
// 2026-08-07: 14+ stödpoäng mot fiten accepterar, annars pass.

export function openerThirdBidAfterOwnRaise(hand: Hand, M: Major): ResponseResult {
  const { points: sp } = pointsWithFloor(hand, M, 'support')
  if (sp >= 14) {
    return { call: `4${BID[M]}`, rule: 'inbjudan antagen', explanation: `Med fjärde trumfen → 4${SYM[M]} (accepterar inviten).` }
  }
  return { call: 'P', rule: 'inbjudan avböjd', explanation: `Minimum, inviten avböjs → pass.` }
}

// === Systemfel #3 delfix 4c: öppnarens fortsättning efter egen reverse när
// partnern PREFERERAR tillbaka (t.ex. 1♣–1♥–2♦–3♣), §5.2. Reversen (17+) är
// rondkrav men inte GF: 17-minimum får passa preferensen, 18+ driver till
// utgång — 3NT bara med håll i den objudna färgen OCH 2+ kort i partnerns
// färg, annars utgång i den prefererade fiten (frö 20261111: singel hjärter →
// 5♣, inte 3NT). Ägarbeslut 2026-08-07.

export function openerThirdBidAfterReverse(
  hand: Hand,
  first: Suit,
  responderSuit: Suit,
  reverseSuit: Suit,
  preferenceCall: string,
): ResponseResult {
  const p = hcp(hand)
  if (p <= 17) {
    return { call: 'P', rule: 'reverse: minimum', explanation: `Reversens minimum → pass (preferensen står).` }
  }
  const len = lengths(hand)
  const fourth = RANK.find((s) => s !== first && s !== responderSuit && s !== reverseSuit)!
  const prefLevel = parseInt(preferenceCall[0], 10)
  if (hasStopper(hand, fourth) && len[responderSuit] >= 2 && prefLevel <= 3) {
    return { call: '3NT', rule: 'reverse: 3NT', explanation: `Håll i ${SYM[fourth]} → 3NT (utgång; reversen + extra).` }
  }
  const gameLevel = first === 'hearts' || first === 'spades' ? 4 : 5
  if (gameLevel > prefLevel) {
    const call = `${gameLevel}${BID[first]}`
    return { call, rule: 'reverse: utgång i fiten', explanation: `För starkt för att passa preferensen → ${pretty(call)} (utgång).` }
  }
  return { call: 'P', rule: 'reverse: minimum', explanation: `Ingen väg över preferensen → pass.` }
}

// === Punkt 7: återbud efter inverterade minorhöjningar, §4.2 ================

export function openerRebidAfterInvertedMinor(hand: Hand, m: Suit, strong: boolean): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const mSym = SYM[m]

  if (!strong) {
    // Svag spärrhöjning (0–6): pass om inte riktigt stark.
    if (p >= 18) return { call: '3NT', rule: 'rebid: 3NT', explanation: `18+ hp – stark → 3NT (till spel).` }
    return { call: 'P', rule: 'rebid: pass', explanation: `Minimum mittemot svag höjning → pass.` }
  }

  // Stark inverterad höjning (10+, krav) – paret söker 3NT. B13 (2026-08-07):
  // graderade återbud. "Stopp" är motorns ÄKTA honnörsstopp (A/Kx/Qxx/J10xx),
  // inte 4+ korts längd som förr, och 3m är STRIKT minimum 12–14 — en hand med
  // 15+ bjuder alltid krav så utgången aldrig passas bort (källa: bridgebum,
  // inverted minors; öppnarens nya färger är krav).
  if (bal && p >= 18) return { call: '3NT', rule: 'inverterad: 3NT', explanation: `Balanserad (18–19) → 3NT.` }
  if (bal) return { call: '2NT', rule: 'inverterad: 2NT', explanation: `Balanserad (12–14) → 2NT (ej krav).` }
  // Visa äkta stopp i en ny färg (billigast) – letar 3NT, krav.
  for (const s of RANK) {
    if (s !== m && rankOf(s) > rankOf(m) && hasStopper(hand, s)) return { call: `2${BID[s]}`, rule: 'inverterad: stopp-visning', explanation: `Stopp i ${SYM[s]} → 2${SYM[s]} (letar 3NT, krav).` }
  }
  for (const s of RANK) {
    if (s !== m && rankOf(s) < rankOf(m) && hasStopper(hand, s)) return { call: `3${BID[s]}`, rule: 'inverterad: stopp-visning', explanation: `Stopp i ${SYM[s]} → 3${SYM[s]} (letar 3NT, krav).` }
  }
  if (p <= 14) return { call: `3${BID[m]}`, rule: 'inverterad: minimum', explanation: `Minimum (12–14) utan stopp → 3${mSym} (ej krav).` }
  // 15+ utan äkta sidostopp (sällsynt): tiger ALDRIG i 3m — bästa sidofärgen
  // (längd, sedan honnörsstyrka) bjuds som en VANLIG stopp-visning ("fantom-
  // stoppen", standardpraxis: ny färg är krav och kan undantagsvis sakna äkta
  // stopp). SAMMA bud och SAMMA regel som med stopp — partnern kan inte skilja
  // dem åt och ska inte kunna (ärliga portar); styrkan visas i NÄSTA bud
  // (öppnaren driver förbi svararens broms med 15+).
  let best: Suit | null = null
  for (const s of RANK) {
    if (s === m) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && suitHcp(hand, s) > suitHcp(hand, best))) best = s
  }
  const call = bidSuit(best!, m)
  return { call, rule: 'inverterad: stopp-visning', explanation: `Ingen äkta stopp att visa → ${pretty(call)} (bästa sidofärgen, letar 3NT, krav).` }
}

/** Honnörspoängen i EN färg (för valet av "stark sidofärg"-budet). */
function suitHcp(hand: Hand, suit: Suit): number {
  const pts: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 }
  return hand.filter((c) => c.suit === suit).reduce((sum, c) => sum + (pts[c.rank] ?? 0), 0)
}

/**
 * Öppnarens TREDJE bud efter svararens broms (1m–2m–ny färg–3m = "bara
 * minimum, 10–12"). B13: med 12–14 passar öppnaren (22–26 ihop, delkontraktet
 * står); med 15+ finns utgångsvärden (25+) och öppnaren driver — 3NT när egna
 * handen täcker alla tre sidofärgerna, annars en ANDRA stopp-visning under 3NT
 * om en finns, annars lågfärgsutgången 5m (3NT osäker utan täckning).
 */
export function openerThirdBidAfterInvertedBrake(hand: Hand, m: Suit, shownSuit: Suit | null): ResponseResult {
  const p = hcp(hand)
  const side = RANK.filter((s) => s !== m)
  if (p <= 14) {
    return { call: 'P', rule: 'rebid: pass', explanation: `Minimum (12–14) mot svararens broms → pass, delkontraktet står.` }
  }
  if (side.every((s) => hasStopper(hand, s))) {
    return { call: '3NT', rule: '3NT till spel', explanation: `Alla sidofärger täckta → 3NT (utgång trots bromsen).` }
  }
  // Andra stopp-visningen måste ligga ÖVER 3m och UNDER 3NT: bara färger med
  // högre rang än trumffärgen ryms (3♥/3♠ …); redan visad färg re-visas inte.
  for (const s of RANK) {
    if (s !== m && s !== shownSuit && rankOf(s) > rankOf(m) && hasStopper(hand, s)) {
      return { call: `3${BID[s]}`, rule: 'inverterad: stopp-visning', explanation: `Stopp även i ${SYM[s]} → 3${SYM[s]} (driver mot 3NT, krav).` }
    }
  }
  return { call: `5${BID[m]}`, rule: 'höjning till utgång', explanation: `Utgångsvärden men 3NT otäckt → 5${SYM[m]} (lågfärgsutgång).` }
}

// === Punkt 8: återbud efter begränsade/avslutande svar ======================

export function openerRebidAfterLimitedResponse(hand: Hand, response: ResponseResult, opened: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const pass: ResponseResult = { call: 'P', rule: 'rebid: pass', explanation: `Inget mer att visa → pass.` }

  switch (response.rule) {
    case '3NT till spel':
    case 'spärr till utgång':
      return pass
    case '2NT inbjudan': { // minoröppning, svararen 11–12 inbjuder
      // TP-steg C-3: acceptera sanginbjudan på STARTPOÄNG (5-korts färg, bra
      // ess/tior, längd lyfter en NT-hand som spelar bättre än sina råa HP),
      // golvat vid HP så en hand aldrig nedgraderas. Ingen kortfärg i NT.
      const ntp = Math.max(p, startingPoints(hand).startingPoints)
      return ntp >= 14 ? { call: '3NT', rule: 'accepterar inbjudan', explanation: `Accepterar inbjudan → 3NT.` } : pass
    }
    case '1NT':
    case 'gap-hand 1NT': {
      if (p >= 18 && bal) return { call: '3NT', rule: 'rebid: 3NT', explanation: `18+ balanserad → 3NT.` }
      // F5/A3 (6-5-regeln, felrapport #32): 16+ med 6-korts minor + 5-korts
      // högfärg öppnade minorn JUST för att kunna reverse:a in högfärgen — den
      // får inte gömmas i ett 3m-rebud (1NT förnekar 4-korts högfärg men kan
      // hålla 3: 5-3-fiten hittas bara via reversen). Samma styrkemått som
      // reversen efter 1-lägessvar (max(hp, startpoäng) ≥ 16).
      const sp = pointsWithFloor(hand, null, 'starting')
      const fiveMajor: Suit | null = len.spades === 5 ? 'spades' : len.hearts === 5 ? 'hearts' : null
      if (sp.points >= 16 && (opened === 'clubs' || opened === 'diamonds') && len[opened] >= 6 && fiveMajor) {
        return { call: `2${BID[fiveMajor]}`, rule: 'reverse', explanation: `16+ reverse → 2${SYM[fiveMajor]} (visar ${SYM[fiveMajor]} vid sidan av ${SYM[opened]}).` }
      }
      // Regeln var felmärkt 'rebid: egen färg' (ej krav) fast budet är hoppet
      // med inbjudan (§5.2) — hittat av betydelsesvepet 2026-09-04. Bara etiketten
      // ändrad, samma bud.
      if (p >= 16 && len[opened] >= 6) return { call: `3${BID[opened]}`, rule: 'hopp i egen färg (inbjudan)', explanation: `6+ ${SYM[opened]} → 3${SYM[opened]} (16+, inbjudan).` }
      return pass
    }
    case 'svagt hoppskift': {
      const s = suitOfCall(response.call)
      if (s && len[s] >= 3 && p >= 16) {
        const isMajor = s === 'hearts' || s === 'spades'
        return isMajor
          ? { call: `4${BID[s]}`, rule: 'rebid: utgång', explanation: `Stöd → 4${SYM[s]} (utgång).` }
          : { call: '3NT', rule: 'rebid: 3NT', explanation: `Stark → 3NT.` }
      }
      return pass
    }
    default:
      return pass
  }
}

// === Punkt 9: öppnarens fullföljanden efter 1NT-svar, §4.3 ==================

export function openerRebidAfter1NTResponse(response: ResponseResult, hand: Hand): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)

  switch (response.rule) {
    case 'Stayman':
      if (len.hearts >= 4) return { call: '2H', rule: 'Stayman-svar', explanation: '4+ ♥ → 2♥.' }
      if (len.spades >= 4) return { call: '2S', rule: 'Stayman-svar', explanation: '4 ♠ (förnekar 4 ♥) → 2♠.' }
      return { call: '2D', rule: 'Stayman-svar', explanation: 'ingen 4+ högfärg → 2♦.' }
    case 'Jacoby-transfer': {
      const target: Suit = response.call === '2D' ? 'hearts' : 'spades'
      if (len[target] >= 4 && p >= 17) return { call: `3${BID[target]}`, rule: 'superaccept', explanation: `4+ stöd + max → 3${SYM[target]} (superaccept).` }
      return { call: `2${BID[target]}`, rule: 'fullföljd transfer', explanation: `fullföljer transfern → 2${SYM[target]}.` }
    }
    case 'Texas': {
      const target: Suit = response.call === '4D' ? 'hearts' : 'spades'
      return { call: `4${BID[target]}`, rule: 'fullföljd Texas', explanation: `fullföljer Texas → 4${SYM[target]}.` }
    }
    case 'Minor Suit Stayman':
      if (len.clubs >= 4) return { call: '3C', rule: 'MSS-svar', explanation: '4+ ♣ → 3♣.' }
      if (len.diamonds >= 4) return { call: '3D', rule: 'MSS-svar', explanation: '4+ ♦ (förnekar 4 ♣) → 3♦.' }
      return p >= 17 ? { call: '3NT', rule: 'MSS-svar', explanation: 'ingen 4+ minor, max → 3NT.' } : { call: '2NT', rule: 'MSS-svar', explanation: 'ingen 4+ minor → 2NT.' }
    case '2NT inbjudan': {
      // TP-steg C-3: 1NT-öppning (15–17), svararen inbjuder kvantitativt med 2NT.
      // Acceptera på SANGPOÄNG (ägarbeslut 2026-07-24: "bara som kvalitets-15") –
      // en 15:a med 5-korts färg, bra ess/tior eller en tät honnörsklump (AKQ)
      // spelar som en 16:a och accepterar; en platt quack-15:a avböjer. Golvat
      // vid HP. Frö 20260744: ♠T72 ♥A83 ♦QT97 ♣AKQ = 15 hp → 3NT (600 fanns).
      const ntp = Math.max(p, notrumpPoints(hand))
      return ntp >= 16 ? { call: '3NT', rule: 'accepterar inbjudan', explanation: `Accepterar inbjudan → 3NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `Minimum → pass.` }
    }
    case '3NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'till spel → pass.' }
    case '4NT kvantitativ':
      return p >= 17 ? { call: '6NT', rule: 'accepterar slaminbjudan', explanation: `Maximum → 6NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `Minimum → pass.` }
    default:
      return null
  }
}

// === Dispatcher: öppnarens andra bud =======================================

/** Öppnarens återbud givet öppningsbud + svararens svar. null = ingen regel än. */
export function openerSecondBid(openCall: string, response: ResponseResult, hand: Hand): ResponseResult | null {
  if (response.call === 'P') return null

  // §4.5 – svag tvåöppning (2♦/2♥/2♠).
  const weak = suitOfWeakTwo(openCall)
  if (weak) {
    switch (response.rule) {
      case 'Ogust':
        return openerRebidAfterOgust(hand, weak)
      case 'ny färg (krav)': {
        const ns = suitOfCall(response.call)
        return ns ? openerRebidAfterNewSuit(hand, weak, ns) : null
      }
      case 'spärrhöjning':
      case '3NT till spel':
        return { call: 'P', rule: 'rebid: pass', explanation: 'Öppnaren passar (svararens bud är begränsat).' }
      default:
        return null
    }
  }

  // §4.6 – spärröppning (3X/4X).
  const preempt = preemptOf(openCall)
  if (preempt) {
    switch (response.rule) {
      case 'ny färg (krav)': {
        const ns = suitOfCall(response.call)
        return ns ? openerRebidAfterPreemptNewSuit(hand, preempt.suit, ns) : null
      }
      case 'höjning till utgång':
      case '3NT till spel':
        return { call: 'P', rule: 'rebid: pass', explanation: 'Öppnaren passar (kaptenen har placerat kontraktet).' }
      default:
        return null
    }
  }

  // §5.2 – svararen visade ny färg på 1-läget.
  if (response.rule === 'ny färg (1-läget)' && /^1(D|H|S)$/.test(response.call)) {
    const opened = suitOfCall(openCall)
    const responderSuit = suitOfCall(response.call)
    if (opened && responderSuit) return openerRebidAfter1LevelResponse(hand, opened, responderSuit)
  }

  if (openCall === '1H' || openCall === '1S') {
    return rebidAfterMajorResponse(openCall === '1H' ? 'hearts' : 'spades', response, hand)
  }
  if (openCall === '1C' || openCall === '1D') {
    return rebidAfterMinorResponse(openCall === '1C' ? 'clubs' : 'diamonds', response, hand)
  }
  if (openCall === '1NT') {
    return openerRebidAfter1NTResponse(response, hand)
  }
  if (openCall === '2C') {
    return openerRebidAfter2C(hand, response)
  }
  if (openCall === '2NT') {
    return openerRebidAfter2NTResponse(response, hand)
  }
  if (openCall === '3NT') {
    return openerRebidAfter3NTResponse(response, hand)
  }
  return null
}

function rebidAfterMajorResponse(M: Major, response: ResponseResult, hand: Hand): ResponseResult | null {
  switch (response.rule) {
    case 'semi-forcing 1NT':
      return openerRebidAfterSemiForcing1NT(hand, M)
    case 'enkel höjning':
      return openerRebidAfterSimpleRaise(hand, M)
    case '2-över-1 GF':
      return openerRebidAfter2over1(hand, M, suitOfCall(response.call))
    case 'Bergen konstruktiv':
    case 'Bergen limit':
    case 'Bergen spärr':
      return openerRebidAfterBergen(hand, M, response.rule)
    case 'tvetydig splinter':
      return openerRebidAfterSplinter(hand, M)
    case 'Jacoby 2NT':
      return openerRebidAfterJacoby2NT(hand, M)
    case 'Drury':
      return openerRebidAfterDrury(hand, M)
    case 'svagt hoppskift':
    case '3NT till spel':
    case 'spärr till utgång':
      return openerRebidAfterLimitedResponse(hand, response, M)
    default:
      return null
  }
}

function rebidAfterMinorResponse(m: Suit, response: ResponseResult, hand: Hand): ResponseResult | null {
  switch (response.rule) {
    case '2-över-1 GF':
      return openerRebidAfter2over1(hand, m, suitOfCall(response.call))
    case 'inverterad minor':
      return openerRebidAfterInvertedMinor(hand, m, true)
    case 'inverterad minor, svag':
      return openerRebidAfterInvertedMinor(hand, m, false)
    case 'svagt hoppskift':
    case '1NT':
    case 'gap-hand 1NT':
    case '2NT inbjudan':
    case '3NT till spel':
      return openerRebidAfterLimitedResponse(hand, response, m)
    default:
      return null
  }
}

// === Fjärde färg krav (§6.6): öppnarens svar ================================
//
// Svararens bud i den FJÄRDE färgen (1♣–1♥–1♠–2♦ osv.) är konstgjort och
// UTGÅNGSKRAV – öppnaren får aldrig passa (felrapport #3: auktionen dog på
// öppnarens pass). Svarsprioriteten kommer rakt ur systemboken §6.6:
//   1. visa 3-korts stöd i svararens högfärg,
//   2. rebjuda en färg för extra längd (6-4 / 5-5),
//   3. bjuda NT med stopp i fjärde färgen,
//   4. (sällan) höja fjärde färgen med 4 kort.
// Nödutväg (inget av ovan): billigaste återbud av öppningsfärgen – svara MÅSTE man.

/** Enkel stoppkontroll: A, Kx, Qxx eller Jxxx i färgen. */
function stopperIn(hand: Hand, suit: Suit): boolean {
  const cards = hand.filter((c) => c.suit === suit)
  const has = (r: string) => cards.some((c) => c.rank === r)
  if (has('A')) return true
  if (has('K') && cards.length >= 2) return true
  if (has('Q') && cards.length >= 3) return true
  if (has('J') && cards.length >= 4) return true
  return false
}

/**
 * Öppnarens svar på svararens fjärde färg-krav. `opened`/`second` = öppnarens
 * två visade färger, `responderSuit` = svararens första färg, `fourth` = den
 * konstgjorda fjärde färgen (bjuden på 2-läget). Returnerar ALLTID ett bud.
 */
export function openerAnswerFourthSuit(
  hand: Hand,
  opened: Suit,
  second: Suit,
  responderSuit: Suit,
  fourth: Suit,
): ResponseResult {
  const len = lengths(hand)
  const rule = 'svar på fjärde färg'
  // Billigaste nivån över fjärde färgen (som ligger på 2-läget).
  const cheap = (s: Suit) => (rankOf(s) > rankOf(fourth) ? 2 : 3)

  // 1. Tre-korts stöd i svararens högfärg (5+ lovade i sammanhanget).
  if ((responderSuit === 'hearts' || responderSuit === 'spades') && len[responderSuit] >= 3) {
    const call = `${cheap(responderSuit)}${BID[responderSuit]}`
    return { call, rule, explanation: `3+ stöd i partnerns ${SYM[responderSuit]} → ${pretty(call)} (svar på fjärde färgen).` }
  }

  // 2. Extra längd: 6+ i öppningsfärgen (6-4) eller 5+ i andrafärgen (5-5).
  if (len[opened] >= 6) {
    const call = `${cheap(opened)}${BID[opened]}`
    return { call, rule, explanation: `6+ ${SYM[opened]} → ${pretty(call)} (extra längd, svar på fjärde färgen).` }
  }
  if (len[second] >= 5) {
    const call = `${cheap(second)}${BID[second]}`
    return { call, rule, explanation: `5-5 i ${SYM[opened]}/${SYM[second]} → ${pretty(call)} (extra längd, svar på fjärde färgen).` }
  }

  // 3. NT med stopp i fjärde färgen (2NT ligger alltid över ett 2-lägesbud).
  if (stopperIn(hand, fourth)) {
    return { call: '2NT', rule, explanation: `Stopp i ${SYM[fourth]} → 2NT (svar på fjärde färgen, mot 3NT).` }
  }

  // 4. Höj fjärde färgen med 4 kort (visar äkta fit i den – sällsynt).
  if (len[fourth] >= 4) {
    const call = `3${BID[fourth]}`
    return { call, rule, explanation: `4+ ${SYM[fourth]} → ${pretty(call)} (höjning av fjärde färgen).` }
  }

  // Nödutväg: billigaste återbud av öppningsfärgen (kravet får aldrig passas).
  const call = `${cheap(opened)}${BID[opened]}`
  return { call, rule, explanation: `Inget stopp och ingen extra form – ${pretty(call)} (fjärde färgen är krav, pass förbjudet).` }
}

// === Svar på New Minor Forcing (§5.7) ========================================
// Öppnaren rebjöd 1NT (12–14 bal) och hör NMF (svararens konstgjorda 2♣/2♦).
// Prioritet (Root/Pavlicek): 1) 4-korts ANDRA högfärg (jagar 4-4) · 2) 3-korts
// stöd i svararens högfärg (minimum enkel / maximum hopp) · 3) NT med stopp i den
// OBJUDNA färgen · 4) höj NMF-lågfärgen med 4 kort · 5) rebjud egen färg (nödutväg
// – NMF är krav, pass förbjudet). max = 14 hp (öppnaren visade redan 12–14).
export function openerAnswerNMF(
  hand: Hand,
  opened: Suit,
  responderMajor: Suit,
  nmfMinor: Suit,
  unbidSuit: Suit,
): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const rule = 'svar på New Minor Forcing'
  const max = p >= 14
  const styrka = max ? 'maximum' : 'minimum'
  // Billigaste nivån över NMF-budet (som ligger på 2-läget).
  const cheap = (s: Suit) => (rankOf(s) > rankOf(nmfMinor) ? 2 : 3)
  const otherMajor: Suit = responderMajor === 'hearts' ? 'spades' : 'hearts'

  // 1) 4-korts ANDRA högfärg (ej öppningsfärgen – den är redan visad).
  if (otherMajor !== opened && len[otherMajor] >= 4) {
    const call = `${cheap(otherMajor)}${BID[otherMajor]}`
    return { call, rule, explanation: `4+ ${SYM[otherMajor]} → ${pretty(call)} (visar den andra högfärgen på NMF).` }
  }

  // 2) 3-korts stöd i svararens högfärg: minimum enkel, maximum hopp.
  if (len[responderMajor] >= 3) {
    const level = max ? 3 : cheap(responderMajor)
    const call = `${level}${BID[responderMajor]}`
    return { call, rule, explanation: `3+ stöd i ${SYM[responderMajor]} (${styrka}) → ${pretty(call)} (5-3-fit hittad).` }
  }

  // 3) Sang med stopp i den objudna färgen: minimum 2NT, maximum 3NT.
  if (stopperIn(hand, unbidSuit)) {
    const call = max ? '3NT' : '2NT'
    return { call, rule, explanation: `Stopp i ${SYM[unbidSuit]} (${styrka}) → ${call} (ingen dold högfärgspassning).` }
  }

  // 4) Höj NMF-lågfärgen med 4 kort (naturligt, förnekar allt ovan).
  if (len[nmfMinor] >= 4) {
    const call = `3${BID[nmfMinor]}`
    return { call, rule, explanation: `4+ ${SYM[nmfMinor]} → ${pretty(call)} (ingen högfärgspassning eller stopp – naturlig höjning).` }
  }

  // 5) Nödutväg: rebjud öppningsfärgen (NMF är krav – pass förbjudet).
  const call = `${cheap(opened)}${BID[opened]}`
  return { call, rule, explanation: `Inget av ovan – ${pretty(call)} (NMF är krav, pass förbjudet).` }
}

// === Svar på CHECKBACK efter naturligt 2NT-återbud (systems on, §5.2) ========
// Öppnaren rebjöd 2NT (18–19 bal) och hör svararens 3♣ = konstgjord checkback:
// svararen har 5+ spader + 4 hjärter (bjöd 1♠) och jagar (a) öppnarens DOLDA
// 4-korts hjärter (den enda högfärg hen inte kunde visa billigt – 2♥ vore reverse)
// och (b) 3-stöd i spadern (5-3). Prioritet (Root/Pavlicek): den dolda 4-korts
// högfärgen FÖRST (jagar 4-4), sedan 3-stöd i svararens färg, annars 3NT. En 4-3
// är utesluten – svararen lovade 5+ i sin färg (ägarbeslut 2026-08-18: undvik 4-3).
export function openerAnswer2NTCheckback(hand: Hand, responderMajor: Suit): ResponseResult {
  const other: Suit = responderMajor === 'hearts' ? 'spades' : 'hearts'
  const len = lengths(hand)
  const rule = 'svar på 2NT-checkback'
  // 1) Dold 4-korts ANDRA högfärg → visa den (4-4-fit).
  if (len[other] >= 4) {
    return { call: `3${BID[other]}`, rule, explanation: `4+ ${SYM[other]} → 3${SYM[other]} (visar den dolda andra högfärgen på checkback).` }
  }
  // 2) 3-korts stöd i svararens (5+) högfärg → visa 5-3-fiten.
  if (len[responderMajor] >= 3) {
    return { call: `3${BID[responderMajor]}`, rule, explanation: `3+ stöd i ${SYM[responderMajor]} → 3${SYM[responderMajor]} (5-3-fit hittad).` }
  }
  // 3) Varken 4-4 eller 5-3 → 3NT.
  return { call: '3NT', rule, explanation: `Varken 4+ ${SYM[other]} eller 3-stöd i ${SYM[responderMajor]} → 3NT.` }
}

// === Svar på DIREKT 3♥/3♠ efter naturligt 2NT-återbud (5-3-jakt, §5.2) =======
// Svararen rebjöd sin EGNA högfärg (3♥/3♠) och lovar 5+ kort – jagar öppnarens
// dolda 3-korts stöd (5-3). Öppnaren höjer till utgång med 3-stöd, annars 3NT.
export function openerAnswer2NTMajorSeek(hand: Hand, responderMajor: Suit): ResponseResult {
  const len = lengths(hand)
  const rule = 'svar på 2NT-återbud (5-3-jakt)'
  if (len[responderMajor] >= 3) {
    return { call: `4${BID[responderMajor]}`, rule, explanation: `3+ stöd i ${SYM[responderMajor]} → 4${SYM[responderMajor]} (5-3-fit hittad).` }
  }
  return { call: '3NT', rule, explanation: `Bara 2 ${SYM[responderMajor]} → 3NT (ingen 5-3-fit).` }
}

// === Öppnarens TREDJE bud: svara svararens inbjudan i en 1NT-auktion ========
// (felrapport #37). Efter 1NT–2♣ (Stayman) eller 1NT–2♦/2♥ (transfer) kan
// svararens ANDRA bud vara en inbjudan (3M med fit, 2NT utan, 3M med 6+ färg).
// Den kanoniska linjen slutade förr vid svararens andra bud → öppnarens svar
// föll till det generella off-book-svaret, som bjöd 3NT "utan stöd" mitt i en
// Stayman-hittad fit. Ägarprincip (ärliga portar): accept = ÖVER blott minimum
// (1NT = 15–17 → accept 16–17); en 15:a med FEMTE trumf uppgraderar (extra
// trumf + stöldvärde). Returnerar null för inbjudningsformer som inte hanteras
// än (5-4-naturliga 2M-inbjudan m.fl.) → auktionen lämnas öppen som förut.

// === ETAPP 5 FIX 2: öppnarens TREDJE bud efter semi-forcing 1NT, §5.1 ========
//
// Sekvensen 1♥/1♠–1NT–<återbud>–<svararens inbjudan> slutade förr i den
// kanoniska linjen → öppnarens svar föll till off-book-lagret, som PASSADE.
// En 14-hand med AQT863 sålde alltså given i 2NT fast 4♠ var hemma
// (frö 20260843, docs/systemrevisorn.md etapp 5).
//
// Stegen (ägarprincipen "accept = över blott minimum"): 2♠-återbudet lovade
// 6+ kort och 12–15 (16–18 hoppar, 19+ bjuder utgång), svararens inbjudan
// visar 10–12 → utgång kräver ~15 BERGENPOÄNG (samma mått som övriga
// högfärgsaccepter, `pointsWithFloor(..., 'bergen')`; jfr 18 mot en enkel
// höjning som är fyra poäng svagare).
//
// 2NT-inbjudan mot ett 6-korts återbud rättas ALLTID till högfärgen: 1NT-
// svararen har högst två kort i färgen, men 6-2 spelar bättre än sang på en
// hand utan sidostyrka. Efter en NY FÄRG (5-4-handen) är 2NT-inbjudan äkta
// sang: accept = 14+ hp → 3NT, annars pass.
export function openerThirdBidAfterSemiForcing1NT(
  hand: Hand,
  M: Major,
  rebid: ResponseResult,
  second: ResponseResult,
): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const mBid = BID[M]
  const mSym = SYM[M]
  const { points: bp } = pointsWithFloor(hand, M, 'bergen')

  // 3M = svararens limithöjning (3-korts stöd, 10–12).
  if (second.call === `3${mBid}`) {
    if (bp >= 15) return { call: `4${mBid}`, rule: 'accepterar inbjudan', explanation: `Utgångsvärden mittemot limithöjningen → 4${mSym}.` }
    return { call: 'P', rule: 'pass', explanation: `Minimum → passar inbjudan (3${mSym}).` }
  }

  // Svararens EGEN färg efter 1NT (§5.1, felrapport #59): till spel — svag
  // hand, 5+ kort, förnekar stöd. Vi har redan visat minimum → pass.
  if (second.rule === 'ny färg efter 1NT') {
    const s = suitOfCall(second.call)
    return { call: 'P', rule: 'pass', explanation: `Partnerns egen ${s ? SYM[s] : 'färg'} efter 1 sang är till spel (svag hand, 5+ kort) → pass.` }
  }

  if (second.call !== '2NT') return null

  // 2NT efter vårt 2M-återbud (6+ kort): rätta alltid till färgen.
  if (rebid.call === `2${mBid}` && len[M] >= 6) {
    if (bp >= 15) return { call: `4${mBid}`, rule: 'accepterar inbjudan', explanation: `Utgångsvärden med 6+ ${SYM[M]} → 4${mSym} (utgång).` }
    return { call: `3${mBid}`, rule: 'rebid: egen färg', explanation: `Minimum – 6+ ${SYM[M]} spelar bättre än sang → 3${mSym}.` }
  }

  // 2NT efter en ny färg (5-4-handen): äkta sanginbjudan.
  if (suitOfCall(rebid.call) && rebid.call !== `2${mBid}`) {
    if (p >= 14) return { call: '3NT', rule: 'accepterar inbjudan', explanation: `Maximum → 3NT.` }
    return { call: 'P', rule: 'pass', explanation: `Minimum → passar sanginbjudan.` }
  }

  return null
}

export function openerThirdBidIn1NTAuction(
  response: ResponseResult,
  rebid: ResponseResult,
  second: ResponseResult,
  hand: Hand,
): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)

  /**
   * Accepterar öppnaren en inbjudan mot trumffärgen `trump` (null = sang)?
   * Sangaccepten räknar SANGPOÄNG (ägarbeslut 2026-07-24, samma "bra 15"-regel
   * som den direkta 2NT-inbjudan i `openerRebidAfter1NTResponse`).
   */
  const accepts = (trump: Suit | null): boolean =>
    p >= 16 || (p === 15 && trump !== null && len[trump] >= 5) || (trump === null && notrumpPoints(hand) >= 16)

  const acceptGame = (call: string, why: string): ResponseResult =>
    ({ call, rule: 'accepterar inbjudan', explanation: `Maximum (16–17) – ${why} → ${pretty(call)}.` })
  const decline = (why: string): ResponseResult =>
    ({ call: 'P', rule: 'pass', explanation: `Minimum (15) – ${why} → passar inbjudan.` })

  // ---- Stayman (1NT–2♣) ----------------------------------------------------
  if (response.rule === 'Stayman') {
    const shown = suitOfCall(rebid.call) // vår visade högfärg (2♥/2♠), null vid 2♦
    // Svararen höjde vår högfärg till 3-läget = inbjudan MED fit (4-4+).
    if (shown && second.call === `3${BID[shown]}`) {
      return accepts(shown)
        ? acceptGame(`4${BID[shown]}`, `accepterar inbjudan med fiten i ${SYM[shown]}`)
        : decline(`fiten i ${SYM[shown]} räcker inte utan extra styrka`)
    }
    // 2NT = inbjudan UTAN fit (vår högfärg passade inte / vi svarade 2♦).
    if (second.call === '2NT') {
      return accepts(null)
        ? acceptGame('3NT', 'accepterar den balanserade inbjudan')
        : decline('ingen fit och ingen extra styrka')
    }
    return null
  }

  // ---- Jacoby-transfer (1NT–2♦/2♥) -----------------------------------------
  if (response.rule === 'Jacoby-transfer') {
    const target: Suit = response.call === '2D' ? 'hearts' : 'spades'
    // 3M = inbjudan med 6+ korts högfärg (8–9): 2-korts stöd = säkrad 8-korts fit.
    if (second.call === `3${BID[target]}`) {
      return accepts(target)
        ? acceptGame(`4${BID[target]}`, `accepterar inbjudan mot partnerns 6+ ${SYM[target]}`)
        : decline(`partnerns 6+ ${SYM[target]} till trots – inget extra`)
    }
    // 2NT = inbjudan med exakt 5-korts högfärg, balanserad: välj färg efter fit.
    if (second.call === '2NT') {
      const fit = len[target] >= 3
      if (accepts(null)) {
        return fit
          ? acceptGame(`4${BID[target]}`, `accepterar inbjudan och väljer 5-3-fiten i ${SYM[target]}`)
          : acceptGame('3NT', `accepterar inbjudan utan 3-stöd i ${SYM[target]}`)
      }
      // Minimum MED fit: rätta till 3M (5-3-fiten spelar bättre än 2NT).
      if (fit) {
        return { call: `3${BID[target]}`, rule: 'preferens',
          explanation: `Minimum (15) – avböjer men rättar till 5-3-fiten i ${SYM[target]} → 3${SYM[target]}.` }
      }
      return decline('ingen fit och ingen extra styrka')
    }
    return null
  }

  return null
}
