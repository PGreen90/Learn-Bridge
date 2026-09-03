// Budmotorns andra del: svararens första bud efter att partnern öppnat 1♥/1♠.
// Härlett ur systemboken §4.1. Prioriteringsordningen är det viktiga: vi testar
// fit-svaren först (splinter → Jacoby → Bergen), sedan färgsvar och NT.

import type { Bid, Forcing, Hand, Suit } from '../../types/bridge'
import { classifyFit, pointsWithFloor } from './evaluation'
import { hcp, isBalanced, lengths } from './hand'

export type Major = 'hearts' | 'spades'
export type Minor = 'clubs' | 'diamonds'

export interface ResponseResult {
  /**
   * `rule` är budets STABILA identitet (kort regelnamn, t.ex. "Jacoby 2NT").
   * Skild från den användarvända `explanation`. Regelregistret (`rules.ts`)
   * nycklas på den och härleder kravnivå (`forcing`) + alert ur SAMMA regel –
   * målet med FAS 1.
   */
  call: Bid
  rule: string
  explanation: string
  uncertain?: boolean
  /** Budets kravnivå (§2). Frivilligt tills regelregistret fyllt i det. */
  forcing?: Forcing
}

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
// Färgsymbol för FÖRKLARINGSTEXTEN (budet motorn läser står kvar som BID-kod).
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

function otherMajor(m: Major): Major {
  return m === 'hearts' ? 'spades' : 'hearts'
}

const ALL_SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/**
 * Har svararen en "riktigt svag" sidofärg (≤3 kort utan A/Kx/Qxx-stopp) vid
 * sidan av fitfärgen? Då är en direkt 3NT en gissning på att partnern håller
 * färgen – vi utforskar hellre via inverterad 2m och kan landa i 5m om paret
 * inte kan hålla alla färger. Ägarregel 2026-07-05: gå den inverterade vägen
 * bara med en svag färg (annars 3NT som förr).
 */
/**
 * Splintervärdiga kortfärger vid sidan av trumfen: renons alltid; singel bara
 * om kortet INTE är A eller K (ägarregel 2026-08-06, källa bridgebum: en
 * singel-A/K drar ett stick, så splinterns budskap "devalvera dina honnörer
 * här, räkna ruffvärden" blir falskt — handen beskrivs via Jacoby 2NT i
 * stället). Singel-DAM räknas som splintervärdig (drar sällan ett stick själv).
 * Delas av splinterbeslutet (respondToMajor) och kortfärgsvisningen efter
 * relät (responder-rebids.ts) så de aldrig pekar ut olika färger.
 */
export function splinterShortSuits(hand: Hand, trump: Suit): Suit[] {
  const len = lengths(hand)
  return ALL_SUITS.filter((s) => {
    if (s === trump) return false
    if (len[s] === 0) return true
    if (len[s] !== 1) return false
    const rank = hand.find((c) => c.suit === s)!.rank
    return rank !== 'A' && rank !== 'K'
  })
}

function hasWeakSideSuit(hand: Hand, fit: Suit): boolean {
  return ALL_SUITS.some((s) => {
    if (s === fit) return false
    const cs = hand.filter((c) => c.suit === s)
    if (cs.length > 3) return false
    const has = (r: string) => cs.some((c) => c.rank === r)
    const stops = has('A') || (has('K') && cs.length >= 2) || (has('Q') && cs.length >= 3)
    return !stops
  })
}

