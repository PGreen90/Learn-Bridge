// Budmotorns fjärde del: öppnarens återbud efter ett 1-läges färgsvar (1x–1y),
// t.ex. 1♣–1♥, 1♦–1♠, 1♥–1♠. Härlett ur systemboken §5.2. Öppnaren beskriver
// styrka och form så att svararen kan placera kontraktet.
//
// Avgränsning: bara fallet då svararen visat en NY FÄRG på 1-läget. Återbud
// efter höjningar, NT-svar, 2/1 och transfers tas i ett senare steg – då stannar
// auktionen vid två bud tills vidare.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import type { Major, ResponseResult } from './responses'
import { openerRebidAfter2C } from './responses-2c'
import { openerRebidAfterOgust, openerRebidAfterNewSuit, suitOfWeakTwo } from './responses-weak2'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
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
    if (p >= 19) return raise(responderSuit, 4, 'höjning till utgång', p, len[responderSuit])
    if (p >= 16) return raise(responderSuit, 3, 'hopphöjning (inbjudan)', p, len[responderSuit])
    return raise(responderSuit, 2, 'enkel höjning', p, len[responderSuit])
  }

  // 2. Visa en 4-korts högfärg billigt på 1-läget (1♣–1♦–1♥, 1♣–1♥–1♠ …).
  for (const s of ['hearts', 'spades'] as Suit[]) {
    if (s !== opened && s !== responderSuit && len[s] >= 4 && rankOf(s) > rankOf(responderSuit)) {
      return { call: `1${BID[s]}`, rule: 'ny färg (1-läget)', explanation: `${p} hp, 4+ ${NAME[s]} → 1${SYM[s]} (ny färg, krav 1 rond).` }
    }
  }

  // 3. Reverse: 16+, en högre ny färg (4+) med längre första färg → 2 i den högre.
  if (p >= 16) {
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) > rankOf(opened) && len[z] >= 4 && len[opened] > len[z]) {
        return { call: `2${BID[z]}`, rule: 'reverse', explanation: `${p} hp, längre ${NAME[opened]} + 4+ ${NAME[z]} → 2${SYM[z]} (reverse, 16+, krav).` }
      }
    }
  }

  // 4. Balanserad utan högfärg att visa: NT-stegen (15–17 hade öppnat 1NT).
  if (bal) {
    if (p >= 18 && p <= 19) return { call: '2NT', rule: '2NT (18–19)', explanation: `${p} hp balanserad → 2NT (18–19, inbjuder 3NT).` }
    return { call: '1NT', rule: '1NT (12–14)', explanation: `${p} hp balanserad → 1NT (12–14).` }
  }

  // 5. Rebjuda egen 6-korts färg.
  if (len[opened] >= 6) {
    if (p >= 16 && p <= 18) return { call: `3${BID[opened]}`, rule: 'hopp i egen färg (inbjudan)', explanation: `${p} hp med 6+ ${NAME[opened]} → 3${SYM[opened]} (16–18, inbjudan).` }
    return { call: `2${BID[opened]}`, rule: 'rebjuden färg', explanation: `${p} hp med 6+ ${NAME[opened]} → 2${SYM[opened]} (minimum 12–15).` }
  }

  // 6. Ny lägre färg på 2-läget (naturlig, minimum, ej reverse): längst först.
  {
    let best: Suit | null = null
    for (const z of RANK) {
      if (z !== opened && z !== responderSuit && rankOf(z) < rankOf(opened) && len[z] >= 4) {
        if (best === null || len[z] > len[best]) best = z
      }
    }
    if (best) return { call: `2${BID[best]}`, rule: 'ny färg (2-läget)', explanation: `${p} hp, naturlig 4+ ${NAME[best]} → 2${SYM[best]} (minimum, ej krav).` }
  }

  // 7. Reservfall: stöd i svararens minor, annars 1NT (flaggas som förenkling).
  if (!rIsMajor && len[responderSuit] >= 4) {
    const lvl = p >= 16 ? 3 : 2
    return { call: `${lvl}${BID[responderSuit]}`, rule: 'höjning av minor', explanation: `${p} hp, ${len[responderSuit]} stöd → ${lvl}${SYM[responderSuit]} (höjning).` }
  }
  return { call: '1NT', rule: 'oklart', explanation: `${p} hp – motorn hittar inget tydligt återbud (förenkling).`, uncertain: true }
}

