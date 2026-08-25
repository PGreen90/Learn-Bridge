// Punkt 21–22: inkliv och tvåfärgsinkliv, systembok §7.1–7.2.
//
//   overcall          – vad bjuder vi när motståndaren öppnat 1 i färg?
//                       (enkelt inkliv, 1NT-inkliv, Michaels, ovanlig 2NT,
//                        upplysningsdubbling, pass)
//   advanceOvercall   – svar på partnerns enkla inkliv (höjning, cue=limit+,
//                       ny färg, NT)
//
// Avgränsning: hanterar motståndarens 1-läges färgöppning (1♣/1♦/1♥/1♠) – det
// vanligaste störningsläget. Svar mot deras 1NT (DONT) ligger i `dont.ts`, mot
// konventionella/svaga öppningar i `defense-conventional.ts`, och dubblingar när
// VI öppnat (negativ/responsiv/stöd) i `doubles.ts`.

import type { Hand, Rank, Suit } from '../../types/bridge'
import { pointsWithFloor } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'
import type { ResponseResult } from './responses'

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
const rankIdx = (s: Suit) => RANK_ORDER.indexOf(s)
const isMinor = (s: Suit) => s === 'clubs' || s === 'diamonds'

/** Tolkar en 1-läges färgöppning ("1H" → hearts). null annars (t.ex. 1NT). */
export function openingSuit(call: string): Suit | null {
  const m = call.match(/^1(C|D|H|S)$/)
  return m ? SUIT_OF_LETTER[m[1]] : null
}

const TOP5: Rank[] = ['A', 'K', 'Q', 'J', '10']

/** Kvalitetsfärg (§7.1 "färgkvalitet går före poäng"): 3+ av topp-5 i färgen. */
function goodSuit(hand: Hand, suit: Suit): boolean {
  return hand.filter((c) => c.suit === suit && TOP5.includes(c.rank)).length >= 3
}

/** Grov stopp-koll för NT: A, Kx, Qxx eller J10xx. */
export function hasStopper(hand: Hand, suit: Suit): boolean {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  const n = ranks.length
  const has = (r: Rank) => ranks.includes(r)
  if (has('A')) return true
  if (has('K') && n >= 2) return true
  if (has('Q') && n >= 3) return true
  if (has('J') && has('10') && n >= 4) return true
  return false
}

/** Nivån vårt inkliv hamnar på (1 om vår färg rankar över deras, annars 2). */
function overcallLevel(our: Suit, their: Suit): number {
  return rankIdx(our) > rankIdx(their) ? 1 : 2
}