/** Vad svarar man på partnerns 1♥/1♠ (ostörd, ohöjd hand)? */
export function respondToMajor(hand: Hand, opened: Major): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  // Gemensam fitklassificering (FAS 3 punkt 11) styr fit-grenarna. `hasFourPlus`
  // är Bergen-/Jacoby-grinden: de får STRUKTURELLT aldrig fyras med bara 3 stöd.
  const fit = classifyFit(hand, opened)
  const support = fit.trumps
  const other = otherMajor(opened)
  const shortness = splinterShortSuits(hand, opened).length > 0
  const M = BID[opened]
  const MSYM = opened === 'hearts' ? '♥' : '♠'

  // STÖDPOÄNG (TP-steg B, ägarens beslut 2026-06-30): vid fit räknar svararen
  // stödpoäng (Bergen: singel +3 m. 4 trumf, dubbel +1 …) i stället för rå hp –
  // MEN aldrig under hp (en hand nedgraderas aldrig av sin form). Korthet/längd
  // får alltså LYFTA en höjning över inbjudan→utgång-gränsen (t.ex. 11 hp + singel
  // + 4 trumf → splinter), men en platt övervärderad hand stannar på hp-golvet.
  const { points: sp } = pointsWithFloor(hand, opened, 'support')

  if (p < 6) return { call: 'P', rule: 'pass', explanation: `För svagt för att svara → pass.` }

  // ---- Fit: 4+ stöd (stödpoäng styr nivån). Bergen/Jacoby/splinter bor HÄR –
  //      grinden `fit.hasFourPlus` garanterar att de aldrig når 3-stödshänder. ----
  if (fit.hasFourPlus) {
    if (sp >= 12 && shortness) {
      const call = opened === 'hearts' ? '3S' : '3H'
      const sym = opened === 'hearts' ? '3♠' : '3♥'
      return { call, rule: 'tvetydig splinter', explanation: `4+ stöd + kortfärg → ${sym} (tvetydig splinter, utgångskrav).` }
    }
    if (sp >= 13) {
      return { call: '2NT', rule: 'Jacoby 2NT', explanation: `4+ stöd, ingen splintervärdig kortfärg → 2NT (Jacoby, utgångskrav).` }
    }
    if (support === 4) {
      if (sp >= 10) return { call: '3D', rule: 'Bergen limit', explanation: `4 stöd (limithöjning) → 3♦ (Bergen).` }
      if (sp >= 7) return { call: '3C', rule: 'Bergen konstruktiv', explanation: `4 stöd (konstruktiv, 7–10) → 3♣ (Bergen).` }
      return { call: `3${M}`, rule: 'Bergen spärr', explanation: `4 stöd (svag) → 3${MSYM} (Bergen, spärrhöjning).` }
    }
    // 5+ stöd, ej GF
    if (sp <= 9) return { call: `4${M}`, rule: 'spärr till utgång', explanation: `5+ stöd (svag) – spärr → 4${MSYM}.` }
    return { call: '3D', rule: 'Bergen limit', explanation: `5+ stöd → 3♦ (limithöjning).`, uncertain: true }
  }

  // ---- 3-korts stöd (stödpoäng styr; korthet lyfter mot limithöjning) ----
  if (support === 3) {
    if (sp <= 9) return { call: `2${M}`, rule: 'enkel höjning', explanation: `3 stöd (6–9) → 2${MSYM} (enkel höjning).` }
    if (sp <= 12) return { call: '1NT', rule: 'semi-forcing 1NT', explanation: `3-korts limithöjning (10–12) → 1NT (semi-forcing), höjer sedan.` }
    // 13+ stödpoäng med 3 stöd → faller vidare till 2/1.
  }

  // ---- Ny färg på 1-läget: bara spader över 1♥ ----
  // Ägarbeslut 2026-07-06 (felrapport #31): INGET svagt hoppskift till 2♠.
  // När partnern har öppnat håller svararen budgivningen LÅG och bjuder den nya
  // färgen billigast (rondkrav) → partnern får utrymme att beskriva sin hand
  // (ett hopp berövar t.ex. 1NT). En svag 6-korts spader svarar alltså 1♠, inte 2♠.
  if (opened === 'hearts') {
    if (len.spades >= 4) return { call: '1S', rule: 'ny färg (1-läget)', explanation: `4+ ♠ → 1♠ (krav 1 rond).` }
  }

  // ---- 2-över-1 GF med en 5+ färg ----
  if (p >= 12) {
    const s5 = bestSuit(len, opened, 5)
    if (s5) return { call: `2${BID[s5]}`, rule: '2-över-1 GF', explanation: `12+ hp med 5+ ${SYM[s5]} → 2${SYM[s5]} (2-över-1, utgångskrav).` }
  }

  // ---- 3NT: 13–15 balanserad, exakt 2 i öppningsfärgen, ingen 4-korts annan högfärg ----
  if (isBalanced(hand) && p >= 13 && p <= 15 && support <= 2 && len[other] < 4) {
    return { call: '3NT', rule: '3NT till spel', explanation: `Balanserad (13–15) utan fit → 3NT (till spel).` }
  }

  // ---- 2-över-1 med en 4-korts färg (tunnare – flaggas) ----
  if (p >= 12) {
    const s4 = bestSuit(len, opened, 4)
    if (s4) return { call: `2${BID[s4]}`, rule: '2-över-1 GF', explanation: `12+ hp med 4+ ${SYM[s4]} → 2${SYM[s4]} (2-över-1, utgångskrav).`, uncertain: true }
  }

  // ---- Semi-forcing 1NT (6–11, inget bättre) ----
  if (p <= 11) return { call: '1NT', rule: 'semi-forcing 1NT', explanation: `6–11 hp utan fit eller 2/1 → 1NT (semi-forcing).` }

  // ---- Kvar: 12+ utan tydlig fortsättning → flaggas ----
  return { call: '1NT', rule: 'oklart', explanation: `Motorn hittar inget tydligt svar (förenkling).`, uncertain: true }
}