function raise(suit: Suit, level: number, rule: string, p: number, support: number): ResponseResult {
  return { call: `${level}${BID[suit]}`, rule, explanation: `${p} hp, ${support} stöd → ${level}${SYM[suit]} (${rule}).` }
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
    if (p >= 19) return { call: `4${mBid}`, rule: 'rebid: utgång', explanation: `${p} hp med 6+ ${NAME[M]} → 4${mSym} (till spel).` }
    if (p >= 16) return { call: `3${mBid}`, rule: 'rebid: hopp (inbjudan)', explanation: `${p} hp med 6+ ${NAME[M]} → 3${mSym} (16–18, inbjudan).` }
    return { call: `2${mBid}`, rule: 'rebid: egen färg', explanation: `${p} hp med 6+ ${NAME[M]} → 2${mSym} (minimum 12–15).` }
  }
  // 18–19 balanserad.
  if (bal && p >= 18 && p <= 19) return { call: '2NT', rule: 'rebid: 2NT (18–19)', explanation: `${p} hp balanserad → 2NT (18–19, inbjuder 3NT).` }
  // Stark 5-4 (16+): reverse eller hoppskift.
  if (p >= 16 && lenM >= 5) {
    if (M === 'hearts' && len.spades >= 4) return { call: '2S', rule: 'rebid: reverse', explanation: `${p} hp, 5-4 (♥-♠) → 2♠ (reverse, krav).` }
    const m4 = betterMinor(len, 4)
    if (m4) return { call: `3${BID[m4]}`, rule: 'rebid: hoppskift', explanation: `${p} hp, 5-4 → 3${SYM[m4]} (hoppskift, krav).` }
    if (M === 'spades' && len.hearts >= 4) return { call: '3H', rule: 'rebid: hoppskift', explanation: `${p} hp, 5-4 (♠-♥) → 3♥ (hoppskift, krav).` }
  }
  // Minimum balanserad → pass (1NT är semi-forcing).
  if (bal) return { call: 'P', rule: 'rebid: pass', explanation: `${p} hp balanserad minimum → pass (1NT är semi-forcing).` }
  // Minimum 12–15 obalanserad: naturlig ny färg.
  if (M === 'spades' && len.hearts >= 4) return { call: '2H', rule: 'rebid: ny färg', explanation: `${p} hp, 5-4 (♠-♥) → 2♥ (naturlig, ej krav).` }
  const m = betterMinor(len, 4) ?? betterMinor(len, 3)
  if (m) return { call: `2${BID[m]}`, rule: 'rebid: ny färg', explanation: `${p} hp → 2${SYM[m]} (naturlig ny färg, 3+).` }
  return { call: 'P', rule: 'rebid: pass', explanation: `${p} hp minimum → pass (1NT är semi-forcing).` }
}

// === Punkt 2: återbud efter enkel höjning (1♥–2♥/1♠–2♠), Bergen game try =====

export function openerRebidAfterSimpleRaise(hand: Hand, M: Major): ResponseResult {
  const p = hcp(hand)
  const mBid = BID[M]
  const mSym = SYM[M]
  if (p >= 18) return { call: `4${mBid}`, rule: 'rebid: utgång', explanation: `${p} hp – tillräckligt → 4${mSym} (utgång).` }
  if (p >= 15) return { call: '2NT', rule: 'Bergen game try', explanation: `${p} hp – utgångsförsök → 2NT (Bergen game try, krav).` }
  return { call: 'P', rule: 'rebid: pass', explanation: `${p} hp minimum mittemot enkel höjning → pass (delkontrakt).` }
}

// === Punkt 3: återbud efter ett 2-över-1 GF-svar, §5.3 ======================

export function openerRebidAfter2over1(hand: Hand, opened: Suit, responder: Suit | null): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const mk = (call: string, rule: string, why: string): ResponseResult => ({ call, rule, explanation: `${p} hp – ${why} → ${pretty(call)}.` })

  if (responder) {
    // Stöd i svararens färg.
    if (len[responder] >= 4) return mk(bidSuit(responder, responder), 'rebid: stöd (GF)', `${len[responder]} stöd, sätter trumf`)
    // Visa en ny 4-korts högfärg (billigast).
    for (const maj of ['hearts', 'spades'] as Suit[]) {
      if (maj !== opened && maj !== responder && len[maj] >= 4) return mk(bidSuit(maj, responder), 'rebid: ny färg (GF)', `naturlig 4+ ${NAME[maj]}`)
    }
    // Rebjuda egen 6-korts färg.
    if (len[opened] >= 6) return mk(bidSuit(opened, responder), 'rebid: egen färg (GF)', `6+ ${NAME[opened]}`)
    // Balanserad utan extra form.
    if (bal) return mk('2NT', 'rebid: 2NT (GF)', 'balanserad utan extra form')
    // Ny 4-korts minor.
    for (const min of ['clubs', 'diamonds'] as Suit[]) {
      if (min !== opened && min !== responder && len[min] >= 4) return mk(bidSuit(min, responder), 'rebid: ny färg (GF)', `naturlig 4+ ${NAME[min]}`)
    }
    if (len[opened] >= 5) return mk(bidSuit(opened, responder), 'rebid: egen färg (GF)', `5+ ${NAME[opened]}`)
  }
  return { call: '3NT', rule: 'rebid: 3NT (GF)', explanation: `${p} hp – inget tydligt återbud → 3NT.`, uncertain: true }
}

