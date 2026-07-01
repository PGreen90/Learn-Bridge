// Budmotorns femte del: SVARARENS andra bud (turn 4), efter öppnarens återbud.
// Här beror budet på hela sekvensen, så varje gren har sin egen funktion och en
// dispatcher (responderSecondBid) väljer rätt. Byggs punkt för punkt enligt
// docs/arbetslista.md (10–12). Saknas en regel returneras null → auktionen
// stannar (som tidigare) tills regeln finns.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths, suitHcp } from './hand'
import { pointsWithFloor } from './evaluation'
import type { Major, ResponseResult } from './responses'
import { responderSecondBidAfter2C } from './responses-2c'
import { responderPlaceAfterOgust, suitOfWeakTwo } from './responses-weak2'
import { responderAnswerDrury } from './responses-drury'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const rankOf = (s: Suit) => RANK.indexOf(s)

function suitOfCall(call: string): Suit | null {
  const m = call.match(/^\d(C|D|H|S)$/)
  return m ? ({ C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' } as Record<string, Suit>)[m[1]] : null
}

/** Snyggt bud med färgsymbol ("2D" → "2♦"). */
function pretty(call: string): string {
  const m = call.match(/^(\d)(C|D|H|S|NT)$/)
  if (!m) return call
  return m[2] === 'NT' ? `${m[1]}NT` : `${m[1]}${SYM[suitOfCall(call)!]}`
}

/** Lägsta lagliga budet i `suit` ovanför ett färgbud `refCall`. */
function bidAbove(suit: Suit, refCall: string): string {
  const refSuit = suitOfCall(refCall)
  const refLevel = parseInt(refCall[0], 10)
  const level = refSuit && rankOf(suit) > rankOf(refSuit) ? refLevel : refLevel + 1
  return `${level}${BID[suit]}`
}

/** Grov stopp-koll för NT: A, Kx, Qxx eller Jx10x+. */
function hasStopper(hand: Hand, suit: Suit): boolean {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  const n = ranks.length
  const has = (r: string) => ranks.includes(r as never)
  if (has('A')) return true
  if (has('K') && n >= 2) return true
  if (has('Q') && n >= 3) return true
  if (has('J') && has('10') && n >= 4) return true
  return false
}

/** Svararens andra bud. null = ingen regel för sekvensen än. */
export function responderSecondBid(openCall: string, response: ResponseResult, rebid: ResponseResult, hand: Hand): ResponseResult | null {
  if (rebid.call === 'P') return null

  // Punkt 10 – efter semi-forcing 1NT (1♥/1♠–1NT–…).
  if ((openCall === '1H' || openCall === '1S') && response.rule === 'semi-forcing 1NT') {
    return responderRebidAfterSemiForcing1NT(hand, openCall === '1H' ? 'hearts' : 'spades', rebid)
  }

  // Punkt 11 – 1NT-auktioner (Smolen + fortsättning efter transfer/Stayman).
  if (openCall === '1NT') {
    return responderRebidIn1NTAuction(response, rebid, hand)
  }

  // FAS 5 punkt 24 – 2NT-auktioner (placera kontraktet efter Stayman/transfer).
  if (openCall === '2NT') {
    return responderRebidIn2NTAuction(response, rebid, hand)
  }

  // Punkt 12 – färgauktioner efter ett 1-läges färgsvar (fjärde färg krav m.m.).
  if (['1C', '1D', '1H', '1S'].includes(openCall) && response.rule === 'ny färg (1-läget)') {
    const opened = suitOfCall(openCall)
    const responderSuit = suitOfCall(response.call)
    if (opened && responderSuit) return responderRebidColorAuction(hand, opened, responderSuit, rebid)
  }

  // FAS 3 punkt 14 – svararen visar kortfärgen efter tvetydig splinter + relä.
  if ((openCall === '1H' || openCall === '1S') && response.rule === 'tvetydig splinter' && rebid.rule === 'splinter-relä') {
    return responderRevealSplinterShortness(hand, openCall === '1H' ? 'hearts' : 'spades')
  }

  // FAS 3 punkt 15 – svararen svarar på Bergen game try (1M–2M–2NT).
  if ((openCall === '1H' || openCall === '1S') && response.rule === 'enkel höjning' && rebid.rule === 'Bergen game try') {
    return responderAnswerBergenGameTry(hand, openCall === '1H' ? 'hearts' : 'spades')
  }

  // FAS 9 – svararen (passad hand) placerar kontraktet efter öppnarens Drury-
  // återbud (§6.7): accepterar/avböjer utgångsförsöket, annars passar signoff/utgång.
  if ((openCall === '1H' || openCall === '1S') && response.rule === 'Drury') {
    return responderAnswerDrury(hand, openCall === '1H' ? 'hearts' : 'spades', rebid)
  }

  // Punkt 13 – svararens andra bud efter stark 2♣ (andra negativa m.m.).
  if (openCall === '2C') {
    return responderSecondBidAfter2C(hand, response, rebid)
  }

  // Punkt 14 – svararen placerar kontraktet efter Ogust på svag tvåa.
  const weak = suitOfWeakTwo(openCall)
  if (weak && response.rule === 'Ogust') {
    return responderPlaceAfterOgust(hand, weak, rebid)
  }

  // FAS 6 punkt 27 – svararen placerar kontraktet efter inverterad minor.
  if ((openCall === '1C' || openCall === '1D') && response.rule.startsWith('inverterad minor')) {
    return responderRebidAfterInvertedMinor(hand, openCall === '1C' ? 'clubs' : 'diamonds', rebid)
  }

  return null
}

// === FAS 6 punkt 27: svararens fortsättning efter inverterad minor, §4.2 =====
// Efter den STARKA inverterade höjningen (1m–2m, 10+ krav) beskriver öppnaren sin
// hand (stopp-visning / 2NT / 3m minimum / 3NT 18–19). Svararen är nu kapten mot
// 3NT (systembok §4.2: "fortsätter mot 3NT, visar stopp i objudna färger"). Efter
// den SVAGA höjningen (1m–3m) passar öppnaren normalt; bjöd öppnaren ändå 3NT
// (18+) placerar svararen bara pass. Cue/RKC-slam på minorfiten = FAS 8.
export function responderRebidAfterInvertedMinor(hand: Hand, m: Suit, rebid: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const mBid = BID[m]
  const mSym = SYM[m]
  const sideSuits = RANK.filter((s) => s !== m) // 3 objudna färger (2 hf + andra minorn)
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${p} hp – ${why} → pass.` })

  switch (rebid.rule) {
    case 'inverterad: 3NT': // öppnaren 18–19 balanserad – utgång bjuden
    case 'rebid: 3NT': // öppnaren tog svaga höjningen till 3NT
      return pass('öppnaren bjöd 3NT (till spel), står')

    case 'inverterad: 2NT':
      // Öppnaren 12–14 balanserad (ej krav). Den starka höjningen var 10+, så paret
      // har ≥ 22. Med utgångsvärden (11+) → 3NT; annars stannar 2NT.
      return p >= 11
        ? { call: '3NT', rule: '3NT till spel', explanation: `${p} hp mittemot balanserad 12–14 → 3NT (till spel).` }
        : pass('minimumhöjning mittemot 12–14 – 2NT räcker')

    case 'inverterad: minimum': {
      // Öppnaren rebjöd minorn (3m): minimum UTAN stopp att visa. Svararen stannar
      // om inte stark; med utgångsvärden + stopp i BÅDA högfärgerna vågar vi 3NT
      // (öppnaren saknade en stopp → svararen måste själv täcka sidofärgerna).
      const majorsStopped = hasStopper(hand, 'hearts') && hasStopper(hand, 'spades')
      return p >= 13 && majorsStopped
        ? { call: '3NT', rule: '3NT till spel', explanation: `${p} hp med stopp i båda högfärgerna → 3NT (till spel).` }
        : pass('öppnaren minimum utan stopp – stannar i delkontrakt')
    }

    case 'inverterad: stopp-visning': {
      // Öppnaren visade en stopp i en sidofärg (krav, letar 3NT). Svararen bjuder
      // 3NT när de ÖVRIGA sidofärgerna är täckta; annars höjer minorn mot
      // minorutgång (5m). Fortsatt stopp-letande upp-the-line = FAS 8 (flaggas).
      const shown = suitOfCall(rebid.call)
      const remaining = sideSuits.filter((s) => s !== shown)
      if (remaining.every((s) => hasStopper(hand, s))) {
        return { call: '3NT', rule: '3NT till spel', explanation: `${p} hp – resterande sidofärger täckta → 3NT (till spel).` }
      }
      return { call: `5${mBid}`, rule: 'höjning till utgång', explanation: `${p} hp utan stopp i alla sidofärger → 5${mSym} (minorutgång; 3NT osäker).`, uncertain: true }
    }

    default:
      return null
  }
}

// === FAS 3 punkt 14: svararen visar kortfärgen efter splinter-relä ==========
// Tvetydig splinter (singel/renons någonstans) → öppnaren relär → svararen visar
// VILKEN färg kortheten sitter i, UPP-THE-LINE (ägarens beslut 2026-07-01):
// lägsta lediga bud = lägsta möjliga kortfärg. Icke-trumffärgerna är alltid tre i
// rangordning (♣ < ♦ < ♥ < ♠), och de tre stegen ovanför relät (3NT resp. 3♠) är
// i praktiken 4♣ / 4♦ / 4♥. En slamsäker renons fångas redan av Exclusion i
// auction.ts; hit når singlar (och renonser som inte var slamsäkra).
// Öppnarens slamvärdering på den visade kortfärgen (nedvärdera K/D mittemot) hör
// till FAS 4 punkt 18 – här stannar kedjan vid att kortfärgen är VISAD.
export function responderRevealSplinterShortness(hand: Hand, M: Major): ResponseResult | null {
  const len = lengths(hand)
  const nonTrump = RANK.filter((s) => s !== M) // 3 färger, stigande rang
  const shortSuit = nonTrump.find((s) => len[s] <= 1)
  if (!shortSuit) return null
  const stepCalls = ['4C', '4D', '4H']
  const call = stepCalls[nonTrump.indexOf(shortSuit)]
  const isVoid = len[shortSuit] === 0
  return {
    call,
    rule: 'splinter: kortfärg',
    explanation: `${isVoid ? 'renons' : 'singel'} i ${NAME[shortSuit]} → ${pretty(call)} (visar kortfärgen upp-the-line, GF/slamintresse).`,
  }
}

// === FAS 3 punkt 15: svararens svar på Bergen game try (1M–2M–2NT) ==========
// Öppnaren har frågat med 2NT (game try, 15–17 Bergenpoäng). Svararen gjorde en
// enkel höjning (3 stöd, 6–9 stödpoäng) och beskriver nu enligt Bergens ÄKTA
// variant (ägarens beslut 2026-07-01): visa KORTHET upp-the-line så öppnaren kan
// värdera ruffvärdet, annars säg bara max/min i trumf.
//   3M         = platt minimum (6–7) → avböjer, öppnaren passar
//   4M         = platt maximum (8–9), ingen korthet → accepterar utgång
//   3 sidofärg = korthet (singel/renons) i den färgen (billigast först) → öppnaren
//                värderar; nyttig korthet mittemot öppnarens svaghet lyfter mot game
export function responderAnswerBergenGameTry(hand: Hand, M: Major): ResponseResult {
  const len = lengths(hand)
  const { points: sp } = pointsWithFloor(hand, M, 'support')
  const mBid = BID[M]
  const mSym = SYM[M]
  // Korthet visas upp-the-line (billigaste kortfärg) – varje sidofärg har ett eget
  // 3-lägesbud, alla under utgång 4M.
  const shortSuit = RANK.filter((s) => s !== M).find((s) => len[s] <= 1)
  if (shortSuit) {
    const isVoid = len[shortSuit] === 0
    return {
      call: `3${BID[shortSuit]}`,
      rule: 'game try: kortfärg',
      explanation: `${isVoid ? 'renons' : 'singel'} i ${NAME[shortSuit]} → 3${SYM[shortSuit]} (visar korthet, öppnaren värderar).`,
    }
  }
  if (sp >= 8) return { call: `4${mBid}`, rule: 'game try: accepterar', explanation: `${sp} stödp., platt maximum → 4${mSym} (accepterar utgång).` }
  return { call: `3${mBid}`, rule: 'game try: signoff', explanation: `${sp} stödp., platt minimum → 3${mSym} (avböjer).` }
}

// === Punkt 10: svararens andra bud efter semi-forcing 1NT, §5.1 =============

export function responderRebidAfterSemiForcing1NT(hand: Hand, M: Major, rebid: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const mBid = BID[M]
  const mSym = SYM[M]
  const call = rebid.call
  const rs = suitOfCall(call)
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${p} hp – ${why} → pass.` })

  if (call === 'P') return null
  if (call === `4${mBid}`) return pass('öppnaren bjöd utgång')

  // Öppnaren rebjöd sin högfärg (6+).
  if (call === `2${mBid}`) {
    if (len[M] >= 3 && p >= 10) return { call: `3${mBid}`, rule: 'inbjudan', explanation: `${p} hp, ${len[M]} stöd → 3${mSym} (3-korts limithöjning).` }
    if (p >= 11) return { call: '2NT', rule: 'inbjudan', explanation: `${p} hp → 2NT (inbjudan).` }
    return pass('preferens, minimum')
  }
  if (call === `3${mBid}`) return p >= 8 ? { call: `4${mBid}`, rule: 'accepterar', explanation: `${p} hp – accepterar → 4${mSym}.` } : pass('minimum')

  // Öppnaren bjöd 2NT (18–19).
  if (call === '2NT') return p >= 7 ? { call: '3NT', rule: 'till spel', explanation: `${p} hp mittemot 18–19 → 3NT.` } : pass('minimum balanserad')

  // Hoppskift (3♣/3♦, GF) – krav: preferens med stöd, annars 3NT.
  if (rebid.rule === 'rebid: hoppskift') {
    if (len[M] >= 3) return { call: `3${mBid}`, rule: 'preferens (GF)', explanation: `${p} hp, ${len[M]} stöd → 3${mSym} (preferens, GF).` }
    return { call: '3NT', rule: 'till spel', explanation: `${p} hp – ingen fit → 3NT.` }
  }
  // Reverse (2♠ över 1♥) – krav.
  if (rebid.rule === 'rebid: reverse') {
    if (len[M] >= 3) return { call: `3${mBid}`, rule: 'preferens (GF)', explanation: `${p} hp, ${len[M]} stöd → 3${mSym} (preferens, krav).` }
    return { call: '2NT', rule: 'krav-svar', explanation: `${p} hp – krav efter reverse → 2NT.` }
  }

  // Naturlig ny färg (2♣/2♦, eller 2♥ över 1♠) – ej krav.
  if (rs && rs !== M) {
    if (len[M] >= 3 && p >= 10) return { call: `3${mBid}`, rule: 'inbjudan (limithöjning)', explanation: `${p} hp, ${len[M]} stöd → 3${mSym} (limithöjning).` }
    if (len[rs] >= 4 && p <= 10) return pass(`stöd i ${NAME[rs]}`)
    if (p >= 11 && bal) return { call: '2NT', rule: 'inbjudan', explanation: `${p} hp balanserad → 2NT (inbjudan).` }
    if (len[M] >= 2 && rankOf(M) > rankOf(rs)) return { call: `2${mBid}`, rule: 'preferens', explanation: `${p} hp – preferens → 2${mSym}.` }
    return pass('inget bättre')
  }

  return null
}

