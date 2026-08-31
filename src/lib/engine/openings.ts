// Budmotorns första del: öppningsbudet. Härlett direkt ur systemboken §3
// (öppningsbud + minor-regeln). Funktionen är ren: hand in → bud + förklaring ut.

import type { Bid, Hand, Seat, Suit, Vulnerability } from '../../types/bridge'
import { hcp, isBalanced, lengths } from './hand'
import { playingTricks, quickTricks, startingPoints } from './evaluation'

/** Är positionen `seat` sårbar i den här givens sårbarhet? */
export function isVulnerable(seat: Seat, vul: Vulnerability): boolean {
  if (vul === 'all') return true
  if (vul === 'none') return false
  if (vul === 'ns') return seat === 'N' || seat === 'S'
  return seat === 'E' || seat === 'W' // 'ew'
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
// Färgsymbol för FÖRKLARINGSTEXTEN (det budet motorn läser står kvar som BID-kod).
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }

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
    if (p >= 15 && p <= 17) return { call: '1NT', rule: '1NT', explanation: `Balanserad (15–17 hp) → 1NT.` }
    if (p >= 20 && p <= 21) return { call: '2NT', rule: '2NT', explanation: `Balanserad (20–21 hp) → 2NT.` }
    // Uppgradering "bra 19" (ägarbeslut 2026-07-06, felrapport #30): en jämn
    // 19-hand med hög kvalitet/kontroller (startpoäng ≥ 20 – många ess/kvalitets-
    // färger) spelar som 20–21 och öppnar 2NT i stället för att öppna 1 i färg och
    // riskera att bli passad billigt (t.ex. ♠AJ84 ♥AQJ9 ♦986 ♣AK, 3 ess + AK).
    // Kräver ingen 5-korts färg (då visar vi hellre färgen på 1-läget). Samma
    // regel-id '2NT' → svararen tolkar det som en vanlig 2NT-öppning.
    {
      const noFive = (['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).every((s) => len[s] < 5)
      if (p === 19 && tp >= 20 && noFive) {
        return { call: '2NT', rule: '2NT', explanation: `Balanserad med extra kvalitet (ess och starka färger) → 2NT (spelar som 20–21).` }
      }
    }
    if (p >= 25 && p <= 27) return { call: '3NT', rule: '3NT', explanation: `Balanserad (25–27 hp) → 3NT.` }
    if (p >= 22) return { call: '2C', rule: 'stark 2♣', explanation: `Balanserad (22+ hp) → 2♣ (konstgjort kravbud).` }

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
      return { call: '1NT', rule: '1NT', explanation: `Balanserad med extra kvalitet (ess och tior) → 1NT (spelar som 15–17).` }
    }
    // 12–14 och 18–19 balanserade öppnar i färg → faller vidare nedan.
  }

  // Stark 2♣ (obalanserad 22+).
  if (p >= 22) return { call: '2C', rule: 'stark 2♣', explanation: `22+ hp, för stark för en 1-öppning → 2♣ (konstgjort kravbud).` }

  // Distributionellt stark 2♣ — substanskraven (ägarbeslut 2026-08-31 "Regel B",
  // ersätter den platta 8½-gränsen från 2026-07-01; källor: K. Walker/bridgebum/
  // Lawrence, mätning tvaklover-oversyn.probe.test.ts). Två vägar in:
  //  A) Färgmodulerade spelstick — ≥9 om längsta färgen är HÖG, ≥9½ LÅG (en
  //     lågfärgshand är längre från sin utgång och söker hellre 3NT via
  //     1-läget) — OCH ≥3 spelfasta stick (försvarsstyrka: annars är det en
  //     spärrhand som låtsas vara stark).
  //  B) Valven: ≥8½ spelstick OCH ≥4 spelfasta stick — räddar honnörs-/ess-
  //     tunga händer som faller på ren stickräkning (t.ex. tre-ess-händer).
  // Balanserade NT-öppningar/22+ har redan returnerats ovan.
  const pt = playingTricks(hand)
  const qt = quickTricks(hand)
  // Längsta färgen (vid lika längd: högfärg — lägre stickgolv, konservativt).
  const longest = (['hearts', 'spades', 'diamonds', 'clubs'] as Suit[]).reduce((a, b) =>
    len[b] > len[a] ? b : a,
  )
  const majorLong = longest === 'hearts' || longest === 'spades'
  const trickFloor = majorLong ? 9 : 9.5
  if ((pt >= trickFloor && qt >= 3) || (pt >= 8.5 && qt >= 4)) {
    return {
      call: '2C',
      rule: 'stark 2♣',
      explanation:
        `Minst ${majorLong ? '9' : '9½'} spelstick med spelfasta toppkort (ess och kungar) — ` +
        `nära utgång på egen hand → 2♣ (starkt kravbud).`,
    }
  }

  // Öppning på 1-läget. Två vägar in (ägarens beslut 2026-06-30):
  //  • 12+ HP öppnar ALLTID – en människa nedgraderar i princip aldrig en
  //    öppningshand, så TP får aldrig sänka en 12-hp-hand under tröskeln.
  //  • 11 HP med fördelning (Bergens grundregel: 12+ STARTPOÄNG/TP) öppnar också
  //    – ess/tior/längd lyfter en bra 11:a till öppning.
  // En platt 11-hp-hand (TP < 12) avstår fortfarande. NT-stegen ovan är hp-def.
  if (p >= 12 || tp >= 12) {
    // Vad ett 1-lägesöppningsbud LOVAR (öppningsstyrka), inte den här handens
    // faktiska poäng: en bra 11:a med fördelning eller 12+ hp, öppet uppåt.
    const pts = `12+ hp`
    // Möjligt missat distributionellt 2♣ (stark obalanserad med lång färg) – flaggas.
    const uncertain = p >= 19 && !bal && Object.values(len).some((l) => l >= 6)
    // 6-5 (6-korts LÅGfärg + 5-korts HÖGfärg), ägarregel 2026-07-07 (felrapport
    // #32): med 16+ hp öppna LÅGfärgen (6-korten) så man kan reverse:a in högfärgen
    // och visa 6-5 med extra styrka; med minimum (12–15) öppna högfärgen (kan inte
    // reverse:a med minimum). Gäller bara HÖGfärg EXAKT 5 + en LÅGfärg 6+ (annars
    // faller det till den vanliga 5-korts-högfärg/minor-regeln nedan). Starka 6-5
    // som klarar 2♣-substanskraven (spelstick + spelfasta stick) har redan
    // öppnat 2♣ ovan.
    const fiveMajor: Suit | null = len.spades === 5 ? 'spades' : len.hearts === 5 ? 'hearts' : null
    const sixMinor: Suit | null = len.diamonds >= 6 ? 'diamonds' : len.clubs >= 6 ? 'clubs' : null
    if (fiveMajor && sixMinor && p >= 16) {
      // 1♦/1♣ lovar bara 12+ och lågfärgen (minor-regeln) — INTE 6-5. Den formen
      // är en privat plan som växer fram varv för varv (och budet om lågfärgen
      // lovar sedan bara 5 kort). Texten får därför inte avslöja 6-5:an.
      return {
        call: `1${BID[sixMinor]}`,
        rule: 'minor-regeln',
        explanation: `${pts} → 1${SYM[sixMinor]} (öppnar lågfärgen).`,
        uncertain,
      }
    }
    if (len.spades >= 5 || len.hearts >= 5) {
      const suit: Suit = len.spades >= len.hearts ? 'spades' : 'hearts' // lika längd → spader (högre)
      return {
        call: `1${BID[suit]}`,
        rule: '5-korts högfärg',
        explanation: `${pts} med 5+ ${SYM[suit]} → 1${SYM[suit]}.`,
        uncertain,
      }
    }
    const m = openMinor(len)
    return {
      call: `1${BID[m]}`,
      rule: 'minor-regeln',
      explanation: `${pts}, ingen 5+ högfärg → 1${SYM[m]} (bästa lågfärg).`,
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
        explanation: `10+ hp, 5+ ${SYM[light]} i tredje hand → 1${SYM[light]} (lätt öppning sedan partnern passat).`,
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
        return { call: `1${BID[suit]}`, rule: 'regeln om 15', explanation: `Regeln om 15 i fjärde hand (hp + spaderlängd ≥ 15) → 1${SYM[suit]}.` }
      }
      const m = openMinor(len)
      return { call: `1${BID[m]}`, rule: 'regeln om 15', explanation: `Regeln om 15 i fjärde hand (hp + spaderlängd ≥ 15) → 1${SYM[m]} (bästa lågfärg).` }
    }
    return { call: 'P', rule: 'pass', explanation: `Under regeln om 15 i fjärde hand (hp + spaderlängd < 15) → pass.` }
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
      // Längd-LÖFTET per nivå (standard): 3-läget = 7 (åtta blir 4-läget),
      // 4-läget = 8+. Honnörsräkningen skrivs INTE ut (avslöjar vårt innehav).
      const lenPromise = level >= 4 ? '8+' : '7'
      return {
        call: `${level}${BID[suit]}`,
        rule: 'spärr',
        explanation: `Svag hand med ${lenPromise} ${SYM[suit]} → ${level}${SYM[suit]} (spärröppning).`,
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
          explanation: `6–11 hp med 6 ${SYM[suit]} → 2${SYM[suit]} (svag tvåöppning).`,
        }
      }
    }
  }

  // Annars pass.
  return { call: 'P', rule: 'pass', explanation: `Under öppningsstyrka → pass.` }
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