// === Punkt 4: återbud efter Bergen-höjningar, §4.1 ==========================

export function openerRebidAfterBergen(hand: Hand, M: Major, rule: string): ResponseResult {
  const p = hcp(hand)
  const mBid = BID[M]
  const mSym = SYM[M]
  const game: ResponseResult = { call: `4${mBid}`, rule: 'rebid: utgång', explanation: `${p} hp → 4${mSym} (utgång).` }
  const stay: ResponseResult = { call: `3${mBid}`, rule: 'rebid: stanna', explanation: `${p} hp minimum → 3${mSym} (stannar lågt).` }
  if (rule === 'Bergen konstruktiv') return p >= 15 ? game : stay // svararen 7–10
  if (rule === 'Bergen limit') return p >= 13 ? game : stay // svararen 10–12
  // Bergen spärr (svararen 0–6).
  return p >= 18 ? game : { call: 'P', rule: 'rebid: pass', explanation: `${p} hp mittemot spärrhöjning → pass.` }
}

// === Punkt 5: återbud efter tvetydig splinter, §4.1 =========================

export function openerRebidAfterSplinter(hand: Hand, M: Major): ResponseResult {
  const p = hcp(hand)
  if (p >= 15) {
    const relay = M === 'hearts' ? '3NT' : '3S' // relä som frågar efter den korta färgen
    return { call: relay, rule: 'splinter-relä', explanation: `${p} hp – slamintresse → ${pretty(relay)} (relä, frågar efter kort färg).` }
  }
  return { call: `4${BID[M]}`, rule: 'rebid: signoff', explanation: `${p} hp – olämplig för slam → 4${SYM[M]} (signoff).` }
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
      return { call: `4${BID[s]}`, rule: 'Jacoby: sidofärg', explanation: `${p} hp med 5+ ${NAME[s]} → 4${SYM[s]} (sidofärg).` }
    }
  }
  // 2. Kort färg (singleton/renons) → 3 i färgen.
  for (const s of RANK) {
    if (s !== M && len[s] <= 1) {
      return { call: `3${BID[s]}`, rule: 'Jacoby: kortfärg', explanation: `${p} hp med kort ${NAME[s]} → 3${SYM[s]} (singleton/renons).` }
    }
  }
  // 3. 16+ slamintresse → 3 i trumf.
  if (p >= 16) return { call: `3${mBid}`, rule: 'Jacoby: slamintresse', explanation: `${p} hp – slamintresse → 3${mSym} (frågar vidare).` }
  // 4. 14–15 balanserad → 3NT.
  if (bal && p >= 14) return { call: '3NT', rule: 'Jacoby: 3NT', explanation: `${p} hp balanserad → 3NT (14–15).` }
  // 5. Minimum → 4 i trumf (signoff).
  return { call: `4${mBid}`, rule: 'Jacoby: minimum', explanation: `${p} hp minimum balanserad → 4${mSym} (signoff).` }
}

// === Punkt 7: återbud efter inverterade minorhöjningar, §4.2 ================

export function openerRebidAfterInvertedMinor(hand: Hand, m: Suit, strong: boolean): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const mSym = SYM[m]

  if (!strong) {
    // Svag spärrhöjning (0–6): pass om inte riktigt stark.
    if (p >= 18) return { call: '3NT', rule: 'rebid: 3NT', explanation: `${p} hp – stark → 3NT (till spel).` }
    return { call: 'P', rule: 'rebid: pass', explanation: `${p} hp mittemot svag höjning → pass.` }
  }

  // Stark inverterad höjning (10+, krav) – paret söker 3NT.
  if (bal && p >= 18) return { call: '3NT', rule: 'inverterad: 3NT', explanation: `${p} hp balanserad → 3NT (18–19).` }
  if (bal) return { call: '2NT', rule: 'inverterad: 2NT', explanation: `${p} hp balanserad 12–14 → 2NT (ej krav).` }
  // Visa stopp i en ny färg (billigast) – letar 3NT.
  for (const s of RANK) {
    if (s !== m && rankOf(s) > rankOf(m) && len[s] >= 4) return { call: `2${BID[s]}`, rule: 'inverterad: stopp-visning', explanation: `${p} hp, stopp i ${NAME[s]} → 2${SYM[s]} (letar 3NT, krav).` }
  }
  for (const s of RANK) {
    if (s !== m && rankOf(s) < rankOf(m) && len[s] >= 4) return { call: `3${BID[s]}`, rule: 'inverterad: stopp-visning', explanation: `${p} hp, stopp i ${NAME[s]} → 3${SYM[s]} (letar 3NT, krav).` }
  }
  return { call: `3${BID[m]}`, rule: 'inverterad: minimum', explanation: `${p} hp minimum utan stopp → 3${mSym} (ej krav).` }
}

