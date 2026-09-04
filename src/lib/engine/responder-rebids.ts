// Budmotorns femte del: SVARARENS andra bud (turn 4), efter öppnarens återbud.
// Här beror budet på hela sekvensen, så varje gren har sin egen funktion och en
// dispatcher (responderSecondBid) väljer rätt. Byggs punkt för punkt enligt
// docs/arbetslista.md (10–12). Saknas en regel returneras null → auktionen
// stannar (som tidigare) tills regeln finns.

import type { Hand, Suit } from '../../types/bridge'
import { hcp, isBalanced, lengths, suitHcp } from './hand'
import { pointsWithFloor } from './evaluation'
import { splinterShortSuits, type Major, type ResponseResult } from './responses'
import { responderSecondBidAfter2C } from './responses-2c'
import { responderPlaceAfterOgust, suitOfWeakTwo } from './responses-weak2'
import { responderAnswerDrury } from './responses-drury'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
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

  // Felrapport #4 – svararens fortsättning i en 2/1 GF-auktion (§5.3). Utgång
  // är säkrad: svararen får ALDRIG passa under utgång.
  if (response.rule === '2-över-1 GF') {
    const opened = suitOfCall(openCall)
    const responderSuit = suitOfCall(response.call)
    if (opened && responderSuit) return responderRebidIn2over1Auction(hand, opened, responderSuit, rebid)
  }

  return null
}

