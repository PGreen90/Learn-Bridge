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
// Cue-ronden (§6.2) är BORTTAGEN ur motorns slamutredning (ägarbeslut: ingen
// kontrollkoll — lita på poängen). Ronden bar bara den avskaffade tjuvkiks-
// gaten (`pairControlsSideSuits`) och orsakade den gamla hängande-cue-quirken.
// §6.2 finns kvar i boken som konvention (tolkningen förstår manuella cue-bud).

import type { Hand, Suit } from '../../types/bridge'
import { bergenPoints, dummyPoints, wastedHonorsOppositeShortness } from './evaluation'
import { hcp, lengths } from './hand'
import {
  exclusionKeycards,
  hasTrumpQueen,
  keycards,
  respondToExclusion,
  respondToKingAsk,
  respondToRKC,
} from './slam'

const LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' }
const SYM: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const NAME: Record<Suit, string> = { clubs: 'klöver', diamonds: 'ruter', hearts: 'hjärter', spades: 'spader' }
const RANK_ORDER: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/** Budets rang i stegen (1♣=0 … 7NT=34) så vi kan jämföra om ett bud är lagligt (högre). */
const STRAIN_ORDER = ['C', 'D', 'H', 'S', 'NT']
function bidRank(call: string): number {
  const m = call.match(/^([1-7])(C|D|H|S|NT)$/)
  if (!m) return -1 // Pass/X/XX – ingen nivå
  return (parseInt(m[1], 10) - 1) * 5 + STRAIN_ORDER.indexOf(m[2])
}

/** Ett extra steg i slamutredningen, med roll i stället för plats (sätts i buildAuction). */
export interface SlamTurn {
  role: 'öppnare' | 'svarare'
  call: string
  rule: string
  explanation: string
}

/** Vad kaptenen VET om partnern ur auktionen (aldrig partnerns kort). */
export interface SlamContext {
  /** Undre gränsen i partnerns visade intervall (t.ex. 12 för 1NT-återbudet, 16 för hopphöjning). */
  partnerMin: number
  /** Inbjudningsbudet i kanske-zonen (t.ex. '5H' eller '4C'). Utelämnas = ingen inbjudan möjlig i läget. */
  inviteCall?: string | null
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
  // Kaptenens EGEN värdering: stödpoäng golvade vid hp (ägarens TP-princip:
  // form får LYFTA men aldrig sänka under hp). Har partnern VISAT en kortfärg
  // (Jacoby-kortfärgsrebud) nedvärderas egna K/D där — det är ärlig information
  // (kortheten är bjuden), FAS 4 punkt 18.
  const wasted = partnerShortSuit ? wastedHonorsOppositeShortness(responderHand, partnerShortSuit) : 0
  const captain = Math.max(hcp(responderHand), dummyPoints(responderHand, trump).dummyPoints) - wasted
  const floor = captain + ctx.partnerMin
  const lastRank = lastCall ? bidRank(lastCall) : -1

  if (floor >= 33 && bidRank('4NT') > lastRank) {
    return driveRKC(openerHand, responderHand, trump, ctx, floor)
  }
  if (floor >= 31 && ctx.inviteCall && bidRank(ctx.inviteCall) > lastRank) {
    return inviteSlam(openerHand, trump, ctx, floor)
  }
  return null
}