// === Punkt 11: svararens andra bud i 1NT-auktioner, §4.3 ====================

export function responderRebidIn1NTAuction(response: ResponseResult, rebid: ResponseResult, hand: Hand): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const sp = len.spades
  const he = len.hearts
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${p} hp – ${why} → pass.` })

  switch (response.rule) {
    case 'Stayman': {
      // Garbage Stayman: 2♣ med 0–7 hp (per definition svag). Riktig Stayman
      // lovar 8+. 5-5 i högfärgerna: passa ett hf-svar (fit), men över 2♦
      // (ingen hf) bjud 2 i den bästa högfärgen. Annars (4-4-4-1) passa alltid.
      if (p <= 7) {
        if (sp === 5 && he === 5 && rebid.call === '2D') {
          const call = suitHcp(hand, 'spades') > suitHcp(hand, 'hearts') ? '2S' : '2H'
          return { call, rule: 'svararens signoff', explanation: `${p} hp, 5-5 i högfärgerna, svag → ${SYM[suitOfCall(call)!]} (bästa delfärg).` }
        }
        return pass('garbage Stayman – bättre delkontrakt än 1NT')
      }
      if (rebid.call === '2D') {
        // Öppnaren förnekade 4-korts högfärg.
        if (((sp === 5 && he === 4) || (he === 5 && sp === 4)) && p >= 10) {
          const call = sp === 5 && he === 4 ? '3H' : '3S' // hoppa i den KORTARE högfärgen
          return { call, rule: 'Smolen', explanation: `${p} hp, 5-4 i högfärgerna → ${SYM[suitOfCall(call)!]} på 3-läget (Smolen, GF).` }
        }
        // 5-4 i högfärgerna med inbjudningsstyrka (8–9): visa den LÅNGA
        // högfärgen naturligt på 2-läget (systembok §4.3), inte 2NT.
        if ((sp === 5 && he === 4) || (he === 5 && sp === 4)) {
          const call = sp === 5 ? '2S' : '2H'
          return { call, rule: 'inbjudan', explanation: `${p} hp, 5-4 i högfärgerna → ${SYM[suitOfCall(call)!]} (naturlig inbjudan, 5-korts högfärg).` }
        }
        return p >= 10
          ? { call: '3NT', rule: 'till spel', explanation: `${p} hp utan fit → 3NT.` }
          : { call: '2NT', rule: 'inbjudan', explanation: `${p} hp utan fit → 2NT (inbjudan).` }
      }
      // Öppnaren visade en högfärg (2♥/2♠).
      const target = suitOfCall(rebid.call)
      if (target && len[target] >= 4) {
        return p >= 10
          ? { call: `4${BID[target]}`, rule: 'utgång', explanation: `${p} hp + fit → 4${SYM[target]}.` }
          : { call: `3${BID[target]}`, rule: 'inbjudan', explanation: `${p} hp + fit → 3${SYM[target]} (inbjudan).` }
      }
      return p >= 10
        ? { call: '3NT', rule: 'till spel', explanation: `${p} hp utan fit → 3NT.` }
        : { call: '2NT', rule: 'inbjudan', explanation: `${p} hp utan fit → 2NT (inbjudan).` }
    }

    case 'Jacoby-transfer': {
      const target: Suit = response.call === '2D' ? 'hearts' : 'spades'
      const tBid = BID[target]
      const tSym = SYM[target]
      if (rebid.rule === 'superaccept') return { call: `4${tBid}`, rule: 'utgång', explanation: `${p} hp – accepterar superaccept → 4${tSym}.` }
      // 5-5 i högfärgerna: transferriktningen kodade styrkan (ägarbeslut).
      // Transfer till ♥ (2♦) = inbjudan → visa 5-5 med 2♠; transfer till ♠ (2♥)
      // = GF → visa 5-5 med 3♥ (den andra högfärgen på 3-läget).
      if (len.hearts === 5 && len.spades === 5) {
        return target === 'hearts'
          ? { call: '2S', rule: 'inbjudan', explanation: `${p} hp, 5-5 i högfärgerna → 2♠ (inbjudan; öppnaren väljer).` }
          : { call: '3H', rule: 'utgång', explanation: `${p} hp, 5-5 i högfärgerna, GF → 3♥ (öppnaren väljer högfärg).` }
      }
      if (len[target] >= 6) {
        if (p >= 10) return { call: `4${tBid}`, rule: 'utgång', explanation: `${p} hp, 6+ ${NAME[target]} → 4${tSym}.` }
        if (p >= 8) return { call: `3${tBid}`, rule: 'inbjudan', explanation: `${p} hp, 6+ ${NAME[target]} → 3${tSym} (inbjudan).` }
        return pass('svag enfärgshand')
      }
      // Exakt 5-korts högfärg, balanserad.
      if (p >= 10) return { call: '3NT', rule: 'till spel', explanation: `${p} hp, 5 ${NAME[target]} → 3NT (öppnaren väljer 3NT/4 i färgen).` }
      if (p >= 8) return { call: '2NT', rule: 'inbjudan', explanation: `${p} hp, 5 ${NAME[target]} → 2NT (inbjudan).` }
      return pass('svag, 5-korts högfärg')
    }

    case 'Texas':
      return pass('Texas – öppnaren fullföljde i utgång')

    case '2NT inbjudan':
    case '3NT till spel':
    case '4NT kvantitativ':
      return pass('kontraktet är satt')

    case 'Minor Suit Stayman': {
      // FAS 5 punkt 23 + FAS 8. Svararen har 5-4+ i minorerna, GF/slam (13+).
      // Öppnaren har svarat: 3♣ = 4+ klöver, 3♦ = 4+ ruter (förnekar 4 klöver),
      // 2NT = ingen 4-korts minor (ej max), 3NT = ingen 4-korts minor (max).
      // No-fit-fallen placeras här; MINORFITEN (3♣/3♦) – inkl. hela slam-/NT-
      // placeringen – ägs av auction.ts via mssMinorFitContinuation (behöver
      // BÅDA händerna för NT-säkerhets- och nyckelkortsbedömningen).
      if (rebid.call === '3NT') return pass('öppnaren visade max utan minorfit – 3NT står')
      if (rebid.call === '2NT') return { call: '3NT', rule: 'till spel', explanation: `${p} hp, ingen minorfit → 3NT.` }
      return null // 3♣/3♦ minorfit hanteras i auction.ts (mssMinorFitContinuation)
    }

    default:
      return null // övriga 1NT-sekvenser tas vid behov senare
  }
}

// === FAS 5 punkt 24: svararens andra bud efter en 2NT-öppning ================
// 2NT (20–21) är GF-schema (inga inbjudningsbud). Efter Stayman/transfer placerar
// svararen kontraktet på utgångsnivå: höj funnen fit → utgång, ingen fit → 3NT,
// 5-4 i högfärgerna efter 3♦ → Smolen (speglar 1NT-varianten: bjud 4-korts hf,
// visa 5 i den andra – starka handen blir spelförare). Minorfråga/slam = §6.
export function responderRebidIn2NTAuction(response: ResponseResult, rebid: ResponseResult, hand: Hand): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const sp = len.spades
  const he = len.hearts
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${p} hp – ${why} → pass.` })

  switch (response.rule) {
    case 'Stayman (2NT)': {
      if (rebid.call === '3D') {
        // Öppnaren förnekade 4-korts högfärg.
        if ((sp === 5 && he === 4) || (he === 5 && sp === 4)) {
          const call = sp === 5 ? '3H' : '3S' // bjud 4-korts hf → visar 5 i den andra
          return { call, rule: 'Smolen', explanation: `5-4 i högfärgerna → ${SYM[suitOfCall(call)!]} (Smolen över 2NT, GF).` }
        }
        return { call: '3NT', rule: 'till spel', explanation: `${p} hp utan fit → 3NT.` }
      }
      // Öppnaren visade en högfärg (3♥/3♠).
      const target = suitOfCall(rebid.call)
      if (target && len[target] >= 4) return { call: `4${BID[target]}`, rule: 'utgång', explanation: `${p} hp + fit → 4${SYM[target]}.` }
      return { call: '3NT', rule: 'till spel', explanation: `${p} hp utan fit → 3NT.` }
    }

    case 'transfer (2NT)': {
      const target: Suit = response.call === '3D' ? 'hearts' : 'spades'
      // Svag (signoff i delkontrakt) → passa den fullföljda transfern.
      if (p < 5) return pass('svag – transfern var ett signoff i delkontrakt')
      if (len[target] >= 6) return { call: `4${BID[target]}`, rule: 'utgång', explanation: `${p} hp, 6+ ${NAME[target]} → 4${SYM[target]}.` }
      // Exakt 5-korts högfärg, GF → 3NT (öppnaren väljer 3NT eller 4 i färgen).
      return { call: '3NT', rule: 'till spel', explanation: `${p} hp, 5 ${NAME[target]} → 3NT (öppnaren väljer 3NT/4 i färgen).` }
    }

    default:
      return null // Texas/minorfråga/3NT/4NT/6NT är redan placerade (minorfråga-slam = §6)
  }
}

