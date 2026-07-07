// Budmotorns första del: öppningsbudet. Härlett direkt ur systemboken §3
// (öppningsbud + minor-regeln). Funktionen är ren: hand in → bud + förklaring ut.

import type { Bid, Hand, Seat, Suit, Vulnerability } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { playingTricks, startingPoints } from './evaluation'

/** Är positionen `seat` sårbar i den här givens sårbarhet? */
export function isVulnerable(seat: Seat, vul: Vulnerability): boolean {
  if (vul === 'all') return true
  if (vul === 'none') return false
  if (vul === 'ns') return seat === 'N' || seat === 'S'
  return seat === 'E' || seat === 'W' // 'ew'
}

/** Spelstick snyggt: 8 → "8", 8.5 → "8½". */
function fmtTricks(t: number): string {
  const whole = Math.floor(t)
  return t - whole >= 0.5 ? `${whole}½` : `${whole}`
}

export interface OpeningResult {
  /** Budet, t.ex. "1S", "1NT", "2C", "P". */
  call: Bid
  /** Kort regelnamn (för statistik/hålfinnare). */
  rule: string
  /** Mening på svenska med hp + form. */
  explanation: string
  /** Sant när motorn är osäker (t.ex. möjligt distributionellt 2♣). */
  uncertain?: boolean
}

const BID: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }

/**
 * Räknar ut vad en hand öppnar med utan störning. `vulnerable` styr TP-nudgen
 * (Steg D: ej sårbar = aggressiv, startpoäng ≥ 15; sårbar = passiv, ≥ 16) och
 * lättöppningsgolvet i 3:e hand. `seatOrder` = position i varvet från given
 * (1–4); 3:e/4:e hand får öppna lätt (TP-steg F). Default 1:a hand
 * (bakåtkompatibelt).
 */