// === Felrapport #4: svararens andra bud i en 2/1 GF-auktion, §5.3 ===========
//
// Efter ett 2-över-1-svar är UTGÅNG redan säkrad ("grundregel i hela systemet",
// ägarbeslut 2026-07-02) – svararen får aldrig passa under utgångsnivån.
// Naturligt och lugnt enligt §5.3, i prioritetsordning:
//   1. öppnaren bjöd 3NT → utgång nådd, pass,
//   2. öppnaren bjöd 2NT (balanserad) → höj till 3NT,
//   3. 3-korts stöd i öppnarens högfärg (5+ lovade) → sätt trumf
//      ("fast arrival": minimum går direkt i 4M, extra styrka kryper via 3M),
//   4. sang med stopp i de objudna färgerna → 3NT,
//   5. stöd (4+) i öppnarens andrafärg → höjning (krav, GF),
//   6. rebjud egen 6+ färg,
//   7. nödutväg: preferens till öppnarens första färg (pass är förbjudet).
export function responderRebidIn2over1Auction(
  hand: Hand,
  opened: Suit,
  responderSuit: Suit,
  rebid: ResponseResult,
): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const rule = '2/1: fortsättning'

  // 1–2. Öppnaren bjöd sang.
  if (rebid.call === '3NT') {
    return { call: 'P', rule: 'svararens pass', explanation: `Öppnaren bjöd 3NT (utgång nådd) → pass.` }
  }
  // 2a. Försenat stöd i öppnarens LÅGFÄRG (ägarbeslut 2026-09-03, felrapport
  // #58): 2/1 gick före den inverterade höjningen ("game force först, stödet
  // visas i nästa rond"). Efter öppnarens 2NT (12–15) sätter svararen trumf
  // med 3m BARA med slamintresse — stödpoäng + visat minimum når kanske-zonen
  // (31+, slamporten 2026-07-07); annars är 3NT den naturliga utgången även med
  // fit (4-4 i lågfärg spelar sällan bättre än sang).
  const openedMinor = opened === 'clubs' || opened === 'diamonds'
  if (rebid.call === '2NT' && openedMinor && len[opened] >= 4) {
    const { points: sp } = pointsWithFloor(hand, opened, 'support')
    if (sp + 12 >= 31) {
      return {
        call: `3${BID[opened]}`,
        rule: '2/1: försenat stöd',
        explanation: `4+ stöd i ${SYM[opened]} och slamintresse → 3${SYM[opened]} (trumf satt, utgångskrav).`,
      }
    }
  }
  if (rebid.call === '2NT') {
    return { call: '3NT', rule, explanation: `Mittemot balanserad öppnare – utgångskravet fullföljs → 3NT.` }
  }

  const openedMajor = opened === 'hearts' || opened === 'spades'
  const rebidSuit = suitOfCall(rebid.call)

  // 3. Försenat stöd i öppnarens högfärg (5+ lovade) → trumf satt.
  if (openedMajor && len[opened] >= 3) {
    // Fast arrival (§5.3): snabb utgång = minimum, långsam väg = extra styrka.
    const call = p >= 15 ? bidAbove(opened, rebid.call) : `4${BID[opened]}`
    const label = p >= 15 ? `${pretty(call)} (trumf satt, extra styrka)` : `4${SYM[opened]} (minimum — direkt till utgången)`
    return { call, rule, explanation: `3+ stöd i ${SYM[opened]} → ${label}.` }
  }

  // 3b. Egen 4-korts högfärg visas naturligt under 3NT (2026-08-07 — infriar
  // §9-löftet från 2/1-regeln 2026-08-06: 2♣ före högfärgen, högfärgen i
  // ÅTERBUDET). Efter det försenade stödet (känd 5-3-fit slår hypotetisk 4-4,
  // ägarbeslut) men FÖRE 3NT, så en 4-4-högfärgsfit aldrig begravs i sang.
  // BARA när högfärgen blir auktionens TREDJE färg (öppnaren rebjöd egen färg
  // eller stödde min): har tre olika färger redan bjudits är högfärgsbudet
  // FJÄRDE FÄRG med konventionell mening — då gäller 3NT-med-håll som förr.
  // Öppnaren har dessutom redan nekat egen 4-korts högfärg när hen inte visade
  // en (openerRebidAfter2over1 bjuder den före både 2NT och egen färg).
  if (rebidSuit === null || rebidSuit === opened || rebidSuit === responderSuit) {
    for (const maj of ['hearts', 'spades'] as Suit[]) {
      if (maj !== opened && maj !== responderSuit && len[maj] >= 4) {
        const call = bidAbove(maj, rebid.call)
        if (parseInt(call[0], 10) <= 3) {
          return { call, rule, explanation: `4+ ${SYM[maj]} → ${pretty(call)} (naturligt, utgångskrav – högfärgen visas i återbudet).` }
        }
      }
    }
  }

  // 4. Sang med stopp i de objudna färgerna.
  const bidSuits = new Set<Suit>([opened, responderSuit, ...(rebidSuit ? [rebidSuit] : [])])
  const unbid = RANK.filter((s) => !bidSuits.has(s))
  if (unbid.every((s) => hasStopper(hand, s))) {
    return { call: '3NT', rule, explanation: `Stopp i ${unbid.map((s) => SYM[s]).join(' och ') || 'alla färger'} → 3NT (utgångskravet fullföljs).` }
  }

  // 5. Stöd (4+) i öppnarens visade andrafärg → höjning (krav i GF).
  if (rebidSuit && rebidSuit !== opened && rebidSuit !== responderSuit && len[rebidSuit] >= 4) {
    const call = bidAbove(rebidSuit, rebid.call)
    return { call, rule, explanation: `4+ stöd i ${SYM[rebidSuit]} → ${pretty(call)} (höjning, utgångskrav).` }
  }

  // 6. Rebjud egen 6+ färg (extra längd).
  if (len[responderSuit] >= 6) {
    const call = bidAbove(responderSuit, rebid.call)
    return { call, rule, explanation: `6+ ${SYM[responderSuit]} → ${pretty(call)} (extra längd, utgångskrav).` }
  }

  // 7. Nödutväg: preferens till öppnarens första färg – kravet får aldrig passas.
  const call = bidAbove(opened, rebid.call)
  return { call, rule, explanation: `Preferens till ${SYM[opened]} (2/1 är utgångskrav, pass förbjudet).` }
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
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${why} → pass.` })

  switch (rebid.rule) {
    case 'inverterad: 3NT': // öppnaren 18–19 balanserad – utgång bjuden
    case 'rebid: 3NT': // öppnaren tog svaga höjningen till 3NT
      return pass('öppnaren bjöd 3NT (till spel), står')

    case 'inverterad: 2NT':
      // Öppnaren 12–14 balanserad (ej krav). Den starka höjningen var 10+, så paret
      // har ≥ 22. Med utgångsvärden (11+) → 3NT; annars stannar 2NT.
      return p >= 11
        ? { call: '3NT', rule: '3NT till spel', explanation: `Utgångsvärden mittemot balanserad 12–14 → 3NT (till spel).` }
        : pass('minimumhöjning mittemot 12–14 – 2NT räcker')

    case 'inverterad: minimum': {
      // Öppnaren rebjöd minorn (3m): minimum UTAN stopp att visa. Med bara
      // inbjudan (10–12) stannar svararen i delkontrakt. Med utgångsvärden (13+)
      // MÅSTE vi till game: 3NT om vi själva kan hålla båda högfärgerna, annars
      // 5m (öppnaren saknar stopp → 3NT är osäker). Ägarregel 2026-07-05: chansa
      // inte 3NT med en osparrad högfärg – spela minorutgången.
      const majorsStopped = hasStopper(hand, 'hearts') && hasStopper(hand, 'spades')
      if (p < 13) return pass('öppnaren minimum – inbjudan, stannar i delkontrakt')
      return majorsStopped
        ? { call: '3NT', rule: '3NT till spel', explanation: `Utgångsvärden med stopp i båda högfärgerna → 3NT (till spel).` }
        : { call: `5${mBid}`, rule: 'höjning till utgång', explanation: `Utgångskrav utan stopp i högfärgerna → 5${mSym} (minorutgång; 3NT osäker).`, uncertain: true }
    }

    case 'inverterad: stopp-visning': {
      // Öppnaren visade en stopp i en sidofärg (krav, letar 3NT). B13
      // (2026-08-07): stopp-visningen lovar bara 12+ — med minimumhöjningen
      // (10–12) BROMSAR svararen med 3m ("bara minimum"); öppnaren passar med
      // 12–14 och driver med 15+ (öppnarens tredje bud). Med 13+ bjuder
      // svararen 3NT när de ÖVRIGA sidofärgerna är täckta; annars minorutgång.
      if (p <= 12) {
        return { call: `3${mBid}`, rule: 'inverterad: broms', explanation: `Bara minimumhöjning (10–12) → 3${mSym} (broms; öppnaren driver med 15+).` }
      }
      const shown = suitOfCall(rebid.call)
      const remaining = sideSuits.filter((s) => s !== shown)
      if (remaining.every((s) => hasStopper(hand, s))) {
        return { call: '3NT', rule: '3NT till spel', explanation: `Resterande sidofärger täckta → 3NT (till spel).` }
      }
      return { call: `5${mBid}`, rule: 'höjning till utgång', explanation: `Utan stopp i alla sidofärger → 5${mSym} (minorutgång; 3NT osäker).`, uncertain: true }
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
  // SAMMA predikat som splinterbeslutet (splinterregeln 2026-08-07): en
  // singel-A/K är ingen splinterfärg, så reveal får aldrig peka på den när
  // en renons (eller splintervärdig singel) i annan färg motiverade splintern.
  const worthy = splinterShortSuits(hand, M)
  const shortSuit = nonTrump.find((s) => worthy.includes(s))
  if (!shortSuit) return null
  const stepCalls = ['4C', '4D', '4H']
  const call = stepCalls[nonTrump.indexOf(shortSuit)]
  const isVoid = len[shortSuit] === 0
  return {
    call,
    rule: 'splinter: kortfärg',
    explanation: `${isVoid ? 'renons' : 'singel'} i ${SYM[shortSuit]} → ${pretty(call)} (visar kortfärgen billigast först, utgångskrav med slamintresse).`,
  }
}

// === Jordan-bjudarens fortsättning efter öppnarens 3M-avslut, §7.3 ==========
// Jordan 2NT visade "limithöjning eller bättre". Öppnarens 3M är ett avslut mot
// limitdelen (10–12) — men en Jordan-bjudare med utgångsstyrka (13+ stödpoäng)
// får aldrig låta 3M dö (annars återuppstår systemfel #4 en nivå upp).

export function jordanRaiseAfterSignoff(hand: Hand, M: Major): ResponseResult {
  const { points: sp } = pointsWithFloor(hand, M, 'support')
  if (sp >= 13) {
    return { call: `4${BID[M]}`, rule: 'Jordan: höjning till utgång', explanation: `Mer än limithöjning → 4${SYM[M]} (utgång).` }
  }
  return { call: 'P', rule: 'Jordan: pass på avslut', explanation: `Ren limithöjning, öppnaren avböjde → pass.` }
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
      explanation: `${isVoid ? 'renons' : 'singel'} i ${SYM[shortSuit]} → 3${SYM[shortSuit]} (visar korthet, öppnaren värderar).`,
    }
  }
  if (sp >= 8) return { call: `4${mBid}`, rule: 'game try: accepterar', explanation: `Platt maximum → 4${mSym} (accepterar utgång).` }
  return { call: `3${mBid}`, rule: 'game try: signoff', explanation: `Platt minimum → 3${mSym} (avböjer).` }
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
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${why} → pass.` })

  if (call === 'P') return null
  if (call === `4${mBid}`) return pass('öppnaren bjöd utgång')

  // Öppnaren rebjöd sin högfärg (6+).
  if (call === `2${mBid}`) {
    if (len[M] >= 3 && p >= 10) return { call: `3${mBid}`, rule: 'inbjudan', explanation: `3+ stöd → 3${mSym} (3-korts limithöjning).` }
    if (p >= 11) return { call: '2NT', rule: 'inbjudan', explanation: `Inbjudningsstyrka → 2NT (inbjudan).` }
    return pass('preferens, minimum')
  }
  if (call === `3${mBid}`) return p >= 8 ? { call: `4${mBid}`, rule: 'accepterar', explanation: `Accepterar → 4${mSym}.` } : pass('minimum')

  // Öppnaren bjöd 2NT (18–19).
  if (call === '2NT') return p >= 7 ? { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden mittemot 18–19 → 3NT.` } : pass('minimum balanserad')

  // Hoppskift (3♣/3♦, eller 3♥ över 1♠) – krav, öppnaren visade 16+. Svararen
  // PLACERAR (familj C, frön 20260799/20260765/20261334): fit i HOPPSKIFTETS
  // färg går före preferensen — med 4+ stöd och utgångsvärden på stödpoäng
  // sätts utgången i fiten (4♥; minor: 3NT bara med håll i de objudna
  // färgerna, annars 5m). En 3-korts högfärgspreferens med utgångsvärden
  // lyfts till 4M — förr stannade 3M-preferensen under utgång och öppnaren
  // passade kravet. Svaga händer prefererar billigast som förut.
  if (rebid.rule === 'rebid: hoppskift') {
    if (rs && len[rs] >= 4) {
      const sp = pointsWithFloor(hand, rs, 'support')
      if (sp.points >= 8) {
        if (rs === 'hearts') {
          return { call: '4H', rule: 'utgång', explanation: `4+ stöd i ♥ → 4♥ (utgång i hoppskiftets färg).` }
        }
        const unbid = RANK.filter((s) => s !== M && s !== rs)
        if (unbid.every((s) => hasStopper(hand, s))) {
          return { call: '3NT', rule: 'till spel', explanation: `4+ stöd i ${SYM[rs]} men håll runtom → 3NT.` }
        }
        return { call: `5${BID[rs]}`, rule: 'utgång', explanation: `4+ stöd i ${SYM[rs]}, håll saknas för sang → 5${SYM[rs]} (utgång).` }
      }
    }
    if (len[M] >= 3) {
      const spM = pointsWithFloor(hand, M, 'support')
      if (spM.points >= 8) {
        return { call: `4${mBid}`, rule: 'utgång', explanation: `3+ stöd → 4${mSym} (utgång mot hoppskiftet).` }
      }
      return { call: `3${mBid}`, rule: 'preferens (GF)', explanation: `3+ stöd → 3${mSym} (preferens, utgångskrav).` }
    }
    return { call: '3NT', rule: 'till spel', explanation: `Ingen fit → 3NT.` }
  }
  // Reverse (2♠ över 1♥) – krav.
  if (rebid.rule === 'rebid: reverse') {
    if (len[M] >= 3) return { call: `3${mBid}`, rule: 'preferens (GF)', explanation: `3+ stöd → 3${mSym} (preferens, krav).` }
    return { call: '2NT', rule: 'krav-svar', explanation: `Krav efter reverse → 2NT.` }
  }

  // Naturlig ny färg (2♣/2♦, eller 2♥ över 1♠) – ej krav.
  if (rs && rs !== M) {
    if (len[M] >= 3 && p >= 10) return { call: `3${mBid}`, rule: 'inbjudan (limithöjning)', explanation: `3+ stöd → 3${mSym} (limithöjning).` }
    if (len[rs] >= 4 && p <= 10) return pass(`stöd i ${SYM[rs]}`)
    if (p >= 11 && bal) return { call: '2NT', rule: 'inbjudan', explanation: `Balanserad inbjudan → 2NT.` }
    // Felrapport #59 (§5.1 "en ny färg av svararen efter 1NT lovar 5+ kort och
    // förnekar stöd" — regeln stod i boken men saknades här): egen 5+ färg som
    // ryms på 2-läget (över öppnarens återbud, under hennes högfärg) bjuds
    // naturligt, svagt och utan krav. 6+ kort går FÖRE en 2-korts preferens
    // (6-1 spelar bättre än 5-2), 5 kort efter. Längst först, lika → högst.
    const ownSuitAtTwo = (min: number): Suit | null =>
      RANK.filter((s) => s !== M && s !== rs && rankOf(s) > rankOf(rs) && rankOf(s) < rankOf(M) && len[s] >= min)
        .sort((a, b) => len[b] - len[a] || rankOf(b) - rankOf(a))[0] ?? null
    const newSuit = (s: Suit): ResponseResult => ({
      call: `2${BID[s]}`,
      rule: 'ny färg efter 1NT',
      explanation: `Egen färg utan stöd → 2${SYM[s]} (naturligt, 5+ kort – oftast 6 –, svag hand; partnern får passa).`,
    })
    const six = ownSuitAtTwo(6)
    if (six) return newSuit(six)
    if (len[M] >= 2 && rankOf(M) > rankOf(rs)) return { call: `2${mBid}`, rule: 'preferens', explanation: `Preferens → 2${mSym}.` }
    const five = ownSuitAtTwo(5)
    if (five) return newSuit(five)
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
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${why} → pass.` })

  switch (response.rule) {
    case 'Stayman': {
      // Garbage Stayman: 2♣ med 0–7 hp (per definition svag). Riktig Stayman
      // lovar 8+. 5-5 i högfärgerna: passa ett hf-svar (fit), men över 2♦
      // (ingen hf) bjud 2 i den bästa högfärgen. Annars (4-4-4-1) passa alltid.
      if (p <= 7) {
        if (sp === 5 && he === 5 && rebid.call === '2D') {
          const call = suitHcp(hand, 'spades') > suitHcp(hand, 'hearts') ? '2S' : '2H'
          return { call, rule: 'svararens signoff', explanation: `5-5 i högfärgerna, svag → ${SYM[suitOfCall(call)!]} (bästa delfärg).` }
        }
        return pass('garbage Stayman – bättre delkontrakt än 1NT')
      }
      if (rebid.call === '2D') {
        // Öppnaren förnekade 4-korts högfärg.
        if (((sp === 5 && he === 4) || (he === 5 && sp === 4)) && p >= 10) {
          const call = sp === 5 && he === 4 ? '3H' : '3S' // hoppa i den KORTARE högfärgen
          return { call, rule: 'Smolen', explanation: `5-4 i högfärgerna → ${SYM[suitOfCall(call)!]} på 3-läget (Smolen, utgångskrav).` }
        }
        // 5-4 i högfärgerna med inbjudningsstyrka (8–9): visa den LÅNGA
        // högfärgen naturligt på 2-läget (systembok §4.3), inte 2NT.
        if ((sp === 5 && he === 4) || (he === 5 && sp === 4)) {
          const call = sp === 5 ? '2S' : '2H'
          return { call, rule: 'inbjudan', explanation: `5-4 i högfärgerna → ${SYM[suitOfCall(call)!]} (naturlig inbjudan).` }
        }
        return p >= 10
          ? { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden utan fit → 3NT.` }
          : { call: '2NT', rule: 'inbjudan', explanation: `Inbjudan utan fit → 2NT.` }
      }
      // Öppnaren visade en högfärg (2♥/2♠).
      const target = suitOfCall(rebid.call)
      if (target && len[target] >= 4) {
        return p >= 10
          ? { call: `4${BID[target]}`, rule: 'utgång', explanation: `Utgångsvärden + fit → 4${SYM[target]}.` }
          : { call: `3${BID[target]}`, rule: 'inbjudan', explanation: `Inbjudan + fit → 3${SYM[target]}.` }
      }
      return p >= 10
        ? { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden utan fit → 3NT.` }
        : { call: '2NT', rule: 'inbjudan', explanation: `Inbjudan utan fit → 2NT.` }
    }

    case 'Jacoby-transfer': {
      const target: Suit = response.call === '2D' ? 'hearts' : 'spades'
      const tBid = BID[target]
      const tSym = SYM[target]
      if (rebid.rule === 'superaccept') return { call: `4${tBid}`, rule: 'utgång', explanation: `Accepterar superaccept → 4${tSym}.` }
      // 5-5 i högfärgerna: transferriktningen kodade styrkan (ägarbeslut).
      // Transfer till ♥ (2♦) = inbjudan → visa 5-5 med 2♠; transfer till ♠ (2♥)
      // = GF → visa 5-5 med 3♥ (den andra högfärgen på 3-läget).
      if (len.hearts === 5 && len.spades === 5) {
        return target === 'hearts'
          ? { call: '2S', rule: 'inbjudan', explanation: `5-5 i högfärgerna → 2♠ (inbjudan; öppnaren väljer).` }
          : // Var felmärkt 'utgång' (avslut) fast budet är utgångskrav — etiketten
            // rättad av betydelsesvepet 2026-09-04, samma bud.
            { call: '3H', rule: 'ny färg (GF)', explanation: `5-5 i högfärgerna, utgångskrav → 3♥ (öppnaren väljer högfärg).` }
      }
      if (len[target] >= 6) {
        if (p >= 10) return { call: `4${tBid}`, rule: 'utgång', explanation: `Utgångsvärden, 6+ ${SYM[target]} → 4${tSym}.` }
        if (p >= 8) return { call: `3${tBid}`, rule: 'inbjudan', explanation: `6+ ${SYM[target]} → 3${tSym} (inbjudan).` }
        return pass('svag enfärgshand')
      }
      // Exakt 5-korts högfärg, balanserad.
      if (p >= 10) return { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden, 5 ${SYM[target]} → 3NT (öppnaren väljer 3NT/4 i färgen).` }
      if (p >= 8) return { call: '2NT', rule: 'inbjudan', explanation: `5 ${SYM[target]} → 2NT (inbjudan).` }
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
      if (rebid.call === '2NT') return { call: '3NT', rule: 'till spel', explanation: `Ingen minorfit → 3NT.` }
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
export function responderRebidIn2NTAuction(response: ResponseResult, rebid: ResponseResult, hand: Hand, openerMin = 20): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const sp = len.spades
  const he = len.hearts
  const game = 25 - openerMin // svag transfer (signoff) under utgångsstyrka
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${why} → pass.` })

  switch (response.rule) {
    case 'Stayman (2NT)': {
      if (rebid.call === '3D') {
        // Öppnaren förnekade 4-korts högfärg.
        if ((sp === 5 && he === 4) || (he === 5 && sp === 4)) {
          const call = sp === 5 ? '3H' : '3S' // bjud 4-korts hf → visar 5 i den andra
          return { call, rule: 'Smolen', explanation: `5-4 i högfärgerna → ${SYM[suitOfCall(call)!]} (Smolen över 2NT, utgångskrav).` }
        }
        return { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden utan fit → 3NT.` }
      }
      // Öppnaren visade en högfärg (3♥/3♠).
      const target = suitOfCall(rebid.call)
      if (target && len[target] >= 4) return { call: `4${BID[target]}`, rule: 'utgång', explanation: `Fit → 4${SYM[target]} (utgång).` }
      return { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden utan fit → 3NT.` }
    }

    case 'transfer (2NT)': {
      const target: Suit = response.call === '3D' ? 'hearts' : 'spades'
      // Svag (signoff i delkontrakt) → passa den fullföljda transfern.
      if (p < game) return pass('svag – transfern var ett signoff i delkontrakt')
      if (len[target] >= 6) return { call: `4${BID[target]}`, rule: 'utgång', explanation: `6+ ${SYM[target]} → 4${SYM[target]} (utgång).` }
      // Exakt 5-korts högfärg, GF → 3NT (öppnaren väljer 3NT eller 4 i färgen).
      return { call: '3NT', rule: 'till spel', explanation: `5 ${SYM[target]} → 3NT (öppnaren väljer 3NT/4 i färgen).` }
    }

    default:
      return null // Texas/minorfråga/3NT/4NT/6NT är redan placerade (minorfråga-slam = §6)
  }
}

// === New Minor Forcing (§5.7) ================================================
// Efter 1m–1M(1-läget)–1NT kan öppnarens 1NT dölja 3-korts stöd i svararens
// högfärg (eller en egen 4-korts högfärg). Med en 5-korts högfärg + inbjudande+
// värden (11+) bjuder svararen den OANVÄNDA lågfärgen konstgjort & tvingande och
// frågar efter den dolda passningen, i stället för att gissa sang och tappa en
// 5-3-fit. Efter 1♥–1♠–1NT är båda lågfärgerna lediga → bjud den starkare
// (mest hp, antyder stopp); vid lika den billigaste (klöver). Ägarbeslut 2026-07-05.
function newMinorForcingBid(hand: Hand, opened: Suit, responderSuit: Suit, p: number): ResponseResult | null {
  if (responderSuit !== 'hearts' && responderSuit !== 'spades') return null // NMF jagar en HÖGfärgsfit
  if (lengths(hand)[responderSuit] < 5) return null // 5-3-fit kräver 5-korts högfärg
  if (p < 11) return null // inbjudande+ värden

  const freeMinors = (['clubs', 'diamonds'] as Suit[]).filter((m) => m !== opened && m !== responderSuit)
  if (freeMinors.length === 0) return null
  const nmfMinor = freeMinors.length === 1
    ? freeMinors[0]
    : suitHcp(hand, 'diamonds') > suitHcp(hand, 'clubs') ? 'diamonds' : 'clubs'

  const call = `2${BID[nmfMinor]}`
  return {
    call,
    rule: 'New Minor Forcing',
    explanation: `5+ ${SYM[responderSuit]}, 11+ hp – ${pretty(call)} = New Minor Forcing (konstgjort, krav): frågar öppnarens dolda 3-stöd i ${SYM[responderSuit]} eller egen 4+ högfärg.`,
  }
}

// Svararens PLACERING efter öppnarens NMF-svar (§5.7, steg 3). Svararen visade
// 11+ via NMF: 13+ = utgångskrav, 11–12 = inbjudan. Öppnarens svar visade min/max
// (hopp/3NT = maximum). Terminala bud: stöd → 4M (utgång) / pass (inbjudan mot
// minimum); sang → 3NT / pass; annars 3NT med utgångsvärden, annars pass.
export function responderPlaceAfterNMF(
  hand: Hand,
  responderMajor: Suit,
  otherMajor: Suit,
  _nmfMinor: Suit,
  opened: Suit,
  _unbidSuit: Suit,
  answer: { level: number; strain: string },
): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const rule = 'placering efter NMF'
  const game = p >= 13 // 13+ = utgångskrav; 11–12 = inbjudan
  const openerMax = answer.level >= 3 // hopp / 3NT = maximum
  const toGame = game || openerMax
  const rM = BID[responderMajor]
  const pass = (why: string): ResponseResult => ({ call: 'P', rule, explanation: `${why} → pass.` })

  // 1) Öppnaren visade STÖD i din högfärg → 5-3-fit.
  if (answer.strain === rM) {
    if (toGame) return { call: `4${rM}`, rule, explanation: `5-3-fit i ${SYM[responderMajor]}${openerMax ? ' + öppnarens maximum' : ''} → utgång 4${SYM[responderMajor]}.` }
    return pass(`inbjudan mittemot öppnarens minimum – ${SYM[responderMajor]}-delkontrakt räcker`)
  }

  // 2) Öppnaren visade den ANDRA högfärgen (4 kort, minimum).
  if (otherMajor !== opened && answer.strain === BID[otherMajor]) {
    if (len[otherMajor] >= 4) {
      if (toGame) return { call: `4${BID[otherMajor]}`, rule, explanation: `4-4-fit i ${SYM[otherMajor]} → utgång.` }
      return pass(`4-4-fit men bara inbjudan mittemot minimum`)
    }
    if (game) return { call: '3NT', rule, explanation: `Utgångsvärden, ingen högfärgsfit → 3NT.` }
    return pass('ingen fit, bara inbjudan')
  }

  // 3) Öppnaren bjöd sang (2NT minimum / 3NT maximum).
  if (answer.strain === 'NT') {
    if (answer.level >= 3) return pass('öppnaren bjöd redan 3NT')
    if (game) return { call: '3NT', rule, explanation: `Utgångsvärden → 3NT.` }
    return pass('inbjudan mittemot minimum')
  }

  // 4) Öppnaren höjde NMF-lågfärgen / rebjöd egen färg (ingen högfärgspassning).
  if (game) return { call: '3NT', rule, explanation: `Utgångsvärden, ingen högfärgsfit → 3NT.` }
  return pass('ingen fit, bara inbjudan')
}

// Svararens PLACERING efter öppnarens svar på 3♣-CHECKBACK (§5.2). Svararen har
// 5+ spader + 4 hjärter. Visade öppnaren sin dolda ANDRA högfärg (3♥ = 4 hjärter)
// finns 4-4-fiten → utgång där. Visade öppnaren 3-stöd i vår färg (3♠) är det en
// 5-3-fit → utgång där. Bjöd öppnaren 3NT (ingen fit) står 3NT → pass.
export function responderPlaceAfter2NTCheckback(hand: Hand, responderMajor: Suit, answer: ResponseResult): ResponseResult {
  const len = lengths(hand)
  const other: Suit = responderMajor === 'hearts' ? 'spades' : 'hearts'
  const rule = 'placering efter 2NT-checkback'
  const ansSuit = suitOfCall(answer.call)
  // Öppnaren visade sin dolda andra högfärg → 4-4-fit i den.
  if (ansSuit === other && len[other] >= 4) {
    return { call: `4${BID[other]}`, rule, explanation: `4-4-fit i ${SYM[other]} → utgång 4${SYM[other]}.` }
  }
  // Öppnaren visade 3-stöd i vår färg → 5-3-fit.
  if (ansSuit === responderMajor && len[responderMajor] >= 5) {
    return { call: `4${BID[responderMajor]}`, rule, explanation: `5-3-fit i ${SYM[responderMajor]} → utgång 4${SYM[responderMajor]}.` }
  }
  return { call: 'P', rule, explanation: `Öppnaren nekade högfärgsfit, 3NT står → pass.` }
}

// === Punkt 12: svararens andra bud i färgauktioner (fjärde färg krav), §6.6 ==

export function responderRebidColorAuction(hand: Hand, opened: Suit, responderSuit: Suit, rebid: ResponseResult): ResponseResult | null {
  const p = hcp(hand)
  const len = lengths(hand)
  const y = responderSuit
  const yMaj = y === 'hearts' || y === 'spades'
  const pass = (why: string): ResponseResult => ({ call: 'P', rule: 'svararens pass', explanation: `${why} → pass.` })
  const ntLadder = (): ResponseResult => (p >= 13
    ? { call: '3NT', rule: 'till spel', explanation: `Utgångsvärden → 3NT.` }
    : p >= 11
      ? { call: '2NT', rule: 'inbjudan', explanation: `Inbjudan → 2NT.` }
      : pass('minimum'))

  switch (rebid.rule) {
    // Öppnaren höjde svararens färg.
    case 'höjning till utgång':
      return pass('öppnaren bjöd utgång')
    case 'hopphöjning (inbjudan)':
      return p >= 8 ? { call: `4${BID[y]}`, rule: 'accepterar', explanation: `Accepterar → 4${SYM[y]}.` } : pass('minimum')
    case 'enkel höjning':
      if (yMaj) {
        if (p >= 13) return { call: `4${BID[y]}`, rule: 'utgång', explanation: `Utgångsvärden → 4${SYM[y]}.` }
        if (p >= 11) return { call: `3${BID[y]}`, rule: 'inbjudan', explanation: `Inbjudan → 3${SYM[y]}.` }
        return pass('minimum')
      }
      return ntLadder()
    case 'höjning av minor':
      return ntLadder()

    // Öppnaren visade balanserat eller egen färg.
    case '2NT (18–19)': {
      // Systems on (checkback) mot öppnarens 18–19 bal (§5.2). Öppnarens 2NT
      // NEKADE 4-stöd i vår färg OCH en billigt visbar 4-korts högfärg (hade hen
      // 4 spader efter vårt 1♥ hade hen bjudit 1♠). Den ENDA dolda högfärgen är
      // därför hjärter som öppnaren inte kunde visa efter vårt 1♠-svar (2♥ vore
      // reverse). Dolda fitar: (a) öppnarens 3-stöd i vår 5-korts högfärg (5-3)
      // → direkt 3♥/3♠; (b) 4-4 i hjärter efter ett 1♠-svar → 3♣ checkback.
      if (yMaj) {
        // Efter 1♠-svar med 4 hjärter (⇒ 5+ spader, annars 1♥ upp): 3♣ jagar
        // öppnarens dolda 4-korts hjärter (4-4) OCH 3-stöd i spader (5-3).
        if (y === 'spades' && len.hearts === 4) {
          return { call: '3C', rule: '2NT-checkback', explanation: `5+ ♠ + 4 ♥ → 3♣ (checkback: frågar öppnarens dolda 4+ ♥ eller 3-stöd i ♠).` }
        }
        // Egen 5+ högfärg utan sidohögfärg att jaga → direkt 3♥/3♠ (5-3).
        if (len[y] >= 5) {
          return { call: `3${BID[y]}`, rule: '2NT-återbud (5-3-jakt)', explanation: `5+ ${SYM[y]} → 3${SYM[y]} (söker öppnarens dolda 3-stöd, 5-3).` }
        }
      }
      // Ingen högfärg att jaga → placering mot 18–19.
      return { call: '3NT', rule: 'till spel', explanation: `Mittemot 18–19, ingen högfärgsfit att jaga → 3NT.` }
    }
    case 'oklart': // 1NT-reservfallet (§5.2 steg 7) — behandlas som 1NT-återbud
    // (systemfel #2, frö 20261317: utan detta nåddes aldrig NMF och svararen
    // lämnades att passa den framtvingade fortsättningen).
    case '1NT (12–14)': {
      // New Minor Forcing först (5-korts högfärg + 11+), annars sang-stegen.
      const nmf = newMinorForcingBid(hand, opened, y, p)
      if (nmf) return nmf
      return ntLadder()
    }
    case 'rebjuden färg':
      if (len[opened] >= 2 && p <= 10) return pass(`preferens ${SYM[opened]}`)
      return ntLadder()
    case 'hopp i egen färg (inbjudan)':
      return p >= 8 ? { call: '3NT', rule: 'till spel', explanation: `Accepterar → 3NT.` } : pass('minimum')

    // Öppnaren visade en NY färg → fjärde färg krav blir aktuellt.
    case 'ny färg (1-läget)':
    case 'ny färg (2-läget)':
    case 'reverse': {
      const second = suitOfCall(rebid.call)
      if (second) return fourthSuit(hand, opened, y, second, rebid)
      return null
    }

    // Öppnarens hoppskift (1x–1y–3z, TP-steg E) är UTGÅNGSKRAV – svararen får
    // ALDRIG passa: placera kontraktet (fast arrival, öppnaren har visat styrkan).
    case 'hoppskift': {
      const second = suitOfCall(rebid.call)
      const fourth = second ? RANK.find((s) => s !== opened && s !== y && s !== second) : undefined
      if ((opened === 'hearts' || opened === 'spades') && len[opened] >= 3) {
        return { call: `4${BID[opened]}`, rule: 'utgång', explanation: `3+ stöd → 4${SYM[opened]} (utgång mot hoppskiftet).` }
      }
      if (yMaj && len[y] >= 6) {
        return { call: `4${BID[y]}`, rule: 'utgång', explanation: `6+ ${SYM[y]} → 4${SYM[y]}.` }
      }
      if (fourth && hasStopper(hand, fourth)) {
        return { call: '3NT', rule: 'till spel', explanation: `Stopp i ${SYM[fourth]} → 3NT.` }
      }
      if (second && len[second] >= 4) {
        return { call: `5${BID[second]}`, rule: 'utgång', explanation: `4+ stöd i ${SYM[second]} → 5${SYM[second]}.` }
      }
      return { call: '3NT', rule: 'till spel', explanation: `Utgångskrav utan bättre bud → 3NT (förenkling).` }
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

  // 1. Fit i öppnarens andra färg — GRADERAD efter stödpoäng (etapp 5 fix 1,
  // §6.6): under 10 = billigaste höjning, 10–12 = hopphöjning (inbjudan),
  // 13+ = utgång. Förr sa en 13-hand samma 2♠ som en 6-hand → öppnaren passade
  // på minimum och utgången försvann (frön 20260748/20261646).
  // Undantag (oförändrat): efter en REVERSE har öppnaren 17+ och den billigaste
  // höjningen är redan krav — då tas inget utrymme; och en MINORhöjning ligger
  // redan på 3-läget, så den graderas inte uppåt (utgång i minor kräver 11 stick;
  // med utgångsvärden går vägen via 3NT/fjärde färg nedan).
  if (len[second] >= 4) {
    const call = bidAbove(second, rebid.call)
    const secondIsMajor = second === 'hearts' || second === 'spades'
    if (secondIsMajor && rebid.rule !== 'reverse') {
      const sp = pointsWithFloor(hand, second, 'support')
      const level = parseInt(call[0], 10)
      if (sp.points >= 13 && level < 4) {
        return {
          call: `4${BID[second]}`,
          rule: 'utgång',
          explanation: `4+ stöd i ${SYM[second]} → 4${SYM[second]} (utgång).`,
        }
      }
      if (sp.points >= 10 && level + 1 < 4) {
        const jump = `${level + 1}${BID[second]}`
        return {
          call: jump,
          rule: 'hopphöjning (inbjudan)',
          explanation: `4+ stöd i ${SYM[second]} → ${pretty(jump)} (inbjudan).`,
        }
      }
    }
    return { call, rule: 'höjning', explanation: `4+ stöd i ${SYM[second]} → ${pretty(call)}.` }
  }
  // 2. Egen 6-korts färg — GRADERAD (systemfel #3 delfix 4a, ägarbeslut
  // 2026-08-07): ≤10 = billigaste rebud (minimum), 11–12 = hoppinvit, 13+
  // faller VIDARE till steg 3 så fjärde färg-kravet placerar utgången. Förr
  // sa en 16-poängare samma billiga 2♥ som en 6-poängare → öppnaren passade
  // och 30 hp dog i 2♥ (frö 20261323).
  if (len[y] >= 6) {
    const call = bidAbove(y, rebid.call)
    if (p <= 10) {
      return { call, rule: 'rebjuden färg', explanation: `6+ ${SYM[y]} → ${pretty(call)}.` }
    }
    const level = parseInt(call[0], 10)
    if (p <= 12) {
      if (level + 1 <= 3) {
        const jump = `${level + 1}${BID[y]}`
        return { call: jump, rule: 'rebjuden färg (inbjudan)', explanation: `6+ ${SYM[y]} → ${pretty(jump)} (hoppinvit).` }
      }
      return { call, rule: 'rebjuden färg', explanation: `6+ ${SYM[y]} → ${pretty(call)} (utrymmet medger inget hopp).` }
    }
    // 13+: utgångsstyrka — gå fjärde färg-vägen (steg 3) i stället för att
    // rebjuda billigt och riskera pass.
  }
  // 3. GF utan naturligt bud → 3NT med stopp, annars fjärde färg krav.
  if (p >= 12) {
    if (bal && hasStopper(hand, fourth)) return { call: '3NT', rule: 'till spel', explanation: `Stopp i ${SYM[fourth]} → 3NT.` }
    const call = bidAbove(fourth, rebid.call)
    return { call, rule: 'fjärde färg krav', explanation: `Utgångskrav utan naturligt bud → ${pretty(call)} (fjärde färg, krav).` }
  }
  // 4. Inbjudan balanserad.
  if (bal && p >= 11) return { call: '2NT', rule: 'inbjudan', explanation: `Balanserad inbjudan → 2NT.` }
  // 5. Preferens till öppnarens första färg, annars pass.
  if (len[x] >= 2) {
    const call = bidAbove(x, rebid.call)
    return { call, rule: 'preferens', explanation: `Preferens → ${pretty(call)}.` }
  }
  // En reverse är krav 1 rond – får aldrig passas (TP-steg E gör reverser
  // vanligare, så hålet täpps): utan preferens → 2NT som kravsvar.
  if (rebid.rule === 'reverse') {
    return { call: '2NT', rule: 'krav-svar', explanation: `Krav efter reverse, ingen preferens → 2NT.` }
  }
  return { call: 'P', rule: 'svararens pass', explanation: `Inget bättre → pass.` }
}