// === Punkt 12: svararens andra bud i färgauktioner (fjärde färg krav), §6.6 ==

export function responderRebidColorAuction(hand: Hand, opened: Suit, responderSuit: Suit, rebid: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const y = responderSuit
  const yMaj = y === 'hearts' || y === 'spades'
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${p} hp – ${why} → pass.` })
  const ntLadder = (): ResponseResult => (p >= 13
    ? { call: '3NT', rule: 'till spel', explanation: `${p} hp → 3NT.` }
    : p >= 11
      ? { call: '2NT', rule: 'inbjudan', explanation: `${p} hp → 2NT (inbjudan).` }
      : pass('minimum'))

  switch (rebid.rule) {
    // Öppnaren höjde svararens färg.
    case 'höjning till utgång':
      return pass('öppnaren bjöd utgång')
    case 'hopphöjning (inbjudan)':
      return p >= 8 ? { call: `4${BID[y]}`, rule: 'accepterar', explanation: `${p} hp – accepterar → 4${SYM[y]}.` } : pass('minimum')
    case 'enkel höjning':
      if (yMaj) {
        if (p >= 13) return { call: `4${BID[y]}`, rule: 'utgång', explanation: `${p} hp → 4${SYM[y]}.` }
        if (p >= 11) return { call: `3${BID[y]}`, rule: 'inbjudan', explanation: `${p} hp → 3${SYM[y]} (inbjudan).` }
        return pass('minimum')
      }
      return ntLadder()
    case 'höjning av minor':
      return ntLadder()

    // Öppnaren visade balanserat eller egen färg.
    case '2NT (18–19)':
      return { call: '3NT', rule: 'till spel', explanation: `${p} hp mittemot 18–19 → 3NT.` }
    case '1NT (12–14)':
      return ntLadder()
    case 'rebjuden färg':
      if (len[opened] >= 2 && p <= 10) return pass(`preferens ${NAME[opened]}`)
      return ntLadder()
    case 'hopp i egen färg (inbjudan)':
      return p >= 8 ? { call: '3NT', rule: 'till spel', explanation: `${p} hp – accepterar → 3NT.` } : pass('minimum')

    // Öppnaren visade en NY färg → fjärde färg krav blir aktuellt.
    case 'ny färg (1-läget)':
    case 'ny färg (2-läget)':
    case 'reverse': {
      const second = suitOfCall(rebid.call)
      if (second) return fourthSuit(hand, opened, y, second, rebid)
      return null
    }

    default:
      return null // 'oklart' m.m.
  }
}

/** Svararens val när tre färger är bjudna: fit, egen färg, fjärde färg (krav) eller preferens. */
function fourthSuit(hand: Hand, x: Suit, y: Suit, second: Suit, rebid: ResponseResult): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const bal = isBalanced(hand)
  const fourth = RANK.find((s) => s !== x && s !== y && s !== second)!

  // 1. Fit i öppnarens andra färg.
  if (len[second] >= 4) {
    const call = bidAbove(second, rebid.call)
    return { call, rule: 'höjning', explanation: `${p} hp, ${len[second]} stöd i ${NAME[second]} → ${pretty(call)}.` }
  }
  // 2. Egen 6-korts färg.
  if (len[y] >= 6) {
    const call = bidAbove(y, rebid.call)
    return { call, rule: 'rebjuden färg', explanation: `${p} hp med 6+ ${NAME[y]} → ${pretty(call)}.` }
  }
  // 3. GF utan naturligt bud → 3NT med stopp, annars fjärde färg krav.
  if (p >= 12) {
    if (bal && hasStopper(hand, fourth)) return { call: '3NT', rule: 'till spel', explanation: `${p} hp, stopp i ${NAME[fourth]} → 3NT.` }
    const call = bidAbove(fourth, rebid.call)
    return { call, rule: 'fjärde färg krav', explanation: `${p} hp, GF utan naturligt bud → ${pretty(call)} (fjärde färg, krav).` }
  }
  // 4. Inbjudan balanserad.
  if (bal && p >= 11) return { call: '2NT', rule: 'inbjudan', explanation: `${p} hp balanserad → 2NT (inbjudan).` }
  // 5. Preferens till öppnarens första färg, annars pass.
  if (len[x] >= 2) {
    const call = bidAbove(x, rebid.call)
    return { call, rule: 'preferens', explanation: `${p} hp – preferens → ${pretty(call)}.` }
  }
  return { call: 'P', rule: 'svararens pass', explanation: `${p} hp – inget bättre → pass.` }
}