// === Punkt 8: återbud efter begränsade/avslutande svar ======================

export function openerRebidAfterLimitedResponse(hand: Hand, response: ResponseResult, opened: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const pass: ResponseResult = { call: 'P', rule: 'rebid: pass', explanation: `${p} hp – inget mer att visa → pass.` }

  switch (response.rule) {
    case '3NT till spel':
    case 'spärr till utgång':
      return pass
    case '2NT inbjudan': // minoröppning, svararen 11–12 inbjuder
      return p >= 14 ? { call: '3NT', rule: 'accepterar inbjudan', explanation: `${p} hp – accepterar → 3NT.` } : pass
    case '1NT':
    case 'gap-hand 1NT':
      if (p >= 18 && bal) return { call: '3NT', rule: 'rebid: 3NT', explanation: `${p} hp balanserad → 3NT.` }
      if (p >= 16 && len[opened] >= 6) return { call: `3${BID[opened]}`, rule: 'rebid: egen färg', explanation: `${p} hp med 6+ ${NAME[opened]} → 3${SYM[opened]} (inbjudan).` }
      return pass
    case 'svagt hoppskift': {
      const s = suitOfCall(response.call)
      if (s && len[s] >= 3 && p >= 16) {
        const isMajor = s === 'hearts' || s === 'spades'
        return isMajor
          ? { call: `4${BID[s]}`, rule: 'rebid: utgång', explanation: `${p} hp + stöd → 4${SYM[s]} (utgång).` }
          : { call: '3NT', rule: 'rebid: 3NT', explanation: `${p} hp – stark → 3NT.` }
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
      if (len.hearts >= 4) return { call: '2H', rule: 'Stayman-svar', explanation: '4+ hjärter → 2♥.' }
      if (len.spades >= 4) return { call: '2S', rule: 'Stayman-svar', explanation: '4 spader (förnekar 4 hjärter) → 2♠.' }
      return { call: '2D', rule: 'Stayman-svar', explanation: 'ingen 4-korts högfärg → 2♦.' }
    case 'Jacoby-transfer': {
      const target: Suit = response.call === '2D' ? 'hearts' : 'spades'
      if (len[target] >= 4 && p >= 17) return { call: `3${BID[target]}`, rule: 'superaccept', explanation: `4 stöd + max → 3${SYM[target]} (superaccept).` }
      return { call: `2${BID[target]}`, rule: 'fullföljd transfer', explanation: `fullföljer transfern → 2${SYM[target]}.` }
    }
    case 'Texas': {
      const target: Suit = response.call === '4D' ? 'hearts' : 'spades'
      return { call: `4${BID[target]}`, rule: 'fullföljd Texas', explanation: `fullföljer Texas → 4${SYM[target]}.` }
    }
    case 'Minor Suit Stayman':
      if (len.clubs >= 4) return { call: '3C', rule: 'MSS-svar', explanation: '4+ klöver → 3♣.' }
      if (len.diamonds >= 4) return { call: '3D', rule: 'MSS-svar', explanation: '4+ ruter (förnekar 4 klöver) → 3♦.' }
      return p >= 17 ? { call: '3NT', rule: 'MSS-svar', explanation: 'ingen 4-korts minor, max → 3NT.' } : { call: '2NT', rule: 'MSS-svar', explanation: 'ingen 4-korts minor → 2NT.' }
    case '2NT inbjudan':
      return p >= 16 ? { call: '3NT', rule: 'accepterar inbjudan', explanation: `${p} hp – accepterar → 3NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `${p} hp minimum → pass.` }
    case '3NT till spel':
      return { call: 'P', rule: 'rebid: pass', explanation: 'till spel → pass.' }
    case '4NT kvantitativ':
      return p >= 17 ? { call: '6NT', rule: 'accepterar slaminbjudan', explanation: `${p} hp (max) → 6NT.` } : { call: 'P', rule: 'rebid: pass', explanation: `${p} hp minimum → pass.` }
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