/** Driv-vägen: 4NT RKC → ärligt svar → kaptenen placerar på svaret + egen hand. */
function driveRKC(
  openerHand: Hand,
  responderHand: Hand,
  trump: Suit,
  ctx: SlamContext,
  floor: number,
): SlamTurn[] {
  const turns: SlamTurn[] = []
  turns.push({
    role: 'svarare',
    call: '4NT',
    rule: '1430 RKC',
    explanation: `minst ~${floor} poäng ihop mot partnerns visade ${ctx.partnerMin}+ → 4NT (frågar nyckelkort).`,
  })

  const answer = respondToRKC(openerHand, trump)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  const own = keycards(responderHand, trump)
  const derived = partnerKeycardsFromAnswer(answer.call, own, ctx.partnerMin)
  const total = own + derived.assumed
  // Trumfdamen: egen hand eller 5♠-svaret (2/5 MED dam). Aldrig partnerns kort.
  const queenKnown = hasTrumpQueen(responderHand, trump) || answer.call === '5S'
  const signOff = `5${LETTER[trump]}`

  if (total >= 4) {
    // Storslam kräver visshet: entydigt alla fem nyckelkort + dam + storslamszon
    // mot partnerns visade MINIMUM (aldrig hopp om att partnern har maximum).
    if (floor >= 37 && derived.certain && total === 5 && queenKnown) {
      turns.push({
        role: 'svarare',
        call: '5NT',
        rule: 'Sjöberg 5NT',
        explanation: `alla fem nyckelkort + trumfdam, storslamszon (~${floor}+) → 5NT (frågar kungar).`,
      })
      const kingAnswer = respondToKingAsk(openerHand, trump)
      turns.push({ role: 'öppnare', call: kingAnswer.call, rule: kingAnswer.rule, explanation: kingAnswer.explanation })
      if (kingAnswer.call !== `6${LETTER[trump]}` && kingAnswer.call !== `7${LETTER[trump]}`) {
        turns.push({
          role: 'svarare',
          call: `7${LETTER[trump]}`,
          rule: 'slamavslut',
          explanation: `kung visad → storslam (7${SYM[trump]}).`,
        })
      }
      return turns
    }

    const why = derived.certain
      ? total === 4
        ? `ett nyckelkort saknas → 6${SYM[trump]} (lillslam).`
        : `alla fem nyckelkort men ingen säker storslamszon → 6${SYM[trump]} (lillslam).`
      : `svaret visar ${derived.low} eller ${derived.high}; partnerns visade ${ctx.partnerMin}+ talar för ${derived.assumed} → 6${SYM[trump]}.`
    turns.push({ role: 'svarare', call: `6${LETTER[trump]}`, rule: 'slamavslut', explanation: why })
    return turns
  }

  // För få nyckelkort (räknat lågt) → stanna i 5-trumf.
  if (bidRank(signOff) > bidRank(answer.call)) {
    turns.push({
      role: 'svarare',
      call: signOff,
      rule: 'RKC: stopp',
      explanation: derived.certain
        ? `två nyckelkort saknas → stannar i 5${SYM[trump]}.`
        : `svaret visar ${derived.low} eller ${derived.high}; jag räknar lågt → stannar i 5${SYM[trump]}.`,
    })
    // Partnerns RÄTTELSE (egen hand): satt hen med det HÖGA antalet vet hen att
    // kaptenen räknade lågt → lyfter själv till 6. Klassisk mänsklig mekanik.
    if (!derived.certain && keycards(openerHand, trump) === derived.high) {
      turns.push({
        role: 'öppnare',
        call: `6${LETTER[trump]}`,
        rule: 'RKC: rättelse',
        explanation: `mitt svar visade ${derived.low} ELLER ${derived.high} — jag har ${derived.high} → lyfter till 6${SYM[trump]}.`,
      })
    }
    return turns
  }

  // Svaret gick förbi 5-trumf (t.ex. 5♠ över hjärtertrumf, eller 5♦ över
  // klövertrumf): inget stoppbud finns. Kaptenen måste välja på stående fot —
  // räkna med det höga alternativet (mänskligt dilemma, kan bli fel).
  if (answer.call === signOff) {
    // Svaret VAR 5-trumf → passa: kontraktet står redan på stoppnivån.
    turns.push({
      role: 'svarare',
      call: 'P',
      rule: 'RKC: stopp',
      explanation: `för få nyckelkort → passar; kontraktet står i 5${SYM[trump]}.`,
    })
    return turns
  }
  turns.push({
    role: 'svarare',
    call: `6${LETTER[trump]}`,
    rule: 'slamavslut',
    explanation: `svaret (${derived.low} eller ${derived.high}) gick förbi stoppnivån 5${SYM[trump]} → räknar med det höga antalet → 6${SYM[trump]}.`,
  })
  return turns
}