/** Vad svarar man på partnerns 1♣/1♦ (ostörd, ohöjd hand)? Systembok §4.2. */
export function respondToMinor(hand: Hand, opened: Minor): ResponseResult {
  const p = hcp(hand)
  const len = lengths(hand)
  const support = len[opened]
  const bal = isBalanced(hand)
  // TP-steg C-2 (FAS 4): minorfit siktar oftast 3NT, där en singel är en NACKDEL
  // (ingen stopp). Därför lyfter minorhöjningar på LÄNGD + SIDOFÄRG men ALDRIG på
  // korthet: måttet är `bergenPoints{notrump}` (extra trumf + sidofärger, ingen
  // kortfärg), golvat vid HP så en hand aldrig nedgraderas. Balanserade sang-
  // placeringar (3NT/2NT) står kvar på rå HP – de är stopp-/HP-styrda.
  const mp = pointsWithFloor(hand, opened, 'bergen', { notrump: true }).points
  const m = BID[opened]
  const msym = opened === 'clubs' ? '♣' : '♦'
  const otherMinor: Minor = opened === 'clubs' ? 'diamonds' : 'clubs'
  const oBID = BID[otherMinor]
  const osym = otherMinor === 'clubs' ? '♣' : '♦'

  // ---- Svag spärrhöjning (inverterad minor, svag): 5+ stöd, 0–6 hp ----
  if (support >= 5 && p <= 6) {
    return { call: `3${m}`, rule: 'inverterad minor, svag', explanation: `0–6 hp, 5+ stöd → 3${msym} (svag spärrhöjning).` }
  }

  if (p < 6) return { call: 'P', rule: 'pass', explanation: `För svagt för att svara → pass.` }

  // ---- Svagt hoppskift AVSKAFFAT (ägarbeslut 2026-07-06, felrapport #31) ----
  // Tidigare hoppade svararen till 2♥/2♠ med en svag 6-korts högfärg. Men när
  // partnern har öppnat håller vi budgivningen LÅG: bjud den nya färgen billigast
  // på 1-läget (rondkrav) så partnern får utrymme att beskriva sin hand vidare –
  // ett hopp berövar t.ex. 1NT. En svag 6-korts högfärg faller därför direkt ned
  // till 1-lägessvaret nedan (1♥/1♠).

  // ---- 2-över-1 GF FÖRE 4-korts högfärg (ägarbeslut 2026-08-06, giv 20261274) ----
  // Grundpelaren i 2/1 = kortaste vägen till game force. Med UTGÅNGSKRAVSHAND
  // (12+) och 5+ i den ANDRA minorn sätts GF direkt med 2/1-minorn (2♣/2♦) i
  // stället för att först bjuda en 4-korts högfärg på 1-läget (bara rondkrav).
  // Villkoret `maxMajor === 4` gör att en 5-korts högfärg fortfarande går på
  // 1-läget, och att hela grenen bara rör just "4-korts högfärg mot längre minor"
  // (händer utan 4-korts högfärg når 2/1-minorn längre ned som förr). En senare
  // 4-4-högfärgsfit är fortfarande nåbar via partnerns återbud.
  {
    // GÄLLER BARA ÖVER 1♦: klövern kan bara visas på 2-läget (2♣), så valet står
    // mellan 4-korts högfärg (1-läget) och 5-korts klöver (2-läget) — och med 12+
    // väljer man 5-kortsfärgen (källa: standard 2/1, se §9). Över 1♣ visas den
    // längre RUTERN billigt på 1-läget (1♦), så regeln gäller inte där.
    const maxMajor = Math.max(len.hearts, len.spades)
    if (opened === 'diamonds' && p >= 12 && len[otherMinor] >= 5 && maxMajor === 4) {
      return {
        call: `2${oBID}`,
        rule: '2-över-1 GF',
        explanation: `12+ hp, 5+ ${SYM[otherMinor]} → 2${osym} (2-över-1, sätter utgångskrav direkt före 4-korts högfärgen).`,
      }
    }
  }

  // ---- 4-korts högfärg på 1-läget (längst först, lika → hjärter billigast), 6+ hp ----
  {
    const major = pickMajorToBid(len)
    if (major) {
      const sym = major === 'spades' ? '♠' : '♥'
      return { call: `1${BID[major]}`, rule: 'ny färg (1-läget)', explanation: `4+ ${SYM[major]} → 1${sym} (högfärg upp, krav 1 rond).` }
    }
  }

  // Härefter: ingen biudbar 4-korts högfärg.

  // ---- 2-över-1 GF FÖRE inverterad höjning (ägarbeslut 2026-09-03, felrapport #58) ----
  // "Att sätta game force är viktigare än att kommunicera träff i färg — har vi
  // ett utgångskrav hinner vi visa färger senare." Med 12+ hp och 5+ i den ANDRA
  // lågfärgen sätts utgångskravet direkt med 2/1 (stödet visas i nästa rond).
  // Den inverterade höjningen (bara rondkrav) behåller 10–11-händerna och
  // utgångshänder utan egen 5-kortsfärg. Samma princip som 2026-08-06 (2/1
  // före 4-korts högfärg): kortaste vägen till game force. Ligger även före
  // den direkta 3NT:n — en hand med egen 5-kortsfärg beskrivs, gissar inte.
  if (len[otherMinor] >= 5 && p >= 12) {
    return {
      call: `2${oBID}`,
      rule: '2-över-1 GF',
      explanation: `12+ hp med 5+ ${SYM[otherMinor]} → 2${osym} (2-över-1, utgångskrav; stöd visas i nästa rond).`,
    }
  }

  // ---- Stark inverterad höjning: 4+ stöd, 10+ TP (längd/sidofärg lyfter) ----
  if (support >= 4 && mp >= 10) {
    // Balanserad utgångshand → 3NT direkt BARA om vi själva kan hålla alla
    // sidofärger. Har vi en riktigt svag färg utforskar vi via inverterad 2m i
    // stället (kan landa i 5m när 3NT inte är säkert). Ägarregel 2026-07-05.
    if (bal && p >= 13 && p <= 15 && !hasWeakSideSuit(hand, opened)) {
      return { call: '3NT', rule: '3NT till spel', explanation: `Balanserad (13–15), alla färger hållna → 3NT (till spel).` }
    }
    return { call: `2${m}`, rule: 'inverterad minor', explanation: `4+ stöd, ingen högfärg → 2${msym} (inverterad minor, krav).` }
  }

  // ---- 3NT till spel: 13–15 balanserad, ingen högfärg ----
  if (bal && p >= 13 && p <= 15) {
    return { call: '3NT', rule: '3NT till spel', explanation: `Balanserad (13–15) utan högfärg → 3NT (till spel).` }
  }

  // ---- 2NT inbjudan: 11–12 balanserad, stopp, ingen högfärg ----
  if (bal && p >= 11 && p <= 12) {
    return { call: '2NT', rule: '2NT inbjudan', explanation: `Balanserad (11–12), ingen högfärg → 2NT (inbjudan).` }
  }

  // ---- Gap-handen: 7–9 TP med stöd men utan högfärg (för svagt för inverterad) → 1NT ----
  if (support >= 4 && mp >= 7 && mp <= 9) {
    return { call: '1NT', rule: 'gap-hand 1NT', explanation: `Stöd men utan högfärg (för svagt för inverterad) → 1NT.` }
  }

  // ---- 1NT naturlig: 6–10 hp, ingen högfärg ----
  if (p <= 10) {
    return { call: '1NT', rule: '1NT', explanation: `6–10 hp utan högfärg → 1NT (naturligt, ej krav).` }
  }

  // ---- Kvar: 11+ utan tydlig fortsättning → flaggas ----
  return { call: '1NT', rule: 'oklart', explanation: `Motorn hittar inget tydligt svar (förenkling).`, uncertain: true }
}

/** Vilken 4-korts högfärg bjuds på 1-läget: längst först, lika längd → hjärter (billigast). */
function pickMajorToBid(len: Record<Suit, number>): Major | null {
  const h = len.hearts >= 4
  const s = len.spades >= 4
  if (h && s) return len.spades > len.hearts ? 'spades' : 'hearts'
  if (h) return 'hearts'
  if (s) return 'spades'
  return null
}

/** Längsta biudbara 2/1-färgen (under öppningsfärgen) med minst `min` kort. */
function bestSuit(len: Record<Suit, number>, opened: Major, min: number): Suit | null {
  const candidates: Suit[] = opened === 'spades' ? ['hearts', 'diamonds', 'clubs'] : ['diamonds', 'clubs']
  let best: Suit | null = null
  for (const s of candidates) {
    if (len[s] >= min && (best === null || len[s] > len[best])) best = s
  }
  return best
}