/** Längsta inklivbara 5+ färg (≠ deras); lika längd → högst rankad. */
function bestOvercallSuit(len: Record<Suit, number>, their: Suit): Suit | null {
  let best: Suit | null = null
  for (const s of RANK_ORDER) {
    if (s === their || len[s] < 5) continue
    if (best === null || len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  return best
}

/**
 * Vad bjuder vi över motståndarens 1-läges färgöppning? §7.1–7.2.
 *
 * `balancing` = sitter vi i BALANSERINGSSITS (deras öppning har följts av två
 * pass, given är på väg att passas ut)? Då "lånar vi en kung": partnern är
 * markerad med värden, så §7-golven sänks med 3 hp (ägarbeslut 2026-07-05).
 * Sänks: enkelt inkliv 8→5, upplysnings-X 12→9 (perfekt form 10→7), och
 * 1NT-inklivet flyttas 15–18 → 11–14 (klassisk återöppnings-1NT). Michaels/
 * ovanlig 2NT (formbud) och den starka 17+-X:en rörs inte.
 *
 * F4 (D9, 2026-08-07): inklivsgolven (enkelt inkliv + upplysnings-X) läser
 * TP = `max(hp, startpoäng)` — en formstark hand kliver in ett golv tidigare.
 * ADDITIVT ovanpå kungalånet (TP = formspak, kungen = sitsspak). Rå HP behålls
 * där form inte hör hemma: 1NT-fönstren (sang), inklivstaket 16, 17+-styrningen
 * och hoppinklivet (spärrmaterial ska förbli spärr).
 */
export function overcall(hand: Hand, theirCall: string, balancing = false): ResponseResult {
  const their = openingSuit(theirCall)
  const pass: ResponseResult = { call: 'P', rule: 'pass', explanation: 'ingen lämplig aktion → pass.' }
  if (!their) return pass

  const p = hcp(hand)
  const fp = pointsWithFloor(hand, null, 'starting') // F4: golven läser max(hp, startpoäng)
  const len = lengths(hand)
  const unbid = RANK_ORDER.filter((s) => s !== their)
  const relief = balancing ? 3 : 0 // "låna en kung" – sänk HP-golven i balansering

  // 1) Ovanlig 2NT: 5-5 i de två lägsta objudna färgerna.
  const twoLowest = unbid.slice(0, 2)
  if (len[twoLowest[0]] >= 5 && len[twoLowest[1]] >= 5) {
    return { call: '2NT', rule: 'ovanlig 2NT', explanation: `5-5 i ${SYM[twoLowest[0]]}+${SYM[twoLowest[1]]} → 2NT (ovanlig, två lägsta objudna).` }
  }

  // 2) Michaels cue-bud (5-5).
  if (isMinor(their)) {
    if (len.hearts >= 5 && len.spades >= 5) {
      return { call: `2${BID[their]}`, rule: 'Michaels', explanation: `5-5 i högfärgerna → 2${SYM[their]} (Michaels cue).` }
    }
  } else {
    const otherMajor: Suit = their === 'hearts' ? 'spades' : 'hearts'
    const bestMinor: Suit = len.clubs >= len.diamonds ? 'clubs' : 'diamonds'
    if (len[otherMajor] >= 5 && len[bestMinor] >= 5) {
      return { call: `2${BID[their]}`, rule: 'Michaels', explanation: `5-5 ${SYM[otherMajor]} + minor → 2${SYM[their]} (Michaels cue).` }
    }
  }

  // 3) 1NT-inkliv: 15–18 balanserad med stopp (direkt); 11–14 i balansering
  // (klassisk återöppnings-1NT – den starka 15–18-handen dubblar först där).
  const ntLow = balancing ? 11 : 15
  const ntHigh = balancing ? 14 : 18
  if (isBalanced(hand) && p >= ntLow && p <= ntHigh && hasStopper(hand, their)) {
    return { call: '1NT', rule: '1NT-inkliv', explanation: `Balanserad (${ntLow}–${ntHigh} hp) med stopp i ${SYM[their]} → 1NT-inkliv (kör 1NT-systemet).` }
  }

  // 3.5) 17+ STARK ENFÄRGSHAND (ägarregel, felrapport #23): en hand med 17+ hp och
  // en egen lång färg är FÖR STARK för ett enkelt inkliv – partnern kan passa
  // inklivet och en kall utgång missas. Starta i stället med X (upplysning, rondkrav)
  // oavsett fördelning; på nästa varv "överröstar" vi partnern och bjuder vår egna
  // färg, och DÅ är den starka enfärgshanden signalerad. (Balanserade 17–18 med
  // stopp tas redan av 1NT-inklivet ovan, så hit når bara den obalanserade starka
  // handen.)
  const strongSuit = bestOvercallSuit(len, their)
  if (p >= 17 && strongSuit) {
    return { call: 'X', rule: 'upplysningsdubbling (stark)', explanation: `17+ hp – för starkt för ett enkelt inkliv → X (upplysning; visar egen färg på nästa varv, stark enfärgshand).` }
  }

  // 4) Upplysningsdubbling: kort i deras färg, stöd i övriga. Ägarbeslut
  // 2026-07-03 (aggressiv standard, uppföljning felrapport #5): golvet är
  // 10 hp – men BARA med perfekt form (max 2 i deras färg + stöd i alla
  // objudna + INGEN egen 5-korts färg, då inkliver vi hellre). Med
  // öppningsstyrka (12+) räcker som förut även en hand med 5-korts färg.
  // Jämna händer utan korthet dubblar aldrig.
  const shortTheirs = len[their] <= 2
  const supportUnbid = unbid.every((s) => len[s] >= 3)
  const longestUnbid = Math.max(...unbid.map((s) => len[s]))
  if (shortTheirs && supportUnbid && ((fp.points >= 12 - relief && longestUnbid <= 5) || (fp.points >= 10 - relief && longestUnbid <= 4))) {
    return { call: 'X', rule: 'upplysningsdubbling', explanation: `10+ hp, korthet i ${SYM[their]}, stöd i övriga → X (upplysning).` }
  }

  // 5) Enkelt inkliv: bra 5+ färg, 8–16 hp (golv 8→5 i balansering; golvet
  // läser TP). Två F4-VAKTER på TP-lyftet:
  //   a) spärrmaterial (6+ färg, rå 6–10 hp) lyfts INTE — det ska förbli ett
  //      svagt hoppinkliv (regel 6), inte bli "konstruktivt";
  //   b) lyftet kräver KVALITETSFÄRG (3+ av topp-5) — "färgkvalitet går före
  //      poäng": ett under-golvet-inkliv ska bäras av färgen, inte av
  //      längdpoäng på skräpfärger (frö 20261020: 5-5 med QJ975 ska passa).
  const ov = bestOvercallSuit(len, their)
  const preemptMaterial = ov !== null && len[ov] >= 6 && p <= 10
  const ovPts = ov && goodSuit(hand, ov) && !preemptMaterial ? fp.points : p
  // Löftet: inklivsintervallet (taket 16 – 17+ dubblar; golvet sänks i balansering).
  const ovRange = `${8 - relief}–16 hp`
  if (ov && ovPts >= 8 - relief && p <= 16) {
    const lvl = overcallLevel(ov, their)
    // Svagt hoppinkliv: 6-korts färg, 6–10 hp som annars hade krävt 2-läget.
    return { call: `${lvl}${BID[ov]}`, rule: 'enkelt inkliv', explanation: `${ovRange} med 5+ ${SYM[ov]} → ${lvl}${SYM[ov]} (inkliv).` }
  }

  // 6) Svagt hoppinkliv: 6-korts färg, 6–10 hp (spärr).
  if (ov && len[ov] >= 6 && p >= 6 && p <= 10) {
    const lvl = overcallLevel(ov, their) + 1
    return { call: `${lvl}${BID[ov]}`, rule: 'hoppinkliv', explanation: `(6–10 hp) med 6+ ${SYM[ov]} → ${lvl}${SYM[ov]} (svagt hoppinkliv, spärr).` }
  }

  // 7) 17+ SOM INTE FICK PLATS I NÅGOT FÖNSTER: sälj ALDRIG given → X.
  // Felrapport #40: en 20-poängare vars enda långfärg var ÖPPNARENS färg
  // (KQJ964 hjärter över 1♥) hade ingen väg in — regel 3.5 kräver en EGEN 5+
  // färg, upplysnings-X:et (regel 4) kräver korthet i deras färg, och det
  // naturliga inklivet är kapat vid 16. Handen passade och 1♥ såldes på fläcken.
  // Samma utlopp som §7.6-försvaret redan har mot svaga tvåor och spärrar
  // (`defendWeakTwo`/`defendPreempt`): partnern måste svara, och den starka
  // handen får beskriva sig på nästa varv.
  if (p >= 17) {
    return { call: 'X', rule: 'upplysningsdubbling (stark)', explanation: `17+ hp – för stark för att sälja given → X (upplysning).` }
  }

  return pass
}

/**
 * X när motståndarna bjudit TVÅ 1-lägesfärger (öppning + svar i ny färg), t.ex.
 * 1♦–(P)–1♥ och vi sitter direkt över svararen. §7.3 "efter två bjudna färger".
 *
 * Ägarregel 2026-07-05: X lovar **4+4+ i de två OBJUDNA färgerna** (äkta 4-4 –
 * partnern har bara två färger att välja mellan; en 5-korts objuden färg
 * inkliver vi hellre), 10+ hp.
 *
 * F6 (C5, 2026-08-08): den STARKA ENFÄRGSHANDEN (17+ hp med egen 5+ OBJUDEN
 * färg) dubblar också här – för stark för ett inkliv som kan passas ut, precis
 * som över enbart öppningen (regel 3.5 i `overcall`, felrapport #23). Färgen
 * visas på nästa varv (`ownStrongDoubleRebid` i budlådan) = stark enfärgshand,
 * rondkrav. Färgen måste vara OBJUDEN – annars finns inget eget återbud.
 */
export function takeoutOfResponse(hand: Hand, openSuit: Suit, respSuit: Suit): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const unbid = RANK_ORDER.filter((s) => s !== openSuit && s !== respSuit)
  const [u1, u2] = unbid

  // Stark enfärgshand: 17+ med egen 5+ objuden färg (längst; lika → högst rankad).
  let strong: Suit | null = null
  for (const s of unbid) {
    if (len[s] < 5) continue
    if (!strong || len[s] > len[strong] || (len[s] === len[strong] && rankIdx(s) > rankIdx(strong))) strong = s
  }
  if (p >= 17 && strong) {
    return { call: 'X', rule: 'upplysningsdubbling (stark)', explanation: `17+ hp – för starkt för ett inkliv som kan passas ut → X (upplysning; visar egen färg på nästa varv, stark enfärgshand).` }
  }

  // Exakt 4-4 i de objudna, 10+ hp (en 5-korts objuden färg inkliver vi hellre).
  if (p >= 10 && len[u1] === 4 && len[u2] === 4) {
    return { call: 'X', rule: 'upplysningsdubbling', explanation: `10+ hp, 4-4 i ${SYM[u1]}+${SYM[u2]} (deras ${SYM[openSuit]}+${SYM[respSuit]} objudna) → X (upplysning).` }
  }

  return { call: 'P', rule: 'pass', explanation: 'ingen aktion över deras två bjudna färger → pass.' }
}

/** Billigaste lagliga budet i `suit` STRIKT över partnerns tvåfärgsbud `refCall`. */
function cheapestBid(suit: Suit, refCall: string): string {
  const m = refCall.match(/^(\d)(NT|C|D|H|S)$/)
  if (!m) return `${BID[suit]}` // ska aldrig hända
  const refLevel = Number(m[1])
  if (m[2] === 'NT') return `${refLevel + 1}${BID[suit]}` // NT är högst i nivån → upp ett steg
  const refSuit = SUIT_OF_LETTER[m[2]]
  const level = rankIdx(suit) > rankIdx(refSuit) ? refLevel : refLevel + 1
  return `${level}${BID[suit]}`
}

/**
 * Advancers svar på partnerns TVÅFÄRGSINKLIV (Michaels / ovanlig 2NT). §7.2.
 *
 * Ägarbeslut 2026-07-01: advancern ger **preferens till den av partnerns visade
 * färger hon själv är längst i** (lika längd → högfärgen). I en **ostörd**
 * budgivning får hon **aldrig passa** – hon måste ta ut tvåfärgshanden. Är
 * motståndarna inne (`contested`) finns spelrum för pass, och partnern kan bjuda
 * igen för att visa sin ospecificerade färg (relevant för Michaels över deras
 * högfärg, där ena färgen är en okänd minor).
 *
 * `partnerCall` = partnerns bud ("2C"/"2D"/"2H"/"2S" = Michaels-cue, "2NT" =
 * ovanlig). `theirSuit` = motståndarens öppningsfärg.
 */
export function advanceTwoSuiter(hand: Hand, partnerCall: string, theirSuit: Suit, contested = false): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const unbid = RANK_ORDER.filter((s) => s !== theirSuit)

  // Vilka färger LOVAR partnern konkret?
  let known: Suit[]
  let unknownMinor = false
  if (partnerCall === '2NT') {
    known = unbid.slice(0, 2) // ovanlig 2NT = de två lägsta objudna (båda kända)
  } else if (isMinor(theirSuit)) {
    known = ['hearts', 'spades'] // Michaels över deras minor = båda högfärgerna
  } else {
    known = [theirSuit === 'hearts' ? 'spades' : 'hearts'] // andra högfärgen …
    unknownMinor = true // … + en OKÄND minor
  }

  const passContested: ResponseResult = { call: 'P', rule: 'pass', explanation: 'motståndarna är inne → pass (partnern kan bjuda igen och visa sin färg).' }

  // Michaels över deras högfärg: känd högfärg + ospecificerad minor.
  if (unknownMinor) {
    const major = known[0]
    if (len[major] >= 3) {
      const call = cheapestBid(major, partnerCall)
      return { call, rule: 'advance tvåfärg (preferens)', explanation: `3+ ${SYM[major]} → ${call[0]}${SYM[major]} (preferens till partnerns högfärg).` }
    }
    // Ingen högfärgsfit. Contested + svag → passa (partnern rättar sedan sin minor).
    if (contested && p < 8) return passContested
    // Ostört: aldrig passa → 3♣ pass-eller-rätta (partnern passar/rättar till sin minor).
    return { call: '3C', rule: 'advance tvåfärg (pass-eller-rätta minor)', explanation: `ingen högfärgsfit → 3♣ (pass-eller-rätta; partnern passar med ♣, rättar till ♦).` }
  }

  // Båda färgerna kända (Michaels över minor / ovanlig 2NT): bjud den vi är
  // längst i (lika längd → högre rankad = högfärgen).
  let best = known[0]
  for (const s of known) {
    if (len[s] > len[best] || (len[s] === len[best] && rankIdx(s) > rankIdx(best))) best = s
  }
  // Contested utan fit i någon av färgerna och svag → passa (spelrum finns).
  if (contested && known.every((s) => len[s] < 3) && p < 8) return passContested
  const call = cheapestBid(best, partnerCall)
  return { call, rule: 'advance tvåfärg (preferens)', explanation: `${SYM[best]} (den jag är längst i av partnerns färger) → ${call[0]}${SYM[best]} (preferens).` }
}