/** Kanske-zonen: kaptenen bjuder in; partnern accepterar med mer än blott minimum. */
function inviteSlam(openerHand: Hand, trump: Suit, ctx: SlamContext, floor: number): SlamTurn[] {
  const invite = ctx.inviteCall!
  const turns: SlamTurn[] = []
  turns.push({
    role: 'svarare',
    call: invite,
    rule: 'slaminbjudan',
    explanation: `~${floor}–${floor + 2} poäng ihop (slam bara om partnern har extra) → ${invite[0]}${SYM[trump]} (inbjuder slam).`,
  })
  // Partnern dömer på SIN hand mot sitt eget visade intervall: mer än blott
  // minimum → acceptera. (Omvärderad med fit: Bergenpoäng, aldrig under hp.)
  const partnerPts = Math.max(hcp(openerHand), bergenPoints(openerHand, trump).bergenPoints)
  if (partnerPts >= ctx.partnerMin + 1) {
    turns.push({
      role: 'öppnare',
      call: `6${LETTER[trump]}`,
      rule: 'slaminbjudan: accept',
      explanation: `${partnerPts} poäng — mer än blott minimum → accepterar, 6${SYM[trump]}.`,
    })
  } else if (invite.startsWith('4')) {
    turns.push({
      role: 'öppnare',
      call: `5${LETTER[trump]}`,
      rule: 'slaminbjudan: avböjer',
      explanation: `blott minimum → avböjer, 5${SYM[trump]} (utgång).`,
    })
  } else {
    turns.push({
      role: 'öppnare',
      call: 'P',
      rule: 'slaminbjudan: avböjer',
      explanation: `blott minimum → avböjer, passar ${invite[0]}${SYM[trump]}.`,
    })
  }
  return turns
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

/**
 * Exclusion Blackwood (§6.5) efter en splinter där öppnaren visat slamintresse
 * (splinter-relä, visar ~15+). Svararen (kaptenen) gate:ar på SIN hand + det
 * visade minimumet, hoppar till 5 i renonsfärgen och frågar nyckelkort UTOM
 * esset där; öppnaren svarar ärligt i steg; kaptenen placerar på svaret.
 * null = ingen sidorenons eller för svagt → vanlig auktion.
 */
export function exclusionInvestigation(
  openerHand: Hand,
  responderHand: Hand,
  trump: Suit,
  partnerMin: number,
): SlamTurn[] | null {
  const len = lengths(responderHand)
  const voidSuit = RANK_ORDER.find((s) => s !== trump && len[s] === 0)
  if (!voidSuit) return null

  const captain = Math.max(hcp(responderHand), dummyPoints(responderHand, trump).dummyPoints)
  if (captain + partnerMin < 33) return null

  const turns: SlamTurn[] = []
  turns.push({
    role: 'svarare',
    call: `5${LETTER[voidSuit]}`,
    rule: 'Exclusion',
    explanation: `renons i ${NAME[voidSuit]}, ~${captain + partnerMin}+ ihop → 5${SYM[voidSuit]} (Exclusion: frågar nyckelkort utom esset där).`,
  })
  const answer = respondToExclusion(openerHand, trump, voidSuit)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  // Kaptenen härleder ur STEGET + egen hand (pool = 4: tre sidoess + trumfkung).
  const own = exclusionKeycards(responderHand, trump, voidSuit)
  const stepOptions = answer.explanation.includes('steg 1')
    ? [1, 4]
    : answer.explanation.includes('steg 2')
      ? [0, 3]
      : [2] // steg 3/4 = exakt 2
  const possible = stepOptions.filter((o) => own + o <= 4)
  const certain = possible.length === 1
  const assumed = certain ? possible[0] : partnerMin >= 15 ? Math.max(...possible) : Math.min(...possible)
  const missing = 4 - (own + assumed)

  const target = missing <= 0 && certain ? `7${LETTER[trump]}` : missing <= 1 ? `6${LETTER[trump]}` : `5${LETTER[trump]}`
  if (bidRank(target) <= bidRank(answer.call)) {
    // Öppnarens stegsvar satte redan (minst) målnivån → kaptenen passar.
    turns.push({ role: 'svarare', call: 'P', rule: 'slamavslut', explanation: `öppnarens svar (${answer.call}) satte redan nivån → pass.` })
    return turns
  }
  const why = missing <= 0
    ? `inget nyckelkort saknas (renons-esset borträknat) → storslam 7${SYM[trump]}.`
    : missing === 1
      ? `ett nyckelkort saknas → lillslam 6${SYM[trump]}.`
      : `två+ nyckelkort saknas → stannar i 5${SYM[trump]}.`
  turns.push({ role: 'svarare', call: target, rule: missing >= 2 ? 'Exclusion: stopp' : 'slamavslut', explanation: why })

  return turns
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

/**
 * Svararens fortsättning efter 1NT–2♠–3♣/3♦ (minorfit funnen). Returnerar hela
 * placeringen (asksekvens + slutbud), aldrig null – en fit finns alltid.
 */
export function mssMinorFitContinuation(
  openerHand: Hand,
  responderHand: Hand,
  minor: Suit, // 'clubs' | 'diamonds'
  openerRebidCall: string, // '3C' | '3D'
): SlamTurn[] {
  // NT osäkert på egen hand → minor-slam-spåret (4NT RKC → 6/7-minor). Räcker
  // det inte till slam → minorutgång 5m (kan stjäla förlorare, till skillnad
  // från 3NT). Inbjudan 4m i kanske-zonen.
  if (ntUnsafe(responderHand)) {
    const slam = slamInvestigation(openerHand, responderHand, minor, openerRebidCall, {
      partnerMin: OPENER_1NT_MIN,
      inviteCall: `4${LETTER[minor]}`,
    })
    if (slam) return slam
    return [{
      role: 'svarare',
      call: `5${LETTER[minor]}`,
      rule: 'MSS: minorutgång',
      explanation: `NT osäkert (högfärgslucka på egen hand), för svagt för slam → 5${SYM[minor]} (minorutgång).`,
    }]
  }

  // NT-säkert → sikta NT-slam. Kaptenens egen hp + öppnarens visade 15:
  // 33+ = driv (RKC), annars 3NT (balanserad utgång).
  const ownHcp = hcp(responderHand)
  const floor = ownHcp + OPENER_1NT_MIN
  if (floor < 33) {
    return [{
      role: 'svarare',
      call: '3NT',
      rule: 'till spel',
      explanation: `${ownHcp} hp mot visade 15–17 → 3NT (balanserad utgång, ej slamzon).`,
    }]
  }

  const turns: SlamTurn[] = []
  turns.push({
    role: 'svarare',
    call: '4NT',
    rule: '1430 RKC',
    explanation: `minst ~${floor} hp ihop, NT-säker minorfit → 4NT (frågar nyckelkort inför NT-slam).`,
  })
  const answer = respondToRKC(openerHand, minor)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  const own = keycards(responderHand, minor)
  const derived = partnerKeycardsFromAnswer(answer.call, own, OPENER_1NT_MIN)
  const total = own + derived.assumed
  const queenKnown = hasTrumpQueen(responderHand, minor) || answer.call === '5S'

  if (total <= 3) {
    // För få nyckelkort → tillbaka till den agreade minoren (5m = utgång).
    const escape = `5${LETTER[minor]}`
    if (answer.call === escape) {
      turns.push({ role: 'svarare', call: 'P', rule: 'RKC: stopp', explanation: `för få nyckelkort → passar; 5${SYM[minor]} står.` })
    } else if (bidRank(escape) > bidRank(answer.call)) {
      turns.push({ role: 'svarare', call: escape, rule: 'RKC: stopp', explanation: `för få nyckelkort → stannar i 5${SYM[minor]} (minorutgång).` })
    } else {
      turns.push({ role: 'svarare', call: `6${LETTER[minor]}`, rule: 'slamavslut', explanation: `svaret gick förbi 5${SYM[minor]} → tvunget 6${SYM[minor]} (räknar högt).` })
    }
    return turns
  }

  // Storslamszon mot visat minimum + entydigt alla fem + dam → kungfråga.
  if (floor >= 37 && derived.certain && total === 5 && queenKnown) {
    turns.push({
      role: 'svarare',
      call: '5NT',
      rule: 'Sjöberg 5NT',
      explanation: `alla fem nyckelkort + trumfdam, storslamszon (~${floor}+) → 5NT (frågar kungar).`,
    })
    const kingAnswer = respondToKingAsk(openerHand, minor)
    turns.push({ role: 'öppnare', call: kingAnswer.call, rule: kingAnswer.rule, explanation: kingAnswer.explanation })
    const noKing = kingAnswer.call === `6${LETTER[minor]}`
    turns.push({
      role: 'svarare',
      call: noKing ? '6NT' : '7NT',
      rule: 'slamavslut',
      explanation: noKing ? 'ingen sidokung → 6NT.' : 'sidokung visad → storslam 7NT.',
    })
    return turns
  }

  const why = derived.certain
    ? total === 4
      ? `ett nyckelkort saknas → 6NT (lillslam).`
      : `alla fem nyckelkort men ingen säker storslamszon → 6NT (lillslam).`
    : `svaret visar ${derived.low} eller ${derived.high}; visade 15–17 talar för ${derived.assumed} → 6NT.`
  turns.push({ role: 'svarare', call: '6NT', rule: 'slamavslut', explanation: why })
  return turns
}
