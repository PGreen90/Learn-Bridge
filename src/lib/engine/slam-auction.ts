// Kopplar in slamverktygen (slam.ts) i en VÄXANDE auktion. Slamverktygen är
// ask/svar-funktioner som lever djupt i budgivningen (efter att trumf är
// överenskommen). Här tas det första, entydiga fallet: en högfärgsfit via
// Jacoby 2NT (utgångskrav) där parets samlade poäng når slamzon → kaptenen
// (svararen) frågar 1430 RKC och placerar sedan kontraktet.
//
// Slamzon enligt Bergen: Bergenpoäng (öppnaren, omvärderad vid fit) +
// stödpoäng (svararen som blir träkarl) ≥ 33. Storslam ≥ 37.

import type { Hand, Suit } from '../../types/bridge'
import { bergenPoints, dummyPoints, wastedHonorsOppositeShortness } from './evaluation'
import { hcp, lengths } from './hand'
import {
  cheapestCueBid,
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
const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
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

/**
 * Slamutredning efter en högfärgsfit (kaptenen = svararen frågar). Returnerar
 * de extra buden (4NT → RKC-svar → slamavslut), eller null om paret inte når
 * slamzon (då fortsätter den vanliga auktionen).
 */
export function slamInvestigation(
  openerHand: Hand,
  responderHand: Hand,
  trump: Suit,
  lastCall?: string,
  partnerShortSuit?: Suit,
  skipCueRound = false,
): SlamTurn[] | null {
  const raw = bergenPoints(openerHand, trump).bergenPoints + dummyPoints(responderHand, trump).dummyPoints
  // FAS 4 punkt 18: har öppnaren visat korthet i en sidofärg (Jacoby-kortfärg)
  // sitter SVARARENS K/D där döda → dra av dem innan slamzon-porten, annars
  // överbjuds slam på honnörer som partnern ändå ruffar bort.
  const wasted = partnerShortSuit ? wastedHonorsOppositeShortness(responderHand, partnerShortSuit) : 0
  const combined = raw - wasted
  if (combined < 33) return null

  // Saknar paret TVÅ nyckelkort (≤3 av 5) ska man inte fråga RKC – då blir man
  // strandad över utgång. Stanna i den vanliga auktionen (kräver två kontroller).
  const total = keycards(openerHand, trump) + keycards(responderHand, trump)
  const queen = hasTrumpQueen(openerHand, trump) || hasTrumpQueen(responderHand, trump)
  if (total <= 3) return null

  const turns: SlamTurn[] = []

  // Cue-bid-rond före RKC (§6.2): med trumf överenskommen visar man kontroller
  // (ess/renons) billigast uppåt INNAN 4NT, så ett läckande hål syns. Kaptenen
  // (svararen) cue-buddar billigaste första-rondskontroll; öppnaren cue-buddar
  // billigaste kontroll ovanför. Buden måste vara LAGLIGA (högre än öppnarens
  // återbud `lastCall`): har öppnaren redan rebjudit på 4-läget i en färg (t.ex.
  // Jacoby-sidofärg 4♦) måste cue-budet ligga ovanför – annars hoppas ronden över.
  // `skipCueRound` (felrapport #29): i lägen UTAN en explicit trumf-överenskommelse
  // före slamfrågan (öppnarens hopp-återbud i egen minor) skulle svararens cue
  // kunna bli det HÖGSTA lagliga budet utan att öppnaren kan cue:a tillbaka → två
  // svararbud i rad (olaglig följd). Där hoppar vi cue-ronden och går direkt på RKC.
  const lastRank = lastCall ? bidRank(lastCall) : -1
  const m4 = lastCall ? lastCall.match(/^4(C|D|H|S)$/) : null
  const cueAbove: Suit | null = m4 ? SUIT_OF_LETTER[m4[1]] : null
  const respCue = !skipCueRound && lastRank < bidRank('4NT') ? cheapestCueBid(responderHand, trump, cueAbove) : null
  if (respCue && bidRank(respCue.call) > lastRank) {
    // Cue-ronden får bara läggas som ett KOMPLETT par (svarare + öppnare) så att
    // auktionen alternerar medurs. Kan öppnaren inte cue:a tillbaka lagligt (ingen
    // kontroll ovanför svararens cue) hoppar vi över HELA cue-ronden och går direkt
    // på 4NT RKC – annars blir svararens cue "hängande" (två svararbud i rad =
    // olaglig auktion; live-lagret föll då av linjen och passade delkontraktet, den
    // gamla slam-quirken). Nyckelkortsporten (≥4) hindrar ändå slam med två snabba
    // förlorare (≤1 nyckelkort saknas → ≤1 snabb förlorare), så inget skydd tappas.
    const openCue = cheapestCueBid(openerHand, trump, SUIT_OF_LETTER[respCue.call[1]])
    if (openCue && bidRank(openCue.call) > bidRank(respCue.call)) {
      turns.push({ role: 'svarare', call: respCue.call, rule: respCue.rule, explanation: respCue.explanation })
      turns.push({ role: 'öppnare', call: openCue.call, rule: openCue.rule, explanation: openCue.explanation })
    }
  }

  // Kaptenen (svararen) frågar nyckelkort med 1430 RKC.
  turns.push({
    role: 'svarare',
    call: '4NT',
    rule: '1430 RKC',
    explanation: `slamzon (~${combined} poäng ihop) → 4NT (frågar nyckelkort).`,
  })

  // Öppnaren svarar på frågan.
  const answer = respondToRKC(openerHand, trump)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  // Kaptenen placerar kontraktet (paret har minst 4 nyckelkort, se bail ovan).
  // Storslamszon med alla fem nyckelkort + trumfdam → fråga kungar (Sjöbergs 5NT)
  // innan vi tar ställning till storslam. En visad sidokung (6 i sidofärg) ger det
  // 13:e sticket → kaptenen lyfter till 7; ingen kung (öppnaren bjuder 6 i trumf)
  // → stanna i 6; två+ kungar (öppnaren bjuder 7 i trumf) → storslam är redan satt.
  if (total === 5 && queen && combined >= 37) {
    turns.push({
      role: 'svarare',
      call: '5NT',
      rule: 'Sjöberg 5NT',
      explanation: `alla fem nyckelkort + trumfdam, storslamszon (~${combined} poäng) → 5NT (frågar kungar).`,
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

  const why = total === 4
    ? `ett nyckelkort saknas → 6${SYM[trump]} (lillslam).`
    : `alla fem nyckelkort men ingen storslamszon → 6${SYM[trump]} (lillslam).`
  turns.push({ role: 'svarare', call: `6${LETTER[trump]}`, rule: 'slamavslut', explanation: why })

  return turns
}

/**
 * Trumfval för en OBALANSERAD slamhand efter öppnarens 1NT-återbud (F1 familj A).
 * Returnerar den färg paret ska spela slam i, eller null om ingen tydlig färgfit
 * finns (då står NT-vägen / vanlig auktion). Prioritet:
 *  1. svararens egen 6+ högfärg (självförsörjande trumf),
 *  2. en 8+ korts högfärgsfit (5-3 / 4-4),
 *  3. en 8+ korts minorfit (öppnarens öppnade minor först).
 * Slam-portarna (≥33 stödpoäng, ≥4 nyckelkort, kontroller) sköts av
 * `slamInvestigation` – här väljs bara trumfen.
 */
export function familyAFitTrump(
  opener: Hand,
  responder: Hand,
  openedSuit: Suit | null,
  responderSuit: Suit | null,
): Suit | null {
  const lo = lengths(opener)
  const lr = lengths(responder)
  if (responderSuit && (responderSuit === 'hearts' || responderSuit === 'spades') && lr[responderSuit] >= 6) {
    return responderSuit
  }
  for (const m of MAJORS) if (lo[m] + lr[m] >= 8) return m
  const minors: Suit[] = openedSuit === 'diamonds' ? ['diamonds', 'clubs'] : ['clubs', 'diamonds']
  for (const mi of minors) if (lo[mi] + lr[mi] >= 8) return mi
  return null
}

/**
 * Exclusion Blackwood (§6.5) efter en splinter där öppnaren visat slamintresse
 * (splinter-relä). Svararen, som har en sidorenons, hoppar till 5 i renonsfärgen
 * och frågar nyckelkort UTOM esset där; öppnaren svarar i steg; svararen placerar
 * slam. Returnerar null (→ vanlig auktion) om förutsättningarna inte håller:
 *  - ingen sidorenons,
 *  - paret når inte slamzon, eller två+ nyckelkort saknas (ej slamsäkert).
 *
 * Renonsfärg som rankar ÖVER trumf hanteras nu (FAS 8, 2026-07-01). I den
 * inkopplade högfärgsgrenen är enda fallet hjärter trumf + spaderrenons → 5♠.
 * Öppnarens högsta stegsvar (steg 4 = 2 nyckelkort med trumfdam) landar då på
 * exakt 6 i trumf (6♥). Vill svararen bara ha lillslam kan hon inte bjuda om
 * 6♥ (olagligt) → hon PASSAR i stället. Grundslutbudet (6/7 i trumf) ligger
 * annars alltid över öppnarens svar, så vi behöver ingen nivåbail längre.
 */
export function exclusionInvestigation(openerHand: Hand, responderHand: Hand, trump: Suit): SlamTurn[] | null {
  const len = lengths(responderHand)
  const voidSuit = RANK_ORDER.find((s) => s !== trump && len[s] === 0)
  if (!voidSuit) return null

  const combined = bergenPoints(openerHand, trump).bergenPoints + dummyPoints(responderHand, trump).dummyPoints
  if (combined < 33) return null

  // Nyckelkort utom renonsfärgens ess: 3 sidoess + trumfkung = max 4.
  const total = exclusionKeycards(openerHand, trump, voidSuit) + exclusionKeycards(responderHand, trump, voidSuit)
  const missing = 4 - total
  if (missing >= 2) return null // inte slamsäkert → vanlig auktion fortsätter

  const turns: SlamTurn[] = []
  turns.push({
    role: 'svarare',
    call: `5${LETTER[voidSuit]}`,
    rule: 'Exclusion',
    explanation: `renons i ${NAME[voidSuit]} → 5${SYM[voidSuit]} (Exclusion: frågar nyckelkort utom esset där).`,
  })
  const answer = respondToExclusion(openerHand, trump, voidSuit)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  const target = missing === 0 ? `7${LETTER[trump]}` : `6${LETTER[trump]}`
  // Nådde öppnarens stegsvar redan slutbudet (steg 4 = 6 i trumf, lillslam)?
  // Då kan svararen inte bjuda om det – hon passar och satsar på det öppnaren satt.
  if (bidRank(answer.call) >= bidRank(target)) {
    turns.push({ role: 'svarare', call: 'P', rule: 'slamavslut', explanation: `öppnarens svar (${answer.call}) satte redan lillslammen i trumf → pass.` })
    return turns
  }

  const why = missing === 0
    ? `inget nyckelkort saknas (renons-esset borträknat) → storslam 7${SYM[trump]}.`
    : `ett nyckelkort saknas → lillslam 6${SYM[trump]}.`
  turns.push({ role: 'svarare', call: target, rule: 'slamavslut', explanation: why })

  return turns
}

// === MSS-slam (FAS 8): slamfortsättning efter Minor Suit Stayman-minorfit ====
//
// Efter 1NT–2♠–3♣/3♦ har svararen (kaptenen) 5-4+ i minorerna och GF/slam; en
// minorfit är garanterad när öppnaren visat en minor. Svararen driver med hela
// slamarsenalen och PLACERAR sedan smartast.
//
// Ägarbeslut 2026-07-01: **NT om säkert, annars minor.** Öppnaren är balanserad,
// så en NT-slam (6NT/7NT) ger 10 poäng mer och slipper stjälningsrisk – det är
// grundvalet. Motorn byter till minor-slam (6/7-minor) BARA när NT är osäkert:
// en högfärg gapar (ingen A/K/Q hos någondera → snabb förlorare i NT) eller
// svararen har en högfärgsrenons (ruffvärde talar för färgkontrakt). Handstyrt
// per giv – ingen fast regel. "Hur högt" avgörs av nyckelkort + poäng.

const MAJORS: Suit[] = ['hearts', 'spades']
const hasTopHonor = (hand: Hand, suit: Suit) =>
  hand.some((c) => c.suit === suit && (c.rank === 'A' || c.rank === 'K' || c.rank === 'Q'))

/** NT osäkert: en högfärg gapar (ingen A/K/Q någonstans) eller svararrenons i hf. */
function ntUnsafe(openerHand: Hand, responderHand: Hand): boolean {
  const hole = MAJORS.some((m) => !hasTopHonor(openerHand, m) && !hasTopHonor(responderHand, m))
  const rl = lengths(responderHand)
  const responderMajorVoid = MAJORS.some((m) => rl[m] === 0)
  return hole || responderMajorVoid
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
  // NT osäkert → minor-slam-spåret: återanvänd suit-slam-maskineriet (cue → RKC
  // → 6/7-minor). Räcker det inte till slam (för svagt / två nyckelkort borta)
  // → minorutgång 5m (kan stjäla förlorare, till skillnad från 3NT).
  if (ntUnsafe(openerHand, responderHand)) {
    const slam = slamInvestigation(openerHand, responderHand, minor, openerRebidCall)
    if (slam) return slam
    return [{
      role: 'svarare',
      call: `5${LETTER[minor]}`,
      rule: 'MSS: minorutgång',
      explanation: `NT osäkert (högfärg utan håll/renons), för svagt för slam → 5${SYM[minor]} (minorutgång).`,
    }]
  }

  // NT-säkert (alla högfärger täckta, ingen renons) → sikta NT-slam. Poängen
  // avgör NT-zonen (balanserat par → rå hp, inte fördelning): 33+ = lillslam,
  // 37+ = storslam. Saknar paret slamzon ELLER två nyckelkort → stanna i 3NT
  // (annars strandar RKC-frågan över utgång, precis som i slamInvestigation).
  const points = hcp(openerHand) + hcp(responderHand)
  const total = keycards(openerHand, minor) + keycards(responderHand, minor)
  const queen = hasTrumpQueen(openerHand, minor) || hasTrumpQueen(responderHand, minor)
  if (points < 33 || total <= 3) {
    return [{
      role: 'svarare',
      call: '3NT',
      rule: 'till spel',
      explanation: `${points} hp ihop, minorfit men ej slamsäkert → 3NT (balanserad utgång).`,
    }]
  }

  const turns: SlamTurn[] = []
  turns.push({
    role: 'svarare',
    call: '4NT',
    rule: '1430 RKC',
    explanation: `slamzon (~${points} hp), NT-säker minorfit → 4NT (frågar nyckelkort inför NT-slam).`,
  })
  const answer = respondToRKC(openerHand, minor)
  turns.push({ role: 'öppnare', call: answer.call, rule: answer.rule, explanation: answer.explanation })

  // Storslamszon + alla fem nyckelkort + trumfdam → kungfråga (Sjöberg 5NT): en
  // visad sidokung ger 13:e sticket → 7NT; ingen kung → 6NT.
  if (points >= 37 && total === 5 && queen) {
    turns.push({
      role: 'svarare',
      call: '5NT',
      rule: 'Sjöberg 5NT',
      explanation: `alla fem nyckelkort + trumfdam, storslamszon (~${points} hp) → 5NT (frågar kungar).`,
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

  const why = total === 4
    ? `ett nyckelkort saknas → 6NT (lillslam).`
    : `alla fem nyckelkort men ingen storslamszon → 6NT (lillslam).`
  turns.push({ role: 'svarare', call: '6NT', rule: 'slamavslut', explanation: why })
  return turns
}