export function classifyOpening(hand: Hand, vulnerable = false, seatOrder: 1 | 2 | 3 | 4 = 1): OpeningResult {
  const p = hcp(hand)
  const tp = startingPoints(hand).startingPoints
  const len = lengths(hand)
  const bal = isBalanced(hand)

  // Balanserade händer: NT-stegen + stark 2♣.
  if (bal) {
    if (p >= 15 && p <= 17) return { call: '1NT', rule: '1NT', explanation: `Balanserad ${p} hp (15–17) → 1NT.` }
    if (p >= 20 && p <= 21) return { call: '2NT', rule: '2NT', explanation: `Balanserad ${p} hp (20–21) → 2NT.` }
    // Uppgradering "bra 19" (ägarbeslut 2026-07-06, felrapport #30): en jämn
    // 19-hand med hög kvalitet/kontroller (startpoäng ≥ 20 – många ess/kvalitets-
    // färger) spelar som 20–21 och öppnar 2NT i stället för att öppna 1 i färg och
    // riskera att bli passad billigt (t.ex. ♠AJ84 ♥AQJ9 ♦986 ♣AK, 3 ess + AK).
    // Kräver ingen 5-korts färg (då visar vi hellre färgen på 1-läget). Samma
    // regel-id '2NT' → svararen tolkar det som en vanlig 2NT-öppning.
    {
      const noFive = (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).every((s) => len[s] < 5)
      if (p === 19 && tp >= 20 && noFive) {
        return { call: '2NT', rule: '2NT', explanation: `Balanserad bra 19 (${p} hp / ${tp} startp.) → 2NT (uppvärderad, spelar som 20–21).` }
      }
    }
    if (p >= 25 && p <= 27) return { call: '3NT', rule: '3NT', explanation: `Balanserad ${p} hp (25–27) → 3NT.` }
    if (p >= 22) return { call: '2C', rule: 'stark 2♣', explanation: `Balanserad ${p} hp (22+) → 2♣ (konstgjord, krav).` }

    // TP-steg D (FAS 4, ägarbeslut 2026-07-01, steg b – sårbarhets-oberoende):
    // en "bra 14" (14 hp MEN startpoäng ≥ 15 – bra ess/tior/kvalitetsfärg som
    // motorn redan väger in) nudgas upp i 1NT-öppningszonen. Villkor:
    //  • Ingen 5-korts färg (dvs 4-3-3-3 / 4-4-3-2). En 5-korts MINOR öppnar
    //    minorn (bevarar partnerns 4-korts-major-svar på 1-läget); en 5-korts
    //    MAJOR öppnar 1M (visar majoren). Därför nudge bara utan 5-korts färg.
    //  • Samma regel-id '1NT' → svararen tolkar det som en vanlig 1NT-öppning.
    //  • Sårbarheten sätter tröskeln: ej sårbar = aggressiv (≥15), sårbar =
    //    passiv (≥16) – en formstark 14:a chansar hellre i zonfördel.
    const noFiveCardSuit = (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).every((s) => len[s] < 5)
    const nudgeFloor = vulnerable ? 16 : 15
    if (p === 14 && tp >= nudgeFloor && noFiveCardSuit) {
      const zon = vulnerable ? 'sårbar ≥16' : 'ej sårbar ≥15'
      return { call: '1NT', rule: '1NT', explanation: `Balanserad bra 14 (${p} hp / ${tp} startp., ${zon}) → 1NT (uppvärderad).` }
    }
    // 12–14 och 18–19 balanserade öppnar i färg → faller vidare nedan.
  }

  // Stark 2♣ (obalanserad 22+).
  if (p >= 22) return { call: '2C', rule: 'stark 2♣', explanation: `${p} hp (stark) → 2♣ (konstgjord, krav).` }

  // Distributionellt stark 2♣ (ägarens beslut 2026-07-01): en hand med många
  // SPELSTICK är nära utgång på egen hand och öppnar 2♣ även om HP < 22. Gräns
  // ~8½ spelstick. Balanserade NT-öppningar/22+ har redan returnerats ovan, så
  // det här fångar de starka fördelningshänderna (lång stark färg + sidohonnörer).
  const pt = playingTricks(hand)
  if (pt >= 8.5) {
    return {
      call: '2C',
      rule: 'stark 2♣',
      explanation: `${p} hp men ~${fmtTricks(pt)} spelstick (nära utgång på egen hand) → 2♣ (stark, krav).`,
    }
  }

  // Öppning på 1-läget. Två vägar in (ägarens beslut 2026-06-30):
  //  • 12+ HP öppnar ALLTID – en människa nedgraderar i princip aldrig en
  //    öppningshand, så TP får aldrig sänka en 12-hp-hand under tröskeln.
  //  • 11 HP med fördelning (Bergens grundregel: 12+ STARTPOÄNG/TP) öppnar också
  //    – ess/tior/längd lyfter en bra 11:a till öppning.
  // En platt 11-hp-hand (TP < 12) avstår fortfarande. NT-stegen ovan är hp-def.
  if (p >= 12 || tp >= 12) {
    const pts = tp > p ? `${p} hp / ${tp} TP` : `${p} hp`
    // Möjligt missat distributionellt 2♣ (stark obalanserad med lång färg) – flaggas.
    const uncertain = p >= 19 && !bal && Object.values(len).some((l) => l >= 6)
    // 6-5 (6-korts LÅGfärg + 5-korts HÖGfärg), ägarregel 2026-07-07 (felrapport
    // #32): med 16+ hp öppna LÅGfärgen (6-korten) så man kan reverse:a in högfärgen
    // och visa 6-5 med extra styrka; med minimum (12–15) öppna högfärgen (kan inte
    // reverse:a med minimum). Gäller bara HÖGfärg EXAKT 5 + en LÅGfärg 6+ (annars
    // faller det till den vanliga 5-korts-högfärg/minor-regeln nedan). Starka 6-5
    // med 8½+ spelstick har redan öppnat 2♣ ovan.
    const fiveMajor: Suit | null = len.spades === 5 ? 'spades' : len.hearts === 5 ? 'hearts' : null
    const sixMinor: Suit | null = len.diamonds >= 6 ? 'diamonds' : len.clubs >= 6 ? 'clubs' : null
    if (fiveMajor && sixMinor && p >= 16) {
      return {
        call: `1${BID[sixMinor]}`,
        rule: 'minor-regeln',
        explanation: `${pts} med 6-5 (6-korts ${NAME[sixMinor]} + 5-korts ${NAME[fiveMajor]}) → 1${BID[sixMinor]} (öppnar lågfärgen; 16+ räcker för att visa 6-5 via reverse).`,
        uncertain,
      }
    }
    if (len.spades >= 5 || len.hearts >= 5) {
      const suit: Suit = len.spades >= len.hearts ? 'spades' : 'hearts' // lika längd → spader (högre)
      return {
        call: `1${BID[suit]}`,
        rule: '5-korts högfärg',
        explanation: `${pts} med ${len[suit]}-korts ${NAME[suit]} → 1${BID[suit]}.`,
        uncertain,
      }
    }
    const m = openMinor(len)
    return {
      call: `1${BID[m]}`,
      rule: 'minor-regeln',
      explanation: `${pts}, ingen 5-korts högfärg → 1${BID[m]} (minor-regeln).`,
      uncertain,
    }
  }

  // TP-steg F (ägarbeslut 2026-07-03): lättöppning i 3:e hand. Partnern har
  // redan passat (begränsad hand, Drury §6.7 skyddar svaret) → öppna 1M lätt
  // med 10–11 hp (sårbar kräver 11) och en BRA 5+ högfärg: ≥2 topphonnörer
  // A/K/Q (samma kvalitetsmått som Regel 2-3-4) – utspelsdirigerande och
  // störande. ALDRIG lätt i minor, aldrig lätt 1NT (standard, bridgebum).
  // Faller handen igenom grinden → spärr/svag tvåa gäller som vanligt.
  if (seatOrder === 3 && p >= (vulnerable ? 11 : 10)) {
    let light: Suit | null = null
    for (const s of ['spades', 'hearts'] as Suit[]) {
      if (len[s] >= 5 && topHonorCount(hand, s) >= 2 && (light === null || len[s] > len[light])) light = s
    }
    if (light) {
      return {
        call: `1${BID[light]}`,
        rule: 'lättöppning',
        explanation: `${p} hp men bra ${len[light]}-korts ${NAME[light]} (${topHonorCount(hand, light)} topphonnörer) i 3:e hand → 1${BID[light]} (lättöppning, partnern har passat).`,
      }
    }
  }

  // TP-steg F: 4:e hand – regeln om 15 (Pearson). Alla har passat, så öppnar vi
  // inte passas given ut. Marginalhänder (9–11 hp): hp + antal SPADER ≥ 15 →
  // öppna (spadrarna avgör vem som äger delkontraktskampen), annars passa ut.
  // Ingen spärr/svag tvåa i 4:e hand under golvet – ingen kvar att spärra mot.
  if (seatOrder === 4) {
    const pearson = p + len.spades
    if (p >= 9 && pearson >= 15) {
      if (len.spades >= 5 || len.hearts >= 5) {
        const suit: Suit = len.spades >= len.hearts ? 'spades' : 'hearts'
        return { call: `1${BID[suit]}`, rule: 'regeln om 15', explanation: `${p} hp + ${len.spades} spader = ${pearson} (≥15, regeln om 15 i 4:e hand) → 1${BID[suit]}.` }
      }
      const m = openMinor(len)
      return { call: `1${BID[m]}`, rule: 'regeln om 15', explanation: `${p} hp + ${len.spades} spader = ${pearson} (≥15, regeln om 15 i 4:e hand) → 1${BID[m]} (minor-regeln).` }
    }
    return { call: 'P', rule: 'pass', explanation: `${p} hp + ${len.spades} spader = ${pearson} (<15, regeln om 15 i 4:e hand) → pass (given passas ut).` }
  }

  // Spärröppning (7+ korts färg, svag) – kollas före svag tvåa.
  // Regel 2-3-4 (ägarbeslut 2026-07-01): kvalitetsgrind på topphonnörer (A/K/Q) i
  // den långa färgen, modulerad av sårbarhet – sårbar kräver mer disciplin.
  //   3-läget (7-korts): ej sårbar ≥ 1 topphonnör, sårbar ≥ 2.
  //   4-läget (8-korts): ej sårbar valfri, sårbar ≥ 1.
  // En 12 HP-hand har redan öppnat (låst regel); detta rör bara svaga spärrhänder.
  // Faller handen igenom grinden → ingen spärr (pass, om ingen svag tvåa gäller).
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
    if (len[suit] >= 7) {
      const level = len[suit] >= 8 ? 4 : 3
      const tops = topHonorCount(hand, suit)
      const need = level >= 4 ? (vulnerable ? 1 : 0) : vulnerable ? 2 : 1
      if (tops < need) break // för dålig färg för sårbarheten → ingen spärr
      const zon = vulnerable ? 'sårbar' : 'ej sårbar'
      return {
        call: `${level}${BID[suit]}`,
        rule: 'spärr',
        explanation: `${p} hp med ${len[suit]}-korts ${NAME[suit]} (${tops} topphonnör, ${zon}) → ${level}${BID[suit]} (spärröppning).`,
      }
    }
  }

  // Svag tvåöppning (6-korts ♦/♥/♠, 6–11 hp). Ingen svag 2♣.
  if (p >= 6 && p <= 11) {
    for (const suit of ['spades', 'hearts', 'diamonds'] as Suit[]) {
      if (len[suit] === 6) {
        return {
          call: `2${BID[suit]}`,
          rule: 'svag tvåa',
          explanation: `${p} hp med 6-korts ${NAME[suit]} → 2${BID[suit]} (svag tvåöppning).`,
        }
      }
    }
  }

  // Annars pass.
  return { call: 'P', rule: 'pass', explanation: `${p} hp, ingen öppning → pass.` }
}

/** Antal topphonnörer (A/K/Q) i en färg – grund för Regel 2-3-4-grinden. */
function topHonorCount(hand: Hand, suit: Suit): number {
  const ranks = hand.filter((c) => c.suit === suit).map((c) => c.rank)
  return (['A', 'K', 'Q'] as const).filter((r) => ranks.includes(r)).length
}

/** Minor-regeln: längsta minorn; vid lika 4-4/5-5 → ruter, 3-3 → klöver. */
function openMinor(len: Record<Suit, number>): Suit {
  if (len.diamonds > len.clubs) return 'diamonds'
  if (len.clubs > len.diamonds) return 'clubs'
  return len.diamonds >= 4 ? 'diamonds' : 'clubs'
}