/**
 * Svar på partnerns enkla inkliv (advancer). §7.1. `overcallLevel` = nivån
 * partnerns inkliv låg på (styr hoppet i en fit-jump); default 1.
 *
 * F4 (D9): fit-trösklarna (fit-jump 10+, cue 11+) läser STÖDPOÄNG
 * `max(hp, dummyPoints)` — samma mått som live-lagrets `raiseWithFit`.
 * Ny färg och NT-svaren behåller rå HP (ingen fit etablerad resp. sang).
 */
export function advanceOvercall(hand: Hand, partnerSuit: Suit, theirSuit: Suit, overcallLevel = 1): ResponseResult {
  const p = hcp(hand)
  const sp = pointsWithFloor(hand, partnerSuit, 'support')
  const len = lengths(hand)
  const support = len[partnerSuit]
  const sym = SYM[partnerSuit]
  const bid = BID[partnerSuit]

  if (p < 6 && support < 3) return { call: 'P', rule: 'pass', explanation: `för svagt utan stöd → pass.` }

  // Fit-jump (§7.1, rad 714): bra stöd (4+) + egen 5+ sidofärg, inbjudande+ →
  // HOPP i sidofärgen (visar fit + trickkälla). Går före cue när en klar
  // sidofärg finns. Hoppnivån = billigaste läget för färgen + 1.
  if (support >= 4 && sp.points >= 10) {
    let side: Suit | null = null
    for (const s of RANK_ORDER) {
      if (s === partnerSuit || s === theirSuit || len[s] < 5) continue
      if (side === null || len[s] > len[side] || (len[s] === len[side] && rankIdx(s) > rankIdx(side))) side = s
    }
    if (side) {
      const cheapest = rankIdx(side) > rankIdx(partnerSuit) ? overcallLevel : overcallLevel + 1
      const jump = cheapest + 1
      return { call: `${jump}${BID[side]}`, rule: 'fit-jump', explanation: `10+ stödpoäng, 4+ stöd + 5+ ${SYM[side]} → ${jump}${SYM[side]} (fit-jump, inbjudande+).` }
    }
  }

  // Cue-bud i deras färg = limithöjning eller bättre (bra stöd, krav).
  if (support >= 3 && sp.points >= 11) {
    return { call: `2${BID[theirSuit]}`, rule: 'cue (limithöjning+)', explanation: `11+ stödpoäng, 3+ stöd → cue ${SYM[theirSuit]} (limithöjning+, krav).` }
  }

  // Höjning: stöd, konkurrens (inte inbjudan i sig).
  if (support >= 3) {
    const lvl = rankIdx(partnerSuit) > rankIdx(theirSuit) ? 2 : 3
    return { call: `${lvl}${bid}`, rule: 'höjning', explanation: `3+ stöd, under limithöjning → ${lvl}${sym} (konkurrenshöjning).` }
  }

  // Ny färg: naturlig, konstruktiv (ej krav).
  const ownSuit = bestOvercallSuit(len, partnerSuit)
  if (ownSuit && p >= 8 && rankIdx(ownSuit) > rankIdx(partnerSuit)) {
    return { call: `2${BID[ownSuit]}`, rule: 'ny färg', explanation: `8+ hp med 5+ ${SYM[ownSuit]} → 2${SYM[ownSuit]} (naturlig, ej krav).` }
  }

  // NT: stopp i deras färg, balanserad, lämplig styrka.
  if (isBalanced(hand) && hasStopper(hand, theirSuit) && p >= 8) {
    const call = p >= 11 ? '2NT' : '1NT'
    return { call, rule: 'NT-svar', explanation: `Balanserad ${call === '2NT' ? '(11+ hp)' : '(8–10 hp)'} med stopp i ${SYM[theirSuit]} → ${call}.` }
  }

  return { call: 'P', rule: 'pass', explanation: `inget lämpligt → pass.` }
}
